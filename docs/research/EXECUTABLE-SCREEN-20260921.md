# Executable-price screen — completed bounded observation

Observed 2026-09-21T17:13:11.434Z through 2026-09-21T17:43:11.240Z. Scheduled hard stop: 2026-09-21T17:43:11.228Z. Completion: **COMPLETED_BOUNDED_SCREEN**. This is a new September 21 screen; the September 20 maker audit is historical.

Matched 1123 routes; selected 60 across 13 categories. Books received: 107/107. Catalog complete: true. Feed failures: {}. 1063 routes omitted by the declared finite cap.

Review classes: {"REVIEWED_PAIR":0,"CONDITIONAL_PAIR":21,"UNVERIFIED_PRICE_COMPARISON":39}. Samples: 1797; route/side observations: 431280; observations with economics: 383231; fresh taker/taker depth observations: 5672 (not unique opportunities or fills).

The table prefers the strongest fresh row in each category/route; when none exists it explicitly shows a stale/unknown-time comparison. The JSON separately retains the strongest displayed row even when a weaker fresh row exists. All values are USD for the shown quantity, under the labeled fee bounds. Recovery is reserved cash, not an expense.

| Category / route | UTC observation | Qty | Exchange net | Risk charge | Recovery cash K / PM | After risk | Freshness; exact policy rejections | Evidence |
|---|---|---:|---:|---:|---:|---:|---|---|
| Economics / T/T | 17:39:00.260 | 9 | -0.2200 | 0.1800 | 0.0900 / 0.4500 | -0.4000 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 0; 869df2637506 |
| Economics / M/T proposed bid | 17:39:00.260 | 9 | -0.1300 | 0.1800 | 0.0900 / 0.4500 | -0.3100 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 1; 869df2637506 |
| Elections / T/T | 17:29:54.558 | 9 | 0.1300 | 0.1800 | 0.0900 / 0.4500 | -0.0500 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 2; 0bb105aa1fff |
| Elections / M/T proposed bid | 17:29:54.558 | 9 | 0.4000 | 0.1800 | 0.0900 / 0.4500 | 0.2200 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON | JSON row 3; 0bb105aa1fff |
| Entertainment / T/T | 17:17:38.753 | 9 | -0.0700 | 0.1800 | 0.0900 / 0.4500 | -0.2500 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 4; a106b963f067 |
| Entertainment / M/T proposed bid | 17:24:37.211 | 10 | 1.5100 | 0.2000 | 0.1000 / 0.5000 | 1.3100 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON | JSON row 5; 58fda56b70b6 |
| Politics / T/T | 17:13:12.451 | 4 | -1.7900 | 0.0800 | 0.0400 / 0.2000 | -1.8700 | KALSHI_EXCHANGE_TIME_UNKNOWN, PM_US_EXCHANGE_TIME_STALE; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 6; b711c6c9d9a4 |
| Politics / M/T proposed bid | 17:13:12.451 | 4 | -1.7500 | 0.0800 | 0.0400 / 0.2000 | -1.8300 | KALSHI_EXCHANGE_TIME_UNKNOWN, PM_US_EXCHANGE_TIME_STALE; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 7; b711c6c9d9a4 |
| Sports/atp / T/T | 17:13:19.455 | 8 | -0.1200 | 0.1600 | 0.0800 / 0.4000 | -0.2800 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 8; 7bb6aa88484e |
| Sports/atp / M/T proposed bid | 17:13:19.455 | 9 | -0.0400 | 0.1800 | 0.0900 / 0.4500 | -0.2200 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 9; 7bb6aa88484e |
| Sports/cfb / T/T | 17:19:33.885 | 8 | -0.1700 | 0.1600 | 0.0800 / 0.4000 | -0.3300 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 10; 23e56954ed83 |
| Sports/cfb / M/T proposed bid | 17:19:33.885 | 8 | -0.0900 | 0.1600 | 0.0800 / 0.4000 | -0.2500 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 11; 23e56954ed83 |
| Sports/epl / T/T | 17:18:23.807 | 8 | -0.1300 | 0.1600 | 0.0800 / 0.4000 | -0.2900 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 12; 41d848463ff8 |
| Sports/epl / M/T proposed bid | 17:18:23.807 | 9 | 0.2100 | 0.1800 | 0.0900 / 0.4500 | 0.0300 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 13; 41d848463ff8 |
| Sports/kbo / T/T | 17:22:42.104 | 8 | -0.3000 | 0.1600 | 0.0800 / 0.4000 | -0.4600 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 14; 6375c478e061 |
| Sports/kbo / M/T proposed bid | 17:16:04.643 | 9 | -0.2300 | 0.1800 | 0.0900 / 0.4500 | -0.4100 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 15; 3c865067e90f |
| Sports/mlb / T/T | 17:42:39.510 | 8 | -0.0720 | 0.1600 | 0.0800 / 0.4000 | -0.2320 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 16; 88cd43df5891 |
| Sports/mlb / M/T proposed bid | 17:42:39.510 | 8 | -0.0640 | 0.1600 | 0.0800 / 0.4000 | -0.2240 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 17; 88cd43df5891 |
| Sports/nba / T/T | 17:13:12.451 | 8 | -0.0900 | 0.1600 | 0.0800 / 0.4000 | -0.2500 | KALSHI_EXCHANGE_TIME_UNKNOWN, PM_US_EXCHANGE_TIME_STALE; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 18; 423a231e78c2 |
| Sports/nba / M/T proposed bid | 17:13:12.451 | 8 | -0.0900 | 0.1600 | 0.0800 / 0.4000 | -0.2500 | KALSHI_EXCHANGE_TIME_UNKNOWN, PM_US_EXCHANGE_TIME_STALE; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 19; 5da284bb89e9 |
| Sports/npb / T/T | 17:34:47.971 | 8 | -0.3200 | 0.1600 | 0.0800 / 0.4000 | -0.4800 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 20; d72fd1f87435 |
| Sports/npb / M/T proposed bid | 17:18:30.816 | 9 | -0.0700 | 0.1800 | 0.0900 / 0.4500 | -0.2500 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 21; d8502354b5c0 |
| Sports/ufc / T/T | 17:13:33.470 | 8 | -0.4100 | 0.1600 | 0.0800 / 0.4000 | -0.5700 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 22; e1a8d8b49949 |
| Sports/ufc / M/T proposed bid | 17:40:50.398 | 10 | 2.8300 | 0.2000 | 0.1000 / 0.5000 | 2.6300 | FRESH; SETTLEMENT_RULES_NEED_REVIEW | JSON row 23; 40951874d078 |
| Sports/wnba / T/T | 17:29:16.517 | 9 | -0.0500 | 0.1800 | 0.0900 / 0.4500 | -0.2300 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 24; 11ad6b498727 |
| Sports/wnba / M/T proposed bid | 17:29:16.517 | 9 | 0.1300 | 0.1800 | 0.0900 / 0.4500 | -0.0500 | FRESH; SETTLEMENT_RULES_NEED_REVIEW, OUTSIDE_SETTLEMENT_HORIZON, BELOW_10_CENT_PROFIT_FLOOR, BELOW_1_PERCENT_ROI | JSON row 25; 11ad6b498727 |

All rows additionally remain ORDER_DISABLED, ACCOUNT_FEE_CLASS_AND_FRAGMENTATION_UNVERIFIED and OHIO_LIVE_ELIGIBILITY_NOT_REVALIDATED. M/T rows additionally fail RESTING_BID_IS_NOT_AVAILABLE_FILL. Settlement profile blockers, pair identities, precise sides, used prices/depth, receipt/exchange timestamps and fee provenance are in each JSON row. No realized fills or profit were measured.

Data-rejection counts: {"KALSHI_EXCHANGE_TIME_UNKNOWN":107024,"PM_US_EXCHANGE_TIME_STALE":389140,"ASK_DEPTH_MISSING":21329,"NO_NONCROSSING_BID_OR_HEDGE_DEPTH":26720,"KALSHI_RECEIPT_STALE":396136,"PM_US_RECEIPT_STALE":387304,"KALSHI_EXCHANGE_TIME_STALE":289536,"BOOKS_UNSYNCHRONIZED":349560,"PM_US_BOOK_CLOSED":10312}. These distinguish stale or missing data from absent economic edge. An unchanged book can exceed the strict freshness window even while its connection remains healthy.

Independent mechanics: 0 production versus 1 counterfactual synthetic queue fill; Kalshi four-fill fee bound $0.04 versus documented one-order $0.01 cent-class / $0.0088 direct-class scenarios; PM known four-fragment fee $0 versus $0.01 cumulative ceiling. Historical capture unchanged. See independent-mechanics-screen-20260921.json and EXECUTABLE-SCREEN.md.

Publication excludes raw books/tape, private account information, credentials and databases. The snapshot above is final only if marked COMPLETED_BOUNDED_SCREEN; otherwise completion remains pending, with no automatic restart.
