import { createPrivateKey, sign, constants } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Venue } from "../arb/types.ts";
const endpoints = {
  kalshi: {
    balance: "https://external-api.kalshi.com/trade-api/v2/portfolio/balance?exchange_index=0&subaccount=0",
    orders:
      "https://external-api.kalshi.com/trade-api/v2/portfolio/orders?status=resting&limit=1000",
    positions:
      "https://external-api.kalshi.com/trade-api/v2/portfolio/positions?limit=1000",
  },
  poly: {
    balance: "https://api.polymarket.us/v1/account/balances",
    orders: "https://api.polymarket.us/v1/orders/open",
    positions: "https://api.polymarket.us/v1/portfolio/positions",
  },
} as const;
type Operation = keyof typeof endpoints.kalshi;
// Deliberately fixed GET destinations. Cannot submit, modify, or cancel orders.
export async function readAccount(
  venue: Venue,
  operation: Operation,
  options: {
    env?: Record<string, string | undefined>;
    fetch?: typeof fetch;
    at?: number;
  } = {},
) {
  if (
    !Object.hasOwn(endpoints, venue) ||
    !Object.hasOwn(endpoints[venue], operation)
  )
    throw Error("Unsupported account read");
  const url = endpoints[venue]?.[operation];
  if (!url) throw Error("Unsupported account read");
  const env = options.env ?? process.env,
    timestamp = String(options.at ?? Date.now());
  const path = new URL(url).pathname;
  let headers: Record<string, string>;
  try {
    if (venue === "kalshi") {
      const key = env.KALSHI_KEY_ID;
      const pem =
        env.KALSHI_PRIVATE_KEY ??
        (env.KALSHI_PRIVATE_KEY_PATH
          ? readFileSync(env.KALSHI_PRIVATE_KEY_PATH, "utf8")
          : undefined);
      if (!key || !pem) throw Error();
      headers = {
        "KALSHI-ACCESS-KEY": key,
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
        "KALSHI-ACCESS-SIGNATURE": sign(
          "sha256",
          Buffer.from(timestamp + "GET" + path),
          {
            key: pem,
            padding: constants.RSA_PKCS1_PSS_PADDING,
            saltLength: 32,
          },
        ).toString("base64"),
      };
    } else {
      const key = env.POLYMARKET_KEY_ID,
        secret = env.POLYMARKET_SECRET_KEY;
      if (!key || !secret) throw Error();
      const raw = Buffer.from(secret, "base64");
      if (![32, 64].includes(raw.length)) throw Error();
      const privateKey = createPrivateKey({
        key: Buffer.concat([
          Buffer.from("302e020100300506032b657004220420", "hex"),
          raw.subarray(0, 32),
        ]),
        format: "der",
        type: "pkcs8",
      });
      headers = {
        "X-PM-Access-Key": key,
        "X-PM-Timestamp": timestamp,
        "X-PM-Signature": sign(
          null,
          Buffer.from(timestamp + "GET" + path),
          privateKey,
        ).toString("base64"),
      };
    }
  } catch {
    throw Error("Account read credentials unavailable or invalid");
  }
  const start = performance.now();
  try {
    const response = await (options.fetch ?? fetch)(url, {
      method: "GET",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      return {
        ok: false as const,
        status: response.status,
        roundTripMs: performance.now() - start,
      };
    }
    const body: unknown = await response.json();
    return {
      ok: true as const,
      status: response.status,
      roundTripMs: performance.now() - start,
      body,
    };
  } catch {
    throw Error("Account read transport or response failed");
  }
}
