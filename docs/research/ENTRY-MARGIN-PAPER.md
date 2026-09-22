# Entry-margin PAPER comparison — September 22, 2026

This authorized checkpoint compares two alternative counterfactual ledgers on the existing multi-market runner and one shared fresh market-data feed. The completed [multi-market session](MULTI-MARKET-PAPER.md), original journal and open Julia Stiles holding are preserved. No real orders, new conditional approvals, settlement simulation or recovery redesign is authorized.

Both scenarios start from the reconciled ending state: $49.23 free Kalshi cash, $43.43 free PM-US cash, and the existing seven-contract-per-venue Julia holding. Its $6.65 principal, $0.13 modeled entry fees, $0.14 risk cash and $0.42 recovery cash remain locked ($7.34 total). Each scenario owns a deep copy. Julia is already attempted and cannot enter again; inherited entries do not count as new attempts. Outcomes are alternatives, never additive earnings.

| Frozen policy | Baseline | Challenger |
|---|---:|---:|
| Admission margin per paired contract, after modeled fees | $0.02 | $0.00 |
| Required surplus after admission margin | Strictly positive | Strictly positive |
| Reserved risk cash per pair | $0.02 | $0.02 |
| Separate recovery cash per contract, Kalshi / PM-US | $0.01 / $0.05 | $0.01 / $0.05 |
| Maximum new attempts | 5 | 5 |
| Maximum total open pairs, including Julia | 3 | 3 |

Every legal whole quantity from one through ten is considered. Selection maximizes surplus after that scenario's admission margin, with smaller quantity breaking ties. Final admission and reservation use the same margin, and confirmation must preserve the exact selected quantity. Quoted fee bounds, actual modeled fee calculations, risk/recovery reservations, per-venue cash checks, FOK limits, 500 ms modeled leg delays and recovery behavior are unchanged. The accounting field `afterRisk` retains its original meaning even when the challenger admits a negative value. Reserved risk cash is neither spent nor reported as a fee.

The same five execution candidates and purchase directions remain authorized: Kansas State qualification (Kalshi NO / PM-US YES), Western Kentucky qualification (YES / NO), Julia Stiles runner-up (YES / NO, inherited only), Oregon State conference title (YES / NO), and White Sox AL pennant (NO / YES). The other 29 retained comparisons are observation-only. Exact current metadata, constraints, primary document hashes and supported order semantics refresh before collection and again at confirmation. Changed terms, constraints or administrative times block entry; no new contract review or conditional approvals. [Review sections Q/R/T](contract-shortlist/REVIEW.md) retain the cancellation, tied-ranking, incapacitation, withdrawal, correction and timing risks. Ohio live eligibility remains unvalidated and live-blocked.

One supervised session lasts at most 60 minutes, with no extension or parameter changes. Both policies select from the same books before either submits; candidates qualifying in both share a requested-book confirmation. Each scenario can model at most one attempt per candidate and has independent cash and inventory. The inherited Julia entry cannot reuse displayed liquidity. The original $15 entry reservation, $45 total commitment, $2 realized-loss stop trigger, three bounded transport reconnections, 120 shared entry confirmations, request pacing, evidence cap, exposure stops and all freshness/status gates remain. A scenario at capacity stops new entries while the other can continue; unresolved exposure or a loss trigger stops the shared session. Recovery requests retain separate pacing. These are displayed-depth counterfactuals, not actual fills or price-impact forecasts.

Focused verification covers consistent margin propagation, fee-net rejection at zero and below, unchanged baseline selection/admission, identical modeled fills/fees/recovery budgets at equal quantity, reserved safety cash, independent reconciled seeds, inherited Julia lockup and the three-position cap. Synthetic fixtures do not count as market evidence. Full tests/typecheck/build run only in hosted CI. No tests/builds run during collection.

Collection and CI results will be recorded after the single session. More admissions alone cannot establish a superior policy; any conditional ordinary-outcome surplus remains unrealized and exposed to settlement differences.

Preparation (new single-use directory only): `node --experimental-strip-types worker/multi-paper.ts prepare-comparison OUTPUT ENV_FILE ORIGINAL_JOURNAL`. Launch: `node scripts/multi-paper-launch.mjs OUTPUT ENV_FILE`. Never reuse or restart a completed session. Focused checks: `node --experimental-strip-types --test tests/entry-margin.test.ts tests/multi-paper.test.ts tests/ksu-paper.test.ts tests/book-confirmation-adapter.test.ts tests/integrated-confirmation.test.ts`.
