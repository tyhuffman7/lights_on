# Candidate confirmation — COMPLETED_BOUNDED_CONFIRMATION

Started 2026-09-21T19:16:59.938Z; observed through 2026-09-21T19:46:59.712Z; scheduled deadline 2026-09-21T19:46:59.721Z.

Routes 58; books 104/104; distinct positive candidate intervals 3; confirmation attempts 52; results {"EDGE_SURVIVED":0,"EDGE_DISAPPEARED":0,"FAILED":52}. Feed failures [].

Economic positivity, data validity, settlement equivalence, policy admission and authorization are independent fields. Orders remain disabled. Repeated updates are not new opportunities.

| Interval / pair / side | First detected UTC | Qty | Initial fee-bound surplus | Confirmation | Latest fee-bound surplus | Risk charge | Recovery K / PM | Policy blockers | Contract review |
|---|---|---:|---:|---|---:|---:|---|---|---|
| 1: KXAOCRUN-28-27JAN01::cranc-uspres28-12-31-2026-aleoca / no+yes | 2026-09-21T19:17:00.463Z | 10 | 0.1500 | FAILED: CACHED_RESPONSE, CACHE_PROVENANCE_UNRESOLVED (12 checks) | 0.1500 | 0.2000 | 0.1000 / 0.5000 | BASELINE_30_DAY_HORIZON, BASELINE_10_CENT_PROFIT_FLOOR, BASELINE_1_PERCENT_ROI, BASELINE_10_DOLLAR_ENTRY_CAP | UNRESOLVED (clause review complete) |
| 2: KXAOCRUN-28-27JAN01::cranc-uspres28-12-31-2026-aleoca / no+yes | 2026-09-21T19:24:03.375Z | 10 | 0.1500 | FAILED: CACHE_PROVENANCE_UNRESOLVED (12 checks) | 0.1500 | 0.2000 | 0.1000 / 0.5000 | BASELINE_30_DAY_HORIZON, BASELINE_10_CENT_PROFIT_FLOOR, BASELINE_1_PERCENT_ROI, BASELINE_10_DOLLAR_ENTRY_CAP | UNRESOLVED (clause review complete) |
| 3: KXAOCRUN-28-27JAN01::cranc-uspres28-12-31-2026-aleoca / no+yes | 2026-09-21T19:30:43.851Z | 10 | 0.1500 | FAILED: CACHED_RESPONSE, CACHE_PROVENANCE_UNRESOLVED (28 checks) | 0.1500 | 0.2000 | 0.1000 / 0.5000 | BASELINE_30_DAY_HORIZON, BASELINE_10_CENT_PROFIT_FLOOR, BASELINE_1_PERCENT_ROI, BASELINE_10_DOLLAR_ENTRY_CAP | UNRESOLVED (clause review complete) |

A FAILED check has unknown survival, not zero profit. Any displayed calculated surplus on a failed check is unverified, not a confirmed executable edge. A surviving fee-bound edge still needs separate settlement review and policy admission; no row authorizes trading or establishes a fill. Original and repriced quantities, prices, receipt/processing/snapshot times, request hashes and cache headers are in the sanitized JSON. Full raw responses stay local.

AOC review: UNRESOLVED. See [clause comparison](aoc-contract-review-20260921.json) and [method](CANDIDATE-CONFIRMATION.md). Deadline/timezone and issuance/source precedence are unresolved; exceptional payouts are not proven complementary. Other contracts were not reviewed in this bounded checkpoint.

The existing run is stopped. No restart or retuning was performed.

Confirmation failure reasons (overlapping): CACHED_RESPONSE: 32, CACHE_PROVENANCE_UNRESOLVED: 51, REST_OLDER_THAN_ALREADY_OBSERVED_STREAM: 19, kalshi:INGRESS_BACKLOG: 1, fetch failed: 1. Three intervals belong to one unique route; the first two ended on invalid/censored data, not demonstrated economic disappearance.

Strongest displayed taker/taker comparison per category follows. These are price comparisons, not additional confirmed candidates or fills. Fees use the documented conservative bounds; risk allowances and cash reservations remain separate.

| Category | Pair / Kalshi + PM-US sides | UTC | Qty | Fee-bound surplus USD | Price classification |
|---|---|---|---:|---:|---|
| Economics | KXU3-26SEP-T3.8::urc-usunemp-sa-september-2026-10-02-gt3pt8pct / no+yes | 2026-09-21T19:17:00.472+00:00 | 10 | -0.1200 | Nonpositive after fee bound; unconfirmed/unreviewed |
| Elections | KXAOCRUN-28-27JAN01::cranc-uspres28-12-31-2026-aleoca / no+yes | 2026-09-21T19:17:00.463+00:00 | 10 | 0.1500 | Positive, confirmation failed; review unresolved |
| Entertainment | KX1ALBUM-26DEC-BAB::ccpc-bilbrd-1album-any2026-lilbab / no+yes | 2026-09-21T19:17:00.460+00:00 | 10 | -0.0700 | Nonpositive after fee bound; unconfirmed/unreviewed |
| Politics | KXSCOURT-29-JSAU::nphc-scotus-johsau / no+yes | 2026-09-21T19:17:00.490+00:00 | 10 | -7.0900 | Nonpositive after fee bound; unconfirmed/unreviewed |
| Sports/atp | KXATPCHALLENGERMATCH-26SEP21DINDIE-DIE::aec-atp-dindin-dyldie-2026-09-21 / no+no | 2026-09-21T19:17:00.464+00:00 | 10 | -0.1500 | Nonpositive after fee bound; unconfirmed/unreviewed |
| Sports/cfb | KXNCAAFAAC-26-CHAR::tec-cfb-aacchamp-2026-12-05-w-charlt / yes+no | 2026-09-21T19:17:00.474+00:00 | 10 | -0.1100 | Nonpositive after fee bound; unconfirmed/unreviewed |
| Sports/epl | KXEPLRELEGATION-27-ARS::aachc-epl-2027-05-30-relegation-ars / no+yes | 2026-09-21T19:17:00.466+00:00 | 1 | -0.0200 | Nonpositive after fee bound; unconfirmed/unreviewed |
| Sports/kbo | KXKBOGAME-26SEP220530LOTHAN-LOT::aec-kbo-hea-lgo-2026-09-22 / yes+yes | 2026-09-21T19:17:00.476+00:00 | 10 | -0.3700 | Nonpositive after fee bound; unconfirmed/unreviewed |
| Sports/mlb | KXMLB-26-ATL::tec-mlb-champ-2026-09-27-atl / yes+no | 2026-09-21T19:17:00.485+00:00 | 10 | -0.1000 | Nonpositive after fee bound; unconfirmed/unreviewed |
| Sports/nba | KXNBAEAST1SEED-26-BKN::aachc-nba-eastseed1-2027-04-11-w-bkn / yes+no | 2026-09-21T19:17:00.478+00:00 | 10 | -0.1100 | Nonpositive after fee bound; unconfirmed/unreviewed |
| Sports/npb | KXNPBGAME-26SEP220500HANYAK-YAK::aec-npb-tys-hta-2026-09-22 / yes+no | 2026-09-21T19:17:00.478+00:00 | 10 | -0.4100 | Nonpositive after fee bound; unconfirmed/unreviewed |
| Sports/ufc | KXUFCFIGHT-26OCT03PINPUL-PUL::aec-ufc-dampin-andpul-2026-10-03 / no+no | 2026-09-21T19:18:36.320+00:00 | 10 | -0.6200 | Nonpositive after fee bound; unconfirmed/unreviewed |
| Sports/wnba | KXWNBA-26-ATL::tec-wnba-champion-2026-10-31-w-atl / no+yes | 2026-09-21T19:17:00.472+00:00 | 10 | -0.0600 | Nonpositive after fee bound; unconfirmed/unreviewed |

Coverage: refreshed only the existing category-neutral 60-route selection; 58 remained available across 13 categories. Two NPB routes were missing or closed. All 104 selected books were received; no missing subscriptions or recorded stream disconnections, and no global clock fault. Receipt coverage is not an uptime measurement and does not remove individual backlog/cache failures. This cap does not establish exhaustive listing or matching coverage.

Verification: 20 focused tests previously passed. Hosted correctness CI passed for implementation/evidence commit `0ffbb87218df1a39a46bfbd7d4814c4830547631`: [CI result](https://github.com/tyhuffman7/lights_on/actions/runs/35644068518/job/106480116600). Final report-only publication CI is pending at push; no repeated polling.
