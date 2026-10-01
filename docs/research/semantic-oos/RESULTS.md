# OUT-OF-SAMPLE VALIDATION — October 1, 2026

**The classifier needs another iteration.** The bounded temporal holdout preserves high observed precision in the audited basis-promoted stratum (30/30), and none of 50 reviewed different-question rejections is a legitimate same-predicate route. However, **36/50 strongest surviving route/orientations, including all 20 strongest, are different questions left unresolved**. The nominal hot list therefore does not generalize acceptably. The source and classifier remain unchanged. No live execution work, orders, account mutations, fills or realized profit.

## Freeze and stopped observation

Source head: signed `404ae5b19b467cdcb0c073c2900edd32467f41ef`, draft PR #22 / `codex/recall-first-detector`. Classifier SHA-256: `28f926a5ec26b920a69e0ae3ce2dd05e73224430e3f490fd65bdabd3a07597f6`. [Pre-window freeze](pre-window-freeze.json) hashes 193 source/dependency files before live catalog collection; all 193 match after shutdown, and the observer's independent 14 hashes and complete runtime policy agree. The frozen commit's repo-local SSH signature verifies. There were no classifier edits, threshold changes, tests/builds, candidate reviews or repeated CI polls during collection.

Observation: **12:24:40.918–12:54:40.918 EDT**, October 1 (16:24:40.918–16:54:40.918 UTC). 1,800,032 ms including shutdown; exit 0, no failure reason, pending confirmations 0. The process check found neither the observer nor its supervisor remaining. Native catalog preparation completed in 127,282 ms without errors. The only observation override is the requested duration, 20 → 30 minutes. Every economic/freshness/risk parameter is unchanged: $50 simulated per venue, $5 paired commitment, maximum ten contracts, two-second book freshness, 128 hot routes, same native fee and WS/fallback paths. Paper-only restrictions remain in force.

Native immutable evidence: `work/semantic-oos-20261001-v1/{pre-window-freeze.json,frozen.json,catalog-1.json,evidence.ndjson,summary.json,supervisor.json,worker.log}`. Evidence bytes: 390,283,869; SHA-256 `648e62ac582604d989dc87c20bed7a71608e860d3ada229fa57406072d88b463`. [Live receipt](live-receipt.json) retains the complete counts, latency and queue results. Prior windows and in-sample replays are untouched.

## Full outcome and denominators

| Measure | Result |
| --- | ---: |
| Catalog markets Kalshi / PM-US | 130,321 / 69,811 |
| Discovered / visited / both-book routes | 21,840 / 21,840 / 21,840 |
| Routes with at least one fresh two-book observation | 11,211 |
| Fresh two-book observation readings | 516,989 |
| Fresh normal-fee positive readings (one-contract orientation counter) | 61,482 |
| Fresh executable positive readings (one-contract orientation counter) | 10,644 |
| Completed confirmations | 1,742 |
| Fresh executable positive confirmations | 1,229 |
| Unique surviving route/orientation candidates | 188 |
| Unique broad economic / different-question-vetoed route/orientations | 10,894 / 10,365 |
| Healthy feeds at stop | 181 / 181 |
| PM-US HTTP 429 responses | 58 |
| Strict-equivalence certificates / fills / realized profit | 0 / 0 / not measured |

One-contract observation counters and variable-quantity confirmation counters have different denominators. Broad ECONOMIC_SIGNAL records are deduplicated by quote fingerprint, can be stale, and must not be interpreted as distinct profitable trades. “Executable” here is the existing fresh native depth/minimum-quantity flag, not settlement admission or actual ability to earn a risk-free return.

| Frozen classification | Discovery route labels | Recorded broad economic quote fingerprints | All completed confirmations | Fresh executable confirmations | Unique fresh survivor route/orientations |
| --- | ---: | ---: | ---: | ---: | ---: |
| STRICT_EQUIVALENT | 0 | 0 | 0 | 0 | 0 |
| ORDINARY_EQUIVALENT_BASIS_RISK | 2,482 | 278 | 945 | 763 | 111 |
| DIFFERENT_QUESTION | 15,725 | 22,927 | 0 | 0 | 0 |
| UNRESOLVED | 3,633 | 1,136 | 797 | 466 | 77 |

Zero frozen different-question confirmations is a statement about classifier labels. The manual reference review below finds false matches among frozen unresolved confirmations.

## Manual audit and confusion

[Primary audit](MANUAL-AUDIT.md): strongest 50 unique fresh executable confirmed route/orientations by best observed modeled normal-fee net. A supplementary top-promoted stratum adds 20 candidates so that the top 30 frozen basis promotions are reviewed. [Recall audit](RECALL-AUDIT.md): 30 strongest nominal economic rejected candidates plus 20 strongest fresh executable rejected candidates. Total **120 unique audited route/orientation records: 70 survivors and 50 rejections**. Labels were manually assigned by the agent from native clauses and relevant term documents; no independent human reviewer or statistically random sample is implied. Supplementary strata were chosen after the stopped run and are explicitly label-selected; the pre-frozen primary ranking is unchanged.

Primary strongest 50: **14 ordinary/basis, 36 different question, zero strict, zero remaining unresolved reference labels**. The top 20 are **20 different questions**. Thirty reviewed frozen basis promotions are all ordinary/basis. Source unresolved candidates include four manually ordinary hypotheses (three correlated darts orientations and Texas Tech final qualification), so uncertainty causes missed promotion as well as false-hot-list contamination.

| Frozen class → manual class, primary 50 | Strict | Ordinary/basis | Different | Unresolved |
| --- | ---: | ---: | ---: | ---: |
| Strict | 0 | 0 | 0 | 0 |
| Ordinary/basis | 0 | 10 | 0 | 0 |
| Different | 0 | 0 | 0 | 0 |
| Unresolved | 0 | 4 | 36 | 0 |

| Frozen class → manual class, all 120 reviewed | Strict | Ordinary/basis | Different | Unresolved |
| --- | ---: | ---: | ---: | ---: |
| Strict | 0 | 0 | 0 | 0 |
| Ordinary/basis | 0 | 30 | 0 | 0 |
| Different | 0 | 0 | 50 | 0 |
| Unresolved | 0 | 4 | 36 | 0 |

- Promoted ordinary/basis precision: **30/30 = 100%** in the enriched reviewed stratum; primary-only **10/10**. False promotion: **0/30**; human-unresolved promoted fraction **0/30**. This is promising finite evidence, not proof of population precision.
- Frozen unresolved rate: **40/50 = 80%** of the primary list, or **77/188 = 41.0%** of unique live survivors. Fresh-reading unresolved rate **466/1,229 = 37.9%**. Manual unresolved rate is zero under the nominal darts pairing assumption; holding all three darts rows unresolved for the observed 25-minute metadata timing discrepancy gives **3/50 = 6%**, with **11 basis / 36 different / 3 unresolved**. Promoted precision and the failure conclusion do not change.
- Different-question capture among all reviewed human-different records: **50/86 = 58.1%**; missed different questions **36/86 = 41.9%**. The primary hot list alone has **0/36 captured**. The combined ratio is affected by the deliberate addition of 50 vetoed examples and is not a global detector recall estimate.
- Obvious false matches reaching the primary hot survivor list: **36/50 = 72%**, and **20/20 = 100%** at the top. None was falsely promoted to basis; all was left unresolved.
- Legitimate ordinary/strict candidates incorrectly rejected as different: **0/50 reviewed rejections**. Frozen-unresolved yet manually ordinary: **4/34 = 11.8%** of all manually ordinary survivors (three darts orientations represent one nominal fixture); conservative darts binding leaves one clearly ordinary qualification candidate unpromoted. Global opportunity recall is unproved.

[Machine-readable audit metrics](audit-metrics.json) retains every denominator and cohort. The cabinet reference labels are different question because the controlling native cohort definitions now supply an explicit ordinary participant-scope conflict (OSTP versus Vice President), rather than treating all cohort uncertainty as settlement-only basis.

## Unseen-market limits

All live books and confirmations were collected after the freeze, so this is a temporal holdout, not replay of the training window. Many market pairs recur. Among 188 survivor route/orientations, **146 use previously observed pair IDs and 147 use previously observed market-hash pairs**; 14 use pairs from earlier manual reviews. These are candidate-orientation counts, not independent markets.

The primary audit includes **13/50 candidates with previously unseen pair IDs and native market-hash pairs**: five ordinary/basis and eight different questions. Only **two** are frozen basis promotions; the other eleven were unresolved. Adding the promoted stratum gives **14/70 unseen-pair candidates**: six ordinary/basis and eight different; only three unseen-pair promotions were reviewed. Related native family rules can still have appeared in training. The window cannot substantiate broad generalization to completely unseen markets from those small correlated strata; it does substantiate a failure on new live data and on eight unseen-pair false matches. Overlap flags are retained per row.

## Strongest ordinary pricing discrepancies and strict investigation

[Ranked complete economics](ECONOMICS.md) and [exact quotes/terms/depth](valid-economics.json) retain all 34 manually ordinary/basis candidates, with IDs, proposition, orientation, quantity, levels, prices, leg fees, gross/net, quote and exchange/receipt timestamps, book ages, confirmation latency, settlement differences and rationale. No repeated update is a new trade. All monetary values use the unchanged integer 1e-8-dollar arithmetic; [120/120 retained quote arithmetic checks](arithmetic-audit.json) pass.

| Candidate | Qty / native consumed prices | Acquisition + modeled fees | Gross / normal-fee net | Book receipt ages K/P / confirmation |
| --- | --- | ---: | ---: | --- |
| Nominal Harry Ward / Petri Rasmus darts, K Yes Ward + P Yes Rasmus | 5; K 0.84; P 3.73 @ 0.05 + 1.27 @ 0.12 | $4.5389 + $0.07 | $0.4611 / **$0.3911** | 32 / 1,178 ms; 5 ms |
| Nebraska >=7 / >6.5 regular-season wins, K No + P Yes | 5; 0.25 / 0.65 | $4.50 + $0.15 | $0.50 / **$0.35** | 5 / 1,129 ms; 1 ms |
| Nominal Rasmus K Yes + P No; also opposing losses K No Ward + P No Rasmus | 5; K 0.01; P 2.99 @ 0.93 + 2.01 @ 0.95 | $4.7402 + $0.03 | $0.2598 / **$0.2298** | 19/270 or 14/271 ms; 2 or 4 ms |
| UCLA >=7 / >6.5 regular-season wins | 5; K No 0.17 / P Yes 0.77 | $4.70 + $0.11 | $0.30 / **$0.19** | 762 / 11 ms; 1 ms |
| Utah >=9 / >8.5 regular-season wins | 5; K No 1 @ 0.17 + 4 @ 0.18 / P Yes 0.76 | $4.69 + $0.12 | $0.31 / **$0.19** | 143 / 24 ms; 3 ms |
| Oklahoma >=8 / >7.5 wins; Dario Amodei TIME 2026 | 5 each; K Yes/P No 0.18/0.76 or 0.08/0.87 | $4.70+$0.12 or $4.75+$0.07 | $0.30/$0.18 or $0.25/**$0.18** | exact separate rows in JSON |

Darts is a nominal ordinary pairing with an additional unresolved event-binding discrepancy: the PM question's original 16:00 UTC time aligns with Kalshi, but PM gameStartTime is 16:25 UTC. The three orientations are correlated, not three independent tradable opportunities. **Nebraska's $0.35 is the strongest reviewed ordinary quote without that extra timing gap.** Both still have material settlement branches. The darts native two-week fair-price versus PM two-day / $0.50 cancellation/walkover terms prevent strict complementarity even if the match identity is confirmed.

**Zero strict-equivalent candidates were established.** Full relevant native settlement clauses were compared for the ordinary families; [contract comparison](CONTRACT-REVIEW.md) identifies exact clauses and pages. WINTOTAL's actual shortened-season count and expiration/finality differ from AACHC modification/cancellation/review, disqualification and source/expiry rules. Championship/qualification re-entry and remaining-slot branches differ; OSCARS no-source-at-expiry No differs from TAC cancellation/category handling; TIME publication horizons differ. No strict arb was manufactured from titles or nominal economics.

All 34 ordinary quotes fail the retained extreme-fragmentation fee stress; 17 also fail the one-native-tick-per-leg stress. Fees retain unconfirmed account precision. Rows 50, 51 and 62 also fail the existing first-leg exposure gate. Nothing here proves paper fills, fresh-fill recovery, guaranteed returns or repeatable net profit on small capital. No limits were enlarged and no larger-capital scenario was added.

## Remaining failure families — next task only

1. **NFL first-score / race-to-points / “neither team”**: missing event participants allows different games to align; missing/unknown statistic/threshold binds 35 or 28 points to 7/14/21/28/35 or no score. Twenty-two primary rows belong to this correlated family. A game/threshold mismatch remains an ordinary conflict regardless of side orientation.
2. **League-phase rank ranges**: Champions League bottom-of-table versus top-eight. Both are known unequal ordinary outcomes, although frozen extraction leaves them unresolved.
3. **Award-category bindings**: director versus actress and cinematography versus picture nominations are not equal even with matching nominee/ceremony. The two original-metadata Oscar misses remain unresolved rather than vetoed.
4. **Chart rank/chart family**: top-20 versus number-one single, and Hot 100 song versus Billboard 200 album (also primary versus featured artist scope). Frozen chart parsing leaves these conflicts unresolved.
5. **Political trigger, cohort and cycle**: first G7 actual departure versus any departure; announcement/cutoff versus actual departure/year-end; next Cabinet races over different VP/OSTP cohorts; Senate 2028 versus 2026; office departure versus assuming office after an election. Some issues were previously known conservatively unresolved; this window supplies explicit conflict evidence. They are not all new failure families.
6. **Conservative legitimate recognition**: same nominal darts pairing and Texas Tech final qualification stay unresolved. Darts metadata timing remains a separate binding gap; no tightening of vetoes is justified by the hot-list failure alone.

None was repaired or replay-reclassified during this checkpoint. Preserve broad discovery and use these receipts only in a separately authorized future task. [Individual audit](MANUAL-AUDIT.md) records both newly identified patterns and recurring gaps.

## Confirmation and queue performance

| Metric | n | Median / p95 / max ms |
| --- | ---: | --- |
| Native WS-only signal-to-confirmation | 970 | **2 / 11 / 55** |
| Fresh executable survivors | 1,229 | **4 / 82 / 10,197** |
| All completed confirmations | 1,742 | **7 / 9,063 / 12,773** |
| Queue wait | 1,742 | **3 / 19 / 1,927** |
| Confirmation work | 1,742 | **0 / 9,061 / 11,028** |

The WS fast path remains fast. The overall fallback tail is material: 767 fallback confirmations, 357 Kalshi WS snapshot fallbacks, one snapshot-fallback failure and 58 PM-US 429 responses. Fresh-survivor p95 is 82 ms, but its 10.2-second maximum prevents describing every fresh confirmation as low latency. Pending queue peak 7, pending 0 at stop; 745 superseded, 95 disappeared before dispatch, 94 expired, 45,241 censored before dispatch. Hot route cap 128 was reached, with 4,313 budget demotions and 17,529 deferred promotions. These are scheduling counters, not estimated missed fills or global opportunity recall. One stream restart; all 181 feeds healthy at stop. No architecture or rate-limit tuning was done.

## Verification and stop

[Frozen-head GitHub CI](https://github.com/tyhuffman7/lights_on/actions/runs/36881135658): **921/921 tests, typecheck and build passed** ([compact receipt](frozen-ci-receipt.json), merge ref `1231f7b` for PR head `404ae5b`). The observation and audit used the same unchanged runtime source. No new local full test/build run was needed for evidence/docs-only publication. The offline reporting script uses the bundled Python runtime; a first invocation on the older system Python lacked `hashlib.file_digest`, so it was rerun with the bundled runtime after shutdown. Raw evidence and frozen classification were not modified.

All collection is stopped. No orders, account mutations, fills, realized profit, new recovery experiment, automation, merge or live launch. The next action is user review of the draft and decision on a future classifier task. This checkpoint is complete; no follow-on collection is scheduled.

**SEMANTIC CLASSIFIER NEEDS ANOTHER ITERATION — 36/50 strongest survivors (20/20 top) are different questions left unresolved.**
