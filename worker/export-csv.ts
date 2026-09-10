import { once } from "node:events";
import { ResearchStore } from "../lib/research/store.ts";
import { opportunityRows, opportunityCSV } from "../lib/research/exports.ts";
const s = new ResearchStore(
  process.argv[2] ?? "research-data/research.sqlite",
  true,
);
try {
  const session =
    process.argv[3] ??
    String(
      s.db
        .prepare("SELECT id FROM sessions ORDER BY started_at DESC LIMIT 1")
        .get()?.id ?? "",
    );
  for (let offset = 0; ; offset += 1000) {
    const rows = opportunityRows(s, session, offset, 1000);
    let csv = opportunityCSV(rows);
    if (offset) csv = csv.slice(csv.indexOf("\r\n") + 2);
    if (csv && !process.stdout.write(csv)) await once(process.stdout, "drain");
    if (rows.length < 1000) break;
  }
} finally {
  s.close();
}
