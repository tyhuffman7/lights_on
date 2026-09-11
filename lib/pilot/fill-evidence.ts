import type { Side, Venue } from "../arb/types.ts";
export type ExpectedFill = {
  orderId: string;
  marketId: string;
  side: Side;
  action: "buy" | "sell";
};
const obj = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === "object" && !Array.isArray(x);
function decimalUnits(x: unknown, precision: number) {
  if (typeof x !== "string" || !/^\d+(?:\.\d+)?$/.test(x))
    throw Error("Invalid fixed-point evidence");
  const [whole, fraction = ""] = x.split(".");
  if (/[^0]/.test(fraction.slice(precision)))
    throw Error("Unsupported evidence precision");
  const value =
    BigInt(whole) * 10n ** BigInt(precision) +
    BigInt(fraction.slice(0, precision).padEnd(precision, "0"));
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    throw Error("Evidence amount out of range");
  return Number(value);
}
export const evidenceUnits = (x: unknown) => decimalUnits(x, 4);
export const moneyMicros = (x: unknown) => decimalUnits(x, 6);
function usd(x: unknown, precision = 4) {
  if (!obj(x) || x.currency !== "USD") throw Error("Unknown fill currency");
  return decimalUnits(x.value, precision);
}
function finish(
  venue: Venue,
  id: unknown,
  expected: ExpectedFill,
  quantity: number,
  price: number,
  fee: number,
) {
  if (
    typeof id !== "string" ||
    !id ||
    typeof expected.orderId !== "string" ||
    !expected.orderId ||
    typeof expected.marketId !== "string" ||
    !expected.marketId ||
    !["yes", "no"].includes(expected.side) ||
    !["buy", "sell"].includes(expected.action) ||
    quantity <= 0 ||
    price <= 0 ||
    price >= 10000
  )
    throw Error("Invalid fill evidence");
  const product = BigInt(quantity) * BigInt(price);
  if (product % 100n) throw Error("Unsupported fill notional precision");
  const notional = Number(product / 100n);
  if (!Number.isSafeInteger(notional) || !Number.isSafeInteger(notional + fee))
    throw Error("Fill notional out of range");
  return {
    venue,
    fillId: id,
    orderId: expected.orderId,
    marketId: expected.marketId,
    side: expected.side,
    action: expected.action,
    moneyScale: 1000000 as const,
    quantityUnits: quantity,
    quantity: quantity / 10000,
    price,
    feeMicros: fee,
    notionalMicros: notional,
    cashFlowMicros:
      expected.action === "buy" ? -(notional + fee) : notional - fee,
  };
}
// Parses individual fills only, never infers completion from an acknowledgment.
export function kalshiFill(raw: unknown, expected: ExpectedFill) {
  if (
    !obj(raw) ||
    raw.order_id !== expected.orderId ||
    raw.ticker !== expected.marketId ||
    raw.market_ticker !== expected.marketId ||
    raw.side !== expected.side ||
    raw.outcome_side !== expected.side ||
    raw.action !== expected.action ||
    raw.exchange_index !== 0 ||
    raw.subaccount_number !== 0
  )
    throw Error("Kalshi fill identity mismatch");
  const expectedBook =
    (expected.side === "yes") === (expected.action === "buy") ? "bid" : "ask";
  if (raw.book_side !== expectedBook)
    throw Error("Kalshi fill direction mismatch");
  const yes = evidenceUnits(raw.yes_price_dollars),
    no = evidenceUnits(raw.no_price_dollars);
  if (yes + no !== 10000) throw Error("Kalshi fill prices are inconsistent");
  return finish(
    "kalshi",
    raw.fill_id,
    expected,
    evidenceUnits(raw.count_fp),
    expected.side === "yes" ? yes : no,
    moneyMicros(raw.fee_cost),
  );
}
export function polyFill(raw: unknown, expected: ExpectedFill) {
  if (
    !obj(raw) ||
    !obj(raw.order) ||
    raw.order.id !== expected.orderId ||
    raw.order.marketSlug !== expected.marketId ||
    !["EXECUTION_TYPE_PARTIAL_FILL", "EXECUTION_TYPE_FILL"].includes(raw.type)
  )
    throw Error("PM-US fill identity or event mismatch");
  const intent =
    expected.action === "buy"
      ? expected.side === "yes"
        ? "ORDER_INTENT_BUY_LONG"
        : "ORDER_INTENT_BUY_SHORT"
      : expected.side === "yes"
        ? "ORDER_INTENT_SELL_LONG"
        : "ORDER_INTENT_SELL_SHORT";
  if (
    raw.order.intent !== intent ||
    raw.order.outcomeSide !==
      (expected.side === "yes" ? "OUTCOME_SIDE_YES" : "OUTCOME_SIDE_NO") ||
    raw.order.action !==
      (expected.action === "buy" ? "ORDER_ACTION_BUY" : "ORDER_ACTION_SELL")
  )
    throw Error("PM-US fill direction mismatch");
  const yes = usd(raw.lastPx);
  return finish(
    "poly",
    raw.id,
    expected,
    evidenceUnits(raw.lastShares),
    expected.side === "yes" ? yes : 10000 - yes,
    usd(raw.commissionNotionalCollected, 6),
  );
}
export function uniqueFillTotals(fills: ReturnType<typeof polyFill>[]) {
  const seen = new Map<string, ReturnType<typeof polyFill>>();
  let identity: string | undefined;
  for (const f of fills) {
    if (f.moneyScale !== 1000000 || f.quantity !== f.quantityUnits / 10000)
      throw Error("Unsupported fill unit version");
    const key = JSON.stringify([
      f.venue,
      f.orderId,
      f.marketId,
      f.side,
      f.action,
    ]);
    if (identity !== undefined && identity !== key)
      throw Error("Cannot aggregate different orders");
    identity = key;
    const old = seen.get(f.fillId);
    if (old && JSON.stringify(old) !== JSON.stringify(f))
      throw Error("Conflicting duplicate fill");
    seen.set(f.fillId, f);
  }
  const total = (field: "cashFlowMicros" | "feeMicros" | "quantityUnits") => {
    let sum = 0n;
    for (const f of seen.values()) {
      const value = f[field];
      if (!Number.isSafeInteger(value))
        throw Error("Invalid fill aggregate input");
      sum += BigInt(value);
    }
    if (
      sum > BigInt(Number.MAX_SAFE_INTEGER) ||
      sum < BigInt(Number.MIN_SAFE_INTEGER)
    )
      throw Error("Fill aggregate out of range");
    return Number(sum);
  };
  return {
    fills: seen.size,
    moneyScale: 1000000 as const,
    quantity: total("quantityUnits") / 10000,
    cashFlowMicros: total("cashFlowMicros"),
    feeMicros: total("feeMicros"),
    orderCompletionKnown: false,
  };
}

// An activity includes both counterparties. Only select our execution using the
// authenticated account's explicit aggressor flag, then enforce expected identity.
export function polyActivityFill(raw: unknown, expected: ExpectedFill) {
  if (
    !obj(raw) ||
    raw.type !== "ACTIVITY_TYPE_TRADE" ||
    !obj(raw.trade) ||
    typeof raw.trade.isAggressor !== "boolean" ||
    raw.trade.marketSlug !== expected.marketId
  )
    throw Error("Unknown account trade activity");
  const execution = raw.trade.isAggressor
    ? raw.trade.aggressorExecution
    : raw.trade.passiveExecution;
  if (!obj(execution) || execution.aggressor !== raw.trade.isAggressor)
    throw Error("Account trade ownership mismatch");
  return polyFill(execution, expected);
}
