import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Observer } from "./observer.ts";
import { researchReport } from "../lib/research/report.ts";
export function dashboardServer(observer: Observer, token: string) {
  if (token.length < 24)
    throw new Error(
      "RESEARCH_CONTROL_TOKEN must contain at least 24 characters",
    );
  const server = createServer(async (req, res) => {
    const address = server.address();
    const port =
      address && typeof address === "object"
        ? address.port
        : observer.config.port;
    const origin = `http://127.0.0.1:${port}`;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
    );
    if (req.headers.host !== `127.0.0.1:${port}`) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (req.method === "GET" && req.url === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(readFileSync(new URL("./dashboard.html", import.meta.url)));
      return;
    }
    const supplied = String(req.headers["x-research-token"] ?? "");
    if (
      Buffer.byteLength(supplied) !== Buffer.byteLength(token) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(token)) ||
      (req.headers.origin && req.headers.origin !== origin)
    ) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    try {
      if (req.method === "GET" && req.url === "/api/state") {
        res.end(
          JSON.stringify({
            health: observer.health(),
            report: researchReport(observer.store, observer.recorder.sessionId),
            mappings: observer.registry.list(),
          }),
        );
        return;
      }
      if (
        req.method === "POST" &&
        ["/api/pause", "/api/resume"].includes(req.url ?? "")
      ) {
        if (req.url === "/api/pause") observer.pause();
        else observer.resume();
        res.end(JSON.stringify(observer.health()));
        return;
      }
      if (req.method === "POST" && req.url === "/api/review") {
        let text = "";
        for await (const chunk of req) {
          text += chunk.toString();
          if (text.length > 10000) throw new Error("Review too large");
        }
        const body = JSON.parse(text),
          m = observer.registry.get(String(body.id));
        if (
          !m ||
          m.pair.a.hash !== body.aHash ||
          m.pair.b.hash !== body.bHash ||
          body.rulesChecked !== true ||
          body.outcomesChecked !== true ||
          body.voidChecked !== true
        )
          throw new Error(
            "Review each current rule, outcome, and void condition",
          );
        // Refresh through official metadata immediately before granting verification.
        const { market } = await import("../lib/arb/adapters.ts");
        const a = await market("kalshi", m.pair.a.id),
          b = await market("poly", m.pair.b.id);
        observer.registry.refresh(m.id, a, b);
        if (a.hash !== body.aHash || b.hash !== body.bHash)
          throw new Error("Rules changed during review; reload");
        observer.registry.verify(
          m.id,
          "MANUAL_VERIFIED",
          String(body.evidence ?? ""),
        );
        observer.recorder.reindex();
        observer.recorder.tick(Date.now(), performance.now(), true);
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    } catch {
      res.writeHead(400);
      res.end(
        JSON.stringify({
          error:
            "Request failed. Verify configuration or reload current mapping rules before retrying.",
        }),
      );
    }
  });
  server.listen(observer.config.port, "127.0.0.1");
  return server;
}
