# Settlement validation and conditional paper testing

The September 12 five-minute session did not merely lack approvals. Repricing its 14 positive research states with the existing paper ledger settings and cash produced zero qualifying quotes even if the mapping review flag were assumed true. All six candidate pairs exceeded the paper settlement horizon; most also failed the net-return threshold after paper costs. This analysis does not change historical approvals, invent fills, or credit money.

## Read-only review

```sh
npm run paper:review -- observer.config.json research-data/paper-bot.sqlite
```

The report distinguishes supported ordinary-outcome matches, explicit conflicts and unsupported profiles. It also uses saved historical mapping/book evidence to explain positive research quotes under current paper cash/settings. This is counterfactual quoting, not an execution replay: it does not establish simultaneous tradability or hedge fills. No historical mapping means no reconstructed quote. The quote engine and strict book checks are the same ones used by the paper worker.

Profiles currently cover college-football full-game winners and NFL player-yard thresholds. Team/date/period/outcome or player/statistic/threshold disagreement blocks the profile. Unsupported prose does not become approval. In particular, CFB postponement provisions differ: 48-hour commencement at Kalshi versus two-week rescheduling at Polymarket US. Independent fair-price payouts can break the hedge. No profile claims guaranteed complementary payouts in exceptional states.

A separately fixed alias issue caused individual NFL metadata fetches to reject candidates normalized during full discovery. Explicit NFL-scoped roster aliases now keep city/full-team names consistent; ambiguous bare New York and Los Angeles are not added as reviewed aliases. Paper fingerprints normalize these equivalent identity representations but still bind rules, IDs, orientation, fees, dates and other metadata. Live endpoint checks for the representative CFB/NFL pairs are recorded in the local settlement-validation work directory. Roster source: https://www.nfl.com/teams/.

## Conditional paper approvals — user authorized September 12, 2026

The user first selected strict-only testing, then explicitly accepted cancellation/postponement differences and authorized conditional paper testing on September 12, 2026. Exact supported pairs are approved only after current metadata validation, with at most 24-hour expiry. This does not authorize real orders or mark the shared registry strictly verified. Initial approvals and the live-data test are recorded under work/conditional-first/.

After choosing conditional paper testing, stop the worker and approve exact supported pair IDs:

```sh
npm run paper:approve -- --accept-conditional-paper-risk observer.config.json research-data/paper-bot.sqlite PAIR_ID
```

This command refreshes official metadata and refuses changed semantics, inactive pairs, unsupported profiles and incompatible ledgers. It acquires both leases and writes all requested approvals together only after validation. It never writes the shared research mapping registry or authorizes live trading. Approval expires after at most 24 hours or either listed close time, whichever comes first. Changed metadata invalidates the approval; restarting does not extend it.

The worker stores the exact approval and its risk explanations on each conditional paper position. Conditional pairs receive subscription priority, but still need current stream books, profitable net pricing, available capital and the existing risk/horizon limits. Metadata changes during the hedge prevent completing the second leg and use the existing modeled unwind/exposure handling. Settlement credits actual reported venue payouts, not an assumed $1 paired payout.

Run/status commands remain unchanged. Runtime output separates conditional paper approvals from verified registry mappings; positions explicitly name their settlement basis and risks. Synthetic test data is not allowed to use conditional approval as a way into a live-data ledger: the normal source checks remain.

## Evidence and limits

193 tests pass, including conditional-entry gating, immutable position evidence, expiry, changed metadata, restart persistence, capacity priority and individual-fetch/catalog alias equivalence. TypeScript and production build pass. The entry/hedge tests use explicitly synthetic protocol prices, not actual exchange fills. Fresh official metadata was fetched read-only; no conditional actual-market run or real order was made while the policy choice remained pending.

Official Kalshi contract terms reviewed locally: FOOTBALLGAMEWIN.pdf, FOOTBALLENTITYSTAT.pdf, U3.pdf, EMMYS.pdf and NETFLIXRANK.pdf under https://assets.kalshi.com/contract_terms/. Inline Polymarket US rules came from its public market API. Linked-document differences are surfaced as risks; these diagnostics do not certify full legal or exceptional-state equivalence.
