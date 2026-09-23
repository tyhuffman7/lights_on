# Non-sports catalog and dispersion methodology — September 23, 2026

This is one order-disabled public-catalog and REST-book observation study, not a PAPER strategy session. It imports no account, order, strategy-runner, database or ledger interface. It does not authorize Ohio participation or change fees, recovery, the zero-margin PAPER policy, holdings or settlement state. International Polymarket is excluded. All candidates remain UNVERIFIED.

## Catalog and mapping comparison

One complete accessible catalog was collected from `https://external-api.kalshi.com/trade-api/v2` and `https://gateway.polymarket.us/v1`, using the existing catalog pagination, metadata enrichment and request limits. The receipt records 121,792 unique Kalshi listings, 72,127 unique PM-US listings, 454 requests, 122 Kalshi market pages, 145 PM-US pages and no fetch errors. Pagination is not an atomic market snapshot. Market counts represent the accessible open-listing inventory, not economically independent events.

PR #13 (`aee43f495145a6a484ff8e344a434a362fb646b2`) and this checkpoint use the identical frozen normalized snapshot. Before/after comparisons preserve the full sports universe and bounded indexing. Requested-family reporting uses exclusive primary-predicate strata; unrelated politics, crypto, climate and financial price ladders are outside the requested table. Coarse classification can leave some peripheral markets outside these strata; zero means no matching accessible listing under the documented classifier, not proof the venue never lists that family.

The public coverage JSON includes counts and minimal native-ID examples. Full snapshots, response bodies, full candidate objects and experiment tape stay in ignored `work/non-sports-20260923/`.

## Candidate identity and settlement separation

The new parsers retain subject, domain/family, metric, geography, observation period, rank/threshold/comparator, outcome and YES orientation. Creator is retained when supplied. A missing creator does not become an invented identity; title-only music links require credit review. Different known creators conflict. Ceremony + category + nominee is distinct from nomination. Reality exact placement remains distinct from top-N, elimination and advancement.

Explicit award work-to-artist links retain both subjects and their relationship. They are review links, not exact identities: 80 such VMA routes remain UNVERIFIED. Calendar-normalized IPO deadlines retain a review requirement for time zone, issuance and jurisdiction. Exact named model releases do not equate a named version with “or greater.” Venue taxonomy differences are bypassed only for otherwise identical canonical predicates; explicit settlement fields and payout-conflict guards still apply.

PR #13 already captures 20 current US Netflix #1 show/movie routes. No Netflix parser change was needed. The other 20 PM-US listings are global English charts, while captured Kalshi global rules omit language. Those apparent shared subjects remain blocked: global is not evidence for English. Kalshi #2 routes and view thresholds have no native PM-US counterpart in this snapshot. Publication Tuesday is kept separate from the title's Monday closing date. No settlement field is synthesized.

Preserved legacy candidates are not endorsed by this work. In particular, the sampled monthly Billboard #1 versus a particular weekly #1 route has an incompatible observation window; CPI missing-release fallback conflicts remain known; reality elimination ET/PT boundaries remain unresolved. They are called out in route-level diagnostics and cannot establish arbitrage.

## Frozen price-blind selection and limits

The frozen manifest contains 116 pair IDs: 98 non-sports and 18 existing sports routes. Each requested family contributes at most 12, with subfamilies visited in lexical round-robin order and each subfamily sorted by SHA-256(pair ID). One route per PM market within each selection group prevents duplicating its feed. All other candidate mappings are preserved in coverage counts. No price or observed profit enters selection.

The sports baseline contains six CFB full-game spreads, six MLB full-game totals and six NFL full-game totals. The configured NFL winner stratum produced no selected routes. This baseline does not represent all sports. The 12 awards slots fill with VMA categories; Oscars, Nobel and other award subfamilies therefore have no book-observation sample. The frozen selection is reproducible, but neither random-population inference nor stable category ranking is justified.

Limits: one start receipt, 10 rounds, at least 60 seconds between round starts, 12-minute absolute deadline, 4,000 GETs maximum, 350 ms between request pairs, 1,500 ms timeout, no transport retries, 24 requested confirmations maximum. No settings are tuned after observation. HTTP errors remain missing observations. The study is not repeated to improve its result.

## Books, economics and confirmation

The two public books are requested concurrently. A response pair must be open, within 500 ms receipt skew, and within a 2,000 ms request/availability window. Exchange clocks more than 1,000 ms ahead, HTTP errors, explicit positive cache age/cache HIT, and bad/missing schemas are excluded. Normalization uses existing venue adapters. Missing optional cache provenance does not prove cache absence. Each retained response pair is only a simultaneous **REST-response observation**, not a proved simultaneous executable market state.

Strict execution results remain a separate tier. Public REST does not provide the existing sequenced/requested-WebSocket proof, and Kalshi REST lacks an exchange timestamp. Old PM transaction time is recorded separately; a recent HTTP response is not substituted for a recent market change. No REST row is promoted to strict execution eligibility. Positive displayed economics would justify a second concurrent REST request after two seconds at the **same original direction and quantity**. It could show displayed-edge survival only, never authorize orders or establish a fill. No positive quote means no confirmation request.

Both complementary directions are evaluated at each supported whole quantity from 1 through 10, with identical quantity on both venues. Displayed depth is swept from best ask through all necessary levels; fractional-only residual depth is rounded down per level. The existing market-specific fee schedules and `feeBounds` are used unchanged, including adverse whole-contract fragmentation for Kalshi and cumulative-order rounding for PM-US. The Kalshi bound does not bound arbitrary fractional-fill rounding or identify the account's precision class.

Raw gap per contract is `(q × $1 − both consumed ask costs) / q`; fee-net gap subtracts the existing upper fee bound. These are conditional complementary-price economics, not realized profit or established arbitrage. No recovery/risk allowance is changed or charged. A $50-per-venue indicative capital check keeps this a small-capital screen; there are no larger-capital scenarios and no actual balance is read or debited.

The main comparison fixes quantity at one contract. At each scheduled sample it selects the better complementary direction, then computes each route's median, then an equal-weight family median. Maxima and best observed economics at quantities up to 10 are also retained. Null is unmeasured, not zero. Confirmation samples do not inflate the scheduled-sample ranking.

An interval is a contiguous **sampled positive spell** per route/direction across all supported quantities; timestamp updates and changes of selected quantity do not create additional opportunities. Missing data censors a spell. A distinct observed onset requires a preceding nonpositive observation. First observations and gaps are left-censored; end-of-study spells are right-censored. First-to-last sampled span is only approximate persistence, not a continuous duration. There is no inference across the roughly minute-long observation gaps.

Administrative close/expiration dates are reported only as rough lockup proxies. Event/publication dates are discussed separately in the report; resolution can be delayed and cross-venue close dates differ.

## Reproduction and preservation

Commands from the isolated checkout:

```text
node --experimental-strip-types worker/catalog-coverage.ts NEW_PRIVATE_CATALOG_DIRECTORY
node --experimental-strip-types worker/mapping-coverage-report.ts CATALOG_JSON PR13_CHECKOUT BEFORE_OUTPUT_DIRECTORY
node --experimental-strip-types worker/non-sports-coverage.ts CATALOG_JSON BEFORE_CANDIDATES_JSON OUTPUT_DIRECTORY
node --experimental-strip-types worker/non-sports-observation.ts freeze CANDIDATES_JSON NEW_PRIVATE_STUDY_DIRECTORY
node --experimental-strip-types worker/non-sports-observation.ts observe PRIVATE_STUDY_DIRECTORY
node --experimental-strip-types worker/non-sports-results.ts PRIVATE_STUDY_DIRECTORY DERIVED_RESULTS_JSON
```

The collection/observe commands document this already-completed authorization; do not rerun them after the checkpoint. Offline reductions are repeatable. The study refuses an existing start receipt and verifies frozen policy/code hashes. Targeted local tests cover current public grammar, counterexamples, fee/depth calculations and interval grouping. Full tests, typecheck and build belong to hosted CI. No tests/builds or CI polling run during collection.

Catalog SHA-256: `5b16e8f52dec57ffd9cbf03b0fa46730433140068410a43276619a60324181b8`. Candidate SHA-256: `98dd3e4d7bbb28e88df11e7e35b085aac3f7f1ca12dcedbc6e04f91d148df1d5`.
