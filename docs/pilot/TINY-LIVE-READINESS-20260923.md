# Tiny live-pilot readiness — September 23, 2026

**NOT READY.** No live order was enabled, submitted, previewed or canceled. The maximum-$5 configuration remains disabled. No PAPER store was opened or changed, no existing holding was settled, and no earlier paper or category study was repeated. [Draft PR #16](https://github.com/tyhuffman7/lights_on/pull/16) is stacked on #15; no merge or force-push.

| Requested readiness question | Verified answer |
|---|---|
| Is long-running evidence collection sustainable? | **The raw-storage failure is fixed.** Monitoring raw data rotates within 64 MiB; protected decisions have a separate durable budget. A synthetic test exceeded the old 256 MiB ceiling and exercised eviction without losing protected records. The actual watch crossed three segment boundaries without stopping. This is bounded storage validation, not proof of unattended operation indefinitely. |
| Are both order payload paths validated without submission? | **Yes for documented construction, offline signatures and response fixtures.** Both support exact one-contract price-limited FOK, YES/NO orientation and reducing exits. No venue acceptance or real execution is claimed. The literal disabled gate is tested before any network or credential access. |
| Does a LIVE_EQUIVALENT route exist? | **No among the 26 reviewed retained candidates.** 19 LIVE_BLOCKED; seven UNRESOLVED. CONDITIONAL paper routes were not promoted. |
| Was a confirmed positive-after-fee LIVE_EQUIVALENT opportunity observed? | **No.** Three diagnostic routes confirmed a modeled 1¢ fee-net spread at quantity one; none is equivalent, and each fails the separate 2¢ risk allowance. |
| Are execution prerequisites complete? | **No.** Settlement, market status, eligibility, current account/fee/reconciliation, short lockup and isolated live execution/recovery evidence remain blockers below. |
| Classification | **NOT READY** |

## Completed read-only watch

Exactly one run, **16:16:26.845–16:36:26.679 UTC**, **19m 59.834s**, on signed implementation `32a1586`. The original supervisor deadline was preserved; the worker recorded its stop 16 ms after that wall-clock deadline and exited cleanly. No restart, extension, adaptive sizing or fee/threshold tuning occurred.

All **52 subscribed books** arrived across **26 routes**. Twenty-three routes produced legal paired one-contract depth. AGT, Netflix show and weekly Billboard song did not; their lack of priceable depth is not reported as zero opportunity frequency. There were three distinct fee-positive episodes, three requested confirmation pairs and three accepted positive book confirmations. There were **zero LIVE_EQUIVALENT confirmations, zero live entry attempts, zero modeled or actual fills, and zero recovery attempts**. No realized-profit claim is made.

| Exact diagnostic route | Settlement | Quantity per venue | Confirmed surplus after modeled fees | After separate risk allowance |
|---|---|---:|---:|---:|
| Kendrick Lamar annual #1 album | UNRESOLVED | 1 | $0.01 | −$0.01 |
| Oregon State Pac-12 title | LIVE_BLOCKED | 1 | $0.01 | −$0.01 |
| Dario Amodei TIME Person of the Year | UNRESOLVED | 1 | $0.01 | −$0.01 |

These are quote calculations against an assumed common payout benchmark, not demonstrated arbitrage returns. Exact price/depth consumption, fee bounds, reservations and requested-proof timing appear in the [sanitized results](tiny-live-watch-results-20260923.json). No cross-venue atomicity or fill probability is inferred from book confirmation.

Reconnections: **Kalshi 0, PM-US 0**. No clock fault, evidence-write fault or resource stop occurred. Final sockets are closed because the supervisor stopped the watch; that is not in-window downtime. Isolated execution feeds were not exercised: none of the routes passed equivalence.

The writer retained **26,216,174 raw bytes in four segments**, plus **239,040 protected bytes / 86 records**. No raw segment needed eviction in this short watch; repeated eviction was separately exercised in the over-256-MiB synthetic test. All retained segment hashes and the protected chain match the manifest. All **148 runtime source hashes** and the freeze hash matched before any post-run edit. Raw monitoring retention is at most 64 MiB, protected evidence 64 MiB, each record 2 MiB, process RSS 768 MiB and free disk reserve 2 GiB. Actual exhaustion fails closed rather than discarding attempted-trade evidence. Protected history requires reviewed archival at its finite limit.

A post-run diagnostic correction reads successful confirmation time from `window.endedAt`, where the existing confirmation API actually returns it. The executed watch used an absent top-level timestamp and therefore added an extra false “current confirmation required” admission reason. The original record is preserved and explicitly labeled in the sanitized output. Book acceptance, prices, counts and the NOT READY conclusion are unchanged: every candidate already failed settlement and other independent gates. A regression covers current, missing, stale and stopped confirmations. No collection was repeated. The final freeze path also explicitly rejects unreviewed fee overrides; all 26 executed routes already recorded reviewed/no-override status.

## Remaining blockers

1. **Settlement:** no reviewed route has matching ordinary and material exceptional payouts. The [review matrix](tiny-live-settlement-review-20260923.json) binds exact metadata and source hashes. Sports cancellation/postponement/withdrawal allocations, reality-show missing rankings, chart publication/correction windows and award ties remain material. Netflix scope, IPO precedence/cutoff and annual TIME/album terms remain unresolved.
2. **Economics:** no confirmed positive-after-fee equivalent opportunity. The three observed diagnostic positives also fail the separate risk allowance; no profitable $5 pilot is demonstrated.
3. **Current market status:** Kalshi lifecycle/bootstrap initialization and cache-currentness evidence remains unresolved. The earlier paper-only active-status assumption has not been promoted to live.
4. **Eligibility and account capability:** Ohio eligibility, venue eligibility and account write permission need current validation for the exact pilot. Successful authenticated read endpoints do not prove them.
5. **Account state and cash:** require complete fresh order/fill/inventory reconciliation and enough available per-venue cash for the frozen reservations. Private read-only checks do not substitute for launch-time reconciliation; historical PAPER uncertainty remains separate and unchanged.
6. **Fees:** actual account precision/class, fractional fill rounding and collected commission behavior are not established by modeled fee bounds. Preserve observed microdollar fees when returned; never replace missing fees with zero.
7. **Lockup:** no eligible route has a verified short cash-release bound. Administrative close/expiration dates are not settlement guarantees.
8. **Execution and recovery:** actual order acceptance/latency, isolated execution admission on an equivalent candidate, and fresh-fill recovery remain unproven. Deterministic tests cover known no-fill, rejection, partial/unknown outcomes, restart, cap and loss halts but are not real fills.
9. **Authorization:** the user has not authorized the exact live pilot. The build gate, default configuration and adapter remain disabled. A new exact-plan authorization and explicit arming are required after substantive blockers are resolved.

## Delivered safeguards and verification

The [dormant configuration](../../config/tiny-live-pilot.disabled.json) caps total commitment at **$5**, one one-contract pair, one lifetime entry attempt, one sequence at a time and one reducing recovery attempt. It prevents proceeds reuse and stops on unknown exposure or any realized loss. The live ledger is a separate private append-only file with single-writer ownership, fsynced submission intent and retained reply/reconciliation evidence. Even a forged arming config cannot bypass this checkpoint's literal false build gate.

[Current official API review](TINY-LIVE-API-20260923.md) · [Frozen methodology](TINY-LIVE-METHODOLOGY-20260923.md) · [Sanitized evidence](tiny-live-watch-results-20260923.json).

Local verification comprises **69 distinct focused tests**, including the reply-retention and post-run admission regressions. Hosted validation of the executed revision passed **718 tests, typecheck and production build**, with no failures or skips: [executed-revision CI](https://github.com/tyhuffman7/lights_on/actions/runs/35887401127). No tests, build or CI polling occurred during collection. Final code revision `8155faf` passed **720 tests, typecheck and production build**, with zero failures or skips: [final-code CI](https://github.com/tyhuffman7/lights_on/actions/runs/35890444671). Publication receipt is in the handoff and draft checks.

**Checkpoint complete; stop.** Do not repeat the watch or enable orders. Resolve the listed evidence gaps only under a new scoped instruction; this report is not a recommendation to launch.
