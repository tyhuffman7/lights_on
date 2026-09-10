# Lights On

A Kalshi + Polymarket US arbitrage research tool. The primary objective is to measure executable opportunity depth, duration, fees and latency survival. The $100 paper bankroll challenge is optional at `/challenge`. **It never submits real orders, holds keys, or moves money.** The target is a game objective, not a forecast. It requires roughly 7.98% compound growth daily and may be infeasible under the available opportunities and limits.

## Research observer (current priority)

Start with [research setup](docs/research/SETUP.md), [continuation handoff](docs/research/HANDOFF.md), and [validation](docs/research/VALIDATION.md). The standalone observer runs independently of the browser and stores lifecycle evidence in SQLite. `npm run research:init` creates ignored local setup files; `npm run research:observe` serves the protected local research dashboard. Actual stream validation awaits API credentials and reviewed mappings. No live profitability has been demonstrated.

The site home displays exported research reports; the legacy UI below is available at `/challenge`.

## Legacy paper challenge

1. Sign in to the private site. The ledger starts with $50 of simulated cash at each venue.
2. Choose **Discover markets**. Discovery samples public, non-sports markets and prioritizes contracts relevant to the next 30 days. Counts describe the bounded sample, not exchange-wide coverage.
3. Review a proposed pair, or use **Add a pair by market ID**. Read both contracts and the exchange terms. Confirm the underlying event, named outcomes, all settlement cases, and whether the long outcomes are the same or opposites. Save the pair for paper research only.
4. **Refresh books** fetches live public depth. Each result includes rejection reasons or a modeled net edge at a quantity that fits both venue balances.
5. **Start paper challenge** records the start date and begins one paper cycle approximately every 30 seconds while the page is open. **Pause paper bot** stops future cycles; an in-flight simulated cycle can finish. Closing the page stops future cycles. Pausing does not dispose of open positions.
6. The journal records entries, unmatched exposure, losses, and published settlements. Use **Check published settlements** for open positions. Export the journal to CSV. Record operating expenses so they count against results.

The calculator is hypothetical and separate from the persistent ledger. It uses the general Kalshi taker coefficient and the Polymarket US July 2026 schedule. The scanner obtains the specific supported series/market fee parameters from the APIs.

## Ohio and platform scope

Only the Kalshi and **Polymarket US** public data endpoints are wired in. The international Polymarket API is not used. Sports are excluded from the research watchlist pending current Ohio-specific verification. Unknown eligibility is not presented as authorization to trade. Federal registration, a working API, or a successful sign-in does not establish that every contract is lawful for an Ohio resident.

The user has confirmed Ohio and accounts on both brands; whether their Polymarket account is specifically the U.S. product is still unconfirmed. Public-data research needs no account credentials. Any future account connection would require confirming that U.S. account and current venue, category, and user eligibility. Adding another venue requires that same verification; no VPN or geographic workaround belongs in this project.

## Calculation and simulation

- Prices and money use integer ten-thousandths of USD. Fee numerators use BigInt; Kalshi's supported quadratic fee rounds upward to cents, and Polymarket US uses ties-to-even cent rounding.
- Kalshi YES asks are derived from NO bids, and vice versa. Polymarket US long offers and complementary short offers are normalized separately. Both legs walk real depth; midpoint and last-trade prices are not treated as executable.
- The first version trades whole quantities conservatively. Fractional depth below one contract at a price level is not used. New fee shapes, missing information, invalid data, or unsupported markets fail closed.
- Default paper limits: $10 combined outlay per entry, $40 total committed, at least $0.10 profit and 1% return after fees and a 2-cent-per-pair reserve. The separate hypothetical calculator defaults to a 1-cent reserve. Risk limits can be edited within bounded ranges.
- A fresh quote must pass rule review, open-market, fee, depth, venue cash, timing, and horizon checks. Source metadata is reloaded, and changed rule fingerprints invalidate the stored review. Discovery's series catalogs can be cached for five minutes; individual contract and quote checks do not use that cache.
- Simulated execution assumes the first leg fills against observed depth, then waits 500ms before checking the second leg. If that hedge disappears, the first leg is modeled as unwound against refreshed bids, or kept as unmatched exposure if an unwind cannot be modeled.
- REST depth cannot establish fill probability or queue position. Each result is a simulation, never proof that a real trade could have been completed. Simulated reserve costs and fees do not guarantee coverage of actual fragmented-fill costs.
- Only one new pair can enter per cycle. Open positions sharing either market are blocked to avoid reusing the same depth. A 30-second server cooldown and optimistic database revisions protect concurrent cycles and ledger writes.
- A $5 realized loss per UTC day, unmatched exposure, or the end of the 30-day experiment blocks new entries. Settlement checks remain available. A day counter never causes limits to increase automatically.
- Settlements credit each venue independently and idempotently. Pending profit is not realized profit. Equity is cash plus the cost of unsettled positions, **not a current liquidation value**. Progress to the challenge goal uses realized net profit, not temporary partial-settlement cash gains.
- An open unmatched position can remain exposed until a published settlement is available; this version does not run a continuous recovery loop. Expenses debit the Kalshi paper cash and reduce challenge profit.

## Architecture

- `lib/arb/core.ts`: exact fee arithmetic and hypothetical calculator.
- `lib/arb/adapters.ts`: public GET requests, schema normalization, discovery, conservative text-match suggestions, and rule fingerprints.
- `lib/arb/engine.ts`: executable depth, sizing, freshness, and entry filters.
- `lib/arb/ledger.ts`: pure cash, position, and settlement transitions.
- `lib/arb/execution.ts`: delayed second-leg paper execution and unwind stress.
- `lib/store.ts`: prepared D1 statements, one ledger per authenticated Sites user, compare-and-swap revisions.
- `app/api/*`: authenticated operations with same-origin mutation checks. There are no exchange order-submission routes.
- `app/dashboard.tsx`, `scanner.tsx`, `journal.tsx`: working dashboard, rule review, paper loop, controls, and export.

Site access is owner-only through Sites. User IDs come from authenticated dispatcher headers; local development uses the bundled sign-in helper. Production authorization must remain behind the Sites dispatcher. Do not expose a standalone worker with trusted header authentication to the public internet.

## Local development

Requires Node 22.13+ and npm. Install with `npm run install:ci` if dependencies are absent, then `npm run dev`. The preview prints its URL (normally `http://localhost:5173`). Use its local **Sign in with ChatGPT** link to activate the development identity.

Generate schema migrations with `npm run db:generate`. Build with `npm run build`, then apply each pending migration locally:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_puzzling_princess_powerful.sql
```

Do not replay an already-applied migration. Hosted migrations are applied by Sites. The source manifest keeps logical binding `DB`; real production database IDs and credentials are platform-managed.

## Verification

```sh
node --experimental-strip-types --test tests/*.test.ts
npx tsc --noEmit --incremental false
npm run build
```

`tests/http-smoke.mjs` checks authentication, input rejection, persistence, concurrency, cooldown, and the empty-watchlist paper cycle using an isolated local user. Run it against the packaged local worker (not `vinext dev`, which strips supplied identity headers):

```sh
npm start -- --port 5174
TEST_ORIGIN=http://127.0.0.1:5174 node tests/http-smoke.mjs
```

The smoke script refuses a non-loopback URL. Test identities never enter the hosted production ledger. Public API calls were exercised for discovery, normalized order books, and individual contract metadata. No browser visual or click testing was requested or performed. An optional, feature-detected `calculate_arbitrage` WebMCP tool uses the same calculator; its browser registration has not been verified because no supported WebMCP validation context was available.

## Limits of this release

Discovery is deliberately bounded and can miss arbs. Its text matches are candidate suggestions, not semantic equivalence proofs. Official settlement dates may be conservative and exclude events that finish sooner. Stale exchange timestamps can reject otherwise resting liquidity. No historical performance, actual profits, or 30-day unattended operation is claimed. The bot runs only during an open browser session and requires manually reviewed pairs; the first hosted ledger has no preapproved contracts.

Reference interface: [arbs.xyz calculator](https://www.arbs.xyz/calculator). Its public UI informed the two-leg explanation; its paid scanner was not accessed or copied, and its results were not independently verified.

Official sources reviewed September 9, 2026:

- [Kalshi order books](https://docs.kalshi.com/getting_started/orderbook_responses)
- [Kalshi fees](https://kalshi.com/fee-schedule)
- [Polymarket US API](https://docs.polymarket.us/api-reference/introduction)
- [Polymarket US market data](https://docs.polymarket.us/api-reference/market/overview)
- [Polymarket US fee schedule](https://docs.polymarket.us/fees)
- [International Polymarket geographic restrictions](https://docs.polymarket.com/api-reference/geoblock)
- [Ohio AG statement on sports contracts](https://www.ohioattorneygeneral.gov/Media/News-Releases/April-2026/Yost-Urges-CFTC-to-Recognize-State-Authority-Over)
