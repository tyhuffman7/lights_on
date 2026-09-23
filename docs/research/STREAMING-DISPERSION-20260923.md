# Streaming price dispersion — September 23, 2026

The single supervised study ran from **2026-09-23T03:56:55.228+00:00 to 2026-09-23T05:00:36.580+00:00**, 63.689 minutes, stopping for `EVIDENCE_LIMIT`. The original deadline was 2026-09-23T05:26:55.045+00:00; the remaining **26.308 minutes are unobserved/censored**. No restart or limit adjustment was made. It subscribed concurrently to ten retained non-sports routes and seven price-blind sports controls. No orders, modeled submissions, PAPER ledger changes or strategy positions were created.

**No unconditional settlement-equivalent culture route passed review.** Five are CONDITIONAL, two INCOMPATIBLE and three UNRESOLVED. Matching and observed prices did not override payout terms. The prior REST experiment is preserved as methodologically inconclusive; its zeros are not evidence of absent opportunities.

Read the [exact contract reviews](STREAMING-CULTURE-REVIEW-20260923.md), [methodology](STREAMING-DISPERSION-METHODOLOGY-20260923.md) and [sanitized derived results](streaming-dispersion-results-20260923.json). The JSON includes every observed interval, censoring segments, exact consumed depth, quantity, fee bounds and indicative administrative horizons. Full native books, tape and catalogs remain private.

## Settlement review

| Family / exact selection | Classification | Controlling issue |
|---|---|---|
| Netflix US show: Danny Go! season 2, Sep 29 publication | UNRESOLVED | US listing versus linked English-chart scope; correction/tie/fallback rules |
| Netflix US movie: Why Did I Get Married Again?, Sep 29 publication | UNRESOLVED | Same chart-scope and publication-rule conflict |
| Billboard Hot 100: Choosin’ Texas, chart dated Oct 3 | CONDITIONAL | Exact Ella Langley work; first publication versus expiration/corrections |
| Billboard 200: Dandelion, chart dated Oct 3 | CONDITIONAL | Exact album/artist; correction and nonpublication branches |
| VMA Best Alternative: Tame Impala / Dracula | INCOMPATIBLE | Kalshi tie strike versus PM split successful nominees |
| VMA Best Art Direction: Charli xcx / SS26 | INCOMPATIBLE | Same tie conflict plus work/technical-credit identity |
| AGT season 21: Veronika Goroshkova winner | CONDITIONAL | Ordinary finale only; cancellation, late declaration and deadline differences |
| Big Brother season 28: Taylor Brown exactly second | CONDITIONAL | Unique official final rank; tie, withdrawal and cancellation differences |
| Spotify Wrapped 2026 US top artist: Bad Bunny | CONDITIONAL | Annual US ranking; first release versus expiration/fallback |
| Anthropic IPO by Sep 30 | UNRESOLVED | Short/long trigger precedence, final-minute cutoff, conflicting administrative dates |

The seven sports controls are conditional ordinary-completed-game comparisons: CFB Liberty–Coastal winner/spread/total, NFL Atlanta–Green Bay spread/total, MLB Washington–Detroit winner and Milwaukee–Philadelphia total. NFL winner and MLB spread had no supported retained selection; neither was replaced through new mapping. Native inverted orientation on the Detroit contract was preserved.

## Streaming coverage and intervals

| Category | Routes / with usable depth | Valid simultaneous route-hours | Usable priceable route-hours | Raw-positive intervals | Fee-positive intervals | Requests | Confirmed survivors |
|---|---:|---:|---:|---:|---:|---:|---:|
| Netflix | 2 / 1 | 2.071 | 1.036 | 0 | 0 | 0 | 0 |
| Billboard/music | 2 / 2 | 2.071 | 1.444 | 34 | 0 | 0 | 0 |
| awards | 2 / 2 | 2.071 | 2.071 | 0 | 0 | 0 | 0 |
| reality TV | 2 / 1 | 2.082 | 1.046 | 1 | 0 | 0 | 0 |
| Spotify | 1 / 1 | 1.035 | 1.035 | 0 | 0 | 0 | 0 |
| company/IPO | 1 / 1 | 1.035 | 1.035 | 0 | 0 | 0 | 0 |
| sports | 7 / 7 | 7.249 | 7.249 | 2 | 0 | 0 | 0 |

All 17 markets on each venue delivered reconstructed books. Kalshi used 0 reconnects and PM-US used 3; only PM-US was rebuilt, with the original deadline retained. There was no clock fault. The private evidence file reached 268,434,149 bytes; the next record would have exceeded the 268,435,456-byte ceiling. A late burst of Kalshi content changes and derived quantity records exhausted that frozen limit.

Valid simultaneous time requires healthy reconstruction, sequencing, arrival/processing and clock state. Usable priceable time additionally requires legal complementary whole-contract depth. These are discovery-valid streams; quiet books do not become request-confirmed merely because a connection is healthy. Netflix’s show and AGT had no usable complementary whole-contract quote during this window and are **unavailable**, not zero. Missing depth and feed gaps are censored. Billboard’s song had partial depth coverage. Category zeros apply only to the stated usable time.

| Route | Valid book minutes | Usable pricing minutes | Legal quantities observed |
|---|---:|---:|---|
| `KXNETFLIXRANKSHOW-26SEP28-DAN` | 62.15 | 0.00 | unavailable |
| `KXNETFLIXRANKMOVIE-26SEP28-WHY` | 62.13 | 62.13 | 1–10 |
| `KXTOPSONG-26OCT03-CHO` | 62.12 | 24.48 | 1–10 |
| `KXTOPALBUM-26OCT03-DAN` | 62.15 | 62.15 | 1–10 |
| `KXVMA-BA26-TAM` | 62.17 | 62.17 | 1–10 |
| `KXVMA-BAD26-CHA` | 62.12 | 62.12 | 1–10 |
| `KXAGTWINNER-26SEP24-VER` | 62.11 | 0.00 | unavailable |
| `KXBIGBROTHERRANK-26DEC31R2-TAY` | 62.78 | 62.78 | 1–10 |
| `KXTOPARTISTUSA-26-BAD` | 62.10 | 62.10 | 1–10 |
| `KXIPOANTHROPIC-DATE-26OCT01` | 62.10 | 62.10 | 1–10 |
| `KXNCAAFSPREAD-26SEP24LIBCCAR-LIB7` | 62.13 | 62.13 | 1–10 |
| `KXNCAAFTOTAL-26SEP24LIBCCAR-58` | 62.11 | 62.11 | 1–10 |
| `KXNCAAFGAME-26SEP24LIBCCAR-LIB` | 62.12 | 62.12 | 1–10 |
| `KXMLBTOTAL-26SEP231840MILPHI-8` | 62.08 | 62.08 | 1–10 |
| `KXMLBGAME-26SEP231310WSHDET-DET` | 62.29 | 62.29 | 1–10 |
| `KXNFLSPREAD-26SEP24ATLGB-ATL7` | 62.11 | 62.11 | 1–10 |
| `KXNFLTOTAL-26SEP24ATLGB-47` | 62.09 | 62.09 | 1–10 |

## Magnitude and duration

Gaps below are cents per paired contract. A raw gap subtracts displayed two-leg principal from $1; fee-net also subtracts the existing fee upper bounds. Reserved risk and recovery cash are separate. Medians are the median of each route’s time-weighted median, with routes weighted equally. Preferred quantity maximizes total fee-net surplus, breaking ties toward smaller size. The auxiliary all-quantity maximum searches recorded valid content-change quotes, not health-only evaluations.

| Category | Raw median / maximum (¢) | Fee-net preferred median / maximum (¢) | Best recorded fee-net per contract over q=1–10 (¢) |
|---|---:|---:|---:|
| Netflix | 0.00 / 0.00 | -1.00 / -1.00 | -1.00 |
| Billboard/music | 0.50 / 1.00 | -1.50 / -1.00 | -1.00 |
| awards | 0.00 / 0.00 | -1.00 / -1.00 | -1.00 |
| reality TV | 3.00 / 3.00 | -1.00 / -1.00 | -0.50 |
| Spotify | 0.00 / 0.00 | -1.00 / -1.00 | -1.00 |
| company/IPO | 0.00 / 0.00 | -1.00 / -1.00 | -1.00 |
| sports | -0.50 / 1.00 | -4.00 / -2.00 | -1.50 |

Raw-positive interval durations below exclude unknown gaps. Endpoints have up to the 250-ms health sampling resolution; the separately reported route-hours also discard the final health slice at each fault, so interval duration and conservative coverage can differ. Left/right censoring means the complete economic episode may be longer; repeated callbacks and size changes never create new intervals. Exact timestamps and consumed levels are retained in the derived JSON.

| Category | Raw intervals | Observed duration median / maximum (seconds) | Left / right censored |
|---|---:|---:|---:|
| Netflix | 0 | unavailable / unavailable | 0 / 0 |
| Billboard/music | 34 | 66.93 / 71.73 | 0 / 1 |
| awards | 0 | unavailable / unavailable | 0 / 0 |
| reality TV | 1 | 3793.43 / 3793.43 | 1 / 1 |
| Spotify | 0 | unavailable / unavailable | 0 / 0 |
| company/IPO | 0 | unavailable / unavailable | 0 / 0 |
| sports | 2 | 856.04 / 1694.52 | 1 / 0 |

## Culture versus sports

| Group | Usable route-hours | Fee-positive intervals/hour | Confirmed survivors | Confirmed fee-net median / maximum |
|---|---:|---:|---:|---|
| culture | 6.632 | 0.000 | 0 | unavailable / unavailable |
| sports | 7.249 | 0.000 | 0 | unavailable / unavailable |

Culture here excludes the company/IPO control. Frequency uses the sum of usable route-hours, not the wall-clock session or callback count. These selected routes and correlated contracts are not a random or independent sample. No statistical confidence or expected-profit model is fitted.

## Every distinct confirmed positive-after-fee interval

**None.** No observed legal quantity cleared the modeled fee bounds, so the policy triggered zero requested confirmations. Surviving, disappeared and unknown confirmation outcomes therefore have no sample; confirmed spread magnitude is **unavailable**, not 0¢. The requested confirmation path was reused and targeted-tested, but was not exercised by an economic candidate during this study.

**Neither sports nor culture is supported as having more fee-positive opportunities in this window.** Both observed frequencies are zero over their measured exposure; confirmed magnitudes cannot be ranked. Culture’s larger occasional raw gaps did not survive modeled fees. This does not establish equal future opportunity rates or absence of opportunities outside the usable observations.

## Capital efficiency and the best combination

There is no demonstrated combination of positive fee-net spread, depth and short lockup. The following **unconfirmed, nonpositive diagnostic examples** show the best recorded normalized fee gap for each priced route. They are not orders or suggested trades. Exact depth at the quoted size and a separate largest-supported-size example are in the JSON. Negative returns are not annualized or ranked as opportunities.

| Route | q | Principal + fees ($) | Total fee-net ($) | Fee-net / principal+fees | Total reserved ($) | Indicative event horizon (days) |
|---|---:|---:|---:|---:|---:|---:|
| `KXNETFLIXRANKMOVIE-26SEP28-WHY` | 1 | 1.01 | -0.010 | -0.990% | 1.09 | 6.42 |
| `KXTOPSONG-26OCT03-CHO` | 1 | 1.01 | -0.010 | -0.990% | 1.09 | 6.42 |
| `KXTOPALBUM-26OCT03-DAN` | 1 | 1.02 | -0.020 | -1.961% | 1.10 | 6.42 |
| `KXVMA-BA26-TAM` | 1 | 1.01 | -0.010 | -0.990% | 1.09 | 5.00 |
| `KXVMA-BAD26-CHA` | 1 | 1.01 | -0.010 | -0.990% | 1.09 | 5.00 |
| `KXBIGBROTHERRANK-26DEC31R2-TAY` | 2 | 2.01 | -0.010 | -0.498% | 2.17 | 8.96 |
| `KXTOPARTISTUSA-26-BAD` | 1 | 1.01 | -0.010 | -0.990% | 1.09 | unavailable |
| `KXIPOANTHROPIC-DATE-26OCT01` | 1 | 1.01 | -0.010 | -0.990% | 1.09 | 8.00 (cutoff only) |
| `KXNCAAFSPREAD-26SEP24LIBCCAR-LIB7` | 2 | 2.07 | -0.070 | -3.382% | 2.23 | 1.94 |
| `KXNCAAFTOTAL-26SEP24LIBCCAR-58` | 2 | 2.07 | -0.070 | -3.382% | 2.23 | 1.94 |
| `KXNCAAFGAME-26SEP24LIBCCAR-LIB` | 2 | 2.08 | -0.080 | -3.846% | 2.24 | 1.94 |
| `KXMLBTOTAL-26SEP231840MILPHI-8` | 2 | 2.03 | -0.030 | -1.478% | 2.19 | 0.90 |
| `KXMLBGAME-26SEP231310WSHDET-DET` | 2 | 2.04 | -0.040 | -1.961% | 2.20 | 0.68 |
| `KXNFLSPREAD-26SEP24ATLGB-ATL7` | 4 | 4.09 | -0.090 | -2.200% | 4.41 | 1.97 |
| `KXNFLTOTAL-26SEP24ATLGB-47` | 2 | 2.09 | -0.090 | -4.306% | 2.25 | 1.97 |

Event horizons use the start of observation and uncertain publication/finale/game-completion proxies. They are not settlement or cash-release promises. Netflix/Billboard publications are roughly six days away; the VMA ceremony roughly five; AGT roughly one but unpriced; Big Brother roughly nine; selected sports under two. Spotify has no verified annual release date. Anthropic’s deadline is roughly eight days away, but its inconsistent administrative dates make cash lockup unestimable. Full per-venue administrative dates are retained, including Big Brother’s December/January dates and Anthropic’s contradictory Kalshi expected/latest expiration.

## Recurring review queue and next checkpoint

- **Promote weekly Billboard song/album and finale-window AGT/Big Brother placement families into a recurring manual strategy-review queue.** Their reuse and event horizons justify repeat review. This is a research recommendation, not registry admission; exact work/artist, chart date, placement and exception terms must still clear the gate.
- **Hold Netflix** until the controlling US-versus-English-chart scope and publication exceptions are resolved. Once clarified, its weekly cadence makes it a strong review candidate.
- **Reject these VMA routes for strategy promotion:** the tied-winner payout conflict is concrete. Do not repair it by name matching.
- Keep **Spotify annual Wrapped** as a long-horizon control rather than a short-duration priority. Keep **Anthropic IPO** unresolved until trigger/cutoff precedence and lockup anomalies are clarified.

**No additional broad mapping round is justified before another separately authorized PAPER run.** Settlement approval, demonstrable synchronized fee-positive economics and coverage of currently unpriced routes are the bottlenecks. More names do not resolve them. No route from this study is approved for strategy execution; the project’s fresh-fill recovery proof also remains outstanding and was not repeated or refined here.

## Verification and publication

All **42 targeted tests passed** after collection, including the existing streaming/confirmation/reconnect suites and the new interval/reporting checks. Derived coverage/count/deadline/size invariants passed, and every frozen runtime-source hash remained unchanged. The supervisor recorded a clean worker exit (code 0). Signed publication is available in [draft PR #15](https://github.com/tyhuffman7/lights_on/pull/15), stacked on #14. The existing 1Password signer succeeded after unlock and the SSH signature verifies locally. GitHub reports the preserved signing key as `unknown_key`; cryptographic verification with the configured public key passes locally. For code commit `6446be8`, [hosted CI](https://github.com/tyhuffman7/lights_on/actions/runs/35874820195) passed **677 tests**, typecheck and production build, with zero failures or skipped tests. No merge or force-push occurred.

Freeze SHA256: `ad98a00b5e6d7de598299e0d77103d1b5f36934102607a19259cf6cf8cc1e930`. Private evidence SHA256: `f4597c7fc96f0c3a630d242ca9d110bf4cbaedffd9d1eb00c9069ae92bc19488`. No raw evidence is included in publication.
