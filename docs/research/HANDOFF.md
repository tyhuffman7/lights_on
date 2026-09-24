# Handoff — 2026-09-24 EDT, EV arbitrage paper checkpoint complete

**PAPER / READ ONLY. Live orders remain disabled. Stop at this checkpoint.** Branch `experiment/ev-arb-learning` is stacked on unmerged candidate-watch [draft PR #19](https://github.com/tyhuffman7/lights_on/pull/19), without the PMXT experiment. [Draft PR #21](https://github.com/tyhuffman7/lights_on/pull/21) targets `codex/bounded-candidate-watch`. Nothing was merged to `main`; its unrelated local changes and prior private evidence were preserved. GitHub identity: `tyhuffman7`; repo-local SSH signing retained.

## Verified result

- Direct Kalshi + Polymarket US L2 gross complement, ordinary modeled fee, extreme Kalshi fee stress, one-tick stress, freshness, settlement and paper risk gates are separate. Append-only simulated attempts include alternate first-leg outcomes. [Method and limits](EV_ARB_LEARNING.md).
- Verified retained September 23 replay: 662 gross-positive and 71 ordinary-fee-net-positive repeated observations; 12 fresh, cap-eligible readings on five routes failed the old extreme fee stress gate. Only eight raw monitoring segments remained after 18 rotated. [Sanitized replay](ev-arb-september23-retained-replay.json).
- One frozen 90-minute observation ran September 24 **22:10:08–23:40:12 UTC**, stopped at `ORIGINAL_DEADLINE` and exited 0. It reached 34 of 48 route shards; 2,852 is the matched universe, not the number streamed. Repeated 250 ms orientation samples: 21,950 fresh two-book depth, 47,597 gross-positive including stale, 3,548 ordinary-fee-net-positive including stale, and four fresh paper-eligible observations rejected only by the old extreme fee stress gate. All four came from one route. Empirical EV remains `INSUFFICIENT_EMPIRICAL_SAMPLE`. [Hash-checked sanitized receipt](ev-arb-paper-run-20260924.json).
- One primary Kalshi-first simulated clean pair projected **+$0.05 gross −$0.04 modeled fees = +$0.01 net at ordinary settlement**. No primary disappearance, unwind or orphan occurred. Its dependent PM-US-first counterfactual found the Kalshi hedge book stale under the fixed two-second rule and simulated a full unwind: −$0.01 price loss −$0.04 fees = **−$0.05**. Counterfactual P&L is excluded from primary totals. These were public-depth simulations, not actual fills or profit. All three saved public-book hashes, both attempt references and P&L identities verify; the receipt contains no raw books or credentials.
- The observed Oscar Best Picture route offered +$0.05 gross and +$0.01 modeled ordinary net, but $1.0375 in extreme fee stress and −$0.01 net under one native tick against each leg. Its family carries `venue-finality` and `family-branches` divergence; direct public pair audit retrieved both markets and books but found no reviewed pair-specific settlement profile. Recorded PM-US close is March 29, 2027; Kalshi close is December 31, 2027. The later close is an indicative lockup floor, not guaranteed release. Small-capital economics are weak at this horizon.
- Initial signed code commit `4afa0bcabfb27afeaaac21412b84cd9a4e37dda4` passed [CI 36065594252](https://github.com/tyhuffman7/lights_on/actions/runs/36065594252): 768/768 tests, typecheck and build. Frozen source hashes matched that commit. After the run, 35 affected tests and typecheck passed locally; final PR CI covers the report, audit and documentation follow-up.

## Blockers and next action

One primary attempt and one dependent counterfactual cannot estimate execution EV or repeatable net profit. Long capital lockup, settlement divergence, account-specific Kalshi fee precision, second-leg risk, and Ohio/account/product permission remain unresolved. Review draft PR #21 and the receipts. A shorter-lockup paper iteration needs a separate scope; a live launch needs separate approval. Do not restart this observation or the completed sizing/recovery no-fill run.

Preserve private raw paper evidence at `/private/tmp/lights-on-ev-paper-20260924/` and prior watch evidence at `/private/tmp/lights-on-bounded-basis-20260923/work/candidate-watch/session/`.

```sh
npm run research:ev-report -- /private/tmp/lights-on-ev-paper-20260924
npm run research:audit-pair -- --kalshi=KXOSCARPIC-27-ODY --pmus=tac-oscars-03-14-2027-bestpic-odysse
gh pr checks 21 --repo tyhuffman7/lights_on
```
