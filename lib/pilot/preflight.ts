import type { StreamBook } from "../research/types.ts";
import type { Mapping } from "../research/types.ts";
import type { Side, Venue } from "../arb/types.ts";
import { fresh } from "../research/books.ts";
import { isVerified } from "../research/mappings.ts";
import { fill } from "../research/detector.ts";
import { feeSchedule } from "../research/fees.ts";

// USD uses the existing exact 1/10,000-dollar units. No live transport is exported.
export const pilotPolicy = Object.freeze({
  capitalPerVenue: 1000000,
  totalLossLimit: 2000000,
  contractsPerPair: 1,
  maxPairDebit: 20000,
  maxCommitted: 100000,
  reservePerVenue: 100000,
  maxDepthFraction: 0.25,
  maxBookAgeMs: 2000,
  maxMetadataAgeMs: 60000,
  maxAccountAgeMs: 5000,
  maxPlanAgeMs: 250,
  minimumNetProfit: 100,
  uncertaintyReserve: 100,
});
export type PilotAccount = {
  venue: Venue;
  available: number;
  cumulativeSpent: number;
  reserved: number;
  reconciledAt: number;
  unresolvedOrders: number;
  unmatchedContracts: number;
};
export type PilotHealth = {
  streamHealthy: boolean;
  persistenceHealthy: boolean;
  eventLoopHealthy: boolean;
  executionProtocolValidated: boolean;
  feesValidated: boolean;
};
export type PilotLeg = {
  venue: Venue;
  marketId: string;
  side: Side;
  quantity: number;
  limitPrice: number;
  modeledDebit: number;
  feeUpper: number;
};
export function pilotPreflight(input: {
  mapping: Mapping;
  a: StreamBook;
  b: StreamBook;
  aSide: Side;
  accounts: Record<Venue, PilotAccount>;
  health: PilotHealth;
  wall: number;
  mono: number;
}) {
  const { mapping: m, a, b, aSide, accounts, health, wall, mono } = input;
  const p = pilotPolicy,
    reasons: string[] = [];
  const finite = (n: number) => Number.isSafeInteger(n) && n >= 0;
  if (!Number.isFinite(wall) || !Number.isFinite(mono))
    reasons.push("INVALID_CLOCK");
  if (!isVerified(m)) reasons.push("RULE_EQUIVALENCE_UNVERIFIED");
  if (!m.pair.reviewed || !m.lastVerifiedAt || !m.pair.a.hash || !m.pair.b.hash)
    reasons.push("APPROVAL_EVIDENCE_MISSING");
  if (
    !m.metadataAt ||
    wall < m.metadataAt ||
    wall - m.metadataAt > p.maxMetadataAgeMs
  )
    reasons.push("METADATA_REFRESH_REQUIRED");
  if (
    a.venue !== "kalshi" ||
    b.venue !== "poly" ||
    a.marketId !== m.pair.a.id ||
    b.marketId !== m.pair.b.id
  )
    reasons.push("BOOK_IDENTITY_MISMATCH");
  if (
    !fresh(a, mono, wall, p.maxBookAgeMs) ||
    !fresh(b, mono, wall, p.maxBookAgeMs)
  )
    reasons.push("BOOK_NOT_STRICTLY_FRESH");
  if (
    !a.open ||
    !b.open ||
    [m.pair.a, m.pair.b].some(
      (x) =>
        !x.open ||
        !Number.isFinite(Date.parse(x.closeAt)) ||
        Date.parse(x.closeAt) <= wall,
    )
  )
    reasons.push("MARKET_CLOSED");
  if (!health.streamHealthy) reasons.push("STREAM_UNHEALTHY");
  if (!health.persistenceHealthy) reasons.push("PERSISTENCE_UNHEALTHY");
  if (!health.eventLoopHealthy) reasons.push("EVENT_LOOP_UNHEALTHY");
  if (!health.executionProtocolValidated)
    reasons.push("EXECUTION_PROTOCOL_UNVALIDATED");
  if (!health.feesValidated) reasons.push("LIVE_FEE_BOUND_UNVALIDATED");
  if (
    [m.pair.a, m.pair.b].some(
      (x) => !x.category || /sport|unknown/i.test(x.category),
    )
  )
    reasons.push("CATEGORY_NOT_EXECUTION_SUPPORTED");
  const bSide: Side = m.pair.inverted ? aSide : aSide === "yes" ? "no" : "yes";
  const legs: PilotLeg[] = [];
  for (const [market, book, side] of [
    [m.pair.a, a, aSide],
    [m.pair.b, b, bSide],
  ] as const) {
    const schedule = feeSchedule(market),
      acct = accounts[market.venue];
    if (!schedule) {
      reasons.push("UNKNOWN_FEES");
      continue;
    }
    if (
      !acct ||
      acct.venue !== market.venue ||
      ![
        acct.available,
        acct.cumulativeSpent,
        acct.reserved,
        acct.reconciledAt,
        acct.unresolvedOrders,
        acct.unmatchedContracts,
      ].every(finite)
    ) {
      reasons.push("INVALID_ACCOUNT_STATE");
      continue;
    }
    if (
      wall < acct.reconciledAt ||
      wall - acct.reconciledAt > p.maxAccountAgeMs
    )
      reasons.push("ACCOUNT_RECONCILIATION_REQUIRED");
    if (acct.unresolvedOrders || acct.unmatchedContracts)
      reasons.push("UNRESOLVED_EXPOSURE");
    if (
      market.minQty > p.contractsPerPair ||
      !Number.isFinite(market.minQty) ||
      market.minQty <= 0
    )
      reasons.push("MINIMUM_SIZE_UNSUPPORTED");
    try {
      // Only a fraction of visible depth is budgeted; it is not a fill guarantee.
      const usable = book[side].map((l) => ({
        ...l,
        quantity: Math.floor(l.quantity * p.maxDepthFraction),
      }));
      const quote = fill(usable, p.contractsPerPair, schedule);
      if (!quote) {
        reasons.push("INSUFFICIENT_BUFFERED_DEPTH");
        continue;
      }
      const limitPrice = Math.max(...quote.levels.map((l) => l.price));
      const modeledDebit = p.contractsPerPair * limitPrice + quote.feeUpper;
      if (
        modeledDebit + acct.reserved + acct.cumulativeSpent >
        p.capitalPerVenue
      )
        reasons.push("VENUE_LIFETIME_BUDGET_EXCEEDED");
      if (
        modeledDebit + acct.reserved + p.reservePerVenue >
        Math.min(acct.available, p.capitalPerVenue)
      )
        reasons.push("INSUFFICIENT_VENUE_CASH");
      legs.push({
        venue: market.venue,
        marketId: market.id,
        side,
        quantity: p.contractsPerPair,
        limitPrice,
        modeledDebit,
        feeUpper: quote.feeUpper,
      });
    } catch {
      reasons.push("INVALID_ORDER_BOOK");
    }
  }
  const debit = legs.reduce((n, l) => n + l.modeledDebit, 0);
  const committed = Object.values(accounts).reduce((n, a) => n + a.reserved, 0);
  if (debit > p.maxPairDebit) reasons.push("PAIR_DEBIT_LIMIT");
  if (committed + debit > p.maxCommitted)
    reasons.push("COMMITTED_CAPITAL_LIMIT");
  const modeledNet =
    legs.length === 2
      ? p.contractsPerPair * 10000 - debit - p.uncertaintyReserve
      : null;
  if (modeledNet === null || modeledNet < p.minimumNetProfit)
    reasons.push("NO_MODELED_NET_EDGE");
  return {
    mode: "PILOT_PREFLIGHT_ONLY" as const,
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    mappingId: m.id,
    ruleHashes: [m.pair.a.hash, m.pair.b.hash],
    createdAt: wall,
    expiresAt: wall + p.maxPlanAgeMs,
    quantity: p.contractsPerPair,
    legs,
    modeledNet,
    policy: p,
    interpretation:
      "Displayed liquidity and modeled net edge are not confirmed fills or realized profit. This result never submits an order.",
  };
}
