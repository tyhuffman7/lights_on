import { reviewQueue } from "../lib/research/review.ts";
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
      const url = new URL(req.url ?? "/", origin);
      if (req.method === "GET" && url.pathname === "/api/review") {
        let rows = reviewQueue(
          observer.registry.list(),
          observer.recorder.activity,
        );
        const filter = url.searchParams.get("filter");
        if (filter === "raw")
          rows = rows.filter((r) => (r.activity.count ?? 0) > 0);
        else if (filter === "sports") rows = rows.filter((r) => r.sports);
        else if (filter === "non-sports") rows = rows.filter((r) => !r.sports);
        else if (filter === "high")
          rows = rows.filter((r) => r.status === "HIGH_PRIORITY_REVIEW");
        else if (filter === "conflict")
          rows = rows.filter((r) => r.status === "STRUCTURAL_CONFLICT");
        else if (filter === "reviewed")
          rows = rows.filter((r) => r.alreadyReviewed);
        else
          rows = rows.filter(
            (r) => r.active && r.verification === "UNVERIFIED",
          );
        const category = url.searchParams.get("category");
        if (category) rows = rows.filter((r) => r.category === category);
        res.end(
          JSON.stringify({ total: rows.length, rows: rows.slice(0, 100) }),
        );
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/health") {
        res.end(JSON.stringify(observer.health()));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/state") {
        res.end(
          JSON.stringify({
            health: observer.health(),
            report: await observer.recorder.report(
              url.searchParams.get("session") ?? undefined,
            ),
            mappings: observer.registry
              .list()
              .slice(
                Math.max(
                  0,
                  Number(url.searchParams.get("mappingOffset") ?? 0) || 0,
                ),
                Math.max(
                  0,
                  Number(url.searchParams.get("mappingOffset") ?? 0) || 0,
                ) + 100,
              ),
            mappingTotal: observer.registry.cache.size,
          }),
        );
        return;
      }
      if (
        req.method === "GET" &&
        ["sessions", "opportunities", "detail", "csv"].includes(
          url.pathname.slice(5),
        ) &&
        url.pathname.startsWith("/api/")
      ) {
        const kind = url.pathname.slice(5),
          data = {
            sessionId: url.searchParams.get("session") ?? undefined,
            offset: Number(url.searchParams.get("offset") ?? 0),
            limit: Number(url.searchParams.get("limit") ?? 100),
            id: url.searchParams.get("id"),
          };
        const value = await observer.recorder.send(kind, data);
        if (kind === "csv") {
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.setHeader(
            "Content-Disposition",
            'attachment; filename="opportunities.csv"',
          );
          res.end(value);
        } else res.end(JSON.stringify(value));
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
          body.inverted !== m.pair.inverted ||
          body.rulesChecked !== true ||
          body.outcomesChecked !== true ||
          body.voidChecked !== true
        )
          throw new Error(
            "Review each current rule, outcome, and void condition",
          );
        // Refresh through official metadata immediately before granting verification.
        const { market } = await import("../lib/arb/adapters.ts");
        const fetchedAt = Date.now();
        const a = await market("kalshi", m.pair.a.id),
          b = await market("poly", m.pair.b.id);
        observer.registry.refresh(m.id, a, b, fetchedAt);
        if (
          a.hash !== body.aHash ||
          b.hash !== body.bHash ||
          observer.registry.get(m.id)?.pair.inverted !== body.inverted ||
          observer.registry.get(m.id)?.pair.a.hash !== body.aHash ||
          observer.registry.get(m.id)?.pair.b.hash !== body.bHash
        )
          throw new Error("Rules changed during review; reload");
        observer.registry.verify(
          m.id,
          "MANUAL_VERIFIED",
          String(body.evidence ?? ""),
        );
        observer.recorder.reindex();
        observer.syncSubscriptions();
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
