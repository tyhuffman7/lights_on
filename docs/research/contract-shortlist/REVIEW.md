# Contract-reviewed shortlist — 2026-09-22

**No candidate is ready for paper execution.** All 50 historical confirmed-positive comparisons were screened: **11 identity conflicts, 36 structurally plausible, three with insufficient identity-window evidence**. Five of the 36 also contain explicit payout contradictions in their retained terms. The corrected matching path excludes 16 and retains 34 as **UNVERIFIED**; that is not a shortlist of 34 approved hedges. Five selected survivors received deeper review; all five are **CONDITIONAL**, none equivalent.

This is an offline review of [PR #8](https://github.com/tyhuffman7/lights_on/pull/8), commit `b2c6cc7093f1bd331808a2c546a8a8813fe828f1`. Its [hosted CI passed](https://github.com/tyhuffman7/lights_on/actions/runs/35678853861). The original [results](../depth-discovery/RESULTS.md), [three incompatible reviews](../depth-discovery/TRIAGE.md), [summary and confirmations](../depth-discovery/summary.json) are unchanged. No new prices, discovery window, orders, fills, ledger changes, size optimization or fee tuning occurred.

## Identity screen and matching corrections

[SCREEN.md](SCREEN.md) covers every comparison's entity, event, metric, geography, period, threshold and purchased orientation. [review.json](review.json) supplies exact IDs, source URLs, hashes, classifications and confirmation receipts. Unreviewed settlement terms remain unresolved, never incompatible merely because they have not been reviewed.

- **Kansas is not Kansas State.** `KXNCAAFB12QUAL-26-KSU` expressly names Kansas St. PM-US `aqc-cfb-big12-2026-12-04-champq-kan` names Kansas, team ID **1137**, Jayhawks; `...-champq-kanst` names Kansas State, team ID **1143**, Wildcats. The `KSU/kan` and reverse `KU/kanst` comparisons are wrong; `KSU/kanst` and `KU/kan` remain distinct valid candidate identities. Public primary metadata, not these abbreviated IDs, establishes the distinction.
- Alias generation had removed the final word of college names and then reused the resulting alias as another team's canonical identity. The narrow fix preserves trailing **State/St/Tech** in college football, including Virginia Tech versus Virginia. Valid State-to-St aliases remain, independently of catalogue order.
- Three Spotify routes use the reviewed Kalshi annual/global family versus PM-US US-only ranking. The original global interpretation is preserved with its caveat: the Kalshi PDF links a global report but its access instructions are nonbinding; this is a documented family-source inference, not an explicit global word in its payout clause. No generic rule treats missing geography as global.
- Three Israeli Defense-Minister/Prime-Minister routes, one next-new-PM/post-election-PM route, and the Grammys/VMA Best New Artist route are excluded using their actual payout clauses. The Netanyahu market's PM-US slug ending `bennet` does not override its actual Netanyahu name.
- Four government-formation pairs explicitly disagree on a repeat election: Kalshi terminates the original election's strikes at No; PM-US follows the new election. The NBA best-record pair explicitly disagrees on tiebreak-first versus splitting all tied records. These five additional payout conflicts also reach the existing matcher guard.

The guards use recognized clauses on both sides. Missing or unrecognized text does not fabricate a conflict or establish equivalence. The Billboard comparison, Newsom announcement-window comparison and Argentine next-election/2027 comparison remain insufficiently established. They still require review even though the matcher emits UNVERIFIED candidates.

## Five selected comparisons

Kansas State has the strongest remaining recorded fee-bound and after-risk surplus. Julia Stiles provides a different, potentially earlier season-ending event; Western Kentucky offers lower principal and shared qualification evidence. Oregon State tests a distinct championship-winner family. White Sox is a shorter-horizon comparison to assess whether locking capital for less time helps; its recorded economics already fail the risk allowance. The higher-ranked Tottenham/NBA routes lock capital into 2027, and 2028 nominations much longer. No selection uses apparent surplus alone.

Every number below is copied from its **September 22, 2026 historical confirmation**, not a current offer. Dollar amounts are total for the stated quantity; K/PM are Kalshi/PM-US. Fee bounds are upper bounds **within the retained fee model**, not observed commissions or an unconditional bound on arbitrary fractional fragmentation.

| Candidate and exact venue IDs / purchased sides | Confirmation UTC | Qty | Principal K / PM | Fee bound K / PM | Conditional fee-net surplus |
|---|---|---:|---:|---:|---:|
| Kansas State: `KXNCAAFB12QUAL-26-KSU` **NO** / `aqc-cfb-big12-2026-12-04-champq-kanst` **YES** | 01:12:51.967 | 10 | $8.30 / $1.10 | $0.10 / $0.07 | $0.43 |
| Julia Stiles: `KXDWTSRANK-226DEC31-JSTIL` **YES** / `rtc-dwts-s35-2-2026-11-17-julsti` **NO** | 01:14:21.323 | 7 | $0.56 / $6.09 | $0.07 / $0.06 | $0.22 |
| Western Kentucky: `KXNCAAFCUSAQUAL-26-WKU` **YES** / `aqc-cfb-cusa-2026-12-04-champq-wkent` **NO** | 01:14:23.352 | 7 | $2.01 / $4.55 | $0.14 / $0.11 | $0.19 |
| Oregon State: `KXNCAAFPAC12-26-ORST` **YES** / `tec-cfb-pac12champ-2026-12-04-w-oregst` **NO** | 01:24:49.616 | 10 | $1.00 / $8.60 | $0.10 / $0.08 | $0.22 |
| White Sox: `KXMLBAL-26-CWS` **NO** / `tec-mlb-alchamp-2026-09-27-cws` **YES** | 01:05:33.908 | 9 | $8.19 / $0.648 | $0.09 / $0.04 | $0.032 |

| Candidate | Separate risk allowance | Surplus after that allowance | Recovery cash K / PM | Reserved cash K / PM | Indicative horizon and preserved baseline blockers |
|---|---:|---:|---:|---:|---|
| Kansas State | $0.20 | $0.23 | $0.10 / $0.50 | $8.60 / $1.77 | 2026 qualification for Dec 4 game (~73 days); 30-day horizon and $10 total-reserve entry cap |
| Julia Stiles | $0.14 | $0.08 | $0.07 / $0.35 | $0.77 / $6.57 | Season 35 finale; exact primary broadcast date not established; horizon and $0.10 after-risk profit floor |
| Western Kentucky | $0.14 | $0.05 | $0.07 / $0.35 | $2.29 / $5.08 | Qualification for Dec 4 game (~73 days); horizon, profit floor, 1% ROI |
| Oregon State | $0.20 | $0.02 | $0.10 / $0.50 | $1.30 / $9.28 | Dec 4 championship (~73 days); horizon, profit floor, ROI, entry cap |
| White Sox | $0.18 | **-$0.148** | $0.09 / $0.45 | $8.46 / $1.228 | Terms name Oct 23 pennant (~31 days); horizon, profit floor, ROI |

These are alternatives, never additive profits. Each fits the recorded **$50 simulated per venue** individually; reserved cash includes principal, modeled fees, risk cash and recovery cash. Recovery reserves are not expenses. $100/venue historical live caps are irrelevant to authorization. No larger-capital scenario is asserted. Qualification can resolve early; the scheduled game date is not a promised release of cash. Administrative close timestamps are retained separately in JSON: they are neither proven payout deadlines nor guaranteed lockup bounds. For Julia Stiles they imply roughly 101/71 days K/PM from confirmation; the November date in the slug is not accepted as primary schedule evidence.

## Payout comparison and primary clauses

Let `k` and `p` be each venue's affirmative payout **per contract**, allowing fractional settlements. Purchased NO+YES pays `1-k+p`; YES+NO pays `1+k-p`. If both venues settle the same affirmative payout, the combined payout is $1, and `quantity - principal - fee bound` gives the table's conditional surplus. If they disagree, the payout can be below $1; multiplying the difference by quantity can exceed the small recorded surplus. No probability, actual settlement or historical fill is assumed.

**Classification meanings:** equivalent requires demonstrated alignment across material scenarios; conditional means the ordinary outcome aligns but specifically identified scenarios remain unhedged; incompatible means an evidenced predicate/payout conflict prevents admission; unresolved means necessary evidence is absent. Conditional here does not satisfy the existing settlement-equivalence gate. Documents fetched during this review are public primary sources, with retrieval times and SHA-256 hashes in [sources.json](sources.json). They supplement retained metadata; they do not prove which PDF version was served during collection.

### Q — Kansas State and Western Kentucky qualification: CONDITIONAL

Both positions refer to their actual team qualifying for the specified **2026 conference championship game**, not winning it. Kalshi links [NCAAFCONFCHAMPQ](https://assets.kalshi.com/contract_terms/NCAAFCONFCHAMPQ.pdf), internally titled NEWACHIEVEMENT. PM-US's [AQC filing](https://www.polymarketexchange.com/files/products/PMUS%20-%20AQC%20-%20%282026.03.26%29.pdf), Attachment A pp. 2–4, defines qualification by the governing body; the retained market terms specify Big 12 and Conference USA. Both cover official qualification and elimination. Kalshi's sources include the governing league plus news agencies, while PM-US prioritizes the governing body, then official records and news sources.

Kalshi pp. 1–2 waits up to two years for a postponed/suspended determining event; cancellation of the achievement allocates remaining spots across eligible listed participants, rounded down to cents. Withdrawal resolves No; an already settled elimination remains No after re-entry. PM-US AQC p. 3 allows cancellation settlement at a discretionary fair price or extension, gives pre-event withdrawal a fair-price settlement, and recognizes reversals before expiration. These treatments are not the same.

Kalshi's family expires by the day after an official result at **10:00 AM ET**; PM-US normally uses the earlier of declaration day or the contract-specific date at **11:59:59 PM ET**, subject to overrides. Both normally settle by the following day, absent review. ET is local Eastern time, not a fixed UTC offset. No common absolute deadline is established by the normalized close field.

### R — Julia Stiles, DWTS season 35 runner-up: CONDITIONAL

The actual predicates identify Julia Stiles, season 35, **second place**. [Kalshi COMPETITIONREALITYPLACEDWTS](https://assets.kalshi.com/contract_terms/COMPETITIONREALITYPLACEDWTS.pdf), pp. 1–3, uses official broadcaster/competition ranking, first final ranking, and treats absent final rankings/cancellation as No. Shared ranks split payouts unless a Tie strike exists, in which case participant strikes settle No. [PM-US RTC](https://www.polymarketexchange.com/files/products/PMUS%20-%20RTC%20-%20%282026.04.03%29.pdf), Attachment A pp. 2–4, uses official broadcast/source declarations; cancellation can settle at fair prices or undergo review, while multiple participants in a mutually exclusive outcome divide payout rounded to tick. Its retained market clause expressly extends expiration to a rescheduled finale.

Both source hierarchies start with the broadcaster/producer; PM-US names ABC in this market. Kalshi's latest expiration is one week after its parameterized date at **10:00 AM ET**; that parameter is not independently instantiated in the retained normalized record. PM-US normally expires on declaration day or the specified date at **11:59:59 PM ET**, with the finale extension. Its rulebook 10.5 also provides a last-price treatment for qualifying incapacitation of a natural-person subject. Kalshi's withdrawal/final-ranking treatment does not establish an identical payout. No exact schedule or common end-of-review cutoff is invented.

### T — Oregon State Pac-12 title and White Sox AL pennant: CONDITIONAL

Each names the same team, title and **2026 season**. Oregon's Kalshi [NCAAF link](https://assets.kalshi.com/contract_terms/NCAAF.pdf) contains ACHIEVEMENTS rules; White Sox links [TITLE](https://assets.kalshi.com/contract_terms/TITLE.pdf). Both use official title results, including early conclusions, and exclude revisions after expiration. Both PM-US contracts use [TEC Attachment A](https://www.polymarketexchange.com/files/products/PMUS%20-%20TEC%20-%20%282026.03.26%29.pdf), pp. 2–4, which prioritizes the governing body over supporting sources. Oregon's retained terms name Pac-12; the White Sox terms expressly describe the American League pennant on October 23. Its slug's September date does not change that event.

Kalshi NCAAF postponement ordinarily waits two weeks for a known final date; suspension can wait two years. Cancellation uses last trade/fair allocation, then an equal eligible-participant fallback. TITLE postponement/suspension waits up to two years; cancellation divides across eligible listed teams. Both apply No on withdrawal/forfeit and have their own correction/elimination finality. PM-US TEC allows fair-price/extended cancellation, fair-price pre-event withdrawal, and multiple-winner fractions rounded to tick. Its illustrative withdrawal examples say zero although its controlling general provision says fair price; that internal discrepancy remains a gap, not an assumed zero payout. White Sox's specific clause permits fair-price settlement when not rescheduled within two weeks and overrides the general family where inconsistent.

Kalshi normally expires by the next day at **10:00 AM ET**, PM-US by declaration day/contract date at **11:59:59 PM ET**, subject to each exception and specific term. Settlement review can delay cash release. These are different decision times, not a proven synchronized cutoff.

### Where the purchased positions offset — and where they do not

| Comparison | Ordinary matched outcomes | Specific unhedged scenario and combined payout per contract |
|---|---|---|
| Kansas State NO / YES | Both qualify: 0+1; both do not: 1+0 | Qualification cancellation: K affirmative fraction `r`, PM fair payout `f`; **1-r+f**, below 1 if `f<r`. Different correction cutoffs can also give K=1, PM=0, producing zero. |
| Western Kentucky YES / NO | Both qualify: 1+0; both do not: 0+1 | Pre-event withdrawal: K=0, PM=`f`; **1-f**. Cancellation/reinstatement or corrections at different expiration times can also leave unequal payouts. |
| Julia Stiles YES / NO | Both second: 1+0; both not second: 0+1 | Canceled season without final ranking: K=0, PM=`f`; **1-f**. A Kalshi Tie strike with shared second place can yield K=0, PM=1/N: **1-1/N**. Incapacitation and ranking/expiry differences remain exposed. |
| Oregon State YES / NO | Both win title: 1+0; both lose: 0+1 | Withdrawal: K=0, PM=`f`; **1-f**. Cancellation: **1+fK-fP**, unhedged when PM affirmative allocation exceeds Kalshi's. |
| White Sox NO / YES | Both win pennant: 0+1; both lose: 1+0 | Cancellation: K eligible-team share `r`, PM=`f`; **1-r+f**. A long postponement can settle PM at fair value while Kalshi continues; divergent correction cutoffs also expose this direction. |

`f`, `fK`, `fP` and `r` describe clause-dependent hypothetical payouts, not invented market prices. Tie/rounding differences require the actual tick, listed Tie strikes and eligible-participant set. Even when final totals offset, different settlement dates can lock capital on one venue longer.

## Remaining requirements and next action

For all five, retain exact contract-version/parameter evidence and resolve any market-specific overrides, absolute expiry instantiation, correction window and relevant tie/withdrawal interpretation. The generic PM-US [rulebook 1.5](https://www.polymarketexchange.com/files/legal/latest/rulebook) makes contract terms prevail over the family specification, which prevails over the rulebook; sections 10.3–10.5 preserve outcome-review/exception powers. None of that establishes cross-venue equivalence. The already demonstrated cancellation/withdrawal differences would still require an explicit approved conditional-risk policy; this checkpoint does not introduce one.

Any subsequent paper execution also needs separately authorized fresh exact-quantity books, adequate depth and freshness, preserved Ohio eligibility and risk gates, resolved status admission, a supported account-precision/fragmentation fee model, and a bounded two-leg execution test. Historical confirmations had **Kalshi status UNRESOLVED** (`STATUS_CACHE_CURRENTNESS_UNPROVEN`, `NON_ATOMIC_INITIAL_STATE`), while PM-US was open in the confirmed book. That evidence is reported without investigating or relaxing the status gate. Execution/fill and fresh-fill recovery remain unproven. Paper and live authorization are separate; this review enables neither.

**Recommended next action:** make a bounded contract-risk decision on the Kansas State qualification pair's documented cancellation, withdrawal and expiry differences before considering a separately authorized paper test. It is the strongest conditional research candidate ($0.43 fee-bound, $0.23 after the unchanged allowance), but it is not an approved arbitrage. No candidate is recommended for immediate execution; White Sox is rejected economically even under the ordinary complementary-payout assumption.

## Verification

The retained catalogue subset includes four earlier public alias-context records solely to reproduce the original order-dependent error; they add no price comparisons. Replaying the old matcher reproduces all **50/50** historical routes. The corrected existing matcher retains **34/50**, all UNVERIFIED and non-inverted. Regression checks preserve both valid Kansas routes, State/St aliases, unknown terms and aligned predicates. Tests also require all 50 report rows to agree with matcher output, preserve the three original classifications, and copy all five original quantities, fees, reserves, status and confirmation receipts exactly.

Run the targeted checkpoint with `node --experimental-strip-types --test tests/contract-shortlist.test.ts tests/state-team-alias.test.ts tests/payout-predicate-conflicts.test.ts tests/discovery.test.ts`. **91 targeted tests passed**, zero failures; `git diff --check` passed. Full tests/typecheck/build belong to hosted CI. This checkpoint stops at review, narrow matching corrections and draft publication.
