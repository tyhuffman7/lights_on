# Broad discovery validation

Captured 2026-09-11T11:27:48.499Z. Implementation and measurements, not a certification of profitable arbitrage. See coverage-validation.json for full counters, samples, prior failure and longer-run limitations; coverage-performance.json for repeatable synthetic measurements.

## Live catalog and observation

The latest complete cycle fetched **124,238 Kalshi non-combination markets** and **105,873 PM-US markets**, with no catalog API errors. These are returned active-filtered catalog records, not a simultaneous census of every tradable contract. Kalshi MVE combinations are explicitly excluded. Full pagination took multiple minutes; indexed matching took 29.58 seconds in its own worker and performed 19,594,259 comparisons. Work-bound deferrals count repeated posting/choice occurrences, not distinct omitted pairs.

Found **1010 candidates: 660 sports and 350 non-sports**. Automatically verified mappings: **0**. Active registry at capture: {"UNVERIFIED":994}. Cumulative registry statuses: {"UNVERIFIED":1292,"INVALIDATED":50}. Historical invalidations/retirements explain count differences. Subscribed: **500 Kalshi / 500 PM-US**. Deferred by capacity: 420 / 290. Current-session verified opportunities: **0**. No order APIs or trading client were enabled.

| Category | Kalshi fetched | PM-US fetched |
|---|---:|---:|
| ai | 4 | 0 |
| business | 1 | 0 |
| climate | 0 | 60 |
| climate and weather | 978 | 0 |
| commodities | 1354 | 0 |
| companies | 395 | 0 |
| crypto | 3344 | 54 |
| culture | 8853 | 735 |
| economics | 14009 | 0 |
| finance | 0 | 77 |
| geopolitics | 0 | 9 |
| macro | 0 | 85 |
| mentions | 972 | 0 |
| politics | 14382 | 6288 |
| science | 0 | 7 |
| science and technology | 980 | 0 |
| social | 2 | 0 |
| sports | 78873 | 98496 |
| technology | 0 | 62 |
| unknown | 88 | 0 |
| world | 3 | 0 |

Stream validity and book freshness are separate. At capture: [{"venue":"kalshi","known":673,"valid":500,"freshWithin2s":9},{"venue":"poly","known":625,"valid":500,"freshWithin2s":114}]. Preserve the two-second freshness gate; old snapshots do not prove current executable liquidity. Catalog-wide observation is not the same as subscribing to the full catalog.

## Implementation

- Sports identity uses available league, team/player aliases, scheduled dates/time zones, type, period, line and outcome. Ambiguous mascots are not resolved by guessing. Futures distinguish qualification, championship, seed and regular-season outcomes. Metadata identity is never settlement proof.
- General matching uses bounded indexes plus entity, jurisdiction/district, year, threshold, rank, platform and outcome-stage guards. Text overlap ranks candidates; structured identity can admit low-overlap wording. Unknown metadata can still produce missed or questionable candidates; manual review remains necessary.
- Catalog fetch/normalization/matching runs in a worker; only relevant market metadata returns to the observer. Registry persistence is flushed in bounded batches. Mapping changes patch evaluation/persistence indexes immediately and invalidate prior verification when orientation changes. Previously auto-discovered unverified candidates that cease matching are retired without deleting history.
- Recovery plus socket-close invalidates a book once. Queue failure pauses observation without throwing through an invalidation loop. The initial failed live stage is preserved in the JSON evidence.
- Discovery diagnostics show fetch/category counts, rejection reasons, added/refreshed mappings, subscribed/deferred markets, status, last/next cycle and errors. Health polling is five seconds; reports ten seconds with overlap guards. Mapping pages contain at most 100 entries. Browser verification confirmed rendering, pagination and advancing timestamps; a discovered syntax error was fixed and given a regression test.

## Tests and measured load

Passed: npm test (89 tests), npx tsc --noEmit --incremental false, npm run build, npm run test:detector (5,000 randomized comparisons plus regressions), npm run test:load, and npm run test:discovery-load. Build emits the existing route-classification notice.

| Synthetic mappings | Updates/sec | Processing p50 ms | p95 ms | p99 ms | Passed |
|---:|---:|---:|---:|---:|---|
| 30 | 199.4 | 0.414 | 0.637 | 0.765 | true |
| 100 | 398.8 | 0.295 | 0.437 | 0.497 | true |
| 250 | 797.1 | 0.249 | 0.374 | 0.445 | true |
| 500 | 995.5 | 0.235 | 0.348 | 0.403 | true |

Concurrent indexed discovery: 25,000 markets per venue, 10 completed cycles alongside 500 synthetic verified mappings, 997.2 book updates/sec and reports every second. Processing p50/p95/p99: 0.243 / 0.359 / 0.487 ms; all configured stop thresholds passed and persistence drained. This showed no material loss of tested throughput from worker matching. These are short synthetic capacity checks, not exchange fill or latency claims.

Live processing includes recovery invalidations; those batches have higher latency than valid market-data messages. Both distributions and the event-loop maximum are retained in JSON. The earlier roughly five-hour run received over 800,000 book records but also many reconciliation, reconnect, event-loop and metadata errors. It did not produce verified opportunities. Do not interpret this task as certifying unattended reliability or readiness for live trading.

## Manually inspected examples

The following public catalog identities were inspected for obvious mismatches. They remain UNVERIFIED; cancellation, postponement, overtime, ties, retirement, season identity and authoritative resolution terms were not approved. Earlier bad examples (winner versus placement, first-inning run versus game winner, distinct award categories, nomination/declaration versus election winner, wrong at-large district, qualification versus champion and cross-sport futures) led to explicit guards and regression tests. This sample does not establish overall precision.

### 1. UNVERIFIED

- Kalshi: New York J vs Tennessee Pro Football game: New York J wins?
- PM-US: Who will win in the upcoming football event New York Jets vs Tennessee Titans scheduled for September 13, 2026 at 5:00 PM UTC?
- Inspection: NFL, Jets/Titans, September 13, full-game winner; Jets outcome aligned.
- Matcher: Same competition/event participants, date and market type; settlement equivalence still unproven Full structured settlement equivalence not proven; manual review required Indexed text overlap 6; Jaccard 0.261

### 2. UNVERIFIED · inverted outcome

- Kalshi: New York J vs Tennessee Pro Football game: Tennessee wins?
- PM-US: Who will win in the upcoming football event New York Jets vs Tennessee Titans scheduled for September 13, 2026 at 5:00 PM UTC?
- Inspection: Same NFL event; Tennessee versus Jets long side explicitly marked inverted.
- Matcher: Same competition/event participants, date and market type; settlement equivalence still unproven Full structured settlement equivalence not proven; manual review required Indexed text overlap 6; Jaccard 0.261

### 3. UNVERIFIED

- Kalshi: Will LSU win the LSU vs Ole Miss college football game?
- PM-US: Who will win in the upcoming football event LSU vs Ole Miss scheduled for September 19, 2026 at 11:30 PM UTC?
- Inspection: College football, LSU/Ole Miss, September 19, LSU winner.
- Matcher: Same competition/event participants, date and market type; settlement equivalence still unproven Full structured settlement equivalence not proven; manual review required Indexed text overlap 5; Jaccard 0.250

### 4. UNVERIFIED · inverted outcome

- Kalshi: Miami vs Las Vegas Pro Football game: Las Vegas wins?
- PM-US: Who will win in the upcoming football event Miami Dolphins vs Las Vegas Raiders scheduled for September 13, 2026 at 8:25 PM UTC?
- Inspection: NFL, Miami/Las Vegas, September 13, Las Vegas winner; inspect orientation.
- Matcher: Same competition/event participants, date and market type; settlement equivalence still unproven Full structured settlement equivalence not proven; manual review required Indexed text overlap 5; Jaccard 0.227

### 5. UNVERIFIED

- Kalshi: Will East Carolina win the College Football American Athletic Conference Championship?
- PM-US: East Carolina · American Athletic Conference Football Championship Winner
- Inspection: East Carolina, American Athletic Conference championship winner; qualification is a different outcome. Season/void terms still need review.
- Matcher: Same participant and named futures event; exceptional settlement still requires review Full structured settlement equivalence not proven; manual review required Indexed text overlap 6; Jaccard 0.750

### 6. UNVERIFIED

- Kalshi: Will Detroit have the best regular season record in the 2026-27 season?
- PM-US: Detroit · NBA Best Regular Season Record
- Inspection: Detroit, NBA best regular-season record; season and tie treatment remain unverified.
- Matcher: Same participant and named futures event; exceptional settlement still requires review Full structured settlement equivalence not proven; manual review required Indexed text overlap 5; Jaccard 0.500

### 7. UNVERIFIED

- Kalshi: Will Maria win America's Got Talent Season 21?
- PM-US: Maria · America's Got Talent Season 21: Winner
- Inspection: Maria, America’s Got Talent season 21 winner; same named contest and outcome.
- Matcher: Same named outcome/entity in compatible event context; review settlement terms Full structured settlement equivalence not proven; manual review required Indexed text overlap 7; Jaccard 0.875

### 8. UNVERIFIED

- Kalshi: Will Jason De Puy win Big Brother Season 28?
- PM-US: Jason De Puy · Big Brother Season 28 Winner
- Inspection: Jason De Puy, Big Brother season 28 winner; same named contest and outcome.
- Matcher: Same named outcome/entity in compatible event context; review settlement terms Full structured settlement equivalence not proven; manual review required Indexed text overlap 7; Jaccard 0.875

### 9. UNVERIFIED

- Kalshi: Will Reid Wiseman be Time Person of the Year in 2026?
- PM-US: Reid Wiseman · TIME Person of the Year 2026
- Inspection: Reid Wiseman, TIME Person of the Year 2026; same named award/year/outcome.
- Matcher: Same named outcome/entity in compatible event context; review settlement terms Full structured settlement equivalence not proven; manual review required Indexed text overlap 6; Jaccard 0.857

### 10. UNVERIFIED

- Kalshi: Will Democratic win the House race for AK-AL?
- PM-US: Democratic Party · AK-AL House Election Winner
- Inspection: Democratic Party, Alaska at-large House election winner; district and party aligned.
- Matcher: Same named outcome/entity in compatible event context; review settlement terms Full structured settlement equivalence not proven; manual review required Indexed text overlap 5; Jaccard 0.625

### 11. UNVERIFIED

- Kalshi: Will Alexandria Ocasio-Cortez be the Democratic Presidential nominee in 2028?
- PM-US: Alexandria Ocasio-Cortez · 2028 Democratic Presidential Nominee
- Inspection: Alexandria Ocasio-Cortez, 2028 Democratic presidential nomination; distinct from election victory.
- Matcher: Same named outcome/entity in compatible event context; review settlement terms Full structured settlement equivalence not proven; manual review required Indexed text overlap 7; Jaccard 0.875

### 12. UNVERIFIED

- Kalshi: Will Dominique de Villepin win the 2027 French presidential election?
- PM-US: Dominique de Villepin · 2027 French Presidential Election Winner
- Inspection: Dominique de Villepin, 2027 French presidential election winner; candidacy is a different outcome.
- Matcher: Same named outcome/entity in compatible event context; review settlement terms Full structured settlement equivalence not proven; manual review required Indexed text overlap 7; Jaccard 0.875

## API references

- [Kalshi market pagination and MVE filter](https://docs.kalshi.com/api-reference/market/get-markets)
- [Kalshi market-data WebSocket](https://docs.kalshi.com/websockets/websocket-connection)
- [PM-US market fields](https://docs.polymarket.us/api-reference/market/overview)
- [PM-US sports identity fields](https://docs.polymarket.us/data-guide/sports-data)
- [PM-US asset naming and periods](https://docs.polymarket.us/data-guide/asset-naming-conventions)
