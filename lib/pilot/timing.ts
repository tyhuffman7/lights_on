import type { StreamBook } from "../research/types.ts";
import type { Pair } from "../arb/types.ts";
import { fresh } from "../research/books.ts";
import { fill } from "../research/detector.ts";
import { feeSchedule } from "../research/fees.ts";
import { pilotPolicy, type pilotPreflight } from "./preflight.ts";
type Plan = ReturnType<typeof pilotPreflight>;
export type Arrival = {
  book?: StreamBook;
  wall: number;
  mono: number;
  covered: boolean;
};
// Counterfactual marketable-limit checks. Never a queue model or evidence of fills.
export function arrivalEvidence(
  pair: Pair,
  plan: Plan,
  arrivals: [Arrival, Arrival],
) {
  const legs = plan.legs.map((leg, i) => {
    const arrival = arrivals[i],
      market = i === 0 ? pair.a : pair.b;
    if (
      !arrival ||
      !arrival.covered ||
      !Number.isFinite(arrival.wall) ||
      !Number.isFinite(arrival.mono)
    )
      return { venue: leg.venue, status: "UNOBSERVED", debit: null };
    const b = arrival.book;
    if (
      !b ||
      b.venue !== leg.venue ||
      b.marketId !== leg.marketId ||
      market.id !== leg.marketId ||
      market.venue !== leg.venue ||
      !fresh(b, arrival.mono, arrival.wall, pilotPolicy.maxBookAgeMs)
    )
      return { venue: leg.venue, status: "STALE_OR_MISSING", debit: null };
    if (!b.open || !market.open || !(Date.parse(market.closeAt) > arrival.wall))
      return { venue: leg.venue, status: "CLOSED", debit: null };
    const fees = feeSchedule(market);
    if (!fees) return { venue: leg.venue, status: "UNKNOWN_FEES", debit: null };
    try {
      const quote = fill(
        b[leg.side]
          .filter((l) => l.price <= leg.limitPrice)
          .map((l) => ({
            ...l,
            quantity: Math.floor(l.quantity * pilotPolicy.maxDepthFraction),
          })),
        leg.quantity,
        fees,
      );
      if (!quote || quote.cost + quote.feeUpper > leg.modeledDebit)
        return { venue: leg.venue, status: "LIMIT_OR_DEPTH_GONE", debit: null };
      return {
        venue: leg.venue,
        status: "DISPLAYED_AVAILABLE",
        debit: quote.cost + quote.feeUpper,
      };
    } catch {
      return { venue: leg.venue, status: "INVALID_BOOK", debit: null };
    }
  });
  const unknown =
    legs.length !== 2 ||
    legs.some((l) =>
      [
        "UNOBSERVED",
        "STALE_OR_MISSING",
        "UNKNOWN_FEES",
        "INVALID_BOOK",
      ].includes(l.status),
    );
  const available = legs.filter(
    (l) => l.status === "DISPLAYED_AVAILABLE",
  ).length;
  return {
    status: unknown
      ? "INSUFFICIENT_EVIDENCE"
      : available === 2
        ? "BOTH_DISPLAYED_AVAILABLE"
        : available === 1
          ? "ONE_LEG_ONLY"
          : "NEITHER_AVAILABLE",
    legs,
    modeledNet:
      !unknown && available === 2
        ? 10000 * plan.quantity -
          legs.reduce((n, l) => n + (l.debit ?? 0), 0) -
          pilotPolicy.uncertaintyReserve
        : null,
    confirmedFills: 0,
  };
}
