> Evidence correction (September 12): historical `book_updates` used selective retention around taker opportunities. Historical quote/replay counts are sampled diagnostics, not exhaustive maker opportunity measurements. Actual paper-order/fill counts remain unchanged. The new paper-capture mode retains every normalized update for its declared selected approved market keys.

# Event-driven maker selection and active-market edge check

The maker worker now consumes book-update notifications through the existing recorder callback. Changed pairs are deduplicated in a bounded 1,000-pair queue and processed on the existing 100 ms timer in batches of at most 16 pairs or an 8 ms between-pair time budget. A single evaluation can exceed that soft budget. The ten-second full sweep remains a fallback for bootstrap and genuine snapshot requests; it no longer blocks updates from being considered sooner. Selection ranks the eligible candidates evaluated within each batch using the existing activity score. Backlogs, active orders, and the timer still add latency; this is not an instantaneous or global best-candidate selection guarantee.

Existing approvals, prices, fee assumptions, reserves, freshness checks, one-outstanding-order rule, activation delay, expiry, public-print fill requirements, and delayed hedging remain in force. Shutdown disconnects the callback and clears queued evaluations. No real order transport was added.

## Historical check

Repriced the recorded book updates for 31 approved college-football pairs that traded during session `8b1ffeda-8d94-4e7c-a17a-13351414f0d8`, using mapping history as of session start, retained approvals, and unchanged fees/reserves. Of 54 evaluations, 18 lacked one book and eight had stale/invalid evidence. The remaining 28 had no eligible quote: fees removed the gross margin in five, and the execution reserve removed it in 23. Best recorded result was UMass: one contract, 1.5 cents gross less one cent fees and two cents reserve = negative 1.5 cents. This is as-of repricing, not a fill or independent historical stream-health certification.

## Three-minute live-data paper test

Session `a374ddc1-160d-4767-8631-a9f54f6ec94a`, 183.051 seconds including shutdown:

- 88 public trade messages across 45 markets.
- 14,437 pair evaluations in 1,213 batches; zero batches with an active eligible quote.
- 31 simulated orders, all closed unfilled. None of their markets traded anywhere in the sample.
- Zero positions and zero profit. Paper cash remains $50 on each venue.
- Worker stopped successfully; no order remains, and both database leases are empty.
- Selection slice p99: 7.17 ms. Maximum pending queue: 485 pairs.

There was one event-loop delay episode, maximum 458.49 ms, which triggered ten Kalshi reconnects. Recovery diagnostics show discovery and REST activity underway; they do not establish which activity caused the stall. This is not a clean no-recovery performance result. Stream invalidation and recovery safeguards stayed enabled. More order attempts did not establish an edge or a profitable fill.

## Verification and interpretation

221 tests passed, including new cases for reacting before the fallback interval, coalescing book updates, bounded queue draining, deselected pairs, and shutdown cleanup. TypeScript and production build passed before the live run; no tests/builds overlapped collection. Existing route-classification build notice remains. Changes are local and have not been committed or pushed in this checkpoint.

There is still a plausible strategy to test, but zero actual-data profitable paper fills so far. Next priorities are establishing an active-market edge after costs and isolating the observed host stall. Neither faster selection nor more attempts alone proves profitability. The existing conservative maker fee assumption has not been changed to manufacture eligibility. Current official sources distinguish maker and taker fees and price-time queue priority: https://docs.polymarket.us/fees and https://docs.kalshi.com/api-reference/orders/get-order-queue-position . Public tape does not establish an actual exchange queue position for our simulated order.

Run from the repository:

```sh
npm run paper -- maker-run observer.config.json research-data/paper-bot.sqlite 180
npm run paper -- status research-data/paper-bot.sqlite
```
