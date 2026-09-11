import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify, constants } from "node:crypto";
import { readAccount } from "../lib/pilot/account-read.ts";
test("Account reads sign exact GET paths and never permit arbitrary or write destinations", async () => {
  const keys = generateKeyPairSync("ed25519");
  const raw = keys.privateKey
    .export({ type: "pkcs8", format: "der" })
    .subarray(-32);
  let calls = 0;
  const result = await readAccount("poly", "balance", {
    at: 123,
    env: {
      POLYMARKET_KEY_ID: "fixture",
      POLYMARKET_SECRET_KEY: raw.toString("base64"),
    },
    fetch: async (url, init) => {
      calls++;
      assert.equal(url, "https://api.polymarket.us/v1/account/balances");
      assert.equal(init?.method, "GET");
      assert.equal(init?.redirect, "error");
      const headers = init!.headers as Record<string, string>;
      assert.ok(
        verify(
          null,
          Buffer.from("123GET/v1/account/balances"),
          keys.publicKey,
          Buffer.from(headers["X-PM-Signature"], "base64"),
        ),
      );
      return new Response(JSON.stringify({ balances: [] }));
    },
  });
  assert.equal(result.ok, true);
  await assert.rejects(readAccount("poly", "create" as any), /Unsupported/);
  assert.equal(calls, 1);
});
test("Kalshi query parameters are excluded from signature and private error bodies are not returned", async () => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const r = await readAccount("kalshi", "orders", {
    at: 123,
    env: {
      KALSHI_KEY_ID: "fixture",
      KALSHI_PRIVATE_KEY: keys.privateKey
        .export({ type: "pkcs8", format: "pem" })
        .toString(),
    },
    fetch: async (url, init) => {
      assert.equal(new URL(String(url)).searchParams.get("status"), "resting");
      const headers = init!.headers as Record<string, string>;
      assert.ok(
        verify(
          "sha256",
          Buffer.from("123GET/trade-api/v2/portfolio/orders"),
          {
            key: keys.publicKey,
            padding: constants.RSA_PKCS1_PSS_PADDING,
            saltLength: 32,
          },
          Buffer.from(headers["KALSHI-ACCESS-SIGNATURE"], "base64"),
        ),
      );
      return new Response("private diagnostic", { status: 403 });
    },
  });
  assert.equal(r.ok, false);
  assert.equal("body" in r, false);
  await assert.rejects(
    readAccount("kalshi", "balance", { env: { KALSHI_PRIVATE_KEY: "secret" } }),
    (e) => !String(e).includes("secret"),
  );
});

test("Single-order reconciliation reads reject paths and remain GET-only", async () => {
  const { readOrder } = await import("../lib/pilot/account-read.ts");
  const keys = generateKeyPairSync("ed25519");
  const raw = keys.privateKey
    .export({ type: "pkcs8", format: "der" })
    .subarray(-32);
  const options = {
    at: 123,
    env: {
      POLYMARKET_KEY_ID: "fixture",
      POLYMARKET_SECRET_KEY: raw.toString("base64"),
    },
    fetch: async (url: any, init: any) => {
      assert.equal(url, "https://api.polymarket.us/v1/order/owned-order");
      assert.equal(init.method, "GET");
      assert.equal(init.body, undefined);
      assert.ok(
        verify(
          null,
          Buffer.from("123GET/v1/order/owned-order"),
          keys.publicKey,
          Buffer.from(init.headers["X-PM-Signature"], "base64"),
        ),
      );
      return new Response(JSON.stringify({ order: { id: "owned-order" } }));
    },
  };
  assert.equal((await readOrder("poly", "owned-order", options)).ok, true);
  for (const id of [
    "../balances",
    "https://example.com",
    "a?token=x",
    "a/b",
    "",
  ])
    await assert.rejects(readOrder("poly", id, options));
});
