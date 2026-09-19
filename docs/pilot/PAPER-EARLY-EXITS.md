# Paper early exits

The maker bot previously waited for published settlement. The exit-only worker now checks existing holdings against current public order-book bids, including full depth, conservative sell fees, and an additional execution reserve. It makes no new entries and sends no real orders.

Run from the repository after the maker worker has stopped and drained:

```sh
npm run paper:exits -- research-data/paper-bot.sqlite 180
```

Duration is 1–3600 seconds. It holds the same exclusive paper-ledger lease as the entry worker; do not run both against the same ledger. The normal maker command now also checks exits using healthy stream books whenever no entry order is outstanding. It prioritizes an eligible exit, waits 500 ms per leg, and persists each leg before proceeding. The standalone command is useful when entry scanning is stopped. Pre-existing halts remain in place until separately reconciled.

A candidate requires total already-received proceeds plus proceeds from selling every remaining holding to exceed original entry debits by the configured minimum profit (currently $0.10). A price/line crossing alone is insufficient. An unmatched position is allowed to sell its actual holding; an eventual profit on that exposure is directional recovery, not successful paired arbitrage.

Each leg uses a new public REST book after a 500 ms modeled delay. It must still provide the full quantity at the initial limit or better and at least the initial modeled proceeds. Legs execute sequentially, with each sale persisted immediately. If the other sale fails, the first is retained, the remaining holding remains exposed, and new entries stay halted. Settlement skips legs whose proceeds were already credited. On restart, credited legs are not sold again.

This is a delayed REST-depth paper model, not exchange-confirmed execution. It assumes full-size IOC execution when sufficient displayed depth remains; it does not prove actual fills, reconstruct intra-request changes, or measure our market impact. Changes to market metadata, fee rates, or minimum quantity block exits pending review or settlement. Both exit paths now attempt recovery when an unmatched position has exactly one outstanding holding and selling it returns positive net proceeds, even at a recorded loss. They retain depth, freshness, minimum quantity, original exit limits and transport-delay checks. Existing halts remain. Positions with two outstanding legs still require the profit gate; general liquidation of partially hedged two-leg exposure is not implemented. Zero or negative net proceeds do not qualify.

Evidence stays beside the existing paper database:

- `paper-bot.sqlite.exits.jsonl`: assessments, original and refreshed books, intents, fills, failures, lifecycle.
- `paper-bot.sqlite.exit-status.json`: latest totals, positions, closed-by reason, and counts.
- The existing ledger retains entry history, per-leg exit evidence, and realized paper P&L.

Tests cover depth, bid-based net profitability, stale/future books, delay, duplicate credits, failed second-leg preservation, later settlement, and closing an unmatched holding without inventing an absent hedge.
