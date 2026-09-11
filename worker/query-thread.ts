import { historicalActivity } from "../lib/research/review-history.ts";
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
  if (kind === "activity") result = historicalActivity(s);
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
