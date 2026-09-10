import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BookCache } from "../lib/research/books.ts";
import { ResearchStore } from "../lib/research/store.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { evaluate } from "../lib/research/detector.ts";
import { Recorder } from "../lib/research/recorder.ts";
import { feeSchedule, feesForLevels } from "../lib/research/fees.ts";

export const now = 1800000000000;
export const market = (venue, id = venue) => ({
  id,
  venue,
  title: "Threshold",
  outcome: "Yes",
  opposite: "No",
  category: "Economics",
  rules: "Test settlement source and void handling",
  url: "https://example.com",
  closeAt: new Date(now + 86400000).toISOString(),
  open: true,
  feeRate: venue === "kalshi" ? 700 : 600,
  feeRounding: venue === "kalshi" ? "ceil" : "even",
  minQty: 1,
  hash: "rules",
  settlement: null,
});
export const pair = () => ({
  id: "pair",
  a: market("kalshi"),
  b: market("poly"),
  inverted: false,
  reviewed: true,
});
export const book = (venue, yes = 4000, no = 7000, mono = 0, q = 20) => ({
  venue,
  marketId: venue,
  yes: [{ price: yes, quantity: q }],
  no: [{ price: no, quantity: q }],
  yesBids: [{ price: 3000, quantity: q }],
  noBids: [{ price: 2000, quantity: q }],
  receivedAt: now + mono,
  receivedMono: mono,
  exchangeAt: now + mono,
  sequence: 1,
  connection: "LIVE",
  valid: true,
  open: true,
  source: "stream",
});
export const config = {
  maxAgeMs: 2000,
  reserve: 100,
  minProfit: 1,
  minRoi: 1,
  bankrolls: [1000000, 2500000, 5000000, 10000000],
};
export const database = () =>
  new ResearchStore(
    join(mkdtempSync(join(tmpdir(), "lights-on-test-")), "research.sqlite"),
  );

test("Unknown fees fail closed; cumulative PM fee upper bound rounds once", () => {
  assert.equal(feeSchedule({ ...market("poly"), feeRate: null }), null);
  assert.equal(
    feesForLevels(
      [
        { price: 5000, quantity: 1 },
        { price: 5000, quantity: 1 },
      ],
      feeSchedule(market("poly")),
    ),
    300,
  );
  assert.equal(
    feesForLevels(
      [{ price: 5000, quantity: 1 }],
      feeSchedule(market("kalshi")),
    ),
    200,
  );
});
test("Kalshi snapshot then delta, zero deletion and sequence gap recovery", () => {
  const c = new BookCache();
  const snap = {
    type: "orderbook_snapshot",
    sid: 1,
    seq: 1,
    msg: {
      market_ticker: "kalshi",
      yes_dollars_fp: [["0.3000", "20.00"]],
      no_dollars_fp: [["0.6000", "20.00"]],
    },
  };
  c.kalshi(snap, now, 0);
  assert.equal(c.get("kalshi", "kalshi").yes[0].price, 4000);
  c.kalshi(
    {
      type: "orderbook_delta",
      sid: 1,
      seq: 2,
      msg: {
        market_ticker: "kalshi",
        side: "no",
        price_dollars: "0.6000",
        delta_fp: "-20.00",
        ts_ms: now + 1,
      },
    },
    now + 1,
    1,
  );
  assert.equal(c.get("kalshi", "kalshi").yes.length, 0);
  assert.throws(
    () => c.kalshi({ ...snap, type: "orderbook_delta", seq: 4 }, now + 2, 2),
    /sequence/i,
  );
  assert.equal(c.get("kalshi", "kalshi").valid, false);
  c.reset("kalshi");
  c.kalshi(snap, now + 3, 3);
  assert.equal(c.get("kalshi", "kalshi").valid, true);
});
test("Sequence numbers are subscription-scoped across markets", () => {
  const c = new BookCache();
  for (const [seq, id] of [
    [1, "a"],
    [2, "b"],
  ])
    c.kalshi(
      {
        type: "orderbook_snapshot",
        sid: 9,
        seq,
        msg: { market_ticker: id, yes_dollars_fp: [], no_dollars_fp: [] },
      },
      now,
      0,
    );
  c.kalshi(
    {
      type: "orderbook_delta",
      sid: 9,
      seq: 3,
      msg: {
        market_ticker: "a",
        side: "yes",
        price_dollars: ".3",
        delta_fp: "1.00",
      },
    },
    now,
    0,
  );
  assert.equal(c.get("kalshi", "a").yesBids[0].quantity, 1);
});
test("PM full snapshots replace depth; malformed books invalidate", () => {
  const c = new BookCache();
  const message = {
    marketData: {
      marketSlug: "poly",
      bids: [],
      offers: [{ px: { value: "0.4000", currency: "USD" }, qty: "3" }],
      state: "MARKET_STATE_OPEN",
      transactTime: new Date(now).toISOString(),
    },
  };
  c.poly(message, now, 0);
  c.poly(
    { ...message, marketData: { ...message.marketData, offers: [] } },
    now + 1,
    1,
  );
  assert.equal(c.get("poly", "poly").yes.length, 0);
  assert.throws(() =>
    c.poly(
      {
        ...message,
        marketData: {
          ...message.marketData,
          offers: [{ px: { value: "NaN", currency: "USD" }, qty: "3" }],
        },
      },
      now + 2,
      2,
    ),
  );
  assert.equal(c.get("poly", "poly").valid, false);
});
test("Mapping audit survives restart and invalidation cannot silently reverify", () => {
  const s = database(),
    r = new MappingRegistry(s);
  r.add(pair(), now);
  r.verify("pair", "MANUAL_VERIFIED", "reviewed source and voids", now);
  assert.equal(r.list()[0].status, "MANUAL_VERIFIED");
  r.refresh("pair", { ...pair().a, hash: "changed" }, pair().b, now + 1);
  assert.equal(r.list()[0].status, "INVALIDATED");
  assert.equal(r.list()[0].active, false);
  r.add(pair(), now + 2);
  assert.equal(r.list()[0].status, "INVALIDATED");
  assert.ok(s.rows("mapping_history").length >= 3);
  const path = s.path;
  s.close();
  const reopened = new ResearchStore(path);
  assert.equal(new MappingRegistry(reopened).list()[0].status, "INVALIDATED");
  reopened.close();
});
test("Detector evaluates both direct/inverted orientations and every shared whole quantity", () => {
  const p = pair();
  const a = book("kalshi"),
    b = book("poly", 7000, 4000);
  const result = evaluate(p, a, b, config, 0, now, true);
  assert.equal(result.length, 2);
  assert.equal(result[0].curve.length, 20);
  assert.ok(result[0].best.profit > 0);
  assert.equal(result[0].aSide, "yes");
  assert.equal(result[0].bSide, "no");
  const inverted = evaluate(
    { ...p, inverted: true },
    a,
    book("poly"),
    config,
    0,
    now,
    true,
  );
  assert.equal(inverted[0].bSide, "yes");
  assert.ok(inverted[0].best.profit > 0);
  assert.ok(
    evaluate(
      p,
      { ...a, valid: false },
      b,
      config,
      0,
      now,
      true,
    )[0].reasons.includes("BOOK_STALE"),
  );
  assert.ok(
    evaluate(p, a, b, config, 2001, now + 2001, true)[0].reasons.includes(
      "BOOK_STALE",
    ),
  );
  assert.ok(
    evaluate(p, a, b, config, 0, now, false)[0].reasons.includes(
      "MAPPING_UNVERIFIED",
    ),
  );
});
test("Persistent recorder keeps lifecycle updates without duplicate opportunities", () => {
  const s = database(),
    r = new MappingRegistry(s);
  r.add(pair(), now);
  r.verify("pair", "MANUAL_VERIFIED", "review", now);
  const rec = new Recorder(s, r, config, "fixture", now);
  rec.update(book("kalshi"));
  rec.update(book("poly", 7000, 4000));
  rec.update(book("poly", 7000, 3900, 50));
  assert.equal(s.rows("opportunities").length, 1);
  assert.equal(s.rows("opportunity_states").length, 2);
  rec.update(book("poly", 7000, 6500, 100));
  const op = s.rows("opportunities")[0];
  assert.equal(op.duration_ms, 100);
  assert.equal(op.status, "CLOSED");
  assert.equal(s.rows("opportunity_states").length, 3);
  rec.update(book("poly", 7000, 4000, 150));
  assert.equal(s.rows("opportunities").length, 2);
  rec.stop(now + 160, 160);
  assert.equal(s.rows("opportunities")[1].status, "CENSORED");
  s.close();
});

test("Structured candidate matching rejects conflicting fields and text alone never verifies", async () => {
  const { matchCandidates } = await import("../lib/research/matching.ts");
  const a = market("kalshi"),
    b = market("poly");
  const baseline = matchCandidates([a], [b]);
  assert.equal(baseline.length, 1);
  assert.equal(baseline[0].status, "UNVERIFIED");
  const structured = {
    event: "cpi",
    category: "Economics",
    entity: "US CPI",
    outcome: "above",
    opposite: "not above",
    threshold: "3",
    comparator: "gt",
    eventAt: "2026-09-10",
    resolutionDeadline: "2026-09-11",
    competition: "not applicable",
    resolutionSource: "BLS final publication",
    voidPolicy: "same void payout",
  };
  assert.equal(
    matchCandidates(
      [{ ...a, structured }],
      [{ ...b, structured: { ...structured, threshold: "4" } }],
    ).length,
    0,
  );
  assert.equal(
    matchCandidates([{ ...a, structured }], [{ ...b, structured }])[0].status,
    "AUTO_VERIFIED",
  );
});
test("Malformed and fractional-depth books cannot fabricate whole-quantity liquidity", () => {
  const result = evaluate(
    pair(),
    {
      ...book("kalshi"),
      yes: [
        { price: 4000, quantity: 0.5 },
        { price: 4100, quantity: 1.5 },
      ],
    },
    book("poly", 7000, 4000),
    config,
    0,
    now,
    true,
  )[0];
  assert.equal(result.maxQuantity, 1);
  assert.equal(result.best.quantity, 1);
  assert.equal(result.best.aFill.cost, 4100);
});

test("Temporary metadata failure blocks a mapping until a successful unchanged refresh", () => {
  const s = database(),
    r = new MappingRegistry(s);
  r.add(pair(), now);
  r.verify("pair", "MANUAL_VERIFIED", "review", now);
  r.deactivate("pair", "METADATA_UNAVAILABLE", now + 1);
  assert.equal(r.get("pair").active, false);
  r.refresh("pair", pair().a, pair().b, now + 2);
  assert.equal(r.get("pair").active, true);
  assert.equal(r.get("pair").status, "MANUAL_VERIFIED");
  s.close();
});

test("A larger lower-ROI size cannot hide a smaller qualifying hedge", () => {
  const p = pair();
  p.a.feeRate = 0;
  p.b.feeRate = 0;
  const a = {
    ...book("kalshi"),
    yes: [
      { price: 4000, quantity: 1 },
      { price: 5000, quantity: 1 },
    ],
  };
  const e = evaluate(
    p,
    a,
    book("poly", 7000, 4000, 0, 2),
    { ...config, reserve: 0, minRoi: 20 },
    0,
    now,
    true,
  )[0];
  assert.equal(e.best.quantity, 1);
  assert.equal(e.reasons.length, 0);
  assert.equal(e.bankroll["1000000"].quantity, 1);
});

test("Venue category aliases and administrative expiry differences do not suppress manual-review candidates", async () => {
  const { matchCandidates } = await import("../lib/research/matching.ts");
  const a = {
    ...market("kalshi"),
    title: "Will Stephen Root win Comedy Supporting Actor at the Emmy Awards?",
    outcome: "Stephen Root",
    category: "Entertainment",
  };
  const b = {
    ...market("poly"),
    title:
      "Stephen Root Widows Bay Emmys Outstanding Supporting Actor in a Comedy Series",
    category: "culture",
    closeAt: new Date(now + 14 * 86400000).toISOString(),
  };
  const matches = matchCandidates([a], [b]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].status, "UNVERIFIED");
});

test("Actual authenticated snapshots support omitted empty Kalshi sides and PM four-decimal quantities", async () => {
  const { readFileSync } = await import("node:fs");
  const frames = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/research/authenticated-books-2026-09-10.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const c = new BookCache();
  for (const f of frames) {
    const b =
      f.venue === "kalshi"
        ? c.kalshi(f.message, f.at, f.mono)
        : c.poly(f.message, f.at, f.mono);
    assert.ok(b?.valid);
  }
  assert.equal(c.get("kalshi", "KXEMMYCSACTO-26SEP14-TIE").yesBids.length, 0);
  assert.equal(
    c.get("poly", "mlaec-swepm-2026-09-13-noodad").yesBids[0].quantity,
    47.99,
  );
});

test("Accepted fractional quantity precision is preserved across snapshot and delta", () => {
  const c = new BookCache();
  c.kalshi(
    {
      type: "orderbook_snapshot",
      sid: 1,
      seq: 1,
      msg: {
        market_ticker: "precision",
        yes_dollars_fp: [["0.40", "1.0001"]],
      },
    },
    now,
    0,
  );
  const b = c.kalshi(
    {
      type: "orderbook_delta",
      sid: 1,
      seq: 2,
      msg: {
        market_ticker: "precision",
        side: "yes",
        price_dollars: "0.40",
        delta_fp: "0.0001",
      },
    },
    now + 1,
    1,
  );
  assert.equal(b?.yesBids[0].quantity, 1.0002);
});
