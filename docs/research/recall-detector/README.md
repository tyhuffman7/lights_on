# Current Kalshi × Polymarket US candidate observer

READ ONLY / PAPER. This branch starts at `a200abf36cd590c894f936dbe1d6f4c81f461468`, not main. No account, order, preview, cancellation, funding or wallet interface is used. All prices come from native L2 books. The old observer and its history remain intact.

## What prevented detection

- The old watch required the exact frozen 2,852-route universe. Changed pinned metadata and incomplete pre-observation settlement review excluded markets before book collection. Its 48 sequential 90-second shards, plus metadata preparation, could not all fit in 90 minutes; the recorded run reached 34.
- Stream receipt and exchange timestamp ages were conflated with executable eligibility. Quiet Kalshi books become old under the unchanged 2-second rule even if a new snapshot could confirm them. Positive quotes now remain candidates and trigger a refresh instead of disappearing from the candidate stream.
- Native PM-US REST books can be cached for 30 seconds. The September 30 direct probe returned `Age: 22`, `CF-Cache-Status: HIT`. A distinct query returned `MISS` and a newer transaction timestamp. The new worker stores cache age, request/response times, exchange time and receipt time separately. Cached or stale data cannot pass fresh confirmation.
- A native 500-market Kalshi diagnostic, using five subscription requests, failed with a sequence error after 100 books. A single 100-market subscription stayed healthy and received all 100 books. The observer uses one subscription per connection, retains sequence validation and retries each failed group at most three times.
- The first permissive smoke exposed 613,317 hypotheses, bogus opposite orientations and stream starvation. Matching now requires a shared subject/context or a structured event/canonical predicate, resolves named sides, and rejects explicit metric/threshold/period conflicts. This still accepts unreviewed candidates. Native regression fixtures cover wrong touchdown metrics, different golf rounds, career versus season statistics, league versus World Series MVP, fantasy versus reception totals, chart-week counts and generic season labels.

## Corrected flow

Full paginated active catalogs → public predicate/event/outcome candidates → simultaneous persistent book subscriptions → positive normal-fee economic signal → current native metadata and two-book REST refresh → settlement diagnostic → independently labeled delayed depth counterfactuals.

Discovery refreshes every five minutes. Catalog fetching and matching continue alongside monitoring; matching runs in a worker thread. Stable group membership preserves unaffected subscriptions. REST requests are paced per native host, honor bounded shared 429 cooldowns, retry at most three times and use distinct queries plus cache evidence. Failures retain venue, path and attempt. Every route is subscribed together; there is no shard dwell or fixed route-count admission limit. A fair REST lane supplements streams. Two of every three confirmation dispatches prioritize canonical predicates, known orientations and freshness; the third serves the oldest queued candidate. Broad text hypotheses stay visible without monopolizing the lane. Queued confirmations and missing books remain explicit.

For each candidate the evidence retains the exact two IDs, event, side mapping, equal quantity, consumed prices/depth, normal modeled fees, gross/net economics, one-tick/extreme-fee diagnostics, book times/ages/skew, metadata hashes, verification state and confirmation result. Both normal complementary orientations are evaluated; an unresolved proposition orientation is labeled and cannot become an executable result.

The unchanged ordinary fee estimate assumes one Kalshi aggressive fill per consumed price level, with cent ceiling rounding, and cumulative PM-US quadratic fees with half-even cent rounding. Account precision and hidden resting-order fragmentation remain unconfirmed assumptions, separately stressed. Current series/event overrides and market fee coefficients are refreshed before confirmation. Unsupported combo curves preserve gross observations with an unavailable net-fee state. Native fee documentation: [Kalshi](https://kalshi.com/regulatory/fee-schedule), [PM-US](https://docs.polymarket.us/fees).

## Frozen paper parameters and limits

The default bounded window is 20 minutes after catalog/matching/subscription preparation, with a separate ten-minute preparation bound. Native page-sized normalization batches avoid a serial hash-await per market; catalog fetch/normalization and background matching timings are retained. The L2 evidence limit is 256 MiB; native catalog snapshots are stored separately. Quantity search is 1–10 equal contracts. Every one-contract positive is retained, including cent-scale net edges. $50 per venue and $5 total paired commitment are **independent scenario assumptions**, not an account balance or portfolio deployment. Larger quotes remain visible outside that cap. Repeated scenarios are not summed as portfolio profit, and projected payouts never authorize orders.

0/100/250/500/1,000 ms second-leg delays are measured against their actual sampling times, for both first venues. Stale/missing future books produce `UNOBSERVED_*`, not invented fills. Clean depth pairing, disappearance, available unwind and orphan exposure are counterfactual states. Neither a fresh quote nor clean depth pairing proves actual execution or settlement equivalence.

Verification states remain separate. The inherited settlement checker diagnoses ordinary outcome correspondence and differences in sources, deadlines, thresholds, timezones and cancellation/postponement treatment. Its conditional profiles never establish strict equivalence. Unsupported matching/review is `insufficient-information`, not proof of different settlement. No candidate is called a true arbitrage without that proof. Ohio/account/product permission and a live launch remain outside this task.

## Replay and live evidence

[Retained September replay](september-replay.json): 107 native books, 57 paired events / 114 orientation observations, 57 gross positives, 51 modeled normal-fee positives across 47 routes. All 51 remain candidates; four were fresh and old-paper-eligible. Zero economics disagreements against the baseline evaluator. This is a confirmation-selected sample, not a representative market-frequency estimate.

The specific September 23/24 temporary raw directories are absent. The user has no known alternate location. Published 662/71/12 aggregate results remain unchanged in [the old receipt](../ev-arb-september23-retained-replay.json), but aggregates cannot reconstruct the missing L2. That exact raw replay is unverified; it is not replaced with fabricated data.

Smoke 1: 613,317 hypotheses; 83,741 routes obtained both books, only 22 fresh two-book samples, widespread feed failures. Smoke 2 after identity/subscription fixes: 18,260 matched routes; all 18,260 obtained both books; 5,447 fresh two-book observations, 41,241 gross positives, 36,298 normal-fee positives including stale data, 810 fresh normal-fee positives, eight repeat-economic survivors, one fresh executable candidate and zero contract-verified arbs. These repeated event-driven counts are not independent opportunities and are not directly comparable with the old 250-ms sampled run. The remaining false positives are retained for verification and learning.

Smoke 3 validates the final implementation: 17,585 matched, visited and two-book routes; 167/167 feeds healthy at stop; 15,705 fresh two-book observations; 60,766 gross and 52,249 normal-fee-positive readings including stale; 2,805 fresh normal-fee positives; 17 economic confirmation survivors and two fresh executable candidates. Its 120-second observation clock began after preparation. It recorded ten HTTP 429 failures and two expected deadline-aborted requests. The confirmation queue is finite in throughput, with pending routes retained and reported.

[First 20-minute window](bounded-1-receipt.json): all 17,821 seen routes got two books; 169,154 fresh two-book observations, 613,053 gross positives and 533,775 normal-fee positives including stale; 153 economic survivors and 15 fresh quote-executable candidates. Only one of those 15 had a canonical predicate; the remainder were broad matching hypotheses. A full catalog refresh fetched/normalized for 766.645 seconds under live ingress, completing only near the end. This exposed serial per-market hash-await overhead; normalization was batched by native page afterward. The confirmation lane gained explicit-predicate priority plus oldest-first access, and public failures gained bounded backoff/retries. The second final window froze those corrections before any data. Local smoke/raw evidence remains ignored under `work/`; only explicit public examples and sanitized aggregates are published.

The ordinary season-win predicate matches, but [the targeted contract review](CONTRACT-REVIEW.md) identifies different modified-season, correction, source and expiry branches. Current positive quotes remain candidates; these differences are not suppressed by a discovery gate.

## Final frozen window

[Final receipt](final-receipt.json), 2026-09-30T23:09:56.249Z through 2026-09-30T23:29:56.249Z: 17,817 matched/visited/two-book routes, zero unvisited, 6,512 distinct routes with fresh paired books, and 171/171 feeds healthy at stop. Native catalogs were complete on both snapshots: latest 127,252 Kalshi and 72,261 PM-US normalized active markets. Matching and verification remain different questions.

| Stage | Final count |
| --- | ---: |
| Two-book observations | 1,192,699 |
| Fresh two-book observations | 163,517 |
| Gross-positive one-contract readings, including stale | 592,856 |
| Normal-fee-positive one-contract readings, including stale | 512,108 |
| Gross erased by ordinary fees | 80,748 |
| No executable quantity-one depth | 444,939 |
| Fresh normal-fee-positive readings | 34,674 |
| Fresh quote-executable positive readings | 12,497 |
| Distinct economic quote configurations | 13,300 |
| Confirmation dispatches | 160 (107 priority, 53 oldest-first) |
| Economic confirmation survivors | 147 |
| Disappeared at confirmation | 11 |
| Terminal confirmation failures | 2 (fetch failure and deadline abort) |
| Fresh quote-executable survivors | 3 |
| Strict contract-equivalent / confirmed arbs | 0 / 0 — unproved |
| Pending confirmations at stop | 7,939 |

Counts repeat updates, not independent trades. Of the 158 completed confirmations, 106 were canonical and 52 text hypotheses. The three fresh survivors were one different-question House pairing, Purdue season wins with settlement basis risk, and an unresolved Mistral IPO pairing. No actual orders or fills occurred.

At delay zero, six first-venue counterfactuals had clean paired depth. Every 100/250/500/1,000 ms follow-up on those entries was stale/unobserved; 288 ineligible/unobserved counterfactuals per delay came from the other 144 survivors. No realized or portfolio profit, fresh-fill recovery, unwind success or orphan loss is claimed.

Native PM-US book calls generated 101 HTTP 429 responses and one fetch failure. Retries recovered the rate-limited confirmations, but global backoff delayed catalogs and confirmations. The one completed refresh spent 824.344 seconds fetching/normalizing plus 55.199 seconds matching; only two catalog snapshots fit. It did **not** validate a five-minute completed-refresh cadence. Median queue wait was 467.939 seconds (p95 1,007.319); median confirmation work was 10.919 seconds (p95 20.556). Public API throughput and broad-match load still prevent immediate confirmation of every candidate.

[Independent native receipt](native-check.json): 43 selected routes, zero request failures, 34 normal-fee-positive routes (12 canonical), all already surfaced during the window. Independent arithmetic agreed with the detector on all 112 cases, with zero suppressed native positives ([main audit](native-arithmetic-audit.json), [fresh-survivor audit](fresh-native-arithmetic-audit.json)). This includes the three fresh survivors. The first pre-retry native check's 21 failures remain in [its receipt](native-check-first.json). Sampling cannot prove complete catalog recall or absence of real arbs.

At 2026-09-30T23:28:17.084Z, Mistral IPO quantity 3 used Kalshi NO at $0.97 plus PM-US YES at $0.02: $2.97 acquisition, $0.03 gross, $0.01 modeled fees, $0.02 modeled net. Kalshi receipt/request ages were 0/173 ms; PM-US receipt/exchange/request ages were 377/1,929/504 ms. Exact IDs, consumed levels, fee assumptions, metadata hashes and confirmation status are retained in the final receipt. Its full contract criteria align more closely than abbreviated inline prose suggested; issuance/deadline/source/review equivalence remains unproved. Purdue quantity 4 at 2026-09-30T23:20:56.527Z used $0.29 + $0.67, $0.16 gross minus $0.12 fees = $0.04 modeled net, also unverified.

The candidate flow now preserves current native pricing signals. Full arb confirmation remains incomplete because native throttles/backlog delay confirmation and the IPO settlement proof is unresolved. No "no arbitrage exists" conclusion or live launch is supported. The authorized bounded checkpoint and draft publication are the stopping point.

## Synpath comparison

Inspected [Synpath](https://github.com/Synpath-ai/synpath) and [its arbitrage example](https://github.com/Synpath-ai/prediction-market-arbitrage-trading-bot). The SDK's PM-US adapter agrees with native YES-book / mirrored-NO orientation and native `feeCoefficient`. The example explicitly requires `polymarket`, rather than `polymarket_us`, in its matcher and pricing venues; it is not a replacement for this US-only detector.

Two hosted `/match/market` probes, one PM-US anchor and one Kalshi anchor, failed at TLS before any response (`HTTP 000`), including an IPv4 retry. Hosted US matching usefulness therefore remains unverified; no key, installation or paid service blocked native work. Synpath supplied an orientation/fee-source cross-check, no usable hosted candidates. Native venue data remains authoritative.

## Run

Use a new output directory each time; `frozen.json` prevents accidental restart:

```sh
npm run research:recall -- work/current-candidates-NEW --duration-seconds=1200 --env=.env.research
```

The optional env file supplies existing read-only market-stream credentials. Without them REST observation is possible, with missing stream coverage reported. Exact native books and confirmation metadata remain under the chosen directory. This command is not a live-money launch.

Targeted validation: `node --experimental-strip-types --test tests/recall-detector.test.ts tests/ev-arb-learning.test.ts`. The first implementation passed 26/26 local targeted tests; the subsequent batching, retry and dispatch fixes passed 30/30 targeted tests. [Repository CI](https://github.com/tyhuffman7/lights_on/actions/runs/36789120544) passed 789/789 tests, typecheck and production build; [compact receipt](ci-receipt.json). A prior typecheck failure in the independent script was corrected before the final run.
