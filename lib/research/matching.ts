import { catalogEntities } from "./entities.ts";
import {
  normalizeText,
  categoryName,
  generalHints,
  netflixChart,
  netWorthSource,
  announcementDeadline,
  interimService,
} from "./identity.ts";
import type { Market, Pair } from "../arb/types.ts";
import { equivalent } from "./mappings.ts";
import type { StructuredMarket } from "./mappings.ts";
export type StructuredInput = Market & {
  structured?: Partial<StructuredMarket>;
};
export type Candidate = {
  pair: Pair;
  status: "AUTO_VERIFIED" | "UNVERIFIED";
  score: number;
  reasons: string[];
  structured: { a: Partial<StructuredMarket>; b: Partial<StructuredMarket> };
};
const keys: (keyof StructuredMarket)[] = [
  "event",
  "category",
  "entity",
  "threshold",
  "comparator",
  "eventAt",
  "resolutionDeadline",
  "competition",
  "resolutionSource",
  "voidPolicy",
];
function words(s: string) {
  return new Set(
    s
      .toLowerCase()
      .replace(/bitcoin/g, "btc")
      .replace(/ethereum/g, "eth")
      .replace(/emmys/g, "emmy")
      .replace(/\b(winner|champions?|championship)\b/g, "win")
      .split(/[^a-z0-9]+/)
      .filter(
        (x) =>
          x &&
          ![
            "will",
            "win",
            "awards",
            "the",
            "be",
            "in",
            "of",
            "by",
            "a",
            "to",
            "on",
            "for",
            "is",
          ].includes(x),
      ),
  );
}
function fields(m: StructuredInput): Partial<StructuredMarket> {
  return {
    category: categoryName(m.category),
    // Administrative closeAt is not a proven resolution deadline.
    // Only explicitly extracted settlement fields may authorize equivalence.
    outcome: m.outcome,
    opposite: m.opposite,
    ...m.structured,
  };
}
export function discoverCandidates(
  kalshi: StructuredInput[],
  poly: StructuredInput[],
) {
  const diagnostics = {
    comparisons: 0,
    blockedByIndex: 0,
    comparisonLimitDeferred: 0,
    rejected: {
      structuralConflict: 0,
      insufficientSimilarity: 0,
      dateMismatch: 0,
      thresholdMismatch: 0,
      outcomeMismatch: 0,
      other: 0,
    },
    categories: {
      kalshi: {} as Record<string, number>,
      poly: {} as Record<string, number>,
    },
  };
  for (const [venue, markets] of [
    ["kalshi", kalshi],
    ["poly", poly],
  ] as const)
    for (const m of markets) {
      const c = categoryName(m.category);
      diagnostics.categories[venue][c] =
        (diagnostics.categories[venue][c] ?? 0) + 1;
    }
  const entityRegistry = catalogEntities(
    [...kalshi, ...poly].map((m) => m.identity),
  );
  const prepare = (markets: StructuredInput[]) =>
    [
      ...new Map(markets.filter((m) => m.open).map((m) => [m.id, m])).values(),
    ].map((m) => {
      const i = m.identity;
      const identity = i ? entityRegistry.normalize(i) : undefined;
      return {
        m: { ...m, identity },
        structured: fields(m),
        chart: netflixChart(m.rules),
        netWorthSource: netWorthSource(m.rules),
        announcementDeadline: announcementDeadline(m.rules),
        interimService: interimService(m.rules),
        identity,
        // Primary payout dates/concepts disambiguate generic titles. Exclude later
        // exception paragraphs and examples; preserve title-based entity/placement.
        hints: (() => {
          const title = generalHints(m);
          const primary = generalHints({
            ...m,
            title: m.rules.split(/\n|[.!?](?:\s|$)/)[0],
          });
          return {
            ...title,
            years: [...new Set([...title.years, ...primary.years])],
            concepts: [...new Set([...title.concepts, ...primary.concepts])],
          };
        })(),
        tokens: words(
          m.title + " " + m.outcome + " " + (identity?.outcome ?? ""),
        ),
      };
    });
  const lefts = prepare(kalshi),
    rights = prepare(poly);
  const index = new Map<string, number[]>();
  const blockKeys = (x: (typeof lefts)[number]) =>
    [...x.tokens]
      .filter((w) => w.length > 2 && !/^\d+$/.test(w))
      .map((w) => "word:" + categoryName(x.m.category) + ":" + w)
      .concat(
        x.identity?.participants.map(
          (p) => "participant:" + (x.identity?.competition ?? "") + ":" + p,
        ) ?? [],
      )
      .concat(
        x.identity?.eventDate
          ? [...x.tokens]
              .filter((w) => w.length > 2 && !/^\d+$/.test(w))
              .map(
                (w) =>
                  "dated:" +
                  (x.identity?.competition ?? "") +
                  ":" +
                  x.identity!.eventDate +
                  ":" +
                  w,
              )
          : [],
      )
      .concat(
        x.hints.subject
          ? ["subject:" + categoryName(x.m.category) + ":" + x.hints.subject]
          : [],
      )
      .concat(
        x.hints.location
          ? [...x.tokens].map((w) => "place:" + x.hints.location + ":" + w)
          : [],
      )
      .concat(
        x.structured.entity
          ? ["entity:" + normalizeText(x.structured.entity)]
          : [],
      );
  rights.forEach((r, n) => {
    for (const k of new Set(blockKeys(r))) {
      const ids = index.get(k) ?? [];
      ids.push(n);
      index.set(k, ids);
    }
  });
  const found: Candidate[] = [];
  for (const left of lefts) {
    const blocks = blockKeys(left)
      .map((k) => ({ k, ids: index.get(k) ?? [] }))
      .filter((x) => x.ids.length);
    blocks.sort((a, b) => a.ids.length - b.ids.length);
    const proposed = new Map<number, number>();
    // Rare-token/participant blocking bounds work independently of catalog size.
    for (const block of blocks.slice(0, 6)) {
      if (block.ids.length > 1000) {
        diagnostics.comparisonLimitDeferred += block.ids.length;
        continue;
      }
      for (const n of block.ids) proposed.set(n, (proposed.get(n) ?? 0) + 1);
    }
    const choices = [...proposed].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    diagnostics.comparisonLimitDeferred += Math.max(0, choices.length - 300);
    diagnostics.blockedByIndex += rights.length - proposed.size;
    for (const [n] of choices.slice(0, 300)) {
      const right = rights[n],
        a = left.m,
        b = right.m,
        sa = left.structured,
        sb = right.structured,
        ia = left.identity,
        ib = right.identity;
      diagnostics.comparisons++;
      const reject = (reason: keyof typeof diagnostics.rejected) => {
        diagnostics.rejected[reason]++;
      };
      if (keys.some((k) => sa[k] && sb[k] && sa[k] !== sb[k])) {
        reject("structuralConflict");
        continue;
      }
      if (
        left.chart &&
        right.chart &&
        (["rank", "region", "format", "language", "published"] as const).some(
          (k) =>
            left.chart![k] !== undefined &&
            right.chart![k] !== undefined &&
            left.chart![k] !== right.chart![k],
        )
      ) {
        reject("structuralConflict");
        continue;
      }
      if (
        left.netWorthSource &&
        right.netWorthSource &&
        left.netWorthSource !== right.netWorthSource
      ) {
        reject("structuralConflict");
        continue;
      }
      const shared = [...left.tokens].filter((w) => right.tokens.has(w)).length;
      const score =
        shared / Math.max(1, new Set([...left.tokens, ...right.tokens]).size);
      if (
        ia?.line !== undefined &&
        ib?.line !== undefined &&
        ia.line !== ib.line
      ) {
        reject("thresholdMismatch");
        continue;
      }
      let sportsIdentity = false,
        inferredInverted = false;
      const reasons: string[] = [];
      let generalIdentity = false;
      if (!ia?.sports && !ib?.sports) {
        if (
          left.announcementDeadline &&
          right.announcementDeadline &&
          left.announcementDeadline !== right.announcementDeadline
        ) {
          reject("dateMismatch");
          continue;
        }
        if (
          left.interimService &&
          right.interimService &&
          left.interimService !== right.interimService
        ) {
          reject("structuralConflict");
          continue;
        }
        const ha = left.hints,
          hb = right.hints;
        if (
          categoryName(a.category) === "politics" &&
          Boolean(ha.location) !== Boolean(hb.location)
        ) {
          reject("structuralConflict");
          continue;
        }
        if (ha.location && hb.location && ha.location !== hb.location) {
          reject("structuralConflict");
          continue;
        }
        if (ha.district !== hb.district && (ha.district || hb.district)) {
          reject("structuralConflict");
          continue;
        }
        if (
          ha.years.length &&
          hb.years.length &&
          !ha.years.some((y) => hb.years.includes(y))
        ) {
          reject("dateMismatch");
          continue;
        }
        if (
          ha.assets.length &&
          hb.assets.length &&
          ha.assets[0] !== hb.assets[0]
        ) {
          reject("structuralConflict");
          continue;
        }
        if (ha.placement !== hb.placement) {
          reject("outcomeMismatch");
          continue;
        }
        const specific = [...new Set([...ha.concepts, ...hb.concepts])];
        if (
          specific.some(
            (c) => ha.concepts.includes(c) !== hb.concepts.includes(c),
          )
        ) {
          reject("structuralConflict");
          continue;
        }
        if (ha.subject && hb.subject && ha.subject !== hb.subject) {
          reject("outcomeMismatch");
          continue;
        }
        // Numeric ladders need compatible thresholds, not merely shared event words.
        if (
          (ia?.line !== undefined || ib?.line !== undefined) &&
          ia?.line !== ib?.line
        ) {
          reject("thresholdMismatch");
          continue;
        }
        generalIdentity =
          !!(ha.subject && ha.subject === hb.subject) ||
          !!(
            ha.subject &&
            (" " + normalizeText(b.title) + " ").includes(
              " " + ha.subject + " ",
            )
          ) ||
          !!(
            hb.subject &&
            (" " + normalizeText(a.title) + " ").includes(
              " " + hb.subject + " ",
            )
          );
        const entityTokens = words(ha.subject || hb.subject);
        const context = [...left.tokens].filter(
          (w) =>
            right.tokens.has(w) &&
            !entityTokens.has(w) &&
            !/^\d+$/.test(w) &&
            !["year", "season", "outstanding", "best", "regular"].includes(w),
        );
        if (
          generalIdentity &&
          score < 0.8 &&
          context.length < 2 &&
          !(sa.event && sa.event === sb.event)
        ) {
          reject("insufficientSimilarity");
          continue;
        }
        if (!generalIdentity && !sa.entity && !sb.entity && score < 0.65) {
          reject("insufficientSimilarity");
          continue;
        }
        if (generalIdentity)
          reasons.push(
            "Same named outcome/entity in compatible event context; review settlement terms",
          );
      }

      if (ia?.sports && ib?.sports) {
        if (
          (ia.competition &&
            ib.competition &&
            ia.competition !== ib.competition) ||
          (ia.marketType && ib.marketType && ia.marketType !== ib.marketType) ||
          (ia.period && ib.period && ia.period !== ib.period) ||
          (ia.propType && ib.propType && ia.propType !== ib.propType)
        ) {
          reject("structuralConflict");
          continue;
        }
        if (ia.eventDate && ib.eventDate && ia.eventDate !== ib.eventDate) {
          const sameInstant =
            ia.eventAt &&
            ib.eventAt &&
            Math.abs(Date.parse(ia.eventAt) - Date.parse(ib.eventAt)) <=
              3 * 3600000;
          if (!sameInstant) {
            reject("dateMismatch");
            continue;
          }
        }
        if (
          (ia.line !== undefined || ib.line !== undefined) &&
          ia.line !== ib.line
        ) {
          reject("thresholdMismatch");
          continue;
        }
        const sameParticipants =
          ia.participants.length >= 2 &&
          JSON.stringify(ia.participants) === JSON.stringify(ib.participants);
        if (
          ia.participants.length >= 2 &&
          ib.participants.length >= 2 &&
          !sameParticipants
        ) {
          reject("structuralConflict");
          continue;
        }
        if (
          ia.participant &&
          ib.participant &&
          ia.participant !== ib.participant
        ) {
          reject("outcomeMismatch");
          continue;
        }
        if (ia.outcome && ib.outcome && ia.outcome !== ib.outcome) {
          if (
            sameParticipants &&
            ia.marketType === "winner" &&
            ia.participants.includes(ia.outcome) &&
            ia.participants.includes(ib.outcome)
          )
            inferredInverted = true;
          else {
            reject("outcomeMismatch");
            continue;
          }
        }
        sportsIdentity = !!(
          sameParticipants &&
          ia.eventDate &&
          ib.eventDate &&
          ia.marketType &&
          ia.marketType === ib.marketType
        );
        if (sportsIdentity)
          reasons.push(
            "Same competition/event participants, date and market type; settlement equivalence still unproven",
          );
        if (
          [
            "quarterfinal",
            "semifinal",
            "final qualifiers",
            "best regular",
            "worst regular",
            "qualify",
            "seed",
            "undefeated",
            "regular season champion",
            "relegation",
            "promotion",
            "playoffs",
            "finals",
            "leader",
            "sacks",
            "touchdowns",
          ].some(
            (c) =>
              left.hints.concepts.includes(c) !==
              right.hints.concepts.includes(c),
          )
        ) {
          reject("structuralConflict");
          continue;
        }
        if (
          ia.competition &&
          ia.competition === ib.competition &&
          ia.marketType === "future" &&
          ib.marketType === "future" &&
          ia.eventKey &&
          ib.eventKey &&
          ia.outcome &&
          ia.outcome === ib.outcome
        ) {
          const generic = new Set([
            "regular",
            "season",
            "team",
            "pro",
            "football",
            "basketball",
            "baseball",
            "nfl",
            "nba",
            "mlb",
          ]);
          const at = new Set(
              [...words(ia.eventKey)].filter((w) => !generic.has(w)),
            ),
            bt = new Set(
              [...words(ib.eventKey)].filter((w) => !generic.has(w)),
            );
          const sharedEvent = [...at].filter((w) => bt.has(w));
          const eventScore =
            sharedEvent.length / Math.max(1, new Set([...at, ...bt]).size);
          sportsIdentity = sharedEvent.length >= 1 && eventScore >= 0.5;
          if (sportsIdentity)
            reasons.push(
              "Same participant and named futures event; exceptional settlement still requires review",
            );
        }
        if (!sportsIdentity) {
          reject("insufficientSimilarity");
          continue;
        }
      } else if (sa.eventAt && sb.eventAt && sa.eventAt !== sb.eventAt) {
        reject("dateMismatch");
        continue;
      }
      const direct = equivalent(sa, sb),
        inverted = !direct && equivalent(sa, sb, true);
      const entityMatch = !!(
        sa.entity &&
        sb.entity &&
        normalizeText(sa.entity) === normalizeText(sb.entity)
      );
      // Similarity ranks within bounded blocks. Structured identity or two shared
      // distinctive terms can admit wording variants below the old 0.45 cutoff.
      if (
        !direct &&
        !inverted &&
        !sportsIdentity &&
        !generalIdentity &&
        !entityMatch &&
        !(shared >= 2 && score >= 0.12) &&
        score < 0.45
      ) {
        reject("insufficientSimilarity");
        continue;
      }
      reasons.push(
        ...(direct || inverted
          ? []
          : [
              "Full structured settlement equivalence not proven; manual review required",
            ]),
      );
      reasons.push(
        `Indexed text overlap ${shared}; Jaccard ${score.toFixed(3)}`,
      );
      found.push({
        pair: {
          id: `${a.id}::${b.id}`,
          a,
          b,
          inverted: inverted || inferredInverted,
          reviewed: false,
        },
        status: direct || inverted ? "AUTO_VERIFIED" : "UNVERIFIED",
        score: score + (sportsIdentity ? 1 : 0),
        reasons,
        structured: { a: sa, b: sb },
      });
    }
  }
  return {
    candidates: found.sort(
      (a, b) => b.score - a.score || a.pair.id.localeCompare(b.pair.id),
    ),
    diagnostics,
  };
}
export function matchCandidates(
  kalshi: StructuredInput[],
  poly: StructuredInput[],
): Candidate[] {
  return discoverCandidates(kalshi, poly).candidates;
}
