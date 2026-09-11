// Historical, read-only capital-fit audit. No credential access, network, or orders.
import { replayCapital } from "../lib/pilot/capital-replay.ts";
import { writeFileSync } from "node:fs";
import { ResearchStore } from "../lib/research/store.ts";
import { pilotPolicy, pilotPreflight } from "../lib/pilot/preflight.ts";
import { arrivalEvidence } from "../lib/pilot/timing.ts";
import { matchCandidates } from "../lib/research/matching.ts";
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
      bestFresh: any = null,
      firstFresh: any = null;
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
            occupiedMarkets: [],
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
        !firstFresh &&
        result.modeledNet !== null &&
        result.reasons.every((r) => launchOnly.includes(r))
      )
        firstFresh = {
          plan: result,
          mono: row.mono,
          wall: row.at,
          stateId: row.id,
        };
      if (
        result.modeledNet !== null &&
        (best === null || result.modeledNet > best.modeledNet)
      )
        best = result;
    }
    for (const r of reasons) blockers[r] = (blockers[r] ?? 0) + 1;
    if (best?.modeledNet >= pilotPolicy.minimumNetProfit) positive++;
    if (bestFresh) freshPositive++;
    const timing = firstFresh
      ? [
          [100, 100],
          [100, 250],
          [250, 100],
          [250, 250],
          [500, 500],
        ].map(([ka, po]) => {
          const arrivals = [meta.pair.a, meta.pair.b].map(
            (market: any, i: number) => {
              const delay = i === 0 ? ka : po,
                mono = firstFresh.mono + delay;
              const row = store.db
                .prepare(
                  "SELECT body FROM book_updates WHERE session_id=? AND venue=? AND market_id=? AND mono<=? ORDER BY mono DESC,id DESC LIMIT 1",
                )
                .get(op.session_id, market.venue, market.id, mono) as any;
              return {
                book: row ? JSON.parse(row.body) : undefined,
                wall: firstFresh.wall + delay,
                mono,
                covered: op.last_mono >= mono,
              };
            },
          );
          return {
            kalshiDelayMs: ka,
            polyDelayMs: po,
            ...arrivalEvidence(meta.pair, firstFresh.plan, arrivals as any),
          };
        })
      : [];
    candidates.push({
      timingFromFirstPositiveState: firstFresh
        ? {
            stateId: firstFresh.stateId,
            limitLegs: firstFresh.plan.legs,
            at: firstFresh.wall,
            scenarios: timing,
          }
        : null,
      matchesCurrentDiscovery: matchCandidates(
        [meta.pair.a],
        [meta.pair.b],
      ).some((c) => c.pair.inverted === meta.pair.inverted),
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
  const timingSummary: Record<string, Record<string, number>> = {};
  for (const c of candidates.filter((c) => c.matchesCurrentDiscovery))
    for (const t of c.timingFromFirstPositiveState?.scenarios ?? []) {
      const key = `${t.kalshiDelayMs}/${t.polyDelayMs}`;
      timingSummary[key] ??= {};
      timingSummary[key][t.status] = (timingSummary[key][t.status] ?? 0) + 1;
    }
  const report = {
    timingSummary,
    capitalScenarios: Object.fromEntries(
      Object.keys(timingSummary).map((key) => [
        key,
        replayCapital(
          candidates
            .filter(
              (c) =>
                c.matchesCurrentDiscovery && c.timingFromFirstPositiveState,
            )
            .map((c) => ({
              id: c.mappingId + ":" + c.orientation,
              at: c.timingFromFirstPositiveState.at,
              legs: c.timingFromFirstPositiveState.limitLegs,
              displayedBoth: c.timingFromFirstPositiveState.scenarios.some(
                (t: any) =>
                  `${t.kalshiDelayMs}/${t.polyDelayMs}` === key &&
                  t.status === "BOTH_DISPLAYED_AVAILABLE",
              ),
            })),
        ),
      ]),
    ),
    timingInterpretation:
      "Fixed limits at the first positive state, not the best later quote. Delay is hypothetical send-to-arrival time. Cases beyond the recorded opportunity interval are censored. Displayed depth after a 75% haircut is not a fill or queue-position guarantee. All candidates remain unverified; results are not live-eligible or earnings.",
    at: new Date().toISOString(),
    policy: pilotPolicy,
    opportunities: candidates.length,
    statesAudited: states,
    opportunitiesWithPositiveStandaloneOneContractModel: positive,
    freshPositiveStandaloneModels: freshPositive,
    positiveEventsStillMatching: candidates.filter(
      (c) => c.freshPositiveModelAtRecordedTime && c.matchesCurrentDiscovery,
    ).length,
    remainingReviewPairs: [
      ...new Map(
        candidates
          .filter(
            (c) =>
              c.freshPositiveModelAtRecordedTime && c.matchesCurrentDiscovery,
          )
          .sort((a, b) => a.bestFreshModeledNetUSD - b.bestFreshModeledNetUSD)
          .map((c) => [c.mappingId, c]),
      ).values(),
    ].sort((a, b) => b.bestFreshModeledNetUSD - a.bestFreshModeledNetUSD),
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
      "Historical standalone scenarios using assumed $100 cash per venue, not actual account balances or fills. Fees are model estimates, live fee bounds and execution protocol are unvalidated. Positive model values are not earnings, independent opportunities, or approval; conditional capital-scenario sums are not realized profit or monthly income. Verification is frozen as observed; every live launch blocker remains enforced.",
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
