import { test } from "node:test";
import assert from "node:assert/strict";
import { pair, book } from "./research-fixture.ts";
import { evaluate } from "../lib/research/detector.ts";
import { researchDefaults } from "../lib/research/types.ts";
test("Research detector does not produce sized opportunities when minimum quantity is unknown", () => {
  const p = pair(),
    now = Date.now();
  p.b.minQty = 0;
  const r = evaluate(
    p,
    book("kalshi", p.a.id, 100, now),
    book("poly", p.b.id, 100, now),
    researchDefaults,
    100,
    now,
    true,
  );
  for (const e of r) {
    assert.ok(e.reasons.includes("UNKNOWN_MINIMUM_QUANTITY"));
    assert.equal(e.best, null);
    assert.equal(e.bestGross, null);
  }
});
