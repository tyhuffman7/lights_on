# Lights On handoff — 2026-09-23

## Current checkpoint

The authorized read-only streaming culture-versus-sports study is complete. **Stop here; no repeat run, mapping expansion, recovery refinement or PAPER strategy run is authorized.** No orders, new positions, PAPER ledger changes or Julia/Oregon/White Sox settlement occurred. Ohio eligibility, settlement, fee, freshness and risk gates remain in force. Fresh-fill recovery is still unproven; the earlier no-fill sizing/recovery test is complete and must not be repeated without new evidence.

[Final report](STREAMING-DISPERSION-20260923.md) · [Exact payout review](STREAMING-CULTURE-REVIEW-20260923.md) · [Methodology](STREAMING-DISPERSION-METHODOLOGY-20260923.md) · [Sanitized results](streaming-dispersion-results-20260923.json)

- Ten retained non-sports routes reviewed: 0 EQUIVALENT, 5 CONDITIONAL, 2 INCOMPATIBLE, 3 UNRESOLVED. No strategy approval or registry promotion.
- Seventeen concurrent routes (10 non-sports, 7 existing sports controls), persistent Kalshi + native PM-US WebSocket books and unchanged economics/confirmation routines. No REST book polling.
- One run: **03:56:55–05:00:36 UTC**, 63.689 minutes. Frozen 256 MiB evidence guard stopped it; original 05:26:55 UTC deadline was never extended. Remaining 26.308 minutes censored; no restart.
- **37 distinct raw-positive intervals; 0 fee-positive intervals; 0 confirmation requests or confirmed positives.** Culture 6.632 usable route-hours; sports 7.249; company control 1.035. Netflix show and AGT have no legal complementary whole-depth evidence; do not call those zero opportunities.
- Kalshi reconnects 0; PM-US 3 using PR #13 per-venue bounded rebuilding. All 34 subscribed books arrived. Supervisor clean exit; no clock fault.
- Neither culture nor sports has demonstrated more fee-positive opportunities. Confirmed spread magnitude unavailable. No positive spread/depth/short-lockup combination established.
- Recommend recurring manual review of weekly Billboard and finale-window AGT/Big Brother. Netflix needs controlling chart-scope clarification; VMA tie payouts conflict; Spotify annual and IPO are controls, not short-lockup priorities. Additional broad mapping is not justified before resolving settlement/economics blockers.

## Verification and publication

42 targeted local tests passed after collection; derived counts/coverage/deadline/size invariants passed; frozen runtime sources unchanged. No full local tests/typecheck/build or CI polling occurred during collection. The previous REST observation remains preserved and methodologically inconclusive.

Scoped branch: `codex/streaming-culture-dispersion`, based on `codex/non-sports-dispersion` at `a117b2a` (PR #14). Main checkout and its unrelated index/worktree changes are preserved. Publication is authorized only as a **signed non-main draft PR** to `tyhuffman7/lights_on`; no merge or force-push.

Publication: signed commit `6446be8` is on [draft PR #15](https://github.com/tyhuffman7/lights_on/pull/15), stacked on draft #14. The existing 1Password signer succeeded after unlock; local SSH verification passed. GitHub reports the preserved signing key as `unknown_key`; cryptographic verification with the configured public key passes locally. For code commit `6446be8`, [hosted CI](https://github.com/tyhuffman7/lights_on/actions/runs/35874820195) passed **677 tests**, typecheck and production build, with zero failures or skipped tests. No merge or force-push occurred.

## Needed next action / commands

The scoped implementation, study, signed draft publication and hosted validation are complete. **Stop; no further collection or PAPER strategy work is authorized.** Use GitHub account `tyhuffman7` exclusively for any later authorized publication maintenance. Inspect/explicitly stage only this checkpoint’s code, tests, review, methodology, sanitized results/report and handoff. Exclude credentials, env files, raw books/tape/catalogs, databases, leases, account information and unrelated work.

Offline report command (does not collect again):

```sh
node scripts/streaming-dispersion-report.mjs work/streaming-culture-20260923/study docs/research/streaming-dispersion-results-20260923.json
```

Targeted checks:

```sh
node --experimental-strip-types --test tests/streaming-dispersion.test.ts tests/streaming-dispersion-report.test.ts tests/book-confirmation-adapter.test.ts tests/candidate-confirmation.test.ts tests/streams.test.ts tests/production-operations.test.ts
```

Private study evidence stays under `work/streaming-culture-20260923/study/` and is never published. Evidence SHA256 `f4597c7fc96f0c3a630d242ca9d110bf4cbaedffd9d1eb00c9069ae92bc19488`; freeze SHA256 `ad98a00b5e6d7de598299e0d77103d1b5f36934102607a19259cf6cf8cc1e930`.
