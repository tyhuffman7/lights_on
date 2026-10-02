# Small Kalshi × Polymarket US paper bot

`approved pairs → live WS books → asks + fees < $1 → paper entry → bids → profitable early exit or published settlement`

Run from the repository root with Node 22.16+ and installed dependencies:

```sh
npm run bot:research -- --query='college football wins' --out=research-data/candidates.json
npm run bot:paper -- --env=.env.research
```

The bot defaults to **five minutes**, $200 simulated capital and $100 simulated cash per venue. `--seconds=600` runs ten minutes; `--pairs=PATH` selects a config; `--data=PATH` selects a ledger directory. Ctrl-C stops cleanly. Existing `KALSHI_KEY_ID`, `KALSHI_PRIVATE_KEY` (or `KALSHI_PRIVATE_KEY_PATH`), `POLYMARKET_KEY_ID` and `POLYMARKET_SECRET_KEY` supply market-stream authentication. Use an absolute key path if running from another checkout. No account, order, preview, funding or wallet endpoint exists in this runtime. Ohio eligibility remains unvalidated and live trading remains blocked.

## Files

- `config/approved-pairs.json`: 15 manually audited ordinary college-football season-win matches, review references, exact rule hashes and deadlines; capital/freshness settings.
- `paper/config.ts`: small strict config loader; duplicate markets and live mode are rejected.
- `paper/cli.ts`: two existing WS connections, book evaluation every 250 ms, metadata refresh every minute, bounded shutdown and CLI status.
- `paper/engine.ts`: two opposite-side combinations, depth/fee/capital sizing, positions, early bid exits and settlement accounting.
- `paper/markets.ts`: public native metadata, current fee coefficients, hash/deadline checks and published payouts.
- `paper/store.ts`: JSON ledger, CSV export, atomic file replacement and exclusive process lock.
- `paper/research.ts`: separate candidate research; never imported by the trading loop.

Only the existing `worker/streams.ts` transport (including its small frame/arrival helpers), `lib/research/books.ts` normalization/freshness and `lib/research/fees.ts` calculations are reused at runtime. Semantic matching, discovery, replay, databases and research evidence workers are not loaded. PR #22 is retained history.

## Paper assumptions and accounting

Both orientations buy opposite sides of the **same ordinary proposition**. Whole contracts are taken from displayed asks, cheapest first; fractional depth below one contract at each level is discarded. The maximum equal quantity with aggregate cost below quantity × $1 is selected, subject to remaining locked-capital room and each venue's simulated cash. When both directions support the same quantity, choose the cheaper one. There is no arbitrary one-contract entry reduction. The library supports at most one million contracts per quote; the default capital is much smaller.

Fees use **current native metadata**, including Kalshi event overrides. Kalshi uses the existing per-whole-contract cent-rounded upper bound; PM-US uses the existing cumulative nearest-cent, ties-to-even model. A waiver is conservatively ignored. These are paper commission assumptions: account precision and hidden fractional fragmentation are unproven. [PM-US fee rules](https://docs.polymarket.us/fees) and [Kalshi fee guidance](https://help.kalshi.com/en/articles/13823805-fees) explain the mechanics. No rebates are assumed.

Books must be valid, open, received within 2 seconds, within 1 second of each other, and have current exchange timestamps when supplied. Disconnects and sequence gaps invalidate the venue until new snapshots. Metadata must be at most 2 minutes old; unknown fees, changed native rule hashes/deadlines, missing size metadata or closed markets block entry. A pair holds at most one position. After closure it waits 30 seconds and requires newer books on **both** legs before re-entering, avoiding repeated use of an unchanged quote.

Entry assumes both displayed legs execute simultaneously at their observed depth. It does **not** prove real fills, latency, queue position, recovery or repeatable profit. Bids close the entire position only when both legs have enough depth and total proceeds after current exit fees exceed original cost including entry fees. No partial exits or recovery strategy are added.

**No strict settlement hedge was certified by the retained research.** These 15 pairs have high-confidence ordinary predicates (`>= N` regular-season wins versus `> N − 0.5`) and explicit modified/canceled-season, correction, source and deadline differences. `lockedSettlementProfit` is conditional on the ordinary $1-per-pair model, never a guaranteed or realized profit. See [the inherited contract review](../docs/research/semantic-oos/CONTRACT-REVIEW.md). Approval here is only for this paper model.

Open positions are held until an early exit or **both native venues publish final payouts**. Close/end dates alone never credit cash. Ordinary complementary outcomes pay $1 per pair. If published payouts diverge, record the actual published per-leg modeled payout, including losses; do not force $1. No settlement fee is modeled. The summary separates conditional profit on open positions, early-exit P&L and modeled settled P&L; unrealized locked profit is excluded from cumulative closed paper P&L. Cash stays venue-specific; no automatic transfer is assumed.

`research-data/simple-paper/state.json` is authoritative and resumes open positions with identical settings. `positions.csv` contains entry fields and closed P&L; JSON retains consumed levels, fee schedules, receipts, exit prices/fees and payouts. JSON prices/money use **1/10,000 USD**; CSV monetary totals use dollars. A config change requires a fresh `--data` directory; preserve the old ledger. A second process cannot acquire `bot.lock`. After a crash, verify the recorded PID is absent before manually removing that lock. CSV is regenerated from JSON on save.

## Add a pair

1. Run `bot:research`; optionally set `--series=KXNCAAFWINS --query='Nebraska wins'`. It reads current Kalshi series markets and PM-US search results, returning up to 30 token-overlap suggestions with both native questions and candidate config records. Search is bounded and reports truncation; it is not a semantic certificate. Existing native audits are linked in the seed file; no paid source is needed.
2. Review the exact participant, season, threshold, period, YES orientation and exceptional payout branches. The runtime supports same-YES-proposition pairs only; opposing-team mappings need separate review and are not supported.
3. Fetch the individual native market endpoints linked in the report and confirm the current clauses. Copy a reviewed candidate into `config/approved-pairs.json`, fill `reviewedAt`, `reviewSource` and `settlementRisk`, and verify both rules hashes/deadlines against the individual responses. The research command deliberately leaves review fields null so unreviewed suggestions cannot load.
4. Start with a new ledger directory. Never reuse either native market in two approved pairs.

Targeted checks: `npm run test:bot` (12 tests, including explicitly synthetic opportunity/exit scenarios and retained native WS normalization). Live smoke results are in [VALIDATION.md](VALIDATION.md). A quiet five-minute window is not grounds to weaken gates or fabricate entries.
