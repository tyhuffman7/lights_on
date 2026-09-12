# Connected maker paper execution — September 12, 2026

## What works

The new maker-run command connects the resting-order planner and public-trade queue to the existing paper state, positions and settlement ledger. Only one maker order can be outstanding. Both legs' funds are reserved before modeled activation; cancellation returns unused money. Filled quantities use fixed-point arithmetic, including fractional first-leg exposure. A hedge is attempted after the modeled delay against current, usable Polymarket US books, within the remaining reservation and venue minimum size. Fees are conservatively rounded per fill; no maker rebate is credited. Extra fragmentation costs are retained, never discarded.

A partial fill below the hedge minimum remains an unmatched position and halts new entries. Each leg settles its actual quantity, with payout rounded down to the ledger's integer currency unit. Restart recovery retains persisted first-leg fills and releases only unused reservations. Taker mode refuses to start over an unresolved maker reservation. Shutdown processes already queued print evidence before finalizing the order. Maker positions retain public trade IDs and queue/activation evidence, and their quantities are exposed in CLI status.

The runtime can improve a bid to the next whole-cent price if it remains below the ask and the quote still passes all checks; otherwise it joins the existing bid. Whole-cent prices are compatible with the currently documented cent, decicent and tapered-decicent grids. [Kalshi pricing structures](https://docs.kalshi.com/getting_started/fixed_point_migration)

## Run

From the Lights On repository:

```sh
npm run paper -- maker-run observer.config.json research-data/paper-bot.sqlite 180
npm run paper -- status research-data/paper-bot.sqlite
```

The final number bounds the run in seconds (1–600). Existing `run` remains the taker paper mode. Both commands use the existing paper ledger and leases; do not run them concurrently. Real-order transport remains disabled.

Current simulation assumptions: one outstanding order, a scan attempt no more often than every ten seconds, 500ms activation delay, a two-second order lifetime, 500ms hedge delay, and up to 250ms modeled cancellation delay on invalidation. The existing two-second data gate, conditional approvals, fees, risk limits and challenge horizon remain enforced. Public prints are a simulation input, not confirmation that an actual order filled. Hidden liquidity, impact and exact venue queue placement remain model limitations. Unknown or late timing is conservatively rejected. Unfilled cancelled orders are logged separately from positions; their reservations are not losses or profits.

## Verification

215 tests and TypeScript pass. Production build passes, with the existing vinext route-classification notice. Integration tests demonstrate a profitable synthetic maker entry/hedge/settlement with exactly one combined dollar payout per paired contract, partial-fill exposure, queued-print shutdown handling and restart recovery. That synthetic profit is not actual-market evidence. Tests/builds did not overlap live collection.

Actual-data sessions:

| Session | Duration | Simulated orders | Filled |
|---|---:|---:|---:|
| 262cc09c-bb5a-444d-8242-e7154e2e2983 | 183.071 seconds | 7 | 0 |
| a0ba08bc-c8c7-42ad-b38f-d1795810f156 | 122.816 seconds | 4 | 0 |

The second session used bid improvement and persisted four order/close evidence records. The sessions recorded 71 and 75 public trade packets respectively across subscribed markets; none produced a modeled fill in our orders. All eleven orders expired unfilled and returned their reservations. No parser-recovery events were recorded in these sessions. Both workers stopped cleanly, both database leases were released, and no maker reservation remains.

Cash: $50 Kalshi / $50 Polymarket US. Positions: zero. Realized profit: $0. The first profitable actual-data paper trade remains unachieved. Longer observation and activity-aware selection are still needed to test fill frequency; these short samples cannot establish profitability or failure of the strategy. Signing remains deferred; no real orders, commit or deployment were made.
