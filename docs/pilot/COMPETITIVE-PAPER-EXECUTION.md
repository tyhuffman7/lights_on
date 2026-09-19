# Competitive paper execution checkpoint

This checkpoint connects current Kalshi and Polymarket US market data to the existing persistent paper ledger. It does not submit real orders. A quoted edge is not a fill, and a matched paper entry is not realized profit until settlement or an evidenced exit.

## What changed

- College-football full-game point totals now obtain missing team identities from the public parent event. Enrichment checks market membership, the exact line, schedule, two distinct team IDs and event team abbreviations. It retains the event source in identity metadata. Event-list display titles are normalized consistently with individual market responses.
- A narrow conditional settlement profile checks both team-name clauses, the same half-point threshold, game date, full-game period, Over/Under orientation and overtime inclusion. This is not blanket sports approval. Kalshi's 48-hour postponement and 55-minute/finality provisions are not proven equivalent to Polymarket US rules; independent fair-price payouts and revisions remain risks.
- The maker planner can bid farther inside a wide spread, up to the highest integer-cent price that still passes the existing quote checks. It never bids at or above the current ask. The previous one-tick planner remains available for research comparison.
- Recent valid, distinct trade activity prioritizes affected pairs ahead of the ordinary bounded evaluation queue. This fixes a demonstrated case in which an active market behind 40 idle markets was not evaluated before an idle order was selected. Historical activity ranks candidates; it never fills a new order.
- Separate fill and hedge diagnostics retain credited trade IDs, quantities, modeled hedge deadlines, actual hedge evaluation times, costs, fees and the exact stream book used for the hedge.

## Retained execution assumptions

- Existing paper bankroll: $50 per venue. Maximum pair commitment $10; total commitment $40; daily realized loss stop $5.
- Minimum quoted profit $0.10 and minimum net return 1%, after fees and a $0.02-per-contract execution reserve.
- One outstanding simulated maker order at a time. Orders expire two seconds after placement, with a modeled 500ms placement delay and post-only validation on arrival. This checkpoint does not implement multiple simultaneous resting orders or a longer order lifetime.
- The worker requires healthy, sequence-valid stream books within the existing two-second freshness limit. REST indications do not become strict stream evidence, and source timestamps are not rewritten.
- Original NTP uncertainty bounds must permit a public trade to occur after activation and before expiry. Queue advancement uses eligible printed volume; cancellations and touches are not credited as fills.
- The second leg waits a modeled 500ms after a credited first fill and uses current hedge depth within the reserved budget. Partial exposure, unavailable hedges and restart recovery remain explicit, with entry halts when required.
- Fresh public Kalshi maker fee profiles support the documented standard coefficients. Unknown profiles fall back to conservative taker fees. Fractional debit rounding is bounded conservatively; this is not certification of real exchange fee behavior.
- `maker-run` tests resting first-leg orders followed by a taking hedge. The separate existing `run` mode tests taking both legs. The maker worker does not silently claim to exercise the taker path.

## Validation and evidence

The latest code checkpoint passed 248 tests, TypeScript checking and the production build. Coverage includes ambiguous/missing event context, differing endpoint titles, contradictory totals rules, highest-eligible-price checks, queue priority, post-only activation, delayed hedges, fractional exposure, shutdown and restart accounting. Synthetic tests are not actual-market profit evidence.

Completed actual-market sessions before the latest extended run:

| Session | Seconds | Public prints | Resting orders | Paper positions |
|---|---:|---:|---:|---:|
| ab6c36b3-456f-47b8-98f5-1c3221f7eb9c | 1292.362 | 5010 | 515 | 0 |
| 7483d760-a809-43bc-aa6f-db364b046f69 | 445.042 | 1802 | 163 | 0 |
| 44b2b752-99c9-4b1d-a01a-1241809a9981 | 321.453 | 915 | 129 | 0 |

The latest extended run is recorded separately in the research database; consult `docs/research/HANDOFF.md` and `work/unattended/status.json` for its current state. Do not infer its final result from this table.

The prepared read-only audit at `work/unattended/audit-profit.mjs` refuses active sessions. It is intended to reconstruct queue fills from the captured public tape and reproduce the delayed hedge's recorded costs, fees and cash accounting. It has not yet demonstrated a profitable actual-market entry. Any audit failure must be investigated, not suppressed to report profit.

## Running and inspecting

From the repository, with the existing research credentials available and no competing worker holding either database lease:

```sh
npm run paper -- maker-run work/fee-replay/capture.config.json research-data/paper-bot.sqlite 600
npm run paper -- status research-data/paper-bot.sqlite
```

The work-directory config disables broad discovery for a focused execution test. Existing mappings and conditional approvals are preserved. The headless worker does not depend on keeping a dashboard page open. Stop and drain it before tests, builds, replay, approval changes or database maintenance. Raw research data is local and is not backed up by pushing source code to GitHub.

## Sources reviewed

- Kalshi series metadata and [FOOTBALLTOTALS terms](https://assets.kalshi.com/contract_terms/FOOTBALLTOTALS.pdf).
- [Polymarket US event API](https://docs.polymarket.us/api-reference/events/get-event-by-slug) and current event/market rule responses.
- [Kalshi fee schedule](https://kalshi.com/docs/kalshi-fee-schedule.pdf) and [fractional rounding](https://docs.kalshi.com/getting_started/fee_rounding).
- [Kalshi queue priority](https://docs.kalshi.com/api-reference/orders/get-order-queue-position).
- [HftBacktest order-fill documentation](https://hftbacktest.readthedocs.io/en/latest/order_fill.html), for comparison of conservative queue assumptions and the limits of market-data-only simulation.
