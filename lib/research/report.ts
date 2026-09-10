import { Depth, sizes } from "./sizing.ts";
import { feeSchedule } from "./fees.ts";
import type { ResearchStore } from "./store.ts";
import { firstQualifying, latencyBuckets } from "./latency.ts";
import type { SizeQuote, Evaluation } from "./types.ts";
function quantile(xs: number[], p: number) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b),
    i = (s.length - 1) * p,
    lo = Math.floor(i),
    hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
function summary(xs: number[]) {
  return { count: xs.length, average: mean(xs), median: quantile(xs, 0.5) };
}
export function researchReport(s: ResearchStore, sessionId: string) {
  const session = s.db
    .prepare("SELECT * FROM sessions WHERE id=?")
    .get(sessionId) as Record<string, any> | undefined;
  if (!session) throw new Error("Unknown session");
  const ops = s.db
    .prepare(
      "SELECT * FROM opportunities WHERE session_id=? ORDER BY first_mono",
    )
    .all(sessionId) as Record<string, any>[];
  const states = ops.map((op) => ({
    op,
    states: (
      s.db
        .prepare(
          "SELECT body FROM opportunity_states WHERE opportunity_id=? ORDER BY mono",
        )
        .all(op.id) as { body: string }[]
    ).map((x) => JSON.parse(x.body) as Evaluation),
    qualified: firstQualifying(s, op.id),
  }));
  const qualifying = states.filter((x) => x.qualified);
  const closed: number[] = [];
  let censored = 0;
  const intervals: {
    opportunityId: string;
    startMono: number;
    endMono: number;
    durationMs: number;
    censored: boolean;
  }[] = [];
  for (const op of ops) {
    const timeline = s.db
      .prepare(
        "SELECT mono,body FROM opportunity_states WHERE opportunity_id=? ORDER BY mono,id",
      )
      .all(op.id) as { mono: number; body: string }[];
    let start: number | null = null,
      lastGood = 0;
    for (const row of timeline) {
      const e = JSON.parse(row.body) as Evaluation & {
        endReason?: string | null;
      };
      const good = e.verified && e.reasons.length === 0;
      if (good) {
        if (start === null) start = row.mono;
        lastGood = row.mono;
      } else if (start !== null) {
        const uncertain =
          e.reasons.includes("BOOK_STALE") ||
          e.reasons.includes("MAPPING_UNVERIFIED") ||
          !!e.endReason;
        const end = uncertain ? lastGood : row.mono;
        intervals.push({
          opportunityId: op.id,
          startMono: start,
          endMono: end,
          durationMs: end - start,
          censored: uncertain,
        });
        if (uncertain) censored++;
        else closed.push(end - start);
        start = null;
      }
    }
    if (start !== null) {
      censored++;
      intervals.push({
        opportunityId: op.id,
        startMono: start,
        endMono: lastGood,
        durationMs: lastGood - start,
        censored: true,
      });
    }
  }
  const latency = s.db
    .prepare(
      "SELECT l.* FROM latency_tests l JOIN opportunities o ON o.id=l.opportunity_id WHERE o.session_id=?",
    )
    .all(sessionId) as Record<string, any>[];
  const survival: Record<string, any> = {},
    byFirstVenue: Record<string, any> = {};
  for (const first of ["kalshi", "poly"]) {
    const buckets: Record<string, any> = {};
    for (const n of latencyBuckets) {
      const rows = latency
        .filter((x) => x.first_venue === first && x.latency_ms === n)
        .map((r) => ({ status: String(r.status), data: JSON.parse(r.body) }));
      const covered = rows.filter((x) => x.data.observationComplete),
        valid = covered.filter((x) => x.status !== "BOOK_STALE");
      const wins = valid.filter((x) => x.status === "SURVIVED");
      buckets[n] = {
        rate: valid.length ? wins.length / valid.length : null,
        survived: wins.length,
        evaluable: valid.length,
        bookStale: covered.length - valid.length,
        unobserved: rows.length - covered.length,
        statusCounts: Object.fromEntries(
          [...new Set(rows.map((x) => x.status))].map((status) => [
            status,
            rows.filter((x) => x.status === status).length,
          ]),
        ),
        profit:
          valid.length && !valid.some((x) => x.data.profit === null)
            ? valid.reduce((n, x) => n + x.data.profit, 0)
            : null,
        unresolvedExposure: valid.filter((x) => x.data.profit === null).length,
      };
    }
    byFirstVenue[first] = buckets;
  }
  Object.assign(survival, byFirstVenue);
  const bests = qualifying.map((x) => x.qualified!.e.best!).filter(Boolean);
  // One-entry-per-opportunity upper bound; no summation of every update.
  const theoreticalProfit = qualifying.reduce(
    (n, x) =>
      n +
      Math.max(
        0,
        ...x.states
          .filter((e) => e.verified && e.reasons.length === 0)
          .map((e) => e.best?.profit ?? 0),
      ),
    0,
  );
  const capitalConstrained: Record<string, any> = {};
  for (const dollars of [100, 250, 500, 1000]) {
    let cashA = (dollars * 10000) / 2,
      cashB = cashA,
      profit = 0,
      entries = 0;
    const held: { until: number; a: number; b: number; markets: string[] }[] =
      [];
    for (const x of qualifying) {
      const start = x.qualified!,
        meta = JSON.parse(x.op.body),
        time = start.at;
      for (let i = held.length - 1; i >= 0; i--)
        if (held[i].until <= time) {
          cashA += held[i].a;
          cashB += held[i].b;
          held.splice(i, 1);
        }
      const markets = [`kalshi:${meta.pair.a.id}`, `poly:${meta.pair.b.id}`];
      if (held.some((h) => h.markets.some((m) => markets.includes(m))))
        continue;
      const readBook = (id: number) => {
        const row = s.db
          .prepare("SELECT body FROM book_updates WHERE id=?")
          .get(id) as { body: string } | undefined;
        return row ? JSON.parse(row.body) : null;
      };
      const aBook = readBook(start.aBookId),
        bBook = readBook(start.bBookId),
        af = feeSchedule(meta.pair.a),
        bf = feeSchedule(meta.pair.b);
      const q =
        aBook &&
        bBook &&
        af &&
        bf &&
        start.e.maxQuantity > 0 &&
        start.e.maxQuantity <= 1000000
          ? sizes(
              new Depth(aBook[start.e.aSide], af),
              new Depth(bBook[start.e.bSide], bf),
              Math.max(
                1,
                Math.ceil(meta.pair.a.minQty),
                Math.ceil(meta.pair.b.minQty),
              ),
              start.e.maxQuantity,
              { ...meta.config, bankrolls: [dollars * 10000] },
              { [dollars * 10000]: { a: cashA, b: cashB } },
            ).bankroll[dollars * 10000]
          : null;
      if (q && (q.profit < meta.config.minProfit || q.roi < meta.config.minRoi))
        continue;
      if (!q) continue;
      cashA -=
        q.aFill.cost +
        (q.aFill.feeUpper ?? q.aFill.fees) +
        Math.ceil(q.reserve / 2);
      cashB -=
        q.bFill.cost +
        (q.bFill.feeUpper ?? q.bFill.fees) +
        Math.floor(q.reserve / 2);
      profit += q.profit;
      entries++;
      // Conservatively lock capital until settlement. Do not assume where the
      // payout lands or reinvest theoretical winnings into a venue balance.
      held.push({ until: Number.POSITIVE_INFINITY, a: 0, b: 0, markets });
    }
    capitalConstrained[dollars] = {
      profit,
      entries,
      remainingCash: cashA + cashB,
      model:
        "chronological, equal starting venue cash, no settlement reinvestment, shared-market exclusion",
    };
  }
  const breakdown: Record<
    string,
    Record<string, { opportunities: number; profit: number }>
  > = {
    orientation: {},
    category: {},
    utcHour: {},
    timeUntilSettlement: {},
    priceRange: {},
    duration: {},
  };
  for (const x of qualifying) {
    const meta = JSON.parse(x.op.body),
      q = x.qualified!.e.best!,
      days = (Date.parse(meta.pair.a.closeAt) - x.op.first_seen_at) / 86400000;
    const keys = {
      orientation: x.op.orientation,
      category: meta.category,
      utcHour: String(new Date(x.op.first_seen_at).getUTCHours()),
      timeUntilSettlement:
        days < 1 ? "under 1 day" : days < 7 ? "1–7 days" : "7+ days",
      priceRange:
        q.aVwap < 2500 ? "under 25c" : q.aVwap < 7500 ? "25–75c" : "75c+",
      duration:
        x.op.status !== "CLOSED"
          ? "censored"
          : x.op.duration_ms < 100
            ? "under 100ms"
            : x.op.duration_ms < 500
              ? "100–500ms"
              : "500ms+",
    };
    for (const [field, key] of Object.entries(keys)) {
      const group = breakdown[field][key] ?? { opportunities: 0, profit: 0 };
      group.opportunities++;
      group.profit += q.profit;
      breakdown[field][key] = group;
    }
  }
  const orphan: Record<string, any> = {};
  for (const first of ["kalshi", "poly"]) {
    const rows = latency
      .filter((x) => x.first_venue === first && x.latency_ms === 500)
      .map((x) => ({ status: String(x.status), data: JSON.parse(x.body) }))
      .filter((x) => x.data.observationComplete && x.status !== "BOOK_STALE");
    orphan[first] = {
      latencyMs: 500,
      evaluable: rows.length,
      rate: rows.length
        ? rows.filter((x) => x.status !== "SURVIVED").length / rows.length
        : null,
      losses: rows
        .filter((x) => x.data.unwind?.sufficientDepth)
        .reduce((n, x) => n + Math.max(0, x.data.unwind.realizedLoss), 0),
      unresolved: rows.filter((x) => x.data.profit === null).length,
      netExpectedProfit:
        !rows.length || rows.some((x) => x.data.profit === null)
          ? null
          : rows.reduce((n, x) => n + x.data.profit, 0),
    };
  }
  return {
    schemaVersion: 2,
    sessionId,
    dataMode: session.mode,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    bookUpdates: s.db
      .prepare("SELECT COUNT(*) AS n FROM book_updates WHERE session_id=?")
      .get(sessionId)!.n,
    opportunitiesDetected: ops.length,
    ruleVerifiedOpportunities: states.filter((x) =>
      x.states.some((e) => e.verified),
    ).length,
    rawDiscrepancyCount: ops.length,
    grossArbCount: states.filter((x) =>
      x.states.some(
        (e) =>
          e.verified &&
          !e.reasons.some((r) => r !== "EDGE_BELOW_THRESHOLD") &&
          (e.bestGross?.grossProfit ?? 0) > 0,
      ),
    ).length,
    feePositiveArbCount: states.filter((x) =>
      x.states.some(
        (e) =>
          e.verified &&
          !e.reasons.some((r) => r !== "EDGE_BELOW_THRESHOLD") &&
          e.curve.some((q) => q.feeProfit > 0),
      ),
    ).length,
    netOnePercentCount: qualifying.filter((x) =>
      x.states.some((e) => e.reasons.length === 0 && (e.best?.roi ?? 0) >= 1),
    ).length,
    lifetime: {
      closedCount: closed.length,
      censoredCount: censored,
      definition:
        "Continuous rule-verified intervals above configured net-profit and ROI thresholds",
      intervals,
      p10: quantile(closed, 0.1),
      p50: quantile(closed, 0.5),
      p90: quantile(closed, 0.9),
    },
    survival,
    byFirstVenue,
    theoreticalProfit,
    capitalConstrained,
    latencyAdjustedProfit: Object.fromEntries(
      ["kalshi", "poly"].map((v) => [
        v,
        {
          100: byFirstVenue[v][100],
          250: byFirstVenue[v][250],
          500: byFirstVenue[v][500],
        },
      ]),
    ),
    executableRoi: summary(bests.map((q) => q.roi)),
    executableQuantity: summary(bests.map((q) => q.quantity)),
    executableDollarProfit: summary(bests.map((q) => q.profit / 10000)),
    orphan,
    breakdown,
    units:
      "money in integer 1/10000 USD except executableDollarProfit; ROI in percent; durations in ms",
    limitations: [
      "Displayed-depth model; no proof of fills or queue priority.",
      "Kalshi per-level fee estimate with whole-contract fragmentation upper bound; PM cumulative rounded fee upper bound.",
      "Survival baseline uses first qualifying $100 hedge; missing/stale observations excluded from rate denominator.",
      "Theoretical totals are independent opportunity upper bounds; latency profit is not a reusable-bankroll return.",
      "Capital scenarios lock funds for the session and exclude shared markets; settlement payouts/reinvestment are not inferred.",
      "Censored and open lifetimes excluded from lifetime percentiles.",
    ],
  };
}
