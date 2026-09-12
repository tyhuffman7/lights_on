import type { Identity } from "../research/identity.ts";
export type Venue = "kalshi" | "poly";
export type Side = "yes" | "no";
export type Level = { price: number; quantity: number };
export type Book = {
  yes: Level[];
  no: Level[];
  yesBids: Level[];
  noBids: Level[];
  receivedAt: number;
  exchangeAt: number | null;
  open: boolean;
};
export type Market = {
  id: string;
  venue: Venue;
  title: string;
  outcome: string;
  opposite: string;
  category: string;
  rules: string;
  url: string;
  closeAt: string;
  open: boolean;
  feeRate: number | null;
  feeRounding: "ceil" | "even";
  minQty: number;
  hash: string;
  settlement: number | null;
  series?: string;
  identity?: Identity;
  exchangeIndex?: number;
};
export type Pair = {
  paperApproval?: import("./paper-approval.ts").ConditionalPaperApproval;
  id: string;
  a: Market;
  b: Market;
  inverted: boolean;
  reviewed: boolean;
  reviewedAt?: number;
  notes?: string;
};
export type Settings = {
  maxTrade: number;
  maxCommitted: number;
  minProfit: number;
  minRoi: number;
  reserve: number;
  maxDays: number;
  maxAge: number;
};
export type Fill = {
  quantity: number;
  cost: number;
  fees: number;
  levels: Level[];
};
export type Quote = {
  pairId: string;
  quantity: number;
  aSide: Side;
  bSide: Side;
  aFill: Fill;
  bFill: Fill;
  cost: number;
  fees: number;
  reserve: number;
  payout: number;
  profit: number;
  roi: number;
  reasons: string[];
  eligible: boolean;
  receivedAt: number;
};
export type Position = {
  aQuantity?:number; bQuantity?:number; executionModel?:'maker-public-tape';
  makerEvidence?:{publicTradeIds:string[];initialQueueAhead:number;activeAt:number;expiresAt:number};
  id: string;
  pair: Pair;
  quote: Quote;
  openedAt: number;
  closedAt?: number;
  settlementCheckedAt?: number;
  status: "open" | "settled" | "unmatched";
  aDebit: number;
  bDebit: number;
  aPayout?: number;
  bPayout?: number;
  profit?: number;
  unwindLoss?: number;
};
export type Log = { id: string; at: number; kind: string; message: string };
export type State = {
  makerReserved?:{kalshi:number;poly:number};
  provenance?: "synthetic";
  startedAt: number | null;
  settings: Settings;
  cash: { kalshi: number; poly: number };
  positions: Position[];
  pairs: Pair[];
  logs: Log[];
  expenses: number;
  lastRun: number;
  version: number;
};
export const defaults: Settings = {
  maxTrade: 100000,
  maxCommitted: 400000,
  minProfit: 1000,
  minRoi: 1,
  reserve: 200,
  maxDays: 30,
  maxAge: 2000,
};
