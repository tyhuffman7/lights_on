# Proof-of-edge investigation — September 11, 2026

**Profitability is not proven. No live orders, fills, or realized profit.** The user authorized $100 per venue, but accepting the loss budget does not establish an executable edge. Both bounded observers were stopped and drained. The original historical database was read-only throughout.

## Scope and selection

A complete public catalog fetch returned 136,079 Kalshi and 105,672 Polymarket US records. The initial discovery run found 863 candidates, including 350 non-sports candidates. Applying the final additional checks to those saved candidates retained 755, including 242 non-sports. This is filtering of a snapshot, not an exhaustive rerun of discovery after every edit. The broad live sample started with the earlier 350 non-sports candidates plus 28 current matches from the historical shortlist.

The review found definite mismatches: relegation versus league winner; conference qualification versus national playoffs; conference regular-season champion versus tournament winner; different election years hidden by generic titles; TIME Person of the Decade versus Person of the Year. These are now regression cases. Discovery uses the primary payout sentence's dates and concepts, excluding later exception paragraphs and examples. Conservative rejection can omit legitimate relationships, such as an election and a following-year inauguration; this does not certify the remaining pairs.

Explicit NFL yardage clauses now extract player, teams, statistic and an integer threshold. For example, 60+ yards and over 59.5 yards describe the same integer boundary; 50+ and 60+ do not. Only explicit N+ / at-least-N clauses are supported by the new parser. Combined rushing/receiving remains distinct from either individual statistic. Catalog team aliases are required; names are not matched by arbitrary fuzzy similarity. This yielded 953 candidate pairs from 2,114 Kalshi and 1,377 PM-US extracted yardage markets. The sample selected up to two lines per player/statistic, capped at 100 pairs; it is not representative of all lines or all games. No sports execution gate was relaxed.

[Discovery evidence](discovery-proof.json).

## Historical timing replay

The earlier 347 positive standalone scenarios remain historically unchanged. 154 occurrences across 35 pairs pass the updated isolated-pair discovery check. This is a screening result, not 35 equivalent or approved markets.

Fixed limit prices come from the **first** positive, fresh state, not the most favorable later state. Hypothetical arrival checks use the recorded book at or before each arrival time, allow only 25% of visible depth, enforce original limits and modeled debit, and retain strict freshness. Cases beyond the recorded opportunity interval are censored; unavailable or stale evidence is never a fill.

| Kalshi / PM-US arrival delay | Both sides displayed | One side only | Insufficient evidence |
|---|---:|---:|---:|
| 100 / 100 ms | 69 | 1 | 84 |
| 100 / 250 ms | 57 | 2 | 95 |
| 250 / 100 ms | 58 | 1 | 95 |
| 250 / 250 ms | 57 | 2 | 95 |
| 500 / 500 ms | 35 | 6 | 113 |

These are counterfactual displayed-liquidity checks, not queue simulations, fill probabilities, independent trades, or money earned. Arrival delay is assumed; exchange-to-receive clocks are unsynchronized. [Reproducible audit](historical-audit.json).

## Current bounded samples

**All-category shortlist:** 378 pairs, 300 seconds, 11,507 processed updates, 626 persisted book records. Thirty raw occurrences yielded eleven fresh positive one-contract scenarios. Only five occurrences across three pairs survived the subsequent matching checks: LSU undefeated, Bad Bunny top Spotify artist, and an Israel government-formation candidate. The latter fails the detailed rule review below. Three occurrences retained displayed prices through 500 ms; two lacked sufficient interval coverage. Zero launch-eligible states. [Audit](live-category-audit.json), [health](live-category-health.json).

**NFL alternate lines:** 100 pairs, 180 seconds, 3,327 updates, 148 persisted book records, eighteen raw occurrences and 62 states. Zero positive net one-contract scenarios after modeled fees and reserve. This short sample cannot establish that alternate lines never offer opportunities. [Audit](live-alternate-audit.json), [health](live-alternate-health.json).

These sessions ran on the development host while analysis and tests also ran. The all-category sample recorded two event-loop delay episodes, sixteen reconnects, maximum event-loop delay about 1.21 seconds, and persistence acknowledgment p99 about 506 ms. Valid-book processing p99 was about 5.02 ms. Final backlog was drained, but these are not acceptable evidence of uninterrupted execution reliability. The cause of the stalls is not established; no exchange order latency was measured.

## Concrete rule review and next decision

**Spotify / Bad Bunny:** the frozen candidate quoted Kalshi NO at $0.14 and PM-US YES at $0.81, one contract each. Modeled fees were $0.01 on each leg; combined debit $0.97; conditional $1 payout minus the extra $0.01 reserve leaves $0.02. Prices survived the fixed-limit 500 ms replay. Refreshed metadata hashes were unchanged. This is the best focused follow-up candidate, not an order recommendation or guaranteed return. [Kalshi TOPARTIST terms](https://assets.kalshi.com/contract_terms/TOPARTIST.pdf) identify Spotify's annual most-streamed-artist report and acknowledge its publication before year-end. PM-US explicitly identifies the annual Wrapped global-artist ranking. The ordinary resolution basis appears aligned. Remaining review includes absence of a ranking, ties/revisions and applicable contingency rules; execution/fees remain unvalidated. Do not automatically approve this pair or sum repeated observations into income.

**College qualification / undefeated:** current primary outcomes agree for Arkansas SEC qualification, BYU Big 12 qualification, and Texas/LSU undefeated. The [qualification terms](https://assets.kalshi.com/contract_terms/NCAAFCONFCHAMPQ.pdf) include two-year postponed-event handling, fractional cancellation payouts and rules for eliminated participants later re-entering contention. The [PM-US sports FAQ](https://docs.polymarket.us/faqs/sports-faqs) describes final pre-expiration qualification reversals. The effect of different expiration times and cancellation provisions remains unresolved. Two of the four initially refreshed futures lacked a needed Kalshi ask side. No approval.

**NFL last undefeated:** ordinary weekly-loss treatment appears similar, but the [linked terms](https://assets.kalshi.com/contract_terms/NFLLASTUNDEFEATEDTEAM.pdf) add postponed/canceled-event contingencies and the market specifies fractional tie payouts. Exact complementary payouts in every supported state have not been established. No approval.

**Israel government formation:** current Kalshi rules resolve No when a new election is called before government formation. PM-US instead follows the next government formation after that new election. These are substantively different; reject as equivalent arbitrage. Refreshed hashes also changed. The earlier isolated matching pass does not override this review.

**NFL player lines:** [FOOTBALLENTITYSTAT](https://assets.kalshi.com/contract_terms/FOOTBALLENTITYSTAT.pdf) and PM-US clauses both discuss participation and end-of-game statistics. However, Kalshi's linked document treats pre-start postponement at an exchange-determined fair price, whereas the PM-US clauses allow rescheduling within two days. Independent fair-price settlements need not sum to $1. Correct line identity therefore remains insufficient for approval.

**Emmys:** the [linked contract](https://assets.kalshi.com/contract_terms/EMMYS.pdf) resolves No if the source data is unavailable at expiration. The corresponding contingency is not established by PM-US's short market description. No approval.

Current market metadata is preserved in [futures review](current-futures-review.json) and [category review](current-category-review.json). Public PDF SHA-256 hashes are in [source manifest](review-sources.json); full PDFs remain in local scratch space.

The next focused experiment is Spotify rule completion and a minimal end-to-end order/fill/balance integration with tested one-leg recovery, followed by a tiny pilot only if those gates pass. A clean uninterrupted timing run must precede relying on the observer. No evidence here establishes $100/month, passive reliability, or a truck-funding trajectory. Broader candidate counts are not a substitute for this proof.

## Validation and reproduction

136 tests, TypeScript and production build passed. Build retains the existing route-classification notice. The isolated synthetic discovery load passed at about 993 updates/second with processing p99 0.659 ms; [load evidence](discovery-load.json). This does not supersede the live stalls or establish fill latency.

Run `npm run pilot:audit -- SOURCE_SQLITE OUTPUT_JSON` to reproduce an audit. `node --experimental-strip-types worker/pilot-observe.ts PAIRS_JSON NEW_OUTPUT_DIRECTORY SECONDS` runs a bounded read-only sample (30–1800 seconds, 1–500 pairs). It preserves existing output directories, never approves mappings, and has no order transport. The local pair inputs are `work/proof/shortlist.json` and `work/proof/alternate-shortlist.json`; raw data and credentials are deliberately excluded from Git. A historical audit needs the original locally preserved SQLite evidence; exported reports alone are not sufficient to reconstruct every book update.
