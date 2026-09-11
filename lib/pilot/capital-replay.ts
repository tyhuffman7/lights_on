import { pilotPolicy } from "./preflight.ts";
import type { PilotLeg } from "./preflight.ts";
export type CapitalEvent = {
  at: number;
  id: string;
  displayedBoth: boolean;
  legs: PilotLeg[];
};
// Counterfactual inventory only. Never credits settlement, exits, deposits or fills.
export function replayCapital(events: CapitalEvent[]) {
  const cash = {
    kalshi: pilotPolicy.capitalPerVenue,
    poly: pilotPolicy.capitalPerVenue,
  };
  const used = new Set<string>();
  let committed = 0,
    modeledNet = 0;
  const accepted: {
    id: string;
    at: number;
    debit: number;
    modeledNet: number;
    legs: PilotLeg[];
  }[] = [];
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
  };
  for (const e of [...events].sort(
    (a, b) => a.at - b.at || a.id.localeCompare(b.id),
  )) {
    if (!e.displayedBoth) {
      skip("INSUFFICIENT_TWO_LEG_DISPLAY");
      continue;
    }
    if (
      !Number.isFinite(e.at) ||
      !e.id ||
      e.legs.length !== 2 ||
      new Set(e.legs.map((l) => l.venue)).size !== 2 ||
      e.legs.some(
        (l) =>
          !["kalshi", "poly"].includes(l.venue) ||
          !l.marketId ||
          !["yes", "no"].includes(l.side) ||
          !Number.isSafeInteger(l.limitPrice) ||
          l.limitPrice <= 0 ||
          l.limitPrice >= 10000 ||
          !Number.isSafeInteger(l.feeUpper) ||
          l.feeUpper < 0 ||
          l.modeledDebit !== l.limitPrice + l.feeUpper ||
          l.quantity !== 1 ||
          !Number.isSafeInteger(l.modeledDebit) ||
          l.modeledDebit <= 0,
      )
    ) {
      skip("INVALID_EVENT");
      continue;
    }
    const ids = e.legs.map((l) => l.venue + ":" + l.marketId);
    if (ids.some((id) => used.has(id))) {
      skip("INVENTORY_ALREADY_HELD");
      continue;
    }
    const debit = e.legs.reduce((n, l) => n + l.modeledDebit, 0),
      net = 10000 - debit - pilotPolicy.uncertaintyReserve;
    if (
      net < pilotPolicy.minimumNetProfit ||
      debit > pilotPolicy.maxPairDebit
    ) {
      skip("NO_LIMIT_PRICE_EDGE");
      continue;
    }
    if (committed + debit > pilotPolicy.maxCommitted) {
      skip("COMMITTED_CAPITAL_LIMIT");
      continue;
    }
    if (
      e.legs.some(
        (l) => cash[l.venue] - l.modeledDebit < pilotPolicy.reservePerVenue,
      )
    ) {
      skip("VENUE_CASH_LIMIT");
      continue;
    }
    for (const l of e.legs) cash[l.venue] -= l.modeledDebit;
    ids.forEach((id) => used.add(id));
    committed += debit;
    modeledNet += net;
    accepted.push({
      id: e.id,
      at: e.at,
      debit,
      modeledNet: net,
      legs: e.legs.map((l) => ({ ...l })),
    });
  }
  return {
    mode: "COUNTERFACTUAL_CAPITAL_ONLY",
    accepted,
    skipped,
    cash,
    committed,
    conditionalModeledNet: modeledNet,
    confirmedFills: 0,
    realizedProfit: 0,
    interpretation:
      "Assumes both displayed legs could execute at the original limits and contracts settle complementarily. Neither assumption is proven. This isolates capital policy, not launch readiness: the current live-intent ledger is stricter and halts new entries while any filled inventory remains. Capital remains tied up; repeated markets are excluded; no exits, settlement proceeds or monthly earnings are credited.",
  };
}
