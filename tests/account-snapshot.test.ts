import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cashUnits,
  normalizeAccountSnapshot,
} from "../lib/pilot/account-snapshot.ts";
const k = () => ({
  balance: { balance_dollars: "123.45" },
  orders: { orders: [], cursor: "" },
  positions: {
    market_positions: [{ ticker: "manual", position_fp: "-1.00" }],
    cursor: "",
  },
});
const p = () => ({
  balance: {
    balances: [{ currency: "USD", currentBalance: 125, buyingPower: 75 }],
  },
  orders: { orders: [] },
  positions: {
    positions: { manual: { netPosition: "1" } },
    nextCursor: "",
    eof: true,
    availablePositions: [],
  },
});
test("Snapshots preserve manual market exclusion and cap cash at pilot authority", () => {
  const a = normalizeAccountSnapshot("kalshi", k(), 1);
  assert.equal(a.complete, true);
  assert.equal(a.availableWithinPilot, 1000000);
  assert.deepEqual(a.occupiedMarkets, ["manual"]);
  const b = normalizeAccountSnapshot("poly", p(), 1);
  assert.equal(b.availableWithinPilot, 750000);
  assert.deepEqual(b.occupiedMarkets, ["manual"]);
  assert.equal(b.openOrders, 0);
});
test("Partial pages and malformed responses cannot become reconciled cash", () => {
  const a = k();
  a.positions.cursor = "next";
  assert.equal(
    normalizeAccountSnapshot("kalshi", a, 1).availableWithinPilot,
    null,
  );
  const b = p();
  b.positions.eof = false;
  assert.equal(normalizeAccountSnapshot("poly", b, 1).complete, false);
  assert.equal(
    normalizeAccountSnapshot(
      "poly",
      { ...p(), positions: { availablePositions: [] } },
      1,
    ).complete,
    false,
  );
  const c = k();
  c.balance.balance_dollars = "NaN";
  assert.equal(normalizeAccountSnapshot("kalshi", c, 1).complete, false);
  const d = p();
  d.balance.balances.push(d.balance.balances[0]);
  assert.equal(normalizeAccountSnapshot("poly", d, 1).complete, false);
});
test("Cash conversion truncates fractional units and never assumes cents or missing cash", () => {
  assert.equal(cashUnits("1.23459"), 12345);
  assert.equal(cashUnits(100), 1000000);
  assert.equal(cashUnits("0.00001"), 0);
  for (const v of [
    null,
    undefined,
    NaN,
    Infinity,
    -1,
    "1e3",
    "-0.01",
    "9007199254740991",
  ])
    assert.throws(() => cashUnits(v));
});
