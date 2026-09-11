import { test } from "node:test";
import assert from "node:assert/strict";
import { polyFill } from "../lib/pilot/fill-evidence.ts";
import { reconcileOrderEvidence } from "../lib/pilot/order-evidence.ts";
const expected = {
  orderId: "bot",
  marketId: "fixture",
  side: "yes" as const,
  action: "buy" as const,
  quantity: 1,
};
const order = {
  id: "bot",
  marketSlug: "fixture",
  intent: "ORDER_INTENT_BUY_LONG",
  outcomeSide: "OUTCOME_SIDE_YES",
  action: "ORDER_ACTION_BUY",
  quantity: 1,
  cumQuantity: 0.5,
  leavesQuantity: 0,
  state: "ORDER_STATE_CANCELED",
  commissionNotionalTotalCollected: { value: "0.01", currency: "USD" },
  lastTransactTime: "2026-09-11T12:00:00Z",
};
const fill = polyFill(
  {
    id: "fill",
    type: "EXECUTION_TYPE_PARTIAL_FILL",
    order,
    lastShares: "0.5",
    lastPx: { value: "0.4", currency: "USD" },
    commissionNotionalCollected: { value: "0.01", currency: "USD" },
  },
  expected,
);
test("Canceled orders preserve reconciled partial inventory and costs", () => {
  const r = reconcileOrderEvidence("poly", order, expected, [fill, fill]);
  assert.equal(r.state, "CANCELED");
  assert.equal(r.filled, 0.5);
  assert.equal(r.cashFlowMicros, -210000);
  assert.equal(r.terminal, true);
  assert.throws(() => reconcileOrderEvidence("poly", order, expected, []));
  assert.throws(() =>
    reconcileOrderEvidence(
      "poly",
      { ...order, state: "ORDER_STATE_FILLED" },
      expected,
      [fill],
    ),
  );
  assert.throws(() =>
    reconcileOrderEvidence(
      "poly",
      { ...order, state: "ORDER_STATE_PENDING_CANCEL" },
      expected,
      [fill],
    ),
  );
  assert.throws(() =>
    reconcileOrderEvidence(
      "poly",
      {
        ...order,
        commissionNotionalTotalCollected: { value: "0.02", currency: "USD" },
      },
      expected,
      [fill],
    ),
  );
});
test("Kalshi order scope, cumulative cost and full execution agree", () => {
  const k = {
    order_id: "bot",
    ticker: "fixture",
    side: "yes",
    outcome_side: "yes",
    action: "buy",
    book_side: "bid",
    exchange_index: 0,
    subaccount_number: 0,
    initial_count_fp: "1",
    fill_count_fp: "1",
    remaining_count_fp: "0",
    taker_fees_dollars: "0.01",
    maker_fees_dollars: "0",
    taker_fill_cost_dollars: "0.40",
    maker_fill_cost_dollars: "0",
    status: "executed",
    last_update_time: "2026-09-11T12:00:00Z",
  };
  const f = {
    ...fill,
    venue: "kalshi" as const,
    quantity: 1,
    quantityUnits: 10000,
    notionalMicros: 400000,
    cashFlowMicros: -410000,
  };
  assert.equal(reconcileOrderEvidence("kalshi", k, expected, [f]).filled, 1);
  assert.throws(() =>
    reconcileOrderEvidence(
      "kalshi",
      { ...k, taker_fill_cost_dollars: "0.41" },
      expected,
      [f],
    ),
  );
  assert.throws(() =>
    reconcileOrderEvidence("kalshi", { ...k, exchange_index: 1 }, expected, [
      f,
    ]),
  );
});

test("Budget conversion rounds fractional microdollars up without changing exact evidence", async () => {
  const { reservationDebit } = await import("../lib/pilot/order-evidence.ts");
  const evidence = {
    action: "buy" as const,
    moneyScale: 1000000 as const,
    cashFlowMicros: -601,
  };
  assert.equal(reservationDebit(evidence), 7);
  assert.equal(evidence.cashFlowMicros, -601);
  assert.equal(reservationDebit({ ...evidence, cashFlowMicros: -600 }), 6);
  assert.throws(() => reservationDebit({ ...evidence, action: "sell" }));
});
