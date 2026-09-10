import type { ResearchStore } from "./store.ts";
import type {
  StreamBook,
  SizeQuote,
  Evaluation,
  ResearchConfig,
} from "./types.ts";
import type { Pair, Side, Market } from "../arb/types.ts";
import { fresh } from "./books.ts";
import { fill } from "./detector.ts";
import { feeSchedule } from "./fees.ts";
export const latencyBuckets = [0, 50, 100, 150, 250, 500, 1000, 2000];
export type LatencyStatus =
  | "SURVIVED"
  | "SECOND_LEG_GONE"
  | "EDGE_BELOW_THRESHOLD"
  | "DEPTH_GONE"
  | "MARKET_CLOSED"
  | "BOOK_STALE";
function asof(
  s: ResearchStore,
  session: string,
  venue: string,
  id: string,
  mono: number,
): { id: number; book: StreamBook } | null {
  const row = s.db
    .prepare(
      "SELECT id,body FROM book_updates WHERE session_id=? AND venue=? AND market_id=? AND mono<=? ORDER BY mono DESC,id DESC LIMIT 1",
    )
    .get(session, venue, id, mono) as { id: number; body: string } | undefined;
  return row ? { id: row.id, book: JSON.parse(row.body) } : null;
}
export function firstQualifying(s: ResearchStore, opportunityId: string) {
  const rows = s.db
    .prepare(
      "SELECT * FROM opportunity_states WHERE opportunity_id=? ORDER BY mono,id",
    )
    .all(opportunityId) as Record<string, any>[];
  for (const r of rows) {
    const e = JSON.parse(r.body) as Evaluation;
    if (e.verified && e.reasons.length === 0)
      return {
        id: Number(r.id),
        at: Number(r.at),
        mono: Number(r.mono),
        aBookId: Number(r.a_book_id),
        bBookId: Number(r.b_book_id),
        e,
      };
  }
  return null;
}
export function latencyCase(
  pair: Pair,
  e: Evaluation,
  q: SizeQuote,
  firstVenue: "kalshi" | "poly",
  a: StreamBook | undefined,
  b: StreamBook | undefined,
  mono: number,
  wall: number,
  config: ResearchConfig,
  coverage: boolean,
) {
  const firstA = firstVenue === "kalshi",
    firstMarket = firstA ? pair.a : pair.b,
    hedgeMarket = firstA ? pair.b : pair.a;
  const firstBook = firstA ? a : b,
    hedgeBook = firstA ? b : a,
    firstSide = firstA ? e.aSide : e.bSide,
    hedgeSide = firstA ? e.bSide : e.aSide;
  const firstFill = firstA ? q.aFill : q.bFill,
    quotedHedge = firstA ? q.bFill : q.aFill;
  const firstFees = firstFill.feeUpper;
  const firstCost = firstFill.cost + firstFees,
    limit = Math.max(...quotedHedge.levels.map((l) => l.price));
  let status: LatencyStatus = "SURVIVED";
  const schedule = feeSchedule(hedgeMarket),
    fs = feeSchedule(firstMarket);
  const hedge =
    hedgeBook && schedule
      ? fill(hedgeBook[hedgeSide], q.quantity, schedule)
      : null;
  if (
    !coverage ||
    !schedule ||
    !fs ||
    !fresh(firstBook, mono, wall, config.maxAgeMs) ||
    !fresh(hedgeBook, mono, wall, config.maxAgeMs)
  )
    status = "BOOK_STALE";
  else if (
    !firstBook!.open ||
    !hedgeBook!.open ||
    [pair.a, pair.b].some((m) => Date.parse(m.closeAt) <= wall)
  )
    status = "MARKET_CLOSED";
  else if (!hedge) status = "DEPTH_GONE";
  else if (hedge.levels.some((l) => l.price > limit))
    status = "SECOND_LEG_GONE";
  const newOutlay = hedge
    ? firstCost + hedge.cost + hedge.feeUpper + q.reserve
    : null;
  if (
    status === "SURVIVED" &&
    newOutlay !== null &&
    (q.payout - newOutlay < config.minProfit ||
      ((q.payout - newOutlay) / newOutlay) * 100 < config.minRoi)
  )
    status = "EDGE_BELOW_THRESHOLD";
  // Fixed-limit all-or-none hedge model. Partial IOC unwind is explicit; residual
  // shares remain exposed and cannot be reported as a fully realized P&L.
  const shouldUnwind = status !== "SURVIVED";
  let unwind: {
    quantity: number;
    remainingQuantity: number;
    proceeds: number;
    fees: number;
    firstLegCost: number;
    realizedLoss: number | null;
    sufficientDepth: boolean;
    levels: unknown[];
  } | null = null;
  if (
    shouldUnwind &&
    firstBook?.open &&
    fs &&
    fresh(firstBook, mono, wall, config.maxAgeMs) &&
    coverage
  ) {
    const levels = firstSide === "yes" ? firstBook.yesBids : firstBook.noBids;
    const available = Math.min(
      q.quantity,
      levels.reduce((n, l) => n + Math.floor(l.quantity), 0),
    );
    const u = available > 0 ? fill(levels, available, fs, true) : null;
    const proceeds = u ? u.cost - u.feeUpper : 0;
    unwind = {
      quantity: available,
      remainingQuantity: q.quantity - available,
      proceeds,
      fees: u?.feeUpper ?? 0,
      firstLegCost: firstCost,
      realizedLoss: available === q.quantity ? firstCost - proceeds : null,
      sufficientDepth: available === q.quantity,
      levels: u?.levels ?? [],
    };
  }
  return {
    status,
    targetQuantity: q.quantity,
    firstVenue,
    hedgeLimit: limit,
    firstLegCost: firstCost,
    hedge: status === "SURVIVED" ? hedge : null,
    attemptedHedge: hedge,
    profit:
      status === "SURVIVED" && newOutlay !== null
        ? q.payout - newOutlay
        : unwind?.sufficientDepth
          ? -unwind.realizedLoss!
          : null,
    unwind,
    observationComplete: coverage,
    model:
      "fixed-limit all-or-none hedge; partial IOC unwind; conservative fee bounds",
    targetMono: mono,
  };
}
export function analyzeLatency(
  s: ResearchStore,
  sessionId: string,
  observedThroughMono: number,
  final = true,
  batchLimit = -1,
  batchOffset = 0,
) {
  const ops = s.db
    .prepare(
      "SELECT * FROM opportunities WHERE session_id=? AND (SELECT COUNT(*) FROM latency_tests l WHERE l.opportunity_id=opportunities.id)<16 ORDER BY first_mono LIMIT ? OFFSET ?",
    )
    .all(sessionId, batchLimit, batchOffset) as Record<string, any>[];
  for (const op of ops) {
    const start = firstQualifying(s, op.id);
    if (!start) continue;
    const meta = JSON.parse(op.body) as { pair: Pair; config: ResearchConfig };
    // The baseline is a $100 bankroll split equally, sized at first qualification.
    const q = start.e.bankroll["1000000"];
    if (!q || q.profit < meta.config.minProfit || q.roi < meta.config.minRoi)
      continue;
    for (const latency of latencyBuckets) {
      const target = start.mono + latency,
        wall = start.at + latency,
        coverage = observedThroughMono >= target;
      if (!coverage && !final) continue;
      const a = asof(s, sessionId, "kalshi", meta.pair.a.id, target),
        b = asof(s, sessionId, "poly", meta.pair.b.id, target);
      const changes = s.db
        .prepare(
          "SELECT body FROM mapping_history WHERE pair_id=? AND at>? AND at<=?",
        )
        .all(op.pair_id, start.at, wall) as { body: string }[];
      const mappingValid = !changes.some((r) => {
        const m = JSON.parse(r.body);
        return (
          !m.active ||
          !["AUTO_VERIFIED", "MANUAL_VERIFIED"].includes(m.status) ||
          m.pair.inverted !== meta.pair.inverted ||
          m.pair.a.hash !== meta.pair.a.hash ||
          m.pair.b.hash !== meta.pair.b.hash
        );
      });
      for (const first of ["kalshi", "poly"] as const) {
        const result = latencyCase(
          meta.pair,
          start.e,
          q,
          first,
          a?.book,
          b?.book,
          target,
          wall,
          meta.config,
          coverage && mappingValid,
        );
        s.db
          .prepare(
            "INSERT OR IGNORE INTO latency_tests(opportunity_id,latency_ms,first_venue,status,body) VALUES(?,?,?,?,?)",
          )
          .run(
            op.id,
            latency,
            first,
            result.status,
            JSON.stringify({
              ...result,
              aBookId: a?.id ?? null,
              bBookId: b?.id ?? null,
              startingStateId: start.id,
            }),
          );
      }
    }
  }
  return ops.length;
}
