# Full paper evidence capture and maker-fee test

## Decision

The current Kalshi-first, short-lived maker strategy has still not demonstrated a profitable paper fill. Lower published maker fees alone did not fix that in this sample. Do not treat additional candidate orders as earnings or enable real execution on this evidence.

## Evidence correction and implementation

The existing research recorder intentionally retained book history mainly around visible taker spreads. The previous historical maker/college-football audits therefore used selective samples, not an exhaustive tape. Their actual live paper-order/fill counts remain valid; their retrospective quote counts cannot establish that all maker opportunities were examined.

Paper CLI runs now opt into full normalized-book retention for their selected, paper-approved market keys. The approved capture set is acknowledged by the persistence worker before subscription updates and recorded as PAPER_CAPTURE_MODE. Every normalized update for those keys is persisted, including unchanged price levels with new timestamps. Other research runs retain their prior selective storage behavior. This records observed normalized books, not every network packet or unobserved market activity.

## Ten-minute live-data test

Session `682818d0-dc72-4873-b34d-30f162950f34`, 603.038 seconds including shutdown, using a temporary config with discovery disabled and the existing market universe:

- 199 conditional paper approvals; 354 captured market keys.
- 57,020 total normalized updates processed. 22,892 updates counted for the approved full-capture set, exactly matching 22,892 database rows for those keys. Total persisted book rows: 24,817, including normal research captures.
- 477 public trade messages.
- 145 simulated maker orders, all closed unfilled. No positions, no profit, no pending order or halt.
- Cash returned to $50 Kalshi / $50 Polymarket US. Both database leases are empty; worker stopped successfully.
- Four event-loop delay episodes. Last periodic telemetry reported 27 reconnects and maximum event-loop delay 2,269.12 ms. Selection slice p99 was 7.50 ms. Discovery was disabled; the first recovery also reported REST and metadata inactive. Cause remains unproven. This is not a clean unattended-reliability result.

## Fee evidence and replay

Current public series responses, observed September 12 at 14:30 UTC, identify college football (KXNCAAFGAME) as `quadratic_with_maker_fees`, multiplier 1. NFL receiving/passing yards are `quadratic`, multiplier 1. [Kalshi's published fee schedule](https://kalshi.com/docs/kalshi-fee-schedule.pdf) distinguishes the general taker coefficient 0.07 from the maker coefficient 0.0175 where maker fees apply, with general resting orders otherwise excluded from trading fees. [Current rounding documentation](https://docs.kalshi.com/getting_started/fee_rounding) also describes balance-precision adjustments and a per-order accumulator. Therefore a zero headline maker fee must not be confused with verified zero fractional-fill balance adjustment. Production paper fee assumptions remain unchanged in this checkpoint.

A chronological research replay used the full capture, preserved source timestamps, fixed activation/hedge delays, visible queue depth, subsequent public prints, current hedge books, bankroll limits, unchanged reserves, and no invented settlements. Candidate selection was deterministic bounded batches rather than the production activity ranking, so its order counts need not match the live worker. It compared the existing conservative taker assumption with a published-maker-rate sensitivity scenario for the three checked series:

| Research scenario | Candidate orders | Modeled fills | Realized profit |
|---|---:|---:|---:|
| Conservative taker fees | 179 | 0 | $0 |
| Published maker-rate sensitivity | 206 | 0 | $0 |

Neither scenario had same-market trade prints while its orders were outstanding. Separately, 474 of 477 public prints had exchange timestamps ahead of local receipt time. The existing queue filter rejects future timestamps. That is a blocker to broadly trusting fill detection, but it does not explain these specific unfilled orders because they had no matching-market prints to process. Calibrate clock uncertainty defensibly rather than rewriting timestamps or silently counting delayed/ambiguous prints as fills.

The replay uses recorded book validity flags, not independently reconstructed socket health; uncertain account rounding and hidden queue liquidity remain limitations. It never writes the paper ledger. Published fee observations are scenario inputs, not authenticated historical fee receipts. Old selectively retained sessions are rejected by default unless explicitly requested as limited sampled diagnostics.

## Validation and saved work

222 tests pass, including quiet-market full retention, timestamp preservation, capture-set exclusion, and unchanged default retention. TypeScript and production build pass; the existing route-classification notice remains. Tests/builds finished before live collection. Production fee and timestamp gates were not changed. Real orders and real fills remain zero.

The next work should address the price/activity mismatch and establish trustworthy timestamp handling, while isolating the repeated processing stalls. This sample does not justify funding the current strategy or claiming predictable profit.
