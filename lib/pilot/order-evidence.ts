import type { Venue } from "../arb/types.ts";
import {
  evidenceUnits,
  moneyMicros,
  uniqueFillTotals,
  type ExpectedFill,
  polyFill,
} from "./fill-evidence.ts";
const obj = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === "object" && !Array.isArray(x);
// A REST order and its individual fills must agree before inventory is established.
// This does not invent exchange revisions or update the intent ledger by itself.
export function reconcileOrderEvidence(
  venue: Venue,
  raw: unknown,
  expected: ExpectedFill & { quantity: number },
  fills: ReturnType<typeof polyFill>[],
) {
  if (
    !obj(raw) ||
    typeof expected.orderId !== "string" ||
    !expected.orderId ||
    typeof expected.marketId !== "string" ||
    !expected.marketId ||
    !["yes", "no"].includes(expected.side) ||
    !["buy", "sell"].includes(expected.action) ||
    !["kalshi", "poly"].includes(venue) ||
    !Number.isFinite(expected.quantity) ||
    expected.quantity <= 0
  )
    throw Error("Invalid order evidence");
  for (const f of fills)
    if (
      f.venue !== venue ||
      f.orderId !== expected.orderId ||
      f.marketId !== expected.marketId ||
      f.side !== expected.side ||
      f.action !== expected.action
    )
      throw Error("Order fill identity mismatch");
  const totals = uniqueFillTotals(fills);
  let initial: number,
    filled: number,
    remaining: number,
    fee: number,
    state: string,
    sourceUpdatedAt: unknown;
  if (venue === "kalshi") {
    const book =
      (expected.side === "yes") === (expected.action === "buy") ? "bid" : "ask";
    if (
      raw.order_id !== expected.orderId ||
      raw.ticker !== expected.marketId ||
      raw.side !== expected.side ||
      raw.outcome_side !== expected.side ||
      raw.action !== expected.action ||
      raw.book_side !== book ||
      raw.exchange_index !== 0 ||
      raw.subaccount_number !== 0
    )
      throw Error("Kalshi order identity mismatch");
    initial = evidenceUnits(raw.initial_count_fp) / 10000;
    filled = evidenceUnits(raw.fill_count_fp) / 10000;
    remaining = evidenceUnits(raw.remaining_count_fp) / 10000;
    fee =
      moneyMicros(raw.taker_fees_dollars) + moneyMicros(raw.maker_fees_dollars);
    const notional =
      moneyMicros(raw.taker_fill_cost_dollars) +
      moneyMicros(raw.maker_fill_cost_dollars);
    const fillNotional =
      expected.action === "buy"
        ? -totals.cashFlowMicros - totals.feeMicros
        : totals.cashFlowMicros + totals.feeMicros;
    if (
      !Number.isSafeInteger(notional) ||
      !Number.isSafeInteger(fee) ||
      notional !== fillNotional
    )
      throw Error("Order cost and fills disagree");
    state =
      raw.status === "executed"
        ? "FILLED"
        : raw.status === "canceled"
          ? "CANCELED"
          : raw.status === "resting"
            ? filled > 0
              ? "PARTIAL"
              : "ACKNOWLEDGED"
            : "UNRESOLVED";
    sourceUpdatedAt = raw.last_update_time;
  } else {
    const intent = `ORDER_INTENT_${expected.action === "buy" ? "BUY" : "SELL"}_${expected.side === "yes" ? "LONG" : "SHORT"}`;
    if (
      raw.id !== expected.orderId ||
      raw.marketSlug !== expected.marketId ||
      raw.intent !== intent ||
      raw.outcomeSide !==
        (expected.side === "yes" ? "OUTCOME_SIDE_YES" : "OUTCOME_SIDE_NO") ||
      raw.action !==
        (expected.action === "buy" ? "ORDER_ACTION_BUY" : "ORDER_ACTION_SELL")
    )
      throw Error("PM-US order identity mismatch");
    const quantity = (n: unknown) => {
      if (typeof n !== "number" || !Number.isFinite(n))
        throw Error("Invalid order quantity");
      return evidenceUnits(String(n)) / 10000;
    };
    initial = quantity(raw.quantity);
    filled = quantity(raw.cumQuantity);
    remaining = quantity(raw.leavesQuantity);
    if (
      !obj(raw.commissionNotionalTotalCollected) ||
      raw.commissionNotionalTotalCollected.currency !== "USD"
    )
      throw Error("Unknown order fee currency");
    fee = moneyMicros(raw.commissionNotionalTotalCollected.value);
    state =
      (
        {
          ORDER_STATE_NEW: "ACKNOWLEDGED",
          ORDER_STATE_PARTIALLY_FILLED: "PARTIAL",
          ORDER_STATE_FILLED: "FILLED",
          ORDER_STATE_CANCELED: "CANCELED",
          ORDER_STATE_EXPIRED: "CANCELED",
          ORDER_STATE_REJECTED: "REJECTED",
        } as Record<string, string>
      )[raw.state] ?? "UNRESOLVED";
    sourceUpdatedAt = raw.lastTransactTime;
  }
  if (
    initial !== expected.quantity ||
    filled !== totals.quantity ||
    fee !== totals.feeMicros ||
    filled > initial ||
    remaining > initial - filled + 1e-9
  )
    throw Error("Order totals and fills disagree");
  if (
    state === "UNRESOLVED" ||
    (state === "FILLED" && (filled !== initial || remaining !== 0)) ||
    (state === "ACKNOWLEDGED" && filled !== 0) ||
    (state === "PARTIAL" && (filled <= 0 || filled >= initial)) ||
    (state === "REJECTED" && (filled !== 0 || fee !== 0)) ||
    (["CANCELED", "REJECTED"].includes(state) && remaining !== 0)
  )
    throw Error("Unresolved or inconsistent order state");
  if (
    typeof sourceUpdatedAt !== "string" ||
    !Number.isFinite(Date.parse(sourceUpdatedAt))
  )
    throw Error("Order update time missing");
  return {
    venue,
    orderId: expected.orderId,
    marketId: expected.marketId,
    side: expected.side,
    action: expected.action,
    quantity: expected.quantity,
    state,
    filled,
    remaining,
    moneyScale: 1000000 as const,
    feeMicros: fee,
    cashFlowMicros: totals.cashFlowMicros,
    sourceUpdatedAt,
    terminal: ["FILLED", "CANCELED", "REJECTED"].includes(state),
    interpretation:
      "Order and individual fills agree; no settlement, realized-profit or exchange-revision inference.",
  };
}
