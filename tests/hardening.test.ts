import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ResearchStore } from "../lib/research/store.ts";
import { MappingRegistry, isVerified } from "../lib/research/mappings.ts";
import { Recorder } from "../lib/research/recorder.ts";
import { researchReport } from "../lib/research/report.ts";
import {
  opportunityRows,
  opportunityCSV,
  opportunityDetail,
} from "../lib/research/exports.ts";
import { applyCatalog, reconcileGroups, catalog } from "../worker/coverage.ts";
import { LiveRecorder } from "../worker/live-recorder.ts";
import { Telemetry } from "../worker/telemetry.ts";
import { pair, book, config } from "./research-fixture.ts";
const db = () =>
  new ResearchStore(
    join(mkdtempSync(join(tmpdir(), "hardening-")), "research.sqlite"),
  );
test("Changing orientation invalidates verification and persists the new orientation", () => {
  const s = db(),
    r = new MappingRegistry(s),
    p = pair();
  r.add(p);
  r.verify(p.id, "MANUAL_VERIFIED", "fixture");
  r.add({ ...p, inverted: true });
  assert.equal(r.get(p.id)?.status, "INVALIDATED");
  assert.equal(r.get(p.id)?.pair.inverted, true);
  assert.equal(isVerified(r.get(p.id)), false);
  assert.equal(new MappingRegistry(s).get(p.id)?.status, "INVALIDATED");
  s.close();
});
test("Unverified discrepancies remain raw in reports, CSV and lifecycle export", () => {
  const s = db(),
    r = new MappingRegistry(s),
    p = pair();
  p.a.title = "=malicious formula";
  r.add(p);
  const rec = new Recorder(s, r, config, "fixture");
  const mono = performance.now(),
    wall = Date.now();
  rec.update(book("kalshi", p.a.id, mono, wall));
  rec.update(book("poly", p.b.id, mono, wall));
  rec.stop(wall + 1, mono + 1);
  const report = researchReport(s, rec.sessionId);
  assert.ok(report.rawDiscrepancyCount > 0);
  assert.equal(report.grossArbCount, 0);
  assert.equal(report.theoreticalProfit, 0);
  assert.equal(report.feePositiveArbCount, 0);
  assert.equal(report.survival.poly[500].rate, null);
  assert.equal(report.orphan.poly.netExpectedProfit, null);
  const rows = opportunityRows(s, rec.sessionId);
  assert.equal(rows[0].netEdge, null);
  assert.equal(rows[0].bankroll100Profit, null);
  assert.ok(rows[0].labels.includes("UNVERIFIED CANDIDATE"));
  assert.ok(opportunityCSV(rows).includes("'=malicious formula"));
  assert.equal(
    opportunityDetail(s, rec.sessionId, rows[0].id)[0].books.length,
    2,
  );
  assert.throws(() => opportunityDetail(s, "other", rows[0].id));
  s.close();
});
test("Discovery is idempotent, preserves invalidation, and partial absence cannot close a mapping", () => {
  const s = db(),
    r = new MappingRegistry(s),
    p = pair(),
    data = {
      kalshi: [p.a],
      poly: [p.b],
      errors: [],
      complete: true,
      at: Date.now(),
    };
  applyCatalog(r, data);
  assert.equal(r.list().length, 1);
  const id = r.list()[0].id;
  const before = s.rows("mapping_history").length;
  applyCatalog(r, data);
  assert.equal(s.rows("mapping_history").length, before);
  applyCatalog(r, { ...data, poly: [], complete: false });
  assert.equal(r.get(id)?.active, true);
  applyCatalog(r, { ...data, poly: [] });
  assert.equal(r.get(id)?.active, false);
  applyCatalog(r, data);
  assert.equal(r.get(id)?.active, true);
  r.verify(id, "MANUAL_VERIFIED", "fixture");
  r.refresh(id, { ...p.a, hash: "changed" }, p.b);
  applyCatalog(r, data);
  assert.equal(r.get(id)?.status, "INVALIDATED");
  assert.equal(r.get(id)?.active, false);
  s.close();
});
test("Stable shard groups deduplicate markets and retain unaffected subscriptions", () => {
  assert.deepEqual(
    reconcileGroups(
      [
        ["a", "b"],
        ["c", "d"],
      ],
      ["a", "b", "c", "d", "e", "e"],
      2,
    ),
    [["a", "b"], ["c", "d"], ["e"]],
  );
  assert.deepEqual(
    reconcileGroups(
      [
        ["a", "b"],
        ["c", "d"],
      ],
      ["a", "b", "d"],
      2,
    ),
    [["a", "b"], ["d"]],
  );
});
test("Catalog follows PM offsets and Kalshi cursors without the old sample caps", async () => {
  let pm = 0,
    k = 0;
  const request = async (url) => {
    if (url.includes("/series")) return { series: [] };
    if (url.includes("polymarket")) {
      pm++;
      return {
        markets: Array.from({ length: pm < 5 ? 100 : 0 }, (_, i) => ({
          slug: `page${pm}-${i}`,
          category: "sports",
        })),
      };
    }
    k++;
    return { markets: [], cursor: k < 3 ? "page" + k : "" };
  };
  const d = await catalog(request);
  assert.equal(pm, 5);
  assert.equal(k, 3);
  assert.equal(d.complete, true);
});
test("Persistence worker drains ordered evidence without using SQLite on the evaluation thread", async () => {
  const s = db(),
    r = new MappingRegistry(s),
    p = pair();
  r.add(p);
  r.verify(p.id, "MANUAL_VERIFIED", "fixture");
  const t = new Telemetry(),
    rec = new LiveRecorder(s.path, r, config, t, () => {});
  await rec.ready;
  rec.reindex();
  const original = s.db.prepare;
  s.db.prepare = () => {
    throw new Error("Main thread SQLite accessed");
  };
  rec.update(book("kalshi", p.a.id));
  for (let i = 0; i < 20; i++) rec.update(book("poly", p.b.id));
  const report = await rec.report();
  assert.equal(report.bookUpdates, 21);
  assert.ok(report.ruleVerifiedOpportunities > 0);
  assert.equal(rec.backlog, 0);
  assert.ok(t.snapshot().latencyMs.persistenceAck.count > 0);
  await assert.rejects(
    rec.send("detail", { id: "bad", offset: 0, limit: 100 }),
  );
  assert.equal(rec.failed, false);
  await rec.stop(Date.now(), performance.now());
  s.db.prepare = original;
  t.close();
  s.close();
});
test("Persistence backlog overflow fails closed and still drains already accepted work", async () => {
  const s = db(),
    r = new MappingRegistry(s),
    t = new Telemetry();
  let failed = 0;
  const rec = new LiveRecorder(s.path, r, config, t, () => failed++, 2);
  await rec.ready;
  const first = rec.send("tick", { wall: Date.now(), mono: 0 }),
    second = rec.send("tick", { wall: Date.now(), mono: 0 });
  await assert.rejects(rec.send("tick", {}));
  assert.ok(rec.failed);
  assert.ok(failed > 0);
  await Promise.all([first, second]);
  await rec.stop(Date.now(), performance.now());
  t.close();
  s.close();
});

test("Observer isolates identical subscription IDs and sequence recovery to their shard", async () => {
  const { Observer } = await import("../worker/observer.ts"),
    { configSchema } = await import("../worker/config.ts"),
    { StreamConnection } = await import("../worker/streams.ts");
  const start = StreamConnection.prototype.start,
    stop = StreamConnection.prototype.stop;
  StreamConnection.prototype.start = function () {
    this.stopped = false;
  };
  StreamConnection.prototype.stop = function () {
    this.stopped = true;
  };
  const s = db(),
    o = new Observer(
      s,
      configSchema.parse({ discoveryEnabled: false, shardSize: 1 }),
    );
  try {
    await o.recorder.ready;
    for (const id of ["one", "two"]) o.registry.add(pair(id));
    o.recorder.reindex();
    o.paused = false;
    o.syncSubscriptions();
    assert.equal(o.streams.length, 4);
    const streams = o.streams.filter((s) => s.options.venue === "kalshi");
    const at = Date.now(),
      mono = performance.now();
    const message = (s, seq) => ({
      type: "orderbook_snapshot",
      sid: 1,
      seq,
      msg: {
        market_ticker: s.options.ids[0],
        yes_dollars_fp: [["0.30", "100.00"]],
        no_dollars_fp: [["0.60", "100.00"]],
      },
    });
    for (const stream of streams)
      stream.options.onMessage(message(stream, 1), at, mono);
    assert.throws(() =>
      streams[0].options.onMessage(message(streams[0], 3), at, mono + 1),
    );
    streams[0].options.onInvalid("SEQUENCE_RECOVERY");
    assert.equal(
      o.cache.get("kalshi", streams[0].options.ids[0])?.valid,
      false,
    );
    assert.equal(o.cache.get("kalshi", streams[1].options.ids[0])?.valid, true);
    o.registry.deactivate("one", "fixture removal");
    o.recorder.reindex();
    o.syncSubscriptions();
    assert.equal(o.streams.length, 2);
    assert.ok(o.streams.includes(streams[1]));
  } finally {
    await o.stop();
    s.close();
    StreamConnection.prototype.start = start;
    StreamConnection.prototype.stop = stop;
  }
});
test("Healthy heartbeat does not reset book-change freshness", async () => {
  const { StreamConnection } = await import("../worker/streams.ts"),
    { fresh } = await import("../lib/research/books.ts");
  const stream = new StreamConnection({
    venue: "kalshi",
    ids: ["K"],
    headers: () => ({}),
    onMessage: () => {},
    onInvalid: () => {},
    onDiagnostic: () => {},
  });
  stream.socket = { readyState: 1 };
  stream.lastPong = performance.now();
  const old = book("kalshi", "K", performance.now() - 5000, Date.now() - 5000);
  assert.equal(stream.health().connected, true);
  assert.equal(fresh(old, performance.now(), Date.now(), 2000), false);
});

test("Late metadata cannot overwrite a newer orientation or settlement review", () => {
  const s = db(),
    r = new MappingRegistry(s),
    p = pair();
  r.add(p, 100);
  r.verify(p.id, "MANUAL_VERIFIED", "fixture", 110);
  r.refresh(p.id, { ...p.a, hash: "new" }, p.b, 200, true);
  r.refresh(p.id, p.a, p.b, 150, false);
  assert.equal(r.get(p.id)?.pair.a.hash, "new");
  assert.equal(r.get(p.id)?.pair.inverted, true);
  assert.equal(r.get(p.id)?.status, "INVALIDATED");
  s.close();
});
