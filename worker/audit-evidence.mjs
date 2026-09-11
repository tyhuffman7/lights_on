// Read-only audit of saved opportunity calculations; never changes verification.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import assert from "node:assert/strict";
import { evaluate } from "../lib/research/detector.ts";
const path = process.argv[2],
  output = process.argv[3];
if (!path || !output)
  throw new Error(
    "Usage: node --experimental-strip-types worker/audit-evidence.mjs DATABASE OUTPUT_JSON",
  );
const db = new DatabaseSync(path, { readOnly: true });
let openings = 0,
  states = 0,
  reproducedStates = 0;
for (const op of db.prepare("SELECT * FROM opportunities").iterate()) {
  const meta = JSON.parse(op.body);
  const rows = db
    .prepare(
      "SELECT * FROM opportunity_states WHERE opportunity_id=? ORDER BY mono,id",
    )
    .iterate(op.id);
  let firstRow;
  for (const row of rows) {
    firstRow ??= row;
    assert.ok(
      db.prepare("SELECT id FROM book_updates WHERE id=?").get(row.a_book_id),
    );
    assert.ok(
      db.prepare("SELECT id FROM book_updates WHERE id=?").get(row.b_book_id),
    );
    states++;
    const sa = JSON.parse(
        db
          .prepare("SELECT body FROM book_updates WHERE id=?")
          .get(row.a_book_id).body,
      ),
      sb = JSON.parse(
        db
          .prepare("SELECT body FROM book_updates WHERE id=?")
          .get(row.b_book_id).body,
      );
    const se = evaluate(
      meta.pair,
      sa,
      sb,
      meta.config,
      row.mono,
      row.at,
      ["AUTO_VERIFIED", "MANUAL_VERIFIED"].includes(meta.verification),
    ).find((e) => e.orientation === op.orientation);
    assert.deepEqual(se.bestGross, JSON.parse(row.body).bestGross);
    reproducedStates++;
  }
  const row = firstRow;
  assert.ok(row);
  const a = JSON.parse(
      db.prepare("SELECT body FROM book_updates WHERE id=?").get(row.a_book_id)
        .body,
    ),
    b = JSON.parse(
      db.prepare("SELECT body FROM book_updates WHERE id=?").get(row.b_book_id)
        .body,
    );
  const e = evaluate(
    meta.pair,
    a,
    b,
    meta.config,
    row.mono,
    row.at,
    ["AUTO_VERIFIED", "MANUAL_VERIFIED"].includes(meta.verification),
  ).find((e) => e.orientation === op.orientation);
  assert.deepEqual(e.bestGross, JSON.parse(row.body).bestGross);
  openings++;
}
const result = {
  openingCalculationsReproduced: openings,
  stateGrossCalculationsReproduced: reproducedStates,
  statesWithBothEvidenceReferences: states,
  databaseQuickCheck: db.prepare("PRAGMA quick_check").get().quick_check,
  latencyRows: db.prepare("SELECT count(*) n FROM latency_tests").get().n,
  interpretation:
    "Replayed opening and state gross calculations using frozen opportunity metadata and persisted books. All state book references resolve. This audit does not change historical verification or run profit simulations; all eight latency buckets are separately covered by regression fixtures.",
};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(result);
db.close();
