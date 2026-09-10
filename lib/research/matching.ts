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
    category:
      (
        { entertainment: "culture", elections: "politics" } as Record<
          string,
          string
        >
      )[m.category.toLowerCase()] ?? m.category.toLowerCase(),
    // Administrative closeAt is not a proven resolution deadline.
    // Only explicitly extracted settlement fields may authorize equivalence.
    outcome: m.outcome,
    opposite: m.opposite,
    ...m.structured,
  };
}
export function matchCandidates(
  kalshi: StructuredInput[],
  poly: StructuredInput[],
): Candidate[] {
  const found: Candidate[] = [];
  for (const a of kalshi)
    for (const b of poly) {
      if (!a.open || !b.open) continue;
      const sa = fields(a),
        sb = fields(b);
      // Reject known structural conflicts before spending effort on text. Missing
      // structured fields remain review requirements, never inferred equality.
      if (keys.some((k) => sa[k] && sb[k] && sa[k] !== sb[k])) continue;
      const at = words(a.title + " " + a.outcome),
        bt = words(b.title + " " + b.outcome),
        shared = [...at].filter((x) => bt.has(x)).length;
      const score = shared / Math.max(1, new Set([...at, ...bt]).size);
      const direct = equivalent(sa, sb),
        inverted = !direct && equivalent(sa, sb, true);
      if (!direct && !inverted && score < 0.45) continue;
      found.push({
        pair: { id: `${a.id}::${b.id}`, a, b, inverted, reviewed: false },
        status: direct || inverted ? "AUTO_VERIFIED" : "UNVERIFIED",
        score,
        reasons:
          direct || inverted
            ? []
            : [
                "Full structured settlement equivalence not proven; manual review required",
              ],
        structured: { a: sa, b: sb },
      });
    }
  return found.sort((a, b) => b.score - a.score);
}
