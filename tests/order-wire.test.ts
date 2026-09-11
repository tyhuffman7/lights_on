import { test } from "node:test";
import assert from "node:assert/strict";
import { encodePilotBuy } from "../lib/pilot/order-wire.ts";
import type { PilotLeg } from "../lib/pilot/preflight.ts";
const leg = (
  venue: "kalshi" | "poly",
  side: "yes" | "no",
  limitPrice: number,
): PilotLeg => ({
  venue,
  side,
  limitPrice,
  marketId: "fixture",
  quantity: 1,
  modeledDebit: limitPrice + 100,
  feeUpper: 100,
});
const meta = {
  marketId: "fixture",
  tick: 100,
  minimumQuantity: 1,
  exchangeIndex: 0,
};
test("NO purchases complement YES price without changing the intended debit", () => {
  for (const side of ["yes", "no"] as const)
    for (let p = 100; p < 10000; p += 100) {
      const k = encodePilotBuy(leg("kalshi", side, p), meta, "local-1");
      const b = encodePilotBuy(leg("poly", side, p), meta, "local-2");
      assert.equal(k.venue, "kalshi");
      assert.equal(b.venue, "poly");
      if (k.venue !== "kalshi" || b.venue !== "poly") throw Error();
      const yes = side === "yes" ? p : 10000 - p;
      assert.equal(k.body.price, (yes / 10000).toFixed(4));
      assert.equal(b.body.price.value, k.body.price);
      assert.equal(k.body.side, side === "yes" ? "bid" : "ask");
      assert.equal(
        b.body.intent,
        side === "yes" ? "ORDER_INTENT_BUY_LONG" : "ORDER_INTENT_BUY_SHORT",
      );
      assert.equal(k.body.time_in_force, "fill_or_kill");
      assert.equal(b.body.tif, "TIME_IN_FORCE_FILL_OR_KILL");
      assert.equal(b.automaticRetryAllowed, false);
      assert.equal("client_order_id" in b.body, false);
    }
});
test("Pilot serialization fails closed on wrong market, unknown grid, size and exchange", () => {
  for (const m of [
    { ...meta, marketId: "wrong" },
    { ...meta, tick: 0 },
    { ...meta, tick: NaN },
    { ...meta, minimumQuantity: 2 },
    { ...meta, exchangeIndex: 1 },
  ])
    assert.throws(() => encodePilotBuy(leg("kalshi", "yes", 1400), m, "id"));
  for (const price of [0, 10000, 1401, NaN, Infinity])
    assert.throws(() => encodePilotBuy(leg("kalshi", "no", price), meta, "id"));
  assert.throws(() =>
    encodePilotBuy({ ...leg("poly", "yes", 1400), quantity: 2 }, meta, "id"),
  );
});

import { encodePilotSell } from "../lib/pilot/order-wire.ts";
test("Early exit serialization reverses entry direction and reduces Kalshi inventory", () => {
  for (const side of ["yes", "no"] as const) {
    const k = encodePilotSell(leg("kalshi", side, 1900), meta, "exit-1");
    const p = encodePilotSell(leg("poly", side, 1900), meta, "exit-2");
    if (k.venue !== "kalshi" || p.venue !== "poly") throw Error();
    assert.equal(k.body.side, side === "yes" ? "ask" : "bid");
    assert.equal(k.body.reduce_only, true);
    assert.equal(
      p.body.intent,
      side === "yes" ? "ORDER_INTENT_SELL_LONG" : "ORDER_INTENT_SELL_SHORT",
    );
    assert.equal(k.body.price, side === "yes" ? "0.1900" : "0.8100");
    assert.equal(p.body.price.value, k.body.price);
  }
});
