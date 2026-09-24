# EV arbitrage learning — paper only

**Status:** research and simulated execution only. No order submission is enabled. This branch is stacked on the September 23 bounded candidate-watch branch, not the PMXT experiment. Kalshi and Polymarket US data come from the repository's direct adapters and stream books. International Polymarket is outside scope.

## Why this changed

The bounded watch treated an unknown-account, one-cent-per-0.01-contract-fragment Kalshi fee **upper bound** as its fee-net admission price. Raw positive spreads were counted in a diagnostic, but none could advance to confirmation. This bound is retained for stress testing; it is not an estimate of a normal taker fee. The September 23 watch therefore established no confirmed profitable execution, while it also did not establish that actual exchange fees erase every spread.

The new path reports separate facts for every evaluated orientation and equal contract quantity:

1. `GROSS_ARB`: current visible executable L2 depth costs less than the equal-quantity complementary $1 payout. Both Kalshi YES + PM-US NO and Kalshi NO + PM-US YES are evaluated. A stale but valid book may still show a detected spread, with its age shown separately.
2. `REALISTIC_NET_POSITIVE`: gross payout minus exact consumed acquisition levels and **modeled normal** taker fees is positive. The fee estimate is explicitly labeled `UNCONFIRMED_ACCOUNT_PRECISION` until account-specific Kalshi precision and actual fills verify it.
3. `EXECUTION_EV_POSITIVE`: a first-leg-specific empirical estimate is positive **only after at least 30 paper attempts in that first-leg group and no unresolved orphan exposure**. Before then the status is `INSUFFICIENT_EMPIRICAL_SAMPLE`; gross, net and stress values remain visible.
4. A PAPER attempt may start only with current stream books, open markets, settlement not known incompatible, and the frozen bankroll limits. An ordinary-outcome bounded-basis route retains its exceptional-settlement warning. Paper fills are depth counterfactuals, never actual fills.

Stress fields are independent: extreme Kalshi fragmentation fee bound, one adverse native tick on both legs, freshness, and settlement warnings. `STRESS_SAFE = NO` cannot erase a gross or realistic-net result. A missing or bad fee model is marked unavailable rather than substituted with the stress bound.

## Fee model and units

Amounts in the ledger are integer **hundred-millionths of a US dollar**. Prices and L2 quantities each support four decimal places, so even small split levels have exact integer acquisition costs. The default paper quantity is one whole complementary contract; the pair audit accepts an explicit whole quantity. A pair is never sized by equal dollars.

The normal Kalshi estimate applies the current series coefficient to each consumed visible price level and rounds each level's quadratic fee up to the nearest cent. Visible price levels do not reveal the resting-order fill count or the user's fee balance precision; actual collected fees can differ. The PM-US estimate applies the current market coefficient to exact consumed levels and banker's-rounds their cumulative fee to cents. PM-US documents that each aggressive fill is rounded with a cumulative cap; no rebate is assumed for a small taker account. Existing integer arithmetic is used for the separate extreme Kalshi 0.01-fragment/cent-precision bound. See the [Kalshi fee schedule](https://kalshi.com/regulatory/fee-schedule) and [Polymarket US fee schedule](https://docs.polymarket.us/fees). PM-US has announced a different combo fee curve effective late September 24 ET; a future run crossing that change must verify and support the new formula before treating combo net values as current.

The fee estimate assumes one aggressive fill per visible Kalshi price level; this is an **assumption**, not an execution guarantee. The stress fee tests a much more expensive fragmentation pattern. If observed quantity has finer than 0.01-contract granularity, the inherited stress formula cannot safely represent it and the stress bound is marked unavailable; the gross and normal-net calculation still uses its exact four-decimal quantity. Gross profit, normal fees, modeled net and stress fee are distinct stored values.

## Bounded paper execution

The frozen default is $50 simulated cash per venue, $5 maximum paired commitment including modeled fees, $2 maximum first-leg exposure, one active attempt, and a $5 daily simulated realized-loss stop. Size stays at one whole contract, with no averaging or loss-based size increase. After a clean pair, simulated cash remains committed until settlement; the observer does not recycle a projected payout during the run. For each candidate, the observer alternates its primary first venue when possible and records the other order as a **counterfactual**, excluding that counterfactual from aggregate P&L and bankroll accounting.

The paper model freezes detection, waits 50 ms to observe first-entry depth, simulates the first leg only at or better than its frozen limit, waits at least 250 ms, then reprices the exact same quantity on the other venue. If the hedge is absent or more than $0.05 worse, it sells the first leg into current opposite-side bids. It records full, partial and impossible unwinds separately. A quote that vanishes before the first fill is `DISAPPEARED_BEFORE_ENTRY` with zero trading P&L. An unresolved orphan has an explicit residual quantity and cost; no outcome or orphan loss is invented. Clean-pair P&L assumes ordinary complementary settlement and is therefore **projected**, while unwind cash effects are simulated realized exits. Reported net is modeled paper P&L with open residual cost shown alongside it; it is not an account balance or realized live profit.

The append-only attempt ledger includes a stable ID, pair/market IDs, orientation, quantity, book timestamps and SHA-256 references, consumed entry levels, all fee and stress fields, both simulated legs, elapsed hedge time, slippage, unwind levels and proceeds, residual exposure, outcome, and reconciled P&L. Public L2 book bodies are stored in a separate allowlisted `books.ndjson` keyed by those hashes. No credential, account response or order API is stored or invoked. A session creates a one-use `frozen.json` with policy, universe and source hashes; it cannot silently resume with different settings.

## Commands

```sh
npm run research:audit-pair -- --kalshi=KALSHI_TICKER --pmus=PM_US_SLUG [--quantity=1]
npm run research:ev-report -- WORK/EV_SESSION
npm run research:ev-replay -- /path/to/ignored/candidate-watch/session/evidence [OUTPUT_JSON]
npm run research:ev-watch -- /path/to/ignored/candidate-watch/session/frozen.json WORK/NEW_EV_SESSION /path/to/read-only.env
```

The direct audit bypasses discovery, fetches the exact two public market records and REST L2 books, checks the existing matcher and settlement diagnostics, and prints each failed stage. A REST snapshot can reveal gross economics but cannot itself start a paper attempt; stream freshness is required. The observer takes the existing pinned, direct Kalshi × PM-US universe, refreshes exact metadata, and uses only the existing read-only subscriptions. It runs for a fixed 90 minutes unless a deadline, feed, or simulated loss limit stops it earlier. It writes only under the new session directory.

## September 23 retained-evidence replay

The original 2-hour watch summary remains authoritative for its own bounded-fee policy. The new [sanitized replay result](ev-arb-september23-retained-replay.json) verifies the old critical chain and retained raw segment hashes, then reevaluates the **eight retained raw segments only** (2026-09-23 23:35:47–2026-09-24 00:23:17 UTC). The earlier 18 raw monitoring segments rotated away. This replay counts on book updates rather than the old 250 ms sample clock, so counts are not comparable to the original 136,212 raw-spread diagnostic samples and are not independent trade opportunities.

| Retained-window measure | Count |
| --- | ---: |
| Public book events / paired-book events | 11,757 / 4,266 |
| Fresh two-book depth orientation observations | 3,912 |
| Gross positive orientation observations | 662 |
| Normal-fee net positive orientation observations | 71 |
| Net positive, fresh, within paper caps, blocked by the old fee stress bound | 12 (5 routes) |
| Paper attempts / fills / realized profits | 0 / 0 / 0 |

The strongest **fresh** modeled net observation in the retained replay was `KXOSCARACTO-27-JOH::tac-oscars-03-14-2027-bestacto-johmal`, Kalshi NO + PM-US YES, at 2026-09-24 00:06:06.704 UTC: gross +$0.07, modeled normal-fee net +$0.04 for one equal contract. This is an observed book quote, not a confirmed executable trade or realized profit. The 71 net-positive observations include stale and/or paper-cap failures; only 12 passed the other paper entry gates. The fee precision assumption and settlement basis remain unresolved.

## Bounded fresh observation

Pending the frozen 90-minute read-only run and its ledger report. Results will be added without changing run parameters or replaying the completed September 23 watch.

## Remaining gates and a future tiny live pilot

Paper outcomes are a learning sample, not fill or profit proof. Stream L2 does not prove queue position, fill size, cancellation timing, market impact, account-specific Kalshi fee rounding, or final cross-venue settlement equivalence. The biggest practical risk is a first-leg fill whose second-leg quote disappears while the reducing bid is thin. Any future $50-per-venue live pilot should first verify Ohio/account/product permissions and current fee precision, reconcile existing exposure and cash, retain the same attempt evidence schema with actual execution reports, and enforce hard one-sided, paired-commitment, and daily-loss limits. It requires separate explicit launch authorization; this branch does not enable venue writes.
