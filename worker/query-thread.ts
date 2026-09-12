import { CapacityScheduler } from "../lib/research/capacity.ts";
import { MappingRegistry } from "../lib/research/mappings.ts";
import { reviewQueue } from "../lib/research/review.ts";
import {
  historicalActivity,
  recordedActivity,
} from "../lib/research/review-history.ts";
import { parentPort, workerData } from "node:worker_threads";
import { statSync } from "node:fs";
import { ResearchStore } from "../lib/research/store.ts";
import { researchReport } from "../lib/research/report.ts";
import {
  opportunityRows,
  opportunityDetail,
  opportunityCSV,
} from "../lib/research/exports.ts";
const s = new ResearchStore(workerData.path, true),
  { kind, data } = workerData;
try {
  s.db.exec("BEGIN");
  let result: unknown;
  if (kind === "capacity") {
    const scheduler = new CapacityScheduler();
    scheduler.selected = new Set(data.previousSelected);
    scheduler.exploration = new Set(data.previousExploration);
    scheduler.epoch = data.previousEpoch;
    result = scheduler.select(
      new MappingRegistry(s).list(),
      data.cap,
      data.fraction,
      data.rotationMs,
      data.now,
      recordedActivity(data.activity ?? {}, s),
      new Set(data.paperPriorityIds ?? []),
      data.paperSettlementDeadline ?? null,
    );
  } else if (kind === "review") {
    let rows = reviewQueue(
      new MappingRegistry(s).list(),
      recordedActivity(data.activity ?? {}, s),
    );
    const counts = rows
      .filter((r) => r.active && r.verification === "UNVERIFIED")
      .reduce((n: Record<string, number>, r) => {
        n[r.status] = (n[r.status] ?? 0) + 1;
        if ((r.activity.count ?? 0) > 0) n.raw = (n.raw ?? 0) + 1;
        return n;
      }, {});
    const filter = data.filter;
    if (filter === "raw")
      rows = rows.filter((r) => (r.activity.count ?? 0) > 0);
    else if (filter === "sports") rows = rows.filter((r) => r.sports);
    else if (filter === "non-sports") rows = rows.filter((r) => !r.sports);
    else if (filter === "high")
      rows = rows.filter(
        (r) =>
          r.active &&
          r.verification === "UNVERIFIED" &&
          r.status === "HIGH_PRIORITY_REVIEW",
      );
    else if (filter === "conflict")
      rows = rows.filter((r) => r.status === "STRUCTURAL_CONFLICT");
    else if (filter === "reviewed")
      rows = rows.filter((r) => r.alreadyReviewed);
    else rows = rows.filter((r) => r.active && r.verification === "UNVERIFIED");
    if (data.category) rows = rows.filter((r) => r.category === data.category);
    result = { counts, total: rows.length, rows: rows.slice(0, 100) };
  } else if (kind === "activity") result = historicalActivity(s);
  else if (kind === "report") {
    const report = researchReport(s, data.sessionId);
    const size = (path: string) => {
      try {
        return statSync(path).size;
      } catch {
        return 0;
      }
    };
    const telemetry = s.db
      .prepare(
        "SELECT body FROM diagnostics WHERE session_id=? AND kind='TELEMETRY' ORDER BY id DESC LIMIT 1",
      )
      .get(data.sessionId) as any;
    result = {
      ...report,
      database: {
        ...(telemetry ? JSON.parse(telemetry.body).database : {}),
        bytes: size(workerData.path),
        walBytes: size(workerData.path + "-wal"),
      },
      observer: telemetry ? JSON.parse(telemetry.body) : null,
    };
  } else if (kind === "sessions")
    result = s.db
      .prepare(
        "SELECT id,started_at,ended_at,mode FROM sessions ORDER BY started_at DESC LIMIT 1000",
      )
      .all();
  else if (kind === "opportunities")
    result = opportunityRows(s, data.sessionId, data.offset, data.limit);
  else if (kind === "detail")
    result = opportunityDetail(
      s,
      data.sessionId,
      data.id,
      data.offset,
      data.limit,
    );
  else if (kind === "csv")
    result = opportunityCSV(
      opportunityRows(s, data.sessionId, data.offset, data.limit),
    );
  s.db.exec("COMMIT");
  parentPort!.postMessage({ result });
} catch {
  parentPort!.postMessage({ error: true });
} finally {
  s.close();
}
