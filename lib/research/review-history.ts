import type { ResearchStore } from "./store.ts";
import type { ResearchActivity } from "./review.ts";
// Read only. Opening metadata freezes the original verification state forever.
export function historicalDiscrepancies(
  store: ResearchStore,
  sessionId?: string,
) {
  const groups = new Map<string, any>();
  const ops = store.db
    .prepare(
      "SELECT * FROM opportunities" +
        (sessionId ? " WHERE session_id=?" : "") +
        " ORDER BY first_seen_at",
    )
    .all(...(sessionId ? [sessionId] : [])) as Record<string, any>[];
  const median = (a: number[]) => {
    const s = [...a].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : null;
  };
  for (const op of ops) {
    const meta = JSON.parse(op.body),
      key = op.pair_id + "|" + op.orientation;
    const g = groups.get(key) ?? {
      id: op.pair_id,
      category: meta.category,
      competition: meta.pair.a.identity?.competition ?? null,
      sports: !!meta.pair.a.identity?.sports,
      orientation: op.orientation,
      occurrences: 0,
      unverifiedOccurrences: 0,
      censored: 0,
      firstAt: op.first_seen_at,
      lastAt: op.last_seen_at,
      edges: [],
      profits: [],
      durations: [],
      quantities: [],
      ages: [],
    };
    g.occurrences++;
    if (
      meta.verification === "UNVERIFIED" ||
      meta.verification === "INVALIDATED"
    )
      g.unverifiedOccurrences++;
    g.lastAt = Math.max(g.lastAt, op.last_seen_at);
    if (op.status === "CLOSED") g.durations.push(op.duration_ms);
    else g.censored++;
    for (const row of store.db
      .prepare(
        "SELECT body FROM opportunity_states WHERE opportunity_id=? ORDER BY mono",
      )
      .all(op.id) as { body: string }[]) {
      const e = JSON.parse(row.body),
        q = e.bestGross;
      if (!q || q.grossProfit <= 0) continue;
      g.edges.push(q.grossProfit / q.quantity / 10000);
      g.profits.push(q.grossProfit / 10000);
      g.quantities.push(q.quantity);
      if (e.bookAges) g.ages.push(Math.max(e.bookAges.a, e.bookAges.b));
    }
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({
    id: g.id,
    category: g.category,
    competition: g.competition,
    sports: g.sports,
    orientation: g.orientation,
    occurrences: g.occurrences,
    unverifiedOccurrences: g.unverifiedOccurrences,
    censored: g.censored,
    firstAt: g.firstAt,
    lastAt: g.lastAt,
    maxGrossEdgePerContractUSD: g.edges.length ? Math.max(...g.edges) : null,
    medianGrossEdgePerContractUSD: median(g.edges),
    maxGrossProfitUSD: g.profits.length ? Math.max(...g.profits) : null,
    medianGrossProfitUSD: median(g.profits),
    medianDurationMs: median(g.durations),
    medianQuantity: median(g.quantities),
    medianWorstBookAgeMs: median(g.ages),
    stateSamples: g.edges.length,
    occurrencesPerObservedHour:
      g.lastAt > g.firstAt
        ? (g.occurrences * 3600000) / (g.lastAt - g.firstAt)
        : null,
  }));
}
export function historicalActivity(
  store: ResearchStore,
): Record<string, ResearchActivity> {
  const out: Record<string, ResearchActivity> = {};
  // Counts are sufficient for online priority; full state analysis is an explicit offline export.
  for (const row of store.db
    .prepare("SELECT pair_id,COUNT(*) n FROM opportunities GROUP BY pair_id")
    .all() as any[])
    out[row.pair_id] = { count: Number(row.n) };
  return out;
}
