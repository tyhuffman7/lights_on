# External mapping sources — September 22, 2026

**Decision: retain the internal candidate generator; adopt no external dependency or dataset.** This bounded public-source review obtained **zero current Kalshi↔Polymarket US pair records**. That is an access/venue-scope result, **not evidence that the hosted services have zero US matches**. Matching remains candidate generation; settlement approval, fresh native books, fees, and PAPER risk gates remain separate.

Access: **2026-09-22 UTC**, with direct API probes at **23:56–23:58 UTC**. Public source was inspected before considering reuse. No external code was run, dependency installed, account created, paid service subscribed to, or international market admitted.

## Measured availability and provenance

| Source inspected | License / distribution inspected | Actual PM-US evidence | Current usable US pair records obtained |
| --- | --- | --- | ---: |
| **PMXT** | MIT code; GitHub revision `4a367d812541154002eedda36b0916a3cf68e0f2`; 697 source blobs, complete tree. Open adapter code does not itself supply the hosted pair database. | Real `polymarket_us` adapter uses `api.polymarket.us` and `gateway.polymarket.us`. Matching routes use the hosted PMXT client. Adapter support does **not** establish US matching coverage. | **0 imported; hosted count unknown** — documented cluster endpoint failed TLS in two clients. |
| **Pytheum** | MIT code; revision `902d69eb9f600aeef01ff1004373758f5e4d49c1`; 186 blobs, complete tree. README describes dataset CC-BY-4.0; manifest pins hashes, but **0 data artifacts are distributed in the inspected tree**. | Equivalence index uses `pm_gamma_id`, `pm_condition_id`, and `pm_slug`; fungibility code refers to UMA. These are international Polymarket semantics, not evidence of PM-US support. | **0** in obtainable source; hosted count inaccessible (HTTP 404, `DEPLOYMENT_NOT_FOUND`). |
| **Prediction Hunt / prediction.com** | Hosted proprietary matching, governed by API terms rather than an open-source/data license. Docs require an API key; ownership and redistribution restrictions are explicit. | Docs explicitly list `platform=polymarket_us`, and say US markets can be reached through a matching group returned by another venue's leg. Best relevant hosted lead, **unverified coverage**. | **0 imported; count unknown** — US catalog and status probes returned HTTP 403 / `1010`; no key was obtained. |
| **nl2992/prediction-pipeline** | Revision `ae7ea15e33dffce351924e3bbd97509907cf90c2`; 98 blobs, complete tree; no license returned by repository metadata and no license file in inspected tree. No reusable pair dataset found. | Client explicitly uses Gamma and CLOB `.polymarket.com` endpoints. Its current large-catalog claims concern international Polymarket. | **0 PM-US mappings supplied by inspected source.** |
| **RichardFeynmanEnthusiast/kalshi-polymarket-market-matching** | Revision `0c06b5dd6201df41e88ef2c2575efb53951baecf`; 19 blobs, complete tree; no license found. README describes generated/labeled Feather files, but none are shipped. | Loader uses `gamma-api.polymarket.com/markets`; embedding/classifier pipeline is international-only as inspected. | **0 PM-US mappings supplied by inspected source.** |
| **Dome** | Official documentation inspected; no SDK or data reused. | Official notice states all Dome APIs reached end of life April 28, 2026. | **0 obtainable through an active documented service in this review; do not integrate.** |

Public source inventory is a measurement of the pinned Git trees, not a claim to have searched every possible release, fork, or privately distributed export. Pytheum's **142,179** pair count is a publisher manifest description of an unacquired artifact, not our measured current count and not a PM-US count.

## Sources inspected beyond marketing claims

- PMXT: [MIT license](https://github.com/pmxt-dev/pmxt/blob/4a367d812541154002eedda36b0916a3cf68e0f2/LICENSE), [US adapter configuration](https://github.com/pmxt-dev/pmxt/blob/4a367d812541154002eedda36b0916a3cf68e0f2/core/src/exchanges/polymarket_us/config.ts), [adapter implementation](https://github.com/pmxt-dev/pmxt/blob/4a367d812541154002eedda36b0916a3cf68e0f2/core/src/exchanges/polymarket_us/index.ts), [hosted matching client](https://github.com/pmxt-dev/pmxt/blob/4a367d812541154002eedda36b0916a3cf68e0f2/core/src/router/client.ts), [cluster documentation](https://github.com/pmxt-dev/pmxt/blob/4a367d812541154002eedda36b0916a3cf68e0f2/docs/router/matching.mdx).
- Pytheum: [MIT license](https://github.com/pytheum/pytheum/blob/902d69eb9f600aeef01ff1004373758f5e4d49c1/LICENSE), [dataset distribution notes](https://github.com/pytheum/pytheum/blob/902d69eb9f600aeef01ff1004373758f5e4d49c1/datasets/README.md), [artifact manifest](https://github.com/pytheum/pytheum/blob/902d69eb9f600aeef01ff1004373758f5e4d49c1/datasets/MANIFEST.json), [equivalence index](https://github.com/pytheum/pytheum/blob/902d69eb9f600aeef01ff1004373758f5e4d49c1/src/pytheum/equivalence/index.py), [fungibility classification](https://github.com/pytheum/pytheum/blob/902d69eb9f600aeef01ff1004373758f5e4d49c1/src/pytheum/equivalence/fungibility.py).
- Prediction Hunt: [US catalog schema](https://prediction.com/api/docs/v2/markets), [US matching-group documentation](https://prediction.com/api/docs/v2/matching-markets-url), [matching schema](https://prediction.com/api/docs/v2/matching-markets), [authentication](https://prediction.com/api/docs/authentication), [API terms](https://prediction.com/terms-of-service).
- Other open repositories: [pipeline international client](https://github.com/nl2992/prediction-pipeline/blob/ae7ea15e33dffce351924e3bbd97509907cf90c2/polymarket/client.py), [pipeline matching safety examples](https://github.com/nl2992/prediction-pipeline/blob/ae7ea15e33dffce351924e3bbd97509907cf90c2/docs/MATCHING_SAFETY.md), [ML matcher international loader](https://github.com/RichardFeynmanEnthusiast/kalshi-polymarket-market-matching/blob/0c06b5dd6201df41e88ef2c2575efb53951baecf/helpers/polymarket_helper_functions.py), [ML matcher pipeline documentation](https://github.com/RichardFeynmanEnthusiast/kalshi-polymarket-market-matching/blob/0c06b5dd6201df41e88ef2c2575efb53951baecf/README.md).
- Dome: [official end-of-life notice](https://docs.domeapi.io/).

## Comparison and bounded failure sample

Let **I** be the internal native Kalshi↔PM-US candidate pairs in the accompanying fresh-catalog audit, and **E_obtained** the external native-US pair records actually obtained here. **|E_obtained|=0; overlap=0; external-only=0; internal-only=|I|=2,919.** These are obtained-data set counts only. True hosted overlap, hosted external-only opportunities, external recall, and false-positive rate are **not measurable** from this access-limited review. Do not label all internal candidates unique to Lights On or cite this result as proof that commercial mapping adds no value.

The **live external-record false-match audit has sample n=0**. Separately, a deterministic bounded review inspected **five public example pairs**: the four `_ALL_PAIRS` fixtures in [Pytheum's matched-route tests](https://github.com/pytheum/pytheum/blob/902d69eb9f600aeef01ff1004373758f5e4d49c1/tests/test_markets_matched.py), plus the single PMXT market-cluster response example linked above. All **5/5 are structurally unusable as PM-US pairs**; **0/5 establishes a current US mapping**. Four are explicitly fake test rows and one uses placeholder identifiers, so this is a namespace/schema test, not a live accuracy estimate.

| Public sample | Pair represented | PM-US compatibility finding |
| --- | --- | --- |
| Pytheum `_MONEYLINE` | Lakers–Celtics winner | `polymarket:10001` / Gamma ID; synthetic international namespace. |
| Pytheum `_TOTAL` | Chiefs–Raiders total over 48.5 | `polymarket:10002` / Gamma ID; synthetic international namespace. |
| Pytheum `_EVENT` | Democrats winning the 2026 Senate | `polymarket:10003` / Gamma ID; synthetic international namespace. |
| Pytheum `_TENNIS` | Djokovic–Sinner Australian Open winner | `polymarket:10004` / Gamma ID; synthetic international namespace. |
| PMXT cluster response | Satoshi moving bitcoin in 2026 | `sourceExchange=polymarket`, placeholder `pm_...`; no native US leg. |

These further source/schema observations explain why external confidence must not bypass native validation; they are **not observed false matches from a live response**:

| Inspected sample | Specific incompatibility or limitation | Required handling |
| --- | --- | --- |
| Pytheum `pm_gamma_id` / `pm_condition_id` pair schema | International identifiers do not identify a PM-US contract, even if titles coincide. | Reject from US pair input unless independently joined to a fresh native US market and reviewed. |
| PMXT documentation's subset example, presidential winner versus popular-vote winner | Winning the presidency does not logically imply winning the popular vote. The documented example cannot establish the stated subset relation. | Treat relation labels as hypotheses; validate actual payout predicates. |
| Pytheum `classify_fungibility` on a recognized sports type | Classification returns `arbitrage_clean` by type; the function does not compare two native rule documents. | Keep cancellation, postponement, tie, period, result-finality and source checks in the internal settlement gate. |
| Pipeline's win-election versus run-for-office regression sample | Same person/topic can have different payout predicates; the project's own safety notes describe rejection. | Retain predicate rejection; title or price similarity cannot approve a pair. |

## Dependency provenance inspected

[PMXT's package manifest](https://github.com/pmxt-dev/pmxt/blob/4a367d812541154002eedda36b0916a3cf68e0f2/core/package.json) declares an MIT Node/TypeScript sidecar and pins `polymarket-us` at `0.1.1`; it also brings multiple other venue SDKs, blockchain clients, and a server stack. [Pytheum's manifest](https://github.com/pytheum/pytheum/blob/902d69eb9f600aeef01ff1004373758f5e4d49c1/pyproject.toml) declares MIT, Python 3.11+, HTTP/MCP/server dependencies, and packages the dataset manifest alone. These are publisher-declared dependency origins, **not a completed transitive-license or supply-chain audit**. Neither dependency graph was resolved or executed; no source or dataset is incorporated into Lights On. The two unlicensed matcher repositories were read for approach/scope only.

## Decision and limits

PMXT is a plausible **adapter** reference but provides no demonstrated incremental US pair coverage here. Pytheum has a more explicit mapping/settlement schema but its inspected identifiers and distribution do not supply this project's US catalog. Prediction Hunt is the strongest identified US-specific hosted lead; it needs accessible authenticated results and an internal-use evaluation before any adoption decision. No dependency is justified by the measured benefit (**0 additional usable US records**).

The implementation checkpoint should therefore improve and measure the existing native matcher, preserve rejection reasons, and keep external integration optional. Any future authenticated comparison should freeze native catalogs, retain provenance and venue namespaces, export only minimal pair identifiers permitted by the provider, and measure overlap plus manually reviewed external-only samples. No service account or subscription is needed to complete the current native audit.

Private read-only receipts and source excerpts are in ignored `work/execution-mapping-20260922/external/`. No raw API payload, external source copy, book, account data, or credentials are included in this report.
