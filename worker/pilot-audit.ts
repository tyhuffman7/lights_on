// Historical, read-only capital-fit audit. No credential access, network, or orders.
import { writeFileSync } from "node:fs";
import { ResearchStore } from "../lib/research/store.ts";
import { pilotPolicy, pilotPreflight } from "../lib/pilot/preflight.ts";
const [source, output] = process.argv.slice(2);
if (!source || !output)
  throw new Error("Usage: pilot-audit.ts SOURCE_DB OUTPUT_JSON");
const store = new ResearchStore(source, true);
try {
  const candidates: any[] = [];
  const blockers: Record<string, number> = {};
  let states = 0,
    positive = 0,
    freshPositive = 0,
    eligible = 0;
  for (const op of store.db
    .prepare("SELECT * FROM opportunities")
    .iterate() as Iterable<any>) {
    const meta = JSON.parse(op.body);
    let best: any = null,
      bestFresh: any = null;
    const reasons = new Set<string>();
    for (const row of store.db
      .prepare(
        "SELECT * FROM opportunity_states WHERE opportunity_id=? ORDER BY mono,id",
      )
      .iterate(op.id) as Iterable<any>) {
      const aa = store.db
        .prepare("SELECT body FROM book_updates WHERE id=?")
        .get(row.a_book_id) as any;
      const bb = store.db
        .prepare("SELECT body FROM book_updates WHERE id=?")
        .get(row.b_book_id) as any;
      if (!aa || !bb) throw new Error("Missing historical book evidence");
      const saved = JSON.parse(row.body);
      const accounts = Object.fromEntries(
        (["kalshi", "poly"] as const).map((venue) => [
          venue,
          {
            venue,
            available: pilotPolicy.capitalPerVenue,
            cumulativeSpent: 0,
            reserved: 0,
            reconciledAt: row.at,
            unresolvedOrders: 0,
            unmatchedContracts: 0,
          },
        ]),
      ) as any;
      const result = pilotPreflight({
        mapping: {
          id: op.pair_id,
          pair: meta.pair,
          status: meta.verification,
          active: true,
          reason: null,
          createdAt: op.first_seen_at,
          lastVerifiedAt: meta.pair.reviewedAt ?? null,
          metadataAt: op.first_seen_at,
          normalized: {},
        },
        a: JSON.parse(aa.body),
        b: JSON.parse(bb.body),
        aSide: saved.aSide,
        accounts,
        wall: row.at,
        mono: row.mono,
        health: {
          streamHealthy: true,
          persistenceHealthy: true,
          eventLoopHealthy: true,
          executionProtocolValidated: false,
          feesValidated: false,
        },
      });
      states++;
      if (result.eligible) eligible++;
      for (const r of result.reasons) reasons.add(r);
      const launchOnly = [
        "RULE_EQUIVALENCE_UNVERIFIED",
        "APPROVAL_EVIDENCE_MISSING",
        "EXECUTION_PROTOCOL_UNVALIDATED",
        "LIVE_FEE_BOUND_UNVALIDATED",
        "CATEGORY_NOT_EXECUTION_SUPPORTED",
      ];
      if (
        result.modeledNet !== null &&
        result.reasons.every((r) => launchOnly.includes(r)) &&
        (!bestFresh || result.modeledNet > bestFresh.modeledNet)
      )
        bestFresh = result;
      if (
        result.modeledNet !== null &&
        (best === null || result.modeledNet > best.modeledNet)
      )
        best = result;
    }
    for (const r of reasons) blockers[r] = (blockers[r] ?? 0) + 1;
    if (best?.modeledNet >= pilotPolicy.minimumNetProfit) positive++;
    if (bestFresh) freshPositive++;
    candidates.push({
      mappingId: op.pair_id,
      orientation: op.orientation,
      title: meta.pair.a.title,
      verificationAtObservation: meta.verification,
      firstSeenAt: op.first_seen_at,
      modeledNetPerOneContractUSD:
        best?.modeledNet === null || !best ? null : best.modeledNet / 10000,
      freshPositiveModelAtRecordedTime: !!bestFresh,
      bestFreshModeledNetUSD: bestFresh?.modeledNet / 10000 || null,
      reviewEvidence: bestFresh
        ? { pair: meta.pair, preflight: bestFresh }
        : null,
      blockers: [...reasons],
      legs: best?.legs ?? [],
    });
  }
  const report = {
    at: new Date().toISOString(),
    policy: pilotPolicy,
    opportunities: candidates.length,
    statesAudited: states,
    opportunitiesWithPositiveStandaloneOneContractModel: positive,
    freshPositiveStandaloneModels: freshPositive,
    eligibleStates: eligible,
    blockersByOpportunity: blockers,
    freshPositiveModelExamples: candidates
      .filter((c) => c.freshPositiveModelAtRecordedTime)
      .slice(0, 25),
    topStandaloneModels: candidates
      .filter((c) => c.modeledNetPerOneContractUSD !== null)
      .sort(
        (a, b) => b.modeledNetPerOneContractUSD - a.modeledNetPerOneContractUSD,
      )
      .slice(0, 25),
    interpretation:
      "Historical standalone scenarios using assumed $100 cash per venue, not actual account balances or fills. Fees are model estimates, live fee bounds and execution protocol are unvalidated. Positive model values are not earnings, independent opportunities, or approval; no profit sum or monthly extrapolation is valid. Verification is frozen as observed; every live launch blocker remains enforced.",
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        opportunities: report.opportunities,
        states: states,
        positiveStandaloneModels: positive,
        freshPositiveStandaloneModels: freshPositive,
        eligibleStates: eligible,
        blockers,
      },
      null,
      2,
    ),
  );
} finally {
  store.close();
}
