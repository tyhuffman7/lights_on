import type { Market, Side } from "../arb/types.ts";
import type { StreamBook } from "../research/types.ts";
import { fresh } from "../research/books.ts";
import { fill } from "../research/detector.ts";
import { feeSchedule } from "../research/fees.ts";
import { pilotPolicy as p, type PilotHealth } from "./preflight.ts";

export type ExitInventory = {
  market: Market;
  side: Side;
  confirmedQuantity: number;
  soldQuantity: number;
  entryDebit: number; // Actual cost including entry fees, for this entire leg.
  reconciledAt: number;
  unresolvedOrders: number;
};

// A quote only: realized profit requires reconciled fills from BOTH sales.
// Partial inventory is handled by a separate recovery path, never this paired exit.
export function pilotExitQuote(input: {
  inventory: [ExitInventory, ExitInventory];
  books: [StreamBook, StreamBook];
  health: PilotHealth;
  wall: number;
  mono: number;
}) {
  const { inventory, books, health, wall, mono } = input;
  const reasons: string[] = [];
  const legs: {
    marketId: string;
    side: Side;
    quantity: number;
    limitPrice: number;
    netProceeds: number;
  }[] = [];
  if (!Number.isFinite(wall) || !Number.isFinite(mono))
    reasons.push("INVALID_CLOCK");
  if (
    !Object.values(health).every((v) => v === true) ||
    !health.executionProtocolValidated ||
    !health.feesValidated ||
    !health.streamHealthy ||
    !health.persistenceHealthy ||
    !health.eventLoopHealthy
  )
    reasons.push("EXIT_HEALTH_UNVALIDATED");
  if (
    inventory[0].market.venue !== "kalshi" ||
    inventory[1].market.venue !== "poly"
  )
    reasons.push("INVENTORY_VENUE_MISMATCH");
  for (let i = 0; i < 2; i++) {
    const item = inventory[i],
      book = books[i];
    if (
      item.confirmedQuantity !== 1 ||
      item.soldQuantity !== 0 ||
      item.unresolvedOrders !== 0 ||
      !Number.isSafeInteger(item.entryDebit) ||
      item.entryDebit <= 0 ||
      item.entryDebit > p.maxPairDebit ||
      !["yes", "no"].includes(item.side)
    ) {
      reasons.push("INVENTORY_REQUIRES_RECONCILIATION");
      continue;
    }
    if (
      !Number.isFinite(item.reconciledAt) ||
      wall < item.reconciledAt ||
      wall - item.reconciledAt > p.maxAccountAgeMs
    )
      reasons.push("INVENTORY_STALE");
    if (book.marketId !== item.market.id || book.venue !== item.market.venue)
      reasons.push("BOOK_IDENTITY_MISMATCH");
    if (
      !book.open ||
      !item.market.open ||
      !Number.isFinite(Date.parse(item.market.closeAt)) ||
      Date.parse(item.market.closeAt) <= wall ||
      !fresh(book, mono, wall, p.maxBookAgeMs)
    )
      reasons.push("BOOK_NOT_EXECUTABLE");
    if (
      !Number.isFinite(item.market.minQty) ||
      item.market.minQty <= 0 ||
      item.market.minQty > 1
    )
      reasons.push("EXIT_SIZE_UNSUPPORTED");
    const schedule = feeSchedule(item.market);
    if (!schedule) {
      reasons.push("UNKNOWN_FEES");
      continue;
    }
    try {
      const bids = item.side === "yes" ? book.yesBids : book.noBids;
      const quote = fill(
        (bids ?? []).map((l) => ({
          ...l,
          quantity: Math.floor(l.quantity * p.maxDepthFraction),
        })),
        1,
        schedule,
        true,
      );
      if (!quote) {
        reasons.push("INSUFFICIENT_EXIT_DEPTH");
        continue;
      }
      const limitPrice = Math.min(...quote.levels.map((l) => l.price));
      legs.push({
        marketId: item.market.id,
        side: item.side,
        quantity: 1,
        limitPrice,
        netProceeds: limitPrice - quote.feeUpper,
      });
    } catch {
      reasons.push("INVALID_EXIT_BOOK");
    }
  }
  const modeledNet =
    legs.length === 2
      ? legs.reduce((sum, l) => sum + l.netProceeds, 0) -
        inventory.reduce((sum, i) => sum + i.entryDebit, 0) -
        p.uncertaintyReserve
      : null;
  if (
    modeledNet === null ||
    !Number.isSafeInteger(modeledNet) ||
    modeledNet < p.minimumNetProfit
  )
    reasons.push("NO_NET_EXIT_PROFIT");
  return {
    mode: "EXIT_QUOTE_ONLY" as const,
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    legs,
    modeledNet,
    createdAt: wall,
    expiresAt: wall + p.maxPlanAgeMs,
    realizedProfit: null,
  };
}
