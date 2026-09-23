# Public-catalog mapping coverage — September 22, 2026

**1,242 → 2,919 candidate pairs: 1,683 new, 6 removed, 1,677 net additional routes to analyze. All 2,919 remain UNVERIFIED; AUTO_VERIFIED = 0 and MANUAL_VERIFIED = 0.** Candidates do not establish settlement equivalence, executable prices, fills or profit. No PAPER market-data session ran for this exercise.

[Sanitized results and fixed review IDs](mapping-coverage-results-20260922.json) · [external-source review](EXTERNAL-MAPPING-SOURCES-20260922.md) · [operational checkpoint](EXECUTION-MAPPING-CHECKPOINT.md).

## Snapshot and comparison

Public catalogs were collected **2026-09-22 23:56:07.520–23:58:33.897 UTC**, using existing pagination/rate/capacity controls: **121,000 Kalshi markets**, **74,620 unique PM-US markets** (74,624 listed rows; four identical duplicates), 121 Kalshi pages, 150 PM-US pages, 460 public requests, no recorded fetch errors. All captured unique markets passed the existing open-market filter. This is the complete accessible result under those controls at collection, not an atomic point-in-time universe or a claim that every listing has a counterpart.

Baseline and changed matcher received exactly the same normalized snapshot. Replaying every captured response through the preserved baseline normalizers reproduced every record without a difference. Snapshot SHA-256: `c036dffa813d024d2f6c2638be4d90d9c709f96173c99dd1891f6942dfca6273`. Historical registry databases were inspected read-only; no verification or ledger state changed.

| Measure | Before | After |
| --- | ---: | ---: |
| Candidate pairs | 1,242 | 2,919 |
| Distinct Kalshi markets covered | 1,216 | 2,826 |
| Distinct PM-US markets covered | 975 | 2,650 |
| Unverified candidate pairs | 1,242 | 2,919 |

Registry inventory remains research: 2,508 records (2,410 UNVERIFIED, 98 INVALIDATED); broad-coverage: 1,650 UNVERIFIED; paper-bot: zero. Verified strategy approvals are separate artifacts; these database totals must not be represented as their inventory. Current candidate overlap is 390 research records and 358 broad-coverage records.

## Existing knowledge preserved and expanded

The reviewed seed registry has **70 entities / 240 names and aliases**: 32 NFL teams, 30 MLB teams, four ATP players, one NBA team, one college team and two crypto assets. This snapshot augments it with **10,418 scoped alias keys and 2,987 scoped venue-ID keys**. Team/player venue metadata remains the source of dynamic aliases. Existing person/event/company/ticker/asset/jurisdiction/indicator/window normalization is preserved; there is no comprehensive person/company alias directory.

Existing sports dimensions include competition, participants, home/away, subject, event instant/date, season, market type, statistic, line, segment and outcome. Existing special parsers cover ATP Challenger tournament/round context, integer NFL yard props, regional baseball identities and college totals. General conflict rules still preserve geography, district/election stage, award category/ceremony, ranking platform/rank/language/publication date, person-of-decade, net-worth source, announcement/meeting windows, interim service, Israeli office/succession, repeat-election and best-record tie treatment.

The added representation keeps **subject, competition/domain, family, metric, geography, observation period, threshold/comparator, outcome and orientation** separate. Exact supported templates cover full-game totals, negative-handicap payout margins, college regular-season wins, conference winner versus qualifier, Netflix published charts, CPI monthly releases and advance real GDP quarters. For integer wins only, ≥ N corresponds to > N−0.5. No continuous economic threshold gets that conversion. Full-game parsing rejects segments, contradictory threshold/outcome metadata and incompatible scheduled instants. GDP's quarter comes from explicit title metadata; its advance-release basis must appear in rules. CPI's basis requires the exact reviewed [CPI contract document](https://assets.kalshi.com/contract_terms/CPI.pdf) link and KXCPI family.

Published full aliases now resolve abbreviated venue safeNames against reviewed seeds (for example HOU Texans/Houston Texans). An explicit venue ID joins safeName variants; colliding short labels with distinct IDs remain separate. Known ambiguous labels never fall back to a shared literal subject. College safeNames no longer lose their final word: Georgia Southern, Kansas State and Virginia Tech remain distinct; supported State→St is retained. Canonical blocks receive priority within the unchanged bounded comparison budget. None of these paths manufactures settlement fields or calls registry verification.

## New candidates by reusable cause

| Canonical family / scope / metric or existing alias path | New pairs |
| --- | ---: |
| entity-alias / nfl / prop | 102 |
| entity-alias / cfb / future | 3 |
| conference-championship / cfb / winner | 67 |
| conference-championship / cfb / qualifier | 3 |
| economic-release / economics / real-gdp / quarter-growth / seasonally-adjusted-annualized / advance | 6 |
| economic-release / economics / cpi / headline / month-over-month / seasonally-adjusted | 9 |
| entity-alias / nfl / future | 6 |
| season-wins / cfb / team-wins | 396 |
| game-spread / cfb / points | 531 |
| game-spread / nfl / points | 208 |
| game-total / cfb / points | 70 |
| game-total / mlb / runs | 60 |
| game-total / nfl / points | 212 |
| entity-alias / cfb / winner | 10 |

Examples previously missed include Boston College ACC winner (missing PM-US parsed subject), Alabama ≥10 regular-season wins versus >9.5 (discrete threshold/template), Atlanta–Green Bay totals (abbreviated teams/absent parsed participants), Liberty −10.5 (handicap sign versus positive payout margin), Jordan Love ≥175 passing yards (canonical NFL aliases), September CPI >0.2 and Q3 advance GDP >1.0 (metric/window templates). Exact native IDs and reviewed samples are in the results JSON. These are reusable classes; none was selected by price or profitability.

## Bounded manual review and remaining gaps

The fixed **42-pair** diagnostic sample takes first/middle/last sorted native pair IDs in each new-candidate family/domain/metric stratum (legacy alias paths use competition/type). Public primary clauses showed no obvious wrong subject, competition, statistic, threshold, direction or observation window in that sample. **Three CPI pairs nevertheless have known incompatible fallback terms**: Kalshi's linked formula and shutdown timing differ from PM-US's previous-month fallback and three-month deadline. They remain UNVERIFIED and cannot be treated as approved arbitrage routes. Three GDP samples still have release-metadata/exception questions; three last-undefeated NFL samples have fractional tie-payout/rounding questions. All remaining sample rows still need full settlement review. This purposeful sample is not a population error estimate or evidence that the new set is settlement-equivalent.

**71,970 PM-US markets remain without a candidate.** The largest unpaired populations are player statistics (28,582), spreads (10,914) and total/segment families (9,309). Those counts include listings with no Kalshi counterpart. Among unmatched sports metadata, 49,207 lack a parsed venue entity ID and 39,893 lack a parsed outcome. 2,270 unmatched listings have a recognized new template; absence of an exact subject/window/threshold counterpart still blocks them. Categories overlap; they are not independently confirmed missed mappings.

Largest reusable work remaining: unsupported player-statistic and segment templates, positive-handicap/opposite orientations, broader conference/award/season families, missing authoritative school/player/company aliases and IDs, economic monthly/yearly/quarterly windows, and contradicted schedules. An actual PM-US Toronto–Baltimore total states Sep 22 in primary rules but carries a Sep 23 start instant; the new guard rejects that pair. US/global, winner/qualifier, different statistics/dates/thresholds and known payout predicates remain meaningful exclusions. Per-comparison diagnostics retain structural, threshold, outcome, date, similarity and canonical-dimension rejection counts; they are **comparisons, not unique opportunities**. Index deferrals also remain observable.

External research obtained **zero current native-US pair records**, so obtained-data overlap/external-only are zero and internal-only is 2,919. Hosted PMXT/Prediction Hunt coverage and true overlap are unknown because usable records were unavailable. International-only/fake examples were not imported. See the separate source/license report.

**Recommended next action:** a bounded settlement review of a diverse subset of new full-game total/spread families, using their linked contract documents and explicit counterexamples before any later PAPER authorization. No new collection/trading run is implied.

## Verification and reproducibility

**119 focused mapping tests passed**, including 23 new template/ambiguity/index/orientation regressions and captured public metadata excerpts. Existing reviewed conflict tests remain intact. The broader existing sustained socket test could not bind localhost inside the restricted sandbox; it is unrelated to these pure mapping changes and full checks belong to hosted CI. No local full suite/build was run. See the draft PR checks for final hosted status.

Private ignored evidence is under `work/mapping-coverage-20260922/`: full snapshot/responses, parity/duplicate receipts, candidate IDs, removal list, comparison counters, source notes and fixed manual sample. Public files contain only derived counts, bounded sample IDs/findings and minimal fixture excerpts. Reproduce without network:

`node --experimental-strip-types worker/mapping-coverage-report.ts CATALOG_JSON BASELINE_CHECKOUT OUTPUT_DIRECTORY [READ_ONLY_REGISTRY_INVENTORY_JSON]`
