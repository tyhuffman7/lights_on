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

**Completed collection:** September 22, **17:52:27.729–18:52:27.502 UTC**, **59m 59.773s**, original supervisor deadline, exit **0**. All 34/34 comparisons refreshed without changed terms and received observations. There were **4,061 processed comparison-content states per scenario**, not 4,061 distinct opportunities. No reconnect, exposure halt, recovery or extension occurred. Before any post-session source edits, all **133 frozen files** and the original journal hash verified unchanged. Both ledgers passed per-venue cash/debit/reserve conservation; the original Julia positions, plans, fills and reserves remained identical.

| Actual modeled result | Baseline 2¢ | Challenger 0¢ |
|---|---:|---:|
| Distinct new admissions / attempts | 0 | 1 — Oregon State |
| Requested-book confirmations | 0 | 1, passed |
| New paired completions / modeled filled legs | 0 / 0 | 1 / 2 |
| No-fill / inconclusive legs | 0 / 0 | 0 / 0 |
| Recovery attempts / realized loss | 0 / $0 | 0 / $0 |
| Realized profit | $0 | $0 |
| Open paired positions, including Julia | 1 | 2 |
| Free cash: Kalshi / PM-US | $49.23 / $43.43 | $47.83 / $34.15 |
| Committed capital | $7.34 | $18.02 |
| Conditional ordinary-outcome holding surplus | $0.22 | $0.34 |

**Sole additional challenger candidate: Oregon State conference title.** The same-feed comparison found ten contracts at 17:52:37.442 UTC; requested books confirmed the exact quantity and positive fee-net surplus at 17:52:39.982. Submission followed 1 ms later. Both independently modeled FOK legs filled after the unchanged 500 ms delay: **10 Kalshi YES at 11¢ and 10 PM-US NO at 86¢**. Principal $9.70 + modeled fees $0.18 + held risk $0.20 + held recovery $0.60 = **$10.68 additional commitment**. The ordinary matched-outcome surplus is **$0.12 after modeled fees**, or **−$0.08 after the separate risk allowance**. The latter is an admission calculation, not a realized loss or expenditure of the reserve. Arrival processing was 1.444 / 7.546 ms late, within the retained gate. Requested-book round trips were 154.167 / 158.451 ms; these are not measured order latency.

Both alternatives retain the **seven-contract-per-venue Julia holding**, with its $0.22 conditional surplus and $7.34 commitment; no Julia entry or fee was duplicated. Challenger adds the ten-contract-per-venue Oregon holding. Baseline conservation: $92.66 free + $6.78 open debit + $0.56 held reserves = $100. Challenger: $81.98 free + $16.66 open debit + $1.36 held reserves = $100. These are separate $100 counterfactuals, never $200 available capital or additive profits.

The sample establishes that the fixed 2¢ admission cushion excluded **one distinct positive-after-fee candidate** that passed the unchanged confirmation, capital, fee and delayed modeled execution gates when the extra margin was zero. It does **not** establish which policy is better: there is one new modeled pair, no realized or settled profit, no actual execution evidence, and no recovery evidence. Oregon's $0.12 conditional surplus remains exposed to the reviewed settlement differences and is smaller than its separately held $0.20 risk allowance. Repeated observations do not strengthen the sample into additional independent opportunities.

**Verification/publication:** 49 focused tests preceded collection. Executed head `6e08607` passed [hosted CI 35763162564](https://github.com/tyhuffman7/lights_on/actions/runs/35763162564): **599 tests, typecheck and build** (PR merge tree `5132e4c`). No tests/builds or runtime edits occurred during collection. Read-only review identified a parity omission in the shared reconnect helper: an empty affected-venue list could be accepted instead of rejected. After collection and frozen-file verification, a regression test reproduced it; signed revision `6eb687b` restores the original invalid-count guard and tests deadline, halt, busy and atomic budget rejection. **50 focused tests pass.** There were no reconnects in the collected session, so the changed guard was not exercised by its evidence; no rerun or retuning followed. The final code revision passed [hosted CI 35770218598](https://github.com/tyhuffman7/lights_on/actions/runs/35770218598): **600 tests, typecheck and build** (PR merge tree `88f503d`). Results-only publication checks are available on the draft PR.

Signed scoped code, tests, this report, the short handoff and [sanitized numerical results](entry-margin-results-20260922.json) are in [draft PR #11](https://github.com/tyhuffman7/lights_on/pull/11), based on the preserved multi-market branch. Raw databases, credentials, private account information and raw tape are excluded. The checkpoint is complete and stopped. No merge, extension, live launch or automatic policy adoption is authorized.

Preparation (new single-use directory only): `node --experimental-strip-types worker/multi-paper.ts prepare-comparison OUTPUT ENV_FILE ORIGINAL_JOURNAL`. Launch: `node scripts/multi-paper-launch.mjs OUTPUT ENV_FILE`. Never reuse or restart a completed session. Focused checks: `node --experimental-strip-types --test tests/entry-margin.test.ts tests/multi-paper.test.ts tests/ksu-paper.test.ts tests/book-confirmation-adapter.test.ts tests/integrated-confirmation.test.ts`.
