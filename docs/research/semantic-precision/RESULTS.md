# Semantic precision checkpoint — October 1, 2026

**PAPER / READ-ONLY, stopped.** The structured classifier catches the original 17 false top-20 matches, preserves broad discovery and legitimate basis candidates, and keeps the native WS fast path intact. The fresh window exposed 18 additional false nominal matches; generalized post-window fixes remove them on replay. The final replay top 20 contains **14 ordinary/basis-risk and six unresolved**, with no obvious different question identified in that manual review. **Zero strict-equivalence proofs, fills or realized profits.** Final fixes have regression/replay verification, not a second live window. Draft PR #22 remains unmerged.

## What changed

`lib/research/proposition.ts` independently extracts subject, event, competition, family, metric, outcome, comparator, threshold, unit, timeframe, period/stage, geography, participant scope, conditions and settlement scope from native payout clauses. Known dimensions retain their evidence; missing dimensions stay unknown. Recurring families define promotion requirements and exceptional settlement branches. Native canonical parsers provide positive predicate evidence; a discovery label alone cannot promote a route.

Ordinary conflicts produce `DIFFERENT_QUESTION`; sufficient ordinary alignment produces `ORDINARY_EQUIVALENT_BASIS_RISK`; missing proof remains `UNRESOLVED`. No strict certificate is implemented or synthesized. Titles never repair conflicting native payout clauses. All classes remain distinct from execution/settlement admission.

The observer caches classifications by both market hashes, vetoes known different questions before hot confirmation, prioritizes ordinary/basis hypotheses, and rechecks refreshed metadata before fallback. Broad discovery, WS architecture, native price/fee arithmetic, freshness and risk gates remain intact. Discovery still records unresolved and different hypotheses. No exact market-ID exclusions were added.

## Frozen regression before collection

The original 241 fresh readings, quotes and historical classes remain unchanged. [Original replay](frozen-replay.json) was completed before collecting new data; [post-review replay](frozen-post-review-replay.json) gives the same totals.

| Classification | Original observed | Improved replay |
| --- | ---: | ---: |
| STRICT_EQUIVALENT | 0 | 0 |
| ORDINARY_EQUIVALENT_BASIS_RISK | 50 | 167 |
| DIFFERENT_QUESTION | 0 | 63 |
| UNRESOLVED | 191 | 11 |
| Total fresh readings | 241 | 241 |

180 readings change class; **50/50 prior basis readings survive**. All 20 original manual labels agree, including **17/17 known false matches**. Houston >=9 / >8.5 and Texas A&M remain ordinary/basis. The same native frozen catalog yields **20,616 routes before and after, zero added/removed** ([recall audit](recall-audit.json)). This demonstrates preservation on that universe, not global completeness.

Initial inspection caught two incorrect exclusions: Nebraska conference qualification used a catalog season-start date as the later event date; Buffalo NHL spanning season conflicted with its ending-year finals. Both were corrected and generalized before freezing. All final rejected frozen routes were inspected for explicit native conflicts; no further incorrect rejection was identified in this finite set. LSU title/rules disagreement remains quarantined rather than silently corrected. [Regression detail](REGRESSION.md).

## One bounded fresh observation

**October 1, 10:16:39.310–10:36:39.310 EDT** (14:16:39.310–14:36:39.310 UTC). Frozen signed source `a328a3c52f608f4f178214aa8110f679414b3c6e`; all 14 source hashes match that commit ([freeze audit](source-freeze-audit.json)). Duration including shutdown was 1,200,680 ms. Policy stayed frozen: ten-contract maximum, $50 simulated per venue, $5 paired commitment, two-second freshness, bounded 128-route hot lane and 1 GiB evidence ceiling. No tuning, tests/builds or repeated CI polling during collection.

| Observation | Prior WS checkpoint | Fresh structured checkpoint |
| --- | ---: | ---: |
| Discovered / visited / both-book routes | 20,616 each | 21,589 each |
| Native catalog Kalshi / PM-US | 129,349 / 71,724 | 130,790 / 70,101 |
| Fresh executable confirmed readings | 241 | 665 |
| Ordinary/basis readings, observed | 50 | 440 |
| Unresolved readings, observed | 191 | 225 |
| Different-question readings, observed confirmations | 0 | 0 |
| Strict-equivalent proofs | 0 | 0 |
| Feeds healthy at stop | 177/177 | 181/181 |
| Pending confirmations at stop | 11 | 0 |
| PM-US book HTTP 429s | 109 | 18 |

Catalogs completed without errors; all 21,589 discovered routes received both books and 7,895 had fresh two-book observations. Counts span different market windows and catalog compositions; changes are not a causal claim about semantic filtering. The evidence contains 892 completed confirmations, 665 fresh executable positive readings across 108 distinct route/orientation combinations, and one dispatch aborted during shutdown. The observer exited successfully. [Live receipt](live-receipt.json); local immutable native evidence: `work/semantic-final-20261001-v1/{evidence.ndjson,summary.json,frozen.json,catalog-1.json}` (292,638,868 evidence bytes).

Early classification retained 14,793 different-question hypotheses, 2,796 ordinary/basis and 4,000 unresolved routes in discovery. Among recorded broad economic signal records, 17,177 were already different questions and did not become confirmations; the prior veto would have passed 14,356 on those same retained records. This is an offline semantic counterfactual, not a count of fills, profits, or hypothetical successful confirmations. Observed zero different-question confirmations only describes the frozen classifier's own labels; manual review found misses.

## Strongest-20 manual precision and follow-up fixes

| Review | Different question | Ordinary/basis | Unresolved | Strict |
| --- | ---: | ---: | ---: | ---: |
| Original WS window, human labels | 17 | 2 | 1 | 0 |
| Original window, improved classifier | 17 | 2 | 1 | 0 |
| Fresh window, original nominal strongest 20, human labels | 18 | 0 | 2 | 0 |
| Fresh window, those same 20 after fixes | 18 | 0 | 2 | 0 |
| Fresh evidence, strongest 20 remaining after final replay, human labels | 0 | 14 | 6 | 0 |

**The live nominal top-20 false-match fraction was 90%, versus 85% previously; the frozen model did not solve every new family.** All 18 misses remained unresolved, rather than being falsely promoted to ordinary/basis. The authorized post-window regression cycle fixes these forms generally: fantasy-scoring rank versus an AP award; ATP published rank versus an Australian Open title; monthly versus annual rookie award; relative team wins versus an absolute win threshold; any office departure versus the next announced departure; named soccer win versus draw; and inverted opposing soccer wins with an explicit third draw outcome. Review of the next surviving group also caught semifinal qualification versus final qualification; a general final-stage dimension now rejects it.

Final [live replay](live-post-review-replay.json) changes 665 retained readings to **461 ordinary/basis, 76 different questions and 128 unresolved**. All **440/440 observed basis readings survive**. Of 108 distinct route/orientation combinations, 60 are basis, 24 different and 24 unresolved. All newly rejected combinations were reviewed against their native ordinary conflicts; no incorrect rejection was identified in this finite set. The 21 newly promoted readings are same-team, whole-season undefeated predicates, with exceptional season branches retained.

[Original fresh strongest review](strongest-review.json) preserves source quotes and observed classes; [final surviving review](strongest-post-review.json) retains exact source quotes, final classification and individual human rationale. The final 14/20 ordinary-predicate yield is an in-sample replay result. Six unresolved candidates count as uncertainty, not proven matches. Fresh final-classifier hot-lane suppression and general out-of-sample precision remain unmeasured; no second observation was run.

## Native settlement evidence and small capital

Thirty-six exact native family documents were retrieved and read; eighteen were available before the window. URL, retrieval date, SHA-256, previous hash, page count and retained local PDF paths are in [native source receipts](native-terms-receipt.json). TIME and TOPARTIST changed bytes from prior receipts and were reviewed under new hashes. [Contract comparison](CONTRACT-REVIEW.md) records branch differences and exact-family bindings. Generic PM office-departure terms are not substituted for the next-cabinet-announcement contract.

Examples below are actual retained depth-priced **modeled normal-fee quote economics**, not returns, fills or paper execution:

| Preserved ordinary candidate | Quantity / native leg prices | Acquisition + modeled fees | Modeled net |
| --- | --- | ---: | ---: |
| Oklahoma >=8 / >7.5 regular-season wins | 5; Kalshi Yes 0.18, PM-US No 0.76 | $4.70 + $0.12 | $0.18 |
| Houston >=9 / >8.5 regular-season wins | 5; Kalshi Yes 0.52, PM-US No 0.42 | $4.70 + $0.17 | $0.13 |

Both fit the frozen paired commitment; Houston still fails the existing first-leg exposure gate. Account fee precision remains unconfirmed, extreme fragmentation fee stress fails, and settlement remains unverified. Oklahoma's economic paper-eligibility flag does not establish settlement admission. Modified-season, cancellation/fair-price, correction, disqualification, source and expiry branches prevent guaranteed arbitrage. The small-capital limits were not enlarged, and no larger-capital scenario or recovery test was added.

## Confirmation performance

| Signal/queue latency, median / p95 ms | Prior checkpoint | Fresh frozen checkpoint |
| --- | ---: | ---: |
| Native WS-only signal-to-confirmation | 18 / 22 | **2 / 12** (461 confirmations; max 33) |
| Fresh executable signal-to-confirmation | 17 / 23 | **5 / 105** (665; max 1,131) |
| All signal-to-confirmation | 19 / 865 | 14 / 446 (892; max 11,879) |
| Queue wait | 18 / 305 | 3 / 16 |
| Confirmation work | <1 / 54 | 0 / 387 |

The WS fast path is preserved. The fresh and work p95 increased with the remaining fallback mix; no latency architecture or public-rate-budget change was made to improve these figures. Final post-review semantic changes were not benchmarked live.

## Verification, gaps and stop

153/153 targeted tests pass. GitHub CI passed **921/921 tests, typecheck and build** for signed final source `2bab556fa447649753c0895a7e063ecb072771dd` ([CI run](https://github.com/tyhuffman7/lights_on/actions/runs/36879536098), [receipt](final-ci-receipt.json)). Pre-freeze CI passed 893/893 tests, typecheck and build ([receipt](ci-receipt.json)). Source commit signatures verify using the required repo-local SSH signing key; GitHub identity is `tyhuffman7`.

Remaining gaps: incomplete ordinary parsing for title-holder dates/vacancy, cabinet cohort/start/trigger/ties and absent native Senate clauses; ranking scoring-method bindings; issuer first-listing history; partial alias/conditional extraction; and exact per-route settlement branch certificates. Named/group award and IPO candidates stay basis-risk rather than strict. Broad catalog recall is preserved on retained inputs, while venue-global/new-listing completeness remains unproved. Final fixes need a separately authorized future out-of-sample checkpoint to establish their live precision.

All collection is stopped. No orders, previews, cancellations, account mutations, fills, realized profit, fresh-fill recovery work, automation, merge or live launch. **Next action: user review of draft PR #22 and these receipts. Stop here.**
