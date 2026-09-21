# Lights On — handoff (2026-09-20)

PAPER ONLY. Sizing/recovery and the single missed-opportunity audit are complete; collection is stopped. Fresh-fill recovery remains **unproven**. Do not repeat the 20-minute run, refine recovery without new evidence, reset a halt, or start the experiment below automatically.

- Executed `bounded-v1`: $100 simulated ($50/venue), $10 entry reservation, $40 commitment, 5¢ PM-US + 1¢ Kalshi recovery allocation; 10¢ profit floor/1% ROI/2¢ charged reserve unchanged. Baseline remains available without the flag.
- Latest capture: six posted orders, five activations, zero qualifying same-side volume during 5.953 active seconds, zero fills/positions/P&L. Historical -$0.53 ledger and halt unchanged. All 111 executed-source hashes verified.
- Audit: 228,478 selection summaries; 236,628 processed slots include skips. Of 3,172 retained plans, 2,377 lacked recent activity and 787/795 active plans failed size stress. Removing only the floor adds 17 counterfactual admission intervals / 0.937 seconds, not fills or profit. No runtime correction selected.
- Coverage: 1,105 matched / 454 conditional / 450 preliminary eligible / 14 current-window mappings; only seven sampled/subscribed pairs after PM-US deduplication. The 30-market cap did not bind. Omitted activity is unknown.
- Chosen next experiment, **not launched**: one 30-minute order-disabled coverage/activity comparison of both Kalshi outcome mappings per current MLB event, maximum 14 Kalshi / 7 PM-US markets; fixed economics, recorded candidate identities/reasons, hard stop, no retuning or restart. Stop at this checkpoint pending a new task.

Evidence: [missed-opportunity report](../pilot/MISSED-OPPORTUNITY-2026-09-20.md), [sanitized audit](../pilot/missed-opportunity-summary-2026-09-20.json), [frozen sizing/result](../pilot/SIZING-RECOVERY-2026-09-20.md). Raw stopped capture and verified source are local under `work/sizing-recovery-20260920` and `work/missed-opportunity-20260920`; never publish databases/raw tape/account records.

Verification: 20 focused recovery/audit tests pass; complete offline audit passed. Full tests/typecheck/build belong to hosted CI for the new review revision; the earlier green baseline is not verification of these changes.

Publication: user explicitly authorized signed scoped draft publication to `tyhuffman7/lights_on`. Isolated checkout `/private/tmp/lights-on-sizing-recovery-20260920`, branch `codex/sizing-recovery-checkpoint`, stacked on `codex/hedge-policy-checkpoint` at `0fec7a55e7bc2778e8c098fb096497ed19ada18e`. First implementation commit `aebb402485fced902461b08d928ddb39ea7a494c`; prepared follow-up includes the exact executed prompt-stop line, analysis/tests and sanitized summaries. Signing/push/draft PR and hosted-CI snapshot are the remaining publication steps. Preserve SSH/1Password signing; no force push or merge. Original workspace remains on `main`; its pre-existing staged work is preserved.

Commands: `node --experimental-strip-types --test tests/maker-recovery.test.ts tests/missed-opportunity-audit.test.ts`; read-only capture/replay commands are in the report. After publication, `gh pr checks codex/sizing-recovery-checkpoint` supplies a compact CI snapshot; do not repeatedly poll.
