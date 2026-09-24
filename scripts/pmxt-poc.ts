// Hosted PMXT catalog and live-book research. This script calls read methods only.
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Kalshi, PolymarketUS, Router } from "pmxtjs";
import { GENERAL_KALSHI_RATE, PM_US_JULY_2026_RATE } from "../lib/research/fees.ts";
import type { FeeSchedule } from "../lib/research/fees.ts";
import {
  binaryOutcomes, classifyCluster, evaluateDirection, fetchAllClusters, identityFinding,
  parseFreshBook, redactJson, safeFailure, TARGET_VENUES,
} from "../lib/research/pmxt-poc.ts";
import type { PmxtCluster, PmxtMarket, ResearchBook } from "../lib/research/pmxt-poc.ts";

const HOST = "https://api.pmxt.dev";
const SDK_VERSION = "2.54.0";
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
type VenueClient = Pick<Kalshi, "fetchMarkets" | "fetchOrderBook">;
type Books = { yes: ResearchBook | null; no: ResearchBook | null; reason: string | null };
const kalshiFee: FeeSchedule = {
  rate: GENERAL_KALSHI_RATE, rounding: "ceil", aggregation: "level",
  source: "Lights On general Kalshi schedule; account precision and fragmentation remain unproven",
};
const pmUsFee: FeeSchedule = {
  rate: PM_US_JULY_2026_RATE, rounding: "even", aggregation: "order",
  source: "Lights On July 2026 PM-US coefficient; market applicability remains unproven",
};

function arg(name: string, fallback: number, min: number, max: number) {
  const entry = process.argv.slice(2).find(x => x.startsWith("--" + name + "="));
  if (!entry) return fallback;
  const n = Number(entry.slice(name.length + 3));
  if (!Number.isFinite(n) || n < min || n > max) throw Error("INVALID_ARGUMENT_" + name);
  return n;
}
function iso(v: Date | string | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
function marketEvidence(m: PmxtMarket) {
  return {
    venue: m.sourceExchange, marketId: m.marketId, eventId: m.eventId ?? null,
    title: m.title, slug: m.slug ?? null, category: m.category ?? null,
    description: m.description ?? null, resolutionDate: iso(m.resolutionDate),
    rules: typeof m.sourceMetadata?.rules === "string" ? m.sourceMetadata.rules : null,
    outcomes: m.outcomes.map(o => ({ outcomeId: o.outcomeId, label: o.label, catalogPrice: o.price ?? null })),
  };
}
function clusterEvidence(c: PmxtCluster) {
  return {
    clusterId: c.clusterId, canonicalTitle: c.canonicalTitle, category: c.category ?? null,
    relations: c.relations, confidence: c.confidence, updatedAt: c.updatedAt ?? null,
    sourceAt: c.sourceAt ?? null, rawMatches: c.rawMatches ?? null,
    markets: c.markets.filter(m => TARGET_VENUES.includes(m.sourceExchange as typeof TARGET_VENUES[number]))
      .map(marketEvidence),
    identityFinding: identityFinding(c),
  };
}
function confidenceBins(clusters: PmxtCluster[]) {
  const bins = { "0.80-0.89": 0, "0.90-0.94": 0, "0.95-0.99": 0, "1.00": 0, "below_0.80": 0 };
  for (const c of clusters) {
    if (c.confidence < 0.8) bins["below_0.80"]++;
    else if (c.confidence < 0.9) bins["0.80-0.89"]++;
    else if (c.confidence < 0.95) bins["0.90-0.94"]++;
    else if (c.confidence < 1) bins["0.95-0.99"]++;
    else bins["1.00"]++;
  }
  return bins;
}

async function main() {
  const started = Date.now();
  const minutes = arg("minutes", 60, 1, 120);
  const intervalSeconds = arg("interval-seconds", 60, 15, 3600);
  const maxCycles = arg("cycles", 10_000, 1, 10_000);
  const keyFile = process.argv.slice(2).find(x => x.startsWith("--key-file="))?.slice(11);
  // Read only PMXT_API_KEY from a local env file; venue credentials are never passed to the SDK.
  let keyFileUnreadable = false;
  let keyLine: string | undefined;
  if (keyFile) {
    try {
      keyLine = (await readFile(keyFile, "utf8")).split(/\r?\n/)
        .find(line => /^\s*(?:export\s+)?PMXT_API_KEY\s*=/.test(line));
    } catch { keyFileUnreadable = true; }
  }
  const fromFile = keyLine?.replace(/^\s*(?:export\s+)?PMXT_API_KEY\s*=\s*/, "").trim()
    .replace(/^(["'])(.*)\1$/, "$2") ?? "";
  const key = process.env.PMXT_API_KEY || fromFile;
  const outputDir = path.resolve("research-data", "pmxt-poc", new Date(started).toISOString().replaceAll(":", "-"));
  await mkdir(outputDir, { recursive: true });
  const cyclesFile = path.join(outputDir, "cycles.jsonl");
  const candidatesFile = path.join(outputDir, "candidates.jsonl");
  const booksFile = path.join(outputDir, "books.jsonl");
  const save = async (file: string, value: unknown) => appendFile(file, redactJson(value, key) + "\n", { mode: 0o600 });
  const summary: Record<string, unknown> = {
    sdk: "pmxtjs", sdkVersion: SDK_VERSION, host: HOST,
    startedAt: new Date(started).toISOString(), endedAt: null, cycles: 0, logicalApiCalls: 0,
    rateLimitResponses: 0, authFailures: 0, apiFailures: 0, malformedResponses: 0,
    targetVenues: TARGET_VENUES, relation: "identity", minConfidence: 0.8,
    bookMaxAgeMs: 2000, paperCashPerVenueUsd: 100, reservePerContractUsd: 0.01,
    pmxtKeyWorked: false, blocker: null,
    endpoints: ["/v0/matched-market-clusters", "/api/router/fetchMarkets",
      "/api/kalshi/fetchMarkets", "/api/polymarket_us/fetchMarkets",
      "/api/kalshi/fetchOrderBook", "/api/polymarket_us/fetchOrderBook"],
    uniqueTargetContainingClusters: 0, uniqueDirectIdentityClusters: 0,
    uniqueTargetClustersWithPmxtOrderbookFlag: 0, uniqueCandidatesWithUsableBooks: 0,
    uniquePositiveDepthGross: 0, uniquePositiveModelFees: 0, uniquePositiveModelNet: 0,
    contractVerifiedCandidates: 0, executablePaperOpportunities: 0,
  };
  const finish = async () => {
    summary.endedAt = new Date().toISOString();
    await writeFile(path.join(outputDir, "summary.json"), redactJson(summary, key) + "\n", { mode: 0o600 });
    process.stdout.write("PMXT POC: " + JSON.stringify({
      outputDir, cycles: summary.cycles, targetClusters: summary.uniqueTargetContainingClusters,
      directIdentity: summary.uniqueDirectIdentityClusters, blocker: summary.blocker,
    }) + "\n");
  };
  if (!key) {
    summary.blocker = keyFileUnreadable ? "PMXT_KEY_FILE_UNREADABLE" : "PMXT_API_KEY_MISSING";
    await finish();
    process.exitCode = 2;
    return;
  }

  const options = { pmxtApiKey: key, baseUrl: HOST, autoStartServer: false };
  const router = new Router(options);
  const clients: Record<"kalshi" | "polymarket_us", VenueClient> = {
    kalshi: new Kalshi(options), polymarket_us: new PolymarketUS(options),
  };
  let lastCall = 0;
  const beforeCall = async () => {
    await delay(Math.max(0, lastCall + 2500 - Date.now())); // <=24 logical calls/minute.
    lastCall = Date.now();
    summary.logicalApiCalls = Number(summary.logicalApiCalls) + 1;
  };
  const targetIds = new Set<string>(), identityIds = new Set<string>();
  const flaggedIds = new Set<string>(), usableIds = new Set<string>();
  const grossIds = new Set<string>(), feeIds = new Set<string>(), netIds = new Set<string>();
  let previous = new Set<string>();
  let catalogCoverage: Record<string, unknown> | null = null;
  const noteFailure = (error: unknown) => {
    const code = error instanceof Error && ["MALFORMED_PMXT_RESPONSE", "PAGINATION_DRIFT"].includes(error.message)
      ? error.message : safeFailure(error);
    if (code === "RATE_LIMIT") summary.rateLimitResponses = Number(summary.rateLimitResponses) + 1;
    else if (code === "AUTH") summary.authFailures = Number(summary.authFailures) + 1;
    else if (code === "MALFORMED_PMXT_RESPONSE" || code === "PAGINATION_DRIFT")
      summary.malformedResponses = Number(summary.malformedResponses) + 1;
    else summary.apiFailures = Number(summary.apiFailures) + 1;
    return code;
  };
  const fetchBooks = async (catalog: PmxtMarket): Promise<Books> => {
    if (catalog.sourceExchange !== "kalshi" && catalog.sourceExchange !== "polymarket_us")
      return { yes: null, no: null, reason: "WRONG_VENUE" };
    if (!catalog.slug) return { yes: null, no: null, reason: "NO_NATIVE_LOOKUP_SLUG" };
    const client = clients[catalog.sourceExchange];
    try {
      await beforeCall();
      const rows = await client.fetchMarkets({ slug: catalog.slug, limit: 20 });
      const matches = rows.filter(m => m.slug === catalog.slug && m.title === catalog.title);
      if (matches.length !== 1) return { yes: null, no: null, reason: "NATIVE_MARKET_UNRESOLVED" };
      const native = binaryOutcomes(matches[0] as PmxtMarket);
      const listed = binaryOutcomes(catalog);
      if (!native || !listed || native.yes.label !== listed.yes.label || native.no.label !== listed.no.label)
        return { yes: null, no: null, reason: "OUTCOMES_AMBIGUOUS" };
      const result: Books = { yes: null, no: null, reason: null };
      for (const side of ["yes", "no"] as const) {
        try {
          await beforeCall();
          const raw = await client.fetchOrderBook(native[side].outcomeId);
          result[side] = parseFreshBook(raw, Date.now());
          if (!result[side]) result.reason = "MISSING_MALFORMED_OR_STALE_BOOK";
        } catch (error) { result.reason = noteFailure(error); }
      }
      return result;
    } catch (error) { return { yes: null, no: null, reason: noteFailure(error) }; }
  };

  try {
    for (let cycleNo = 0; cycleNo < maxCycles && Date.now() - started < minutes * 60_000; cycleNo++) {
      const cycleStart = Date.now();
      const cycle: Record<string, unknown> = {
        at: new Date(cycleStart).toISOString(), clusters: null, targetContaining: null,
        kalshiWithInternational: null, noTargetPair: null, directIdentity: null,
        pmxtOrderbookFlaggedTarget: null, confidence: null, usableLiveBooks: 0,
        positiveGross: 0, positiveFeeModel: 0, positiveNetModel: 0,
        verified: 0, executablePaper: 0, added: [], removed: [], failure: null,
        orderbookFilterFailure: null,
      };
      let clusters: PmxtCluster[] = [], flagged: PmxtCluster[] = [];
      try {
        clusters = await fetchAllClusters(router, false, beforeCall);
        summary.pmxtKeyWorked = true;
      } catch (error) {
        cycle.failure = noteFailure(error);
        if (cycle.failure === "AUTH") summary.blocker = "PMXT_API_KEY_INVALID_OR_UNAUTHORIZED";
      }
      if (!cycle.failure) {
        try { flagged = await fetchAllClusters(router, true, beforeCall); }
        catch (error) { cycle.orderbookFilterFailure = noteFailure(error); }
        const target = clusters.filter(c => classifyCluster(c).targetContaining);
        const identity = target.filter(c => classifyCluster(c).qualifiedIdentity);
        const flag = flagged.filter(c => classifyCluster(c).targetContaining);
        cycle.clusters = clusters.length;
        cycle.targetContaining = target.length;
        cycle.kalshiWithInternational = clusters.filter(c => classifyCluster(c).internationalContaining).length;
        cycle.noTargetPair = clusters.length - target.length;
        cycle.directIdentity = identity.length;
        cycle.pmxtOrderbookFlaggedTarget = cycle.orderbookFilterFailure ? null : flag.length;
        cycle.confidence = confidenceBins(target);
        cycle.added = [...new Set(target.map(c => c.clusterId))].filter(id => !previous.has(id));
        cycle.removed = [...previous].filter(id => !target.some(c => c.clusterId === id));
        previous = new Set(target.map(c => c.clusterId));
        for (const c of target) {
          targetIds.add(c.clusterId);
          await save(candidatesFile, { at: cycle.at, ...clusterEvidence(c) });
        }
        for (const c of identity) {
          identityIds.add(c.clusterId);
          const x = classifyCluster(c);
          if (x.kalshi.length !== 1 || x.pmUs.length !== 1) continue;
          const k = await fetchBooks(x.kalshi[0]), p = await fetchBooks(x.pmUs[0]);
          await save(booksFile, { at: cycle.at, clusterId: c.clusterId, kalshi: k, pmUs: p });
          const directions = [
            [k.yes, p.no, "kalshi_yes+pm_us_no"],
            [k.no, p.yes, "kalshi_no+pm_us_yes"],
          ] as const;
          let usable = false, gross = false, fees = false, net = false;
          for (const [a, b, orientation] of directions) {
            if (!a || !b) continue;
            usable = true;
            const economics = evaluateDirection(a, b, kalshiFee, pmUsFee);
            gross ||= economics.positiveGross;
            fees ||= economics.positiveFee;
            net ||= economics.positiveNet;
            await save(booksFile, {
              at: cycle.at, clusterId: c.clusterId, orientation,
              feeModelOnly: true, strictSettlementEquivalent: false, economics,
            });
          }
          if (usable) { usableIds.add(c.clusterId); cycle.usableLiveBooks = Number(cycle.usableLiveBooks) + 1; }
          if (gross) { grossIds.add(c.clusterId); cycle.positiveGross = Number(cycle.positiveGross) + 1; }
          if (fees) { feeIds.add(c.clusterId); cycle.positiveFeeModel = Number(cycle.positiveFeeModel) + 1; }
          if (net) { netIds.add(c.clusterId); cycle.positiveNetModel = Number(cycle.positiveNetModel) + 1; }
        }
        for (const c of flag) flaggedIds.add(c.clusterId);
        if (catalogCoverage === null) {
          catalogCoverage = {};
          for (const venue of TARGET_VENUES) {
            try {
              await beforeCall();
              const rows = await router.fetchMarkets({ sourceExchange: venue, limit: 1 });
              catalogCoverage[venue] = { firstPageCount: rows.length, completeMarketCount: null };
            } catch (error) { catalogCoverage[venue] = { failure: noteFailure(error) }; }
          }
          summary.catalogFirstPageProbe = catalogCoverage;
        }
      }
      summary.cycles = Number(summary.cycles) + 1;
      await save(cyclesFile, cycle);
      if (cycle.failure === "AUTH") break;
      if (cycle.failure === "RATE_LIMIT") await delay(60_000);
      const next = cycleStart + intervalSeconds * 1000;
      if (cycleNo + 1 < maxCycles && next < started + minutes * 60_000)
        await delay(Math.max(0, next - Date.now()));
    }
  } finally {
    summary.uniqueTargetContainingClusters = targetIds.size;
    summary.uniqueDirectIdentityClusters = identityIds.size;
    summary.uniqueTargetClustersWithPmxtOrderbookFlag = flaggedIds.size;
    summary.uniqueCandidatesWithUsableBooks = usableIds.size;
    summary.uniquePositiveDepthGross = grossIds.size;
    summary.uniquePositiveModelFees = feeIds.size;
    summary.uniquePositiveModelNet = netIds.size;
    if (!summary.blocker && !targetIds.size && Number(summary.cycles) > 0)
      summary.blocker = "NO_KALSHI_POLYMARKET_US_MATCHED_CLUSTERS";
    await finish();
  }
}
await main();
