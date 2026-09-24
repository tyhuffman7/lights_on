# Handoff — 2026-09-23 EDT, bounded candidate watch complete

**READ ONLY; live orders remain disabled. The authorized two-hour watch is complete and stopped at its original deadline.** No order, preview, cancellation, PAPER experiment, new mapping, recovery refinement or session extension occurred. No candidate was frozen. Do not restart this run or the old eligibility-gated readiness watch.

## Verified state

- Isolated checkout `/private/tmp/lights-on-bounded-basis-20260923`, branch `codex/bounded-candidate-watch`, based on PR #18 head `4ddc216d74c4c5f25a3ed19b93180253fae37804`. Primary `main` staged/unstaged/untracked work preserved; only this short handoff is refreshed there. GitHub identity `tyhuffman7`; repo-local SSH commit signing preserved.
- Watch: **2026-09-23 22:23:17.918 UTC–2026-09-24 00:23:17.485 UTC**, 7,199.567 seconds, `ORIGINAL_DEADLINE`. Supervisor exited 0 after flushing/verifying evidence. The observer and supervisor exited; no collection remains running.
- **2,852 / 2,852 routes visited; 2,558 actually monitorable (2,326 sports + 232 non-sports); 77.165648 usable route-hours.** Positive-after-fee episodes **0**; requested candidate confirmations **0**; confirmed positives **0**. Eligibility never gated monitoring.
- Dominant reason: raw spreads occurred, but the existing unknown-precision Kalshi fractional-fill/no-rebate fee bound consumes at least the ordinary paired payout before purchase prices. No fee-net candidate can qualify under it. This is not a finding that actual fees erase every spread. Parameters were frozen; no tuning or extension occurred.
- [Complete result](candidate-watch/README.md) · [sanitized aggregate/source manifest](candidate-watch/result.json) · [methodology](candidate-watch/METHODOLOGY.md) · [specific account/eligibility evidence limits](candidate-watch/ELIGIBILITY.md).
- Zero failure reconnects and resource faults. Rotating evidence retained eight monitoring segments; 18 older segments rotated. The 3,543-record protected evidence chain was verified against its final manifest. All raw/authenticated data remain private.

## Remaining blockers / next action

No positive confirmed economics, so no pilot satisfies every non-eligibility prerequisite. Current Kalshi and PM-US Ohio/account/product permission, and PM-US active trading entitlement/write capability, remain unproven. Kalshi key write scope and current region attestation were observed; neither establishes the missing product permission. Account-specific Kalshi precision remains unknown.

Stop here. A separately scoped follow-up can obtain current first-party precision/product-permission evidence. Do not start another watch, repeat completed no-fill recovery, consume the lifetime attempt or enable trading. A live launch and exact trade require separate authorization.

## Private evidence / commands

Private session: `/private/tmp/lights-on-bounded-basis-20260923/work/candidate-watch/session/`; account responses: sibling `work/candidate-watch/private/`. Preserve both and the prior bounded-basis/family-matrix evidence. The single-use start/launch markers prohibit restarting this session.

Offline affected tests (already **30/30 passed** before collection):

```sh
node --experimental-strip-types --test tests/candidate-watch.test.ts tests/bounded-basis.test.ts tests/segmented-evidence.test.ts
```

Sanitized result regeneration after a stopped, no-candidate session:

```sh
node scripts/summarize-candidate-watch.mjs work/candidate-watch/session docs/research/candidate-watch
```

[Draft PR #19](https://github.com/tyhuffman7/lights_on/pull/19) is OPEN/DRAFT by `tyhuffman7`, stacked on `codex/tiny-bounded-basis`. Signed observed implementation `c474ce4fee429e9a8f9cf67b9ec722a18f58ce4e` preserves the exact run source. A post-run candidate-label ordering correction produced signed code head `20cdd631e29ec4e97ef8f628408825734b771926`; no candidate occurred and collection was not restarted. **759/759 full tests, typecheck and production build passed** in [CI 35938749888](https://github.com/tyhuffman7/lights_on/actions/runs/35938749888); 26 affected tests also passed after the correction. See [verification receipt](candidate-watch/verification.json). A documentation-only receipt commit follows. No merge or force-push occurred. Checkpoint stopped.
