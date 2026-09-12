# Maker feasibility checkpoint — September 12, 2026

## Implemented

The existing paper worker now collects Kalshi public trade prints in the research diagnostic journal. General research observers retain book-only subscriptions by default. Trade subscriptions use separate request IDs and do not enter the book parser. The paper worker records prospective resting-Kalshi-bid / immediate-Polymarket-US-hedge quotes using the existing sizing, fee, bankroll, horizon, approval and freshness checks. The maker leg conservatively retains the taker fee; no rebate is assumed. Plans are explicitly labeled as prospective quotes, not fills. They are alternative plans, not simultaneously funded orders; their potential returns must not be added together.

Added a tested trade parser and queue model. It requires reported trading volume after activation, retains initial visible volume ahead, deduplicates prints, tracks partial quantity and invalidates on disconnect. A book touch, reduced depth or cancellation cannot advance the queue. The queue model is not yet wired into the financial ledger; no maker fills or cash credits are claimed.

Kalshi's current direction documentation clarified that taker_book_side bid/ask aliases yes/no directional exposure. The parser validates these aliases and uses explicit YES price, complemented for a NO resting bid. Subscription requests now explicitly select legacy no-leg order-book pricing via use_yes_price:false, matching the existing decoder. This must be revisited if Kalshi removes that compatibility flag. [Direction documentation](https://docs.kalshi.com/getting_started/order_direction)

A rate-limited on-demand stream snapshot is requested for an approved, promising pair when Polymarket US is usable but Kalshi's otherwise valid stream book is old. Limits: at most one request per 500ms globally and one per market per five seconds. It never updates a cached timestamp itself, substitutes REST as a fill, or changes the two-second gate. Subsequent received stream snapshots are evaluated normally. [Snapshot documentation](https://docs.kalshi.com/websockets/orderbook-updates)

## Actual-market evidence

First session: 16d6f3bb-0f4f-4cb2-a2d4-e5e7cbebc5b4, 183.05 seconds. Collected 66 trade packets and evaluated 2,020 eligible-for-planning observations. There were 409 economically eligible prospective plans, including repeats. All 20 retained best per-pair samples were NFL yardage markets; none of those markets had a reported trade during this session. Thus there is no tape evidence of a fill for those samples. The largest retained plan showed $0.78 after modeled costs for ten paired contracts, but 203 contracts were already ahead at the proposed bid. It was never entered or credited.

Snapshot follow-up: 90c59543-62ce-4ae1-85d9-c65d216186b8, 122.917 seconds. Recorded 178 snapshot request events, 37 trade packets and no parser-recovery events. Of 5,394 approved decisions, 1,721 had usable books; 1,504 selected taker quotes failed prices and 217 failed fees. The planner found 84 prospective maker plans. The two runs cover different market observations and durations, so these counts are not a controlled before/after performance comparison.

Both workers stopped cleanly and released both database leases. Paper positions remain zero, cash is $50/$50, realized profit is $0. Real order transport remains disabled. Signing remains deferred.

## What remains

The economic reason to test maker execution now has actual-market support: some posted prices would leave a positive modeled hedge margin. Fillability remains unproven. The next implementation must bind each queued order to its exact quote and metadata, reserve capital, account for partial fills, cancel/expire safely, and hedge the quantity actually filled with current books. The public feed includes fractional quantities, while the existing entry sizing uses whole contracts; fractional exposure must not be silently discarded. Current queue output must not be booked as a financial fill until this integration is complete.

Tests: 205 passed; TypeScript passed. These include real-format trade parsing, direction aliases, duplicate/old/expired prints, partial queue consumption, disconnect invalidation, prospective quote safety, and snapshot requests that cannot refresh cached evidence or open a position. No tests or builds overlapped live collection.
