import { existsSync } from "node:fs";
if (existsSync(".env.research")) process.loadEnvFile(".env.research");
try {
  const r = await fetch(
    `http://127.0.0.1:${process.env.RESEARCH_PORT ?? 8789}/api/health`,
    {
      headers: { "X-Research-Token": process.env.RESEARCH_CONTROL_TOKEN ?? "" },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!r.ok) throw new Error();
  const h: any = await r.json();
  if (
    h.paused ||
    h.persistence.failed ||
    Date.now() - h.persistence.lastAckAt > 30000 ||
    !h.streams.length ||
    h.streams.some((s: any) => !s.connected || s.heartbeatAgeMs > 15000)
  )
    throw new Error();
  console.log("PAPER_RESEARCH healthy");
} catch {
  console.error(
    "Observer health check failed: inspect service status and authenticated health details.",
  );
  process.exitCode = 1;
}
