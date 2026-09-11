// Read-only affordability sweep; no network, credentials, order transport or fills.
import { writeFileSync } from "node:fs";
import { ResearchStore } from "../lib/research/store.ts";
import { matchCandidates } from "../lib/research/matching.ts";
import { affordableSizes } from "../lib/pilot/size-research.ts";
const [source, output, scope = "initial"] = process.argv.slice(2);
if (!["initial", "full"].includes(scope))
  throw Error("Unknown research sizing scope");
const fullPilotBudget = scope === "full";
if (!source || !output)
  throw Error("Usage: pilot-size-audit.ts SOURCE_DB OUTPUT_JSON");
const store = new ResearchStore(source, true);
try {
  const bestByPair = new Map<string, any>();
  let states = 0,
    matchingIntervals = 0;
  for (const op of store.db
    .prepare("SELECT * FROM opportunities")
    .iterate() as Iterable<any>) {
    const meta = JSON.parse(op.body);
    if (
      !matchCandidates([meta.pair.a], [meta.pair.b]).some(
        (c) => c.pair.inverted === meta.pair.inverted,
      )
    )
      continue;
    matchingIntervals++;
    for (const row of store.db
      .prepare(
        "SELECT * FROM opportunity_states WHERE opportunity_id=? ORDER BY mono,id",
      )
      .iterate(op.id) as Iterable<any>) {
      const saved = JSON.parse(row.body);
      const a = store.db
          .prepare("SELECT body FROM book_updates WHERE id=?")
          .get(row.a_book_id) as any,
        b = store.db
          .prepare("SELECT body FROM book_updates WHERE id=?")
          .get(row.b_book_id) as any;
      if (!a || !b) throw Error("Missing saved books");
      states++;
      const sizes = affordableSizes(
        meta.pair,
        JSON.parse(a.body),
        JSON.parse(b.body),
        saved.aSide,
        row.at,
        row.mono,
        fullPilotBudget,
      );
      for (const q of sizes.filter((q) => q.modeledNet >= 100)) {
        const key = op.pair_id + ":" + op.orientation + ":" + q.quantity;
        const old = bestByPair.get(key);
        if (!old || q.modeledNet > old.modeledNet)
          bestByPair.set(key, {
            pairId: op.pair_id,
            orientation: op.orientation,
            at: row.at,
            ...q,
          });
      }
    }
  }
  const report = {
    at: new Date().toISOString(),
    mode: "RESEARCH_SIZE_SWEEP",
    matchingIntervals,
    states,
    maximumContracts: fullPilotBudget ? 200 : 10,
    maximumCombinedDebitUSD: fullPilotBudget ? 180 : 10,
    depthFraction: 0.25,
    reservePerContractUSD: 0.01,
    positivePairSizes: [...bestByPair.values()].sort(
      (a, b) => b.modeledNet - a.modeledNet,
    ),
    submittedOrders: 0,
    confirmedFills: 0,
    interpretation:
      "Best observed historical states with assumed funds and both fills; not executable plans, independent earning events, arrival checks, or realized profit. Current matching is required, settlement equivalence remains unverified. Prices and fee estimates are based on recorded depth. Live one-contract pilot limits are unchanged.",
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      matchingIntervals,
      states,
      positivePairSizes: report.positivePairSizes.length,
      best: report.positivePairSizes[0] ?? null,
    }),
  );
} finally {
  store.close();
}
