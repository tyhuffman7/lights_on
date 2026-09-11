import { writeFileSync, mkdirSync } from "node:fs";
import { ResearchStore } from "../lib/research/store.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import {
  historicalDiscrepancies,
  historicalActivity,
} from "../lib/research/review-history.ts";
import { reviewQueue } from "../lib/research/review.ts";
const path = process.argv[2] ?? "research-data/research.sqlite",
  out = process.argv[3] ?? "work/sustained";
mkdirSync(out, { recursive: true });
const store = new ResearchStore(path, true);
try {
  const summaries = historicalDiscrepancies(store),
    activity = historicalActivity(store);
  const queue = reviewQueue(new MappingRegistry(store).list(), activity);
  const historical = queue.filter((r) => (r.activity.count ?? 0) > 0);
  const ranked = historical
    .filter((r) => r.status !== "STRUCTURAL_CONFLICT")
    .concat(historical.filter((r) => r.status === "STRUCTURAL_CONFLICT"))
    .slice(0, 40);
  const sessions = store.db
    .prepare(
      "SELECT id,started_at,ended_at,(SELECT COUNT(*) FROM opportunities WHERE session_id=sessions.id) rawCount FROM sessions ORDER BY started_at",
    )
    .all();
  const result = {
    at: new Date().toISOString(),
    interpretation:
      "Review priorities only. No retrospective verification or realized profit. Historical rules may differ from current metadata; refresh before approval.",
    sessions,
    rawSummaries: summaries,
    queueCounts: queue.reduce(
      (n: Record<string, number>, r) => (
        (n[r.status] = (n[r.status] ?? 0) + 1),
        n
      ),
      {},
    ),
    topCandidates: ranked.map(({ kalshi, poly, ...r }) => ({
      ...r,
      kalshiTitle: kalshi.title,
      polyTitle: poly.title,
    })),
    packages: ranked.slice(0, 10),
  };
  writeFileSync(
    out + "/review-evidence.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      sessions: sessions.length,
      rawOccurrences: summaries.reduce((n, s) => n + s.occurrences, 0),
      mappingOrientations: summaries.length,
      reviewCandidates: ranked.length,
      packages: result.packages.length,
      queueCounts: result.queueCounts,
    }),
  );
} finally {
  store.close();
}
