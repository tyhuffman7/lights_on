import { parentPort, workerData } from "node:worker_threads";
import { catalog } from "./coverage.ts";
import { discoverCandidates } from "../lib/research/matching.ts";
try {
  const data = await catalog(undefined, undefined, (progress) =>
    parentPort!.postMessage({ progress }),
  );
  parentPort!.postMessage({ progress: { phase: "matching" } });
  const started = performance.now(),
    matched = discoverCandidates(data.kalshi, data.poly);
  const needed = new Set<string>(workerData?.existing ?? []);
  for (const c of matched.candidates) {
    needed.add("kalshi:" + c.pair.a.id);
    needed.add("poly:" + c.pair.b.id);
  }
  const catalogCounts = { kalshi: data.kalshi.length, poly: data.poly.length };
  data.kalshi = data.kalshi.filter((m) => needed.has("kalshi:" + m.id));
  data.poly = data.poly.filter((m) => needed.has("poly:" + m.id));
  parentPort!.postMessage({
    done: true,
    data,
    matched: { ...matched, catalogCounts },
    matchingMs: performance.now() - started,
  });
} catch {
  parentPort!.postMessage({ error: "DISCOVERY_FAILED" });
}
