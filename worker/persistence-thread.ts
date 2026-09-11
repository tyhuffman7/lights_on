import { deserialize } from "node:v8";
import {
  opportunityRows,
  opportunityDetail,
  opportunityCSV,
} from "../lib/research/exports.ts";
import { statSync } from "node:fs";
import { parentPort, workerData } from "node:worker_threads";
import { ResearchStore } from "../lib/research/store.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { Recorder } from "../lib/research/recorder.ts";
import { researchReport } from "../lib/research/report.ts";
import { analyzeLatency } from "../lib/research/latency.ts";
const store = new ResearchStore(workerData.path);
const registry = new MappingRegistry(store);
const recorder = new Recorder(
  store,
  registry,
  workerData.config,
  workerData.mode,
  workerData.at,
  workerData.sessionId,
);
const initialLogicalBytes =
  Number((store.db.prepare("PRAGMA page_count").get() as any).page_count) *
  Number((store.db.prepare("PRAGMA page_size").get() as any).page_size);
const storageStartedAt = Date.now();
let storageMetrics: Record<string, number> = {};
let analysisOffset = 0;
let lastDatabaseSample: { at: number; bytes: number } | null = null;
parentPort!.postMessage({ ready: true });
parentPort!.on("message", (wire) => {
  const m = deserialize(Buffer.from(wire.payload));
  const started = performance.now();
  try {
    let result: unknown = null;
    if (m.kind === "mapping") {
      store.transaction(() => {
        store.db
          .prepare(
            "INSERT INTO mappings(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
          )
          .run(m.data.m.id, JSON.stringify(m.data.m));
        store.db
          .prepare("INSERT INTO mapping_history(pair_id,at,body) VALUES(?,?,?)")
          .run(m.data.m.id, m.data.at, JSON.stringify(m.data.m));
      });
      recorder.patchMapping(m.data.m, registry.get(m.data.m.id));
      registry.cache.set(m.data.m.id, m.data.m);
    } else if (m.kind === "index") {
      registry.cache = new Map(m.data.map((x: any) => [x.id, x]));
      recorder.reindex();
    } else if (m.kind === "retain") recorder.retainedKeys = new Set(m.data);
    else if (m.kind === "book")
      recorder.update(m.data.book, m.data.evaluations);
    else if (m.kind === "tick")
      recorder.tick(m.data.wall, m.data.mono, m.data.force);
    else if (m.kind === "diagnostic") {
      if (m.data.kind === "TELEMETRY") {
        recorder.saveStats();
        const logicalBytes =
          Number(
            (store.db.prepare("PRAGMA page_count").get() as any).page_count,
          ) *
          Number((store.db.prepare("PRAGMA page_size").get() as any).page_size);
        const elapsedSeconds = Math.max(
          1,
          (Date.now() - storageStartedAt) / 1000,
        );
        storageMetrics = {
          logicalBytes,
          bytesPerHour:
            ((logicalBytes - initialLogicalBytes) * 3600) / elapsedSeconds,
          projectedGBPerDay:
            ((logicalBytes - initialLogicalBytes) * 86400) /
            elapsedSeconds /
            1e9,
          evidencePerSecond: recorder.storage.persisted / elapsedSeconds,
        };
        const size = (p: string) => {
          try {
            return statSync(p).size;
          } catch {
            return 0;
          }
        };
        const bytes = size(workerData.path),
          walBytes = size(workerData.path + "-wal"),
          at = Date.now();
        m.data.body.database = {
          bytes,
          walBytes,
          ...storageMetrics,
          growthBytesPerSecond: storageMetrics.bytesPerHour / 3600,
        };
        lastDatabaseSample = { at, bytes: bytes + walBytes };
      }
      store.diagnostic(recorder.sessionId, m.data.at, m.data.kind, m.data.body);
    } else if (m.kind === "analyze") {
      const scanned = store.transaction(() =>
        analyzeLatency(
          store,
          recorder.sessionId,
          m.data.mono,
          false,
          32,
          analysisOffset,
        ),
      );
      analysisOffset = scanned < 32 ? 0 : analysisOffset + 32;
    } else if (m.kind === "report") {
      result = researchReport(store, m.data.sessionId ?? recorder.sessionId);
      const size = (path: string) => {
        try {
          return statSync(path).size;
        } catch {
          return 0;
        }
      };
      (result as any).database = {
        bytes: size(workerData.path),
        walBytes: size(workerData.path + "-wal"),
      };
      const telemetry = store.db
        .prepare(
          "SELECT body FROM diagnostics WHERE session_id=? AND kind='TELEMETRY' ORDER BY id DESC LIMIT 1",
        )
        .get(m.data.sessionId ?? recorder.sessionId) as any;
      (result as any).observer = telemetry ? JSON.parse(telemetry.body) : null;
    } else if (m.kind === "sessions")
      result = store.db
        .prepare(
          "SELECT id,started_at,ended_at,mode FROM sessions ORDER BY started_at DESC LIMIT 1000",
        )
        .all();
    else if (m.kind === "opportunities")
      result = opportunityRows(
        store,
        m.data.sessionId ?? recorder.sessionId,
        m.data.offset,
        m.data.limit,
      );
    else if (m.kind === "detail")
      result = opportunityDetail(
        store,
        m.data.sessionId ?? recorder.sessionId,
        m.data.id,
        m.data.offset,
        m.data.limit,
      );
    else if (m.kind === "csv")
      result = opportunityCSV(
        opportunityRows(
          store,
          m.data.sessionId ?? recorder.sessionId,
          m.data.offset,
          m.data.limit,
        ),
      );
    else if (m.kind === "stop") {
      store.transaction(() =>
        analyzeLatency(store, recorder.sessionId, m.data.mono, true),
      );
      recorder.stop(m.data.wall, m.data.mono);
      store.close();
    }
    parentPort!.postMessage({
      id: m.id,
      result,
      writeMs: performance.now() - started,
      persistedAt: Date.now(),
      storage: { ...recorder.storage, ...storageMetrics },
    });
    if (m.kind === "stop") parentPort!.close();
  } catch {
    parentPort!.postMessage({
      id: m.id,
      error: ["report", "sessions", "opportunities", "detail", "csv"].includes(
        m.kind,
      )
        ? "REQUEST_FAILED"
        : "PERSISTENCE_FAILED",
    });
  }
});
