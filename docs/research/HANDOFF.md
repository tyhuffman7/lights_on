# Lights On handoff — 2026-09-23

## Completed checkpoint: dormant $5 live readiness — NOT READY

**Stop.** The authorized implementation, official API/settlement review, single read-only watch, verification and signed scoped draft publication are complete. No real order, preview/cancel mutation, live activation, PAPER-store access, settlement, merge, force-push or mapping expansion occurred. Do not repeat the watch or earlier paper/recovery studies. A new exact-pilot authorization is still required, after the substantive blockers are resolved.

[Final readiness report](../pilot/TINY-LIVE-READINESS-20260923.md) · [Sanitized watch results](../pilot/tiny-live-watch-results-20260923.json) · [26-route live review](../pilot/tiny-live-settlement-review-20260923.json) · [API validation](../pilot/TINY-LIVE-API-20260923.md) · [Methodology](../pilot/TINY-LIVE-METHODOLOGY-20260923.md) · [Disabled configuration](../../config/tiny-live-pilot.disabled.json)

- Raw monitoring rotates within eight 8 MiB segments; protected decisions have a separate fsynced 64 MiB journal. Actual resource exhaustion fails closed. The synthetic test exceeded 256 MiB and retained protected evidence through eviction.
- Dormant Kalshi V2 / PM-US app FOK adapter supports exact one-contract payloads, offline signatures, actual IDs/fees, retained replies and unknown states. A separate live ledger enforces the $5 cap, one lifetime entry attempt, one reducing recovery attempt, no proceeds reuse and hard stops on unknown exposure or realized loss. The literal build gate and config remain **false**.
- Review: **0 LIVE_EQUIVALENT, 19 LIVE_BLOCKED, 7 UNRESOLVED**. No CONDITIONAL paper route was promoted.
- One watch: **2026-09-23 16:16:26.845–16:36:26.679 UTC**, 19m59.834s; original deadline, clean supervisor exit 0. All 52 subscribed books arrived. Twenty-three routes had legal one-contract depth; three had no priceable paired depth. Three fee-positive diagnostic episodes confirmed at one contract with **$0.01 modeled fee-net surplus each**, −$0.01 after separate risk. **Zero equivalent opportunities or live attempts.** No reconnects, clock faults or storage faults.
- Retained 26,216,174 raw bytes in four segments and 239,040 protected bytes / 86 records. All segment/chain hashes, freeze and **148 runtime source hashes** verified before post-run edits. Private evidence stays in ignored `work/tiny-live/`.
- Post-run correction uses the confirmation API's `window.endedAt`; executed diagnostics added an extra false timestamp blocker. Original evidence is preserved and disclosed; book acceptance/economics and NOT READY are unchanged. No rerun. Final freeze also explicitly rejects unreviewed fee overrides; all executed routes had reviewed/no-override status.

Verification: **69 distinct targeted local tests**. Executed revision `32a1586` passed [718 tests, typecheck and build](https://github.com/tyhuffman7/lights_on/actions/runs/35887401127). Final code revision `8155faf` passed [720 tests, typecheck and build](https://github.com/tyhuffman7/lights_on/actions/runs/35890444671), zero failures/skips. No tests, builds or CI polling occurred during collection. Scoped privacy check found no venue credential literals or private paths in outgoing files.

Remaining blockers: settlement equivalence; current confirmed equivalent economics; Kalshi active-status initialization/cache proof; Ohio/account eligibility and write capability; fresh complete account/inventory/execution/cash reconciliation; account-specific fractional-fill fee bounds; verified short lockup; isolated execution admission on an equivalent candidate and actual order/fresh-fill recovery evidence; separate exact-pilot authorization/arming. Read-only account endpoints responded, but private account details/balances are not public artifacts. PAPER Julia/Oregon/White Sox holdings and historical unknown exposure remain untouched.

## Location and publication

Signed non-main [draft PR #16](https://github.com/tyhuffman7/lights_on/pull/16), base `codex/streaming-culture-dispersion` (#15). Final code is `8155faf`; the final report publication adds only docs/evidence/handoff. Checkout: `/private/tmp/lights-on-live-readiness-20260923`, branch `codex/tiny-live-readiness`. The primary checkout stays on main; preserve all unrelated staged/unstaged work. Only its short handoff is refreshed for this checkpoint.

GitHub operations must use **tyhuffman7 only**. Origin: `https://tyhuffman7@github.com/tyhuffman7/lights_on.git`. Signing: primary repo-local `.git/codex_tyhuffman7_signing` via `/usr/bin/ssh-keygen`; never 1Password, another account or disabled signing. All scoped commits are SSH-signed and locally verified. No merge or force-push.

Evidence manifest SHA256 `74476b5ab54e214140d069d3506ed6a23c052c659bce4169f3c84de902310fd7`; freeze SHA256 `a0bbf07f9d44bdb6e2d73ec51788f1dad66f95e550660f005e404e5a3e33d39f`; protected-chain digest `e0abcefcdc068a7b0fb933119277d2f8ac4ca852ae5796107dab033dce9aaf9e`.

**Next action: stop and review the report; no launch command is authorized.** If revisiting publication, use a compact check, not another market run:

```sh
gh pr view 16 --repo tyhuffman7/lights_on --json headRefOid,isDraft,statusCheckRollup
```

Earlier complete streaming evidence remains under `/private/tmp/lights-on-streaming-20260923`, signed head `c40f52c`, [draft #15](https://github.com/tyhuffman7/lights_on/pull/15). All earlier reports/history remain preserved.
