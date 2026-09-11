import { identity } from "../research/identity.ts";
import type { Book, Market, Level, Venue, Pair } from "./types.ts";
import { USD } from "./core.ts";
import { matchCandidates } from "../research/matching.ts";
import { GENERAL_KALSHI_RATE } from "../research/fees.ts";
const K = "https://external-api.kalshi.com/trade-api/v2";
const P = "https://gateway.polymarket.us/v1";
type Obj = Record<string, any>;
export let requestTiming: ((host: string, ms: number) => void) | null = null;
export function observeRequestTiming(fn: typeof requestTiming) {
  requestTiming = fn;
}
const nextRequest = new Map<string, number>();
const catalogCache = new Map<string, { at: number; data: Obj }>();
export async function getJSON(url: string): Promise<Obj> {
  const u = new URL(url),
    isCatalog = u.pathname.endsWith("/series");
  const cached = isCatalog ? catalogCache.get(url) : null;
  if (cached && Date.now() - cached.at < 300000) return cached.data;
  for (let attempt = 0; attempt < 3; attempt++) {
    const slot = Math.max(Date.now(), nextRequest.get(u.hostname) || 0);
    nextRequest.set(u.hostname, slot + 300);
    if (slot > Date.now())
      await new Promise((r) => setTimeout(r, slot - Date.now()));
    const requestStarted = performance.now();
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: { accept: "application/json" },
        cache: "no-store",
      });
    } finally {
      requestTiming?.(u.hostname, performance.now() - requestStarted);
    }
    if (response.status === 429 && attempt < 2) {
      const seconds = Number(response.headers.get("Retry-After"));
      await response.body?.cancel();
      await new Promise((r) =>
        setTimeout(
          r,
          Math.min(
            5000,
            Math.max(
              1500 * (attempt + 1),
              Number.isFinite(seconds) ? seconds * 1000 : 0,
            ),
          ),
        ),
      );
      continue;
    }
    if (!response.ok)
      throw new Error(
        `${u.hostname}: HTTP ${response.status}${response.status === 429 ? " — rate limited; wait before retrying" : ""}`,
      );
    const data = (await response.json()) as Obj;
    if (isCatalog) catalogCache.set(url, { at: Date.now(), data });
    return data;
  }
  throw new Error("Rate limit retry budget exhausted");
}
export function price(v: unknown): number {
  const s = String(v);
  if (!/^(?:0|1)(?:\.\d{1,4})?$/.test(s) || Number(s) > 1)
    throw new Error("Unsupported price precision");
  return Math.round(Number(s) * USD);
}
async function hash(text: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buf)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function normalizeKalshi(
  m: Obj,
  series?: Obj,
  category?: string,
): Promise<Market> {
  const rules = [
    m.rules_primary,
    m.rules_secondary,
    series?.contract_terms_url,
    JSON.stringify(series?.settlement_sources ?? []),
  ]
    .filter(Boolean)
    .join("\n\n");
  const rate =
    series &&
    ["quadratic", "quadratic_with_maker_fees"].includes(series.fee_type) &&
    Number.isFinite(series.fee_multiplier)
      ? Math.round(GENERAL_KALSHI_RATE * series.fee_multiplier)
      : null;
  let settlement = null;
  if (m.status === "settled" && m.settlement_value_dollars !== undefined)
    settlement = price(m.settlement_value_dollars);
  else if (m.status === "settled" && ["yes", "no"].includes(m.result))
    settlement = m.result === "yes" ? USD : 0;
  const id = String(m.ticker);
  const closeAt =
    m.expected_expiration_time || m.expiration_time || m.close_time || "";
  return {
    id,
    venue: "kalshi",
    identity: identity("kalshi", m, series),
    exchangeIndex: m.exchange_index ?? 0,
    title: String(m.title || id),
    outcome: m.yes_sub_title || "Yes",
    opposite: m.no_sub_title || "No",
    category: category || series?.category || "Unknown",
    rules,
    url: `https://kalshi.com/markets/${encodeURIComponent(id.split("-")[0].toLowerCase())}/${encodeURIComponent(String(m.event_ticker || id).toLowerCase())}`,
    closeAt,
    open:
      m.status === "active" &&
      m.market_type === "binary" &&
      !m.is_provisional &&
      m.notional_value_dollars === "1.0000" &&
      !m.mve_collection_ticker,
    feeRate: rate,
    feeRounding: "ceil",
    minQty: 1,
    hash: await hash(
      JSON.stringify([
        rules,
        closeAt,
        m.yes_sub_title,
        m.no_sub_title,
        m.floor_strike,
        m.cap_strike,
        m.strike_type,
      ]),
    ),
    settlement,
    series: id.split("-")[0],
  };
}
export async function normalizePoly(m: Obj, published?: Obj): Promise<Market> {
  const sides = m.marketSides || [],
    long = sides.find((x: Obj) => x.long === true),
    short = sides.find((x: Obj) => x.long === false);
  const rules = String(m.description || "");
  const id = String(m.slug),
    closeAt = m.endDate || "";
  const title = String(m.title || m.question || id);
  let settlement = null;
  if (
    m.closed === true &&
    published?.slug === id &&
    typeof published.settlement === "number"
  )
    settlement = price(published.settlement);
  return {
    id,
    venue: "poly",
    identity: identity("poly", m),
    title:
      m.question && m.question !== title ? `${title} · ${m.question}` : title,
    outcome: long?.description || "Unknown long",
    opposite: short?.description || "Unknown short",
    category: String(m.category || "Unknown"),
    rules,
    url: `https://polymarket.us/event/${encodeURIComponent(id)}`,
    closeAt,
    open:
      m.active === true &&
      m.closed === false &&
      !m.archived &&
      !!long &&
      !!short &&
      long.tradable === true &&
      short.tradable === true,
    feeRate: Number.isFinite(m.feeCoefficient)
      ? Math.round(m.feeCoefficient * 10000)
      : null,
    feeRounding: "even",
    minQty: Number(m.minimumTradeQty) || 1,
    hash: await hash(
      JSON.stringify([rules, closeAt, long?.description, short?.description]),
    ),
    settlement,
  };
}
export async function market(venue: Venue, id: string): Promise<Market> {
  if (!/^[a-zA-Z0-9_.-]{1,220}$/.test(id))
    throw new Error("Enter a market ticker or slug, not a URL.");
  if (venue === "kalshi") {
    const [m, s] = await Promise.all([
      getJSON(`${K}/markets/${encodeURIComponent(id)}`),
      getJSON(`${K}/series/${encodeURIComponent(id.split("-")[0])}`),
    ]);
    return normalizeKalshi(m.market, s.series);
  }
  const data = await getJSON(`${P}/market/slug/${encodeURIComponent(id)}`),
    m = data.market || data;
  const published =
    m.closed === true
      ? await getJSON(`${P}/markets/${encodeURIComponent(id)}/settlement`)
      : undefined;
  return normalizePoly(m, published);
}
function levels(raw: unknown, parse: (v: any) => Level): Level[] {
  if (!Array.isArray(raw)) throw new Error("Order book schema unavailable");
  return raw
    .map(parse)
    .filter(
      (x) =>
        x.price > 0 &&
        x.price < USD &&
        Number.isFinite(x.quantity) &&
        x.quantity > 0,
    );
}
export function normalizeBook(
  venue: Venue,
  data: Obj,
  receivedAt = Date.now(),
): Book {
  if (venue === "kalshi") {
    const d = data.orderbook_fp;
    if (!d) throw new Error("Kalshi fixed-point book unavailable");
    const yesBids = levels(d.yes_dollars || [], (x) => ({
        price: price(x[0]),
        quantity: Number(x[1]),
      })),
      noBids = levels(d.no_dollars || [], (x) => ({
        price: price(x[0]),
        quantity: Number(x[1]),
      }));
    return {
      yes: noBids.map((x) => ({ ...x, price: USD - x.price })),
      no: yesBids.map((x) => ({ ...x, price: USD - x.price })),
      yesBids,
      noBids,
      receivedAt,
      exchangeAt: null,
      open: true,
    };
  }
  const d = data.marketData;
  if (!d) throw new Error("Polymarket US book unavailable");
  const parse = (x: Obj) => {
    if (x.px?.currency !== "USD") throw new Error("Non-USD book");
    return { price: price(x.px.value), quantity: Number(x.qty) };
  };
  const yesBids = levels(d.bids || [], parse),
    yes = levels(d.offers || [], parse);
  const exchangeAt = Date.parse(d.transactTime);
  return {
    yes,
    no: yesBids.map((x) => ({ ...x, price: USD - x.price })),
    yesBids,
    noBids: yes.map((x) => ({ ...x, price: USD - x.price })),
    receivedAt,
    exchangeAt: Number.isFinite(exchangeAt) ? exchangeAt : null,
    open: d.state === "MARKET_STATE_OPEN",
  };
}
export async function book(m: Market): Promise<Book> {
  const url =
    m.venue === "kalshi"
      ? `${K}/markets/${encodeURIComponent(m.id)}/orderbook?depth=25`
      : `${P}/markets/${encodeURIComponent(m.id)}/book`;
  const data = await getJSON(url);
  return normalizeBook(m.venue, data);
}
export async function freshPair(p: Pair) {
  const [a, b] = await Promise.all([
    market("kalshi", p.a.id),
    market("poly", p.b.id),
  ]);
  return {
    ...p,
    a,
    b,
    reviewed: p.reviewed && a.hash === p.a.hash && b.hash === p.b.hash,
  };
}
export type Discovery = {
  kalshi: Market[];
  poly: Market[];
  errors: string[];
  counts: { kalshi: number; poly: number };
  at: number;
};
export async function discover(): Promise<Discovery> {
  const errors: string[] = [];
  let km: Market[] = [],
    pm: Market[] = [];
  let kc = 0,
    pc = 0;
  const now = Date.now(),
    end = new Date(now + 30 * 86400000).toISOString();
  try {
    for (let offset = 0; offset < 300; offset += 100) {
      const qs = new URLSearchParams({
        limit: "100",
        offset: String(offset),
        active: "true",
        closed: "false",
        endDateMax: end,
      });
      for (const c of [
        "sports",
        "politics",
        "crypto",
        "economics",
        "economy",
        "finance",
        "weather",
        "tech",
        "culture",
      ])
        qs.append("categories", c);
      const d = await getJSON(`${P}/markets?${qs}`);
      pc += (d.markets || []).length;
      pm.push(
        ...(await Promise.all(
          (d.markets || []).map((m: Obj) => normalizePoly(m)),
        )),
      );
      if ((d.markets || []).length < 100) break;
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  // Bounded interactive preview; the persistent observer uses the full paginated catalog.
  const catalogs = await Promise.allSettled(
    [
      "Sports",
      "Politics",
      "Elections",
      "Economics",
      "Crypto",
      "Entertainment",
      "Climate and Weather",
      "Science and Technology",
    ].map((c) => getJSON(`${K}/series?category=${encodeURIComponent(c)}`)),
  );
  const series: Obj[] = [];
  for (const r of catalogs) {
    if (r.status === "fulfilled") series.push(...(r.value.series || []));
    else errors.push(r.reason?.message || String(r.reason));
  }
  const ranked = series
    .map((s) => {
      const st = words(String(s.title));
      let score = 0;
      for (const m of pm) {
        const mt = words(m.title + " " + m.outcome);
        const shared = [...st].filter((x) => mt.has(x)).length;
        if (shared >= 2) score = Math.max(score, shared / Math.max(1, st.size));
      }
      return { s, score };
    })
    .filter((x) => x.score >= 0.45)
    .sort((a, b) => b.score - a.score);
  const seed = ["KXFEDDECISION", "KXCPI", "KXCPIYOY", "KXBTC", "KXETH"];
  const chosen = [
    ...new Map(
      [
        ...ranked.slice(0, 12).map((x) => x.s),
        ...series.filter((s) => seed.includes(s.ticker)),
      ].map((x) => [x.ticker, x]),
    ).values(),
  ].slice(0, 17);
  // Concurrency is bounded to four requests, with no order placement endpoints.
  for (let i = 0; i < chosen.length; i += 4) {
    const batch = await Promise.allSettled(
      chosen.slice(i, i + 4).map(async (s) => {
        const d = await getJSON(
          `${K}/markets?status=open&limit=100&series_ticker=${encodeURIComponent(s.ticker)}`,
        );
        kc += (d.markets || []).length;
        return Promise.all(
          (d.markets || []).map((m: Obj) => normalizeKalshi(m, s)),
        );
      }),
    );
    for (const r of batch) {
      if (r.status === "fulfilled") km.push(...r.value);
      else errors.push(r.reason?.message || String(r.reason));
    }
  }
  const unique = (ms: Market[]) =>
    [...new Map(ms.filter((m) => m.open).map((m) => [m.id, m])).values()].sort(
      (a, b) => Date.parse(a.closeAt) - Date.parse(b.closeAt),
    );
  return {
    kalshi: unique(km).slice(0, 1500),
    poly: unique(pm),
    errors: [...new Set(errors)],
    counts: { kalshi: kc, poly: pc },
    at: Date.now(),
  };
}
const stop = new Set([
  "will",
  "the",
  "be",
  "in",
  "of",
  "by",
  "a",
  "an",
  "to",
  "on",
  "at",
  "for",
  "is",
  "than",
  "before",
  "after",
  "above",
  "below",
  "yes",
  "no",
  "and",
  "or",
  "2026",
]);
function words(s: string) {
  return new Set(
    s
      .toLowerCase()
      .replace(/federal reserve/g, "fed")
      .replace(/swedish/g, "sweden")
      .replace(/bitcoin/g, "btc")
      .replace(/ethereum/g, "eth")
      .split(/[^a-z0-9]+/)
      .filter((x) => x && !stop.has(x)),
  );
}
function tokens(m: Market) {
  return words(m.title + " " + m.outcome);
}
export function suggest(d: Discovery): Pair[] {
  const near = (m: Market) => {
    const t = Date.parse(m.closeAt);
    return t > d.at && t <= d.at + 30 * 86400000;
  };
  return matchCandidates(d.kalshi.filter(near), d.poly.filter(near)).map(
    (c) => c.pair,
  );
}
