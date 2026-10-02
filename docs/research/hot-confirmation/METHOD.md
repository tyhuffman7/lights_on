# Native WS confirmation checkpoint — 2026-10-01

Paper/read-only continuation of draft PR #22. Discovery matching is unchanged; uncertain routes remain observable hypotheses. No order, preview, cancellation, account, funding, wallet, recovery or fill adapter is invoked.

## Native source and access

The [official PM-US Markets WebSocket](https://docs.polymarket.us/api-reference/websocket/markets) provides full `SUBSCRIPTION_TYPE_MARKET_DATA` books at `wss://api.polymarket.us/v1/ws/markets`. Authentication is in the connection handshake. It allows 100 markets per subscription; existing Lights On groups respect that limit and disable debouncing. The [official TypeScript SDK](https://github.com/Polymarket/polymarket-us-typescript) exposes `ws.markets()` and `subscribeMarketData()` with this same native envelope. Lights On already speaks this protocol; installing another SDK is unnecessary.

PM-US documents a full snapshot with `transactTime`, **not a sequence number**. Its primary confirmation proof is therefore a native full snapshot with a nondecreasing exact transaction version. Kalshi uses contiguous subscription sequences, including the snapshot base. Neither feed's heartbeat changes quote age. Missing versions, conflicting same-version contents (including equivalent timestamp encodings), sequence gaps, processing faults, ingress backlog, disconnected feeds and clock faults fail closed. Both receipt and exchange age must satisfy the existing two-second gate. PM-US top-level depth is sufficient only for quantities represented in the returned levels.

The [official rate limits](https://docs.polymarket.us/api-reference/rate-limits) specify 20 requests/second per IP for public endpoints and a global 20/second per key for authenticated endpoints. They recommend WS for books and caching reference metadata. HTTP roles share one per-host public spacing/cooldown budget (300 ms between scheduled requests; three attempts maximum). There is no evidence supporting separate public per-endpoint allowances, so this implementation does not manufacture them. Observed 429s remain authoritative even below the documented ceiling; failed endpoint, attempt, timing and available native limit/retry headers are recorded. No IP rotation, additional account, authentication-budget splitting or increased paid access is used.

## Hot path

The queue keeps one latest signal per route and Kalshi side, with quantity selected from the existing economic comparisons. Updates supersede pending state. A dispatch reprices the current books and removes economics that have disappeared. Two seconds is the maximum pending-state age; new state must replace old state rather than waiting minutes.

Priority is canonical, structured sports-event, then text matching; known orientation; paired freshness; normal-fee net edge; executable quantity; newest signal. Economic-positive and near-positive fresh routes enter a temporary 128-route hot set, prioritized by the same criteria, within two cents of fee-adjusted break-even, with ten seconds of grace after the discrepancy disappears. Hot dirty routes are evaluated before the broad dirty set. Each evaluation batch yields after approximately 20 ms, allowing native frames to drain. Existing subscriptions remain active for every monitored route; promotion does not tear down broad coverage.

Ready WS candidates evaluate immediately, with no REST or metadata await. Slow fallback work has two independent slots and cannot hold the WS lane. Only aged/absent/invalid books use fallback; a connected Kalshi feed first requests a sequenced snapshot. Native PM-US REST is used for a stale/absent PM book, or an independent audit at most once per 30 seconds. A valid stream is not overwritten by audit REST state. Audits compare exact PM transaction versions, not just millisecond timestamps. Quote confirmation does not occupy a slot for delayed execution experiments.

Metadata is refreshed outside the hot path when the startup/cache age exceeds five minutes, with bounded shared HTTP scheduling. Confirmation records identify whether fees/rules came from the native catalog or refreshed native metadata; a cached quote assessment is not an event-fee override or settlement proof. Metadata changes re-enter route evaluation. Full catalogs refresh hourly, not every five minutes. The bounded observation reuses the complete native catalog prepared during the short iterations, accepted only within 30 minutes at startup; streams keep those markets alive. New listings during the bounded window are not guaranteed discovered, and administrative status changes rely on stream state and targeted metadata until the next full crawl.

## Question and settlement handling

Recognized explicit mismatch forms consume no confirmation capacity, but remain in broad observations: local versus national control, different countries/offices, combined versus individual outcomes, scalar payouts versus binary thresholds, vote share versus election winner, winner versus placement/nomination/qualification, event versus season champion, different metrics and playoff stages. Explicit known structural conflicts are vetoes. Missing evidence remains unresolved. Canonical discrete threshold conventions are preserved.

Paper classifications are `STRICT_EQUIVALENT`, `ORDINARY_EQUIVALENT_BASIS_RISK`, `MATERIAL_SETTLEMENT_DIFFERENCE`, `DIFFERENT_QUESTION`, and `UNRESOLVED`. No strict-equivalence certificate exists in this checkpoint; zero strict proofs is preserved. Ordinary season-win candidates retain modified-season, correction, source and expiration/review branches. Canonical IPO candidates retain unresolved issuance/contingency, deadline, source-cutoff and extension branches. The prior [contract review](../recall-detector/CONTRACT-REVIEW.md) and retained full-term evidence underpin those warnings. These are paper basis candidates, never guaranteed arbitrage.

## Measurement and freeze

Each run writes its policy and source hashes before collection. The first smoke exposed stale backlog and unbounded CPU/hot promotion. A subsequent batching iteration failed immediately on an undefined variable; its STOPPED evidence and error remain retained. The corrected two-minute iteration materially improved latency and queue depth. An initially designated final window was stopped and retained as an iteration after native review exposed additional rank/chart/jurisdiction mismatches. Before the replacement final freeze, explicit rank comparisons and named-winner orientation were corrected, and the near-positive money unit was corrected to two cents (EV money uses 100,000,000 units/USD). Discovery indexes, broad candidate selection and catalog sources were preserved. Final code also quarantines incompatible payout shapes found in native results and compares exact PM timestamp versions. An expanded native regression suite verifies these cases. No parameters are adjusted to the final 20-minute observation's results.

Signals are repeated quote readings, not distinct opportunities, trades or profits. Queue latency uses the newest queued economic signal's original observation time; first-signal latency is separately retained. Confirmation work measures dispatch through repricing/fallback, excluding independent metadata/audits. The report separately counts economic disappearance, stale/cooldown/in-flight censoring, expiry and supersession. Fresh executable survivors require positive normal-fee economics, current paired books, minimum quantity and known orientation. Exact books, selected prices/depth, quantity, fees, modeled net, timestamps, native proof and settlement classification are retained per confirmation. The strongest survivors are retained for review, including capital admission.

The final evidence budget is a finite 1 GiB, increased before the final freeze to accommodate WS confirmation throughput. Simulated capital remains $50 per venue and $5 paired commitment, with at most ten whole contracts. This is quote feasibility, not portfolio inventory or reserved live money. Targeted tests run between iterations; full tests/typecheck/build run in GitHub CI. No tests/builds or repeated CI polling occur during collection.

Commands for reproducing reductions (no market access):

```sh
node --experimental-strip-types scripts/hot-confirmation-report.ts work/hot-final-20261001 docs/research/hot-confirmation/final-receipt.json
```

The observation is bounded and stops after this checkpoint. Any later market collection, recovery work or live launch requires a new user instruction.
