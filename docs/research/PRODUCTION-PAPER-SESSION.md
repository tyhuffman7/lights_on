# Production-like PAPER session — September 22, 2026

**Stopped early under the frozen reconnect guard; the full two-hour duration was not achieved.** Actual worker collection: **19:49:30.670–21:05:51.360 UTC, 76m 20.690s**. Original supervisor deadline: 21:49:30.483 UTC. Two PM-US disconnects were rebuilt. At stop, both feed-health checks required rebuilding; two additional per-venue reconnects exceeded the one remaining allowance. The saved final diagnostic list is empty: socket closure versus stale pong evidence is not distinguished, so a physical dual-venue disconnect is **not proven**. Supervisor exit 0 means a clean guarded stop, not completion of two hours. No restart, extension or tuning followed.

Signed executed head [`9096392`](https://github.com/tyhuffman7/lights_on/commit/90963927f8f40169a058a010df29134fee48ca0c), [draft PR #12](https://github.com/tyhuffman7/lights_on/pull/12). [Sanitized derived results](production-paper-results-20260922.json). PAPER ONLY; live policy unchanged and real orders disabled. GitHub reports this SSH-signed commit as unverified (`unknown_key`); no signing or security settings were changed.

## Actual observations and executions

All 34 retained comparisons refreshed without a material-terms block. The 6,081 comparison-content states include repeated/rebuilt books; they are not independent opportunities. Distinct valid fee-positive routes: **4 reviewed** (Julia, Oregon State, White Sox, Kansas State) and **15 shadow**. Julia/Oregon were already held; Kansas State became positive after the strategy halt. The Oregon Big Ten qualification shadow route became positive after the shadow cap and was not confirmed or executed.

| Measure | Strategy, additional only | Execution-only shadow |
|---|---:|---:|
| Requested confirmation pairs | 1 | 20 |
| Successful positive requested confirmations | 1 | 20 |
| Attempts / distinct executed routes | 1 / 1 | 20 / 14 |
| Paired modeled fills | 0 | 20 |
| Known one-leg failure (FILLED + NO_FILL) | 0 | 0 |
| Both legs no-fill | 0 | 0 |
| Inconclusive attempt | 1 | 0 |
| Recovery attempts / realized recovery losses | 0 / $0 | 0 / $0 hypothetical |

The 20-attempt shadow cap was exhausted in the first 19 minutes. Later streamed observations did not reopen it. Shadow results have **zero strategy cash/inventory effect**, no complementary-settlement assumption and no profit attribution. Repeated routes required the predeclared material price/depth/quantity change; the twenty attempts are not twenty independent routes.

**Strategy halt:** one White Sox pair was selected and confirmed at quantity **one**, Kalshi NO 91¢ / PM-US YES 7.8¢. Modeled fees were 1¢ / 0¢; ordinary-outcome fee-net surplus was **$0.002**, reserved risk cash **$0.02**, separate analytical net **−$0.018**, total reservation **$1.078**. At the independent 500 ms arrivals, PM-US modeled one fill with a **$0.078 debit**. Kalshi was **INCONCLUSIVE** (`INGRESS_BACKLOG`, `LATEST_INGRESS_BACKLOG`). Its $0.94 reservation was retained; PM-US retained $0.06 risk/recovery cash. Unknown inventory was never converted into a no-fill. The existing recovery rule requires a known FILLED/NO_FILL pair, so no recovery was attempted. Strategy entries halted at 19:58:19 UTC and stayed halted through reconnections.

## Capital, holdings and lockup

The exact Julia and Oregon State debits, plans, fills, risk/recovery reserves and conditional classifications survived reconciliation against the source challenger. No entry was replayed, no holding was settled, and no locked cash was recycled. The source journal hash is unchanged.

| Holding | Preserved quantities | Entry debit | Risk cash | Recovery cash | Conditional fee-net surplus | After separate analytical risk estimate |
|---|---:|---:|---:|---:|---:|---:|
| Julia Stiles | 7 per venue | $6.78 | $0.14 | $0.42 | $0.22 | $0.08 |
| Oregon State | 10 per venue | $9.88 | $0.20 | $0.60 | $0.12 | −$0.08 |
| White Sox | 1 PM-US modeled; Kalshi unknown, at most 1 planned | $0.078 known | $0.02 allocated within held cash | $0.06 allocated within held cash | Unresolved; none booked | Not applicable |

**End capital:** $46.890 Kalshi + $34.012 PM-US = **$80.902 free**; **$19.098 committed** (original $18.02 plus $1.078). Free cash + accounted debits/reserves = original **$100**. Two paired holdings plus one unmatched/uncertain attempt remain. Realized paper profit and loss are both **$0**; that does not value or resolve the uncertain exposure. The existing pairs retain **$0.34 conditional unrealized surplus**, exactly offset by their separate $0.34 analytical risk allowance. Risk cash remains reserved even though it is no longer an admission deduction.

At stop Julia had been held 5.320 hours, Oregon 3.220 hours, and the White Sox exposure 1.126 hours. Current metadata gives illustrative later-of-two-venues dates of **December 31** for Julia, **December 19** for Oregon and **November 6** for White Sox, approximately 100 / 87 / 45 days from this session’s metadata. These are expected/admin horizons, **not cash-release promises**. Kalshi latest dates include January 7, 2027 / January 3, 2027 / October 31, 2028 respectively. Earlier elimination, cancellation, correction and venue-specific settlement can change timing or payout. No short-capital recycling was demonstrated.

## Execution evidence and any future cushion

Across **42 modeled entry-leg arrivals**, **41** had usable price/depth evidence. Every usable quantity-weighted arrival price and modeled entry debit matched confirmation: observed min/median/max movement **0 / 0 / 0**. The Kalshi White Sox observation is excluded from those statistics despite its last displayed price being unchanged, because its arrival evidence was inconclusive. No known one-leg no-fill or recovery outcome was observed.

This is a larger **displayed-depth execution sample**, not a fill-probability estimate or evidence of repeatable net profit. Attempts share routes/time and impose no real market impact. No percentage success forecast, loss probability or empirical cushion is fitted.

A future cushion would need evidence for (1) arrival movement and FOK failure when frozen price limits are exceeded, (2) known failed-leg recovery cost and the separate problem of unknown execution, and (3) actual fee-model error. This sample supplies no adverse-price or recovery-loss distribution. A wider numeric cushion would not repair missing arrival evidence. Actual commissions/account precision were not observed: the Kalshi whole-contract cent-precision fragmentation bound and PM-US cumulative-order estimate retain their existing uncertainty. The White Sox quoted surplus was only 0.2¢, so fee-model uncertainty matters even when modeled fees are positive-net. No new cushion or live policy was introduced. Fresh-fill recovery remains unproven.

## Next deep-review candidates, not execution approvals

Four observation-only routes met the predeclared repeated-positive-confirmation criterion in this session. None received deep review here. All retained positive later displayed observations before stop; those later observations are **not new requested confirmations**. Reconfirm current economics in any future checkpoint. No fifth route met the repeated-confirmation requirement, and no short practical cash-release period was established.

| Review order / route | Positive confirmations | Confirmed quantities | Median / maximum fee-net displayed spread | Indicative horizon |
|---|---:|---:|---:|---:|
| Dario Amodei — TIME Person of the Year (`KXTIME-26-DAR`) | 2 | 10 | $0.23 / $0.23 | ~114 days |
| Elon Musk — TIME Person of the Year (`KXTIME-26-EM`) | 2 | 10 | $0.05 / $0.05 | ~114 days |
| Benjamin Netanyahu — TIME Person of the Year (`KXTIME-26-BEN`) | 4 | 2–10 | $0.04 / $0.04 | ~114 days |
| Kendrick Lamar — #1 album (`KX1ALBUM-26DEC-KEN`) | 2 | 2–3 | $0.025 / $0.04 | ~109 days |

These are arithmetic fee-net displayed spreads against the comparison benchmark, not arbitrage returns. Their unresolved settlement equivalence must be reviewed before any strategy admission. Exact PM-US route identifiers, source times, confirmation times, final displayed observations and indicative capital-day metrics are in the sanitized result.

## Frozen policy and verification

One strategy ledger continued the challenger; no A/B or fresh bankroll. Strictly positive modeled fee-net surplus, zero additional admission margin, unchanged 2¢/pair risk and all recovery cash; 1–10 exact whole contracts, $15 new reservation, $45 commitment, three paired positions, five additional attempts, $2 realized-loss or unresolved-exposure entry stop. Strategy confirmation priority; one execution/recovery sequence at a time. Rank current fee-net dollars, then capital efficiency; within 10% of best dollars prefer the shorter evidenced indicative horizon. Shadow ≤20 attempts, 1¢/leg or one executable contract or 25% (minimum one contract) depth change for repetition; ≤4 confirmation cycles/route, 60-second route spacing, ≤120 cycles overall, two-second requested-book spacing. Three per-venue reconnect allowances, original 7,200,000 ms ceiling, 256 receipts/market and 256 MiB evidence cap. The original full plan remains in signed implementation history.

**Before collection:** 42 focused synthetic tests; [hosted CI](https://github.com/tyhuffman7/lights_on/actions/runs/35775891650) passed **608 tests, typecheck and build** on executed head `9096392`. No tests, builds or CI polling during collection. **After stop, before source edits:** all **136 frozen files** matched; source journal SHA-256 `45a1058025bdef7f87f39481b94667c4c367fa8a127c7d9d5a9ec4a468c8d25a` matched; original holdings and $100 cash conservation reconciled. Raw evidence is 39,611,906 bytes and remains private with stopped supervisor, journals, freeze and receipts under ignored `work/production-paper-20260922/`. Public output excludes raw books/tape, databases, credentials, environment files, private account data and unrelated work.

**Checkpoint stopped.** Review this draft and the unresolved arrival/transport evidence before authorizing another checkpoint. No rerun, recovery refinement, deep review, merge or live launch is included.
