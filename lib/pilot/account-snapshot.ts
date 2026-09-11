import type { Venue } from "../arb/types.ts";
import { readAccount } from "./account-read.ts";
import { pilotPolicy } from "./preflight.ts";
const object = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === "object" && !Array.isArray(x);
// Exact decimal truncation gives a cash lower bound; invalid/missing is never zero.
export function cashUnits(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number")
    throw Error("Invalid cash amount");
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw Error("Invalid cash amount");
  const [whole, fraction = ""] = text.split(".");
  const n =
    BigInt(whole) * 10000n + BigInt(fraction.slice(0, 4).padEnd(4, "0"));
  if (n > BigInt(Number.MAX_SAFE_INTEGER))
    throw Error("Cash amount out of range");
  return Number(n);
}
export function normalizeAccountSnapshot(
  venue: Venue,
  data: { balance: unknown; orders: unknown; positions: unknown },
  observedAt: number,
) {
  const reasons: string[] = [];
  let available: number | null = null;
  let openOrders: number | null = null;
  const occupiedMarkets: string[] = [];
  try {
    if (!Number.isSafeInteger(observedAt) || observedAt <= 0) throw Error();
    const { balance: b, orders: o, positions: p } = data;
    if (!object(b) || !object(o) || !object(p) || !Array.isArray(o.orders))
      throw Error();
    openOrders = o.orders.length;
    if (venue === "kalshi") {
      // Caller must use the fixed primary-subaccount, exchange-index-0 balance URL.
      available = cashUnits(b.balance_dollars);
      if (o.cursor !== "" || p.cursor !== "")
        reasons.push("PAGINATION_INCOMPLETE");
      if (!Array.isArray(p.market_positions)) throw Error();
      for (const item of p.market_positions) {
        if (
          !object(item) ||
          typeof item.ticker !== "string" ||
          !item.ticker ||
          typeof item.position_fp !== "string" ||
          !/^-?\d+(?:\.\d+)?$/.test(item.position_fp)
        )
          throw Error();
        if (Number(item.position_fp) !== 0) occupiedMarkets.push(item.ticker);
      }
    } else if (venue === "poly") {
      if (!Array.isArray(b.balances)) throw Error();
      const usd = b.balances.filter((x) => object(x) && x.currency === "USD");
      if (usd.length !== 1) throw Error();
      available = Math.min(
        cashUnits(usd[0].currentBalance),
        cashUnits(usd[0].buyingPower),
      );
      if (p.eof !== true || p.nextCursor !== "")
        reasons.push("PAGINATION_INCOMPLETE");
      if (!object(p.positions)) throw Error();
      // Any returned position excludes that market. Do not infer bot ownership or
      // zero exposure from the deprecated availablePositions array.
      for (const [slug, position] of Object.entries(p.positions)) {
        if (!slug || !object(position)) throw Error();
        occupiedMarkets.push(slug);
      }
    } else throw Error();
  } catch {
    reasons.push("ACCOUNT_SCHEMA_UNRECOGNIZED");
  }
  return {
    venue,
    observedAt,
    complete: reasons.length === 0,
    reasons,
    availableWithinPilot:
      reasons.length === 0 && available !== null
        ? Math.min(available, pilotPolicy.capitalPerVenue)
        : null,
    openOrders,
    occupiedMarkets: [...new Set(occupiedMarkets)],
    interpretation:
      "Read-only snapshot, not bot-inventory reconciliation or launch authorization. Existing positions are not owned by the bot; selected occupied markets must be excluded.",
  };
}
export async function readPilotAccountSnapshot(
  venue: Venue,
  options: Parameters<typeof readAccount>[2] = {},
) {
  const observedAt = Date.now();
  const [balance, orders, positions] = await Promise.all(
    (["balance", "orders", "positions"] as const).map((op) =>
      readAccount(venue, op, options),
    ),
  );
  if (!balance.ok || !orders.ok || !positions.ok)
    throw Error("Account snapshot read incomplete");
  return normalizeAccountSnapshot(
    venue,
    { balance: balance.body, orders: orders.body, positions: positions.body },
    observedAt,
  );
}
