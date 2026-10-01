# Paper economics — 2026-10-01

**PAPER ECONOMICS PROMISING — EXECUTABLE PROMOTED OPPORTUNITIES SURVIVE REALISTIC LATENCY**

Frozen collector/entry strategy, 42.23 minutes. Post-run reporting conservatively merges freshness-separated capture segments; sizing, entries and P&L are unchanged. Conditional native displayed taker depth, no actual fills or realized profit. Ordinary settlement assumption for basis trades; no divergence probability assigned.

The conditional execution evidence warrants further scoped **paper** work on fills and fees, but the business case remains modest: $3.18 ordinary-world profit on $182.82, with a median 80.7-day lockup proxy. This does not demonstrate repeatable profit or justify tiny live execution in this checkpoint. Strict arbs remain zero.

The fixed 45-minute request ended at **42.23 minutes (18:01:23–18:43:37 EDT)** because the frozen 1 GiB evidence guard fired. Both processes exited 0; pending confirmations/captures are zero. All claimed consumed levels, fees and arithmetic were corroborated against retained native states. The two rejected tail writes did not invalidate any claimed trade-price evidence. No restart or tuning occurred. See [verification](verification-receipt.json) and [raw evidence manifest](raw-evidence-manifest.json).

| Metric | Result |
|---|---:|
| Unique economic episodes (lower bound) | 67 |
| Freshness-bounded capture segments | 416 |
| Strict arb episodes | 0 |
| Basis-risk episodes | 67 |
| Baseline-cap eligible episodes | 65 |
| Clean pairs at 25 ms | 65 |
| Clean pairs at 100 ms | 62 |
| Clean pairs at 250 ms | 57 |
| Edge disappearances at 100 ms | 1 |
| Partial / first-only at 100 ms | 0 |
| Unobserved at 100 ms | 2 |
| Capital-admitted baseline entries | 23 |
| Paper capital committed | $182.8191 |
| Peak concurrent capital locked | $182.8191 |
| Known ordinary profit subtotal | $3.1809 |
| Modeled ordinary portfolio P&L | $3.1809 |
| Return on committed capital | 1.74% |
| Median first-entry per-contract net ($10 cap) | $0.0060 |
| Median fresh coverage segment duration | 1.89s |
| Confirmed returning route/orientations | 3 |
| Confirmed return events | 3 |
| Quote content updates (not trades) | 1117 |
| Left / right censored capture segments | 408 / 404 |

## Latency survival — first $10-cap entry in each conservative economic episode

| Delay | Eligible | Observable | Clean | Partial | Edge gone | First only | Unobserved | Clean / all |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 ms | 65 | 65 | 65 | 0 | 0 | 0 | 0 | 100.0% |
| 10 ms | 65 | 65 | 65 | 0 | 0 | 0 | 0 | 100.0% |
| 25 ms | 65 | 65 | 65 | 0 | 0 | 0 | 0 | 100.0% |
| 50 ms | 65 | 65 | 64 | 0 | 1 | 0 | 0 | 98.5% |
| 100 ms | 65 | 63 | 62 | 0 | 1 | 0 | 2 | 95.4% |
| 250 ms | 65 | 63 | 57 | 0 | 6 | 0 | 2 | 87.7% |
| 500 ms | 65 | 63 | 57 | 0 | 6 | 0 | 2 | 87.7% |
| 1000 ms | 65 | 53 | 45 | 0 | 8 | 0 | 12 | 69.2% |

At 100 ms, the first-entry diagnostic has **one conditional first-leg stranding**, followed by observed full unwind depth with a **$1.2192 modeled loss**, and two unobserved hedges carrying $11.90 of conditional first-leg cost. No partial hedge or known orphan occurred. These three attempts were excluded by baseline capital/overlap admission; all 23 admitted baseline entries were clean. At 1 second, eight edges disappeared and twelve were unobserved. Unknown hedges are not zero-loss trades.

Only **7/23** baseline entries survive one native tick adverse movement on both legs; **0/23** pass the extreme-fragmentation fee bound. Both remain diagnostics as frozen. Prices surviving 100 ms do not resolve competition, actual fee fragmentation, order acknowledgement or first-leg fill uncertainty.

## Capital sensitivity — 100 ms, $200 simulated bankroll

Each row is an alternative chronological portfolio, one entry per episode with held-market overlap suppression. Never add rows together.

| Entry cap | Entries | Clean | Committed | Peak locked | Known profit subtotal | Full P&L | ROI | Unpriced exposure |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| $5 | 45 | 44 | $201.9889 | $197.8789 | $2.5311 | $2.5311 | 1.25% | $0.0000 |
| $10 | 23 | 23 | $182.8191 | $182.8191 | $3.1809 | $3.1809 | 1.74% | $0.0000 |
| $25 | 12 | 12 | $196.3299 | $196.3299 | $2.6701 | $2.6701 | 1.36% | $0.0000 |
| $50 | 5 | 5 | $149.3575 | $149.3575 | $0.6425 | $0.6425 | 0.43% | $0.0000 |
| $100 | 2 | 2 | $103.3400 | $103.3400 | $0.6600 | $0.6600 | 0.64% | $0.0000 |

The $5 portfolio includes one observed-depth full unwind and cash reuse: cumulative acquisition commitment can exceed the $200 initial bankroll while peak concurrent locked capital stays below it. No settlement payout was recycled. All other rows had clean capital-admitted pairs only.

Families: {"season-wins":42,"ceremony-award":2,"championship":4,"qualification":5,"published-chart-ranking":1,"statistic-leader":3,"player-statistic":3,"reality-placement":4,"named-list-award":1,"annual-chart-ranking":2}. 64 route/orientations; 3 repeated; max 35 freshness segments per route. Conservative observed rate 95.2/hour includes initial inventory; it is not a new-opportunity arrival rate. Conservative lower bound: freshness gaps merged until an observed economic disappearance; unseen recurrence unknown. Full economic duration and recurrence through observation gaps are unknown.

Baseline lockup proxy: median 80.7 days, max 456.7 days, unknown horizons 0. Later native close + 24-hour assumed buffer; actual settlement/administrative extensions unproven. No settlement funds recycled.

All counts are conditional native displayed-depth simulations. Actual both-leg fills, repeatable realized net profit and rare settlement-divergence probabilities remain unproven. Strict and basis economics are separated in the machine-readable report and episode certificates. No live-money recommendation or authorization.

[Methodology](METHODOLOGY.md), [full report](report.json), [episode index](episode-index.json), [full compressed ledger](episode-ledger.json.gz), [strongest capital-admitted opportunities](representative-opportunities.json).

## Strongest capital-admitted baseline examples

| Ordinary predicate | Orientation | Quantity | Commitment | Ordinary modeled profit |
|---|---|---:|---:|---:|
| TCU at least 8 regular-season wins | Kalshi NO + PM-US YES | 10 | $9.1871 | $0.8129 |
| Auburn at least 7 regular-season wins | Kalshi NO + PM-US YES | 10 | $9.5000 | $0.5000 |
| Texas Tech reaches the national final | Kalshi NO + PM-US YES | 10 | $9.6900 | $0.3100 |
| Duke at least 6 regular-season wins | Kalshi NO + PM-US YES | 10 | $9.7300 | $0.2700 |
| Northwestern at least 6 regular-season wins | Kalshi YES + PM-US NO | 10 | $9.7440 | $0.2560 |

The examples use the actual chronological entry quote, not a later maximum reading. Full consumed fractional levels, market IDs, fees, certificate, native clauses, resolution horizons and latency outcomes are in [representatives](representative-opportunities.json) and their [native state evidence](representative-native-states.json.gz).

## Contractual basis and duration

All 67 conservative episodes are ordinary-equivalent **basis trades**, with ten families. [The 64-route native audit](native-question-audit.json) preserves each ordinary predicate, complete native market text/links and specific exceptional branches. Season-win counts exclude conference, bowl and playoff games in both ordinary predicates, but modified/shortened seasons, independent fair-price cancellation, corrections/finality and administrative extensions remain unproved equivalent. Player-statistic clauses additionally specify participation, nullified snaps, overtime, box-score finality and two-day postponement treatment on PM-US; referenced Kalshi contract terms remain explicitly unreviewed where absent inline. Statistic-leader ties can pay fractional amounts on PM-US. Awards, named lists, charts and reality placements retain source precedence, tied/shared outcomes, revisions and rescheduled-publication/finale risks. No branch probability is invented, and no basis-trade risk-adjusted expected profit is claimed.

The median **fresh coverage segment** is 1.89 seconds; it is not a full economic opportunity duration. Of 416 segments, 404 end in observation gaps and 12 in witnessed economic disappearance. Only three subsequent returns are confirmed. Full time-to-disappearance and unseen recurrence cannot be recovered across those gaps. Latency tables therefore use the first eligible capture in each of 67 conservative economic groups; 65 support the $10 entry cap. The frozen raw 413-entry-capture curve is retained separately in the machine-readable report. Capital entries and sensitivity P&L are identical before and after this reporting correction.
