# Practical bounded-basis checkpoint — 2026-09-23

The strategy now researches profitable cross-venue trades with explicitly reviewed settlement basis risk. `TINY_LIVE_BOUNDED_BASIS` admits economically complementary ordinary payouts with enumerated exceptional differences. It does **not** claim risk-free arbitrage. Orders, previews, modifications and cancellations remain disabled for this checkpoint; a candidate is an approval artifact, never a submission authorization.

## Result

The dominant blocker is **unproven current Ohio/account/product trading permission**, particularly PM-US's current account-level trading entitlement. Authenticated account reads succeeded on both venues; successful reads do not establish this entitlement. Because the user explicitly required resolving eligibility before starting the watch, **no watch was started**. This is a prerequisite stop, not a failed opportunity search.

| Requested result | Verified result |
|---|---:|
| Ohio/Kalshi/PM-US trading prerequisites resolved | No |
| ECONOMICALLY_EQUIVALENT, without a documented residual mismatch | 0 |
| BOUNDED_BASIS with proven ordinary complementarity | 2,852 |
| INCOMPATIBLE / UNRESOLVED | 63 / 205 |
| Routes actually monitored in this checkpoint | 0 |
| Current monitorable routes | Not measured; saved catalog is not current inventory |
| Positive-after-fee episodes | Not measured; watch did not start |
| Requested-book survivors | Not measured; no live confirmation requested |
| Complete ≤$5 approval candidate | None |

[Classification aggregate](classification.json) reclassifies the pinned private PR #17 audit, whose SHA-256 is checked against its published aggregate. There is no new matcher run, mapping, family study, PAPER experiment, price selection or tuning. The 3,120-route universe is preserved. [PR #17's historical evidence](../settlement-families/README.md) remains unchanged.

The unchanged counts are meaningful: PR #17 already compared canonical ordinary payout predicates rather than literal prose. Every reviewed family retains at least the independent venue-finality exception. Relaxing exceptional identity makes 2,852 routes eligible for the candidate pipeline without erasing those exceptions or relabeling them as exact.

## Evidence collected privately

Fixed authenticated GETs retrieved current available cash, positions and open orders on each venue, plus recent history. Pagination completed, and both account snapshot schemas normalized successfully. Kalshi's current key was found with a trading-write scope and a current API region attestation. No private amounts, positions, identifiers, raw responses, key material or fee-history records are included here. These snapshots are observations, not an assertion that external holdings belong to the pilot or that pilot inventory has been reconciled.

The [Kalshi key endpoint](https://docs.kalshi.com/api-reference/api-keys/get-api-keys) exposes scopes and a region-attestation expiry, not a current Ohio/product permission decision. API throughput tier is not a fee tier. The [PM-US retail authentication guide](https://docs.polymarket.us/api-reference/authentication) describes verified onboarding and API-key access, but its documented retail account endpoints expose balances, positions and activities, not a current product permission flag. Its institutional account endpoints use a different authentication/account model and were not treated as retail entitlement evidence. The [trading restrictions page](https://docs.polymarket.us/learn/trading/access-and-limits/trading-restrictions) does not establish the requested Ohio determination. No signed-in venue browser session was available in the connected browser inventory.

**Exactly what is missing:** current first-party evidence that these accounts may enter the intended products from Ohio, including PM-US's active trading permission. A venue-issued account/product confirmation or an available authenticated read-only permission view can resolve it; an actual order is not the proof mechanism. No claim is made that either account is prohibited. No support message was sent and no permission or location setting was changed.

Current account-specific fee tier/precision was not exposed by the available retail status reads. Historical fee fields were retained privately and not promoted to a current fee schedule. Fee code supports a documented conservative bound, so a real fill or exact commission observation is not required before a pilot.

## Admission and economics

The new policy is in `lib/pilot/bounded-basis.ts`; the public disabled configuration records the same caps. It accepts ECONOMICALLY_EQUIVALENT or BOUNDED_BASIS only after the existing independent proofs establish entity/event, ordinary outcome, statistic/threshold, orientation, window, geography, ordinary source and family-specific dimensions. Names and sentence structure need not match. Regulation versus overtime, qualifier versus champion, ranking scope, different windows and other ordinary conflicts still reject; missing material proof remains unresolved.

Review evidence is bound to exact market metadata hashes and pinned source documents. Every exceptional mismatch must have a unique, current, explicit CLEAR review with evidence. Unknown or indicated exceptions reject. A current normal-event-state check is also required for routes without residual mismatches. Short lockup is preferred (72 hours); a long nominal close time is not an invented settlement guarantee.

Quotes compare every supported whole paired quantity allowed by visible depth and the $5 cap. The current paired model conservatively floors fractional depth at each level; it does not assume unsupported fractional PM-US order sizing. Quantities above one or ten are not arbitrarily excluded. Quotes rank by conservative fee-net dollars, then capital efficiency, then earlier expected release. Whole quantities remain bounded by actual cheapest prices, available depth, fees and commitment rather than an arbitrary size study.

Each leg's maximum debit uses its last consumed limit price for all units, with the maximum applicable quadratic fee up to that price. This covers depth moving within a frozen marketable limit. The observed level costs are retained separately. Ordinary payout minus maximum entry debit is the reported conservative fee-net profit. **The old 2¢/contract cushion is absent.** One reducing unwind fee reserve is included in total commitment, and cash must be available on either venue to support that venue's reducing unwind. Because only one reducing sequence is allowed, the combined commitment reserves the larger of the two alternatives. Recovery capacity is not subtracted from ordinary profit. No tail probability or dollar penalty is invented.

[PM-US's current public fees](https://docs.polymarket.us/fees) give a 0.0695 taker coefficient and a cumulative aggressive-order commission cap. The policy conservatively rounds the cumulative quadratic fee upward to cents and gives no rebate credit. Route-specific current fee evidence remains required.

[Kalshi's rounding rules](https://docs.kalshi.com/getting_started/fee_rounding) distinguish direct-member and non-direct balance precision and microdollar fee rounding. The bound allows fragmented fills, discards all rebates, and adds the maximum rounding cost per possible fill. With unknown account precision it uses the larger cent grid; a direct-member bound requires evidence, never inference from a balance. The [documented 0.01-contract minimum granularity](https://docs.kalshi.com/getting_started/fixed_point_migration) limits possible fill count. This is a valid but potentially economically prohibitive upper bound, not a new estimate of settlement risk. A current precision determination could tighten it without needing a real fill.

## Confirmation boundary and limits

`worker/bounded-basis-confirmation.ts` reuses the existing persistent-book/requested-WebSocket proof implementation. It requests fresh books through isolated execution feeds, refreshes account reconciliation concurrently, checks both returned book versions against the latest streams, and reprices the **original exact quantity** under the frozen fees. It rejects downsizing, changed identity/fees, stale proof, closed markets, unhealthy feeds, account uncertainty and a stopped watch. Its output freezes the route, quantities, limit prices, maximum debit, fee bounds, ordinary payout, conservative profit/return, lockup, residual exceptions and requested-book evidence hash.

No observation session or expanded watch supervisor was started or certified here: the admission prerequisite failed first. The historical 20-minute readiness worker is unchanged and is not a launcher for this new policy. The disabled policy records at most 90 minutes and the existing proven 60-route resource ceiling for a later supervised watch, conditional on resolving the missing permission. Fresh route reviews, status and exception evidence must be rebound before that watch; historical catalog counts are not a current shortlist.

The live adapter/build gate and durable one-attempt execution ledger remain untouched and disabled. The new policy does not consume an attempt or reserve real funds. All candidates require separate exact-trade authorization. Limits remain $5 cumulative commitment, one paired position, one lifetime attempt, one execution/recovery sequence, no proceeds reuse, immediate halt on unknown exposure, halt after any realized loss and no second trade without separate authorization.

Actual order acceptance, venue latency, fill behavior, returned commissions, submission sequencing, one-leg failure and recovery-if-needed are pilot learning objectives. None is required to have already succeeded before the first pilot. Unit fixtures exercise policy behavior; they are not PAPER trades, recorded market opportunities or evidence of live execution.

## Verification and reproduction

Targeted tests cover semantic paraphrases and ordinary conflicts, fractional-fill fee bounds, sub-2¢ positive economics, depth/limit commitment, all supported affordable quantities, stale permissions, unknown exposure, lifetime limits, exact confirmation quantity, missing proof and disabled submission. Hosted CI supplies the full test/typecheck/build result; see the handoff for the final receipt.

```sh
node --experimental-strip-types --test tests/bounded-basis.test.ts tests/account-read.test.ts tests/family-settlement.test.ts
node --experimental-strip-types worker/practical-settlement-audit.ts /absolute/path/to/reviewed-private-route-audit.json work/bounded-basis
```

All raw account evidence and source downloads stay in ignored private work directories. Only code, synthetic tests, methodology, public-source hashes, classification counts and this explicitly unrun watch result are published. Stop at this checkpoint.
