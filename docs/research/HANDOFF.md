# Handoff — 2026-09-30 EDT, recall detector paused for laptop closure

**PAUSED at the user's request. READ ONLY / PAPER. No observation or local background work remains running. Do not start another run until the user says continue.** No real orders, fills, previews, cancellations, funding, wallet actions, live launch or automation occurred.

[Draft PR #22](https://github.com/tyhuffman7/lights_on/pull/22) is OPEN/DRAFT. Signed implementation `df7fb478946c145bb7cdccb51258fa0ccd844a4d` is GitHub-verified. CI is remote; no polling or local collection is left running.

## Saved checkpoint

- Persistent isolated checkout: `/Users/tylerhuffman/Documents/code_projects/lights-on/work/recall-detector-20260930/checkout`; branch `codex/recall-first-detector`, created from exact requested `a200abf36cd590c894f936dbe1d6f4c81f461468` on `experiment/ev-arb-learning`. Main's staged/local work preserved. GitHub identity `tyhuffman7`; HTTPS remote and repo-local SSH signing intact.
- New observer: full dynamic catalogs, simultaneous 100-market subscription groups, stable membership, bounded restarts, independent book/cache ages, normal-fee candidates before verification, quantities 1–10, native metadata/book confirmation, and labeled delay counterfactuals. Latest edits move matching off the observer thread and start the bounded clock after preparation. These latest edits have not had another live run yet.
- **22/22 targeted tests passed** after final edits, including native matching regressions and background matching. Full tests/typecheck/build pending repository CI. Final completion is not claimed.
- Retained September 22 replay: **57 gross, 51 normal-fee positives across 47 routes; all 51 preserved, four fresh, zero economics disagreements.** Requested September 23/24 temporary raw evidence absent; user has no known alternate copy. Published 662/71/12 baseline unchanged, exact replay unverified.
- Smoke 1 exposed 613,317 overly broad hypotheses and failed multi-subscription Kalshi connections. Native 100-market feed succeeded; 500-market/five-subscription feed reproducibly failed after 100 books. Smoke 2: **18,260 matched and two-book routes; 5,447 fresh two-book observations; 41,241 gross-positive and 36,298 modeled normal-fee-positive readings including stale; 810 fresh net readings; eight repeat-economic survivors; one fresh executable candidate; zero settlement-verified arbs.** False positives remain measurable candidates. Event-driven counts are not unique trades, fills or realized profit.
- Synpath SDK orientation/PM-US fee source cross-check done. Example bot targets international Polymarket. Two hosted probes failed at TLS/HTTP 000; hosted PM-US matching usefulness unverified and does not block native work.

[Implementation/methodology](recall-detector/README.md) · [Replay](recall-detector/september-replay.json) · [Smoke receipts](recall-detector/smoke-receipts.json).

## Resume in this order

1. Read this handoff; verify branch/status in the persistent checkout. Inspect draft PR / compact CI result. Fix relevant CI failures; use targeted tests while editing.
2. Inspect remaining matcher false positives using exact native propositions. Missing settlement review must not gate observation. Validate latest background discovery, restarts, post-preparation clock and verification-state changes in a short smoke before freezing the final run.
3. Freeze settings; run the meaningful bounded read-only observation (default 20 minutes). No repeated tests/builds/CI polling during collection. No tuning against final results. Preserve candidate IDs/orientation, depth/quantity, fees, independent ages/cache, confirmation and 0/100/250/500/1,000 ms simulated delays.
4. After stop, independently inspect highest/near-positive spreads with `scripts/check-recall-native.ts`; investigate missed signals and wrong predicates. Preserve evidence/limits. Do not claim no confirmed arb merely because verification is unsupported.
5. Complete draft PR with before/after funnel, coverage, exact examples, confirmation/verification/paper outcomes, Synpath limits and start command. Update this handoff and stop. No merge or live-money recommendation.

```sh
cd /Users/tylerhuffman/Documents/code_projects/lights-on/work/recall-detector-20260930/checkout
git status --short --branch
node --experimental-strip-types --test tests/recall-detector.test.ts tests/ev-arb-learning.test.ts
npm run research:recall -- work/final-NEW --duration-seconds=1200 --env=/Users/tylerhuffman/Documents/code_projects/lights-on/.env.research
node --experimental-strip-types scripts/check-recall-native.ts work/final-NEW docs/research/recall-detector/native-check.json
```

Smoke catalogs, raw books, logs, source freezes and probes persist under ignored `work/`. Prior primary handoff at sibling `primary-handoff-before.md`; staged-index fingerprint at `primary-index.sha256`. No completed recovery/no-fill run restarted or refined. The original task remains unfinished and paused.
