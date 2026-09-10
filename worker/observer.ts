import { market, book as restBook } from "../lib/arb/adapters.ts";
import type { Venue } from "../lib/arb/types.ts";
import type { StreamBook } from "../lib/research/types.ts";
import { BookCache } from "../lib/research/books.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { Recorder } from "../lib/research/recorder.ts";
import type { ResearchStore } from "../lib/research/store.ts";
import { analyzeLatency } from "../lib/research/latency.ts";
import { StreamConnection, authHeaders } from "./streams.ts";
import type { ObserverConfig } from "./config.ts";
export class Observer {
  store: ResearchStore;
  config: ObserverConfig;
  registry: MappingRegistry;
  recorder: Recorder;
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
    this.recorder = new Recorder(store, this.registry, config, "live");
  }
  async initialize() {
    for (const entry of this.config.markets) {
      const a = await market("kalshi", entry.kalshi),
        b = await market("poly", entry.poly);
      const id = `${a.id}::${b.id}`;
      if (this.registry.get(id)) this.registry.refresh(id, a, b);
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
  private invalid(venue: Venue, reason: string) {
    if (this.stopped) return;
    this.cache.reset(venue);
    const wall = Date.now(),
      mono = performance.now();
    for (const b of this.cache.books.values())
      if (b.venue === venue)
        this.recorder.update({
          ...b,
          valid: false,
          connection: "DISCONNECTED",
          receivedAt: wall,
          receivedMono: mono,
        });
    this.store.diagnostic(this.recorder.sessionId, wall, reason, { venue });
  }
  resume() {
    if (this.stopped || !this.paused) return;
    const mappings = this.registry.list().filter((m) => m.active);
    if (!mappings.length)
      throw new Error(
        "No active mappings. Add market IDs to observer.config.json and restart.",
      );
    // Check credentials before opening either connection, without logging values.
    for (const venue of ["kalshi", "poly"] as Venue[]) authHeaders(venue);
    this.paused = false;
    this.streams = (["kalshi", "poly"] as Venue[]).map((venue) => {
      const ids = [
        ...new Set(
          mappings.map((m) => (venue === "kalshi" ? m.pair.a.id : m.pair.b.id)),
        ),
      ];
      return new StreamConnection({
        venue,
        ids,
        headers: () => authHeaders(venue),
        onInvalid: (reason) => this.invalid(venue, reason),
        onDiagnostic: (kind, body) => {
          if (!this.stopped)
            this.store.diagnostic(
              this.recorder.sessionId,
              Date.now(),
              kind,
              body,
            );
        },
        onMessage: (message, wall, mono) => {
          if (this.paused || this.stopped) return;
          const b =
            venue === "kalshi"
              ? this.cache.kalshi(message, wall, mono)
              : this.cache.poly(message, wall, mono);
          if (b) {
            if (!ids.includes(b.marketId))
              throw new Error("Unsubscribed market");
            this.recorder.update(b);
          }
        },
      });
    });
    this.streams.forEach((s) => s.start());
    this.lastTick = performance.now();
    this.timers.push(
      setInterval(() => {
        const mono = performance.now(),
          wall = Date.now();
        if (mono - this.lastTick > 250) {
          this.streams.forEach((s) => s.recover("EVENT_LOOP_DELAY"));
        }
        this.lastTick = mono;
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
      setInterval(() => {
        analyzeLatency(
          this.store,
          this.recorder.sessionId,
          performance.now(),
          false,
        );
      }, 5000),
    );
  }
  pause() {
    this.paused = true;
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.streams.forEach((s) => s.stop());
    this.streams = [];
    for (const v of ["kalshi", "poly"] as Venue[]) this.invalid(v, "PAUSED");
  }
  async metadata() {
    if (this.busyMetadata || this.paused || this.stopped) return;
    this.busyMetadata = true;
    try {
      for (const m of this.registry.list()) {
        if (!m.active && m.reason !== "METADATA_UNAVAILABLE") continue;
        try {
          const a = await market("kalshi", m.pair.a.id),
            b = await market("poly", m.pair.b.id);
          if (this.stopped || this.paused) return;
          this.registry.refresh(m.id, a, b);
        } catch {
          if (this.stopped) return;
          this.registry.deactivate(m.id, "METADATA_UNAVAILABLE");
          this.recorder.reindex();
          this.invalid("kalshi", "METADATA_UNAVAILABLE");
          this.invalid("poly", "METADATA_UNAVAILABLE");
        }
      }
      if (!this.stopped) {
        this.recorder.reindex();
        this.recorder.tick(Date.now(), performance.now(), true);
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
            this.store.diagnostic(
              this.recorder.sessionId,
              Date.now(),
              "REST_RECONCILIATION",
              { book: rest, raced: before !== after },
            );
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
                  .find((s) => s.options.venue === venueMarket.venue)
                  ?.recover("RECONCILIATION_MISMATCH");
            }
          } catch {
            if (!this.stopped)
              this.streams
                .find((s) => s.options.venue === venueMarket.venue)
                ?.recover("RECONCILIATION_FAILED");
          }
        }
    } finally {
      this.busyReconcile = false;
    }
  }
  stop() {
    this.pause();
    this.stopped = true;
    const mono = performance.now();
    analyzeLatency(this.store, this.recorder.sessionId, mono, true);
    this.recorder.stop(Date.now(), mono);
  }
  health() {
    return {
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
        sequence: b.sequence,
      })),
      database: this.config.database,
    };
  }
}
