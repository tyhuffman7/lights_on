import { createPrivateKey, sign, constants } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Venue } from "../arb/types.ts";
const endpoints = {
  kalshi: {
    settlements: "https://external-api.kalshi.com/trade-api/v2/portfolio/settlements?limit=100&subaccount=0",
    fills:
      "https://external-api.kalshi.com/trade-api/v2/portfolio/fills?limit=100",
    balance:
      "https://external-api.kalshi.com/trade-api/v2/portfolio/balance?exchange_index=0&subaccount=0",
    orders:
      "https://external-api.kalshi.com/trade-api/v2/portfolio/orders?status=resting&limit=1000",
    positions:
      "https://external-api.kalshi.com/trade-api/v2/portfolio/positions?limit=1000",
  },
  poly: {
    settlements: "https://api.polymarket.us/v1/portfolio/activities?types=ACTIVITY_TYPE_POSITION_RESOLUTION&limit=100",
    fills:
      "https://api.polymarket.us/v1/portfolio/activities?types=ACTIVITY_TYPE_TRADE&limit=100",
    balance: "https://api.polymarket.us/v1/account/balances",
    orders: "https://api.polymarket.us/v1/orders/open",
    positions: "https://api.polymarket.us/v1/portfolio/positions",
  },
} as const;
type Operation = keyof typeof endpoints.kalshi;
type ReadOptions = {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  at?: number;
};
// Deliberately fixed GET destinations. Cannot submit, modify, or cancel orders.
export async function readAccount(
  venue: Venue,
  operation: Operation,
  options: ReadOptions = {},
) {
  if (
    !Object.hasOwn(endpoints, venue) ||
    !Object.hasOwn(endpoints[venue], operation)
  )
    throw Error("Unsupported account read");
  const url = endpoints[venue]?.[operation];
  if (!url) throw Error("Unsupported account read");
  return signedGet(venue, url, options);
}
export type HistoryOperation='fills'|'settlements'|'activities'|'deposits'|'withdrawals'|'subaccountTransfers'|'intraAccountTransfers';
const historyEndpoints:Record<Venue,Partial<Record<HistoryOperation,string>>>={
 kalshi:{fills:endpoints.kalshi.fills,settlements:endpoints.kalshi.settlements,
  deposits:'https://external-api.kalshi.com/trade-api/v2/portfolio/deposits?limit=100',
  withdrawals:'https://external-api.kalshi.com/trade-api/v2/portfolio/withdrawals?limit=100',
  subaccountTransfers:'https://external-api.kalshi.com/trade-api/v2/portfolio/subaccounts/transfers?limit=100',
  intraAccountTransfers:'https://external-api.kalshi.com/trade-api/v2/portfolio/intra_exchange_instance_transfers?limit=100'},
 poly:{fills:endpoints.poly.fills,settlements:endpoints.poly.settlements,activities:'https://api.polymarket.us/v1/portfolio/activities?limit=100'}
};
// Cursor data can alter only a query value, never the signed GET destination.
export async function readHistoryPage(venue:Venue,operation:HistoryOperation,cursor:string,options:ReadOptions={}){
 if(!Object.hasOwn(historyEndpoints,venue)||!Object.hasOwn(historyEndpoints[venue],operation)||typeof cursor!=='string'||cursor.length>4096)throw Error('Invalid history page');
 const url=new URL(historyEndpoints[venue][operation]!);if(cursor)url.searchParams.set('cursor',cursor);
 return signedGet(venue,url.toString(),options);
}
export async function readOrder(
  venue: Venue,
  orderId: string,
  options: ReadOptions = {},
) {
  if (
    !["kalshi", "poly"].includes(venue) ||
    typeof orderId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)
  )
    throw Error("Invalid order read identity");
  const base =
    venue === "kalshi"
      ? "https://external-api.kalshi.com/trade-api/v2/portfolio/orders/"
      : "https://api.polymarket.us/v1/order/";
  return signedGet(venue, base + orderId, options);
}
// Public documentation exposes these Kalshi capability reads. No corresponding
// retail PM-US trading-permission endpoint is documented; do not substitute an
// institutional identity endpoint or an order preview as a capability probe.
export async function readKalshiCapability(operation: 'keys' | 'limits' | 'dataTime', options: ReadOptions = {}) {
  const paths = {keys:'/api_keys', limits:'/account/limits', dataTime:'/exchange/user_data_timestamp'};
  if (!Object.hasOwn(paths, operation)) throw Error('Unsupported capability read');
  return signedGet('kalshi', 'https://external-api.kalshi.com/trade-api/v2' + paths[operation], options);
}

// Private helper: only the fixed account/order GET constructors above can call it.
async function signedGet(venue: Venue, url: string, options: ReadOptions) {
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
