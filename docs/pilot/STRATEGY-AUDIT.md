# Strategy audit and implementation — September 12, 2026

## Outcome

Conditional paper coverage expanded to 199 distinct pairs after current official metadata checks, spanning college-football winners and NFL player-yard thresholds. The new 100-player/statistic selection overlaps one earlier approval. Approvals remain scoped to paper, expire within 24 hours, and bind metadata. No live orders or shared-registry verification were enabled.

Implemented per-run diagnostics in the existing paper worker: approval, usable data, affordable sizing, price, fee, reserve, minimum-return and other risk blockers. Each evaluation receives one primary blocker. A bounded list keeps the best selected quote per pair with separate gross, after-fee and after-reserve amounts. Indicative top-of-book gross spreads are split between usable and unusable data; they never authorize fills. Runtime/status expose these measurements. Historical cumulative reason counters remain intact. Latest-run diagnostics reset when a new worker starts; save run logs to retain prior diagnostic summaries.

## Actual-data test

Session 008628f8-9623-46ed-9b81-4cf7c9ad46de ran 182.935 seconds and stopped cleanly, releasing both database leases. No tests or builds overlapped collection.

| Stage | Evaluations |
|---|---:|
| Total | 12,252 |
| Unapproved | 7,245 |
| Approved | 5,007 |
| Approved but data unusable | 3,388 |
| Approved with usable books and an affordable quote | 1,619 |
| Selected quote had no positive gross spread | 1,547 |
| Selected quote had gross spread erased by fees | 72 |
| Eligible entry | 0 |

These are repeated decision observations, not unique opportunities. The 72 fresh observations with positive gross top-of-book spread did not survive costs. Another 309 approved observations showed indicative positive top-of-book spreads on unusable books; these may be stale artifacts, not missed executable opportunities. Only four distinct pairs generated sized fresh quotes during this short run, so the sample remains narrow despite broad subscription coverage.

Best saved example: Matthew Golden 70+ receiving yards. One contract pair offered $0.02 gross, -$0.01 after modeled fees and -$0.03 after the reserve. Historical mapping and book reconstruction matched the four saved best samples' selected quantity, net profit and after-fee amount. Repricing all four through the same size optimizer with 2-cent, 1-cent and zero reserve produced no qualifying quotes. This is a bounded counterfactual diagnostic using unchanged cash, not exhaustive replay or fills. No reserve policy was changed.

Paper positions: zero. Cash: $50 Kalshi / $50 Polymarket US. Realized paper profit: $0. The first profitable paper trade has not been achieved.

## Research findings

A primary academic study estimated approximately $40 million in historical arbitrage extraction on international Polymarket over April 2024–April 2025. Its strategies include market rebalancing and relationships among outcomes. This establishes historical evidence of arbitrage, not expected returns for today's Kalshi/Polymarket US two-leg taker strategy. [Paper](https://arxiv.org/html/2508.03474v1)

A popular cross-exchange repository labels itself educational and explicitly omits fees, slippage and gas. Its example output is a dry run, not an independently verified profit history. Its international Polymarket integration also differs from our US venue. [Repository](https://github.com/realfishsam/prediction-market-arbitrage-bot)

A separate US-focused author's project reports adverse selection and unsuccessful passive market-making/correlation strategies. This is self-reported evidence, not an audited track record; it argues against treating maker orders as an automatic fix. [Repository](https://github.com/charlieyang1557/polymarket-arb)

Polymarket US publishes a 0.06 quadratic taker coefficient and a maker rebate. Resting orders may improve economics but require evidence of fills, queue position and subsequent hedge cost. [Official fees](https://docs.polymarket.us/fees)

Kalshi documents snapshots followed by incremental updates, and an explicit get_snapshot operation. This supports investigating unchanged versus stale books; it does not prove that a quiet connection certifies a current executable quote. Existing freshness and sequence gates remain unchanged. [Official order-book stream](https://docs.kalshi.com/websockets/orderbook-updates)

## Next implementation decision

The current sample supports testing whether a resting first-leg quote followed by an immediate hedge can overcome fees. First establish trade/queue evidence and conservative fill assumptions; price touches alone cannot become fills. Separately, compare the 309 unusable indicative spreads with subsequent genuine snapshots before changing freshness logic. Broadly relaxing thresholds or buying a faster host is not justified by this run. Longer collection through active games remains necessary before judging strategy frequency or profitability.

Verification: 198 tests passed and TypeScript passed. The strengthened observer-to-paper diagnostic persistence assertion also passed in a targeted 10-test integration run after collection. No signing attempt, commit, deployment or real orders; 1Password signing stays deferred.
