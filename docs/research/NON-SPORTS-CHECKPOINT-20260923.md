# Non-sports coverage and price dispersion — September 23, 2026

**274 non-sports candidate links added; none removed; all UNVERIFIED. The public-book experiment is inconclusive: zero positive fee-net sampled intervals and zero strictly executable routes were established. PM-US throttling/cache exclusions leave too little comparable data to rank culture against sports.** No PAPER strategy session, fills, profits, orders, ledger debits or holding settlements occurred.

[Methodology and reproduction](NON-SPORTS-METHODOLOGY-20260923.md) · [coverage statistics](non-sports-coverage-20260923.json) · [observation statistics and every selected route](non-sports-dispersion-20260923.json) · [remaining mapping gaps](non-sports-residuals-20260923.json).

## Coverage before and after

The same current accessible snapshot contains **121,792 Kalshi and 72,127 PM-US markets**. The complete matcher moves **3,010 → 3,284 pairs**. Requested non-sports families move **195 → 469**; all non-sports, including other non-requested families, move **275 → 549**. **2,735 sports candidates are unchanged**, with no sports additions. Every baseline candidate ID remains. These counts are distinct native contract pairs, not independent economic opportunities or verified routes.

| Requested family | Kalshi markets | PM-US markets | Before | After | Added |
| --- | ---: | ---: | ---: | ---: | ---: |
| netflix-ranking | 80 | 40 | 20 | 20 | 0 |
| netflix-views | 22 | 0 | 0 | 0 | 0 |
| spotify | 334 | 48 | 8 | 36 | 28 |
| other-music-charts | 1,130 | 0 | 0 | 0 | 0 |
| billboard | 776 | 79 | 38 | 55 | 17 |
| reality-tv | 149 | 190 | 70 | 111 | 41 |
| awards | 1,793 | 271 | 12 | 159 | 147 |
| time-person | 48 | 25 | 24 | 24 | 0 |
| entertainment-release | 299 | 2 | 0 | 0 | 0 |
| critic-score | 385 | 49 | 0 | 0 | 0 |
| box-office | 4 | 0 | 0 | 0 | 0 |
| casting-announcement | 1,538 | 0 | 0 | 0 | 0 |
| culture-lists | 286 | 24 | 0 | 0 | 0 |
| science-technology | 1,033 | 86 | 0 | 2 | 2 |
| companies-business | 753 | 37 | 0 | 39 | 39 |
| economics | 4,983 | 179 | 23 | 23 | 0 |

## Shared underlying events and reasons for misses

The following audit separates parser omissions from one-sided listings and non-equivalent predicates. The new parsers independently identify **199 exact parsed links absent before the fixes**; all 199 are now candidates. A further 75 new explicit work-to-artist links are review relationships, bringing additions to 274. Counts refer to contract links, not the number of event families. Recovered links provide a reproducible lower bound on genuine missed candidate coverage; they do not prove settlement equivalence.

- **netflix-ranking:** 20 US routes already captured. 20 global English PM rows have apparent Kalshi subjects but unknown Kalshi language; blocked, not a subject/date/rank parser defect.
- **netflix-views:** No native PM-US listing in this snapshot; cannot measure a route.
- **spotify:** 28 missing links recovered across annual artist/song US/global charts; retained rank, Wrapped basis and known creator. Remaining rank/album/subject populations do not have exact counterparts.
- **other-music-charts:** No native PM-US counterpart to Luminate, YouTube or IFPI families found.
- **billboard:** 17 weekly chart links recovered; title vs credited-work wording and chart-date phrasing. Annual artist #1 routes existed. A legacy month-ever/week route remains flagged as incompatible.
- **reality-tv:** 41 links recovered: primary winner/runner-up/ordinal grammar, program and season. Top-N, exact placement and elimination stay distinct. No new elimination/advancement parser added.
- **awards:** 147 links recovered: 72 exact ceremony/category/nominee links plus 75 additional work/credited-artist review links. Eleven named 2026 Nobel Peace counterparts remain unparsed; no PM-US Emmy/Grammy counterparts in this snapshot.
- **time-person:** 24 current annual candidate links already captured. Year/decade and naming/cover/group differences remain distinct; no new parser recall gain.
- **entertainment-release:** Two PM-US GTA VI release dates, neither equal to the five Kalshi GTA VI deadlines. Other release families lack PM-US counterparts. No deadline invented.
- **critic-score:** Shared film/measurement events exist, but PM-US ≥N ladders and Kalshi >N ladders are not complementary at N; no exact supported threshold match found. Metacritic has no PM-US counterpart.
- **box-office:** No native PM-US counterpart found.
- **casting-announcement:** No native PM-US counterpart found for the classified casting/role/announcement families.
- **culture-lists:** PM-US wealth thresholds use Bloomberg; Kalshi Forbes/point-in-time and strict-threshold predicates differ. No exact common list/rank route established.
- **science-technology:** Two Grok 5 release deadlines recovered. Other apparent overlaps retain named-version/successor, benchmark (LiveBench vs Arena), date/time or source differences; not merged.
- **companies-business:** 39 IPO candidate links recovered through company + confirmation event + calendar deadline; includes multiple Kalshi contracts for some PM outcomes. Jurisdiction/time/issuance still unverified.
- **economics:** Existing 23 CPI/GDP/unemployment baseline links retained. Known CPI fallback incompatibility remains; continuous thresholds are not adjusted.

Netflix deserves a specific conclusion: PR #13's existing representation already captures the current US recurring show/movie listings, including numbered seasons and the Sep 29 publication date despite Sep 28 in Kalshi titles. Its global misses are unresolved English-chart scope, not a reason to drop geography or language. Kalshi has #2 and view-threshold markets; PM-US does not list those corresponding outcomes here.

Spotify's previous eight candidates were global artist links. The fixes recover US artist and annual song links using the primary payout text. Awards' previous 12 candidates severely underrepresented Oscars and VMA ceremony/category matches. Reality TV had 70 candidates but missed placement/winner phrasing, particularly runner-up wording. Minimal current public metadata fixtures and negative tests preserve ceremony, category, rank, geography, year, season, credit, threshold and orientation distinctions.

## One frozen observation study

The study ran **2026-09-23T02:53:28.286000+00:00–2026-09-23T03:03:08.797000+00:00**, 10 rounds and 2,320 public GETs. Selection was frozen before prices: **98 non-sports and 18 existing sports routes**, at most 12 per non-sports family, quantities 1–10 and $50 indicative cash per venue. No actual capital was touched.

The table measures the better complementary ask-cost direction at **one matched contract**. Family medians give each observed route equal weight. Raw gap is $1 less both consumed ask costs; fee-net gap subtracts unchanged fee upper bounds. Negative gaps are deficits. “Usable” means simultaneous uncached REST responses with enough depth under the observation gates; it does **not** mean strict execution eligibility or settlement equivalence. Every strictly executable-route count is zero. Null values are unmeasured.

| Family | Selected / usable routes | Usable scheduled samples | Raw median / max (¢) | Fee-net median / max (¢) | Positive sampled spells |
| --- | ---: | ---: | ---: | ---: | ---: |
| netflix-ranking | 12 / 0 | 0 | — / — | — / — | 0 |
| spotify | 12 / 0 | 0 | — / — | — / — | 0 |
| billboard | 12 / 0 | 0 | — / — | — / — | 0 |
| reality-tv | 12 / 1 | 1 | 3.00 / 3.00 | -1.00 / -1.00 | 0 |
| awards | 12 / 5 | 19 | 0.00 / 0.00 | -2.00 / -1.00 | 0 |
| time-person | 12 / 3 | 3 | 0.00 / 1.00 | -1.00 / 0.00 | 0 |
| science-technology | 2 / 1 | 4 | -2.00 / -2.00 | -6.00 / -6.00 | 0 |
| companies-business | 12 / 0 | 0 | — / — | — / — | 0 |
| economics | 12 / 3 | 5 | -1.00 / 1.00 | -3.00 / 0.00 | 0 |
| sports | 18 / 0 | 0 | — / — | — / — | 0 |

Families with zero candidates were not book-sampled. Awards' selected sample is VMA only; Oscars/Emmys/Grammys/Nobel have no price sample. Sports contains six each of CFB full-game spreads, MLB totals and NFL totals. NFL winners produced no selection under this stratum definition. Neither sample is a population-wide sports/culture comparison.

Exclusions in scheduled response pairs: **{'HTTP_429': 991, 'CACHED_RESPONSE': 137}**. Rate limits and explicit cache HIT/age evidence were not treated as current executable depth. Missing cache provenance was not promoted to execution proof. No settings were tuned and the study was not repeated.

Across all supported quantities there were **zero positive-after-upper-fee sampled spells**, so supporting positive quantity/depth and interval duration are **not applicable**, not fabricated zeros of market opportunity. **No confirmation was justified or requested**; confirmation survival is unmeasured. Repeated samples were grouped by route/direction with data gaps censored; they were not counted as independent opportunities. Raw depth remains private; public per-route statistics retain the observed quantity and two-leg cost for the best measured quote.

The strict tier remains empty because these REST observations lack the existing sequenced/requested-stream proof, and Kalshi's REST book lacks an exchange timestamp. The study does not weaken any freshness, settlement, fee, risk or Ohio gate.

## What the measurements support

The **descriptive order among the few measured categories**, from largest to smallest median fee-net gap, is reality-tv, time-person, awards, economics, science-technology. This is an ordering of observed deficits/break-even prices, **not a ranking of arbitrage attractiveness**. Sample sizes and missing sports observations make a stable ranking impossible.

No family demonstrated a positive combination of dispersion and short lockup in this run. The shortest reusable review structures are AGT's current finale (Sep 23), VMAs (Sep 27), Netflix weekly publication (Sep 29), and the Billboard chart dated Oct 3 (normally published the preceding Tuesday). These are event dates, not guaranteed fund-release dates. PM-US administrative expiration often extends roughly two weeks beyond an event. Spotify Wrapped and TIME annual lists, and many IPO/model-release deadlines, can tie up capital for months; IPOs can resolve earlier after a qualifying announcement. The results JSON records each venue's administrative horizon separately.

**The sports-heavy emphasis is not justified by this measurement—and the opposite claim is also unsupported.** The catalog proves substantial neglected non-sports overlap. The price experiment does not establish that culture has larger/more frequent executable discrepancies, nor that sports is better. No positive fee-net interval or realized profit was shown. A separately authorized follow-up should first establish reliable read-only public-book access and settlement-equivalent comparisons; this checkpoint stops without rerunning collection.

## Concrete routes for deep settlement review next

These are research priorities, not trades. The first entries use the limited measured near-parity evidence; unpriced entries are included for short/reusable structure or recovered scope. None is verified. Native IDs and source links refer to the frozen current catalog.

| Route | Kalshi ↔ PM-US | Why review / principal blocker |
| --- | --- | --- |
| Tame Impala / Dracula, VMA Best Alternative | [KXVMA-BA26-TAM](https://kalshi.com/markets/kxvma/kxvma-ba26) ↔ [tac-vmas-alt-09-27-2026-dratam](https://polymarket.us/event/tac-vmas-alt-09-27-2026-dratam) | Near-parity displayed prices; artist versus nominated work, shared/tie award treatment. Event Sep 27. |
| Charli xcx / SS26, VMA Best Art Direction | [KXVMA-BAD26-CHA](https://kalshi.com/markets/kxvma/kxvma-bad26) ↔ [tac-vmas-artdirection-09-27-2026-ss26ch](https://polymarket.us/event/tac-vmas-artdirection-09-27-2026-ss26ch) | Near-parity displayed prices; credited artist versus work/category recipient. Event Sep 27. |
| Elon Musk, TIME Person of the Year | [KXTIME-26-EM](https://kalshi.com/markets/kxtime/kxtime-26) ↔ [tpoyc-2026-elomus](https://polymarket.us/event/tpoyc-2026-elomus) | Measured raw gap; fee bound removes positive margin. Explicit name/cover/group/shared treatment; annual lockup. |
| Danny Go! Season 2, #1 US Netflix show | [KXNETFLIXRANKSHOW-26SEP28-DAN](https://kalshi.com/markets/kxnetflixrankshow/kxnetflixrankshow-26sep28) ↔ [ccrc-ntflx-1shwus-2026-09-29-dango2](https://polymarket.us/event/ccrc-ntflx-1shwus-2026-09-29-dango2) | No usable price sample. Sep 29 publication; season, geography, ties, delayed chart/Other fallback. |
| Why Did I Get Married Again?, #1 US Netflix movie | [KXNETFLIXRANKMOVIE-26SEP28-WHY](https://kalshi.com/markets/kxnetflixrankmovie/kxnetflixrankmovie-26sep28) ↔ [ccrc-ntflx-1movus-2026-09-29-whydid](https://polymarket.us/event/ccrc-ntflx-1movus-2026-09-29-whydid) | No usable price sample. Sep 29 chart; publication vs observation week and exceptional terms. |
| Choosin’ Texas, Billboard #1 song week of Oct 3 | [KXTOPSONG-26OCT03-CHO](https://kalshi.com/markets/kxtopsong/kxtopsong-26oct03) ↔ [ccrc-bilbrd-1song-2026-10-03-chotex](https://polymarket.us/event/ccrc-bilbrd-1song-2026-10-03-chotex) | No usable price sample. Song/artist credit and chart date/publication distinction; short recurring window. |
| Veronika Goroshkova, AGT season 21 winner | [KXAGTWINNER-26SEP24-VER](https://kalshi.com/markets/kxagtwinner/kxagtwinner-26sep24) ↔ [rtc-agt-s21-win-2026-09-23-vergor](https://polymarket.us/event/rtc-agt-s21-win-2026-09-23-vergor) | No usable price sample. Current finale; Kalshi shared-winner split payout versus PM-US exceptional terms. |
| Bad Bunny, top US Spotify artist 2026 | [KXTOPARTISTUSA-26-BAD](https://kalshi.com/markets/kxtopartistusa/kxtopartistusa-26) ↔ [ccrc-sptfy-1-artst-us-yr-2026-badbun](https://polymarket.us/event/ccrc-sptfy-1-artst-us-yr-2026-badbun) | No usable price sample. Recovered US annual Wrapped template; US/global, chart/source and tie rules; longer lockup. |
| Anthropic IPO confirmed by Sep 30 | [KXIPOANTHROPIC-DATE-26OCT01](https://kalshi.com/markets/kxipoanthropic/kxipoanthropic-date) ↔ [ipcc-anthropic-2026-09-30](https://polymarket.us/event/ipcc-anthropic-2026-09-30) | No usable price sample. Recovered deadline; SEC/equivalent foreign filing, ticker approval and exact cutoff. |
| Taylor Brown, Big Brother season 28 runner-up | [KXBIGBROTHERRANK-26DEC31R2-TAY](https://kalshi.com/markets/kxbigbrotherrank/kxbigbrotherrank-26dec31r2) ↔ [rtc-bbus-s28-2-2026-10-01-taybro](https://polymarket.us/event/rtc-bbus-s28-2-2026-10-01-taybro) | One usable sample: +3 cents raw, -1 cent fee-net at one contract; -0.5 cent per contract at quantity two. Exact placement, ties and finale postponement; administrative expiry differs. |

The per-family settlement checklist is included in the coverage JSON and methodology: Netflix publication/language/fallback; music geography/chart/date/credits; award category/version/nomination/ties; reality withdrawal/placement/deadline/finale; critics/box office source/metric/window/revisions; releases/companies exact qualifying event; economics basis/precision/fallback. This is triage, not full review of every contract.

## Verification and publication

Targeted parser/economics/interval/selection checks passed before the observation. No local full suite or build was run. Full tests, typecheck and build are assigned to hosted CI on the signed non-main draft PR. Public artifacts contain code, minimal public fixtures, methodology, native route IDs and sanitized derived statistics; raw catalogs/tape, databases, account data, environment files and unrelated work are excluded. Existing mappings, ledgers, holdings, policies, historical reports and signing configuration are preserved. The final handoff records publication and CI status.
