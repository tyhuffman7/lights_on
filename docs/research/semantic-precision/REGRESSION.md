# Frozen semantic regression — October 1, 2026

The original frozen evidence and classifications are preserved. These are repeated native quote readings, not trades, profits or new market observations.

| State | Original classifier | Structured classifier |
| --- | ---: | ---: |
| STRICT_EQUIVALENT | 0 | 0 |
| ORDINARY_EQUIVALENT_BASIS_RISK | 50 | 167 |
| DIFFERENT_QUESTION | 0 | 63 |
| UNRESOLVED | 191 | 11 |

**180/241 readings change classification; all 50/50 prior basis readings survive.** There are 68 retained route/orientation combinations: 32 different questions, 28 ordinary/basis and 8 unresolved. Houston and Texas A&M regular-season wins retain their ordinary integer predicates and exceptional settlement branches.

The same retained native catalogs produce **20,616 routes before and after**, with zero additions or removals. Discovery recall is unchanged on this test. This does not prove all native venue markets are discovered.

The original top 20 had 17 different questions, two basis candidates and one unresolved candidate. The structured classifier agrees with all 20 labels, including all 17 known false matches. This is an in-sample regression result, not out-of-sample precision.

| Original rank | Retained manual label / replay result | Material ordinary distinction |
| ---: | --- | --- |
| 1 | DIFFERENT_QUESTION | Number-one seed versus any playoff qualification. |
| 2 | DIFFERENT_QUESTION | Rushing attempts versus rushing yards. |
| 3 | DIFFERENT_QUESTION | Knockout Round of 16 qualification versus finishing last in the league phase. |
| 4 | DIFFERENT_QUESTION | Semifinal qualification versus league-phase last place. |
| 5 | DIFFERENT_QUESTION | MLS Cup champion versus Eastern Conference final champion. |
| 6 | DIFFERENT_QUESTION | Number-one seed versus championship-game qualification. |
| 7 | DIFFERENT_QUESTION | Conference number-one seed versus division champion. |
| 8 | UNRESOLVED | Next actual departure or announcement after a specific start date versus next departure announcement before a deadline; cohort, tie and trigger clauses require full review. |
| 9 | DIFFERENT_QUESTION | Undefeated home games versus undefeated whole regular season. |
| 10 | DIFFERENT_QUESTION | First touchdown in the entire game versus first touchdown for one team. |
| 11 | DIFFERENT_QUESTION | Knockout semifinal qualification versus league-phase first place. |
| 12 | ORDINARY_EQUIVALENT_BASIS_RISK | Same canonical team/year and integer regular-season win predicate; modified-season, correction, source and expiry branches remain. |
| 13 | DIFFERENT_QUESTION | Conditional named-opponent matchup/nomination versus unconditional election winner. |
| 14 | DIFFERENT_QUESTION | Passing yards leader versus interceptions-thrown leader. |
| 15 | DIFFERENT_QUESTION | Conditional named-opponent matchup/nomination versus unconditional election winner. |
| 16 | DIFFERENT_QUESTION | First touchdown in the entire game versus first touchdown for one team. |
| 17 | DIFFERENT_QUESTION | Conditional named-opponent matchup/nomination versus unconditional election winner. |
| 18 | DIFFERENT_QUESTION | Vice-presidential nomination versus presidential nomination. |
| 19 | DIFFERENT_QUESTION | Passing touchdowns leader versus interceptions-thrown leader. |
| 20 | ORDINARY_EQUIVALENT_BASIS_RISK | Same canonical team/year and integer regular-season win predicate; modified-season, correction, source and expiry branches remain. |

Audit of all newly rejected retained routes found two incorrectly filtered candidates in the initial parser: Nebraska conference qualification used a catalog season-start date as the championship date, and Buffalo NHL finals used a spanning season versus an ending year. Both were corrected before the fresh freeze and now remain ordinary/basis candidates. The final rejected set contains explicit native subject, metric, stage, scope or qualifying-condition conflicts; no further incorrect rejection was identified in this retained set. This is a finite audit, not a general parser-completeness claim.

The retained LSU PM title/identity names LSU while its payout clause names Auburn. It remains quarantined as a native subject disagreement; the title is not used to repair the authoritative clause.

125 targeted tests pass, covering the retained native suite, all top-20 labels, unfamiliar-ID variants, unseen entities/clauses, player versus team scope, local versus aggregate control, conditional nominations, named touchdown scope, continuous versus discrete thresholds, and both temporal recall corrections. Full GitHub CI passed 893/893 tests, typecheck and build on signed source `a328a3c52f608f4f178214aa8110f679414b3c6e`. The first CI attempt passed all tests/build but exposed two type errors, which were corrected and retained in history.

Receipts: [frozen replay](frozen-replay.json), [unchanged discovery universe](recall-audit.json), [CI](ci-receipt.json), [native terms](native-terms-receipt.json), [contract comparison](CONTRACT-REVIEW.md).


## Post-window generalization

The new frozen window's nominal strongest 20 contained 18 different questions and two unresolved pairs. No bad pair was promoted to basis. Generalized dimensions now reject all 18: fantasy rank/award, published tennis rank/title, monthly/annual award, relative/absolute wins, occurrence/next departure, and noncomplementary soccer draw outcomes. Subsequent surviving-list review added semifinal/final qualification. New native fixtures, unfamiliar IDs, novel entities and same-team soccer/undefeated positive cases cover these changes.

The final replay of 665 readings yields 461 basis, 76 different and 128 unresolved, preserving all 440 observed basis readings. All 24 rejected distinct route/orientation combinations were inspected for explicit native ordinary conflicts; none was identified as incorrectly filtered. The original frozen replay is unchanged (167 basis,63 different,11 unresolved,50/50 preserved). Final surviving strongest review gives14 basis/six unresolved/zero identified different/zero strict. These are in-sample results, with no second live run. Final validation:153 targeted and921 full CI tests, typecheck and build passed; see [results](RESULTS.md), [final replay](live-post-review-replay.json), [manual survivor review](strongest-post-review.json), and [final CI](final-ci-receipt.json).
