import type { Market, Pair } from "../arb/types.ts";
import type { Mapping, Verification } from "./types.ts";
import type { ResearchStore } from "./store.ts";
export type StructuredMarket = {
  event: string;
  category: string;
  entity: string;
  outcome: string;
  opposite: string;
  threshold: string;
  comparator: string;
  eventAt: string;
  resolutionDeadline: string;
  competition: string;
  resolutionSource: string;
  voidPolicy: string;
};
const fields: (keyof StructuredMarket)[] = [
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
export function equivalent(
  a: Partial<StructuredMarket>,
  b: Partial<StructuredMarket>,
  inverted = false,
) {
  // These must be populated by reviewed, venue-specific structured parsers; never
  // fill missing fields from fuzzy text or an LLM to manufacture equivalence.
  if (
    [...fields, "outcome", "opposite"].some(
      (k) =>
        typeof a[k as keyof StructuredMarket] !== "string" ||
        !a[k as keyof StructuredMarket]?.trim() ||
        typeof b[k as keyof StructuredMarket] !== "string" ||
        !b[k as keyof StructuredMarket]?.trim(),
    )
  )
    return false;
  if (fields.some((k) => a[k] !== b[k])) return false;
  return inverted
    ? a.outcome === b.opposite && a.opposite === b.outcome
    : a.outcome === b.outcome && a.opposite === b.opposite;
}
export class MappingRegistry {
  store: ResearchStore;
  cache = new Map<string, Mapping>();
  persist: ((m: Mapping, at: number) => void) | null = null;
  constructor(store: ResearchStore) {
    this.store = store;
    for (const row of store.rows("mappings")) {
      const m = JSON.parse(row.body);
      this.cache.set(m.id, m);
    }
  }
  list(): Mapping[] {
    return [...this.cache.values()];
  }
  get(id: string) {
    return this.cache.get(id);
  }
  private save(m: Mapping, at: number) {
    if (this.persist) this.persist(m, at);
    else
      this.store.transaction(() => {
        this.store.db
          .prepare(
            "INSERT INTO mappings(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
          )
          .run(m.id, JSON.stringify(m));
        this.store.db
          .prepare("INSERT INTO mapping_history(pair_id,at,body) VALUES(?,?,?)")
          .run(m.id, at, JSON.stringify(m));
      });
    this.cache.set(m.id, m);
    return m;
  }
  add(
    pair: Pair,
    at = Date.now(),
    normalized: Record<string, unknown> = {},
  ): Mapping {
    const old = this.get(pair.id);
    if (old) return this.refresh(pair.id, pair.a, pair.b, at, pair.inverted);
    if (pair.a.venue !== "kalshi" || pair.b.venue !== "poly")
      throw new Error("Unsupported mapping venues");
    return this.save(
      {
        id: pair.id,
        pair: { ...pair, reviewed: false },
        status: "UNVERIFIED",
        active: true,
        reason: null,
        createdAt: at,
        metadataAt: at,
        lastVerifiedAt: null,
        normalized,
      },
      at,
    );
  }
  verify(
    id: string,
    status: Extract<Verification, "AUTO_VERIFIED" | "MANUAL_VERIFIED">,
    evidence: string,
    at = Date.now(),
    structured?: { a: StructuredMarket; b: StructuredMarket },
  ) {
    const m = this.get(id);
    if (!m) throw new Error("Unknown mapping");
    if (
      !evidence.trim() ||
      [m.pair.a, m.pair.b].some((x) => !x.rules.trim() || !x.hash || !x.open)
    )
      throw new Error("Missing verification evidence");
    if (
      status === "AUTO_VERIFIED" &&
      (!structured || !equivalent(structured.a, structured.b, m.pair.inverted))
    )
      throw new Error("Structured equivalence not proven");
    return this.save(
      {
        ...m,
        status,
        active: true,
        reason: null,
        lastVerifiedAt: at,
        pair: { ...m.pair, reviewed: true, reviewedAt: at, notes: evidence },
        normalized: structured ? { ...structured } : m.normalized,
      },
      at,
    );
  }
  refresh(
    id: string,
    a: Market,
    b: Market,
    at = Date.now(),
    inverted?: boolean,
  ) {
    const m = this.get(id);
    if (!m) throw new Error("Unknown mapping");
    if (at < (m.metadataAt ?? m.createdAt)) return m;
    const orientation = inverted ?? m.pair.inverted;
    const changed =
      a.hash !== m.pair.a.hash ||
      b.hash !== m.pair.b.hash ||
      orientation !== m.pair.inverted ||
      a.id !== m.pair.a.id ||
      b.id !== m.pair.b.id;
    if (
      !changed &&
      JSON.stringify(a) === JSON.stringify(m.pair.a) &&
      JSON.stringify(b) === JSON.stringify(m.pair.b) &&
      m.reason !== "METADATA_UNAVAILABLE"
    ) {
      const fresh = { ...m, metadataAt: at };
      this.cache.set(id, fresh);
      return fresh;
    }
    return this.save(
      {
        ...m,
        metadataAt: at,
        pair: {
          ...m.pair,
          a,
          b,
          inverted: orientation,
          reviewed: !changed && m.pair.reviewed,
        },
        status: changed ? "INVALIDATED" : m.status,
        active: changed
          ? false
          : m.reason === "METADATA_UNAVAILABLE" && m.status !== "INVALIDATED"
            ? true
            : m.active,
        reason: changed
          ? "Settlement-relevant metadata changed"
          : m.reason === "METADATA_UNAVAILABLE" && m.status !== "INVALIDATED"
            ? null
            : m.reason,
      },
      at,
    );
  }
  reactivate(id: string, expectedReason: string, at = Date.now()) {
    const m = this.get(id);
    if (!m || m.reason !== expectedReason || m.status === "INVALIDATED")
      return m;
    return this.save({ ...m, active: true, reason: null }, at);
  }
  deactivate(id: string, reason: string, at = Date.now()) {
    const m = this.get(id);
    if (!m) throw new Error("Unknown mapping");
    return this.save({ ...m, active: false, reason }, at);
  }
}
export function isVerified(m: Mapping) {
  return m.active && ["AUTO_VERIFIED", "MANUAL_VERIFIED"].includes(m.status);
}
