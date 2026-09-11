import { test } from "node:test";
import assert from "node:assert/strict";
import { kalshiRoundingResearch } from "../lib/pilot/kalshi-rounding-research.ts";
test("Published non-direct-member rounding example preserves cent-aligned cash", () => {
  const r = kalshiRoundingResearch(
    [{ revenueMicros: -55000, tradeFeeMicros: 3639 }],
    10000,
  );
  assert.equal(r.feeMicros, 5000);
  assert.equal(r.rows[0].roundingMicros, 1361);
  assert.equal(r.balanceChangeMicros, -60000);
  assert.equal(r.venueValidated, false);
});
test("Small fragmented fills expose rebate-cap sensitivity rather than promising a whole-contract fee bound", () => {
  const fragments = Array.from({ length: 100 }, () => ({
    revenueMicros: -5000,
    tradeFeeMicros: 175,
  }));
  const retail = kalshiRoundingResearch(fragments, 10000),
    direct = kalshiRoundingResearch(fragments, 100);
  assert.equal(retail.feeMicros, 500000);
  assert.equal(retail.carriedRoundingMicros, 482500);
  assert.equal(direct.feeMicros, 17500);
  assert.ok(
    retail.rows.every(
      (r) => r.netFeeMicros >= 0 && r.balanceChangeMicros % 10000 === 0,
    ),
  );
  assert.ok(
    direct.rows.every(
      (r) => r.netFeeMicros >= 0 && r.balanceChangeMicros % 100 === 0,
    ),
  );
});
