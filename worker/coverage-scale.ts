// Synthetic catalog matching runs in a worker while the actual parser/evaluator/
// SQLite pipeline and report reader handle a staged load on the main thread.
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { setImmediate as yieldThread } from "node:timers/promises";
import { discoverCandidates } from "../lib/research/matching.ts";
import { loadStage } from "./scale.ts";
import type { Market, Venue } from "../lib/arb/types.ts";
const catalogSize = 25000;
if (!isMainThread) {
  const make = (venue: Venue): Market[] =>
    Array.from({ length: catalogSize }, (_, n) => ({
      id: venue + n,
      venue,
      title: `Synthetic participant ${n} versus opponent ${n}`,
      outcome: "Yes",
      opposite: "No",
      category: "Sports",
      rules: "Synthetic fixture, not settlement proof",
      url: "https://example.com",
      closeAt: "2099-01-01T00:00:00Z",
      open: true,
      feeRate: 700,
      feeRounding: "ceil",
      minQty: 1,
      hash: "fixture",
      settlement: null,
      identity: {
        sports: true,
        competition: "fixture",
        participants: [`participant ${n}`, `opponent ${n}`],
        outcome: `participant ${n}`,
        eventDate: "2099-01-01",
        marketType: "winner",
        period: "full event",
        entities: [],
        numbers: [],
      },
    }));
  const a = make("kalshi"),
    b = make("poly");
  parentPort!.postMessage({ ready: true });
  while (true) {
    const started = performance.now(),
      result = discoverCandidates(a, b);
    if (
      result.candidates.length !== catalogSize ||
      result.candidates.some((c) => c.status !== "UNVERIFIED")
    )
      throw new Error(
        "Synthetic discovery coverage or verification regression",
      );
    parentPort!.postMessage({
      cycle: {
        durationMs: performance.now() - started,
        comparisons: result.diagnostics.comparisons,
        candidates: result.candidates.length,
      },
    });
    await yieldThread();
  }
} else {
  const worker = new Worker(new URL(import.meta.url), {
    execArgv: ["--experimental-strip-types"],
  });
  const cycles: {
    durationMs: number;
    comparisons: number;
    candidates: number;
  }[] = [];
  let workerError: Error | undefined;
  worker.on("error", (error) => {
    workerError = error;
  });
  worker.on("message", (message) => {
    if (message.cycle) cycles.push(message.cycle);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      worker.on("message", (message) => {
        if (message.ready) resolve();
      });
      worker.once("error", reject);
    });
    const result = await loadStage(500, 1000, 12000, 1000);
    if (workerError) throw workerError;
    const report = {
      at: new Date().toISOString(),
      mode: "fixture",
      catalogMarketsPerVenue: catalogSize,
      workload:
        "Repeated indexed matching of 25,000 sports markets per venue in a worker concurrent with 500 verified synthetic mappings, 1,000 target book updates/sec, SQLite persistence and reports every second. No network or fill claim.",
      completedDiscoveryCycles: cycles.length,
      cycles,
      result,
      passed:
        result.passed && cycles.length > 0 && result.concurrentReports > 0,
    };
    const output = process.argv[2] ?? "research-data/coverage-scale.json";
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(
      JSON.stringify({
        passed: report.passed,
        cycles: cycles.length,
        throughput: result.updatesPerSecond,
        latency: result.measurements.latencyMs,
        eventLoop: result.measurements.eventLoopMs,
      }),
    );
    if (!report.passed) process.exitCode = 1;
  } finally {
    await worker.terminate();
  }
}
