import { DatabaseSync } from "node:sqlite";
import type { Venue } from "../arb/types.ts";
import { pilotPolicy } from "./preflight.ts";
export type IntentState =
  | "RESERVED"
  | "SUBMISSION_UNKNOWN"
  | "ACKNOWLEDGED"
  | "PARTIAL"
  | "FILLED"
  | "CANCELED"
  | "REJECTED";
// Separate pilot ledger. It does not read credentials or expose order submission.
export class PilotLedger {
  db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS pilot_intents(id TEXT PRIMARY KEY, venue TEXT NOT NULL, budget INTEGER NOT NULL, state TEXT NOT NULL, filled INTEGER NOT NULL DEFAULT 0, debit INTEGER NOT NULL DEFAULT 0, venue_order_id TEXT, revision INTEGER NOT NULL DEFAULT -1);
      CREATE UNIQUE INDEX IF NOT EXISTS pilot_venue_order ON pilot_intents(venue,venue_order_id) WHERE venue_order_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS pilot_control(id INTEGER PRIMARY KEY CHECK(id=1), halted INTEGER NOT NULL, reason TEXT);
      INSERT OR IGNORE INTO pilot_control VALUES(1,0,NULL);`);
  }
  reserve(id: string, venue: Venue, budget: number) {
    return this.reserveBatch([{ id, venue, budget }])[0];
  }
  reservePair(id: string, budgets: Record<Venue, number>) {
    if (budgets.kalshi + budgets.poly > pilotPolicy.maxPairDebit)
      throw new Error("Pair debit limit");
    return this.reserveBatch(
      (["kalshi", "poly"] as const).map((venue) => ({
        id: id + ":" + venue,
        venue,
        budget: budgets[venue],
      })),
    );
  }
  private reserveBatch(
    intents: { id: string; venue: Venue; budget: number }[],
  ) {
    for (const { id, venue, budget } of intents)
      if (
        !id ||
        !["kalshi", "poly"].includes(venue) ||
        !Number.isSafeInteger(budget) ||
        budget <= 0 ||
        budget > pilotPolicy.maxPairDebit
      )
        throw new Error("Invalid reservation");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const old = intents.map((i) => this.get(i.id));
      if (old.some(Boolean)) {
        if (
          !old.every(Boolean) ||
          old.some(
            (r, i) =>
              r.venue !== intents[i].venue || r.budget !== intents[i].budget,
          )
        )
          throw new Error("Intent identity conflict");
        this.db.exec("COMMIT");
        return old;
      }
      if (
        (this.db.prepare("SELECT halted FROM pilot_control").get() as any)
          .halted
      )
        throw new Error("Pilot halted");
      const rows = this.db
        .prepare("SELECT * FROM pilot_intents")
        .all() as any[];
      // A filled order is still inventory, not spendable settled proceeds.
      // This first-stage ledger deliberately has no automatic inventory-release path.
      if (
        rows.some(
          (r) =>
            r.filled > 0 ||
            ["SUBMISSION_UNKNOWN", "ACKNOWLEDGED", "PARTIAL"].includes(r.state),
        )
      )
        throw new Error("Unresolved order or inventory blocks new intent");
      const terminal = (r: any) =>
        ["FILLED", "CANCELED", "REJECTED"].includes(r.state);
      const held = (r: any) => (terminal(r) ? r.debit : r.budget);
      for (const venue of ["kalshi", "poly"] as const) {
        const used = rows
          .filter((r) => r.venue === venue)
          .reduce((n, r) => n + held(r), 0);
        const added = intents
          .filter((i) => i.venue === venue)
          .reduce((n, i) => n + i.budget, 0);
        if (used + added > pilotPolicy.capitalPerVenue)
          throw new Error("Pilot venue budget exceeded");
      }
      if (
        rows.reduce((n, r) => n + held(r), 0) +
          intents.reduce((n, i) => n + i.budget, 0) >
        pilotPolicy.maxCommitted
      )
        throw new Error("Pilot committed budget exceeded");
      for (const i of intents)
        this.db
          .prepare(
            "INSERT INTO pilot_intents(id,venue,budget,state) VALUES(?,?,?,?)",
          )
          .run(i.id, i.venue, i.budget, "RESERVED");
      this.db.exec("COMMIT");
      return intents.map((i) => this.get(i.id));
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  get(id: string) {
    return this.db
      .prepare("SELECT * FROM pilot_intents WHERE id=?")
      .get(id) as any;
  }
  markSubmissionUnknown(id: string) {
    const result = this.db
      .prepare(
        "UPDATE pilot_intents SET state='SUBMISSION_UNKNOWN' WHERE id=? AND state='RESERVED'",
      )
      .run(id);
    if (result.changes !== 1)
      throw new Error("Intent cannot be submitted again");
  }
  reconcile(
    id: string,
    s: {
      revision: number;
      state: Exclude<IntentState, "RESERVED" | "SUBMISSION_UNKNOWN">;
      filled: number;
      debit: number;
      venueOrderId: string;
    },
  ) {
    const r = this.get(id);
    if (
      !r ||
      ![
        "SUBMISSION_UNKNOWN",
        "ACKNOWLEDGED",
        "PARTIAL",
        "FILLED",
        "CANCELED",
        "REJECTED",
      ].includes(r.state)
    )
      throw new Error("Missing submitted intent");
    if (
      !["ACKNOWLEDGED", "PARTIAL", "FILLED", "CANCELED", "REJECTED"].includes(
        s.state,
      ) ||
      ![s.revision, s.debit].every((n) => Number.isSafeInteger(n) && n >= 0) ||
      !Number.isFinite(s.filled) ||
      s.filled < 0 ||
      Math.abs(s.filled * 10000 - Math.round(s.filled * 10000)) > 1e-8 ||
      !s.venueOrderId
    )
      throw new Error("Invalid authoritative order state");
    if (r.venue_order_id && r.venue_order_id !== s.venueOrderId)
      throw new Error("Venue order identity conflict");
    if (s.revision < r.revision) return false;
    if (s.revision === r.revision) {
      if (s.state !== r.state || s.filled !== r.filled || s.debit !== r.debit)
        throw new Error("Conflicting same-revision evidence");
      return false;
    }
    if (["FILLED", "REJECTED"].includes(r.state) && s.state !== r.state)
      throw new Error("Terminal order cannot reopen");
    if (r.state === "CANCELED" && s.state !== "CANCELED")
      throw new Error("Canceled order cannot reopen");
    if (s.filled < r.filled || s.debit < r.debit)
      throw new Error("Cumulative fill moved backwards");
    if (s.filled > pilotPolicy.contractsPerPair || s.debit > r.budget) {
      this.halt("EXECUTION_EXCEEDED_RESERVED_BOUND");
      throw new Error("Execution exceeded reserved bound");
    }
    if (
      (s.state === "ACKNOWLEDGED" && s.filled !== 0) ||
      (s.state === "PARTIAL" && (s.filled <= 0 || s.filled >= 1)) ||
      (s.state === "FILLED" && s.filled !== pilotPolicy.contractsPerPair) ||
      (s.state === "REJECTED" && (s.filled || s.debit)) ||
      (s.filled === 0 && s.debit !== 0) ||
      (s.filled > 0 && s.debit === 0)
    )
      throw new Error("Inconsistent fill state");
    // Cancel confirmations may include a fill that raced cancellation. Preserve it.
    const updated = this.db
      .prepare(
        "UPDATE pilot_intents SET state=?,filled=?,debit=?,venue_order_id=?,revision=? WHERE id=? AND revision=?",
      )
      .run(
        s.state,
        s.filled,
        s.debit,
        s.venueOrderId,
        s.revision,
        id,
        r.revision,
      );
    if (updated.changes !== 1)
      throw new Error("Concurrent reconciliation requires a fresh read");
    if (s.state === "PARTIAL" || (s.state === "CANCELED" && s.filled > 0))
      this.halt("UNMATCHED_FILL_REQUIRES_RECONCILIATION");
    return true;
  }
  halt(reason: string) {
    this.db.prepare("UPDATE pilot_control SET halted=1,reason=?").run(reason);
  }
  close() {
    this.db.close();
  }
}
