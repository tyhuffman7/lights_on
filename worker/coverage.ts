import {
  getJSON,
  normalizeKalshi,
  normalizePoly,
} from "../lib/arb/adapters.ts";
import { matchCandidates } from "../lib/research/matching.ts";
import type { MappingRegistry } from "../lib/research/mappings.ts";
import type { Market } from "../lib/arb/types.ts";
export async function catalog(request = getJSON, signal?: AbortSignal) {
  const at = Date.now();
  const kalshi: Market[] = [],
    poly: Market[] = [],
    errors: string[] = [];
  const K = "https://external-api.kalshi.com/trade-api/v2",
    P = "https://gateway.polymarket.us/v1";
  const stopped = () => {
    if (signal?.aborted) throw new Error("Catalog cancelled");
  };
  try {
    const pages = new Set<string>();
    for (let offset = 0; ; offset += 100) {
      stopped();
      const d = await request(
        `${P}/markets?limit=100&offset=${offset}&active=true&closed=false`,
      );
      if (!Array.isArray(d.markets)) throw new Error("Missing PM catalog");
      const fingerprint = JSON.stringify(d.markets.map((m: any) => m.slug));
      if (d.markets.length && pages.has(fingerprint))
        throw new Error("Repeated PM page");
      pages.add(fingerprint);
      for (const m of d.markets)
        if (!/sport/i.test(m.category ?? "")) poly.push(await normalizePoly(m));
      if (d.markets.length < 100) break;
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
        `${K}/markets?status=open&limit=1000${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
      );
      if (!Array.isArray(page.markets))
        throw new Error("Missing Kalshi catalog");
      for (const m of page.markets) {
        const s: any = series.get(String(m.ticker).split("-")[0]);
        if (s && !/sport/i.test(s.category ?? ""))
          kalshi.push(await normalizeKalshi(m, s));
      }
      cursor = String(page.cursor ?? "");
      if (cursor && seen.has(cursor)) throw new Error("Repeated cursor");
      seen.add(cursor);
    } while (cursor);
  } catch {
    errors.push("KALSHI_CATALOG_INCOMPLETE");
  }
  return { kalshi, poly, errors, complete: errors.length === 0, at };
}
export function applyCatalog(
  registry: MappingRegistry,
  data: Awaited<ReturnType<typeof catalog>>,
) {
  const a = new Map(data.kalshi.map((m) => [m.id, m])),
    b = new Map(data.poly.map((m) => [m.id, m]));
  for (const m of registry.list()) {
    const ma = a.get(m.pair.a.id),
      mb = b.get(m.pair.b.id);
    if (ma && mb) registry.refresh(m.id, ma, mb, data.at);
    // Absence from a partial catalog must never be taken as closure.
    else if (
      data.complete &&
      m.active &&
      data.at >= (m.metadataAt ?? m.createdAt)
    )
      registry.deactivate(m.id, "CATALOG_ABSENT");
  }
  const candidates = matchCandidates(data.kalshi, data.poly);
  for (const c of candidates) {
    const old = registry.get(c.pair.id);
    if (!old) registry.add(c.pair, data.at, c.structured);
    else if (old.reason === "CATALOG_ABSENT" && old.status !== "INVALIDATED") {
      registry.refresh(old.id, c.pair.a, c.pair.b, data.at);
      registry.reactivate(old.id, "CATALOG_ABSENT");
    }
  }
  return {
    candidates: candidates.length,
    kalshi: data.kalshi.length,
    poly: data.poly.length,
    complete: data.complete,
    errors: data.errors,
  };
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
