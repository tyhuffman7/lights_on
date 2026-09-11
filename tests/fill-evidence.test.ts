import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kalshiFill,
  polyFill,
  uniqueFillTotals,
} from "../lib/pilot/fill-evidence.ts";
const expected = {
  orderId: "own-order",
  marketId: "fixture",
  side: "no" as const,
  action: "buy" as const,
};
const poly = () => ({
  id: "fill-1",
  type: "EXECUTION_TYPE_PARTIAL_FILL",
  order: {
    id: "own-order",
    marketSlug: "fixture",
    intent: "ORDER_INTENT_BUY_SHORT",
    outcomeSide: "OUTCOME_SIDE_NO",
    action: "ORDER_ACTION_BUY",
  },
  lastShares: "0.50",
  lastPx: { value: "0.8100", currency: "USD" },
  commissionNotionalCollected: { value: "0.0100", currency: "USD" },
});
test("Execution evidence complements NO prices and uses individual fill fees once", () => {
  const a = polyFill(poly(), expected);
  assert.equal(a.quantity, 0.5);
  assert.equal(a.notionalMicros, 95000);
  assert.equal(a.cashFlowMicros, -105000);
  const b = polyFill({ ...poly(), id: "fill-2" }, expected);
  const total = uniqueFillTotals([a, b, a]);
  assert.equal(total.quantity, 1);
  assert.equal(total.feeMicros, 20000);
  assert.equal(total.cashFlowMicros, -210000);
  assert.equal(total.orderCompletionKnown, false);
  assert.throws(() => uniqueFillTotals([a, { ...a, feeMicros: 20000 }]));
});
test("Acknowledgments, other orders, bad currencies and unsupported precision are not fills", () => {
  assert.throws(() =>
    polyFill({ ...poly(), type: "EXECUTION_TYPE_NEW" }, expected),
  );
  assert.throws(() =>
    polyFill(poly(), { ...expected, orderId: "counterparty" }),
  );
  assert.throws(() =>
    polyFill(
      { ...poly(), lastPx: { value: "0.81", currency: "EUR" } },
      expected,
    ),
  );
  assert.throws(() =>
    polyFill(
      {
        ...poly(),
        lastShares: "0.0001",
        lastPx: { value: "0.8101", currency: "USD" },
      },
      expected,
    ),
  );
  assert.throws(() =>
    polyFill(
      {
        ...poly(),
        commissionNotionalCollected: { value: "0.0000001", currency: "USD" },
      },
      expected,
    ),
  );
});
test("Kalshi evidence validates exchange scope, side and complementary prices", () => {
  const raw = {
    fill_id: "k-fill",
    order_id: "own-order",
    ticker: "fixture",
    market_ticker: "fixture",
    side: "no",
    outcome_side: "no",
    action: "buy",
    book_side: "ask",
    exchange_index: 0,
    subaccount_number: 0,
    count_fp: "1.00",
    yes_price_dollars: "0.8100",
    no_price_dollars: "0.1900",
    fee_cost: "0.0100",
  };
  assert.equal(kalshiFill(raw, expected).cashFlowMicros, -200000);
  assert.throws(() =>
    kalshiFill({ ...raw, no_price_dollars: "0.8100" }, expected),
  );
  assert.throws(() => kalshiFill({ ...raw, subaccount_number: 1 }, expected));
  assert.throws(() => kalshiFill({ ...raw, book_side: "bid" }, expected));
});

test("Account activities select our execution rather than the counterparty", async () => {
  const { polyActivityFill } = await import("../lib/pilot/fill-evidence.ts");
  const own = { ...poly(), aggressor: false };
  const trade = {
    marketSlug: "fixture",
    isAggressor: false,
    aggressorExecution: {
      ...poly(),
      aggressor: true,
      order: { ...poly().order, id: "counterparty" },
    },
    passiveExecution: own,
  };
  assert.equal(
    polyActivityFill({ type: "ACTIVITY_TYPE_TRADE", trade }, expected).quantity,
    0.5,
  );
  assert.throws(() =>
    polyActivityFill(
      { type: "ACTIVITY_TYPE_TRADE", trade: { ...trade, isAggressor: true } },
      expected,
    ),
  );
  assert.throws(() =>
    polyActivityFill(
      {
        type: "ACTIVITY_TYPE_TRADE",
        trade: { ...trade, isAggressor: undefined },
      },
      expected,
    ),
  );
});

test("Fractional fills retain six-decimal fees and notional exactly", () => {
  const raw = {
    fill_id: "micro-fill",
    order_id: "own-order",
    ticker: "fixture",
    market_ticker: "fixture",
    side: "yes",
    outcome_side: "yes",
    action: "buy",
    book_side: "bid",
    exchange_index: 0,
    subaccount_number: 0,
    count_fp: "0.01",
    yes_price_dollars: "0.0501",
    no_price_dollars: "0.9499",
    fee_cost: "0.000099",
  };
  const f = kalshiFill(raw, { ...expected, side: "yes" });
  assert.equal(f.quantity, 0.01);
  assert.equal(f.quantityUnits, 100);
  assert.equal(f.notionalMicros, 501);
  assert.equal(f.feeMicros, 99);
  assert.equal(f.cashFlowMicros, -600);
  assert.equal(f.moneyScale, 1000000);
  const totals = uniqueFillTotals([f, f, { ...f, fillId: "second" }]);
  assert.equal(totals.feeMicros, 198);
  assert.equal(totals.cashFlowMicros, -1200);
  assert.throws(
    () => uniqueFillTotals([{ ...f, moneyScale: 10000 } as any]),
    /unit version/,
  );
});
