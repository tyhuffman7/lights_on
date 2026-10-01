# Handoff — 2026-10-01 EDT, native WS confirmation checkpoint stopped

**PAPER / READ-ONLY. The frozen 20-minute observation is complete; all observer processes are stopped. No orders, previews, cancellations, funding or account mutations. No fills, realized profit, merge or live launch. Stop here.**

[Draft PR #22](https://github.com/tyhuffman7/lights_on/pull/22), branch `codex/recall-first-detector`. Persistent checkout: `/Users/tylerhuffman/Documents/code_projects/lights-on/work/recall-detector-20260930/checkout`. Preserve primary checkout local/staged changes, `tyhuffman7` GitHub identity and repo-local SSH signing.

- Frozen source `5f79fbe20af4bab164f784fbef55a135caac27c1`: **98/98 targeted; GitHub CI 858/858 tests, typecheck and build passed**. Source commits' SSH signatures verify. Discovery index/recall selection preserved; explicit native named-winner complement orientation corrected.
- New native WS primary confirmation, latest state per route/side, two-second pending expiry, hot route promotion (128 maximum), bounded evaluation batches, isolated fallback concurrency, asynchronous five-minute metadata refresh and hourly full catalogs. No fabricated separate public rate allowances.
- Final `work/hot-final-20261001-v2`, **05:25:19.844–05:45:19.844 UTC October 1**: 20,616/20,616 routes visited with both books; 177/177 feeds healthy at stop. **1,485 fresh executable positive readings; 10,420 dispatches; 10,387 economic survivors; 241 fresh executable survivors; 9,561 valid-WS-only confirmations; 11 pending at stop, peak 100.** Readings repeat quotes, not trades or profits.
- Median/p95 queue wait **18/305 ms**, work **<1/54 ms**, signal-to-confirmation **19/865 ms**. Valid-WS-only signal latency **18/22 ms**. Fresh survivor signal latency **17/23 ms**, maximum 1,925 ms; paired quote ages stayed inside two seconds. **9,910 supersessions; 426 economic disappearances before dispatch; 4,382 aged pending states removed; 31 disappearances at confirmation.** Two confirmations aborted at shutdown.
- Native REST limits remain: **525 PM-US book attempts, 109 HTTP 429s with Retry-After 10 seconds**, versus baseline 101 throttles. REST work reached 20,974 ms and signal latency 22,599 ms. WS evaluations do not wait for these budgets. PM-US publishes full timestamped snapshots, not a sequence number; do not call them sequence-audited deltas. Kalshi uses contiguous sequences. Forty REST audits had zero same-version conflicts.
- **50 fresh ordinary-equivalent/basis-risk readings across 17 route/orientation combinations, zero strict proofs.** Houston at least 9 / over 8.5 season wins: quantity 5, modeled normal-fee net $0.5874, $4.4126 acquisition plus modeled fees, 7 ms confirmation, explicit modified-season/correction/source/expiry branches. Extreme fee-fragmentation stress fails; no guaranteed net or fills. IPO contingencies remain recorded as basis warnings.
- **Semantic precision is still incomplete.** Automated vetoes recognize 2,318 different-question routes, but manual review labels 17/20 strongest nominal survivors DIFFERENT_QUESTION. Uncovered forms include attempts/yards, #1 seed/qualifier, division/conference/league champions, team/game first touchdown, league-phase rank/knockout stage, and some conditional nominations/stat metrics. Their native prices are real; modeled binary net is not an arbitrage return. Preserve original frozen labels alongside post-run reviews.
- Short iterations, the failed batching iteration, and the stopped initial final window remain retained. Replacement final policy/source hashes froze before collection; nothing tuned after its results. Full native catalogs were prepared during smoke and reused within the 30-minute startup gate; no full refresh during the final window. New-listing completeness within the window is not proved. Prior recovery tests remain complete and must not be repeated/refined without new evidence.

[Results](hot-confirmation/RESULTS.md) · [Final receipt](hot-confirmation/final-receipt.json) · [Strongest native quote review](hot-confirmation/strongest-review.json) · [Basis/timing/book-age evidence](hot-confirmation/extra-audit.json) · [Method / official native sources](hot-confirmation/METHOD.md) · [CI](hot-confirmation/ci-receipt.json). Prior [recall baseline](recall-detector/final-receipt.json) and native arithmetic history remain intact.

**Next action:** user review of draft PR #22 and evidence. Another semantic-precision checkpoint requires a new instruction. No automatic market collection, new automation, live launch, recovery run or merge.

Existing evidence reduction only (no network, orders or account actions):

```sh
cd /Users/tylerhuffman/Documents/code_projects/lights-on/work/recall-detector-20260930/checkout
node --experimental-strip-types scripts/hot-confirmation-report.ts work/hot-final-20261001-v2 work/hot-final-20261001-v2/reduced-copy.json
```
