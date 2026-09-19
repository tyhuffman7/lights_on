# September 19 follow-up checkpoint

## Scope and verification

The source checkout is `/Users/tylerhuffman/Documents/code_projects/lights-on`, on `main` at `b0bccd0518cca1fd64687d702d6d0336b36fbcfa`, with pre-existing staged, unstaged and untracked work. The existing clean PR worktree is `/Users/tylerhuffman/Documents/Codex/2026-09-14/continue-my-lights-on-arbitrage-bot/work/astra-ci-checkout`, on `codex/astra-paper-checkpoint`; its starting head was `547c8b3ad04e1a5305cbe290b3e41970e076c222`. Matching source files were verified before transferring only this follow-up. The original index and unrelated local work are preserved.

- Order-size ranking now scores eligible quantities at each retained side/price, with at most six prices and the existing 1,000-contract enumeration cap. It retains the highest activity score per price, using modeled profit only as a tie breaker. Activity volume is cached per side/price during enumeration. Default non-maker assessment remains profit-ranked.
- Final reservation refresh revalidates the selected side, price and quantity directly. An invalid exact candidate is rejected instead of silently resized. Existing observed-size admission, partial fills, cancellation races, fees and risk gates remain in place.
- Synthetic regression: maker bid $0.40, zero synthetic maker fee, hedge depth 1 at $0.40 plus 9 at $0.56, PM coefficient 0.0695, reserve $0.02/pair, minimum profit $0.10, minimum ROI 1%, max outlay $10, ample simulated cash, volume 1 and queue 1. Profit-only selection returns 9 contracts/$0.19 modeled profit/0.019 score; ranked selection returns 1/$0.16/0.08. These are synthetic heuristic scores, not fill probabilities or earnings evidence.
- Targeted local verification on Node 25.8.1: **45 tests passed; zero failed, cancelled or skipped**, covering competitive maker plans, runner refresh, size admission, maker ledger and core. Includes exact-quantity preservation with changed depth and rejection when depth becomes insufficient. Full local suite/build were not rerun.
- Workflow job IDs are now `correctness` and `synthetic-benchmarks`. Existing pins, Node 22.23.2, read-only permissions, timeouts, concurrency cancellation, failure propagation, hidden artifact upload and seven-day retention are unchanged.
- Root `AGENTS.md` is included with the user's explicit prohibition on Superpowers/brainstorming unless requested. Setup was already complete; no project/global settings were changed.

## Hosted status and approval boundary

Existing draft [PR #1](https://github.com/tyhuffman7/lights_on/pull/1) remains unmerged. Prior hosted [run 35464542461](https://github.com/tyhuffman7/lights_on/actions/runs/35464542461) at head `547c8b3ad04e1a5305cbe290b3e41970e076c222` succeeded: install, 429 tests, typecheck, build and artifact upload. Its tested merge ref was `b7d06a2596a2502eaf0f293ab83a179217df0b4f`. This is prior-baseline evidence, not verification of this follow-up. Follow-up hosted correctness is **pending publication/run completion**; inspect the new head's run once, without repeated polling. Commit-specific status is reported in the task checkpoint.

Synthetic benchmark hosted verification is still pending. Its manual workflow must reach default/main through an **approved merge** before normal dispatch; after that, run it once and verify both outputs and artifact upload. Recommend a main-branch PR requirement with required `correctness`, plus an intentional owner/bypass policy that does not require a second maintainer. Repository protection/ruleset changes require Tyler's approval; none were made or claimed configured.

The next evidence milestone requires separate user resumption: fresh watchlist, rule pins/conditional approvals and fees, followed by uninterrupted multi-hour PAPER evidence retaining losses and authentic queue/hedge evidence. Account direct-versus-broker precision classification remains unanswered; retain conservative precision. Live launch, Ohio eligibility, settlement equivalence and execution/recovery gates remain separate. No merge, settings change, real trading or multi-hour observation was performed.

## Exact supported standalone command — inspected, NOT RUN

From the original source root, after the watchlist/approval/fee refresh and lease/free-disk checks:

```sh
npm run paper -- maker-run work/fee-replay/capture.config.json research-data/paper-bot.sqlite
```

`worker/paper-cli.ts` accepts `maker-run OBSERVER_CONFIG SEPARATE_PAPER_DB [SECONDS]`. Explicit seconds are limited to 1–600; omit seconds for continuous operation and use SIGINT/SIGTERM for graceful shutdown. The existing config contains old Emmy markets and is **not ready to run**. Observer and paper databases must differ; preserve existing databases and leases, ensure >=8 GiB free disk, and run no tests/builds/replays alongside collection. This command is documentation for the later approved task, not authorization to start it.

## Previous checkpoint (historical evidence)

# Astra review: previous code checkpoint

**Stopped at the requested checkpoint. Collector off; recurring automation paused. Real trading disabled; not pilot-ready. No multi-hour observation started.**

## Commit and CI

- Published signed review head: `547c8b3ad04e1a5305cbe290b3e41970e076c222` (snapshot225f9f4 plus two-file artifact fix), branch `codex/astra-paper-checkpoint` in the isolated checkout.
- Original HEAD and fetched origin/main: `b0bccd0518cca1fd64687d702d6d0336b36fbcfa`. Original staged changes remain staged; original unstaged/untracked work was preserved.
- The review snapshot includes the previously unpublished work: **129 files, 15,105 insertions, 265 deletions**, including archived history. It is substantially larger than this task's incremental fixes. See `astra-review-file-list.txt`.
- **Publication approved by the user and completed.** Draft PR: https://github.com/tyhuffman7/lights_on/pull/1 . Hosted Linux CI: https://github.com/tyhuffman7/lights_on/actions/runs/35464542461 — **PASSED**,429 tests/zero failures,installer/typecheck/build and artifact upload successful. Tested PR merge ref`b7d06a2596a2502eaf0f293ab83a179217df0b4f` for head547c8b3. Initial run passed checks but omitted hidden logs; follow-up enables hidden-file upload and fails on missing artifacts. The initial automatic approval rejection was resolved by explicit user approval; no signing bypass or retry was used.
- Initial exact CI command sequence passed locally on Node25.8.1: installer, **429 tests / 429 passed / zero failed**, nonincremental typecheck and build. The pinned Node22.23.2 macOS run also passed the same four commands:429/429 tests,zero failures. See `astra-ci-node22-summary.json`. Local macOS success is not hosted Linux success.

## Findings and changes

| Request | Actual local finding and action |
|---|---|
| A: retain baseline | Fallback was already fixed locally. Added bounded deduplicated baseline, next-cent and competitive candidates, up to six across two sides. Existing observed bid retained; generated improvements remain whole-cent and below ask. Added baseline-plus-improvement coverage. |
| B: rank both directions | Already implemented and tested locally. Price alternatives now also reach activity ranking; refresh must preserve the selected side **and price**. Diagnostics expose active/inactive counts and optional inactive fallback reason. Activity remains a hint, never a fill probability. |
| C: fees | PM cumulative half-even rounding was already fixed locally. Added the 25-cent/0.0695 reproduction and fragmented/multilevel order tests, distinguishing separate hedge orders. Added quote fee coefficients and estimate/bound provenance. Calculator now uses and returns the September17 schedule version. Fresh public metadata also reported0.0695; scanner was not hardcoded600. No rebates or reserve reductions. |
| D: resting economics/recovery | Existing code already revalidated whole remaining hedge size and retained fill/cancel races. Added coalesced book-event wakes and cancellation checks before activation. Added a test that bounded recovery hedges already-filled exposure despite failed entry-profit checks. Cancellation requests remain pending; unmatched exposure remains recorded. |
| E: cadence | Book/trade-driven bounded selection already existed; ten-second scan is fallback only. Added coalesced immediate wakes while retaining bounded selection slices and the100ms health timer. No changes to500ms activation,2s lifetime, freshness or profit limits. |
| CI/handoff | Added read-only Linux workflows, pinned action SHAs, Node22.23.2, lockfile cache, exact installer/test/type/build sequence, timeouts, superseded-run cancellation, compact failure-preserving summaries and seven-day logs. Separate manual synthetic benchmark workflow. Archived old handoff byte-for-byte; new brief handoff explicitly deactivates usage-consumption targets and stops here. |

## Benchmarks and evidence

Both existing offline benchmarks passed locally on Node25: load reached **996.48 updates/s** at500 mappings (processing p99≈0.46ms, persistence p99≈9.99ms); concurrent discovery reached **998.09 updates/s**, five completed discovery cycles. These are synthetic host results, not exchange latency/fill claims. Outputs: `astra-load.json`, `astra-discovery-load.json`; logs: `astra-validation-logs.zip`; compact validation: `astra-ci-summary.json` and the Node22 summary.

Official fee reference: https://docs.polymarket.us/fees (effective September17,00:00ET, coefficient0.0695). One fresh public metadata observation is retained in `astra-current-fee-evidence.json`.

## Standalone command for the later paper task — NOT RUN

From `/Users/tylerhuffman/Documents/code_projects/lights-on`:

```sh
npm run paper -- maker-run work/fee-replay/capture.config.json research-data/paper-bot.sqlite
```

Omitting seconds runs continuously; use SIGINT for graceful stop after the agreed observation period. **The current config contains old Emmy markets and is not a ready watchlist.** Before running, the later task must replace it with a small current active watchlist, refresh conditional paper approvals/rule pins/fees, and verify leases/disk. Do not reuse historical approvals or run tests/builds alongside collection. This command is the existing standalone worker, not an AI polling loop.

## Remaining blockers

Fresh active watchlist and uninterrupted multi-hour loss-inclusive paper evidence; account direct-versus-broker precision classification; and all separate live submission/reconciliation/restart/cancellation/exposure-recovery and eligibility gates. Paired settled paper profit remains+$0.282; directional recovery+$8.16 is separate. This checkpoint does not authorize live trading.

Hosted summary: `astra-hosted-ci-summary.json`. Seven-day artifact verified, ID10590212883. Draft PR remains unmerged. Explicit user publication approval resolved the original review rejection. No additional collection or engineering will continue automatically.
