# PMXT hosted Router proof of concept — September 24, 2026

**Scope:** Read-only, paper-only comparison for Kalshi × Polymarket US. No order, deposit, wallet action, trading credential, live execution change, or dashboard change. The experiment code is isolated from the existing observer on branch experiment/pmxt-poc.

## Method and sources

- SDK: pmxtjs **2.54.0**, installed and locked exactly. Source freeze for the timed observation: signed commit 3675a87dbab49176d8576aa9432bd59bcdc12fa9.
- Host: https://api.pmxt.dev. Calls: Router.fetchMatchedMarketClusters → GET /v0/matched-market-clusters, and one first-page Router.fetchMarkets probe per target venue → POST /api/router/fetchMarkets. If a direct target identity candidate appears, the code resolves venue-native markets by exact slug/title using Kalshi and PolymarketUS fetchMarkets, then requests individual outcome books with fetchOrderBook via the corresponding hosted /api/{venue}/fetchOrderBook endpoint. No such candidate appeared in the preflight.
- Cluster filters frozen before the timed run: relation=identity, minConfidence=0.80, venues=kalshi,polymarket_us, minVenues=2, includeRawMatches=true, sort=volume. The POC queries both withOrderbook=false for coverage and withOrderbook=true for PMXT's coverage flag. It paginates in 500-cluster pages until a short page, rejects malformed or duplicated pages, and checks exact sourceExchange strings and direct target identity edges before counting candidates. Ordinary polymarket never becomes polymarket_us.
- Polling is one cycle per minute, with at least 2.5 seconds between logical SDK calls (at most 24/minute), below PMXT's documented 60/minute free-tier ceiling. A cycle records both cluster queries. API exceptions are reduced to fixed error codes before logging; the PMXT key is never written. Local JSON/JSONL is under ignored research-data/pmxt-poc/.
- For any research candidate with resolvable native outcomes, the POC requires fresh timestamped L2 asks (2-second maximum age), validates price precision and depth, and walks **equal whole-contract quantities** in both complementary directions. It reuses Lights On's exact fee and level-fill functions, retaining gross, fee-model, fee-upper-bound, one-cent-per-contract reserve, per-venue $100 cash, and max observed depth separately. The modeled rates are Lights On's general Kalshi 700 basis-point quadratic rate and July 2026 PM-US 600 coefficient; applicability to a particular market and Kalshi account-specific fractional precision remain unproven. No quote is an executable arb without settlement equivalence, fresh books, verified fees, and the existing risk gates.

Current PMXT references: [Router matching and response fields](https://www.pmxt.dev/docs/router/matching), [matched-cluster endpoint and 500-row page limit](https://www.pmxt.dev/docs/api-reference/matchedmarkets/fetch-matched-market-clusters), [venue identifiers and hosted catalog list](https://www.pmxt.dev/docs/concepts/venues), [live order-book endpoint](https://www.pmxt.dev/docs/api-reference/fetch-order-book), [catalog versus venue IDs](https://www.pmxt.dev/docs/concepts/catalog-uuid-vs-venue-id), [rate limits](https://www.pmxt.dev/docs/rate-limits).

## Live observations

The three-cycle preflight ran **2026-09-24 04:09:14.959–04:09:47.671 UTC**: 3/3 target queries returned zero clusters; 8 logical API calls, no rate-limit, auth, API, or malformed-response failures. The PMXT key worked. A first-page Router catalog probe returned one Kalshi market and zero Polymarket US markets. A separate one-time, read-only venue capability check returned one Kalshi market and a book with bids/asks shape, while PolymarketUS.fetchMarkets with limit 1 returned zero; this did not establish two-venue book coverage or book freshness.

**Timed observation:** **2026-09-24 04:15:46.758–05:15:49.697 UTC** (60 minutes 2.939 seconds), 72 cycles and 146 logical SDK calls. All 72 coverage pages and 72 orderbook-filtered pages were successful, empty target responses. There were **zero** 429s, auth failures, API failures, malformed responses, target clusters, direct identity edges, PMXT orderbook-flagged target clusters, usable two-venue books, displayed/depth-positive spreads, fee-model positives, reserve-positive models, contract-verified candidates, and executable paper opportunities. No target candidate appeared or disappeared; spread survival at every economics stage is **not measurable**. The target confidence distribution is empty. The first-page Router catalog probe returned one Kalshi market and zero Polymarket US markets; it is not a complete market census.

The cycle log has 72 records, from 04:15:46.762 to 05:15:44.678 UTC, and agrees with the summary's zero counts. A separate raw read-only GET after collection returned HTTP 200 with a data-array envelope of length zero for the same target filter, ruling out the SDK's empty-array fallback as the cause of this particular zero. The best actual Kalshi × Polymarket US example is **none observed**.

**Cadence note:** The frozen runner took 60 nominal one-minute observations, then 12 extra observations in the final minute because its end-of-window scheduler skipped the last sleep. Calls remained paced at least 2.5 seconds apart and produced no rate-limit response. A post-run code/test correction stops future runs at the deadline; the observed run was not repeated or retuned. The ignored evidence is at /private/tmp/lights-on-pmxt-poc/research-data/pmxt-poc/2026-09-24T04-15-46.758Z/.

| Funnel stage | Existing Lights On, historical context | PMXT timed POC |
|---|---:|---:|
| Kalshi markets observed | 136,079 in September 11 full catalog | 1 in first-page catalog probe; full count unavailable |
| Polymarket US markets observed | 105,672 in September 11 full catalog | 0 in filtered first-page catalog probe; full count unavailable |
| Cross-venue candidates/clusters | 863 earlier discovery suggestions; 755 retained after later checks | 0 target-containing clusters |
| PMXT identity matches | N/A | 0 target-containing / 0 direct target edges |
| Direct Kalshi × Polymarket US identity | No directly comparable metric | 0 |
| Contract-verified candidates | No directly comparable contemporaneous count | 0; no candidate reached review |
| Candidates with two usable live books | 2,558 monitorable routes in a September 23 two-hour watch, different denominator | 0; no target book pair could be tested |
| Positive displayed/gross economics | Historical raw positive samples, not unique opportunities | 0 reached pricing |
| Positive after fee model | 0 episodes in September 23 watch under its retained unknown-precision fee bound | 0 reached pricing |
| Positive after reserve | No directly comparable measure | 0 reached pricing |
| Executable paper opportunities | 0 in the September 23 watch | 0 |
| Confirmation/data, stale-book, and rule-equivalence failures | Different watch gates and denominator | 0 API failures; candidate-specific failures unmeasurable |

The existing figures are **not a same-time head-to-head**: the September 11 [discovery snapshot](../pilot/discovery-proof.json) used a different universe and the September 23 [bounded watch](https://github.com/tyhuffman7/lights_on/pull/19) counted monitored routes and repeated evaluations, not PMXT clusters. Its zero fee-net episodes are conditional on an intentionally conservative unknown-account Kalshi precision bound; they do not prove actual venue fees erase every spread.

## Assessment and recommendation

1. **Coverage and matching:** All 72 timed target queries found zero exact-target clusters. PMXT's [current hosted catalog venue list](https://www.pmxt.dev/docs/concepts/venues) includes Kalshi and ordinary Polymarket but omits Polymarket US, although polymarket_us is a supported pass-through venue ID. Zero international-Polymarket pairs were returned by the target-filtered query; a catalog-wide international control was outside this target-only experiment. No international market was treated as a US match.
2. **Provenance and cache:** PMXT normalizes and clusters catalog markets, but a catalog identity score does not establish source freshness or settlement equivalence. In 2.54.0 the Router market conversion does not retain the SDK type's sourceMetadata field, so rule/source evidence available upstream may not survive this path. The POC cannot claim that PMXT resolves Lights On's cache/provenance issue.
3. **Books and execution:** The withOrderbook flag means PMXT reports some live-book coverage on matched edges; it is not proof of two fresh, executable complementary books. The catalog outcome and venue-native outcome IDs can have different address spaces. The POC resolves venue-native outcomes before an individual venue book call. One separate Kalshi catalog-outcome-ID book probe did not resolve; the exact cause was not established, and the Polymarket US path could not be tested without a target market. No midpoint, last trade, or catalog outcome price enters the economics.
4. **Verification kept in Lights On:** Full venue contract/rule documents, outcome orientation, exceptional settlement and void policies, exact fees and fragmentation bounds, timestamp and book-depth validation, equal-quantity sizing, reserves, capital limits, Ohio/account eligibility, and paper execution evidence remain necessary. Lights On's present settlement diagnostic never grants strict equivalence solely from inline prose.

**Recommendation:** Keep the current Kalshi × Polymarket US discovery/matching path. Do not delete custom discovery or matching code and do not migrate the observer. PMXT is worth reconsidering as a candidate discovery input only after its hosted catalog demonstrably ingests Polymarket US and direct identity edges include enough rule/source provenance to pass independent Lights On review. The next exact action is to verify first-party PMXT catalog support for polymarket_us, then rerun this same bounded read-only funnel if support changes. No live launch follows from this POC.

## Verification and limits

- The full repository Node suite passed **229/229** with local loopback access; TypeScript no-emit validation and the production build passed. A clean npm install from the lockfile succeeded, and the 28 focused PMXT/affected research tests passed afterward. The build retained vinext's existing route-classification notice. A local sandbox attempt denied socket binds with EPERM; it was rerun with loopback access and all tests passed.
- The current main branch has no GitHub Actions workflow file. Automatic approval review rejected adding a persistent workflow to this experiment branch as unrequested automation, so GitHub CI could not provide the requested full-suite receipt. The local commands above are the verification evidence.
- The two ignored result files were copied byte-for-byte to the main checkout's ignored research-data/pmxt-poc/2026-09-24T04-15-46.758Z/ directory. A direct secret-presence check found no PMXT key in the JSON or JSONL. The result files contain no market IDs or books because no target cluster was returned.
- The post-run scheduler correction changes only future cycle timing. The economic gates, target filters, fee assumptions, and original 72-cycle evidence were not modified or rerun.

## Reproduction

From the experiment branch, with PMXT_API_KEY in the environment:

    npm ci
    npm run research:pmxt -- --minutes=60 --interval-seconds=60

For this local workspace, the runner can read only that key from the existing ignored research env file without placing its value in an argument:

    npm run research:pmxt -- --key-file=/Users/tylerhuffman/Documents/code_projects/lights-on/.env.research --minutes=60 --interval-seconds=60

Focused validation:

    node --experimental-strip-types --test tests/pmxt-poc.test.ts tests/research.test.ts tests/size-research.test.ts tests/kalshi-rounding-research.test.ts
