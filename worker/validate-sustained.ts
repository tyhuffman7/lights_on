// Bounded, authenticated read-only market observation. Never creates orders.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { ResearchStore } from "../lib/research/store.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { historicalActivity } from "../lib/research/review-history.ts";
import { Observer } from "./observer.ts";
import { configSchema, lease } from "./config.ts";
import { dashboardServer } from "./server.ts";
import { once } from "node:events";
const seconds = Number(process.argv[2] ?? 900),
  output = process.argv[3] ?? "work/sustained/live";
if (!Number.isFinite(seconds) || seconds < 30 || seconds > 7200)
  throw new Error("Observation must be 30–7200 seconds");
mkdirSync(output, { recursive: true });
if (existsSync(".env.research")) process.loadEnvFile(".env.research");
const path = output + "/observer.sqlite";
if (existsSync(path))
  throw new Error("Use a new output directory to preserve prior evidence");
const release = lease(path),
  store = new ResearchStore(path),
  source = new ResearchStore("research-data/research.sqlite", true);
const registry = new MappingRegistry(store);
for (const m of new MappingRegistry(source).list())
  if (
    m.active &&
    m.pair.a.open &&
    m.pair.b.open &&
    [m.pair.a, m.pair.b].every((x) => Date.parse(x.closeAt) > Date.now())
  )
    registry.add(m.pair, Date.now(), m.normalized);
const activity = historicalActivity(source);
for (const a of Object.values(activity)) {
  a.priorCount = a.count ?? 0;
  a.persistedBaseline = 0;
}
source.close();
const config = configSchema.parse({
  database: path,
  port: Number(process.argv[4] ?? 8793),
  markets: [],
  discoveryEnabled: true,
});
const observer = new Observer(store, config);
let server: ReturnType<typeof dashboardServer> | undefined;
const samples: any[] = [];
const bytes = () =>
  Number((store.db.prepare("PRAGMA page_count").get() as any).page_count) *
  Number((store.db.prepare("PRAGMA page_size").get() as any).page_size);
try {
  await observer.initialize();
  observer.recorder.activity = activity;
  server = dashboardServer(observer, process.env.RESEARCH_CONTROL_TOKEN ?? "");
  await once(server, "listening");
  const initialBytes = bytes(),
    startedAt = Date.now();
  observer.resume();
  console.log(
    `Authenticated PAPER_RESEARCH validation running on port ${config.port}`,
  );
  let finish!: () => void;
  const done = new Promise<void>((r) => (finish = r));
  const timer = setTimeout(finish, seconds * 1000);
  process.once("SIGINT", finish);
  process.once("SIGTERM", finish);
  const sample = () => {
    samples.push({
      ...observer.compactHealth(),
      at: Date.now(),
      databaseLogicalBytes: bytes(),
    });
    writeFileSync(
      output + "/progress.json",
      JSON.stringify({ startedAt, initialBytes, samples }),
    );
  };
  const interval = setInterval(sample, 10000);
  await done;
  clearTimeout(timer);
  clearInterval(interval);
  sample();
  const beforeStop = observer.health();
  await observer.stop();
  const finalBytes = bytes(),
    elapsedMs = Date.now() - startedAt,
    growthBytesPerHour = ((finalBytes - initialBytes) * 3600000) / elapsedMs;
  const result = {
    startedAt,
    elapsedMs,
    initialBytes,
    finalBytes,
    growthBytesPerHour,
    projectedGBPerDay: (growthBytesPerHour * 24) / 1e9,
    reductionVs318GBPerHour: 3.18e9 / growthBytesPerHour,
    coverage: beforeStop.coverage,
    storage: beforeStop.storage,
    telemetry: beforeStop.telemetry,
    streams: beforeStop.streams,
    persistence: beforeStop.persistence,
    discovery: beforeStop.discovery,
    sessionId: observer.recorder.sessionId,
    samples,
    interpretation:
      "Bounded read-only research sample, not multi-day reliability proof. 3.18 GB/hour is the earlier approximate user baseline. Logical SQLite allocation avoids WAL checkpoint double-counting.",
  };
  writeFileSync(
    output + "/validation.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      elapsedMs,
      growthBytesPerHour,
      projectedGBPerDay: result.projectedGBPerDay,
      reduction: result.reductionVs318GBPerHour,
      processed: beforeStop.storage.processed,
      persisted: beforeStop.storage.persisted,
    }),
  );
} finally {
  server?.close();
  if (!observer.stopped) await observer.stop();
  store.close();
  release();
}
