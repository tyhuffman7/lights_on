// Bounded, read-only observer for an explicit research shortlist. No trading API.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { ResearchStore } from "../lib/research/store.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { Observer } from "./observer.ts";
import { configSchema, lease } from "./config.ts";
import type { Pair } from "../lib/arb/types.ts";
const [input, output, secondsText = "300"] = process.argv.slice(2),
  seconds = Number(secondsText);
if (
  !input ||
  !output ||
  !Number.isInteger(seconds) ||
  seconds < 30 ||
  seconds > 1800
)
  throw Error(
    "Usage: pilot-observe.ts PAIRS_JSON NEW_OUTPUT_DIRECTORY SECONDS(30..1800)",
  );
const pairs: Pair[] = JSON.parse(readFileSync(input, "utf8"));
if (
  !Array.isArray(pairs) ||
  !pairs.length ||
  pairs.length > 500 ||
  new Set(pairs.map((p) => p.id)).size !== pairs.length
)
  throw Error("Expected 1..500 distinct pairs");
if (existsSync(output))
  throw Error("Output directory must be new to preserve evidence");
mkdirSync(output, { recursive: true });
if (existsSync(".env.research")) process.loadEnvFile(".env.research");
const path = output + "/observer.sqlite",
  release = lease(path),
  store = new ResearchStore(path);
const registry = new MappingRegistry(store);
for (const p of pairs)
  registry.add({ ...p, reviewed: false }, Date.now(), {
    source: "explicit research shortlist",
  });
const observer = new Observer(
  store,
  configSchema.parse({
    database: path,
    discoveryEnabled: false,
    maxSubscribedMarketsPerVenue: 500,
  }),
);
const startedAt = Date.now();
let interval: ReturnType<typeof setInterval> | undefined;
try {
  await observer.initialize();
  observer.resume();
  console.log(
    JSON.stringify({
      mode: "READ_ONLY_RESEARCH",
      pairs: pairs.length,
      seconds,
    }),
  );
  interval = setInterval(
    () =>
      writeFileSync(
        output + "/progress.json",
        JSON.stringify({ at: Date.now(), ...observer.compactHealth() }),
      ),
    10000,
  );
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, seconds * 1000);
    const finish = () => {
      clearTimeout(t);
      resolve();
    };
    process.once("SIGINT", finish);
    process.once("SIGTERM", finish);
  });
  const beforeStop = observer.health();
  await observer.stop();
  writeFileSync(
    output + "/result.json",
    JSON.stringify(
      {
        startedAt,
        endedAt: Date.now(),
        requestedSeconds: seconds,
        pairCount: pairs.length,
        scope: pairs.reduce(
          (a, p) => {
            const c = p.a.category;
            a[c] = (a[c] ?? 0) + 1;
            return a;
          },
          {} as Record<string, number>,
        ),
        beforeStop,
        interpretation:
          "Shortlist research only; no approval, orders or fills. Short sample cannot establish opportunity frequency or future income.",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      processed: beforeStop.storage.processed,
      persisted: beforeStop.storage.persisted,
      completed: true,
    }),
  );
} finally {
  if (interval) clearInterval(interval);
  if (!observer.stopped) await observer.stop();
  store.close();
  release();
}
