# Activity-aware maker paper checkpoint

The paper worker now records recent public trading activity while idle and ranks profitable maker candidates using same-market, same-side sell volume at or below the proposed bid. The score accounts for initial visible queue depth and requested quantity. It is a selection heuristic, not a fill probability. Quotes without activity remain the fallback when no active profitable candidate exists.

Activity is deduplicated, expires after 60 seconds, and is bounded to 10,000 prints. A small exchange-clock lead is accepted for ranking only; fill evidence retains the existing stricter timestamp checks. Historical activity cannot fill a newly posted order. Only prints for the outstanding order's market enter its bounded processing queue.

## Actual-data run

Session `8b1ffeda-8d94-4e7c-a17a-13351414f0d8`, 182.957 seconds including shutdown:

- 105 public trade messages across 45 markets.
- 18 selection checks; eight had an eligible maker quote, zero had an eligible quote with qualifying recent sell activity.
- Eight simulated resting orders, all canceled unfilled. No positions or profit.
- Every order's market had zero recorded trades throughout the entire run.
- 77 trade messages were college football, 26 UFC, one NFL passing yards, one NFL receiving yards.
- 32 traded markets / 75 messages had a stored conditional paper approval. This count is an overlap check, not an assertion of approval validity at each historical print.
- Cash remains $50 Kalshi / $50 Polymarket US. No pending order, unmatched exposure, or halt. Both database leases are empty; worker exited successfully.
- Real orders and real fills remain zero.

The run does not establish that longer resting times would have filled these orders. The immediate selection-level finding is a lack of overlap between qualifying recent sell activity and eligible profitable quotes. Trading was concentrated in college football and UFC, while selected profitable quotes were NFL receiving-yard props. The current ten-second candidate selection cadence and short sample can miss brief opportunities; these results do not prove that no arbitrage exists elsewhere or at other times.

## Validation and next bottleneck

219 tests, TypeScript, and production build passed before collection; none overlapped the run. Tests cover idle activity capture, active-vs-idle candidate selection, wrong-side/price rejection, deduplication, expiry, and preservation of the rule that historical prints never fill new orders. Existing fractional-fill, hedge-delay, restart, and shutdown tests still pass. The production build retains its existing route-classification notice.

Next investigation should measure the actual price/fee gap in the actively traded, approved college-football pairs, and determine whether event-driven quote selection can capture brief eligible states. Extending order duration alone is not supported by this sample. Managed longer-lived quoting would also require continuous hedge-economics validation and cancellation handling; the current two-second lifetime is unchanged.

Run from the Lights On repository:

```sh
npm run paper -- maker-run observer.config.json research-data/paper-bot.sqlite 180
npm run paper -- status research-data/paper-bot.sqlite
```

Implementation and evidence are saved locally. No commit or push; configured 1Password signing remains deferred without bypass.
