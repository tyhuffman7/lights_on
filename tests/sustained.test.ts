import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityRegistry, catalogEntities } from "../lib/research/entities.ts";
import { reviewPackage, reviewQueue } from "../lib/research/review.ts";
import { CapacityScheduler } from "../lib/research/capacity.ts";
import { ReconciliationScheduler } from "../lib/research/reconciliation.ts";
import { freshnessResearch } from "../lib/research/freshness.ts";
import { ResearchStore } from "../lib/research/store.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { Recorder } from "../lib/research/recorder.ts";
import { analyzeLatency, latencyBuckets } from "../lib/research/latency.ts";
import { pair, book, config } from "./research-fixture.ts";
const now = Date.now();
const identity = (competition = "nfl") => ({
  sports: true,
  competition,
  eventDate: "2026-09-12",
  participants: ["Cleveland Browns", "Cincinnati Bengals"],
  home: "Cleveland Browns",
  away: "Cincinnati Bengals",
  marketType: "winner",
  period: "full event",
});
const mapping = (id = "p") => ({
  id,
  pair: pair(id),
  status: "UNVERIFIED",
  active: true,
  reason: null,
  createdAt: now,
  lastVerifiedAt: null,
  normalized: {},
});
test("Canonical entities resolve reviewed aliases only within competition and prefer venue IDs", () => {
  const r = new EntityRegistry();
  assert.equal(r.resolve("Cleveland"), undefined);
  for (const [scope, id] of [
    ["nfl", "NFL:CLE"],
    ["nba", "NBA:CLE"],
    ["mlb", "MLB:CLE"],
  ])
    assert.equal(r.resolve("Cleveland", scope), id);
  assert.equal(r.resolve("Browns", "nba"), undefined);
  assert.equal(r.resolve("Carlos Alcaraz Garfia", "atp"), "ATP:CARLOS_ALCARAZ");
  r.add({
    id: "NFL:NY1",
    name: "New York A",
    scope: "nfl",
    aliases: ["New York"],
    venueIds: { poly: ["1"] },
  });
  r.add({
    id: "NFL:NY2",
    name: "New York B",
    scope: "nfl",
    aliases: ["New York"],
  });
  assert.equal(r.resolve("New York", "nfl"), undefined);
  assert.equal(r.resolve("New York", "nfl", "poly", "1"), "NFL:NY1");
});
test("Home and away normalize separately from unordered participants and are idempotent", () => {
  const r = catalogEntities([identity()]);
  const i = r.normalize(identity());
  assert.equal(i.home, "NFL:CLE");
  assert.equal(i.away, "NFL:CIN");
  assert.deepEqual(r.normalize(i), i);
});
test("Candidate identity never verifies; rules, sources and cancellation differences stay visible", () => {
  const m = mapping();
  m.pair.a.identity = identity();
  m.pair.b.identity = identity();
  m.pair.a.rules = "According to NFL. Overtime included. Canceled games void.";
  m.pair.b.rules =
    "According to ESPN. Regulation only. Postponed games rescheduled.";
  const r = reviewPackage(m);
  assert.equal(m.status, "UNVERIFIED");
  assert.equal(r.status, "HIGH_PRIORITY_REVIEW");
  assert.ok(r.differ.includes("rules"));
  assert.ok(r.differ.includes("settlementSource"));
  assert.ok(r.differ.includes("cancellation"));
  assert.equal(r.kalshi.rules, m.pair.a.rules);
});
for (const [field, a, b] of [
  ["eventDate", "2026-09-12", "2026-09-13"],
  ["line", 3.5, 4.5],
  ["period", "full event", "first half"],
  ["marketType", "spread", "total"],
])
  test(`Review flags structural ${field} differences`, () => {
    const m = mapping();
    m.pair.a.identity = { ...identity(), [field]: a };
    m.pair.b.identity = { ...identity(), [field]: b };
    assert.equal(reviewPackage(m).status, "STRUCTURAL_CONFLICT");
  });
test("Review ordering rewards strong identity before activity and missing rules remain insufficient", () => {
  const strong = mapping("strong"),
    weak = mapping("weak");
  strong.pair.a.identity = identity();
  strong.pair.b.identity = identity();
  assert.equal(
    reviewQueue([weak, strong], { weak: { count: 100 } })[0].id,
    "strong",
  );
  strong.pair.b.rules = "";
  assert.equal(reviewPackage(strong).status, "INSUFFICIENT_RULE_DATA");
});
test("Pair capacity accounts for shared legs and every selected pair has both subscriptions", () => {
  const ms = Array.from({ length: 10 }, (_, i) => mapping(String(i)));
  ms[1].pair.a = ms[0].pair.a;
  const s = new CapacityScheduler(),
    r = s.select(ms, 3, 0, 10000, now);
  assert.ok(r.subscribed.kalshi.length <= 3);
  assert.ok(r.subscribed.poly.length <= 3);
  for (const id of r.selectedIds) {
    const m = ms.find((m) => m.id === id);
    assert.ok(r.subscribed.kalshi.includes(m.pair.a.id));
    assert.ok(r.subscribed.poly.includes(m.pair.b.id));
  }
  const shared = s.select(ms.slice(0, 2), 2, 0, 10000, now);
  assert.equal(shared.selected, 2);
  assert.equal(shared.subscribed.kalshi.length, 1);
});
test("Verified mapping wins allocation and exploration stays stable until rotation", () => {
  const ms = Array.from({ length: 30 }, (_, i) =>
    mapping(String(i).padStart(2, "0")),
  );
  ms[29].status = "MANUAL_VERIFIED";
  const s = new CapacityScheduler(),
    a = s.select(ms, 10, 0.2, 100000, 1000000),
    b = s.select(ms, 10, 0.2, 100000, 1000001),
    c = s.select(ms, 10, 0.2, 100000, 1100000);
  assert.ok(a.selectedIds.includes("29"));
  assert.equal(a.explorationMappings, 2);
  assert.deepEqual(a.selectedIds, b.selectedIds);
  assert.notDeepEqual(a.explorationIds, c.explorationIds);
  assert.ok(c.selectedIds.includes("29"));
});
test("Rotating reconciliation deduplicates markets, rate limits calls and visits every market", () => {
  const m = pair(),
    s = new ReconciliationScheduler();
  assert.equal(s.take([m.a, m.a, m.b], 0, 1, 100).length, 1);
  assert.equal(s.take([m.a, m.b], 50, 1, 100).length, 0);
  assert.equal(s.take([m.a, m.b], 100, 1, 100)[0].venue, "poly");
});
function recorder(verified = false) {
  const s = new ResearchStore(":memory:"),
    r = new MappingRegistry(s),
    p = pair();
  r.add(p, now);
  if (verified) r.verify(p.id, "MANUAL_VERIFIED", "fixture reviewed", now);
  return { s, r, p, rec: new Recorder(s, r, config, "fixture", now) };
}
test("Unrelated book updates remain in bounded five-second history without growing database", () => {
  const { s, rec } = recorder();
  for (let t = 0; t < 20000; t += 10)
    rec.update(book("kalshi", "unrelated", t, now + t));
  assert.equal(s.rows("book_updates").length, 0);
  assert.ok(rec.history.get("kalshi:unrelated").length <= 503);
  s.close();
});
test("Opening captures both anchors, pre-event history, active changes, and post-close evidence", () => {
  const { s, rec, p } = recorder();
  rec.update({
    ...book("kalshi", p.a.id, 0, now),
    yes: [{ price: 7000, quantity: 100 }],
  });
  rec.update(book("poly", p.b.id, 1, now + 1));
  assert.equal(s.rows("book_updates").length, 0);
  rec.update(book("kalshi", p.a.id, 100, now + 100));
  assert.equal(s.rows("opportunities").length, 1);
  assert.equal(s.rows("book_updates").length, 3);
  rec.update({
    ...book("poly", p.b.id, 150, now + 150),
    no: [{ price: 9000, quantity: 100 }],
  });
  rec.update(book("kalshi", p.a.id, 2000, now + 2000));
  assert.equal(s.rows("book_updates").length, 5);
  assert.equal(
    JSON.parse(s.rows("opportunities")[0].body).verification,
    "UNVERIFIED",
  );
  analyzeLatency(s, rec.sessionId, 2200);
  assert.equal(s.rows("latency_tests").length, 0);
  s.close();
});
test("Every latency bucket reconstructs the exact as-of book through a closed window", () => {
  const { s, rec, p } = recorder(true);
  rec.update(book("kalshi", p.a.id, 0, now));
  rec.update(book("poly", p.b.id, 0, now));
  for (const t of latencyBuckets.slice(1))
    rec.update({
      ...book("poly", p.b.id, t - 1, now + t - 1),
      no: [{ price: 8000, quantity: 100 }],
    });
  rec.tick(now + 2200, 2200);
  analyzeLatency(s, rec.sessionId, 2200);
  const rows = s.rows("latency_tests");
  assert.equal(rows.length, 16);
  for (const row of rows) {
    const body = JSON.parse(row.body),
      b = s.rows("book_updates").find((b) => b.id === body.bBookId);
    assert.equal(b.mono, row.latency_ms === 0 ? 0 : row.latency_ms - 1);
    assert.ok(body.observationComplete);
  }
  s.close();
});
test("Restart censors active captures and never invents missing post-crash latency coverage", () => {
  const { s, r, rec, p } = recorder(true);
  rec.update(book("kalshi", p.a.id, 0, now));
  rec.update(book("poly", p.b.id, 0, now));
  const old = rec.sessionId;
  new Recorder(s, r, config, "fixture", now + 5000);
  assert.equal(s.rows("opportunities")[0].status, "CENSORED");
  analyzeLatency(s, old, 0, true);
  assert.equal(
    JSON.parse(s.rows("latency_tests").find((x) => x.latency_ms === 2000).body)
      .observationComplete,
    false,
  );
  s.close();
});
test("Freshness diagnostics keep healthy resting quotes separate without weakening strict gate", () => {
  const b = book("kalshi", "K", 0, now);
  assert.equal(
    freshnessResearch(b, 3000, now + 3000, 2000, true),
    "HEALTHY_RESTING_BOOK_RESEARCH",
  );
  assert.equal(
    freshnessResearch(b, 3000, now + 3000, 2000, false),
    "CONNECTION_UNHEALTHY",
  );
  assert.equal(
    freshnessResearch({ ...b, valid: false }, 0, now, 2000, true),
    "SEQUENCE_INVALID",
  );
  assert.equal(
    freshnessResearch(b, 0, now, 2000, true),
    "STRICT_EXECUTION_FRESH",
  );
});
test("Quarantined Kalshi market consumes sequence numbers but requires a snapshot; sibling stays valid", async () => {
  const { BookCache } = await import("../lib/research/books.ts");
  const c = new BookCache();
  const snapshot = (id, seq) => ({
    type: "orderbook_snapshot",
    sid: 1,
    seq,
    msg: {
      market_ticker: id,
      yes_dollars_fp: [["0.4", "10"]],
      no_dollars_fp: [["0.4", "10"]],
    },
  });
  c.kalshi(snapshot("a", 1), now, 0);
  c.kalshi(snapshot("b", 2), now, 0);
  c.quarantine("a");
  assert.equal(c.get("kalshi", "a").valid, false);
  assert.equal(c.get("kalshi", "b").valid, true);
  assert.equal(
    c.kalshi(
      {
        type: "orderbook_delta",
        sid: 1,
        seq: 3,
        msg: {
          market_ticker: "a",
          side: "yes",
          price_dollars: "0.4",
          delta_fp: "1",
        },
      },
      now,
      1,
    ),
    null,
  );
  c.kalshi(snapshot("a", 4), now, 2);
  assert.equal(c.get("kalshi", "a").valid, true);
  assert.equal(c.get("kalshi", "a").yesBids[0].quantity, 10);
});
test("Shard disconnect records cause and context without interrupting a sibling connection", async () => {
  const { WebSocketServer } = await import("ws");
  const { once } = await import("node:events");
  const { StreamConnection } = await import("../worker/streams.ts");
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(server, "listening");
  const diagnostics = [];
  const make = (id) =>
    new StreamConnection({
      venue: "kalshi",
      ids: [id],
      url: `ws://127.0.0.1:${server.address().port}`,
      headers: () => ({}),
      onMessage: () => {},
      onInvalid: () => {},
      onDiagnostic: (kind, body) => diagnostics.push({ kind, body }),
      context: () => ({ persistenceBacklog: 3, discoveryActive: true }),
      retryMs: 20,
    });
  const a = make("a"),
    b = make("b");
  a.start();
  b.start();
  try {
    const until = Date.now() + 2000;
    while (
      (!a.health().connected || !b.health().connected) &&
      Date.now() < until
    )
      await new Promise((r) => setTimeout(r, 10));
    a.recover("TEST_RECOVERY");
    while (
      !diagnostics.some((d) => d.kind === "DISCONNECT_DETAIL") &&
      Date.now() < until
    )
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(b.health().connected, true);
    assert.equal(b.health().reconnectCount, 0);
    const d = diagnostics.find((d) => d.kind === "DISCONNECT_DETAIL").body;
    assert.equal(d.recoveryReason, "TEST_RECOVERY");
    assert.equal(d.initiator, "client");
    assert.equal(d.persistenceBacklog, 3);
    assert.equal(typeof d.closeCode, "number");
    assert.equal(d.markets, 1);
    assert.ok(d.shard);
  } finally {
    a.stop();
    b.stop();
    for (const c of server.clients) c.terminate();
    await new Promise((r) => server.close(r));
  }
});
test("Structured general identities normalize deterministically and preserve unknown fields", () => {
  const r = new EntityRegistry(),
    i = {
      sports: false,
      participants: [],
      general: {
        person: "Jane Doe",
        asset: "Bitcoin",
        ticker: "ACME",
        company: "Acme Corp",
        jurisdiction: "New York",
        indicator: "CPI",
      },
    };
  const a = r.normalize(i);
  assert.equal(a.general.asset, "CRYPTO:BTC");
  assert.equal(a.general.company, "COMPANY:ACME");
  assert.equal(a.general.person, "PERSON:JANE_DOE");
  assert.deepEqual(r.normalize(a), a);
});
test("Unsubscribed ring histories expire while post-opportunity evidence remains pinned", () => {
  const { rec, s, p } = recorder();
  rec.update(book("kalshi", p.a.id, 0, now));
  rec.update(book("poly", p.b.id, 0, now));
  rec.retainedKeys = new Set();
  rec.tick(now + 100, 100);
  assert.ok(rec.history.size > 0);
  rec.tick(now + 6000, 6000);
  rec.tick(now + 9000, 9000);
  assert.equal(rec.history.size, 0);
  assert.equal(s.rows("opportunities")[0].status, "CENSORED");
  s.close();
});
test("Reconciliation alternates venues before exhausting a large unseen Kalshi catalog", () => {
  const s = new ReconciliationScheduler(),
    ms = Array.from({ length: 500 }, (_, i) => pair(String(i)).a).concat([
      pair("poly").b,
    ]);
  assert.equal(s.take(ms, 0, 1, 100)[0].venue, "kalshi");
  assert.equal(s.take(ms, 100, 1, 100)[0].venue, "poly");
});
