# Candidate confirmation — COMPLETED_BOUNDED_CONFIRMATION

Started 2026-09-21T21:29:11.195Z; observed through 2026-09-21T21:29:40.969Z; scheduled deadline 2026-09-21T21:29:40.959Z.

Routes 2; books 4/4; distinct positive candidate intervals 0; confirmation attempts 2; results {"EDGE_SURVIVED":0,"EDGE_DISAPPEARED":2,"FAILED":0}. Feed failures [].

Book confirmation, economic positivity, data validity, market status, settlement equivalence, policy admission and authorization are independent fields. A surviving book-confirmed spread is not executable arbitrage. Orders remain disabled. Repeated updates are not new opportunities.

| Interval / pair / side | First detected UTC | Qty | Initial fee-bound surplus | Confirmation | Latest fee-bound surplus | Risk charge | Recovery K / PM | Policy blockers | Market status | Contract review |
|---|---|---:|---:|---|---:|---:|---|---|---|---|

Integrated control results (forced checks independent of profitability):
- KXU3-26SEP-T3.7::urc-usunemp-sa-september-2026-10-02-gt3pt7pct: book confirmation PASS, fee-bound surplus -0.2100, Kalshi status UNRESOLVED; . Control nonpositive prices do not imply a disappeared opportunity.
- KXMLBGAME-26SEP211835TORBAL-TOR::aec-mlb-tor-bal-2026-09-21: book confirmation PASS, fee-bound surplus -0.2700, Kalshi status UNRESOLVED; . Control nonpositive prices do not imply a disappeared opportunity.
| No positive valid-discovery interval detected | — | — | — | — | — | — | — | See classified rows and missing-data evidence in JSON | Review remains independent |

A FAILED check has unknown survival, not zero profit. A surviving fee-bound edge still needs separate settlement review and policy admission; no row authorizes trading or establishes a fill. Original and repriced quantities, prices, request-bound WebSocket evidence, market-status baselines and lifecycle events are in the sanitized JSON. Full raw responses stay local.

Lifecycle: {"subscription":{"requestedAt":1790026151479,"ackAt":1790026151527,"sid":2,"lastSequence":null},"faults":[],"relevantEvents":0,"ignoredEvents":0,"limits":{"total":2048,"perMarket":32}}. Initialization is not atomic; absence of deactivation does not establish active status.

AOC review: UNRESOLVED. See [clause comparison](../aoc-contract-review-20260921.json) and [method](README.md). Deadline/timezone and issuance/source precedence are unresolved; exceptional payouts are not proven complementary. Other contracts were not reviewed in this bounded checkpoint.

The existing run is stopped. No restart or retuning was performed.
