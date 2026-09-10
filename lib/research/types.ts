import type { Book, Pair, Side, Fill } from "../arb/types.ts";
export type StreamBook = Book & {
  venue: "kalshi" | "poly";
  marketId: string;
  receivedMono: number;
  sequence: number | null;
  connection: "LIVE" | "DISCONNECTED" | "RECOVERING";
  valid: boolean;
  source: "stream" | "rest" | "fixture";
};
export type ResearchConfig = {
  maxAgeMs: number;
  reserve: number;
  minProfit: number;
  minRoi: number;
  bankrolls: number[];
};
export const researchDefaults: ResearchConfig = {
  maxAgeMs: 2000,
  reserve: 100,
  minProfit: 1,
  minRoi: 1,
  bankrolls: [1000000, 2500000, 5000000, 10000000],
};
export type SizeQuote = {
  quantity: number;
  aFill: Fill & { feeUpper: number };
  bFill: Fill & { feeUpper: number };
  aVwap: number;
  bVwap: number;
  cost: number;
  fees: number;
  feeUpper: number;
  reserve: number;
  payout: number;
  grossProfit: number;
  feeProfit: number;
  profit: number;
  roi: number;
  outlay: number;
};
export type Evaluation = {
  pairId: string;
  aSide: Side;
  bSide: Side;
  orientation: string;
  verified: boolean;
  reasons: string[];
  curve: SizeQuote[];
  best: SizeQuote | null;
  bestGross: SizeQuote | null;
  maxQuantity: number;
  bankroll: Record<string, SizeQuote | null>;
};
export type Verification =
  "AUTO_VERIFIED" | "MANUAL_VERIFIED" | "UNVERIFIED" | "INVALIDATED";
export type Mapping = {
  id: string;
  pair: Pair;
  status: Verification;
  active: boolean;
  reason: string | null;
  createdAt: number;
  lastVerifiedAt: number | null;
  normalized: Record<string, unknown>;
};
