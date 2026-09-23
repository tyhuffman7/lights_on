# Settlement-family checkpoint — September 23, 2026

**No LIVE_EXACT or STATE_CONDITIONED route is proven.** The existing matcher produces **3,120 candidate routes across 46 semantic settlement-family pairs**, represented by **52 source-document pairings**. There are **2,852 BOUNDED_BASIS, 63 INCOMPATIBLE and 205 UNRESOLVED** routes. This is settlement research, not a profitable-opportunity count or live admission. No watch, PAPER session, order, preview, cancellation or new mapping was run/added.

The [full family index](FAMILY-INDEX.md) links every controlling product document. The [matrix](matrix.json) compares 16 dimensions for every document pairing, including separate withdrawal, disqualification, expiration and review fields. The [78-source manifest](sources.json) pins 50 Kalshi product documents, 26 PM-US products and both venue rulebooks. [Sanitized aggregates](aggregate.json) preserve all class counts. Raw catalog, per-route audit, downloaded PDFs and authenticated responses stay local.

## Universe and reproducibility

The input is the latest saved complete, error-free catalog, **2026-09-22 00:55:59.272 UTC**, containing 113,720 Kalshi and 64,178 PM-US listings. It is not a September 23 live-open inventory. The unmodified matcher at PR #16 base `16e9a15cdb7886bae9721b8ded4f08f035ee6f00` produced the 3,120 unique routes. The matcher retains its existing indexing and comparison limits (209,493,577 comparisons deferred); this is its complete produced candidate set, not a claim that every possible cross-product pair was exhaustively compared. No family was selected by price, spread, liquidity or earlier shortlist membership.

The catalog SHA-256 is `ca2861f93a4115bc1b1e28448fff6d1d516ea70aa9667ad2fcfdaf69cfe608c7`. Official product/rulebook sources were fetched September 23. Kalshi URLs come from each candidate's inline primary-document link. PM-US product codes are bound to the exchange's published product filings and checked against the inline predicate; the code prefix alone does not prove settlement compatibility. Contract-specific inline terms remain part of the comparison. PM Rule 1.5 gives contract terms precedence over product specifications and those over its rulebook; no corresponding assumption is invented to resolve a contradictory Kalshi chart parameter.

Document aliases are retained: for example NCAAF and NBA are ACHIEVEMENTS variants; NCAAFCONFCHAMPQ is NEWACHIEVEMENT; NCAAFWINS is WINTOTAL; MTVVMAS is AWARDS; both IPO documents call themselves IPOEVENTCONFIRM but one adds first-public-history restrictions. Identical family labels therefore do not erase distinct text or individual parameters. Fifty-two document pairings collapse to 46 semantic pairs.

Reproduce offline, with the original catalog kept outside version control:

```sh
node --experimental-strip-types worker/settlement-family-audit.ts \
  --catalog /absolute/path/to/catalog.json \
  --private-output work/family-audit
node --experimental-strip-types --test tests/family-settlement.test.ts
```

For a previously generated matcher cache, the worker also accepts `--candidate-cache FILE --candidate-cache-sha256 HASH`; it verifies the exact cache digest and each candidate's original market metadata hashes. A cache digest is an integrity check, not a substitute for proving that it was produced by the existing matcher. The published aggregate records this checkpoint's cache and catalog digests. The worker rejects a catalog outside this reviewed checkpoint; reusing the profiles requires rebinding route evidence and source versions. It never fetches data, writes mappings or imports an order adapter. Its default path recomputes the existing matcher.

## Classification and propagation

LIVE_EXACT requires all material branches to be complementary. STATE_CONDITIONED requires an explicit rule proof and machine-observable condition eliminating **every** differing branch; whether both venues are still tradable is reported separately. BOUNDED_BASIS requires a proven common ordinary predicate but retains enumerated exceptional differences. INCOMPATIBLE requires a concrete ordinary/reachable disagreement. UNRESOLVED means missing controlling scope, identity or eligible-history evidence, not simply different wording or an unfavorable price.

Route propagation independently compares entity/outcome, threshold and comparator, YES/NO orientation, reference date/window, geography, primary ordinary source and family-specific dimensions. Original catalog metadata is used because the matcher returns normalized identities that are unsuitable as fresh input to its original prose parsers. Existing aliases are used without adding mappings. Half-integer versus integer comparisons are equated only on an integer outcome domain. Sports compare the original scheduled event, not an administrative close date. Opposing game-winner selections require complementary orientation. Partial/unknown evidence never inherits a family approval.

| Route classification | Routes | Semantic families containing these routes |
|---|---:|---:|
| LIVE_EXACT | 0 | 0 |
| STATE_CONDITIONED | 0 | 0 |
| BOUNDED_BASIS | 2,852 | 30 |
| INCOMPATIBLE | 63 | 13 |
| UNRESOLVED | 205 | 8 |

The family-containing counts overlap. Under the index's explicitly labeled strongest-supported-subset convention, the 46 family profiles are 30 BOUNDED_BASIS, 11 INCOMPATIBLE and five UNRESOLVED. **A profile label never promotes all its routes:** for example BASEBALLGAMEWIN/AEC contains 108 bounded routes and 12 wrong-date routes. All 52 document variants have individual counts and profiles.

| Class | Largest semantic family subsets |
|---|---|
| BOUNDED_BASIS | FOOTBALLSPREAD/ASC 736; FOOTBALLTOTALS/TSC 451; WINTOTAL/AACHC 396; FOOTBALLGAMEWIN/AEC 364; ACHIEVEMENTS/TEC 130; NEWACHIEVEMENT/AQC 117; BASEBALLGAMEWIN/AEC 108 |
| INCOMPATIBLE | Reality elimination/RTC 19; baseball winner/AEC 12; FRENCHPRES/EWC 10; ELECTION/EWC 4; RANKLIST/CCPC, SCOURT/NPHC and governor-count comparison three each |
| UNRESOLVED | AWARDS/TAC 76; IPOEVENTCONFIRM/IPCC 39; TOPALBUMBY/CCPC 36; NETFLIXRANK/CCRC 27; STREAMRANK/CCRC 17; RUN/CRANC six; qualification team-alias binding three; RANKLIST/CCPC one |

Concrete rejects include baseball games a day apart despite common teams/UTC date, ET-versus-Pacific elimination deadlines, Senate confirmation versus recess appointment, congressional leader affiliation versus election-attributed seats, named Grok 5 versus broader generation successors, and monthly/annual versus single-week chart predicates. A shortened alias or artist-versus-work name alone is **not** declared incompatible: absent exact binding stays unresolved.

Unresolved issuance/history means the same **contractually eligible history** is not established. Creation/open timestamps do not by themselves prove identical issuance or that no qualifying event occurred in the gap. The earlier issuance metadata review already demonstrates unequal raw start timestamps for some annual-chart/campaign routes. A shared final deadline does not repair that. Netflix's US inline scope versus English-chart PDF requires authoritative clarification. These 205 routes cannot support a categorical statement that exact equivalence is impossible everywhere; the defensible result is **zero proven exact**, with explicit evidence gaps.

## Why observable late states do not currently give strict equivalence

The obstacle is more specific than generic exchange counterparty risk. Contractual payout-changing branches remain:

- Kalshi Rule 6.3(c) permits last-price/fair-allocation settlement when an expiration value cannot be determined; 7.1–7.2 permit review and source/contract adjustments before settlement. See [DCM Rulebook v1.29, PDF pp62–65](https://kalshi-public-docs.s3.amazonaws.com/regulatory/rulebook/Kalshi%20DCM%20Rulebook%20v.1.29.pdf#page=62).
- PM Rules 10.3–10.5 permit contract modification/review and natural-person contingencies; Rule 2.8(d)(iii) explicitly permits cancellation and return of entry funds during an emergency. See [PM-US Rulebook, PDF pp18–21 and 80–82](https://www.polymarketexchange.com/files/legal/latest/rulebook#page=18). One venue refunding its entry payment while the other pays the ordinary result need not return a combined dollar, even after an official result is known.
- Both venues using their own last fair price is not a hedge: those prices need not be equal. A tie split rounded to cents need not match a split rounded to a tenth of a cent. Natural-person contingencies and correction windows also differ.

These are allowed divergence witnesses, **not claims that the events occurred, estimates of their frequency, or a prediction of loss**. State removal must prove a branch impossible, not merely observe that it has not happened yet. The matrix retains product-specific differences rather than deriving every conclusion from the broadest emergency rule alone.

| Proposed machine-detectable state | Risks it can remove | Remaining mismatch / trading window |
|---|---|---|
| Official sports event started with expected participants/venue | Pre-start nonparticipation/forfeit | Later suspension, replay, disqualification, corrections and independent review remain. Default close schedules may allow trading; simultaneous current open status/depth untested. |
| Official sports event completed normally, final score posted, no exception flagged | Unplayed/incomplete-result uncertainty | Different correction/replay/review cutoffs remain. Both venues may accelerate closure. |
| Official CPI/GDP/U3 release for exact vintage published | Missing ordinary release | Kalshi closes 08:29 ET before scheduled 08:30 publication. Post-release entry on both venues is unavailable under these terms. U3 PM inline previous-month fallback now aligns more closely than a blanket “different fallback” claim, but corrections/timing/review remain. |
| Exact Netflix chart published | Missing chart | Current Kalshi inline closes Monday 23:59 ET before Tuesday publication; scope issue also unresolved. |
| Other official chart published | Nonpublication to that point | Version/credit, first-release versus revised value, tie precision and review remain. Some annual reports may precede close; no current common trading window proved. |
| Official award winner or reality final rank announced | Cancellation without outcome to that point | Shared result, corrected announcement, inferred ranks, natural-person/review branches remain. Nominal end-of-day versus 10:00 expiry is not proof orders are accepted. |
| Deadline passed with no qualifying event | Future ordinary occurrence within window | Late confirmation, allowed extension, missing-source and review clauses can remain; a market whose entry cutoff passed is unusable. |

The machine helper requires fresh official evidence, an unambiguous event time, no indicated exception and two independently fresh open-market states. It is a **bounded-basis diagnostic only**. No state condition in this checkpoint eliminates every branch; no state-conditioned routes are promoted. Checking that both venues have already settled to complementary values would be a retrospective tautology, not an executable strategy.

**Practical conclusion:** insisting on strict cross-platform complementarity across explicit exceptional powers is not a demonstrated scalable entry policy in this universe. Resolution-lag trading remains a plausible way to reduce **bounded** basis risk in selected families, but it is not yet a proven profitable strategy. The smallest residual class identifiable here is a normally completed event/official publication with matched ordinary predicates and no indicated exception, while accepting independent venue correction, review, emergency cancellation/fair allocation and non-atomic execution. No probability or expected-risk charge is invented.

## PR #16: prerequisite versus objective

This supersedes the blocker taxonomy, not the historical evidence, in [PR #16 readiness](../../pilot/TINY-LIVE-READINESS-20260923.md).

| Before a first pilot | Present disposition |
|---|---|
| Legal, venue and exact-account eligibility for jurisdiction/product | Unresolved; authenticated reads or an API key are insufficient. The [August 28 federal appellate opinion, p17 n2](https://cdn.ca9.uscourts.gov/datastore/opinions/2026/08/28/25-7516.pdf#page=17) records the Ohio district court's March 9 denial of Kalshi's requested injunction. That is not a current account/product eligibility determination. No later dispositive Ohio authorization was established here. |
| Fresh cash, positions, open orders and pending-execution reconciliation | Bounded authenticated GET audit performed privately; no account values/state published. A fresh launch-time reconciliation remains required. Recent history endpoints do not certify a lifetime audit or clear any PAPER uncertainty. |
| Order capability where a read-only status endpoint exists | Capability evidence checked privately. A key scope/location attestation is narrower than account/product permission. No documented PM app-key write-status endpoint was found; unrelated institutional endpoints were not substituted. |
| Account fees **or a valid conservative upper bound** | Public schedules/rounding clarified; useful account-specific precision/bound not fully resolved. Actual future commissions are an objective, not a prerequisite. |
| Current market status and health | PR #16 stale lifecycle/bootstrap concern remains. A catalog flag is not current status. Healthy authenticated execution feeds are required before entry; no new feed session run here. |
| Settlement admission | This matrix resolves classification at scale. No exact route. Bounded-basis routes require separately approved policy, per-route evidence and exception checks. |
| Positive after conservative fees, short expected lockup | Unresolved for any current entry. No price selection/confirmation or new observation occurred. Previous 1¢ diagnostic episodes are historical and do not satisfy this gate. |
| Durable $5/one-pair/one-attempt controls and isolation | Existing dormant controls remain; new policy is design-only. Future integration must preserve cap, attempt consumption, reconciliation, stop rules and literal authorization boundary. |
| Separate live authorization | Not given; this checkpoint authorizes only research and draft publication. |

**Pilot-learning objectives:** actual order acceptance, venue latency, fill behavior, returned commissions, cross-venue sequencing, one-leg/no-fill behavior and recovery **if those outcomes occur**. Deterministic safety checks and a bounded response plan are prerequisites; prior successful live fills/recovery are not. One lifetime attempt cannot guarantee observing every objective. Never force a partial fill, loss or recovery just to complete a checklist.

Fee facts: the [current PM-US schedule](https://docs.polymarket.us/fees), effective September 17, uses taker coefficient 0.0695, cent banker's rounding and a cumulative aggressive-order commission cap; a one-contract standard-schedule taker fee is at most $0.02. Do not credit maker or volume rebates in a conservative plan. [Kalshi fee rounding](https://docs.kalshi.com/getting_started/fee_rounding) distinguishes $0.0001 direct-member and $0.01 non-direct balance grids, microdollar trade-fee rounding and per-order rebates capped by each fill's net fee. Therefore a one-contract order split into fractional fills does **not** justify assuming one cent-rounded fill. Bind current series fee parameters, account precision or a worst-case fragmentation bound before claiming positive economics. A loose valid bound may make every quote inadmissible; that does not make fees zero or require a real fill to learn the published rules.

## Disabled bounded-basis pilot design

[`TINY_LIVE_BOUNDED_BASIS`](../../../config/tiny-live-bounded-basis.disabled.json) is separate, disabled and not consumed by execution. It prefers LIVE_EXACT if subsequently proven. For bounded admission, require every ordinary dimension, enumerate every remaining exception, verify none is occurring/indicated, use a normally completed short event where available, and accept the residual explicitly in a later launch plan.

Limits: **$5 total cumulative gross commitment including reserved entry/recovery fees; one contract per venue; one pair maximum; one lifetime entry sequence**, consumed durably before first submission. No proceeds reuse, no retry after a no-fill to search for a better result, no concurrent sequence, halt on any unknown execution and end the pilot on any realized loss. At most one reducing FOK unwind is permitted only after a confirmed one-sided fill and only within the original reservation; an unknown state requires reconciliation, not a speculative hedge. Restart does not reset the attempt. Existing PAPER stores, balances and prior-paper uncertainty remain separate.

The design uses **72 hours expected settlement**, not a guarantee against contractual review delays; extended-lockup risk must be disclosed and accepted separately. Positive surplus must remain after actual account fees or a defensible conservative bound; the one money-unit floor is $0.0001 and expresses strictly positive arithmetic, not a claim that that margin compensates for risk. The prior paper/watch 2¢ allowance is not treated as an estimated exception probability. No positive economics was established for this design. There is no live arming, adapter admission change or risk-free label.

**Single shortest next step:** obtain a current venue/account-specific Ohio eligibility and trading-permission determination for the intended product class (including PM-US account status). This is the consequential blocker that GET balances and rule comparison cannot settle. Then a separately authorized launch-preparation step can bind a short-horizon bounded route, fees, fresh reconciliation/status/economics and a concrete ≤$5 plan. No additional observation run is justified by this checkpoint alone.

## Verification and stop

Twelve focused tests cover the four proof classes, missing evidence, surviving exceptional branches, post-close states, ordinary threshold/date/orientation mismatches, wrong-date baseball, Pacific elimination deadlines, source pins/dimension coverage and disabled policy controls. Full tests/typecheck/build are delegated to GitHub CI; the publication receipt is recorded in the handoff. No local full build or repeated collection was used.

This checkpoint ends after signed draft publication and handoff. Do not start another watch, PAPER run, live transaction or recovery refinement from this report.
