import { createPrivateKey, sign } from "node:crypto";
import { encodePilotBuy } from "./order-wire.ts";
// Fixed nonbinding preview endpoint. It cannot place, modify or cancel an order.
export async function previewPolyBuy(
  leg: Parameters<typeof encodePilotBuy>[0],
  metadata: Parameters<typeof encodePilotBuy>[1],
  options: {
    env?: Record<string, string | undefined>;
    fetch?: typeof fetch;
    at?: number;
  } = {},
) {
  if (leg.venue !== "poly")
    throw Error("Only PM-US nonbinding previews are supported");
  const wire = encodePilotBuy(leg, metadata, "preview-only");
  const env = options.env ?? process.env,
    timestamp = String(options.at ?? Date.now());
  const path = "/v1/order/preview";
  let headers: Record<string, string>;
  try {
    const keyId = env.POLYMARKET_KEY_ID,
      secret = env.POLYMARKET_SECRET_KEY;
    if (!keyId || !secret) throw Error();
    const raw = Buffer.from(secret, "base64");
    if (![32, 64].includes(raw.length)) throw Error();
    const key = createPrivateKey({
      key: Buffer.concat([
        Buffer.from("302e020100300506032b657004220420", "hex"),
        raw.subarray(0, 32),
      ]),
      format: "der",
      type: "pkcs8",
    });
    headers = {
      "Content-Type": "application/json",
      "X-PM-Access-Key": keyId,
      "X-PM-Timestamp": timestamp,
      "X-PM-Signature": sign(
        null,
        Buffer.from(timestamp + "POST" + path),
        key,
      ).toString("base64"),
    };
  } catch {
    throw Error("Preview credentials unavailable or invalid");
  }
  const started = performance.now();
  try {
    const r = await (options.fetch ?? fetch)(
      "https://api.polymarket.us" + path,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ request: wire.body }),
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      },
    );
    const base = {
      mode: "NONBINDING_PREVIEW_ONLY" as const,
      status: r.status,
      roundTripMs: performance.now() - started,
      submittedOrders: 0 as const,
    };
    if (!r.ok) {
      await r.body?.cancel();
      return { ...base, ok: false as const };
    }
    const body: unknown = await r.json();
    return { ...base, ok: true as const, body };
  } catch {
    throw Error("Preview transport or response failed");
  }
}
