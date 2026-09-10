import { test } from "node:test";
import assert from "node:assert/strict";
import { Telemetry, percentiles } from "../worker/telemetry.ts";
test("Telemetry measures bounded samples and explicit interval rates with deterministic clocks", () => {
  let now = 0;
  const t = new Telemetry(() => now);
  try {
    assert.equal(t.snapshot().rates.messages, undefined);
    assert.equal(t.snapshot().cpuPercent, 0);
    t.count("messages", 20);
    now = 2000;
    assert.equal(t.snapshot(true).intervalRates.messages, 10);
    t.count("messages", 10);
    now = 4000;
    assert.equal(t.snapshot().intervalRates.messages, 5);
    assert.equal(t.snapshot().rates.messages, 7.5);
    t.sample("processing", NaN);
    t.sample("processing", Infinity);
    assert.equal(t.snapshot().latencyMs.processing, undefined);
    for (let n = 0; n < 10002; n++) t.sample("processing", n);
    assert.equal(t.samples.processing.length, 10000);
    assert.equal(Math.min(...t.samples.processing), 2);
    assert.deepEqual(percentiles([5, 1, 4, 3, 2]), {
      count: 5,
      p50: 3,
      p95: 4,
      p99: 4,
    });
    assert.equal(percentiles([]).p99, null);
    const other = new Telemetry(() => now);
    assert.deepEqual(other.snapshot().counters, {});
    other.close();
  } finally {
    t.close();
  }
});
