# Streaming dispersion methodology — September 23, 2026

This checkpoint observes prices only. It cannot submit or model orders, create strategy positions, settle holdings, or open a PAPER ledger. It uses native Kalshi and Polymarket US; international Polymarket is excluded. The earlier REST experiment remains unchanged and methodologically inconclusive.

## Frozen selection and budget

Ten exact retained culture routes are manually reviewed in [the settlement review](STREAMING-CULTURE-REVIEW-20260923.md). Seven sports controls use retained full-game CFB winner/spread/total, NFL spread/total and MLB winner/total. Select the first future supported event in each stratum, then the middle supported ladder threshold, breaking ties by SHA256(pair ID). The native MLB winner orientation is preserved. No prices enter selection. NFL winner and MLB spread have no supported retained selection in this snapshot; no additional mappings are created.

There are 17 subscriptions per venue, one persistent connection per venue, and at most one temporary PM-US confirmation connection. This is below the existing 60-route screen capacity and 100-market subscription batch. The single-use freeze pins the source manifest, primary-term hashes, route selection and policy. The supervisor sets one absolute wall-clock deadline of 90 minutes; the worker also uses a monotonic deadline. Three physical transport rebuilds per venue are allowed inside that deadline using PR #13's `VenueRebuildBudget` and `feedDiagnostic`. Only a failed transport is rebuilt. Parser, sequence, arrival, clock and conflicting-version faults are terminal; they are not reset by reconnecting. Missing markets remain censored and do not count as zero opportunities.

## Books and economics

`ConfirmationFeed` reconstructs Kalshi sequenced snapshots/deltas and PM-US versioned full books through the existing transport-arrival and ingress queue. Both categories use `validity`, `quoteCandidate`, the existing whole-contract depth walker and unchanged fee bounds. Every relevant content change evaluates both complementary directions and all legal whole quantities 1–10. Inverted native markets preserve their mapped orientation. Quiet reconstructed books remain usable for discovery while the connection, sequence and timing checks are healthy. Heartbeats do not confirm price freshness.

Amounts use integer $0.0001 units. Raw gap is `(q × $1 − displayed two-leg principal) / q`; fee-net gap additionally subtracts existing fee upper bounds. Fees are conditional whole-contract bounds, not collected commissions or fractional-fill guarantees. Exact consumed depth and quantity are retained in derived observations. Risk cash (2¢/contract) and recovery cash (1¢ Kalshi, 5¢ PM-US) remain **separate** from fee-net surplus. Indicative $50/venue cash is analytical only, not a balance or authorization. No new strategy policy or position is created.

The preferred quote maximizes total fee-net surplus, breaking ties toward smaller quantity, exactly as the existing screen. Raw statistics select the largest per-contract raw gap; fee statistics describe the preferred fee-net quote. A separate q=1 comparison prevents scale selection from hiding small-capital economics. Capital-efficiency reporting divides conditional fee-net surplus by displayed principal plus modeled fees, and separately by all reserved cash; any division by days uses indicative event and administrative horizons, not predicted cash release or annualized expected profit.

## Intervals, coverage and confirmation

One interval is a continuous positive route/direction episode. Quantity changes and repeated callbacks do not create new intervals. Unknown data splits observable duration into segments but cannot manufacture a new independent episode; only a later observed nonpositive state separates two episodes. Left/right censoring and observed onsets are explicit. Raw-positive and fee-positive episodes are tracked separately. Positive-after-fee does not assume settlement equivalence.

Valid simultaneous time requires both reconstructed books and healthy arrival/processing/clock state; priceable time additionally requires depth for a legal whole quantity. Health is sampled every 250 ms and on relevant book changes. The final health slice at a detected fault is excluded conservatively. A book fault can bound an interval endpoint to this sampling resolution. Medians are weighted by usable elapsed time, not callback count; per-route results retain coverage, exclusions and supported quantities. Category frequency uses distinct episodes divided by **sum of usable priceable route-hours**, with observed-onset counts and left-censored episodes separately visible. Missing coverage is unavailable/censored; a zero is only a zero within valid measured time.

Each observed fee-positive episode queues a prompt confirmation, at most 180 attempts globally and two seconds between attempts. The worker calls existing `confirmScreenCandidate`: sequenced Kalshi `get_snapshot` and a request-correlated PM-US subscription, then reprices the **exact requested quantity** after both responses against the latest admissible stream state. Existing 1.5-second response, 250-ms processing, two-second proof age and cross-venue window apply unchanged. Outcomes are survived, disappeared or unknown/failed. No new confirmation begins in the last six seconds. Unrequested or pending episodes remain unconfirmed, never silently negative. A confirmed price spread is not an atomic fill or an unconditional settlement hedge.

Public REST is limited to paced preparation metadata/terms and a lifecycle-aware Kalshi status bootstrap after a connection is established. It supplies no observed book prices. No REST book endpoint is called by this worker.

## External context and reproducibility

The current [Moulinier preprint abstract](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7170178) emphasizes how quote mistiming can create apparent cross-platform arbitrage. It motivates synchronized request proof, but its sample is not evidence about these native PM-US culture routes. This study's own streaming coverage and confirmations determine its conclusions. No confidence interval or expected-profit model is justified in advance.

Commands below document one separately authorized, single-use study; they are not permission to repeat it:

```sh
node --experimental-strip-types --test tests/streaming-dispersion.test.ts tests/streaming-dispersion-report.test.ts tests/book-confirmation-adapter.test.ts tests/candidate-confirmation.test.ts tests/streams.test.ts tests/production-operations.test.ts
node --experimental-strip-types worker/streaming-dispersion.ts freeze work/streaming-culture-20260923/study work/streaming-culture-20260923/metadata.json
node scripts/streaming-dispersion-launch.mjs work/streaming-culture-20260923/study /path/to/local/read-stream.env
```

After the worker has stopped, derive the allowlisted report with `node scripts/streaming-dispersion-report.mjs work/streaming-culture-20260923/study docs/research/streaming-dispersion-results-20260923.json`. The reporter refuses an ongoing study. Use hosted CI for the full suite, typecheck and build. No repeated tests/builds or CI polling during collection. Publish only scoped source/tests, review paraphrases with source links/hashes, concise methodology and sanitized derived summaries. Exclude native catalogs, full raw books/tape, environment files, credentials, databases, leases, private account information and unrelated work. Consumed levels supporting a specific derived quote are not a raw order-book dump.
