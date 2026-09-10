import { mkdtempSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir, cpus, platform, arch, release } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { ResearchStore } from "../lib/research/store.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { BookCache } from "../lib/research/books.ts";
import { LiveRecorder } from "./live-recorder.ts";
import { Telemetry } from "./telemetry.ts";
import { researchDefaults } from "../lib/research/types.ts";
import type { Market, Venue } from "../lib/arb/types.ts";
export async function loadStage(
  mappings: number,
  targetUpdatesPerSecond: number,
  durationMs = 6000,
  reportIntervalMs = 0,
) {
  const dir = mkdtempSync(join(tmpdir(), "lights-scale-")),
    path = join(dir, "research.sqlite"),
    s = new ResearchStore(path),
    r = new MappingRegistry(s);
  const market = (venue: Venue, id: string): Market => ({
    id,
    venue,
    title: "Synthetic load event " + id,
    outcome: "Yes",
    opposite: "No",
    category: "Economics",
    rules: "Synthetic load equivalence only",
    url: "https://example.com",
    closeAt: new Date(Date.now() + 86400000).toISOString(),
    open: true,
    feeRate: venue === "kalshi" ? 700 : 600,
    feeRounding: venue === "kalshi" ? "ceil" : "even",
    minQty: 1,
    hash: "fixture",
    settlement: null,
  });
  for (let i = 0; i < mappings; i++) {
    r.add({
      id: "pair" + i,
      a: market("kalshi", "K" + i),
      b: market("poly", "P" + i),
      inverted: false,
      reviewed: false,
    });
    r.verify("pair" + i, "MANUAL_VERIFIED", "Synthetic load fixture only");
  }
  const telemetry = new Telemetry(),
    rec = new LiveRecorder(
      path,
      r,
      researchDefaults,
      telemetry,
      () => {},
      2000,
      "fixture",
    );
  await rec.ready;
  rec.reindex();
  const caches = Array.from(
      { length: Math.ceil(mappings / 100) },
      () => new BookCache(),
    ),
    seq = caches.map(() => 0);
  const send = (index: number) => {
    const venue = index % 2 ? "poly" : "kalshi",
      i = Math.floor(index / 2) % mappings,
      shard = Math.floor(i / 100),
      mono = performance.now(),
      wall = Date.now();
    const levels = Array.from({ length: 5 }, (_, j) => ({
      px: {
        value: ((venue === "poly" ? 6000 : 3000) - j * 100) / 10000 + "",
        currency: "USD",
      },
      qty: "200.0000",
    }));
    const data =
      venue === "kalshi"
        ? {
            type: "orderbook_snapshot",
            sid: 1,
            seq: ++seq[shard],
            msg: {
              market_ticker: "K" + i,
              yes_dollars_fp: levels.map((l) => [l.px.value, l.qty]),
              no_dollars_fp: levels.map((l, j) => [
                (6000 - j * 100) / 10000 + "",
                l.qty,
              ]),
              ts_ms: wall,
            },
          }
        : {
            marketData: {
              marketSlug: "P" + i,
              bids: levels,
              offers: levels.map((l, j) => ({
                px: { value: (7000 + j * 100) / 10000 + "", currency: "USD" },
                qty: l.qty,
              })),
              transactTime: new Date(wall).toISOString(),
              state: "MARKET_STATE_OPEN",
            },
          };
    const frame = JSON.parse(JSON.stringify(data));
    const b =
      venue === "kalshi"
        ? caches[shard].kalshi(frame, wall, mono)
        : caches[shard].poly(frame, wall, mono);
    telemetry.count("messages");
    if (b) rec.update(b);
  };
  let maxBacklog = 0,
    maxBytes = 0,
    updates = 0,
    stopReason: string | null = null;
  const size = () =>
    [path, path + "-wal"].reduce((n, p) => {
      try {
        return n + statSync(p).size;
      } catch {
        return n;
      }
    }, 0);
  try {
    for (let i = 0; i < mappings * 2; i++) {
      send(i);
      if (i % 20 === 19) await delay(5);
    }
    await rec.report();
    telemetry.counters = {};
    telemetry.samples = {};
    telemetry.sampleOffsets = {};
    telemetry.windowCounts = {};
    telemetry.started = telemetry.windowAt = performance.now();
    telemetry.cpu = process.cpuUsage();
    telemetry.loop.reset();
    const bytesStart = size(),
      started = performance.now();
    let lastTick = started,
      lastAnalysis = started,
      lastReport = started;
    let pendingReport: Promise<unknown> | null = null;
    let reportCount = 0;
    while (performance.now() - started < durationMs) {
      const due = Math.floor(
        ((performance.now() - started) * targetUpdatesPerSecond) / 1000,
      );
      while (updates < due) {
        send(updates++);
        maxBacklog = Math.max(maxBacklog, rec.backlog);
        maxBytes = Math.max(maxBytes, rec.backlogBytes);
        if (rec.failed || maxBacklog > 1000) {
          stopReason = "PERSISTENCE_BACKLOG";
          break;
        }
      }
      if (stopReason) break;
      const now = performance.now();
      if (now - lastTick >= 100) {
        rec.tick(Date.now(), now);
        lastTick = now;
      }
      if (now - lastAnalysis >= 2000) {
        rec.analyze(now);
        lastAnalysis = now;
      }
      if (
        reportIntervalMs &&
        now - lastReport >= reportIntervalMs &&
        !pendingReport
      ) {
        lastReport = now;
        pendingReport = rec
          .report()
          .then(() => {
            reportCount++;
          })
          .finally(() => {
            pendingReport = null;
          });
      }
      const metrics = telemetry.snapshot();
      if ((metrics.latencyMs.processing?.p99 ?? 0) > 20) {
        stopReason = "PROCESSING_P99_OVER_20MS";
        break;
      }
      if ((metrics.latencyMs.persistenceAck?.p99 ?? 0) > 250) {
        stopReason = "PERSISTENCE_P99_OVER_250MS";
        break;
      }
      if (metrics.eventLoopMs.p99 > 100) {
        stopReason = "EVENT_LOOP_P99_OVER_100MS";
        break;
      }
      await delay(10);
    }
    const elapsed = performance.now() - started;
    if (pendingReport) await pendingReport;
    await rec.send("tick", { wall: Date.now(), mono: performance.now() });
    const measurements = telemetry.snapshot(),
      bytesEnd = size();
    await rec.stop(Date.now(), performance.now());
    const count = Number(
      s.db
        .prepare("SELECT COUNT(*) AS n FROM book_updates WHERE session_id=?")
        .get(rec.sessionId)!.n,
    );
    if (count !== updates + mappings * 2)
      throw new Error("Evidence count mismatch");
    return {
      mode: "fixture",
      concurrentReports: reportCount,
      reportIntervalMs,
      mappings,
      subscribedMarkets: { kalshi: mappings, poly: mappings },
      shardsPerVenue: caches.length,
      targetUpdatesPerSecond,
      durationMs: elapsed,
      updates,
      updatesPerSecond: updates / (elapsed / 1000),
      evaluationsPerSecond:
        (measurements.counters.evaluations ?? 0) / (elapsed / 1000),
      measurements,
      maxBacklog,
      maxQueueBytes: maxBytes,
      persistenceDrained: rec.backlog === 0,
      databaseGrowthBytesPerSecond: (bytesEnd - bytesStart) / (elapsed / 1000),
      bookRecords: count,
      stopReason,
      passed: stopReason === null,
    };
  } finally {
    telemetry.close();
    if (!rec.closing) await rec.stop(Date.now(), performance.now());
    s.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const output = process.argv[2] ?? "research-data/scale-results.json";
  const stages = [];
  for (const [n, rate] of [
    [30, 200],
    [100, 400],
    [250, 800],
    [500, 1000],
  ]) {
    const result = await loadStage(n, rate);
    stages.push(result);
    console.log(
      JSON.stringify({
        mappings: n,
        rate: result.updatesPerSecond,
        processing: result.measurements.latencyMs.processing,
        persistence: result.measurements.latencyMs.persistenceAck,
        stopReason: result.stopReason,
      }),
    );
    if (!result.passed) break;
  }
  const report = {
    at: new Date().toISOString(),
    runtime: process.version,
    host: {
      platform: platform(),
      release: release(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
    },
    workload:
      "Synthetic JSON snapshots, five levels per side, 1000 contracts depth; real parser/evaluator/worker SQLite WAL; latency analysis every 2s; no exchange/network performance claim",
    thresholds: {
      processingP99Ms: 20,
      persistenceAckP99Ms: 250,
      eventLoopP99Ms: 100,
      maxBacklog: 1000,
    },
    stages,
  };
  mkdirSync(join(output, ".."), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  if (stages.some((s) => !s.passed)) process.exitCode = 1;
}
