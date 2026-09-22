# Kansas State conditional paper execution — September 22, 2026

Named authorization: **Kalshi `KXNCAAFB12QUAL-26-KSU` NO / PM-US `aqc-cfb-big12-2026-12-04-champq-kanst` YES**. Classification remains **CONDITIONAL**. The [shortlist review](https://github.com/tyhuffman7/lights_on/blob/92f5ffc2b077bb3e20d3a8f091b2f9994734b763/docs/research/contract-shortlist/REVIEW.md), its evidence and the Kansas/Kansas State corrections are unchanged. PR #9 CI [35686292778](https://github.com/tyhuffman7/lights_on/actions/runs/35686292778) passed for `92f5ffc2b077bb3e20d3a8f091b2f9994734b763`.

This is a separate opt-in PAPER runner. There is no order sender, live approval, account query, universal conditional exemption or change to the legacy taker worker. Ohio live eligibility remains unvalidated and blocks live admission. All cash is simulated. International Polymarket is excluded.

## Frozen experiment

- $100 total capital, $50 per venue; one entry attempt, at most one resulting position, $12 maximum combined reservation. Existing whole-quantity comparison chooses the largest modeled fee-bound surplus among legal quantities through ten, breaking ties toward smaller size. No historical offer is supplied to the runner.
- Existing fees: refreshed Kalshi quadratic coefficient 700 and PM-US coefficient 695, with existing whole-contract/cent-precision Kalshi fragmentation bound and PM cumulative-order rounding. Account precision and fractional fragmentation remain unknown; the bound is conditional on this model, not actual collected commissions. No rebates.
- Separate 2¢ risk allowance per pair; admission still requires at least 10¢ surplus **after** this allowance and at least 1% ROI. Reserve principal, modeled fees, risk cash and recovery cash before either submission. Recovery cash remains 1¢/contract Kalshi and 5¢/contract PM-US; it is a reservation, not an expense. No spending of locked future payouts.
- Only this named 2026 qualification horizon is permitted. Neither the December 4 game nor administrative close/expected-expiration fields guarantee cash release.
- One supervised observation window, at most 30 minutes, no restart. At most 60 paired requested-book checks, spaced by at least 30 seconds; only the named markets are subscribed. Metadata/status/fees/ticks are refreshed each cycle. Feed, lifecycle, resource or material metadata faults stop or block the attempt. Completion/recovery grace is at most 15 seconds. There are no new entries after submission and no extension, replacement market or parameter adjustment.

## Execution and evidence

The working `ConfirmationFeed` / requested Kalshi snapshot and correlated new PM-US subscription paths provide book proof. The existing 1,500 ms response, 250 ms processing, 2,000 ms proof age/cross-venue and clock/version safeguards remain. Old transaction timestamps on quiet, newly confirmed books are retained, rather than misrepresented as fresh market changes. Snapshot round-trip is recorded separately and is **not measured order latency**.

Kalshi status remains UNRESOLVED. Only `STATUS_CACHE_CURRENTNESS_UNPROVEN` and `NON_ATOMIC_INITIAL_STATE` may be carried as an explicit **active-status assumption**, when metadata reports active and lifecycle/books are healthy. Known closure, deactivation, contradictory evidence, cached baselines, missing acknowledgements, metadata-change events and feed faults cannot use this exception. PM-US must report open/tradable metadata and an open confirmed book. This never establishes proven active status or enables live admission.

Both legs are independent marketable-limit **fill-or-kill (FOK)** orders in the depth model. The official [Kalshi V2 schema](https://docs.kalshi.com/api-reference/orders/create-order-v2) and [PM-US create schema](https://docs.polymarket.us/api-reference/orders/create-order) support FOK; the [PM-US order guide](https://docs.polymarket.us/concepts/orders) defines complete fill or cancellation. These documents are fetched before freezing. No API order is sent. FOK excludes a partial individual order in this model; one filled venue and one failed venue is retained as partial pair exposure.

After admission, quantity, each leg's worst consumed price ceiling, entry budget, recovery reserve, risk cash, FOK semantics and submission/arrival times are frozen and journaled. Both independent arrivals use the 500 ms modeled transport baseline. Each callback selects only evidence processed by its modeled arrival; evidence received later is never used retroactively. An unusable/missing arrival book, clock fault or late processing is inconclusive and keeps the unresolved reservation. Depth or price changes can cancel one leg while leaving the other filled. No instantaneous first fill or cross-venue atomicity is assumed.

If exactly one leg modeled a fill and the other definitely canceled, one delayed same-venue FOK sell may reduce that inventory. Wait at least one second, obtain fresh requested-book evidence, freeze a sell floor no more than 5¢/contract below average entry price, then model another 500 ms transport delay. Recovery fees must fit the original venue recovery reserve. Insufficient depth, fee cash, limit support or evidence leaves exposure intact; no repeated recovery or new hedge purchase. Realized recovery loss includes entry and sell fees. Synthetic recovery tests prove accounting behavior, not venue execution.

Paper accounting reuses the existing state, journal log, cumulative-depth walker and fee routines. The scoped reservation/accounting functions debit each leg separately, preserve unknowns, and leave paired inventory open. Risk allowance is reported separately and is not charged as a fee. A paired holding's ordinary-outcome surplus is conditional and **unrealized**. There is no forced settlement or recycling.

## Divergent payout scenarios

Purchased NO+YES pays `1-k+p` per pair, where `k` and `p` are the venues' affirmative payouts. Ordinary qualification/elimination yields $1 only when those payouts agree. Cancellation can give Kalshi allocation `r` and PM fair payout `f`, totaling `1-r+f`. Withdrawal and reinstatement differ: Kalshi withdrawal/elimination can remain No after re-entry, while PM can use fair price or recognize reversal. Different correction cutoffs can yield `k=1,p=0`, hence **zero**. Separate expiration and review processes can also delay one venue's cash after the other settles. These are scenarios, not claimed outcomes or probabilities.

The current Kalshi qualification PDF, PM-US AQC filing and PM-US rulebook must retain the reviewed document hashes. Normalized identity, terms, fees and quantity metadata must match the retained KSU pair. Changed documents/terms stop with the difference; new approval is not inferred.

## Verification and run status

Before collection, **34 focused tests passed** across the new synthetic scenarios and the existing requested-book, integrated-confirmation and depth-discovery tests. Full tests/typecheck/build belong to hosted CI. No tests/builds or repeated CI polling occur during collection. Synthetic cases remain separate from fresh market observations.

**Collection stopped, no entry.** The single window ran **05:12:07–05:35:13 UTC (23m 05.929s)** and stopped on **PM-US feed disconnection**, before the 30-minute maximum. The supervisor exited normally; this is a censored observation window, not proof of absence during the remaining time. No restart or extension occurred. All **45** paired requested-book checks before the stop confirmed books; none passed economic admission. [Sanitized results](ksu-paper-results-20260922.json) preserve exact times, quantity comparisons, fees, assumptions and evidence hashes. All 128 frozen source files remained unchanged during collection.

The repeated confirmed offers were **84¢ Kalshi NO / 15¢ PM-US YES**. Every legal whole quantity from one through ten failed the retained economics. The existing comparison selected one contract as the least-negative fee-bound result: 99¢ principal, 1¢ modeled Kalshi fee and 1¢ modeled PM-US fee, giving **−1¢ ordinary-outcome surplus**; the separate 2¢ allowance makes **−3¢ after risk**. Its hypothetical reservation would have been $1.09 (87¢ Kalshi, 22¢ PM-US), including 1¢/5¢ recovery cash. These are observed pricing calculations, not a submission plan or executed trade. Repeated snapshots are not additional opportunities or trades.

| Execution/accounting item | Result |
|---|---|
| Frozen entry plan / planned execution prices and quantity | None: admission never passed |
| Modeled executed prices / quantities | None / zero on both venues |
| Entry attempts / positions | 0 / 0 |
| Fees charged / risk cash reserved / recovery cash reserved | $0 / $0 / $0 |
| Total actual reservation / residual inventory | $0 / zero on both venues |
| Ending simulated cash | $50 Kalshi + $50 PM-US |
| Recovery / recovery loss | Not attempted / none |
| Conditional unrealized surplus / realized profit | No holding / no profit claim |

No arrival or recovery was exercised with fresh market evidence, so fresh-fill execution and recovery remain **unproven**. Synthetic tests remain separately labeled. The final Kalshi status provenance is still UNRESOLVED; the named active assumption never repaired the PM-US disconnect.

**Publication and hosted CI are pending.** The scoped files are prepared on `codex/ksu-conditional-paper`, based on PR #9. The existing 1Password signer was unavailable; the user will unlock it later. No unsigned commit, signing-setting change, push or PR was made, and no full CI run for this integration was started. The 34 focused tests above passed before collection. Publication must inspect the completed outgoing commit after signing, then push normally and create the authorized draft PR with base `codex/contract-reviewed-shortlist`.

Raw public evidence, environment, credentials, private account data and databases are excluded from publication. The single-use local evidence and isolated paper journal remain intact. A sandbox-only DNS failure during preparation occurred before observation; its abandoned preparation marker is preserved separately. It was not a second observation window.

Reproduction requires a separately authorized new checkpoint; these commands are not permission to repeat this one:

```sh
node --experimental-strip-types worker/ksu-paper.ts prepare NEW_DIRECTORY
node scripts/ksu-paper-launch.mjs NEW_DIRECTORY ENV_FILE
```
