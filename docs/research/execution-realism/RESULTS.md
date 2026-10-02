# Execution realism checkpoint

The frozen conservative $10/100 ms baseline admits 59 attempts: 16 clean pairs, 2 partial hedges, 39 failed cap/edge hedges and 2 unobserved second legs. Known ordinary subtotal is **-$6.7893**, with **$26.57 unpriced exposure** across 7 entries; full modeled P&L/ROI is unavailable. Eighteen paired positions have an 80.6-day median maturity proxy. This evidence does not justify a tiny live-money pilot. All 384 episodes are basis-risk, zero strict.

3.000 hours; 384 conservative unique economic episodes (2092 freshness capture segments), 127.99 episodes/hour including initial inventory. 163 witnessed returns on 80 recurring routes.

Bounded public-book scenarios, no actual fills. Basis P&L assumes ordinary complementary settlement. Frequency includes left-censored initial inventory. No inferred fill/basis-divergence probability.

Classes: {"ORDINARY_EQUIVALENT_BASIS_RISK":384}. Families: {"statistic-leader":14,"reality-placement":6,"player-statistic":258,"ceremony-award":4,"season-wins":76,"annual-chart-ranking":2,"qualification":11,"championship":10,"named-list-award":1,"economic-release":2}.

## Execution survival — first eligible $10-cap sample per economic episode

| Model | Delay ms | Eligible | Clean | Partial | Failed hedge | Unwind | Orphan | Unobserved hedge | Unobserved unwind | Reduced first fill | Retained edge | Reduced edge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| DISPLAYED | 0 | 378 | 378 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 378 | 0 |
| DISPLAYED | 10 | 378 | 367 | 0 | 1 | 1 | 0 | 10 | 0 | 0 | 367 | 0 |
| DISPLAYED | 25 | 378 | 347 | 1 | 20 | 14 | 3 | 10 | 4 | 0 | 347 | 0 |
| DISPLAYED | 50 | 378 | 324 | 1 | 37 | 27 | 3 | 16 | 8 | 0 | 322 | 2 |
| DISPLAYED | 100 | 378 | 261 | 2 | 95 | 84 | 5 | 20 | 8 | 0 | 254 | 7 |
| DISPLAYED | 250 | 378 | 204 | 2 | 143 | 118 | 9 | 29 | 18 | 0 | 198 | 6 |
| DISPLAYED | 500 | 378 | 189 | 1 | 155 | 129 | 10 | 33 | 17 | 0 | 183 | 6 |
| DISPLAYED | 1000 | 378 | 178 | 1 | 151 | 126 | 12 | 48 | 14 | 0 | 171 | 8 |
| HAIRCUT_50 | 0 | 378 | 96 | 22 | 260 | 242 | 3 | 0 | 37 | 1 | 61 | 38 |
| HAIRCUT_50 | 10 | 378 | 95 | 22 | 251 | 240 | 3 | 10 | 30 | 1 | 60 | 38 |
| HAIRCUT_50 | 25 | 378 | 90 | 19 | 259 | 241 | 5 | 10 | 32 | 1 | 58 | 35 |
| HAIRCUT_50 | 50 | 378 | 84 | 19 | 259 | 237 | 4 | 16 | 37 | 1 | 55 | 32 |
| HAIRCUT_50 | 100 | 378 | 70 | 17 | 271 | 244 | 7 | 20 | 37 | 1 | 47 | 26 |
| HAIRCUT_50 | 250 | 378 | 62 | 15 | 272 | 238 | 9 | 29 | 40 | 1 | 41 | 23 |
| HAIRCUT_50 | 500 | 378 | 62 | 12 | 271 | 236 | 11 | 33 | 36 | 1 | 41 | 23 |
| HAIRCUT_50 | 1000 | 378 | 57 | 15 | 258 | 219 | 13 | 48 | 41 | 1 | 39 | 20 |

## Alternative $200 portfolios — 100 ms

$100 simulated cash per venue, no settlement recycling, chronological entries, held-market overlap suppression, observed unwind proceeds returned. Caps are alternative portfolios, never summed.

| Model | Paired cap | Entries | Committed | Peak locked | Ordinary gross | Fees | Slippage diagnostic | Unwind loss | Known net subtotal | Full modeled net | ROI committed | ROI peak | Mean / median entry | Worst | Median lockup days |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| DISPLAYED | $5 | 59 | $203.2015 | $196.3115 | $6.9285 | $5.6900 | $1.8615 | $1.3700 | $1.3185 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-0.4500 | 80.1 |
| DISPLAYED | $10 | 41 | $212.1837 | $197.4437 | $6.1663 | $5.3000 | $1.1237 | $1.6000 | $0.9563 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-0.6300 | 80.6 |
| DISPLAYED | $25 | 22 | $193.7080 | $171.0880 | $6.7936 | $5.4116 | $0.9364 | $2.5300 | $1.3820 | $1.3820 | 0.71% | 0.81% | $0.0628 / $0.0090 | $-1.5500 | 15.0 |
| DISPLAYED | $50 | 9 | $136.2201 | $113.9001 | $3.5999 | $3.2300 | $1.2001 | $2.7300 | $0.3699 | $0.3699 | 0.27% | 0.32% | $0.0411 / $0.0099 | $-2.3700 | 15.0 |
| HAIRCUT_50 | $5 | 105 | $256.2351 | $187.7351 | $0.8138 | $8.9640 | $1.5849 | $10.1700 | $-7.9351 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-0.8500 | 15.0 |
| HAIRCUT_50 | $10 | 59 | $256.3393 | $189.9493 | $1.6348 | $8.7591 | $1.4037 | $9.4100 | $-6.7893 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-1.4000 | 79.1 |
| HAIRCUT_50 | $25 | 32 | $206.4829 | $170.9629 | $-2.6521 | $6.0008 | $1.7270 | $11.0300 | $-8.5629 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-3.1700 | 15.0 |
| HAIRCUT_50 | $50 | 16 | $182.0600 | $150.4500 | $1.6400 | $4.2000 | $2.6750 | $4.6800 | $-2.4800 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-3.1800 | 15.0 |
| ONE_TICK | $5 | 152 | $295.6644 | $139.0144 | $-14.6633 | $13.0011 | $6.3233 | $28.2200 | $-26.9544 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-1.1100 | 15.0 |
| ONE_TICK | $10 | 107 | $312.1658 | $157.2358 | $-18.1935 | $13.8523 | $7.9587 | $32.8200 | $-31.6158 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-2.2600 | 15.0 |
| ONE_TICK | $25 | 35 | $195.1954 | $155.1454 | $-6.8534 | $7.1320 | $4.6138 | $15.3700 | $-13.8154 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-3.4900 | 15.0 |
| ONE_TICK | $50 | 19 | $310.4800 | $149.4000 | $-11.5454 | $6.8046 | $5.8100 | $19.0700 | $-18.1000 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-7.0600 | 15.0 |
| FEE_LEVEL_DIAGNOSTIC | $5 | 59 | $203.2015 | $196.3115 | $6.9285 | $5.6900 | $1.8615 | $1.3700 | $1.3185 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-0.4500 | 80.1 |
| FEE_LEVEL_DIAGNOSTIC | $10 | 41 | $208.0037 | $189.5637 | $5.9663 | $5.6200 | $1.1237 | $2.0000 | $0.4363 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-0.6300 | 80.6 |
| FEE_LEVEL_DIAGNOSTIC | $25 | 22 | $193.7080 | $171.0880 | $6.7936 | $5.4116 | $0.9364 | $2.5300 | $1.3820 | $1.3820 | 0.71% | 0.81% | $0.0628 / $0.0090 | $-1.5500 | 15.0 |
| FEE_LEVEL_DIAGNOSTIC | $50 | 9 | $136.2201 | $113.9001 | $3.5999 | $3.2300 | $1.2001 | $2.7300 | $0.3699 | $0.3699 | 0.27% | 0.32% | $0.0411 / $0.0099 | $-2.3700 | 15.0 |
| EXTREME_FRAGMENT_DIAGNOSTIC | $5 | 35 | $100.0000 | $15.0000 | $-3.0400 | $93.3000 | $0.0500 | $93.0000 | $-93.0000 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-5.0000 | 15.0 |
| EXTREME_FRAGMENT_DIAGNOSTIC | $10 | 26 | $100.0000 | $15.0000 | $-2.6600 | $94.7700 | $0.0500 | $95.0000 | $-95.0000 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-10.0000 | 15.0 |
| EXTREME_FRAGMENT_DIAGNOSTIC | $25 | 18 | $100.0000 | $30.0000 | $-2.4600 | $94.9700 | $0.0500 | $95.0000 | $-95.0000 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-25.0000 | 15.0 |
| EXTREME_FRAGMENT_DIAGNOSTIC | $50 | 26 | $100.0000 | $56.0000 | $-2.5700 | $93.9100 | $0.0500 | $94.0000 | $-94.0000 | UNOBSERVED | UNOBSERVED | UNOBSERVED | UNOBSERVED / UNOBSERVED | $-37.0000 | 15.0 |

Gross already includes actual consumed depth and observed price movement; slippage and unwind columns explain modeled P&L and must not be subtracted twice. Unobserved hedge/residual valuation makes full net and ROI null. Unknown settlement horizons remain locked indefinitely; finite horizons are later native close + 24h proxies, not observed settlement.

## Negative modeled trades

All negative fully priced execution outcomes, including trades rejected by portfolio capital, appear in report survival rows. Each accepted negative trade is listed below; incomplete exposure is separately unpriced.

- DISPLAYED, $5 cap, episode 15: $-0.0296, PARTIAL_HEDGE / UNWIND.
- DISPLAYED, $5 cap, episode 25: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $5 cap, episode 31: $-0.1600, PARTIAL_HEDGE / UNWIND.
- DISPLAYED, $5 cap, episode 37: $-0.4500, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $5 cap, episode 78: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $5 cap, episode 131: $-0.2300, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $5 cap, episode 143: $-0.1400, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $10 cap, episode 15: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $10 cap, episode 25: $-0.6300, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $10 cap, episode 31: $-0.1600, PARTIAL_HEDGE / UNWIND.
- DISPLAYED, $10 cap, episode 37: $-0.4500, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $10 cap, episode 78: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $25 cap, episode 15: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $25 cap, episode 25: $-1.5500, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $25 cap, episode 31: $-0.1600, PARTIAL_HEDGE / UNWIND.
- DISPLAYED, $25 cap, episode 37: $-0.4500, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $50 cap, episode 15: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- DISPLAYED, $50 cap, episode 25: $-2.3700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 1: $-0.1600, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 9: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 11: $-0.1300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 15: $-0.1700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 18: $-0.1000, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 25: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 28: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 30: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 31: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 33: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 36: $-0.2800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 37: $-0.4900, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 38: $-0.1200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 39: $-0.2200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 41: $-0.0400, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 45: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 47: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 62: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 67: $-0.1500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 69: $-0.0400, PARTIAL_HEDGE / UNWIND.
- HAIRCUT_50, $5 cap, episode 78: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 79: $-0.5300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 81: $-0.3100, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 96: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 99: $-0.0832, PARTIAL_HEDGE / UNWIND.
- HAIRCUT_50, $5 cap, episode 102: $-0.6300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 108: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 111: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 116: $-0.0400, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 131: $-0.2300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 136: $-0.8500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 143: $-0.1400, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 145: $-0.2800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 179: $-0.0300, PARTIAL_HEDGE / UNWIND.
- HAIRCUT_50, $5 cap, episode 183: $-0.2900, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 194: $-0.2800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 202: $-0.1700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 207: $-0.1500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 211: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 242: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 246: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 252: $-0.1100, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 258: $-0.2000, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 260: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 261: $-0.4900, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 263: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 264: $-0.2000, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 265: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 271: $-0.2100, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 272: $-0.1300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 278: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 281: $-0.0400, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 282: $-0.3800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 284: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 287: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 289: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 294: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 300: $-0.0400, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 317: $-0.0400, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 350: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $5 cap, episode 375: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 1: $-0.1600, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 9: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 11: $-0.1300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 15: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 18: $-0.1000, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 25: $-0.6300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 28: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 30: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 31: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 33: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 36: $-0.2800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 37: $-0.4900, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 38: $-0.1200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 39: $-0.2200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 41: $-0.0400, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 45: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 47: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 62: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 67: $-0.1500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 69: $-0.0400, PARTIAL_HEDGE / UNWIND.
- HAIRCUT_50, $10 cap, episode 78: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 79: $-0.8400, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 81: $-0.3100, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 96: $-0.4200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 99: $-0.3800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 102: $-0.6300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 108: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 111: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 116: $-0.0400, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 120: $-0.0823, PARTIAL_HEDGE / UNWIND.
- HAIRCUT_50, $10 cap, episode 131: $-0.2800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 136: $-1.4000, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 141: $-0.4500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 143: $-0.1400, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 145: $-0.4000, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $10 cap, episode 164: $-0.4800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 1: $-0.1600, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 9: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 11: $-0.1300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 15: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 18: $-0.1000, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 25: $-1.6500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 28: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 30: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 31: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 33: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 36: $-0.2800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 37: $-0.4900, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 38: $-0.1200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 39: $-0.2200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 41: $-0.0400, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 42: $-1.8600, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 44: $-3.1700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 45: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 47: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 62: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 67: $-0.1500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $25 cap, episode 69: $-0.0400, PARTIAL_HEDGE / UNWIND.
- HAIRCUT_50, $25 cap, episode 617: $-1.2451, PARTIAL_HEDGE / UNWIND.
- HAIRCUT_50, $50 cap, episode 1: $-0.1600, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $50 cap, episode 9: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $50 cap, episode 11: $-0.1300, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $50 cap, episode 15: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $50 cap, episode 18: $-0.1000, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $50 cap, episode 25: $-3.1800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $50 cap, episode 28: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $50 cap, episode 30: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $50 cap, episode 31: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- HAIRCUT_50, $50 cap, episode 33: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $5 cap, episode 15: $-0.0296, PARTIAL_HEDGE / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $5 cap, episode 25: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $5 cap, episode 31: $-0.1600, PARTIAL_HEDGE / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $5 cap, episode 37: $-0.4500, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $5 cap, episode 78: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $5 cap, episode 131: $-0.2300, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $5 cap, episode 143: $-0.1400, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $10 cap, episode 15: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $10 cap, episode 25: $-0.6300, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $10 cap, episode 31: $-0.1600, PARTIAL_HEDGE / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $10 cap, episode 37: $-0.4500, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $10 cap, episode 78: $-0.0300, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $10 cap, episode 96: $-0.4000, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $25 cap, episode 15: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $25 cap, episode 25: $-1.5500, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $25 cap, episode 31: $-0.1600, PARTIAL_HEDGE / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $25 cap, episode 37: $-0.4500, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $50 cap, episode 15: $-0.3200, EDGE_DISAPPEARED / UNWIND.
- FEE_LEVEL_DIAGNOSTIC, $50 cap, episode 25: $-2.3700, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 1: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 9: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 11: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 12: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 15: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 18: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 25: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 28: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 30: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 31: $-4.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 33: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 34: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 36: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 37: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 38: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 39: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 41: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 42: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 44: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 45: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 47: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 62: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 66: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 67: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 69: $-4.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 71: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 78: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 79: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 108: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $5 cap, episode 111: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 1: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 9: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 11: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 12: $-10.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 15: $-10.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 18: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 25: $-10.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 28: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 30: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 31: $-4.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 33: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 34: $-10.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 36: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 37: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 38: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 39: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 41: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 42: $-10.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 45: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 47: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 62: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 67: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $10 cap, episode 69: $-4.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 1: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 9: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 11: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 15: $-10.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 18: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 25: $-25.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 28: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 30: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 31: $-4.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 33: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 34: $-25.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 36: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 37: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 38: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $25 cap, episode 39: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 1: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 9: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 11: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 15: $-10.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 18: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 25: $-37.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 28: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 30: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 31: $-4.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 33: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 36: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 37: $-5.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 38: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 39: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 41: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 45: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 47: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 62: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 67: $-2.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 69: $-4.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 78: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- EXTREME_FRAGMENT_DIAGNOSTIC, $50 cap, episode 108: $-1.0000, EDGE_DISAPPEARED / UNWIND.

## Representative trades and basis clauses

- Episode 71: Will Auburn win at least 7 games this season?; no, paired 10/10 target contracts, modeled net $0.5900, 80.6 days lockup proxy. Native IDs: KXNCAAFWINS-26AUB-7 × aachc-cfb-wins-ou-2026-11-28-aubrn.
- Episode 136: Will Texas Tech qualify for the College Football Big 12 Championship Game?; yes, paired 0/8 target contracts, modeled net $-1.4000, 79.1 days lockup proxy. Native IDs: KXNCAAFB12QUAL-26-TTU × aqc-cfb-big12-2026-12-04-champq-txtech.

Exceptional divergence branches across admitted families: ["Modified/shortened season and cancellation: actual count versus independent fair-price settlement","Corrections and disqualification after expiry versus official-result finality","Native source precedence, review rights and administrative extensions","Different deadlines and settlement timing","Tied leaders may receive fractional payouts","Participation, nullified snaps, overtime and stat corrections","No-participation payouts use independently determined fair prices","Postponement, abandonment, venue changes and missing-data provisions require separate review","Referenced Kalshi contract terms must be reviewed; inline rules alone are incomplete","Shared awards, rescission and source finality","Publication timing, crediting, ties and revisions"]. No probability assigned.

Public books cannot identify competing takers, hidden order fragmentation or our fill priority. The deterministic depth haircut is a bounded sensitivity, not a probability. Basis exceptional clauses and native rules are retained in [basis clauses](basis-clauses.json.gz). Fee evidence and assumptions are in [methodology](METHODOLOGY.md). No real fill, realized profit or live authorization.

[Machine-readable outcomes and every portfolio entry](report.json), [raw evidence receipt](evidence-receipt.json).


## Corrected one-tick diagnostic

Correction after stop validates only consumed shifted prices. Original frozen output is retained locally. Source/entry policy, all displayed/haircut/fee scenarios, baseline and conclusion are unchanged. No market rerun or tuning.

| Delay ms | Eligible | Clean | Partial | Failed hedge | Unwind | Orphan | Unobserved terminal |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 378 | 37 | 12 | 327 | 286 | 13 | 42 |
| 10 | 378 | 37 | 12 | 317 | 283 | 13 | 45 |
| 25 | 378 | 31 | 12 | 321 | 287 | 11 | 49 |
| 50 | 378 | 25 | 12 | 322 | 282 | 10 | 61 |
| 100 | 378 | 22 | 10 | 319 | 284 | 6 | 66 |
| 250 | 378 | 24 | 9 | 305 | 269 | 4 | 81 |
| 500 | 378 | 24 | 7 | 302 | 271 | 4 | 79 |
| 1000 | 378 | 21 | 7 | 289 | 245 | 3 | 109 |

ONE_TICK accepted negative trades at 100 ms:

- $5 cap, episode 1: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 9: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 11: $-0.2400, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 15: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 18: $-0.1400, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 25: $-0.4200, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 28: $-0.1200, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 30: $-0.0900, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 31: $-0.3700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 33: $-0.0900, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 36: $-0.3800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 37: $-0.5500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 38: $-0.1600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 39: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 41: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 42: $-0.4800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 44: $-0.8100, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 45: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 47: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 62: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 66: $-0.2200, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 67: $-0.1800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 78: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 81: $-0.3900, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 96: $-0.3300, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 99: $-0.4000, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 102: $-0.7100, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 105: $-0.3100, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 108: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 111: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 113: $-0.4800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 114: $-0.4800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 115: $-0.4300, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 116: $-0.1000, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 131: $-0.3300, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 136: $-0.5080, PARTIAL_HEDGE / UNWIND.
- $5 cap, episode 141: $-0.4500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 142: $-0.4800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 143: $-0.1800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 145: $-0.3800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 156: $-0.4100, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 162: $-0.4800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 164: $-0.2900, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 173: $-0.2400, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 183: $-0.3000, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 188: $-1.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 190: $-0.5600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 191: $-0.5500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 193: $-0.3300, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 194: $-0.3800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 202: $-0.2800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 207: $-0.1900, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 211: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 226: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 242: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 246: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 252: $-0.1700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 258: $-0.2000, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 260: $-0.1000, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 261: $-0.4600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 263: $-0.1000, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 264: $-0.2900, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 265: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 270: $-0.2500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 271: $-0.3100, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 272: $-0.2000, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 274: $-0.3000, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 278: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 281: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 282: $-0.4000, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 284: $-0.3600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 286: $-0.3500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 287: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 289: $-0.1200, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 294: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 299: $-0.5200, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 300: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 317: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 326: $-0.0400, PARTIAL_HEDGE / UNWIND.
- $5 cap, episode 333: $-0.3800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 340: $-0.2100, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 344: $-0.1500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 347: $-0.2000, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 350: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 375: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 398: $-0.3700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 399: $-0.2900, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 409: $-0.1400, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 418: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 419: $-0.4600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 420: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 428: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 430: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 437: $-0.3600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 447: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 448: $-0.4500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 466: $-1.1100, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 467: $-0.1700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 470: $-0.1500, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 472: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 475: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 476: $-0.3800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 478: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 484: $-0.1100, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 496: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 498: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 501: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 534: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 535: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 538: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $5 cap, episode 588: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 1: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 9: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 11: $-0.2400, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 15: $-0.5200, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 18: $-0.1400, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 25: $-0.8300, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 28: $-0.1200, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 30: $-0.0900, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 31: $-0.3700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 33: $-0.0900, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 36: $-0.3800, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 37: $-0.5500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 38: $-0.1600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 39: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 41: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 42: $-0.9500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 44: $-1.6300, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 45: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 47: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 62: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 66: $-0.4400, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 67: $-0.1800, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 78: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 79: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 81: $-0.3900, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 96: $-0.5500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 99: $-0.4900, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 102: $-0.7100, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 105: $-0.5700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 108: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 111: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 113: $-0.9500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 114: $-0.9500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 115: $-1.0600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 116: $-0.1000, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 120: $-0.0746, PARTIAL_HEDGE / UNWIND.
- $10 cap, episode 131: $-0.4000, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 136: $-1.4800, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 141: $-0.5500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 142: $-0.9500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 143: $-0.1800, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 145: $-0.5300, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 156: $-1.0200, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 162: $-0.9500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 164: $-0.6000, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 173: $-0.4700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 183: $-0.3000, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 188: $-2.2600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 190: $-1.1200, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 191: $-1.1900, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 193: $-0.6600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 194: $-0.3800, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 202: $-0.5400, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 207: $-0.1900, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 211: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 242: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 246: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 252: $-0.1700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 258: $-0.2000, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 260: $-0.1000, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 261: $-0.4600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 263: $-0.1000, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 264: $-0.2900, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 265: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 271: $-0.3100, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 272: $-0.2000, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 274: $-0.7400, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 278: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 281: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 282: $-0.4000, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 287: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 289: $-0.1200, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 294: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 300: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 317: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 340: $-0.2100, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 344: $-0.1500, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 347: $-0.2000, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 350: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 375: $-0.0800, EDGE_DISAPPEARED / UNWIND.
- $10 cap, episode 1125: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 1: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 9: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 11: $-0.2400, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 15: $-0.5200, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 18: $-0.1400, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 25: $-2.0500, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 28: $-0.1200, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 30: $-0.0900, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 31: $-0.3700, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 33: $-0.0900, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 36: $-0.3800, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 37: $-0.5500, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 38: $-0.1600, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 39: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 41: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 42: $-2.2200, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 44: $-3.4900, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 45: $-0.0600, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 47: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 62: $-0.0500, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 66: $-1.0900, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 67: $-0.1800, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 79: $-1.0000, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 81: $-0.3900, EDGE_DISAPPEARED / UNWIND.
- $25 cap, episode 105: $-1.3600, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 1: $-0.2600, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 9: $-0.0700, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 11: $-0.2400, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 15: $-0.5200, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 18: $-0.1400, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 25: $-3.1100, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 28: $-0.1200, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 30: $-0.0900, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 31: $-0.3700, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 33: $-0.0900, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 173: $-2.3200, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 178: $-7.0600, EDGE_DISAPPEARED / UNWIND.
- $50 cap, episode 189: $-4.5200, EDGE_DISAPPEARED / UNWIND.

`EDGE_DISAPPEARED` means no positive-net hedge within the frozen original paired cap: it includes budget rejection after depth walking, even if a larger-budget hedge could still have positive net. This is a failed frozen-policy hedge, not necessarily a vanished displayed spread. Known subtotal excludes unpriced first-leg fee basis; fees column includes it. Do not compute full net by subtracting aggregate columns when exposure remains unpriced.


Capital-duration clarification: the table's median is the candidate native maturity proxy across all entries, including later-unwound trades. Conservative $10 baseline retains 18 paired positions with median maturity proxy 80.6 days; 34 fully unwound entries release their exposure at the fixed 350 ms modeled unwind target. Seven incompletely priced entries remain separate.

INSUFFICIENT EVIDENCE — accepted conservative trades have unobserved hedge or residual valuation
