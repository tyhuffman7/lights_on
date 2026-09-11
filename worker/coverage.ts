import {
  getJSON,
  normalizeKalshi,
  normalizePoly,
} from "../lib/arb/adapters.ts";
import { discoverCandidates } from "../lib/research/matching.ts";
import type { MappingRegistry } from "../lib/research/mappings.ts";
import type { Market } from "../lib/arb/types.ts";
export async function catalog(
  request = getJSON,
  signal?: AbortSignal,
  progress: (x: any) => void = () => {},
) {
  const at = Date.now();
  const kalshi: Market[] = [],
    poly: Market[] = [],
    errors: string[] = [];
  const K = "https://external-api.kalshi.com/trade-api/v2",
    P = "https://gateway.polymarket.us/v1";
  let kalshiPages = 0,
    polyPages = 0;
  const reportProgress = () =>
    progress({
      kalshi: kalshi.length,
      poly: poly.length,
      kalshiPages,
      polyPages,
      errors: [...errors],
    });
  const stopped = () => {
    if (signal?.aborted) throw new Error("Catalog cancelled");
  };
  try {
    const pages = new Set<string>();
    for (let offset = 0; ; offset += 500) {
      stopped();
      const d = await request(
        `${P}/markets?limit=500&offset=${offset}&active=true&closed=false`,
      );
      if (!Array.isArray(d.markets)) throw new Error("Missing PM catalog");
      const fingerprint = JSON.stringify(d.markets.map((m: any) => m.slug));
      if (d.markets.length && pages.has(fingerprint))
        throw new Error("Repeated PM page");
      pages.add(fingerprint);
      for (const m of d.markets) poly.push(await normalizePoly(m));
      polyPages++;
      reportProgress();
      if (d.markets.length < 500) break;
    }
  } catch {
    errors.push("POLY_CATALOG_INCOMPLETE");
  }
  try {
    const d = await request(`${K}/series`);
    if (!Array.isArray(d.series)) throw new Error("Missing series");
    const series = new Map(d.series.map((s: any) => [s.ticker, s]));
    let cursor = "";
    const seen = new Set<string>();
    do {
      stopped();
      const page = await request(
        `${K}/markets?status=open&mve_filter=exclude&limit=1000${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
      );
      if (!Array.isArray(page.markets))
        throw new Error("Missing Kalshi catalog");
      for (const m of page.markets) {
        const s: any = series.get(String(m.ticker).split("-")[0]);
        kalshi.push(await normalizeKalshi(m, s));
      }
      kalshiPages++;
      reportProgress();
      cursor = String(page.cursor ?? "");
      if (cursor && seen.has(cursor)) throw new Error("Repeated cursor");
      seen.add(cursor);
    } while (cursor);
  } catch {
    errors.push("KALSHI_CATALOG_INCOMPLETE");
  }
  return { kalshi, poly, errors, complete: errors.length === 0, at };
}
type Catalog = Awaited<ReturnType<typeof catalog>>;
type Matched = ReturnType<typeof discoverCandidates>;
function* mutations(
  registry: MappingRegistry,
  data: Catalog,
  matched: Matched,
  stats: any,
) {
  const a = new Map(data.kalshi.map((m) => [m.id, m])),
    b = new Map(data.poly.map((m) => [m.id, m]));
  const candidateIds = new Set(matched.candidates.map((c) => c.pair.id));
  for (const m of registry.list()) {
    const ma = a.get(m.pair.a.id),
      mb = b.get(m.pair.b.id);
    if (ma && mb) {
      registry.refresh(m.id, ma, mb, data.at);
      stats.refreshed++;
      if (
        data.complete &&
        m.status === "UNVERIFIED" &&
        m.normalized.candidateReasons &&
        !candidateIds.has(m.id) &&
        data.at >= (m.metadataAt ?? m.createdAt)
      )
        registry.deactivate(m.id, "CANDIDATE_NO_LONGER_MATCHES");
    } else if (
      data.complete &&
      m.active &&
      data.at >= (m.metadataAt ?? m.createdAt)
    )
      registry.deactivate(m.id, "CATALOG_ABSENT");
    yield;
  }
  for (const c of matched.candidates) {
    const old = registry.get(c.pair.id);
    if (!old) {
      registry.add(c.pair, data.at, {
        ...c.structured,
        candidateReasons: c.reasons,
        score: c.score,
      });
      stats.added++;
    } else if (old.pair.inverted !== c.pair.inverted) {
      registry.refresh(old.id, c.pair.a, c.pair.b, data.at, c.pair.inverted);
    } else if (
      ["CATALOG_ABSENT", "CANDIDATE_NO_LONGER_MATCHES"].includes(
        old.reason ?? "",
      ) &&
      old.status !== "INVALIDATED"
    ) {
      registry.refresh(old.id, c.pair.a, c.pair.b, data.at);
      registry.reactivate(old.id, old.reason!);
    }
    yield;
  }
}
function cycleStats(data: Catalog, matched: Matched) {
  return {
    candidates: matched.candidates.length,
    sportsCandidates: matched.candidates.filter(
      (c) => c.pair.a.identity?.sports,
    ).length,
    nonSportsCandidates: matched.candidates.filter(
      (c) => !c.pair.a.identity?.sports,
    ).length,
    kalshi: (matched as any).catalogCounts?.kalshi ?? data.kalshi.length,
    poly: (matched as any).catalogCounts?.poly ?? data.poly.length,
    complete: data.complete,
    errors: data.errors,
    added: 0,
    refreshed: 0,
    ...matched.diagnostics,
  };
}
export function applyCatalog(
  registry: MappingRegistry,
  data: Catalog,
  matched = discoverCandidates(data.kalshi, data.poly),
) {
  const stats = cycleStats(data, matched);
  for (const _ of mutations(registry, data, matched, stats)) {
  }
  return stats;
}
export async function applyCatalogAsync(
  registry: MappingRegistry,
  data: Catalog,
  matched: Matched,
  flush: () => Promise<unknown>,
  cancelled: () => boolean = () => false,
) {
  const stats = cycleStats(data, matched);
  let n = 0;
  const steps = mutations(registry, data, matched, stats);
  while (!cancelled()) {
    if (steps.next().done) break;
    if (++n % 50 === 0) await flush();
  }
  if (cancelled()) throw new Error("Discovery interrupted");
  await flush();
  return stats;
}
// Stable membership preserves unaffected connections when markets arrive/leave.
export function reconcileGroups(
  previous: string[][],
  desired: string[],
  size: number,
) {
  const wanted = new Set(desired);
  const groups = previous
    .map((g) => g.filter((id) => wanted.delete(id)))
    .filter((g) => g.length);
  for (const id of [...wanted].sort()) {
    let group = groups.find((g) => g.length < size);
    if (!group) {
      group = [];
      groups.push(group);
    }
    group.push(id);
  }
  return groups;
}
