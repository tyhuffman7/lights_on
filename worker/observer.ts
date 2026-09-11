import { CapacityScheduler } from "../lib/research/capacity.ts";
import { ReconciliationScheduler } from "../lib/research/reconciliation.ts";
import { reviewQueue } from "../lib/research/review.ts";
import { Worker } from "node:worker_threads";
import {
  market,
  book as restBook,
  observeRequestTiming,
} from "../lib/arb/adapters.ts";
import type { Venue } from "../lib/arb/types.ts";
import type { StreamBook } from "../lib/research/types.ts";
import { BookCache } from "../lib/research/books.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { LiveRecorder } from "./live-recorder.ts";
import { Telemetry } from "./telemetry.ts";
import { applyCatalogAsync, reconcileGroups } from "./coverage.ts";
import type { ResearchStore } from "../lib/research/store.ts";
import { analyzeLatency } from "../lib/research/latency.ts";
import { StreamConnection, authHeaders } from "./streams.ts";
import type { ObserverConfig } from "./config.ts";
export class Observer {
  store: ResearchStore;
  config: ObserverConfig;
  registry: MappingRegistry;
  recorder: LiveRecorder;
  telemetry = new Telemetry();
  capacityScheduler = new CapacityScheduler();
  capacity: ReturnType<CapacityScheduler["select"]> | null = null;
  reconciliationScheduler = new ReconciliationScheduler();
  reconciliationSuspicious = new Set<string>();
  snapshotTimers = new Map<string, ReturnType<typeof setTimeout>>();
  discoveryRestTotals = { kalshi: 0, poly: 0 };
  discoveryStatus: any = null;
  discoveryWorker: Worker | null = null;
  lastDiscoveryAt: number | null = null;
  nextDiscoveryAt: number | null = null;
  discovering = false;
  abort = new AbortController();
  shardCaches = new Map<StreamConnection, BookCache>();
  cache = new BookCache();
  streams: StreamConnection[] = [];
  marketStreams = new Map<string, StreamConnection>();
  timers: ReturnType<typeof setInterval>[] = [];
  paused = true;
  stopped = false;
  busyMetadata = false;
  busyReconcile = false;
  lastTick = performance.now();
  constructor(store: ResearchStore, config: ObserverConfig) {
    this.store = store;
    this.config = config;
    this.registry = new MappingRegistry(store);
    this.recorder = new LiveRecorder(
      store.path,
      this.registry,
      config,
      this.telemetry,
      () => this.pause(),
      config.maxPersistencePending,
    );
    this.recorder.streamHealthy = (venue, id) =>
      this.marketStreams.get(venue + ":" + id)?.isHealthy() ?? false;
    this.registry.persist = (m, at) => {
      this.recorder.patchMapping(m);
      this.recorder.enqueue("mapping", { m, at });
    };
    observeRequestTiming((host, ms) => {
      this.telemetry.count(
        `${host.includes("kalshi") ? "kalshi" : "poly"}RestRequests`,
      );
      this.telemetry.sample(
        `${host.includes("kalshi") ? "kalshi" : "poly"}RestRoundTrip`,
        ms,
      );
    });
  }
  async initialize() {
    await this.recorder.ready;
    if (this.store.path !== ":memory:")
      this.recorder.activity = await this.recorder.send("activity", {});
    for (const a of Object.values(this.recorder.activity)) {
      a.priorCount = a.count ?? 0;
      a.persistedBaseline = a.count ?? 0;
    }
    for (const entry of this.config.markets) {
      const a = await market("kalshi", entry.kalshi),
        b = await market("poly", entry.poly);
      const id = `${a.id}::${b.id}`;
      if (this.registry.get(id))
        this.registry.refresh(id, a, b, Date.now(), entry.inverted);
      else
        this.registry.add({
          id,
          a,
          b,
          inverted: entry.inverted,
          reviewed: false,
        });
    }
    this.recorder.reindex();
  }
  private invalid(venue: Venue, reason: string, ids?: string[]) {
    if (this.stopped) return;
    const selected = ids ? new Set(ids) : null;
    const affected = (b: StreamBook) =>
      b.venue === venue && (!selected || selected.has(b.marketId));
    // A recovery and its ensuing socket close must invalidate each live book once.
    // Use recorder copies: resetting a shard mutates its shared cache objects first.
    const changed = [...this.recorder.books.values()].filter(
      (b) => affected(b) && b.valid,
    );
    if (!ids) this.cache.reset(venue);
    const wall = Date.now(),
      mono = performance.now();
    for (const b of this.cache.books.values())
      if (affected(b))
        this.cache.books.set(`${b.venue}:${b.marketId}`, {
          ...b,
          valid: false,
          connection: "DISCONNECTED",
        });
    for (const b of changed) {
      if (this.recorder.failed) break; // queue failure already pauses every stream
      this.recorder.update({
        ...b,
        valid: false,
        connection: "DISCONNECTED",
        receivedAt: wall,
        receivedMono: mono,
      });
    }
    this.telemetry.count(reason);
    if (!this.recorder.failed)
      this.recorder.diagnostic(reason, { venue, markets: ids?.length });
  }
  resume() {
    if (this.stopped || !this.paused) return;
    if (this.recorder.failed)
      throw new Error("Persistence failed; restart required");
    for (const venue of ["kalshi", "poly"] as Venue[]) authHeaders(venue);
    this.paused = false;
    this.syncSubscriptions();
    if (this.config.discoveryEnabled) void this.discover();
    this.lastTick = performance.now();
    this.timers.push(
      setInterval(() => {
        const mono = performance.now(),
          wall = Date.now();
        if (mono - this.lastTick > 250) {
          this.telemetry.count("eventLoopDelayEpisodes");
          this.streams
            .filter(
              (s) =>
                s.health().connected &&
                [...(this.shardCaches.get(s)?.books.values() ?? [])].some(
                  (b) => b.valid,
                ),
            )
            .forEach((s) => s.recover("EVENT_LOOP_DELAY"));
        }
        this.lastTick = mono;
        if (this.recorder.failed) {
          this.pause();
          return;
        }
        this.recorder.tick(wall, mono);
      }, 100),
    );
    this.timers.push(
      setInterval(() => void this.metadata(), this.config.metadataIntervalMs),
    );
    this.timers.push(setInterval(() => void this.reconcile(), 1000));
    this.timers.push(
      setInterval(() => this.recorder.analyze(performance.now()), 5000),
    );
    this.timers.push(
      setInterval(() => {
        if (this.nextDiscoveryAt !== null && Date.now() >= this.nextDiscoveryAt)
          void this.discover();
        if (this.capacity && Date.now() >= this.capacity.nextRotationAt)
          this.syncSubscriptions();
      }, 1000),
    );
    this.timers.push(
      setInterval(
        () =>
          this.recorder.diagnostic("TELEMETRY", {
            ...this.compactHealth(),
            telemetry: this.telemetry.snapshot(true),
          }),
        10000,
      ),
    );
  }
  pause() {
    this.paused = true;
    for (const timer of this.snapshotTimers.values()) clearTimeout(timer);
    this.snapshotTimers.clear();
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.streams.forEach((s) => s.stop());
    this.streams = [];
    this.shardCaches.clear();
    this.marketStreams.clear();
    if (!this.recorder.failed)
      for (const v of ["kalshi", "poly"] as Venue[]) this.invalid(v, "PAUSED");
  }
  async metadata() {
    if (this.busyMetadata || this.paused || this.stopped || this.discovering)
      return;
    this.busyMetadata = true;
    const fetched = new Map<string, Awaited<ReturnType<typeof market>>>();
    const get = async (venue: Venue, id: string) => {
      const key = venue + ":" + id;
      if (!fetched.has(key)) fetched.set(key, await market(venue, id));
      return fetched.get(key)!;
    };
    const subscribed = new Set(
      this.streams.flatMap((s) =>
        s.options.ids.map((id) => s.options.venue + ":" + id),
      ),
    );
    try {
      for (const m of this.registry.list()) {
        if (!m.active && m.reason !== "METADATA_UNAVAILABLE") continue;
        if (
          m.active &&
          !subscribed.has("kalshi:" + m.pair.a.id) &&
          !subscribed.has("poly:" + m.pair.b.id)
        )
          continue;
        try {
          const fetchedAt = Date.now();
          const a = await get("kalshi", m.pair.a.id),
            b = await get("poly", m.pair.b.id);
          if (this.stopped || this.paused) return;
          this.registry.refresh(m.id, a, b, fetchedAt);
        } catch {
          if (this.stopped) return;
          this.registry.deactivate(m.id, "METADATA_UNAVAILABLE");
          this.invalid("kalshi", "METADATA_UNAVAILABLE", [m.pair.a.id]);
          this.invalid("poly", "METADATA_UNAVAILABLE", [m.pair.b.id]);
        }
      }
      if (!this.stopped) {
        this.recorder.tick(Date.now(), performance.now(), true);
        await this.syncSubscriptions();
      }
    } finally {
      this.busyMetadata = false;
    }
  }
  async reconcile() {
    if (this.busyReconcile || this.paused || this.stopped) return;
    this.busyReconcile = true;
    try {
      const subscribed = new Set(
        this.streams.flatMap((s) =>
          s.options.ids.map((id) => s.options.venue + ":" + id),
        ),
      );
      const markets = this.registry
        .list()
        .filter((m) => m.active)
        .flatMap((m) => [m.pair.a, m.pair.b])
        .filter((m) => subscribed.has(m.venue + ":" + m.id));
      const selected = this.reconciliationScheduler.take(
        markets,
        Date.now(),
        1,
        this.config.reconciliationIntervalMs /
          this.config.reconciliationMaxRequests,
        this.reconciliationSuspicious,
      );
      for (const venueMarket of selected) {
        this.telemetry.count("reconciliationRequests");
        const reconciliationStream = this.streams.find(
          (s) =>
            s.options.venue === venueMarket.venue &&
            s.options.ids.includes(venueMarket.id),
        );
        if (reconciliationStream) {
          reconciliationStream.reconciliationRequests++;
          reconciliationStream.lastReconciliationAt = Date.now();
        }
        const before = this.cache.get(venueMarket.venue, venueMarket.id);
        if (!before?.valid) continue;
        try {
          const snapshot = await restBook(venueMarket);
          if (this.stopped || this.paused) return;
          const after = this.cache.get(venueMarket.venue, venueMarket.id);
          // Only compare if no stream update raced the REST request. The REST snapshot
          // remains diagnostic evidence; it cannot restore a sequence-valid stream.
          const rest: StreamBook = {
            ...snapshot,
            venue: venueMarket.venue,
            marketId: venueMarket.id,
            receivedMono: performance.now(),
            sequence: null,
            connection: "RECOVERING",
            valid: false,
            source: "rest",
          };
          this.recorder.diagnostic("REST_RECONCILIATION", {
            venue: venueMarket.venue,
            marketId: venueMarket.id,
            raced: before !== after,
            streamAgeMs: performance.now() - before.receivedMono,
            restLevels: snapshot.yes.length + snapshot.no.length,
          });
          if (before === after) {
            const top = (ls: { price: number; quantity: number }[]) =>
              JSON.stringify(
                [...ls].sort((a, b) => a.price - b.price).slice(0, 10),
              );
            if (
              top(snapshot.yes) !== top(before.yes) ||
              top(snapshot.no) !== top(before.no)
            ) {
              this.reconciliationSuspicious.add(
                venueMarket.venue + ":" + venueMarket.id,
              );
              this.telemetry.count("reconciliationMismatches");
              const stream = this.streams.find(
                (s) =>
                  s.options.venue === venueMarket.venue &&
                  s.options.ids.includes(venueMarket.id),
              );
              const shard = stream ? this.shardCaches.get(stream) : undefined;
              const sid = shard?.subscriptions.get(venueMarket.id);
              if (
                stream &&
                shard &&
                venueMarket.venue === "kalshi" &&
                sid !== undefined
              ) {
                shard.quarantine(venueMarket.id);
                this.invalid("kalshi", "RECONCILIATION_MISMATCH", [
                  venueMarket.id,
                ]);
                if (stream.requestSnapshot(venueMarket.id, sid)) {
                  const key = "kalshi:" + venueMarket.id;
                  this.snapshotTimers.set(
                    key,
                    setTimeout(() => {
                      this.snapshotTimers.delete(key);
                      stream.recover("SNAPSHOT_TIMEOUT");
                    }, 10000),
                  );
                } else stream.recover("RECONCILIATION_MISMATCH");
              } else stream?.recover("RECONCILIATION_MISMATCH");
            } else
              this.reconciliationSuspicious.delete(
                venueMarket.venue + ":" + venueMarket.id,
              );
          }
        } catch {
          if (!this.stopped)
            this.streams
              .find(
                (s) =>
                  s.options.venue === venueMarket.venue &&
                  s.options.ids.includes(venueMarket.id),
              )
              ?.recover("RECONCILIATION_FAILED");
        }
      }
    } finally {
      this.busyReconcile = false;
    }
  }
  async stop() {
    this.pause();
    this.stopped = true;
    this.abort.abort();
    await this.discoveryWorker?.terminate();
    observeRequestTiming(null);
    this.telemetry.close();
    await this.recorder.stop(Date.now(), performance.now());
  }
  async discover() {
    if (
      !this.config.discoveryEnabled ||
      this.discovering ||
      this.stopped ||
      this.paused
    )
      return;
    this.discovering = true;
    try {
      this.discoveryStatus = {
        status: "RUNNING",
        startedAt: Date.now(),
        phase: "catalog",
        kalshi: 0,
        poly: 0,
      };
      const worker = new Worker(
        new URL("./discovery-thread.ts", import.meta.url),
        {
          execArgv: ["--experimental-strip-types"],
          workerData: {
            existing: this.registry
              .list()
              .flatMap((m) => ["kalshi:" + m.pair.a.id, "poly:" + m.pair.b.id]),
          },
        },
      );
      this.discoveryWorker = worker;
      const result: any = await new Promise((resolve, reject) => {
        worker.on("message", (m) => {
          if (m.progress)
            this.discoveryStatus = { ...this.discoveryStatus, ...m.progress };
          else if (m.done) resolve(m);
          else if (m.error) reject(new Error("Discovery failed"));
        });
        worker.once("error", () =>
          reject(new Error("Discovery worker failed")),
        );
        worker.once("exit", () => reject(new Error("Discovery worker exited")));
      });
      if (this.stopped || this.paused) return;
      this.discoveryStatus.phase = "registry";
      const stats = await applyCatalogAsync(
        this.registry,
        result.data,
        result.matched,
        () => {
          if (this.stopped || this.paused)
            throw new Error("Discovery interrupted");
          return this.recorder.send("barrier", {});
        },
        () => this.stopped || this.paused,
      );
      this.discoveryRestTotals.kalshi += result.restRequests?.kalshi ?? 0;
      this.discoveryRestTotals.poly += result.restRequests?.poly ?? 0;
      this.discoveryStatus = {
        ...stats,
        matchingMs: result.matchingMs,
        status: stats.complete
          ? "SUCCESS"
          : stats.kalshi || stats.poly
            ? "PARTIAL"
            : "FAILED",
        finishedAt: Date.now(),
      };
      await this.syncSubscriptions();
      this.recorder.diagnostic("DISCOVERY", this.discoveryStatus);
    } catch {
      if (!this.stopped) {
        this.discoveryStatus = {
          ...this.discoveryStatus,
          status: "FAILED",
          errors: ["DISCOVERY_FAILED"],
        };
        this.recorder.diagnostic("DISCOVERY_FAILED", {});
      }
    } finally {
      await this.discoveryWorker?.terminate();
      this.discoveryWorker = null;
      this.lastDiscoveryAt = Date.now();
      this.nextDiscoveryAt =
        this.lastDiscoveryAt + this.config.discoveryIntervalMs;
      this.discovering = false;
    }
  }
  syncingSubscriptions = false;
  subscriptionsDirty = false;
  async syncSubscriptions() {
    if (this.syncingSubscriptions) {
      this.subscriptionsDirty = true;
      return;
    }
    this.syncingSubscriptions = true;
    try {
      do {
        this.subscriptionsDirty = false;
        await this.applySubscriptions();
      } while (this.subscriptionsDirty && !this.paused && !this.stopped);
    } catch {
      this.telemetry.count("SUBSCRIPTION_SYNC_FAILED");
      this.pause();
    } finally {
      this.syncingSubscriptions = false;
    }
  }
  private async applySubscriptions() {
    if (this.paused || this.stopped) return;
    const selectionStarted = performance.now();
    if (this.store.path === ":memory:")
      this.capacity = this.capacityScheduler.select(
        this.registry.list(),
        this.config.maxSubscribedMarketsPerVenue ?? 500,
        this.config.explorationFraction,
        this.config.explorationRotationMs,
        Date.now(),
        this.recorder.activity,
      );
    else {
      this.capacity = await this.recorder.send("capacity", {
        cap: this.config.maxSubscribedMarketsPerVenue ?? 500,
        fraction: this.config.explorationFraction,
        rotationMs: this.config.explorationRotationMs,
        now: Date.now(),
        activity: this.recorder.activity,
        previousSelected: [...this.capacityScheduler.selected],
        previousExploration: [...this.capacityScheduler.exploration],
        previousEpoch: this.capacityScheduler.epoch,
      });
      this.capacityScheduler.selected = new Set(this.capacity!.selectedIds);
      this.capacityScheduler.exploration = new Set(
        this.capacity!.explorationIds,
      );
      this.capacityScheduler.epoch = Math.floor(
        Date.now() / this.config.explorationRotationMs,
      );
    }
    this.telemetry.sample(
      "capacityWorkerRoundTrip",
      performance.now() - selectionStarted,
    );
    if (this.paused || this.stopped || !this.capacity) return;
    for (const venue of ["kalshi", "poly"] as Venue[]) {
      const selected = this.capacity.subscribed[venue];
      const desired = new Set(
        this.registry
          .list()
          .filter((m) => m.active)
          .map((m) => (venue === "kalshi" ? m.pair.a.id : m.pair.b.id)),
      );
      this.telemetry.counters[`${venue}DeferredMarkets`] =
        desired.size - selected.length;
      const old = this.streams.filter((s) => s.options.venue === venue);
      const groups = reconcileGroups(
        old.map((s) => s.options.ids),
        selected,
        this.config.shardSize,
      );
      for (const s of old)
        if (
          !groups.some(
            (g) => JSON.stringify(g) === JSON.stringify(s.options.ids),
          )
        ) {
          s.stop();
          this.invalid(venue, "SUBSCRIPTION_CHANGED", s.options.ids);
          this.streams = this.streams.filter((x) => x !== s);
          this.shardCaches.delete(s);
          for (const id of s.options.ids)
            this.marketStreams.delete(venue + ":" + id);
          await new Promise<void>((resolve) => setImmediate(resolve));
          if (this.paused || this.stopped) return;
        }
      for (const ids of groups) {
        if (
          this.streams.some(
            (s) =>
              s.options.venue === venue &&
              JSON.stringify(s.options.ids) === JSON.stringify(ids),
          )
        )
          continue;
        const cache = new BookCache();
        const stream = new StreamConnection({
          venue,
          ids,
          headers: () => authHeaders(venue),
          context: () => ({
            eventLoopDelayMs: Math.max(
              0,
              performance.now() - this.lastTick - 100,
            ),
            persistenceBacklog: this.recorder.backlog,
            restActive: this.busyReconcile,
            metadataActive: this.busyMetadata,
            discoveryActive: this.discovering,
          }),
          onInvalid: (reason) => {
            cache.reset(venue);
            if (!this.recorder.failed) this.invalid(venue, reason, ids);
          },
          onDiagnostic: (kind, body) => {
            this.telemetry.count(kind);
            this.recorder.diagnostic(kind, body);
          },
          onMessage: (message, wall, mono) => {
            if (this.paused || this.stopped || this.recorder.failed) return;
            this.telemetry.count("messages");
            const book =
              venue === "kalshi"
                ? cache.kalshi(message, wall, mono)
                : cache.poly(message, wall, mono);
            if (book) {
              if (!ids.includes(book.marketId))
                throw new Error("Unsubscribed market");
              const timerKey = venue + ":" + book.marketId;
              const timer = this.snapshotTimers.get(timerKey);
              if (timer) {
                clearTimeout(timer);
                this.snapshotTimers.delete(timerKey);
              }
              this.cache.books.set(`${venue}:${book.marketId}`, book);
              if (book.exchangeAt !== null)
                this.telemetry.sample(
                  `${venue}ExchangeToReceive`,
                  wall - book.exchangeAt,
                );
              this.recorder.update(book);
            }
          },
        });
        this.streams.push(stream);
        for (const id of ids) this.marketStreams.set(venue + ":" + id, stream);
        this.shardCaches.set(stream, cache);
        stream.start();
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (this.paused || this.stopped) return;
      }
    }
    const keys = new Set(
      this.streams.flatMap((s) =>
        s.options.ids.map((id) => s.options.venue + ":" + id),
      ),
    );
    for (const key of this.cache.books.keys())
      if (!keys.has(key)) this.cache.books.delete(key);
    for (const key of this.recorder.books.keys())
      if (!keys.has(key)) this.recorder.books.delete(key);
    this.recorder.enqueue("retain", [...keys]);
  }
  compactHealth() {
    const h = this.health();
    const { books, mappings, coverage, ...compact } = h;
    const {
      selectedIds,
      explorationIds,
      subscribed,
      deferredReasons,
      ...allocation
    } = coverage ?? ({} as any);
    return {
      ...compact,
      coverage: allocation,
      bookCounts: {
        total: books.length,
        valid: books.filter((b) => b.valid).length,
      },
    };
  }
  health() {
    return {
      telemetry: this.telemetry.snapshot(),
      coverage: this.capacity,
      syncingSubscriptions: this.syncingSubscriptions,
      storage: this.recorder.storage,
      persistence: {
        queueDepth: this.recorder.backlog,
        queueBytes: this.recorder.backlogBytes,
        lastAckAt: this.recorder.lastAckAt,
        failed: this.recorder.failed,
      },
      discovery: {
        ...this.discoveryStatus,
        lastDiscoveryAt: this.lastDiscoveryAt,
        nextDiscoveryAt: this.nextDiscoveryAt,
        enabled: this.config.discoveryEnabled,
        running: this.discovering,
        restRequestsTotal: {
          kalshi:
            this.discoveryRestTotals.kalshi +
            (this.discovering
              ? (this.discoveryStatus?.restRequests?.kalshi ?? 0)
              : 0),
          poly:
            this.discoveryRestTotals.poly +
            (this.discovering
              ? (this.discoveryStatus?.restRequests?.poly ?? 0)
              : 0),
        },
      },
      streams: this.streams.map((s) => s.health()),
      subscribed: Object.fromEntries(
        ["kalshi", "poly"].map((v) => [
          v,
          this.streams
            .filter((s) => s.options.venue === v)
            .reduce((n, s) => n + s.options.ids.length, 0),
        ]),
      ),
      mode: "PAPER_RESEARCH",
      paused: this.paused,
      sessionId: this.recorder.sessionId,
      mappingTotal: this.registry.cache.size,
      mappingCounts: this.registry
        .list()
        .reduce((counts: Record<string, number>, m) => {
          counts[m.status] = (counts[m.status] ?? 0) + 1;
          return counts;
        }, {}),
      mappings: this.registry
        .list()
        .slice(0, 100)
        .map((m) => ({
          id: m.id,
          status: m.status,
          active: m.active,
          reason: m.reason,
        })),
      books: [...this.cache.books.values()].map((b) => ({
        venue: b.venue,
        marketId: b.marketId,
        valid: b.valid,
        connection: b.connection,
        ageMs: performance.now() - b.receivedMono,
        bookChangeAgeMs: performance.now() - b.receivedMono,
        sequence: b.sequence,
      })),
      database: this.config.database,
    };
  }
}
