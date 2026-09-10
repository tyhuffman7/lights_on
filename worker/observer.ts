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
import { catalog, applyCatalog, reconcileGroups } from "./coverage.ts";
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
  discoveryStatus: unknown = null;
  discovering = false;
  abort = new AbortController();
  shardCaches = new Map<StreamConnection, BookCache>();
  cache = new BookCache();
  streams: StreamConnection[] = [];
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
    this.registry.persist = (m, at) =>
      this.recorder.enqueue("mapping", { m, at });
    observeRequestTiming((host, ms) =>
      this.telemetry.sample(
        `${host.includes("kalshi") ? "kalshi" : "poly"}RestRoundTrip`,
        ms,
      ),
    );
  }
  async initialize() {
    await this.recorder.ready;
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
    if (!ids) this.cache.reset(venue);
    const wall = Date.now(),
      mono = performance.now();
    for (const b of this.cache.books.values())
      if (b.venue === venue && (!ids || ids.includes(b.marketId)))
        this.cache.books.set(`${b.venue}:${b.marketId}`, {
          ...b,
          valid: false,
          connection: "DISCONNECTED",
        });
    for (const b of this.cache.books.values())
      if (b.venue === venue && (!ids || ids.includes(b.marketId)))
        this.recorder.update({
          ...b,
          valid: false,
          connection: "DISCONNECTED",
          receivedAt: wall,
          receivedMono: mono,
        });
    this.telemetry.count(reason);
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
          this.streams.forEach((s) => s.recover("EVENT_LOOP_DELAY"));
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
    this.timers.push(
      setInterval(
        () => void this.reconcile(),
        this.config.reconciliationIntervalMs,
      ),
    );
    this.timers.push(
      setInterval(() => this.recorder.analyze(performance.now()), 5000),
    );
    this.timers.push(
      setInterval(() => void this.discover(), this.config.discoveryIntervalMs),
    );
    this.timers.push(
      setInterval(
        () =>
          this.recorder.diagnostic("TELEMETRY", {
            ...this.health(),
            telemetry: this.telemetry.snapshot(true),
          }),
        10000,
      ),
    );
  }
  pause() {
    this.paused = true;
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.streams.forEach((s) => s.stop());
    this.streams = [];
    this.shardCaches.clear();
    if (!this.recorder.failed)
      for (const v of ["kalshi", "poly"] as Venue[]) this.invalid(v, "PAUSED");
  }
  async metadata() {
    if (this.busyMetadata || this.paused || this.stopped) return;
    this.busyMetadata = true;
    try {
      for (const m of this.registry.list()) {
        if (!m.active && m.reason !== "METADATA_UNAVAILABLE") continue;
        try {
          const fetchedAt = Date.now();
          const a = await market("kalshi", m.pair.a.id),
            b = await market("poly", m.pair.b.id);
          if (this.stopped || this.paused) return;
          this.registry.refresh(m.id, a, b, fetchedAt);
        } catch {
          if (this.stopped) return;
          this.registry.deactivate(m.id, "METADATA_UNAVAILABLE");
          this.recorder.reindex();
          this.invalid("kalshi", "METADATA_UNAVAILABLE", [m.pair.a.id]);
          this.invalid("poly", "METADATA_UNAVAILABLE", [m.pair.b.id]);
        }
      }
      if (!this.stopped) {
        this.recorder.reindex();
        this.recorder.tick(Date.now(), performance.now(), true);
        this.syncSubscriptions();
      }
    } finally {
      this.busyMetadata = false;
    }
  }
  async reconcile() {
    if (this.busyReconcile || this.paused || this.stopped) return;
    this.busyReconcile = true;
    try {
      for (const m of this.registry.list().filter((m) => m.active))
        for (const venueMarket of [m.pair.a, m.pair.b]) {
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
              book: rest,
              raced: before !== after,
            });
            if (before === after) {
              const top = (ls: { price: number; quantity: number }[]) =>
                JSON.stringify(
                  [...ls].sort((a, b) => a.price - b.price).slice(0, 10),
                );
              if (
                top(snapshot.yes) !== top(before.yes) ||
                top(snapshot.no) !== top(before.no)
              )
                this.streams
                  .find(
                    (s) =>
                      s.options.venue === venueMarket.venue &&
                      s.options.ids.includes(venueMarket.id),
                  )
                  ?.recover("RECONCILIATION_MISMATCH");
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
      const data = await catalog(undefined, this.abort.signal);
      if (this.stopped || this.paused) return;
      this.discoveryStatus = applyCatalog(this.registry, data);
      this.recorder.reindex();
      this.syncSubscriptions();
      this.recorder.diagnostic("DISCOVERY", this.discoveryStatus);
    } catch {
      this.recorder.diagnostic("DISCOVERY_FAILED", {});
    } finally {
      this.discovering = false;
    }
  }
  syncSubscriptions() {
    if (this.paused || this.stopped) return;
    for (const venue of ["kalshi", "poly"] as Venue[]) {
      const mappings = this.registry
        .list()
        .filter(
          (m) =>
            m.active &&
            m.pair.a.open &&
            m.pair.b.open &&
            [m.pair.a, m.pair.b].every(
              (x) => Date.parse(x.closeAt) > Date.now(),
            ),
        );
      const desired = [
        ...new Set(
          mappings.map((m) => (venue === "kalshi" ? m.pair.a.id : m.pair.b.id)),
        ),
      ];
      const selected = this.config.maxSubscribedMarketsPerVenue
        ? desired.slice(0, this.config.maxSubscribedMarketsPerVenue)
        : desired;
      this.telemetry.counters[`${venue}DeferredMarkets`] =
        desired.length - selected.length;
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
        this.shardCaches.set(stream, cache);
        stream.start();
      }
    }
  }
  health() {
    return {
      telemetry: this.telemetry.snapshot(),
      persistence: {
        queueDepth: this.recorder.backlog,
        queueBytes: this.recorder.backlogBytes,
        lastAckAt: this.recorder.lastAckAt,
        failed: this.recorder.failed,
      },
      discovery: this.discoveryStatus,
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
      mappings: this.registry.list().map((m) => ({
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
