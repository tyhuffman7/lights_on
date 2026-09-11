import { DatabaseSync } from "node:sqlite";
import type { Venue } from "../arb/types.ts";
import {
  kalshiFill,
  polyFill,
  uniqueFillTotals,
  type ExpectedFill,
} from "./fill-evidence.ts";
// Local evidence only. Registration must come from the bot's own intent/acknowledgment;
// account-wide positions and historical trades never establish bot ownership.
export class FillJournal {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS owned_fill_orders(venue TEXT NOT NULL, order_id TEXT NOT NULL, identity TEXT NOT NULL, PRIMARY KEY(venue,order_id));
      CREATE TABLE IF NOT EXISTS owned_fill_evidence(venue TEXT NOT NULL, fill_id TEXT NOT NULL, order_id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(venue,fill_id));`);
  }
  register(venue: Venue, expected: ExpectedFill) {
    if (
      !["kalshi", "poly"].includes(venue) ||
      typeof expected.orderId !== "string" ||
      !expected.orderId ||
      typeof expected.marketId !== "string" ||
      !expected.marketId ||
      !["yes", "no"].includes(expected.side) ||
      !["buy", "sell"].includes(expected.action)
    )
      throw Error("Invalid owned order");
    const identity = JSON.stringify({
      orderId: expected.orderId,
      marketId: expected.marketId,
      side: expected.side,
      action: expected.action,
    });
    this.db
      .prepare("INSERT OR IGNORE INTO owned_fill_orders VALUES(?,?,?)")
      .run(venue, expected.orderId, identity);
    const row = this.db
      .prepare(
        "SELECT identity FROM owned_fill_orders WHERE venue=? AND order_id=?",
      )
      .get(venue, expected.orderId) as any;
    if (row.identity !== identity) throw Error("Owned order identity conflict");
  }
  record(venue: Venue, orderId: string, raw: unknown) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db
        .prepare(
          "SELECT identity FROM owned_fill_orders WHERE venue=? AND order_id=?",
        )
        .get(venue, orderId) as any;
      if (!row) throw Error("Fill does not belong to a registered bot order");
      const fill = (venue === "kalshi" ? kalshiFill : polyFill)(
        raw,
        JSON.parse(row.identity),
      );
      const body = JSON.stringify(fill);
      const old = this.db
        .prepare(
          "SELECT body FROM owned_fill_evidence WHERE venue=? AND fill_id=?",
        )
        .get(venue, fill.fillId) as any;
      if (old && old.body !== body)
        throw Error("Conflicting persisted fill evidence");
      if (!old)
        this.db
          .prepare("INSERT INTO owned_fill_evidence VALUES(?,?,?,?)")
          .run(venue, fill.fillId, orderId, body);
      const totals = this.totals(venue, orderId);
      this.db.exec("COMMIT");
      return { inserted: !old, ...totals };
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  totals(venue: Venue, orderId: string) {
    if (
      !this.db
        .prepare("SELECT 1 FROM owned_fill_orders WHERE venue=? AND order_id=?")
        .get(venue, orderId)
    )
      throw Error("Unknown owned order");
    const rows = this.db
      .prepare(
        "SELECT body FROM owned_fill_evidence WHERE venue=? AND order_id=? ORDER BY fill_id",
      )
      .all(venue, orderId) as any[];
    return uniqueFillTotals(rows.map((r) => JSON.parse(r.body)));
  }
  close() {
    this.db.close();
  }
}
