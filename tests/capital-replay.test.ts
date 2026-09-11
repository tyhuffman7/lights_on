import { test } from "node:test";
import assert from "node:assert/strict";
import {
  replayCapital,
  type CapitalEvent,
} from "../lib/pilot/capital-replay.ts";
const event = (id: string, at: number): CapitalEvent => ({
  id,
  at,
  displayedBoth: true,
  legs: [
    {
      venue: "kalshi",
      marketId: "K" + id,
      side: "yes",
      quantity: 1,
      limitPrice: 4500,
      modeledDebit: 4700,
      feeUpper: 200,
    },
    {
      venue: "poly",
      marketId: "P" + id,
      side: "no",
      quantity: 1,
      limitPrice: 4500,
      modeledDebit: 4700,
      feeUpper: 200,
    },
  ],
});
test("Capital replay allocates chronological inventory once without crediting settlement profits", () => {
  const a = event("a", 1),
    b = event("b", 2);
  const r = replayCapital([b, a, { ...a, at: 3, id: "duplicate" }]);
  assert.deepEqual(
    r.accepted.map((x) => x.id),
    ["a", "b"],
  );
  assert.equal(r.skipped.INVENTORY_ALREADY_HELD, 1);
  assert.equal(r.cash.kalshi, 1000000 - 9400);
  assert.equal(r.committed, 18800);
  assert.equal(r.confirmedFills, 0);
  assert.equal(r.realizedProfit, 0);
});
test("Capital replay stops at committed pilot cap and never turns missing display into a fill", () => {
  const r = replayCapital(
    Array.from({ length: 20 }, (_, i) => event(String(i), i)),
  );
  assert.equal(r.accepted.length, 10);
  assert.equal(r.skipped.COMMITTED_CAPITAL_LIMIT, 10);
  const bad = event("bad", 1);
  bad.displayedBoth = false;
  assert.equal(replayCapital([bad]).accepted.length, 0);
  const invalid = event("invalid", 1);
  invalid.legs[0].modeledDebit = NaN;
  assert.equal(replayCapital([invalid]).skipped.INVALID_EVENT, 1);
});
