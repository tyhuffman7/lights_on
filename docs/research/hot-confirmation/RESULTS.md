# Hot confirmation result — 2026-10-01

**Valid live books now confirm while still relevant: WS-only median/p95 signal → confirmation was 18/22 ms.** The full 20-minute window completed, 2026-10-01T05:25:19.844+00:00–2026-10-01T05:45:19.844+00:00, with all 177 feeds healthy at stop. No orders, previews, cancellations, funding or account mutations occurred. No fills or realized profit are claimed.

The frozen implementation was `5f79fbe20af4bab164f784fbef55a135caac27c1`. This proves the confirmation latency checkpoint for native live L2, including useful season-win and IPO paper basis candidates. **Semantic precision remains incomplete:** manual native-rule review classifies 17 of the 20 strongest nominal binary-model survivors as different questions. Their prices are real; their nominal net is not an arbitrage return. These are explicitly retained rather than presented as opportunities.

## Before / after

Both windows are bounded 20-minute observations at different market times. Counts repeat quote updates; they are not unique opportunities or comparable profit rates. The current detector still visited every one of 20,616 matched routes. Native named-winner orientation corrections remove some formerly false positives. Different market states and sampling also affect reading counts; the decrease in raw positives is not a catalog-wide absence or recall proof.

| Metric | September 30 baseline | October 1 final |
| --- | ---: | ---: |
| Fresh quote-executable positive readings | 12,497 | 1485 |
| Confirmation dispatches | 160 | 10,420 |
| Completed confirmations | 158 | 10,418 |
| Economic confirmation survivors | 147 | 10,387 |
| Fresh executable confirmation survivors | 3 | 241 |
| Queue depth at stop | 7,939 | 11 |
| Peak queue depth | not recorded | 100 |
| Median / p95 queue wait | 467,939 / 1,007,319 ms | 18 / 305 ms |
| Median / p95 confirmation work | 10,919 / 20,556 ms | <1 / 54 ms |
| Median / p95 signal → confirmation | 26,671 / 218,986 ms | 19 / 865 ms |
| PM-US REST book attempts | 521–524 derived range | 525 |
| PM-US HTTP 429s | 101 | 109 |
| Confirmations entirely from valid WS | 0 | 9,561 |
| Pending candidates superseded | not measured | 9,910 |
| Economics disappeared before dispatch | not measured | 426 |
| Pending state expired before dispatch | not measured | 4,382 |
| Disappeared at confirmation | 11 | 31 |
| Fresh strict-equivalence proofs | 0 | 0 |
| Fresh ordinary-equivalent / basis-risk readings | not classified then | 50 |
| Known different-question routes vetoed | not measured | 2,318 |
| Completed confirmations / second | 0.132 | 8.676 |

The legacy recorder did not count endpoint roles. Its PM-US REST book range is derived from 419 successful paired/confirmation records plus 102 book failures (lower bound), and 974 total PM requests minus 290 complete-catalog pages and 160 metadata requests (upper bound). Uncorrelated requests at shutdown/in-progress refresh prevent an exact legacy book count. New endpoint counts include every attempt and retry.

REST traffic and 429s **did not improve** in this window: 525 book attempts and 109 throttles. Native responses specified `Retry-After: 10`; sampled limit/remaining headers were absent. The shared native HTTP backoff remains binding. REST confirmation work reached 20,974 ms; maximum signal latency was 22,599 ms. Ready WS confirmations bypass those waits. We do not claim that all stale, absent or disconnected books can confirm sub-second, or infer an undocumented quota from these measurements.

## Current-state proof and paper value

The 241 fresh executable survivors represent 68 route/orientation combinations. Their median/p95 signal latency was 17/23 ms (maximum 1,925 ms). All measured fresh receipt/exchange ages stayed inside the frozen two-second gate. 148 fresh survivors had targeted native metadata records; others explicitly retain native-catalog metadata with review pending. This is not a fee-precision, settlement or execution guarantee.

The 50 ordinary-equivalent/basis-risk survivor readings span 17 route/orientation combinations. The strongest retained valid ordinary question was Houston regular-season wins, confirmed from native WS in 7 ms at 05:41:46.088 UTC:

| Leg / economics | Exact retained value |
| --- | --- |
| Kalshi YES: Houston at least 9 regular-season wins | 5 contracts at $0.5200 |
| PM-US NO: Houston over 8.5 regular-season wins | 1.88 at $0.3100; 0.10 at $0.3300; 3.02 at $0.3400 |
| Acquisition / modeled normal fees / modeled net | $4.2426 / $0.1700 / $0.5874 |
| Kalshi receipt / exchange age | 1,388 / 1,320 ms |
| PM-US receipt / exchange age | 186 / 184 ms |
| Selected quantity / paired commitment including modeled fees | 5 / $4.4126 |
| Classification | ORDINARY_EQUIVALENT_BASIS_RISK |

This fits the frozen $5 paired paper commitment with $50 simulated per venue. Modified/shortened-season treatment, corrections, sources and expiry/review branches may diverge. Extreme-fragmentation fee stress and settlement-risk checks fail; no favorable actual commission or fill assumption is introduced. The 58.74-cent figure is a normal-fee quote model, not money earned or a guaranteed hedge. Anthropic/OpenAI IPO and other season-win records, including exact books, depth, fees, timestamps and divergence branches, are in [extra-audit.json](extra-audit.json).

## Remaining precision and settlement blockers

The automated vetoes reject 2,318 recognized different-question routes while keeping them visible in discovery. Native regressions cover local/national control, scalar/binary payouts, combined outcomes, rank, chart source, qualification stage, metrics, and opposite named-winner orientation. The final review still found uncovered forms: rushing attempts versus yards, #1 seed versus qualification, conference/division versus league champion, first team touchdown versus first game touchdown, league-phase rank versus knockout qualification, and some conditional nominations/metrics. [Strongest review](strongest-review.json) keeps the original frozen classification alongside the reviewed classification and reason for every top survivor. Collector evidence is unchanged; no post-window parameter tuning or new observation occurred.

The top 20 contain 17 DIFFERENT_QUESTION, two ORDINARY_EQUIVALENT_BASIS_RISK, and one UNRESOLVED cabinet-departure case. Zero strict equivalents were proved. Passing-yards versus interceptions and conference versus overall championships can still reach the cheap WS confirmation lane under UNRESOLVED. Do not treat these as economically hedged opportunities. This checkpoint solves prompt L2 evaluation, not complete semantic or settlement proof.

## Verification, retention and stop

98/98 targeted tests passed before the final freeze. [GitHub CI](https://github.com/tyhuffman7/lights_on/actions/runs/36819593348) passed 858/858 full tests, typecheck and build on the frozen source ([receipt](ci-receipt.json)). Signed source commits verify with the repo-local SSH identity. No tests/builds or repeated CI polling occurred during this final collection.

The final native catalog was prepared in 103,509 ms during the short iterations, accepted inside the 30-minute startup limit. It contains 129,349 Kalshi and 71,724 PM-US markets. This window performed no full recrawl; all monitored streams stayed active. Catalog-wide new listings during the window are not guaranteed discovered. Startup and backoff results are different workloads from the prior 824-second refresh and are not a controlled speed comparison.

40 native REST audit samples are retained with exact-version comparisons; no same-version conflicts were found. Two in-flight confirmations were aborted at shutdown. The 11 pending candidates at stop are right-censored, not losses or resumed work. Raw evidence is retained under `work/hot-final-20261001-v2/` with source/evidence hashes in [final receipt](final-receipt.json). Earlier short, failed and stopped iterations remain intact. All observer processes are stopped. PR #22 remains draft; no merge or live launch is authorized.

[Method and official native sources](METHOD.md) · [Final receipt](final-receipt.json) · [Extra timing/book-age/basis evidence](extra-audit.json) · [Strongest candidate review](strongest-review.json)
