# Candidate confirmation — COMPLETED_BOUNDED_CONFIRMATION

Started 2026-09-21T21:34:37.667Z; observed through 2026-09-21T22:04:37.437Z; scheduled deadline 2026-09-21T22:04:37.459Z.

Observed routes 58 across 13 categories; **one unique positive candidate route**, in six intervals; books 104/104; distinct positive candidate intervals 6; confirmation attempts 20; results {"EDGE_SURVIVED":17,"EDGE_DISAPPEARED":0,"FAILED":3}. Feed failures [].

Book confirmation, economic positivity, data validity, market status, settlement equivalence, policy admission and authorization are independent fields. A surviving book-confirmed spread is not executable arbitrage. Orders remain disabled. Repeated confirmations of this same route are not additional trades or profits. The first five intervals ended on invalid/censored data; none establishes economic disappearance. The sixth ended at the observation deadline.

| Interval / pair / side | First detected UTC | Qty | Initial fee-bound surplus | Confirmation | Latest fee-bound surplus | Risk charge | Recovery K / PM | Policy blockers | Market status | Contract review |
|---|---|---:|---:|---|---:|---:|---|---|---|---|
| 1: KXAOCRUN-28-27JAN01::cranc-uspres28-12-31-2026-aleoca / no+yes | 2026-09-21T21:34:57.817Z | 10 | 0.1500 | 1 survived, 0 failed | 0.1500 | 0.2000 | 0.1000 / 0.5000 | BASELINE_30_DAY_HORIZON, BASELINE_10_CENT_PROFIT_FLOOR, BASELINE_1_PERCENT_ROI, BASELINE_10_DOLLAR_ENTRY_CAP | UNRESOLVED: STATUS_CACHE_CURRENTNESS_UNPROVEN, NON_ATOMIC_INITIAL_STATE | UNRESOLVED (clause review complete) |
| 2: KXAOCRUN-28-27JAN01::cranc-uspres28-12-31-2026-aleoca / no+yes | 2026-09-21T21:42:22.923Z | 10 | 0.1500 | 3 survived, 0 failed | 0.1500 | 0.2000 | 0.1000 / 0.5000 | BASELINE_30_DAY_HORIZON, BASELINE_10_CENT_PROFIT_FLOOR, BASELINE_1_PERCENT_ROI, BASELINE_10_DOLLAR_ENTRY_CAP | UNRESOLVED: STATUS_CACHE_CURRENTNESS_UNPROVEN, NON_ATOMIC_INITIAL_STATE | UNRESOLVED (clause review complete) |
| 3: KXAOCRUN-28-27JAN01::cranc-uspres28-12-31-2026-aleoca / no+yes | 2026-09-21T21:45:19.276Z | 10 | 0.1500 | 8 survived, 0 failed | 0.1500 | 0.2000 | 0.1000 / 0.5000 | BASELINE_30_DAY_HORIZON, BASELINE_10_CENT_PROFIT_FLOOR, BASELINE_1_PERCENT_ROI, BASELINE_10_DOLLAR_ENTRY_CAP | UNRESOLVED: STATUS_CACHE_CURRENTNESS_UNPROVEN, NON_ATOMIC_INITIAL_STATE | UNRESOLVED (clause review complete) |
| 4: KXAOCRUN-28-27JAN01::cranc-uspres28-12-31-2026-aleoca / no+yes | 2026-09-21T21:54:21.823Z | 10 | 0.1500 | 2 survived, 0 failed | 0.1500 | 0.2000 | 0.1000 / 0.5000 | BASELINE_30_DAY_HORIZON, BASELINE_10_CENT_PROFIT_FLOOR, BASELINE_1_PERCENT_ROI, BASELINE_10_DOLLAR_ENTRY_CAP | UNRESOLVED: STATUS_CACHE_CURRENTNESS_UNPROVEN, NON_ATOMIC_INITIAL_STATE | UNRESOLVED (clause review complete) |
| 5: KXAOCRUN-28-27JAN01::cranc-uspres28-12-31-2026-aleoca / no+yes | 2026-09-21T21:55:19.946Z | 10 | 0.1500 | 3 survived, 2 failed | 0.1500 | 0.2000 | 0.1000 / 0.5000 | BASELINE_30_DAY_HORIZON, BASELINE_10_CENT_PROFIT_FLOOR, BASELINE_1_PERCENT_ROI, BASELINE_10_DOLLAR_ENTRY_CAP | UNRESOLVED: STATUS_CACHE_CURRENTNESS_UNPROVEN, NON_ATOMIC_INITIAL_STATE | UNRESOLVED (clause review complete) |
| 6: KXAOCRUN-28-27JAN01::cranc-uspres28-12-31-2026-aleoca / no+yes | 2026-09-21T22:04:31.479Z | 10 | 0.1500 | FAILED: INGRESS_BACKLOG, LATEST_INGRESS_BACKLOG (1 checks) | 0.1500 | 0.2000 | 0.1000 / 0.5000 | BASELINE_30_DAY_HORIZON, BASELINE_10_CENT_PROFIT_FLOOR, BASELINE_1_PERCENT_ROI, BASELINE_10_DOLLAR_ENTRY_CAP | UNRESOLVED: STATUS_CACHE_CURRENTNESS_UNPROVEN, NON_ATOMIC_INITIAL_STATE | UNRESOLVED (clause review complete) |

A FAILED check has unknown survival, not zero profit. A surviving fee-bound edge still needs separate settlement review and policy admission; no row authorizes trading or establishes a fill. Original and repriced quantities, prices, request-bound WebSocket evidence, market-status baselines and lifecycle events are in the sanitized JSON. Full raw responses stay local.

Lifecycle: {"subscription":{"requestedAt":1790026477976,"ackAt":1790026478024,"sid":2,"lastSequence":8132},"faults":[],"relevantEvents":0,"ignoredEvents":8132,"limits":{"total":2048,"perMarket":32}}. Initialization is not atomic; absence of deactivation does not establish active status.

AOC review: UNRESOLVED. See [clause comparison](../aoc-contract-review-20260921.json) and [method](README.md). Deadline/timezone and issuance/source precedence are unresolved; exceptional payouts are not proven complementary. Other contracts were not reviewed in this bounded checkpoint.

The existing run is stopped. No restart or retuning was performed.

For the unique Elections route (Kalshi NO / PM-US YES), ten contracts cost **$9.70** in displayed depth, with **$0.15** conservative exchange-fee bound and **$0.15** exchange-net surplus. Separate risk allowance **$0.20** gives **-$0.05** after risk. Recovery cash reserved: **$0.10 Kalshi + $0.50 PM-US**; total cash reserved including entry, fee bound, risk and recovery is **$10.65**. These amounts are per observed comparison, never accumulated across confirmations as earnings.

All three failed confirmations reported ingress backlog (including the latest-book backlog check); survival is unknown for those attempts. There were no recorded stream failures, missing books, lifecycle sequence faults, global clock fault, resource stop or restart. The supervisor exited 0 at the original deadline. All 58 baseline status requests followed the lifecycle subscription acknowledgement. The shared stream processed 8,132 unrelated lifecycle messages with zero relevant selected-market transitions; event silence does not establish active status. This bounded selection does not prove exhaustive listing or matching coverage.

AOC settlement remains UNRESOLVED. Status blockers are `STATUS_CACHE_CURRENTNESS_UNPROVEN` and `NON_ATOMIC_INITIAL_STATE`; additional policy blockers are baseline horizon, minimum after-risk profit, ROI and entry cash cap. Trading authorization remained disabled. No orders, fills or realized profit are inferred.

Frozen runtime source hashes were verified unchanged after collection. No tests or builds were run during this completion turn. Prior focused verification remains recorded in the handoff; this integration requires its own hosted CI, whose status is pending publication and reported on the draft PR.
