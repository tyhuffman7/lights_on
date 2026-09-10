import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ResearchStore } from "../lib/research/store.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { Recorder } from "../lib/research/recorder.ts";
import { analyzeLatency } from "../lib/research/latency.ts";
import { researchReport } from "../lib/research/report.ts";
const now = 1800000000000;
const m = (venue) => ({
  id: venue,
  venue,
  title: "Fixture",
  outcome: "yes",
  opposite: "no",
  category: "Economics",
  rules: "fixture",
  url: "",
  closeAt: new Date(now + 86400000).toISOString(),
  open: true,
  feeRate: 0,
  feeRounding: venue === "kalshi" ? "ceil" : "even",
  minQty: 1,
  hash: "same",
  settlement: null,
});
const b = (venue, mono = 0) => ({
  venue,
  marketId: venue,
  yes: [{ price: venue === "kalshi" ? 4000 : 7000, quantity: 10 }],
  no: [{ price: venue === "kalshi" ? 7000 : 4000, quantity: 10 }],
  yesBids: [{ price: 3000, quantity: 10 }],
  noBids: [{ price: 2000, quantity: 10 }],
  receivedAt: now + mono,
  receivedMono: mono,
  exchangeAt: now + mono,
  sequence: 1,
  connection: "LIVE",
  valid: true,
  open: true,
  source: "fixture",
});
const config = {
  maxAgeMs: 2000,
  reserve: 100,
  minProfit: 1,
  minRoi: 1,
  bankrolls: [1000000, 2500000, 5000000, 10000000],
};
function setup() {
  const s = new ResearchStore(
    join(mkdtempSync(join(tmpdir(), "latency-")), "db.sqlite"),
  );
  const r = new MappingRegistry(s);
  r.add(
    {
      id: "pair",
      a: m("kalshi"),
      b: m("poly"),
      inverted: false,
      reviewed: false,
    },
    now,
  );
  r.verify("pair", "MANUAL_VERIFIED", "fixture review", now);
  const recorder = new Recorder(s, r, config, "fixture", now);
  recorder.update(b("kalshi"));
  recorder.update(b("poly"));
  return { s, r, recorder };
}
test("Latency uses as-of books, holds quantity and limits fixed, and never looks forward", () => {
  const { s, recorder } = setup();
  const changed = { ...b("poly", 75), no: [{ price: 7000, quantity: 10 }] };
  recorder.update(changed);
  recorder.update(b("kalshi", 2000));
  recorder.stop(now + 2000, 2000);
  analyzeLatency(s, recorder.sessionId, 2000);
  const rows = s
    .rows("latency_tests")
    .filter((x) => x.first_venue === "kalshi");
  assert.equal(rows.length, 8);
  assert.equal(rows.find((x) => x.latency_ms === 50).status, "SURVIVED");
  assert.equal(
    rows.find((x) => x.latency_ms === 100).status,
    "SECOND_LEG_GONE",
  );
  const body = JSON.parse(rows.find((x) => x.latency_ms === 100).body);
  assert.equal(body.unwind.sufficientDepth, true);
  assert.equal(body.unwind.realizedLoss, 10000);
  assert.equal(body.profit, -10000);
  assert.equal(body.targetQuantity, 10);
  analyzeLatency(s, recorder.sessionId, 2000);
  assert.equal(s.rows("latency_tests").length, 16);
  s.close();
});
test("Stale coverage cannot count as survival and partial unwinds retain exposure", () => {
  const { s, recorder } = setup();
  recorder.update({ ...b("poly", 25), no: [] });
  recorder.update({
    ...b("kalshi", 25),
    yesBids: [{ price: 3000, quantity: 3 }],
  });
  recorder.stop(now + 100, 100);
  analyzeLatency(s, recorder.sessionId, 100);
  const rows = s
    .rows("latency_tests")
    .filter((x) => x.first_venue === "kalshi");
  const partial = JSON.parse(rows.find((x) => x.latency_ms === 50).body);
  assert.equal(partial.unwind.remainingQuantity, 7);
  assert.equal(partial.profit, null);
  const uncovered = rows.find((x) => x.latency_ms === 2000);
  assert.equal(uncovered.status, "BOOK_STALE");
  assert.equal(JSON.parse(uncovered.body).observationComplete, false);
  s.close();
});
test("Reports use opportunity counts, separate censored samples, and do not spend bankroll twice", () => {
  const { s, recorder } = setup();
  recorder.update({ ...b("poly", 100), no: [{ price: 7000, quantity: 10 }] });
  recorder.update(b("poly", 150));
  recorder.stop(now + 2000, 2000);
  analyzeLatency(s, recorder.sessionId, 2000);
  const report = researchReport(s, recorder.sessionId);
  assert.equal(report.opportunitiesDetected, 2);
  assert.equal(report.lifetime.closedCount, 1);
  assert.equal(report.lifetime.censoredCount, 1);
  assert.equal(report.dataMode, "fixture");
  assert.ok(
    report.capitalConstrained["100"].profit <= report.theoreticalProfit,
  );
  s.close();
});
test("Empty observations produce null rates, never fabricated zero-success evidence", () => {
  const s = new ResearchStore(":memory:");
  const recorder = new Recorder(s, new MappingRegistry(s), config, "live", now);
  recorder.stop(now, 0);
  const report = researchReport(s, recorder.sessionId);
  assert.equal(report.survival["100"].rate, null);
  assert.equal(report.opportunitiesDetected, 0);
  assert.equal(report.lifetime.p50, null);
  s.close();
});

test("Qualifying lifetime ends when net edge fails even if gross spread remains positive", () => {
  const { s, recorder } = setup();
  recorder.update({ ...b("poly", 100), no: [{ price: 5900, quantity: 10 }] });
  recorder.stop(now + 200, 200);
  const report = researchReport(s, recorder.sessionId);
  assert.equal(report.lifetime.closedCount, 1);
  assert.equal(report.lifetime.p50, 100);
  s.close();
});
