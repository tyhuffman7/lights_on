import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../lib/research/detector.ts";
import { evaluate as reference } from "./detector-reference.ts";
import { sizes, Depth } from "../lib/research/sizing.ts";
const now = 1800000000000;
const m = (venue) => ({
  id: venue,
  venue,
  title: "Fixture",
  outcome: "Yes",
  opposite: "No",
  category: "Economics",
  rules: "fixture",
  url: "https://example.com",
  closeAt: new Date(now + 86400000).toISOString(),
  open: true,
  feeRate: venue === "kalshi" ? 700 : 600,
  feeRounding: venue === "kalshi" ? "ceil" : "even",
  minQty: 1,
  hash: "x",
  settlement: null,
});
let seed = 8123;
const rand = (n) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed % n;
};
test("Randomized optimized detector is equivalent to exhaustive canonical sizing", () => {
  for (let i = 0; i < 5000; i++) {
    const p = {
      id: "p",
      a: m("kalshi"),
      b: m("poly"),
      inverted: !!rand(2),
      reviewed: true,
    };
    p.a.feeRate = rand(10001);
    p.b.feeRate = i % 3 ? rand(10001) : 0;
    p.a.minQty = 1 + rand(4);
    const levels = () =>
      Array.from({ length: 1 + rand(5) }, (_, j) => ({
        price: 500 + j * 1700 + rand(499),
        quantity: 1 + rand(13) + rand(100) / 100,
      }));
    const book = (venue) => ({
      venue,
      marketId: venue,
      yes: levels(),
      no: levels(),
      yesBids: [],
      noBids: [],
      receivedAt: now,
      receivedMono: 0,
      exchangeAt: now,
      sequence: 1,
      connection: "LIVE",
      valid: true,
      open: true,
      source: "fixture",
    });
    const a = book("kalshi"),
      b = book("poly"),
      c = {
        maxAgeMs: 2000,
        reserve: rand(501),
        minProfit: rand(100000),
        minRoi: rand(100),
        bankrolls: [10000, 50000, 100000, 1000000],
      };
    const actual = evaluate(p, a, b, c, 0, now, true),
      expected = reference(p, a, b, c, 0, now, true);
    for (let j = 0; j < 2; j++)
      assert.equal(
        Math.max(...actual[j].curve.map((q) => q.feeProfit)),
        Math.max(...expected[j].curve.map((q) => q.feeProfit)),
        `fee maximum case ${i}`,
      );
    for (let j = 0; j < 2; j++)
      for (const key of [
        "best",
        "bestGross",
        "bankroll",
        "reasons",
        "maxQuantity",
      ])
        assert.deepEqual(
          actual[j][key],
          expected[j][key],
          `seed case ${i} side ${j} ${key}`,
        );
  }
});
test("Million-contract depth uses bounded probes instead of a full quantity walk", () => {
  const a = new Depth([{ price: 4000, quantity: 1000000 }], {
      rate: 700,
      rounding: "ceil",
      aggregation: "level",
      source: "fixture",
    }),
    b = new Depth([{ price: 4000, quantity: 1000000 }], {
      rate: 600,
      rounding: "even",
      aggregation: "order",
      source: "fixture",
    });
  const r = sizes(a, b, 1, 1000000, {
    maxAgeMs: 2000,
    reserve: 100,
    minProfit: 1,
    minRoi: 1,
    bankrolls: [1000000, 2500000, 5000000, 10000000],
  });
  assert.equal(r.best?.quantity, 1000000);
  assert.ok(r.probes < 500, `probes=${r.probes}`);
});

test("Zero-fee sizing finds qualifying interior when segment endpoints fail different gates", () => {
  const schedule = {
    rate: 0,
    rounding: "ceil" as const,
    aggregation: "level" as const,
    source: "fixture",
  };
  const a = new Depth(
    [
      { price: 1000, quantity: 1 },
      { price: 4500, quantity: 100 },
    ],
    schedule,
  );
  const b = new Depth([{ price: 4000, quantity: 101 }], {
    ...schedule,
    rounding: "even",
    aggregation: "order",
  });
  const result = sizes(a, b, 1, 101, {
    maxAgeMs: 2000,
    reserve: 0,
    minProfit: 8000,
    minRoi: 20,
    bankrolls: [],
  });
  assert.equal(result.best?.quantity, 21);
  assert.equal(result.best?.roi, 20);
});
