# Human-reviewed quote economics — October 1, 2026

These are the best retained native normal-fee quotes for each manually reviewed ordinary/basis route/orientation. They are historical quotes, not fills, returns or realized profit. All 34 rows remain settlement-unverified; all fail the retained extreme-fragmentation fee stress. Account fee precision is unconfirmed. No portfolio profit is obtained by adding these rows.

Darts rows 25/32/33 are the same nominal fixture and are correlated orientation hypotheses, with a 25-minute PM metadata timing discrepancy. Original question titles align at 16:00 UTC on October 1; repeat-fixture identity is not certified. If that nominal binding is held unresolved, omit all three from the valid economics cohort. Nebraska is the strongest reviewed basis quote without this extra event-binding gap. Ordinary alignment does not establish strict settlement equivalence.

The freeze is $50 simulated capital per venue and $5 total paired commitment. Consumed depth is shown per native price level in dollars; both entry books, full available depth, transaction/receipt times, exchange ages, fee coefficients and source are preserved in [valid-economics.json](valid-economics.json). Negative exchange ages of tens of milliseconds reflect observed cross-clock offsets within the unchanged one-second clock tolerance, not fabricated prices. The entry quote and initial signal timestamps are retained separately. [Arithmetic audit](arithmetic-audit.json) verifies all 120 reviewed quote records against the unchanged normal-fee formula and stored acquisition/gross/net identities.

Money below is per quoted paired quantity. “Fee K/P” gives each modeled leg fee; acquisition is quantity minus gross. Book ages are receipt ages K/P in milliseconds; the JSON also retains exchange/cache/request ages. Confirm latency is initial-signal-to-confirmation, not a fill latency. Exact propositions, native clauses, source hashes, classification rationale and settlement differences accompany every row in the JSON.

| Audit row | Exact Kalshi / PM-US market IDs | Orientation | Qty | Consumed K / P depth @ price | Gross | Fee K/P | Normal-fee net | Quote EDT | Book ages K/P ms | Confirm ms |
| --- | --- | --- | ---: | --- | ---: | --- | ---: | --- | --- | ---: |
| 25 | KXDARTSMATCH-26OCT011200PRASHWAR-HWAR / aec-modus-petras-harwar-2026-10-01 | kalshi_yes+pm_us_yes | 5 | 5 @ 0.8400 / 3.73 @ 0.0500, 1.27 @ 0.1200 | $0.4611 | $0.05 / $0.02 | $0.3911 | 12:41:13.291 | 32 / 1178 | 5 |
| 27 | KXNCAAFWINS-26NEB-7 / aachc-cfb-wins-ou-2026-11-28-nebr | kalshi_no+pm_us_yes | 5 | 5 @ 0.2500 / 5 @ 0.6500 | $0.5 | $0.07 / $0.08 | $0.35 | 12:28:11.846 | 5 / 1129 | 1 |
| 32 | KXDARTSMATCH-26OCT011200PRASHWAR-PRAS / aec-modus-petras-harwar-2026-10-01 | kalshi_yes+pm_us_no | 5 | 5 @ 0.0100 / 2.99 @ 0.9300, 2.01 @ 0.9500 | $0.2598 | $0.01 / $0.02 | $0.2298 | 12:43:33.581 | 19 / 270 | 2 |
| 33 | KXDARTSMATCH-26OCT011200PRASHWAR-HWAR / aec-modus-petras-harwar-2026-10-01 | kalshi_no+pm_us_no | 5 | 5 @ 0.0100 / 2.99 @ 0.9300, 2.01 @ 0.9500 | $0.2598 | $0.01 / $0.02 | $0.2298 | 12:43:33.582 | 14 / 271 | 4 |
| 35 | KXNCAAFWINS-26UCLA-7 / aachc-cfb-wins-ou-2026-11-28-ucla | kalshi_no+pm_us_yes | 5 | 5 @ 0.1700 / 5 @ 0.7700 | $0.3 | $0.05 / $0.06 | $0.19 | 12:26:10.891 | 762 / 11 | 1 |
| 36 | KXNCAAFWINS-26UTAH-9 / aachc-cfb-wins-ou-2026-11-28-utah | kalshi_no+pm_us_yes | 5 | 1 @ 0.1700, 4 @ 0.1800 / 5 @ 0.7600 | $0.31 | $0.06 / $0.06 | $0.19 | 12:32:59.966 | 143 / 24 | 3 |
| 37 | KXNCAAFWINS-26OKLA-8 / aachc-cfb-wins-ou-2026-11-28-okl | kalshi_yes+pm_us_no | 5 | 5 @ 0.1800 / 5 @ 0.7600 | $0.3 | $0.06 / $0.06 | $0.18 | 12:32:50.772 | 40 / 1279 | 5 |
| 38 | KXTIME-26-DAR / tpoyc-2026-daramo | kalshi_yes+pm_us_no | 5 | 5 @ 0.0800 / 5 @ 0.8700 | $0.25 | $0.03 / $0.04 | $0.18 | 12:53:43.684 | 971 / 18 | 3 |
| 41 | KXNHLWEST-27-ANA / tec-nhl-westconf-2027-05-19-w-ana | kalshi_yes+pm_us_no | 5 | 5 @ 0.0400 / 5 @ 0.9200 | $0.2 | $0.02 / $0.03 | $0.15 | 12:29:05.157 | 12 / 1546 | 1 |
| 42 | KXNCAAFFINALIST-27-TTU / aqc-cfb-cfp-2027-01-25-finalq-txtech | kalshi_no+pm_us_yes | 5 | 5 @ 0.9100 / 5 @ 0.0500 | $0.2 | $0.03 / $0.02 | $0.15 | 12:38:41.583 | 390 / 28 | 0 |
| 43 | KXNCAAFSBELT-26-TROY / tec-cfb-sbeltchamp-2026-12-04-w-troy | kalshi_yes+pm_us_no | 5 | 5 @ 0.0500 / 5 @ 0.9100 | $0.2 | $0.02 / $0.03 | $0.15 | 12:32:48.416 | 5 / 88 | 2 |
| 44 | KXOSCARACTO-27-ROB / tac-oscars-03-14-2027-bestacto-robpat | kalshi_yes+pm_us_no | 5 | 5 @ 0.0700 / 5 @ 0.8900 | $0.2 | $0.03 / $0.03 | $0.14 | 12:29:21.688 | 1534 / 26 | 2 |
| 49 | KXNCAAFWINS-26NW-6 / aachc-cfb-wins-2026-11-28-nw-5pt5wins | kalshi_yes+pm_us_no | 4 | 4 @ 0.7100 / 4 @ 0.2300 | $0.24 | $0.06 / $0.05 | $0.13 | 12:52:43.690 | 7 / 540 | 2 |
| 50 | KXNCAAFWINS-26HOU-9 / aachc-cfb-wins-2026-11-28-hou-8pt5wins | kalshi_yes+pm_us_no | 5 | 5 @ 0.5200 / 5 @ 0.4200 | $0.3 | $0.09 / $0.08 | $0.13 | 12:46:24.644 | 486 / 26 | 1 |
| 51 | KXNCAAFWINS-26MIZZ-7 / aachc-cfb-wins-2026-11-28-missr-6pt5wins | kalshi_yes+pm_us_no | 5 | 5 @ 0.4200 / 5 @ 0.5200 | $0.3 | $0.09 / $0.09 | $0.12 | 12:34:26.471 | 8 / 1021 | 1 |
| 52 | KXNCAAFAAC-26-UTSA / tec-cfb-aacchamp-2026-12-05-w-utsa | kalshi_yes+pm_us_no | 5 | 5 @ 0.2100 / 5 @ 0.7400 | $0.25 | $0.06 / $0.07 | $0.12 | 12:48:20.761 | 23 / 437 | 6 |
| 53 | KXNCAAFSBELT-26-USA / tec-cfb-sbeltchamp-2026-12-04-w-sala | kalshi_yes+pm_us_no | 5 | 5 @ 0.0500 / 0.99 @ 0.9100, 4.01 @ 0.9200 | $0.1599 | $0.02 / $0.03 | $0.1099 | 12:30:59.193 | 30 / 197 | 3 |
| 54 | KXNCAAFCUSA-26-KENN / tec-cfb-cusachamp-2026-12-04-w-kenest | kalshi_yes+pm_us_no | 5 | 5 @ 0.0600 / 5 @ 0.9100 | $0.15 | $0.02 / $0.03 | $0.1 | 12:48:22.771 | 30 / 30 | 5 |
| 55 | KXNCAAFWINS-26UNC-7 / aachc-cfb-wins-2026-11-28-ncar-6pt5wins | kalshi_yes+pm_us_no | 5 | 5 @ 0.2900 / 5 @ 0.6600 | $0.25 | $0.08 / $0.08 | $0.09 | 12:26:20.467 | 359 / 22 | 1 |
| 56 | KXNCAAFAACQUAL-26-UTSA / aqc-cfb-aac-2026-12-05-champq-utsa | kalshi_no+pm_us_yes | 5 | 5 @ 0.6400 / 5 @ 0.3100 | $0.25 | $0.09 / $0.07 | $0.09 | 12:32:26.237 | 358 / 7 | 0 |
| 57 | KXNCAAFUNDEFEATED-26-MIA / aachc-cfb-undefeated-2026-11-28-mia | kalshi_yes+pm_us_no | 5 | 5 @ 0.2900 / 5 @ 0.6600 | $0.25 | $0.08 / $0.08 | $0.09 | 12:50:37.727 | 18 / 76 | 0 |
| 58 | KXNCAAFWINS-26PITT-8 / aachc-cfb-wins-2026-11-28-pitt-7pt5wins | kalshi_no+pm_us_yes | 5 | 5 @ 0.2800 / 5 @ 0.6700 | $0.25 | $0.08 / $0.08 | $0.09 | 12:52:55.127 | 1052 / 21 | 1 |
| 59 | KXNCAAFWINS-26VT-7 / aachc-cfb-wins-ou-2026-11-28-vtech | kalshi_no+pm_us_yes | 5 | 5 @ 0.1700 / 5 @ 0.7900 | $0.2 | $0.05 / $0.06 | $0.09 | 12:54:22.041 | 24 / 576 | 2 |
| 60 | KXLEADERNFLRUSHYDS-27-DHENRY22 / aachc-nfl-mostrushyds-2027-01-10-derhen | kalshi_no+pm_us_yes | 5 | 5 @ 0.8600 / 1.81 @ 0.1000, 2.85 @ 0.1100, 0.34 @ 0.1300 | $0.1613 | $0.05 / $0.03 | $0.0813 | 12:46:24.098 | 1270 / 75 | 12 |
| 61 | KXNCAAFPAC12QUAL-26-FRES / aqc-cfb-pac12-2026-12-04-champq-frest | kalshi_yes+pm_us_no | 5 | 5 @ 0.1900 / 5 @ 0.7700 | $0.2 | $0.06 / $0.06 | $0.08 | 12:48:31.053 | 22 / 524 | 3 |
| 62 | KXNCAAFWINS-26USC-8 / aachc-cfb-wins-2026-11-28-usc-7pt5wins | kalshi_yes+pm_us_no | 5 | 5 @ 0.5600 / 5 @ 0.3900 | $0.25 | $0.09 / $0.08 | $0.08 | 12:30:54.913 | 210 / 18 | 1 |
| 63 | KXNCAAFWINS-26SCAR-7 / aachc-cfb-wins-ou-2026-11-28-sc | kalshi_yes+pm_us_no | 5 | 5 @ 0.1800 / 5 @ 0.7800 | $0.2 | $0.06 / $0.06 | $0.08 | 12:41:24.724 | 11 / 1604 | 4 |
| 64 | KXLEADERNFLPTDS-27-LJACKSON8 / aachc-nfl-mostpasstds-2027-01-10-lamjac | kalshi_no+pm_us_yes | 5 | 5 @ 0.9700 / 5 @ 0.0100 | $0.1 | $0.02 / $0 | $0.08 | 12:45:38.101 | 1778 / 77 | 1 |
| 65 | KXNCAAFWINS-26CIN-5 / aachc-cfb-wins-2026-11-28-cin-4pt5wins | kalshi_yes+pm_us_no | 5 | 5 @ 0.8900 / 5 @ 0.0800 | $0.15 | $0.04 / $0.03 | $0.08 | 12:51:36.383 | 23 / 1161 | 3 |
| 66 | KXNHLEAST-27-BUF / tec-nhl-eastconf-2027-05-19-w-buf | kalshi_no+pm_us_yes | 5 | 5 @ 0.9400 / 5 @ 0.0400 | $0.1 | $0.02 / $0.01 | $0.07 | 12:28:52.006 | 339 / 31 | 2 |
| 67 | KXNHLWEST-27-MIN / tec-nhl-westconf-2027-05-19-w-min | kalshi_yes+pm_us_no | 5 | 5 @ 0.1000 / 5 @ 0.8700 | $0.15 | $0.04 / $0.04 | $0.07 | 12:29:05.549 | 23 / 30 | 1 |
| 68 | KXNCAAFWINS-26ND-8 / aachc-cfb-wins-2026-11-28-nd-7pt5wins | kalshi_yes+pm_us_no | 5 | 5 @ 0.9600 / 5 @ 0.0200 | $0.1 | $0.02 / $0.01 | $0.07 | 12:30:39.750 | 16 / 146 | 1 |
| 69 | KXNCAAFWINS-26TTU-8 / aachc-cfb-wins-2026-11-28-txtech-7pt5wins | kalshi_yes+pm_us_no | 5 | 5 @ 0.9600 / 5 @ 0.0200 | $0.1 | $0.02 / $0.01 | $0.07 | 12:45:41.962 | 1204 / 19 | 3 |
| 70 | KXNCAAFCUSA-26-FIU / tec-cfb-cusachamp-2026-12-04-w-flint | kalshi_no+pm_us_yes | 5 | 5 @ 0.9400 / 5 @ 0.0400 | $0.1 | $0.02 / $0.01 | $0.07 | 12:52:15.198 | 18 / 638 | 2 |

Retained first-leg exposure gate blocks audit rows 50, 51, 62. Other positive quote flags do not override settlement, fee-stress, eligibility or live-launch gates. No paper fill/recovery experiment was performed. The same quote cannot be repeatedly harvested without new execution evidence.
