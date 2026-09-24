// Isolated hosted-PMXT research. No write or trading method belongs in this module.
import { fill } from "./detector.ts";
import type { FeeSchedule } from "./fees.ts";
import type { Level } from "../arb/types.ts";

export const TARGET_VENUES = ["kalshi", "polymarket_us"] as const;
export const PAGE_SIZE = 500; // PMXT's documented per-page maximum.
export const MAX_BOOK_AGE_MS = 2_000;
export const PAPER_CASH_PER_VENUE = 1_000_000; // $100 in Lights On's 1/10000 USD units.
export const PAPER_RESERVE_PER_CONTRACT = 100; // $0.01, deliberately visible.

export type PmxtOutcome = { outcomeId: string; label: string; price?: number };
export type PmxtMarket = {
  marketId: string;
  sourceExchange: string;
  title: string;
  slug?: string;
  eventId?: string;
  category?: string;
  description?: string;
  resolutionDate?: Date | string;
  outcomes: PmxtOutcome[];
  sourceMetadata?: Record<string, unknown>;
};
export type MatchEdge = {
  marketAId: string;
  marketBId: string;
  relation: string;
  confidence: number;
  [key: string]: unknown;
};
export type PmxtCluster = {
  clusterId: string;
  canonicalTitle: string | null;
  category?: string | null;
  relations: string[];
  confidence: number;
  markets: PmxtMarket[];
  rawMatches?: MatchEdge[];
  [key: string]: unknown;
};
export type ClusterQuery = {
  relation: "identity";
  minConfidence: number;
  venues: string;
  minVenues: number;
  includeRawMatches: true;
  withOrderbook: boolean;
  sort: "volume";
  limit: number;
  offset: number;
};
export type ClusterReader = { fetchMatchedMarketClusters(params: ClusterQuery): Promise<unknown> };

export function clusterQuery(withOrderbook: boolean, offset: number): ClusterQuery {
  if (!Number.isSafeInteger(offset) || offset < 0) throw Error("INVALID_OFFSET");
  return {
    relation: "identity", minConfidence: 0.8,
    venues: TARGET_VENUES.join(","), // REST expects one comma-separated value.
    minVenues: 2, includeRawMatches: true, withOrderbook,
    sort: "volume", limit: PAGE_SIZE, offset,
  };
}

function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function validCluster(v: unknown): v is PmxtCluster {
  if (!record(v) || typeof v.clusterId !== "string" || !v.clusterId ||
      !Number.isFinite(v.confidence) || Number(v.confidence) < 0 || Number(v.confidence) > 1 ||
      !Array.isArray(v.relations) || !v.relations.every(x => typeof x === "string") ||
      !Array.isArray(v.markets) || !v.markets.every(m =>
        record(m) && typeof m.marketId === "string" && !!m.marketId &&
        typeof m.sourceExchange === "string" && typeof m.title === "string" &&
        Array.isArray(m.outcomes) && m.outcomes.every(o =>
          record(o) && typeof o.outcomeId === "string" && typeof o.label === "string")) ||
      (v.rawMatches !== undefined && (!Array.isArray(v.rawMatches) || !v.rawMatches.every(e =>
        record(e) && typeof e.marketAId === "string" && typeof e.marketBId === "string" &&
        typeof e.relation === "string" && Number.isFinite(e.confidence))))) return false;
  return true;
}

export async function fetchAllClusters(
  reader: ClusterReader, withOrderbook: boolean,
  beforeCall: () => Promise<void> = async () => {},
): Promise<PmxtCluster[]> {
  const found: PmxtCluster[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    await beforeCall();
    const page = await reader.fetchMatchedMarketClusters(clusterQuery(withOrderbook, offset));
    if (!Array.isArray(page) || page.length > PAGE_SIZE || !page.every(validCluster))
      throw Error("MALFORMED_PMXT_RESPONSE");
    for (const cluster of page) {
      if (seen.has(cluster.clusterId)) throw Error("PAGINATION_DRIFT");
      seen.add(cluster.clusterId);
      found.push(cluster);
    }
    if (page.length < PAGE_SIZE) return found;
    if (!Number.isSafeInteger(offset + PAGE_SIZE)) throw Error("PAGINATION_OVERFLOW");
  }
}

export function classifyCluster(cluster: PmxtCluster) {
  const kalshi = cluster.markets.filter(m => m.sourceExchange === "kalshi");
  const pmUs = cluster.markets.filter(m => m.sourceExchange === "polymarket_us");
  const international = cluster.markets.filter(m => m.sourceExchange === "polymarket");
  const targetContaining = kalshi.length > 0 && pmUs.length > 0;
  const internationalContaining = kalshi.length > 0 && international.length > 0;
  const directIdentityEdges = (cluster.rawMatches ?? []).filter(e =>
    e.relation === "identity" && e.confidence >= 0.8 &&
    ((kalshi.some(m => m.marketId === e.marketAId) && pmUs.some(m => m.marketId === e.marketBId)) ||
     (kalshi.some(m => m.marketId === e.marketBId) && pmUs.some(m => m.marketId === e.marketAId))));
  return {
    kalshi, pmUs, international, targetContaining, internationalContaining,
    directIdentityEdges,
    qualifiedIdentity: targetContaining && cluster.relations.includes("identity") &&
      cluster.confidence >= 0.8 && directIdentityEdges.length > 0,
  };
}

function rules(m: PmxtMarket): string | null {
  // A description is not a full settlement rule. Only an explicit rules field qualifies.
  const value = m.sourceMetadata?.rules;
  return typeof value === "string" && value.trim() ? value : null;
}
export function identityFinding(cluster: PmxtCluster): string {
  const x = classifyCluster(cluster);
  if (!x.targetContaining) return "NOT_TARGET_VENUES";
  if (!x.qualifiedIdentity) return "NO_DIRECT_TARGET_IDENTITY_EDGE";
  if (x.kalshi.length !== 1 || x.pmUs.length !== 1) return "AMBIGUOUS_TARGET_MARKETS";
  if (!rules(x.kalshi[0]) || !rules(x.pmUs[0])) return "PMXT_IDENTITY_UNVERIFIED_MISSING_RULES";
  // Lights On's assessSettlement never grants strict equivalence from inline rules alone.
  return "PMXT_IDENTITY_UNVERIFIED_REQUIRES_SETTLEMENT_REVIEW";
}

export function binaryOutcomes(m: PmxtMarket): { yes: PmxtOutcome; no: PmxtOutcome } | null {
  const yes = m.outcomes.filter(o => o.label.trim().toLowerCase() === "yes");
  const no = m.outcomes.filter(o => o.label.trim().toLowerCase() === "no");
  return yes.length === 1 && no.length === 1 && yes[0].outcomeId !== no[0].outcomeId
    ? { yes: yes[0], no: no[0] } : null;
}

export type ResearchBook = { bids: Level[]; asks: Level[]; exchangeAt: number; receivedAt: number };
function level(v: unknown): Level | null {
  if (!record(v) || typeof v.price !== "number" || typeof v.size !== "number" ||
      !Number.isFinite(v.price) || !Number.isFinite(v.size) || v.size < 0) return null;
  const price = Math.round(v.price * 10000);
  if (price <= 0 || price >= 10000 || Math.abs(v.price * 10000 - price) > 1e-7) return null;
  return { price, quantity: Math.floor(v.size) };
}
export function parseFreshBook(v: unknown, receivedAt: number, maxAgeMs = MAX_BOOK_AGE_MS): ResearchBook | null {
  if (!record(v) || !Number.isSafeInteger(v.timestamp) || !Array.isArray(v.bids) || !Array.isArray(v.asks)) return null;
  const exchangeAt = Number(v.timestamp);
  if (exchangeAt > receivedAt + 1000 || receivedAt - exchangeAt > maxAgeMs) return null;
  const bids = v.bids.map(level), asks = v.asks.map(level);
  if (bids.some(x => x === null) || asks.some(x => x === null)) return null;
  const b = (bids as Level[]).filter(x => x.quantity > 0).sort((a, b) => b.price - a.price);
  const a = (asks as Level[]).filter(x => x.quantity > 0).sort((x, y) => x.price - y.price);
  if (!a.length || (b.length && b[0].price >= a[0].price)) return null;
  if (new Set(a.map(x => x.price)).size !== a.length || new Set(b.map(x => x.price)).size !== b.length) return null;
  return { bids: b, asks: a, exchangeAt, receivedAt };
}

export type PaperQuote = {
  quantity: number; maxDepthQuantity: number; kalshiCost: number; pmUsCost: number;
  fees: number; feeUpper: number; reserve: number; payout: number;
  grossProfit: number; feeProfit: number; netProfit: number; roi: number;
  kalshiLevels: Level[]; pmUsLevels: Level[];
};
export function evaluateDirection(
  kalshiBook: ResearchBook, pmUsBook: ResearchBook,
  kalshiFee: FeeSchedule, pmUsFee: FeeSchedule,
  cashPerVenue = PAPER_CASH_PER_VENUE,
  reservePerContract = PAPER_RESERVE_PER_CONTRACT,
): { maxDepthQuantity: number; best: PaperQuote | null; positiveGross: boolean; positiveFee: boolean; positiveNet: boolean } {
  const maxDepthQuantity = Math.min(
    kalshiBook.asks.reduce((n, x) => n + x.quantity, 0),
    pmUsBook.asks.reduce((n, x) => n + x.quantity, 0));
  let best: PaperQuote | null = null, positiveGross = false, positiveFee = false, positiveNet = false;
  // The observed depth is reported separately; the small-capital paper scan has a finite work cap.
  for (let q = 1; q <= Math.min(maxDepthQuantity, 1000); q++) {
    const a = fill(kalshiBook.asks, q, kalshiFee);
    const b = fill(pmUsBook.asks, q, pmUsFee);
    if (!a || !b) break;
    const reserve = q * reservePerContract;
    if (a.cost + a.feeUpper + Math.ceil(reserve / 2) > cashPerVenue ||
        b.cost + b.feeUpper + Math.floor(reserve / 2) > cashPerVenue) break;
    const cost = a.cost + b.cost, fees = a.fees + b.fees, feeUpper = a.feeUpper + b.feeUpper;
    const payout = q * 10000, grossProfit = payout - cost;
    const feeProfit = grossProfit - fees, netProfit = grossProfit - feeUpper - reserve;
    const outlay = cost + feeUpper + reserve;
    const quote: PaperQuote = {
      quantity: q, maxDepthQuantity, kalshiCost: a.cost, pmUsCost: b.cost,
      fees, feeUpper, reserve, payout, grossProfit, feeProfit, netProfit,
      roi: outlay ? netProfit / outlay * 100 : 0,
      kalshiLevels: a.levels, pmUsLevels: b.levels,
    };
    positiveGross ||= grossProfit > 0;
    positiveFee ||= feeProfit > 0;
    positiveNet ||= netProfit > 0;
    if (!best || quote.netProfit > best.netProfit) best = quote;
  }
  return { maxDepthQuantity, best, positiveGross, positiveFee, positiveNet };
}

export function safeFailure(error: unknown): "RATE_LIMIT" | "AUTH" | "API_FAILURE" {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b429\b|too many requests|rate.?limit|quota/i.test(message)) return "RATE_LIMIT";
  if (/\b40[13]\b|unauthori[sz]ed|invalid api key|forbidden/i.test(message)) return "AUTH";
  return "API_FAILURE";
}
export function redactJson(value: unknown, key: string): string {
  const encoded = JSON.stringify(value);
  return key ? encoded.replaceAll(key, "[REDACTED]") : encoded;
}

// A cycle never begins just because its scheduled next start crossed the deadline.
export function nextCycleDelay(now: number, cycleStart: number, deadline: number, intervalMs: number): number | null {
  if (now >= deadline || cycleStart + intervalMs >= deadline) return null;
  const remaining = cycleStart + intervalMs - now;
  return remaining > 0 ? remaining : intervalMs;
}
