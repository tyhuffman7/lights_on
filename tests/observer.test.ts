import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { ResearchStore } from "../lib/research/store.ts";
import { Observer } from "../worker/observer.ts";
import { dashboardServer } from "../worker/server.ts";
import { configSchema } from "../worker/config.ts";
test("Observer dashboard rejects unauthenticated and cross-origin control; public shell exposes no data", async () => {
  const s = new ResearchStore(":memory:"),
    o = new Observer(s, { ...configSchema.parse({}), port: 0 }),
    token = "test-only-local-control-token";
  const server = dashboardServer(o, token);
  await once(server, "listening");
  const port = server.address().port,
    base = `http://127.0.0.1:${port}`;
  try {
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(base + "/api/state")).status, 403);
    const headers = { "X-Research-Token": token };
    assert.equal((await fetch(base + "/api/state", { headers })).status, 200);
    assert.equal(
      (
        await fetch(base + "/api/pause", {
          method: "POST",
          headers: { ...headers, Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base + "/api/pause", { method: "POST", headers })).status,
      200,
    );
  } finally {
    await new Promise((r) => server.close(r));
    o.stop();
    s.close();
  }
});
test("Research configuration rejects negative reserve, invalid IDs and silent unknown fields", () => {
  assert.throws(() => configSchema.parse({ reserve: -1 }));
  assert.throws(() =>
    configSchema.parse({ markets: [{ kalshi: "https://bad", poly: "x" }] }),
  );
  assert.throws(() => configSchema.parse({ live: true }));
});

test("Single-observer lease prevents concurrent writers and recovers a confirmed dead owner", async () => {
  const { lease } = await import("../worker/config.ts");
  const { mkdtempSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { DatabaseSync } = await import("node:sqlite");
  const path = join(mkdtempSync(join(tmpdir(), "lease-")), "observer.sqlite");
  const release = lease(path);
  assert.throws(() => lease(path), /observer/i);
  release();
  const db = new DatabaseSync(path + ".lease.sqlite");
  db.prepare("INSERT INTO observer_lease(id,pid,token) VALUES(1,?,?)").run(
    2147483647,
    "dead-owner",
  );
  db.close();
  const recovered = lease(path);
  recovered();
});
