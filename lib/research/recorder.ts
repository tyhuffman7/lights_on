import { randomUUID } from "node:crypto";
import type { ResearchStore } from "./store.ts";
import { MappingRegistry, isVerified } from "./mappings.ts";
import { evaluate } from "./detector.ts";
import { fresh } from "./books.ts";
import type {
  StreamBook,
  ResearchConfig,
  Mapping,
  Evaluation,
} from "./types.ts";
export class Recorder {
  store: ResearchStore;
  registry: MappingRegistry;
  config: ResearchConfig;
  sessionId: string;
  books = new Map<string, { book: StreamBook; id: number }>();
  history = new Map<string, { book: StreamBook; id: number }[]>();
  captureUntil = new Map<string, number>();
  retainedKeys: Set<string> | null = null;
  storage = { processed: 0, persisted: 0, ringRecords: 0, ringBytes: 0 };
  sizes = new WeakMap<StreamBook, number>();
  private persistBook(entry: { book: StreamBook; id: number }) {
    if (entry.id) return;
    const b = entry.book;
    const row = this.store.db
      .prepare(
        "INSERT INTO book_updates(session_id,venue,market_id,at,mono,body) VALUES(?,?,?,?,?,?)",
      )
      .run(
        this.sessionId,
        b.venue,
        b.marketId,
        b.receivedAt,
        b.receivedMono,
        JSON.stringify(b),
      );
    entry.id = Number(row.lastInsertRowid);
    this.storage.persisted++;
  }
  private capture(key: string, mono: number) {
    this.captureUntil.set(
      key,
      Math.max(this.captureUntil.get(key) ?? 0, mono + 2500),
    );
    for (const entry of this.history.get(key) ?? []) this.persistBook(entry);
    const latest = this.books.get(key);
    if (latest) this.persistBook(latest);
  }
  private prune(mono: number, onlyKey?: string) {
    for (const [key, entries] of onlyKey
      ? [[onlyKey, this.history.get(onlyKey) ?? []] as const]
      : this.history) {
      if (
        this.retainedKeys &&
        !this.retainedKeys.has(key) &&
        !(this.index.get(key) ?? []).some(m=>[...this.active.keys()].some(op=>op.startsWith(m.id+':'))) &&
        (this.captureUntil.get(key) ?? -Infinity) < mono
      ) {
        for (const entry of entries) {
          this.storage.ringRecords--;
          this.storage.ringBytes -= this.sizes.get(entry.book) ?? 0;
        }
        this.history.delete(key);
        this.books.delete(key);
        this.captureUntil.delete(key);
        continue;
      }
      // Keep an as-of anchor before the five-second window, including resting books.
      while (entries.length > 1 && entries[1].book.receivedMono < mono - 5000) {
        const old = entries.shift()!;
        this.storage.ringRecords--;
        this.storage.ringBytes -= this.sizes.get(old.book) ?? 0;
      }
      if ((this.captureUntil.get(key) ?? Infinity) < mono)
        this.captureUntil.delete(key);
    }
  }
  active = new Map<
    string,
    { id: string; firstMono: number; lastMono: number; lastWall: number }
  >();
  index = new Map<string, Mapping[]>();
  mappingVersions = new Map<string, string>();
  constructor(
    store: ResearchStore,
    registry: MappingRegistry,
    config: ResearchConfig,
    mode = "live",
    at = Date.now(),
    sessionId = randomUUID(),
  ) {
    this.store = store;
    this.registry = registry;
    this.config = config;
    this.sessionId = sessionId;
    // Crash recovery cannot infer how long a quote persisted after the last state.
    store.db
      .prepare("UPDATE opportunities SET status='CENSORED' WHERE status='OPEN'")
      .run();
    store.db
      .prepare(
        "INSERT INTO sessions(id,started_at,mode,config) VALUES(?,?,?,?)",
      )
      .run(this.sessionId, at, mode, JSON.stringify(config));
    this.reindex();
  }
  patchMapping(m: Mapping, previous?: Mapping) {
    const version = JSON.stringify([
      m.pair.inverted,
      m.pair.a.hash,
      m.pair.b.hash,
      m.status,
      m.active,
    ]);
    const old = this.mappingVersions.get(m.id);
    if (old && old !== version)
      for (const [key, op] of this.active)
        if (key.startsWith(`${m.id}:`)) {
          this.store.db
            .prepare("UPDATE opportunities SET status='CENSORED' WHERE id=?")
            .run(op.id);
          this.active.delete(key);
        }
    this.mappingVersions.set(m.id, version);
    const keys = new Set(
      [previous?.pair.a, previous?.pair.b, m.pair.a, m.pair.b]
        .filter(Boolean)
        .map((market) => `${market!.venue}:${market!.id}`),
    );
    for (const key of keys) {
      const entries = (this.index.get(key) ?? []).filter((x) => x.id !== m.id);
      if ([m.pair.a, m.pair.b].some((x) => `${x.venue}:${x.id}` === key))
        entries.push(m);
      if (entries.length) this.index.set(key, entries);
      else this.index.delete(key);
    }
  }
  reindex() {
    this.index.clear();
    for (const m of this.registry.list()) this.patchMapping(m);
  }
  update(book: StreamBook, prepared?: Record<string, Evaluation[]>) {
    const immutable = structuredClone(book),
      key = `${book.venue}:${book.marketId}`;
    this.store.transaction(() => {
      this.storage.processed++;
      this.prune(book.receivedMono, key);
      const entry = { book: immutable, id: 0 };
      const bytes = Buffer.byteLength(JSON.stringify(immutable));
      this.sizes.set(immutable, bytes);
      const history = this.history.get(key) ?? [];
      history.push(entry);
      this.history.set(key, history);
      this.storage.ringRecords++;
      this.storage.ringBytes += bytes;
      // Never silently drop pre-event evidence under overload. Fail closed and pause.
      if (history.length > 10000 || this.storage.ringBytes > 128 * 1024 * 1024)
        throw new Error("Evidence history capacity exceeded");
      this.books.set(key, entry);
      if ((this.captureUntil.get(key) ?? -Infinity) >= book.receivedMono)
        this.persistBook(entry);
      for (const m of this.index.get(key) || [])
        this.observe(
          m,
          book.receivedAt,
          book.receivedMono,
          false,
          prepared?.[m.id],
        );
    });
  }
  tick(wall: number, mono: number, force = false) {
    this.prune(mono);
    for (const m of this.registry.list()) {
      const a = this.books.get(`kalshi:${m.pair.a.id}`)?.book;
      const b = this.books.get(`poly:${m.pair.b.id}`)?.book;
      if (
        force ||
        !m.active ||
        !fresh(a, mono, wall, this.config.maxAgeMs) ||
        !fresh(b, mono, wall, this.config.maxAgeMs) ||
        [m.pair.a, m.pair.b].some((x) => Date.parse(x.closeAt) <= wall)
      ) {
        if (
          force ||
          [...this.active.keys()].some((key) => key.startsWith(`${m.id}:`))
        )
          this.observe(m, wall, mono, !force);
      }
    }
  }
  private observe(
    m: Mapping,
    wall: number,
    mono: number,
    timer = false,
    prepared?: Evaluation[],
  ) {
    const a = this.books.get(`kalshi:${m.pair.a.id}`),
      b = this.books.get(`poly:${m.pair.b.id}`);
    if (!a || !b) return;
    for (const e of prepared ??
      evaluate(
        m.pair,
        a.book,
        b.book,
        this.config,
        mono,
        wall,
        isVerified(m),
      )) {
      const key = `${m.id}:${e.orientation}`,
        current = this.active.get(key);
      // Record all gross edges, including unverified/fee-negative candidates. Grade
      // separately; unverified candidates never enter latency trade simulations.
      const visible =
        !!e.bestGross &&
        e.bestGross.grossProfit > 0 &&
        !e.reasons.some((x) =>
          ["BOOK_STALE", "MARKET_CLOSED", "UNSUPPORTED_QUANTITY"].includes(x),
        ) &&
        m.active;
      if (timer && visible) continue;
      if (!visible && !current) continue;
      this.capture(`kalshi:${m.pair.a.id}`, mono);
      this.capture(`poly:${m.pair.b.id}`, mono);
      const opportunity = current ?? {
        id: randomUUID(),
        firstMono: mono,
        lastMono: mono,
        lastWall: wall,
      };
      if (!current) {
        this.store.db
          .prepare("INSERT INTO opportunities VALUES(?,?,?,?,?,?,?,?,?,?,?)")
          .run(
            opportunity.id,
            this.sessionId,
            m.id,
            e.orientation,
            wall,
            wall,
            mono,
            mono,
            0,
            "OPEN",
            JSON.stringify({
              pair: m.pair,
              verification: m.status,
              category: m.pair.a.category,
              opening: e,
              config: this.config,
            }),
          );
        this.active.set(key, opportunity);
      }
      const uncertain = e.reasons.includes("BOOK_STALE") || !m.active;
      const endMono = !visible && uncertain ? opportunity.lastMono : mono,
        endWall = !visible && uncertain ? opportunity.lastWall : wall;
      this.store.db
        .prepare(
          "UPDATE opportunities SET last_seen_at=?,last_mono=?,duration_ms=?,status=? WHERE id=?",
        )
        .run(
          endWall,
          endMono,
          endMono - opportunity.firstMono,
          visible ? "OPEN" : uncertain ? "CENSORED" : "CLOSED",
          opportunity.id,
        );
      const { curve, ...summary } = e;
      this.store.db
        .prepare(
          "INSERT INTO opportunity_states(opportunity_id,at,mono,a_book_id,b_book_id,body) VALUES(?,?,?,?,?,?)",
        )
        .run(
          opportunity.id,
          wall,
          mono,
          a.id,
          b.id,
          JSON.stringify({
            ...summary,
            curve,
            bookAges: {
              a: mono - a.book.receivedMono,
              b: mono - b.book.receivedMono,
            },
            exchangeTimestamps: { a: a.book.exchangeAt, b: b.book.exchangeAt },
            localTimestamps: { a: a.book.receivedAt, b: b.book.receivedAt },
            endReason: !m.active ? m.reason : null,
          }),
        );
      if (!visible) this.active.delete(key);
      else {
        opportunity.lastMono = mono;
        opportunity.lastWall = wall;
      }
    }
  }
  saveStats() {
    this.store.db
      .prepare(
        "INSERT INTO session_stats(session_id,body) VALUES(?,?) ON CONFLICT(session_id) DO UPDATE SET body=excluded.body",
      )
      .run(this.sessionId, JSON.stringify(this.storage));
  }
  stop(wall: number, mono: number) {
    this.saveStats();
    for (const o of this.active.values())
      this.store.db
        .prepare("UPDATE opportunities SET status='CENSORED' WHERE id=?")
        .run(o.id);
    this.active.clear();
    this.store.db
      .prepare("UPDATE sessions SET ended_at=? WHERE id=?")
      .run(wall, this.sessionId);
    this.store.diagnostic(this.sessionId, wall, "STOP", { mono });
  }
}
