# Candidate confirmation — RUNNING_PENDING

Started 2026-09-21T19:16:59.938Z; observed through 2026-09-21T19:17:19.955Z; scheduled deadline 2026-09-21T19:46:59.721Z.

Routes 58; books 104/104; distinct positive candidate intervals 1; confirmation attempts 1; results {"EDGE_SURVIVED":0,"EDGE_DISAPPEARED":0,"FAILED":1}. Feed failures [].

Economic positivity, data validity, settlement equivalence, policy admission and authorization are independent fields. Orders remain disabled. Repeated updates are not new opportunities.

| Interval / pair / side | First detected UTC | Qty | Initial fee-bound surplus | Confirmation | Latest fee-bound surplus | Risk charge | Recovery K / PM | Policy blockers | Contract review |
|---|---|---:|---:|---|---:|---:|---|---|---|
| 1: KXAOCRUN-28-27JAN01::cranc-uspres28-12-31-2026-aleoca / no+yes | 2026-09-21T19:17:00.463Z | 10 | 0.1500 | FAILED: CACHED_RESPONSE, CACHE_PROVENANCE_UNRESOLVED, REST_OLDER_THAN_ALREADY_OBSERVED_STREAM (1 checks) | 0.1500 | 0.2000 | 0.1000 / 0.5000 | BASELINE_30_DAY_HORIZON, BASELINE_10_CENT_PROFIT_FLOOR, BASELINE_1_PERCENT_ROI, BASELINE_10_DOLLAR_ENTRY_CAP | UNRESOLVED (clause review complete) |

A FAILED check has unknown survival, not zero profit. Its displayed latest calculated surplus is unverified and does not establish a currently executable edge. A surviving fee-bound edge still needs separate settlement review and policy admission; no row authorizes trading or establishes a fill. Original and repriced quantities, prices, receipt/processing/snapshot times, request hashes and cache headers are in the sanitized JSON. Full raw responses stay local.

AOC review: UNRESOLVED. See [clause comparison](aoc-contract-review-20260921.json) and [method](CANDIDATE-CONFIRMATION.md). Deadline/timezone and issuance/source precedence are unresolved; exceptional payouts are not proven complementary. Other contracts were not reviewed in this bounded checkpoint.

Collection is still running. This is an interim result, not a completed 30-minute outcome.
