import type { Pair, Side } from "../arb/types.ts";
import type { StreamBook } from "../research/types.ts";
import { fresh } from "../research/books.ts";
import { fill } from "../research/detector.ts";
import { feeSchedule } from "../research/fees.ts";
// Research-only size sweep. Does not change the one-contract execution policy.
export function affordableSizes(
  pair: Pair,
  a: StreamBook,
  b: StreamBook,
  aSide: Side,
  wall: number,
  mono: number,
  fullPilotBudget = false,
) {
  if (
    !Number.isFinite(wall) ||
    !Number.isFinite(mono) ||
    a.venue !== "kalshi" ||
    b.venue !== "poly" ||
    a.marketId !== pair.a.id ||
    b.marketId !== pair.b.id ||
    !fresh(a, mono, wall, 2000) ||
    !fresh(b, mono, wall, 2000) ||
    ![pair.a, pair.b].every(
      (m) =>
        m.open &&
        Number.isFinite(Date.parse(m.closeAt)) &&
        Date.parse(m.closeAt) > wall &&
        Number.isFinite(m.minQty) &&
        m.minQty > 0,
    ) ||
    !a.open ||
    !b.open
  )
    return [];
  const bSide: Side = pair.inverted ? aSide : aSide === "yes" ? "no" : "yes";
  const out = [];
  for (let quantity = 1; quantity <= (fullPilotBudget ? 200 : 10); quantity++) {
    const legs = [];
    for (const [market, book, side] of [
      [pair.a, a, aSide],
      [pair.b, b, bSide],
    ] as const) {
      const schedule = feeSchedule(market);
      if (!schedule || market.minQty > quantity) break;
      const usable = book[side].map((l) => ({
        ...l,
        quantity: Math.floor(l.quantity * 0.25),
      }));
      try {
        const quote = fill(usable, quantity, schedule);
        if (!quote) break;
        const limitPrice = Math.max(...quote.levels.map((l) => l.price));
        legs.push({
          venue: market.venue,
          marketId: market.id,
          side,
          quantity,
          limitPrice,
          modeledDebit: quantity * limitPrice + quote.feeUpper,
          feeUpper: quote.feeUpper,
        });
      } catch {
        break;
      }
    }
    if (legs.length !== 2) continue;
    const debit = legs.reduce((s, l) => s + l.modeledDebit, 0);
    if (
      debit > (fullPilotBudget ? 1800000 : 100000) ||
      legs.some((l) => l.modeledDebit > 900000)
    )
      continue; // Assumed $100 per venue less $10 reserve.
    const modeledNet = quantity * 10000 - debit - quantity * 100;
    out.push({ quantity, modeledNet, debit, legs, eligible: false as const });
  }
  return out;
}
