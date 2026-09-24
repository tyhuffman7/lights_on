import test from "node:test";
import assert from "node:assert/strict";
import {
  binaryOutcomes, classifyCluster, clusterQuery, evaluateDirection, fetchAllClusters,
  identityFinding, nextCycleDelay, parseFreshBook, redactJson, safeFailure,
} from "../lib/research/pmxt-poc.ts";
import type { PmxtCluster, PmxtMarket, ResearchBook } from "../lib/research/pmxt-poc.ts";
import type { FeeSchedule } from "../lib/research/fees.ts";

const market = (venue: string, id: string): PmxtMarket => ({
  marketId: id, sourceExchange: venue, title: "Same question",
  slug: id, description: "Looks equivalent", outcomes: [
    { outcomeId: id + ":y", label: "Yes", price: 0.4 },
    { outcomeId: id + ":n", label: "No", price: 0.6 },
  ],
});
const cluster = (markets: PmxtMarket[], confidence = 0.9): PmxtCluster => ({
  clusterId: "c1", canonicalTitle: "Same question", relations: ["identity"],
  confidence, markets,
  rawMatches: [{
    marketAId: markets[0].marketId, marketBId: markets[1].marketId,
    relation: "identity", confidence,
  }],
});
const k = market("kalshi", "k1"), us = market("polymarket_us", "us1");
const intl = market("polymarket", "pm1");
const schedule = (rate: number, rounding: "ceil" | "even"): FeeSchedule => ({
  rate, rounding, aggregation: rounding === "ceil" ? "level" : "order", source: "test",
});
const book = (asks: { price: number; quantity: number }[]): ResearchBook =>
  ({ bids: [], asks, exchangeAt: 1000, receivedAt: 1000 });

test("exact target venues never substitute international Polymarket", () => {
  assert.equal(clusterQuery(false, 0).venues, "kalshi,polymarket_us");
  assert.equal(classifyCluster(cluster([k, intl])).targetContaining, false);
  assert.equal(classifyCluster(cluster([k, intl])).internationalContaining, true);
  assert.equal(classifyCluster(cluster([k, us])).targetContaining, true);
  assert.equal(classifyCluster(cluster([k, us])).internationalContaining, false);
});

test("identity needs a direct target edge at the requested confidence", () => {
  assert.equal(classifyCluster(cluster([k, us], 0.8)).qualifiedIdentity, true);
  assert.equal(classifyCluster(cluster([k, us], 0.79)).qualifiedIdentity, false);
  const indirect = cluster([k, us, intl]);
  indirect.rawMatches = [
    { marketAId: "k1", marketBId: "pm1", relation: "identity", confidence: 0.9 },
    { marketAId: "pm1", marketBId: "us1", relation: "identity", confidence: 0.9 },
  ];
  assert.equal(classifyCluster(indirect).qualifiedIdentity, false);
  assert.equal(identityFinding(indirect), "NO_DIRECT_TARGET_IDENTITY_EDGE");
});

test("descriptions and PMXT confidence do not prove settlement equivalence", () => {
  assert.equal(identityFinding(cluster([k, us])), "PMXT_IDENTITY_UNVERIFIED_MISSING_RULES");
  const withRules = cluster([
    { ...k, sourceMetadata: { rules: "Full rule A" } },
    { ...us, sourceMetadata: { rules: "Full rule B" } },
  ]);
  assert.equal(identityFinding(withRules), "PMXT_IDENTITY_UNVERIFIED_REQUIRES_SETTLEMENT_REVIEW");
  assert.equal(identityFinding(cluster([k, us, market("kalshi", "k2")])), "AMBIGUOUS_TARGET_MARKETS");
});

test("pagination uses the documented 500-row limit and stops at exhaustion", async () => {
  const offsets: number[] = [];
  const reader = { async fetchMatchedMarketClusters(q: ReturnType<typeof clusterQuery>) {
    offsets.push(q.offset);
    assert.equal(q.withOrderbook, true);
    return q.offset === 0
      ? Array.from({ length: 500 }, (_, i) => ({ ...cluster([k, us]), clusterId: "c" + i }))
      : [{ ...cluster([k, us]), clusterId: "last" }];
  } };
  const all = await fetchAllClusters(reader, true);
  assert.equal(all.length, 501);
  assert.deepEqual(offsets, [0, 500]);
});

test("duplicate pages and malformed responses fail closed", async () => {
  const c = cluster([k, us]);
  await assert.rejects(fetchAllClusters({
    async fetchMatchedMarketClusters() { return { data: [c] }; },
  }, false), /MALFORMED_PMXT_RESPONSE/);
  await assert.rejects(fetchAllClusters({
    async fetchMatchedMarketClusters(q) {
      return q.offset === 0
        ? Array.from({ length: 500 }, (_, i) => ({ ...c, clusterId: "c" + i }))
        : [c];
    },
  }, false), /PAGINATION_DRIFT/);
  await assert.rejects(fetchAllClusters({
    async fetchMatchedMarketClusters() { return [{ ...c, markets: [{ ...k, outcomes: null }] }]; },
  }, false), /MALFORMED_PMXT_RESPONSE/);
});

test("book parser rejects stale, malformed, crossed, or over-precise depth", () => {
  const raw = { timestamp: 1_000, bids: [{ price: 0.3, size: 4 }],
    asks: [{ price: 0.4, size: 3 }, { price: 0.5, size: 2 }] };
  assert.deepEqual(parseFreshBook(raw, 2_000)?.asks, [
    { price: 4000, quantity: 3 }, { price: 5000, quantity: 2 },
  ]);
  assert.equal(parseFreshBook(raw, 3_001), null);
  assert.equal(parseFreshBook({ ...raw, asks: null }, 2_000), null);
  assert.equal(parseFreshBook({ ...raw, asks: [{ price: 0.30001, size: 3 }] }, 2_000), null);
  assert.equal(parseFreshBook({ ...raw, asks: [{ price: 0.2, size: 3 }] }, 2_000), null);
  assert.equal(parseFreshBook({ ...raw, timestamp: undefined }, 2_000), null);
  assert.equal(binaryOutcomes({ ...k, outcomes: [{ outcomeId: "1", label: "Yes" }] }), null);
});

test("equal contracts walk both books and include exact fee arithmetic and reserve", () => {
  const a = book([{ price: 3000, quantity: 2 }, { price: 4000, quantity: 1 }]);
  const b = book([{ price: 5000, quantity: 3 }]);
  const result = evaluateDirection(a, b, schedule(700, "ceil"), schedule(600, "even"));
  assert.equal(result.maxDepthQuantity, 3);
  assert.equal(result.best?.quantity, 3);
  assert.equal(result.best?.kalshiCost, 10000);
  assert.equal(result.best?.pmUsCost, 15000);
  assert.equal(result.best?.payout, 30000);
  assert.equal(result.best?.grossProfit, 5000);
  assert.equal(result.best?.kalshiLevels.reduce((n, x) => n + x.quantity, 0), 3);
  assert.equal(result.best?.pmUsLevels.reduce((n, x) => n + x.quantity, 0), 3);
  assert.equal(result.best?.netProfit,
    result.best!.grossProfit - result.best!.feeUpper - result.best!.reserve);
  assert.ok(result.best!.feeUpper >= result.best!.fees);
  assert.ok(result.best!.feeProfit < result.best!.grossProfit);
});

test("both complementary directions are priced separately and capital is per venue", () => {
  const yes = book([{ price: 4000, quantity: 1 }]), no = book([{ price: 7000, quantity: 1 }]);
  const pmNo = book([{ price: 3000, quantity: 1 }]), pmYes = book([{ price: 5000, quantity: 1 }]);
  const a = evaluateDirection(yes, pmNo, schedule(0, "ceil"), schedule(0, "even"));
  const b = evaluateDirection(no, pmYes, schedule(0, "ceil"), schedule(0, "even"));
  assert.equal(a.positiveNet, true);
  assert.equal(b.positiveGross, false);
  assert.equal(evaluateDirection(yes, pmNo, schedule(0, "ceil"), schedule(0, "even"), 3000).best, null);
});

test("API errors are categorized and secrets redacted without echoing raw errors", () => {
  const secret = "pmxt_test_secret_123";
  assert.equal(safeFailure(Error("429 Too Many Requests " + secret)), "RATE_LIMIT");
  assert.equal(safeFailure(Error("401 invalid api key " + secret)), "AUTH");
  assert.equal(safeFailure(Error("fetch failed " + secret)), "API_FAILURE");
  const encoded = redactJson({ error: "failed " + secret, key: secret }, secret);
  assert.equal(encoded.includes(secret), false);
  assert.equal(encoded.includes("[REDACTED]"), true);
});

test("polling stops at the deadline instead of accelerating in the final minute", () => {
  const start = 1_000_000, deadline = start + 60 * 60_000;
  assert.equal(nextCycleDelay(start + 2_500, start, deadline, 60_000), 57_500);
  assert.equal(nextCycleDelay(deadline - 55_000, deadline - 60_000, deadline, 60_000), null);
  assert.equal(nextCycleDelay(deadline - 1, deadline - 30_000, deadline, 60_000), null);
  assert.equal(nextCycleDelay(start + 65_000, start, deadline, 60_000), 60_000);
});
