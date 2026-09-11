import type { PilotLeg } from "./preflight.ts";

// Pure serialization only: no credentials, transport, or order submission.
// Tick metadata must be refreshed from the venue; never round a limit upward.
type WireLeg = Pick<
  PilotLeg,
  "venue" | "marketId" | "side" | "quantity" | "limitPrice"
>;
type WireMetadata = {
  marketId: string;
  tick: number;
  minimumQuantity: number;
  exchangeIndex?: number;
};
export const encodePilotBuy = (
  leg: WireLeg,
  metadata: WireMetadata,
  clientOrderId: string,
) => encode(leg, metadata, clientOrderId, "buy");
// Requires owned, reconciled inventory at the caller. This function cannot sell it.
export const encodePilotSell = (
  leg: WireLeg,
  metadata: WireMetadata,
  clientOrderId: string,
) => encode(leg, metadata, clientOrderId, "sell");
function encode(
  leg: WireLeg,
  metadata: WireMetadata,
  clientOrderId: string,
  action: "buy" | "sell",
) {
  if (
    !["kalshi", "poly"].includes(leg.venue) ||
    !["yes", "no"].includes(leg.side) ||
    leg.quantity !== 1 ||
    !leg.marketId ||
    leg.marketId !== metadata.marketId ||
    !Number.isSafeInteger(leg.limitPrice) ||
    leg.limitPrice <= 0 ||
    leg.limitPrice >= 10000 ||
    !Number.isSafeInteger(metadata.tick) ||
    metadata.tick <= 0 ||
    metadata.tick >= 10000 ||
    !Number.isFinite(metadata.minimumQuantity) ||
    metadata.minimumQuantity <= 0 ||
    metadata.minimumQuantity > 1
  )
    throw Error("Unsupported pilot order or metadata");
  const yesPrice = leg.side === "yes" ? leg.limitPrice : 10000 - leg.limitPrice;
  if (yesPrice % metadata.tick !== 0)
    throw Error("Limit is off the venue price grid");
  const price = (yesPrice / 10000).toFixed(4);
  if (leg.venue === "kalshi") {
    if (metadata.exchangeIndex !== 0) throw Error("Unsupported exchange index");
    if (!/^[a-zA-Z0-9:_-]{1,128}$/.test(clientOrderId))
      throw Error("Invalid client order id");
    return {
      venue: "kalshi" as const,
      body: {
        ticker: leg.marketId,
        client_order_id: clientOrderId,
        side: (leg.side === "yes") === (action === "buy") ? "bid" : "ask",
        count: "1.00",
        price,
        time_in_force: "fill_or_kill",
        self_trade_prevention_type: "taker_at_cross",
        post_only: false,
        cancel_order_on_pause: true,
        reduce_only: action === "sell",
        subaccount: 0,
        exchange_index: 0,
      },
      automaticRetryAllowed: false as const,
    };
  }
  // The documented PM-US create schema has no client-id/idempotency field.
  // A lost response must remain unresolved, not be retried using a local id.
  return {
    venue: "poly" as const,
    body: {
      marketSlug: leg.marketId,
      type: "ORDER_TYPE_LIMIT",
      price: { value: price, currency: "USD" },
      quantity: 1,
      tif: "TIME_IN_FORCE_FILL_OR_KILL",
      intent:
        action === "buy"
          ? leg.side === "yes"
            ? "ORDER_INTENT_BUY_LONG"
            : "ORDER_INTENT_BUY_SHORT"
          : leg.side === "yes"
            ? "ORDER_INTENT_SELL_LONG"
            : "ORDER_INTENT_SELL_SHORT",
      participateDontInitiate: false,
      manualOrderIndicator: "MANUAL_ORDER_INDICATOR_AUTOMATIC",
    },
    automaticRetryAllowed: false as const,
  };
}
