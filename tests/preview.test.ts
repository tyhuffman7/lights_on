import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { previewPolyBuy } from "../lib/pilot/preview.ts";
const leg = {
  venue: "poly" as const,
  side: "no" as const,
  marketId: "fixture",
  quantity: 1,
  limitPrice: 1900,
  modeledDebit: 2000,
  feeUpper: 100,
};
const meta = { marketId: "fixture", tick: 100, minimumQuantity: 1 };
test("Preview signs fixed nonbinding path, complements NO and never follows redirects", async () => {
  const keys = generateKeyPairSync("ed25519");
  const env = {
    POLYMARKET_KEY_ID: "fixture",
    POLYMARKET_SECRET_KEY: keys.privateKey
      .export({ format: "der", type: "pkcs8" })
      .subarray(-32)
      .toString("base64"),
  };
  const r = await previewPolyBuy(leg, meta, {
    env,
    at: 123,
    fetch: async (url, init) => {
      assert.equal(url, "https://api.polymarket.us/v1/order/preview");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.method, "POST");
      const h = init!.headers as Record<string, string>;
      assert.ok(
        verify(
          null,
          Buffer.from("123POST/v1/order/preview"),
          keys.publicKey,
          Buffer.from(h["X-PM-Signature"], "base64"),
        ),
      );
      const body = JSON.parse(init!.body as string);
      assert.equal(body.request.price.value, "0.8100");
      assert.equal(body.request.intent, "ORDER_INTENT_BUY_SHORT");
      return new Response(JSON.stringify({ order: { cumQuantity: 0 } }));
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.submittedOrders, 0);
  const denied = await previewPolyBuy(leg, meta, {
    env,
    fetch: async () => new Response("private diagnostic", { status: 403 }),
  });
  assert.equal(denied.ok, false);
  assert.equal("body" in denied, false);
});
test("Invalid preview inputs fail before network access and errors omit credentials", async () => {
  let called = false;
  await assert.rejects(
    previewPolyBuy({ ...leg, venue: "kalshi" }, meta, {
      fetch: async () => {
        called = true;
        throw Error();
      },
    }),
  );
  assert.equal(called, false);
  await assert.rejects(
    previewPolyBuy(leg, meta, {
      env: { POLYMARKET_SECRET_KEY: "private-secret" },
    }),
    (e) => !String(e).includes("private-secret"),
  );
});
