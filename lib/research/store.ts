import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
const tables = new Set([
  "sessions",
  "mappings",
  "mapping_history",
  "book_updates",
  "opportunities",
  "opportunity_states",
  "latency_tests",
  "diagnostics",
]);
export class ResearchStore {
  db: DatabaseSync;
  path: string;
  constructor(path: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, ended_at INTEGER, mode TEXT NOT NULL, config TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS mappings(id TEXT PRIMARY KEY, body TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS mapping_history(id INTEGER PRIMARY KEY, pair_id TEXT NOT NULL, at INTEGER NOT NULL, body TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS book_updates(id INTEGER PRIMARY KEY, session_id TEXT NOT NULL, venue TEXT NOT NULL, market_id TEXT NOT NULL, at INTEGER NOT NULL, mono REAL NOT NULL, body TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS books_asof ON book_updates(session_id,venue,market_id,mono);
   CREATE TABLE IF NOT EXISTS opportunities(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,pair_id TEXT NOT NULL,orientation TEXT NOT NULL,first_seen_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL,first_mono REAL NOT NULL,last_mono REAL NOT NULL,duration_ms REAL NOT NULL,status TEXT NOT NULL,body TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS opportunities_session ON opportunities(session_id,pair_id);
   CREATE TABLE IF NOT EXISTS opportunity_states(id INTEGER PRIMARY KEY,opportunity_id TEXT NOT NULL REFERENCES opportunities(id),at INTEGER NOT NULL,mono REAL NOT NULL,a_book_id INTEGER,b_book_id INTEGER,body TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS states_opportunity ON opportunity_states(opportunity_id,mono);
   CREATE TABLE IF NOT EXISTS latency_tests(id INTEGER PRIMARY KEY,opportunity_id TEXT NOT NULL REFERENCES opportunities(id),latency_ms INTEGER NOT NULL,first_venue TEXT NOT NULL,status TEXT NOT NULL,body TEXT NOT NULL,UNIQUE(opportunity_id,latency_ms,first_venue));
   CREATE TABLE IF NOT EXISTS diagnostics(id INTEGER PRIMARY KEY,session_id TEXT NOT NULL,at INTEGER NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL);
   PRAGMA user_version=1;`);
  }
  rows(table: string) {
    if (!tables.has(table)) throw new Error("Unknown table");
    return this.db
      .prepare(`SELECT * FROM ${table} ORDER BY rowid`)
      .all() as Record<string, any>[];
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const x = fn();
      this.db.exec("COMMIT");
      return x;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  diagnostic(session: string, at: number, kind: string, body: unknown) {
    this.db
      .prepare(
        "INSERT INTO diagnostics(session_id,at,kind,body) VALUES(?,?,?,?)",
      )
      .run(session, at, kind, JSON.stringify(body));
  }
  close() {
    this.db.close();
  }
}
