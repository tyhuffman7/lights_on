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
  active = new Map<
    string,
    { id: string; firstMono: number; lastMono: number; lastWall: number }
  >();
  index = new Map<string, Mapping[]>();
  constructor(
    store: ResearchStore,
    registry: MappingRegistry,
    config: ResearchConfig,
    mode = "live",
    at = Date.now(),
  ) {
    this.store = store;
    this.registry = registry;
    this.config = config;
    this.sessionId = randomUUID();
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
  reindex() {
    this.index.clear();
    for (const m of this.registry.list())
      for (const market of [m.pair.a, m.pair.b]) {
        const key = `${market.venue}:${market.id}`;
        this.index.set(key, [...(this.index.get(key) || []), m]);
      }
  }
  update(book: StreamBook) {
    const immutable = structuredClone(book),
      key = `${book.venue}:${book.marketId}`;
    this.store.transaction(() => {
      const row = this.store.db
        .prepare(
          "INSERT INTO book_updates(session_id,venue,market_id,at,mono,body) VALUES(?,?,?,?,?,?)",
        )
        .run(
          this.sessionId,
          book.venue,
          book.marketId,
          book.receivedAt,
          book.receivedMono,
          JSON.stringify(immutable),
        );
      this.books.set(key, { book: immutable, id: Number(row.lastInsertRowid) });
      for (const m of this.index.get(key) || [])
        this.observe(m, book.receivedAt, book.receivedMono);
    });
  }
  tick(wall: number, mono: number, force = false) {
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
  private observe(m: Mapping, wall: number, mono: number, timer = false) {
    const a = this.books.get(`kalshi:${m.pair.a.id}`),
      b = this.books.get(`poly:${m.pair.b.id}`);
    if (!a || !b) return;
    for (const e of evaluate(
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
  stop(wall: number, mono: number) {
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
