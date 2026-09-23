# Lights On handoff — 2026-09-23

## Active authorized checkpoint: dormant $5 live readiness

The user authorized evidence-retention hardening, disabled real-order adapters, current official API validation, strict live settlement review, one bounded read-only watch and signed scoped draft publication. **No real order, order preview/cancel POST, live activation, PAPER mutation, merge, force-push or mapping expansion is authorized.** The earlier paper/streaming checkpoints remain complete and must not be repeated.

Isolated checkout: `/private/tmp/lights-on-live-readiness-20260923`, branch `codex/tiny-live-readiness`, based on signed `c40f52c` / draft #15. The primary checkout is main with unrelated staged/unstaged work; preserve it. GitHub must use `tyhuffman7` exclusively; origin is `https://tyhuffman7@github.com/tyhuffman7/lights_on.git`. Signing uses the primary checkout's repo-local `.git/codex_tyhuffman7_signing` via `/usr/bin/ssh-keygen`, never 1Password or disabled signing.

Implemented: bounded raw evidence rotation plus durable protected decision journal; dormant Kalshi V2/PM-US app FOK payload/signing/reply paths; separate one-attempt live ledger; strict LIVE-ADMISSION gate; disabled $5 configuration; bounded watch. Read [methodology](../pilot/TINY-LIVE-METHODOLOGY-20260923.md), [API validation](../pilot/TINY-LIVE-API-20260923.md) and [26-route review](../pilot/tiny-live-settlement-review-20260923.json).

Verified locally: 65 focused tests passed; the added segmented-report regression subsequently passed with all three report tests (66 distinct focused tests). The synthetic storage test exceeded 256 MiB without exceeding the 64 MiB retained raw cap. Protected evidence survived rotations. Current review: **0 LIVE_EQUIVALENT, 19 LIVE_BLOCKED, 7 UNRESOLVED**. Read-only account GETs responded on both venues; private results are ignored and do not prove full account/capability/eligibility readiness.

Blockers: strict settlement equivalence, current confirmed equivalent economics, Ohio eligibility, fully reconciled inventory/execution and venue cash/capability, account-specific fee bounds, verified short lockup and unproven fresh-fill recovery. Live remains disabled. Readiness is provisionally NOT READY; do not change this based only on CI or conditional diagnostic quotes.

Next: hosted CI for this implementation, then refresh the same exact metadata and freeze/run the one 20-minute read-only watch. No source edits, tests/builds or CI polling during collection. Preserve raw evidence under ignored `work/tiny-live/`; publish only sanitized derived results and final report, update this handoff, then stop. No watch has yet been launched.

Commands (isolated checkout only):

```sh
node --experimental-strip-types --test tests/tiny-live.test.ts tests/tiny-live-watch.test.ts tests/segmented-evidence.test.ts tests/streaming-dispersion.test.ts tests/streaming-dispersion-report.test.ts tests/book-confirmation-adapter.test.ts tests/production-operations.test.ts
node --experimental-strip-types worker/tiny-live-watch.ts freeze work/tiny-live/watch work/tiny-live/metadata.json
node scripts/tiny-live-launch.mjs work/tiny-live/watch /Users/tylerhuffman/Documents/code_projects/lights-on/.env.research
```

Earlier streaming results and raw evidence remain in `/private/tmp/lights-on-streaming-20260923`, signed final head `c40f52c`, [draft #15](https://github.com/tyhuffman7/lights_on/pull/15), [successful CI](https://github.com/tyhuffman7/lights_on/actions/runs/35875284324). Historical PAPER Julia/Oregon/White Sox holdings and unknown exposure remain retained; no settlement or recovery is claimed here.
