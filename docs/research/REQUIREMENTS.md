We are changing the priority of Lights On.

The dashboard and the $100 → $1,000 challenge are secondary. Do not spend meaningful time improving visual design or gamification unless required to expose important system measurements.

The primary goal is to determine whether executable Kalshi × Polymarket US cross-venue arbitrage exists often enough, with enough duration and depth, to justify eventually building automatic execution.

Preserve the existing safety-first fee math, depth walking, settlement-rule fingerprints, ledger, paper mode, and unmatched-leg modeling.

DO NOT add real-money execution yet.

## 1. Refactor the system into four explicit components

Create clear modules/services for:

A. Market Data
B. Market Matching
C. Arbitrage Detection
D. Opportunity Research / Simulation

The dashboard should consume these components; business logic must not live in UI code.

## 2. Replace REST polling as the primary price source

Research and implement the current official Kalshi and Polymarket US streaming/WebSocket market-data interfaces where available.

Maintain an in-memory normalized order book for every subscribed market.

REST should be used for:

- initial snapshot
- contract metadata
- settlement rules
- reconnect/resynchronization
- periodic reconciliation

Streaming data should drive price/depth changes.

Every book update needs:

- venue
- market ID
- local receive timestamp using a monotonic high-resolution clock where possible
- exchange timestamp/sequence where supplied
- best YES bid/ask
- best NO bid/ask
- depth levels
- book freshness
- stream connection status

Implement reconnect, heartbeat, sequence-gap detection and snapshot recovery.

Fail closed if a local book cannot be proven current.

## 3. Build a persistent market-mapping registry

Remove the conceptual 8-pair limitation from the market engine.

Mappings should contain:

- Kalshi market ID
- Polymarket US market ID
- normalized event
- normalized outcomes
- direct vs inverted relationship
- settlement-rule fingerprints
- verification status
- created timestamp
- last verification timestamp
- active/inactive status
- reason inactive

Verification statuses:

AUTO_VERIFIED
MANUAL_VERIFIED
UNVERIFIED
INVALIDATED

Only AUTO_VERIFIED and MANUAL_VERIFIED mappings may produce tradable/research-grade arbs.

If either venue changes settlement-relevant metadata or rules, automatically mark the mapping INVALIDATED.

Do not delete invalidated mappings; preserve them for audit/history.

## 4. Improve automatic market matching, but remain fail-closed

Build a candidate matching pipeline using normalized structured fields before fuzzy text:

- event/category
- entity/team/candidate/asset
- outcome
- threshold
- comparator
- date/time
- resolution deadline
- competition/league/election if applicable

Text similarity should only generate candidates.

It must never independently authorize a pair for eventual trading unless the structured equivalence rules prove it safely.

Show questionable mappings for manual review.

Do not use an LLM in the latency-critical arb calculation path.

## 5. Build a continuously running arbitrage detector

Whenever either side's order book changes, immediately reevaluate all mappings involving that market.

Evaluate both possible orientations:

Kalshi YES + PM-US NO

and

Kalshi NO + PM-US YES

For every quantity supported by meaningful shared depth, calculate:

- executable VWAP on Kalshi
- executable VWAP on PM-US
- exact venue fees
- gross combined cost
- fee-adjusted combined cost
- configurable slippage/reserve
- payout
- net profit
- net ROI
- maximum executable quantity
- maximum executable profit subject to bankroll

Never use midpoint or last-trade prices as executable prices.

## 6. Create an opportunity-event recorder

This is the highest-priority deliverable.

Every arb needs a stable opportunity ID.

Record:

- pair ID
- orientation
- firstSeenAt
- lastSeenAt
- durationMs
- every meaningful book update during the opportunity
- best executable quantity
- gross edge
- fee-adjusted edge
- reserve-adjusted edge
- ROI
- maximum theoretical profit
- exact depth consumed
- book ages
- exchange timestamps
- local timestamps
- reasons for rejection

Continue observing an opportunity after first detection until it disappears.

Persist the data in a schema suited for later statistical analysis.

Do not store only the "best" state; preserve lifecycle data.

## 7. Add latency-survival analysis

For every qualifying opportunity, calculate whether the same hedge would still have been executable after:

0 ms
50 ms
100 ms
150 ms
250 ms
500 ms
1000 ms
2000 ms

Do this using subsequently observed real order-book states, not random simulated prices.

For each latency bucket record:

SURVIVED
SECOND_LEG_GONE
EDGE_BELOW_THRESHOLD
DEPTH_GONE
MARKET_CLOSED
BOOK_STALE

Also record the resulting profit/loss if a first leg were assumed filled and the hedge were attempted at that latency.

Keep the existing 500ms delayed hedge simulator, but generalize it into this latency framework.

## 8. Build an orphan/unwind simulator

For each latency test where leg 1 theoretically fills and leg 2 cannot fill:

Use the subsequent real book to estimate immediate IOC-style unwind of leg 1.

Record:

- first-leg cost
- unwind proceeds
- fees
- realized simulated loss
- whether sufficient unwind depth existed

This should let us estimate expected orphan cost before any real trading occurs.

## 9. Create canonical fee handling

Refactor fee calculations so all scanner, simulator, dashboard and future execution code use one fee service.

Do not hardcode generic Kalshi/Polymarket fee coefficients throughout the application.

Fee configuration should come from official market/series/API metadata where available, with a tested fallback only for explicitly supported market types.

Unknown fee models must fail closed.

Add regression tests for fee rounding boundaries.

## 10. Change the research KPIs

Keep the $100 → $1,000 challenge only as optional gamification.

The primary dashboard metrics should become:

Opportunities detected
Rule-verified opportunities
Gross arb count
Fee-positive arb count
1%+ net arb count

Median opportunity lifetime
P10 / P50 / P90 lifetime

Survival rate at:
50ms
100ms
150ms
250ms
500ms
1s

Total theoretical profit

Capital-constrained theoretical profit at:
$100 bankroll
$250
$500
$1,000

Latency-adjusted profit at:
100ms
250ms
500ms

Average / median executable ROI
Average executable quantity
Average executable dollar profit

Estimated orphan rate
Estimated orphan losses

Net expected profit after modeled orphan losses

Break down results by:

venue orientation
market category
time of day
time until settlement
price range
opportunity duration

## 11. Add a research-mode daemon

The arb observer must run continuously without requiring the dashboard/browser to remain open.

The browser dashboard should only display and control the research process.

Do not rely on a browser timer for market observation.

Build a deployable/background worker architecture appropriate for long-lived streaming connections.

If ChatGPT Sites/Cloudflare infrastructure cannot reliably support long-lived WebSockets as a continuously running consumer, document that limitation and separate the arb observer into an appropriate inexpensive worker/service rather than forcing the architecture into the dashboard hosting environment.

## 12. Security

No API keys are needed for this phase except where authenticated read streams are technically required.

Before any future trading implementation:

- repository must be private
- secrets must never enter source or logs
- use environment/secret storage
- execution service must not expose unauthenticated order endpoints publicly
- strict dollar risk limits must exist independently of the UI
- default state must always be PAPER
- live mode must require an explicit configuration change

Do not implement trading yet.

## 13. Testing

Preserve existing tests and add:

- order-book normalization tests
- WebSocket snapshot + delta tests
- sequence-gap/recovery tests
- cross-venue orientation tests
- fee regression tests
- partial-depth tests
- stale-book tests
- mapping invalidation tests
- latency-survival tests
- orphan/unwind tests
- duplicate opportunity suppression tests

Build deterministic recorded-book fixtures so the arb engine can be replayed without live APIs.

## Definition of done for this phase

Do NOT consider the phase complete because the dashboard works.

It is complete when we can leave the observer running and later answer, with recorded evidence:

"During the observation period, how many real Kalshi × Polymarket US arbitrage opportunities appeared, how large were they after fees, how much executable depth existed, how long did they survive, and how much could a $100 bankroll theoretically have captured at realistic execution latencies?"

Return at completion:

1. Architecture summary
2. Exact files changed
3. Tests added and results
4. Known limitations
5. Instructions to run the observer continuously
6. Location/schema of recorded opportunity data
7. A sample research report from actual observed data

Do not implement real-money execution until this research phase demonstrates that the strategy merits it.

---

## Pre-observation hardening addendum — September 10, 2026

Add the following requirements to the pre-observation hardening phase.

## Broad market coverage is the ultimate goal

The suggested initial set of 10–30 verified mappings is only for staged performance validation.

It is NOT an intended permanent market limit.

The production research goal is to continuously discover and observe as much of the safely matchable Kalshi × Polymarket US universe as the exchange APIs and observer performance reasonably allow.

The desired lifecycle is:

exchange market catalogs
→ candidate discovery
→ structured/text candidate matching
→ persistent mapping registry
→ stream subscription management
→ continuous arb observation

New candidate mappings may automatically enter the registry as UNVERIFIED.

UNVERIFIED mappings may be observed and their raw price discrepancies recorded for research, but they must never contribute to statistics labeled executable, arbitrage profit, latency-adjusted profit, or future trading eligibility.

AUTO_VERIFIED and MANUAL_VERIFIED mappings may contribute to those metrics.

There must be no arbitrary small permanent pair limit.

Subscription management should support dynamically adding/removing markets as markets open, close, resolve, become invalidated, or new candidates are discovered.

Implement API-aware batching/sharding and measure performance before increasing coverage.

## Staged scale testing

Use staged load tests rather than immediately subscribing to the full universe.

Suggested progression:

10–30 verified mappings
100 mappings
250 mappings
500+ mappings or the maximum viable eligible universe

At each stage record:

- total subscribed markets per venue
- messages/sec
- book updates/sec
- evaluations/sec
- p50/p95/p99 processing lag
- event-loop lag
- persistence queue depth
- reconnects
- parser errors
- sequence/reconciliation recoveries
- CPU usage
- memory usage
- database growth rate

Stop scaling when observer performance risks distorting the data.

Document the tested safe operating envelope.

## Infrastructure architecture

Do not introduce unnecessary infrastructure.

For the current research phase, SQLite is acceptable unless measurements demonstrate otherwise.

The observer must remain deployable as a single inexpensive persistent service with durable disk.

Support two operating environments:

1. local development/testing on macOS
2. inexpensive always-on Linux/VPS deployment

Do not require Supabase, PostgreSQL, Redis, Kafka, Kubernetes, or other infrastructure unless actual scale measurements justify them.

Add clear deployment instructions for an inexpensive persistent Linux host.

The service must automatically restart after process/server reboot and resume PAPER_RESEARCH observation safely.

Persist credentials only through environment/secret files outside Git.

The dashboard/control interface must not be publicly accessible without authentication. Prefer loopback/private-network access or a secure authenticated control mechanism.

Add health monitoring sufficient to detect when the observer stops unexpectedly.

## Measure infrastructure latency

Record network/processing timestamps so we can later compare local-machine observation versus cloud/VPS observation.

Do not assume a particular hosting provider or geographic region is optimal.

Later infrastructure decisions should be based on measured Kalshi and Polymarket US round-trip/stream latency.

## Research dashboard is the primary results interface

During PAPER_RESEARCH, Kalshi and Polymarket US accounts should remain untouched.

The Lights On research dashboard/report must be the primary interface for results.

The dashboard should emphasize useful research metrics rather than the $100 → $1,000 gamification.

At minimum show:

- observer uptime
- stream health by venue
- number of subscribed markets
- number of candidate mappings
- verified/unverified/invalidated mapping counts
- gross discrepancies detected
- fee-positive opportunities
- qualifying net arbs
- survival rates at each latency bucket
- modeled orphan rate/loss
- theoretical opportunity
- bankroll-constrained opportunity for $100/$250/$500/$1,000
- latency-adjusted opportunity
- processing latency
- persistence backlog

Add an opportunity table containing:

- first seen timestamp
- pair/event
- orientation
- Kalshi executable price
- Polymarket US executable price
- quantity/depth
- gross edge
- fees
- reserve
- net edge
- ROI
- opportunity lifetime
- survival by latency bucket
- $100-bankroll modeled profit
- final status/rejection reason

Allow drilling into an opportunity to see its recorded lifecycle/book states.

Clearly distinguish:

RAW DISCREPANCY
UNVERIFIED CANDIDATE
VERIFIED ARBITRAGE
FEE-POSITIVE
LATENCY-SURVIVABLE

Never display an unverified price discrepancy in a way that could reasonably be mistaken for a guaranteed arb.

## Data retention/export

The SQLite research database is the canonical research record during this phase.

Provide:

- JSON report export
- CSV opportunity export
- session-level reports
- database size/growth statistics
- safe backup instructions

Do not store credentials, signatures, authorization headers, private keys, or secrets in exported research evidence.

## Future execution observability — design only

Do NOT implement live trading in this phase.

However, preserve an architecture where future live execution will reconcile Lights On's internal order state against the actual Kalshi and Polymarket US order/fill state.

When execution is eventually added, the exchange accounts/fill APIs will be the authoritative source of truth, while Lights On will provide the combined cross-venue operational view.

Do not represent a future two-leg trade as successful until both exchange fills have been independently confirmed.
