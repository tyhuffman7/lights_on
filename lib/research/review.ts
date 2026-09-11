import type { Mapping } from "./types.ts";
import type { Market } from "../arb/types.ts";
import { catalogEntities } from "./entities.ts";
import { generalHints } from "./identity.ts";
export type ResearchActivity = {
  count?: number;
  priorCount?: number;
  persistedBaseline?: number;
  maxGross?: number;
  medianGross?: number;
  updates?: number;
  depth?: number;
};
const clauses = (rules: string, pattern: RegExp) =>
  rules.split(/(?<=[.!?])\s+|\n+/).filter((s) => pattern.test(s));
function evidence(m: Market, registry: ReturnType<typeof catalogEntities>) {
  const i = m.identity ? registry.normalize(m.identity) : undefined;
  const sources: string[] = [];
  for (const line of m.rules.split(/\n+/)) {
    try {
      const value = JSON.parse(line);
      if (Array.isArray(value))
        for (const source of value)
          if (
            typeof source?.name === "string" &&
            typeof source?.url === "string"
          )
            sources.push(`${source.name}: ${source.url}`);
    } catch {
      /* Ordinary rule prose is not structured source metadata. */
    }
  }
  return {
    title: m.title,
    yes: m.outcome,
    no: m.opposite,
    url: m.url,
    ruleHash: m.hash,
    canonical: i ?? null,
    general: generalHints(m),
    eventDate: i?.eventDate ?? null,
    administrativeCloseAt: m.closeAt,
    rules: m.rules,
    settlementSource: [
      ...sources,
      ...clauses(m.rules, /source|according to|as reported|determined by/i),
    ],
    outcomeLabelWarning:
      m.outcome === m.opposite
        ? "Venue metadata repeats the same YES/NO label. Verify the actual payout definitions in the full rules."
        : null,
    referencedDocuments: [
      ...new Set(
        m.rules.match(/https?:\/\/[^\s"<>]+\.pdf(?:\?[^\s"<>]*)?/gi) ?? [],
      ),
    ],
    referencedDocumentStatus:
      "Linked external documents are not extracted here; inspect them before approval.",
    cancellation: clauses(
      m.rules,
      /void|cancel|postpon|abandon|reschedul|not started|fair market price/i,
    ),
    tie: clauses(m.rules, /\btie\b|\bdraw\b|\$0\.50/i),
    overtime: clauses(m.rules, /overtime|extra innings|regulation/i),
    retirement: clauses(m.rules, /retire|walkover|disqualif/i),
  };
}
export function reviewPackage(
  m: Mapping,
  activity: ResearchActivity = {},
  now = Date.now(),
  registry = catalogEntities([m.pair.a.identity, m.pair.b.identity]),
) {
  const a = evidence(m.pair.a, registry),
    b = evidence(m.pair.b, registry);
  const match: string[] = [],
    differ: string[] = [],
    unknown: string[] = [];
  const compare = (key: string, x: unknown, y: unknown) => {
    if (
      x === undefined ||
      y === undefined ||
      x === null ||
      y === null ||
      x === "" ||
      y === "" ||
      (Array.isArray(x) && !x.length) ||
      (Array.isArray(y) && !y.length)
    )
      unknown.push(key);
    else (JSON.stringify(x) === JSON.stringify(y) ? match : differ).push(key);
  };
  for (const key of [
    "sport",
    "competition",
    "eventDate",
    "eventAt",
    "season",
    "home",
    "away",
    "participants",
    "participant",
    "marketType",
    "line",
    "period",
    "propType",
    "units",
    "outcome",
  ] as const)
    compare(key, a.canonical?.[key], b.canonical?.[key]);
  for (const key of [
    "person",
    "event",
    "company",
    "ticker",
    "asset",
    "jurisdiction",
    "indicator",
    "window",
  ] as const)
    compare(
      "canonical." + key,
      a.canonical?.general?.[key],
      b.canonical?.general?.[key],
    );
  for (const key of [
    "subject",
    "placement",
    "location",
    "years",
    "assets",
    "district",
    "concepts",
    "numbers",
  ] as const)
    compare("general." + key, a.general[key], b.general[key]);
  for (const key of [
    "settlementSource",
    "cancellation",
    "tie",
    "overtime",
    "retirement",
  ] as const)
    compare(key, a[key], b[key]);
  compare("rules", a.rules, b.rules);
  const structural = differ.filter((k) =>
    [
      "sport",
      "competition",
      "eventDate",
      "season",
      "home",
      "away",
      "participants",
      "participant",
      "marketType",
      "line",
      "period",
      "propType",
      "units",
      "canonical.person",
      "canonical.event",
      "canonical.company",
      "canonical.ticker",
      "canonical.asset",
      "canonical.jurisdiction",
      "canonical.indicator",
      "canonical.window",
      "general.location",
      "general.assets",
      "general.district",
      "general.placement",
    ].includes(k),
  );
  if (!m.pair.inverted && differ.includes("outcome"))
    structural.push("outcome");
  let score =
    match.filter(
      (k) =>
        ![
          "rules",
          "settlementSource",
          "cancellation",
          "tie",
          "overtime",
          "retirement",
        ].includes(k),
    ).length * 8;
  score +=
    Math.min(15, Math.log2(1 + (activity.count ?? 0)) * 3) +
    Math.min(10, Math.log2(1 + (activity.depth ?? 0))) +
    Math.min(5, Math.log2(1 + (activity.updates ?? 0)));
  const days =
    (Math.min(Date.parse(m.pair.a.closeAt), Date.parse(m.pair.b.closeAt)) -
      now) /
    86400000;
  if (days > 0 && days < 30) score += 5;
  if (structural.length) score = -100 - structural.length;
  const status = structural.length
    ? "STRUCTURAL_CONFLICT"
    : !a.rules.trim() || !b.rules.trim()
      ? "INSUFFICIENT_RULE_DATA"
      : score >= 40
        ? "HIGH_PRIORITY_REVIEW"
        : "REVIEW_REQUIRED";
  return {
    id: m.id,
    verification: m.status,
    active: m.active,
    alreadyReviewed: !!m.pair.reviewed,
    category: m.pair.a.category,
    sports: !!m.pair.a.identity?.sports,
    competition: a.canonical?.competition,
    score,
    status,
    relationship: m.pair.inverted ? "INVERTED" : "DIRECT",
    outcomeReview: m.pair.inverted
      ? "Confirm tie, draw, void and retirement states remain complementary."
      : "Confirm both YES and NO definitions agree.",
    match,
    differ,
    unknown,
    structural,
    kalshi: a,
    poly: b,
    activity,
    discoveryReasoning: m.normalized,
    approval:
      "Human review and current rule-hash refresh required; priority never verifies a mapping.",
  };
}
export function reviewQueue(
  mappings: Mapping[],
  activity: Record<string, ResearchActivity> = {},
  now = Date.now(),
) {
  const registry = catalogEntities(
    mappings.flatMap((m) => [m.pair.a.identity, m.pair.b.identity]),
  );
  return mappings
    .map((m) => reviewPackage(m, activity[m.id], now, registry))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
