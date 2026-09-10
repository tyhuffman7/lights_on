import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { ResearchStore } from "../lib/research/store.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { Recorder } from "../lib/research/recorder.ts";
import { researchDefaults } from "../lib/research/types.ts";
import { analyzeLatency } from "../lib/research/latency.ts";
import { researchReport } from "../lib/research/report.ts";
import { readConfig, lease } from "./config.ts";
import { Observer } from "./observer.ts";
import { dashboardServer } from "./server.ts";
import { BookCache } from "../lib/research/books.ts";
const command = process.argv[2] ?? "observe";
async function main() {
  if (command === "init") {
    if (!existsSync(".env.research"))
      writeFileSync(
        ".env.research",
        `# Local secrets. Ignored by Git. Never paste keys into chat.\nKALSHI_KEY_ID=\nKALSHI_PRIVATE_KEY_PATH=\nPOLYMARKET_KEY_ID=\nPOLYMARKET_SECRET_KEY=\nRESEARCH_CONTROL_TOKEN=${randomBytes(32).toString("hex")}\n`,
        { mode: 0o600 },
      );
    if (!existsSync("observer.config.json"))
      writeFileSync(
        "observer.config.json",
        JSON.stringify(
          {
            database: "research-data/research.sqlite",
            port: 8789,
            markets: [],
          },
          null,
          2,
        ) + "\n",
      );
    console.log(
      "Created local .env.research and observer.config.json if absent. Existing files preserved.",
    );
    return;
  }
  if (command === "report") {
    const s = new ResearchStore(
      process.argv[3] ?? "research-data/research.sqlite",
    );
    try {
      const session =
        process.argv[4] ?? String(s.rows("sessions").at(-1)?.id ?? "");
      console.log(JSON.stringify(researchReport(s, session), null, 2));
    } finally {
      s.close();
    }
    return;
  }
  if (command === "replay") {
    const fixture = JSON.parse(
      readFileSync(
        process.argv[3] ?? "tests/fixtures/research/lifecycle.json",
        "utf8",
      ),
    );
    const path = process.argv[4] ?? "research-data/replay.sqlite",
      release = lease(path),
      s = new ResearchStore(path);
    try {
      const r = new MappingRegistry(s);
      for (const pair of fixture.pairs) {
        r.add(pair, fixture.startedAt);
        r.verify(
          pair.id,
          "MANUAL_VERIFIED",
          "Synthetic fixture only",
          fixture.startedAt,
        );
      }
      const recorder = new Recorder(
          s,
          r,
          fixture.config ?? researchDefaults,
          "fixture",
          fixture.startedAt,
        ),
        cache = new BookCache();
      for (const event of fixture.events) {
        const b =
          event.venue === "kalshi"
            ? cache.kalshi(
                event.message,
                fixture.startedAt + event.mono,
                event.mono,
              )
            : cache.poly(
                event.message,
                fixture.startedAt + event.mono,
                event.mono,
              );
        if (b) recorder.update({ ...b, source: "fixture" });
      }
      analyzeLatency(s, recorder.sessionId, fixture.endMono);
      recorder.stop(fixture.startedAt + fixture.endMono, fixture.endMono);
      console.log(
        JSON.stringify(researchReport(s, recorder.sessionId), null, 2),
      );
    } finally {
      s.close();
      release();
    }
    return;
  }
  if (command === "discover") {
    const { catalog } = await import("./coverage.ts");
    const { matchCandidates } = await import("../lib/research/matching.ts");
    const discovery = await catalog();
    console.log(
      JSON.stringify(
        {
          at: discovery.at,
          counts: {
            kalshi: discovery.kalshi.length,
            poly: discovery.poly.length,
          },
          complete: discovery.complete,
          errors: discovery.errors,
          candidates: matchCandidates(discovery.kalshi, discovery.poly),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (command === "probe") {
    const { discover, book } = await import("../lib/arb/adapters.ts");
    const path = process.argv[3] ?? "research-data/probe.sqlite",
      release = lease(path),
      s = new ResearchStore(path),
      recorder = new Recorder(
        s,
        new MappingRegistry(s),
        researchDefaults,
        "rest_probe",
      );
    try {
      const discovery = await discover();
      s.diagnostic(recorder.sessionId, Date.now(), "DISCOVERY", {
        counts: discovery.counts,
        errors: discovery.errors,
      });
      for (const m of [
        ...discovery.kalshi.slice(0, 2),
        ...discovery.poly.slice(0, 2),
      ])
        try {
          const b = await book(m);
          recorder.update({
            ...b,
            venue: m.venue,
            marketId: m.id,
            receivedMono: performance.now(),
            sequence: null,
            valid: false,
            connection: "RECOVERING",
            source: "rest",
          });
        } catch {
          s.diagnostic(
            recorder.sessionId,
            Date.now(),
            "REST_BOOK_UNAVAILABLE",
            { venue: m.venue, marketId: m.id },
          );
        }
      recorder.stop(Date.now(), performance.now());
      const report = {
        ...researchReport(s, recorder.sessionId),
        catalog: discovery.counts,
        errors: discovery.errors,
        interpretation:
          "Public REST connectivity sample only. Zero verified pairs and no authenticated stream coverage; no conclusion about arbitrage availability or latency.",
      };
      console.log(JSON.stringify(report, null, 2));
    } finally {
      s.close();
      release();
    }
    return;
  }
  if (command !== "observe")
    throw new Error("Use init, observe, discover, report, replay or probe");
  if (existsSync(".env.research")) process.loadEnvFile(".env.research");
  const config = readConfig(process.argv[3] ?? "observer.config.json"),
    release = lease(config.database),
    s = new ResearchStore(config.database),
    observer = new Observer(s, config);
  try {
    await observer.initialize();
    const server = dashboardServer(
      observer,
      process.env.RESEARCH_CONTROL_TOKEN ?? "",
    );
    await once(server, "listening");
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      server.close();
      try {
        await observer.stop();
      } finally {
        s.close();
        release();
      }
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    console.log(
      `Research controls: http://127.0.0.1:${config.port}. Mode: PAPER_RESEARCH.`,
    );
    try {
      observer.resume();
    } catch {
      console.log(
        "Observer paused. Configure read-stream credentials and market mappings, then resume from the local dashboard.",
      );
    }
  } catch (e) {
    await observer.stop();
    s.close();
    release();
    throw e;
  }
}
main().catch(() => {
  console.error(
    "Research command failed. Check local configuration, credential file paths, and observer lock. No secret values were logged.",
  );
  process.exitCode = 1;
});
