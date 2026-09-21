# Missed-opportunity checkpoint — stopped PAPER capture

The six posted orders produced five activations and **zero qualifying same-market, same-side trade volume during 5.953 seconds of active quotes**. Queue progress and modeled fills were zero. The sizing/recovery operating test is preserved; **fresh-fill recovery remains unproven**. This audit makes no runtime correction and starts no collection. It specifies one bounded coverage experiment below.

## Evidence and fixed scope

This uses the executed source, launcher/configuration, saved normalized books, public trade records, decision diagnostics and final paper ledger, rather than relying on the earlier result summary. The worker ran `aebb402485fced902461b08d928ddb39ea7a494c` plus the recorded one-line prompt-stop timer. All **111** frozen source hashes matched the saved executed source; launcher, supervisor, configuration and freeze hashes also matched. Runtime was Node **25.8.1**.

The observer session was `8b071ad0-4117-4c67-ad50-1639d4d600d5`, **21:10:52.833–21:30:52.653 UTC on September 20**, 1,199.820 seconds. The supervisor's wider process window was 1,200.811 seconds, ending normally at its fixed deadline. This session has **248,262 book rows and 2,471 public-trade records**. The earlier totals of 281,822 books and 2,729 trades include warmup; they are not the 20-minute session denominator.

Frozen PAPER capital remains **$100, $50 per venue**; maximum all-in entry reservation **$10**, total commitment **$40**, planned profit floor **$0.10**, ROI **1%**, charged reserve **2¢ per paired contract**, recovery allocations **5¢ PM-US + 1¢ Kalshi per contract**, freshness **2 seconds**, maximum horizon **30 days**. Unused recovery allocation locks cash but is not charged as an expense. The observer's research bankroll/reserve fields are separate from these executed maker settings. No larger-capital scenario or parameter search is included.

The capture's fee profiles and exact fee code were used: when valid, the recorded MLB maker coefficient was 88 after conservative rounding of 87.5, with the original taker-rate fallback when a profile was missing or stale. Conditional settlement approvals remain conditional PAPER approvals. This audit changes no eligibility or live-launch boundary.

## Six orders and five activations

Order IDs below are unambiguous prefixes; full IDs, timestamps and diagnostic row IDs are in the machine summary. Queue is shown as **placement → activation** in contracts; activation retains the larger visible queue. Receipt-window market volume includes both sides. Qualifying volume additionally requires the same side, a price at or below the bid, the original clock/receipt bounds and a unique public trade ID.

| Order | Market / side | Quantity @ bid | Active window (UTC) | Active duration | Queue ahead | Receipt-window market volume | Qualifying same-side volume | Final reason |
|---|---|---|---|---:|---:|---:|---:|---|
| `15a4f5d0` | Seattle NO | 7 @ $0.10 | 21:17:40.230–41.309 | 1,079 ms | 1 → 65.53 | 0 | 0 | `EXECUTION_STATE_INVALID`; cancellation effective after 250 ms |
| `9912ba08` | Minnesota YES | 4 @ $0.68 | 21:18:42.365–43.865 | 1,500 ms | 0 → 0 | 211.42 | 0 | Quote expired |
| `224e48df` | Seattle NO | 7 @ $0.12 | Never activated | 0 ms | 0 → n/a | 0 | 0 | `HEDGE_NO_LONGER_VIABLE`, then activation rejected |
| `a01ccf7b` | San Francisco YES | 6 @ $0.35 | 21:29:26.086–27.534 | 1,448 ms | 0 → 34 | 0.93 | 0 | `HEDGE_NO_LONGER_VIABLE`; cancellation effective after 250 ms |
| `ce489cf8` | San Francisco YES | 5 @ $0.35 | 21:29:28.041–28.467 | 426 ms | 0 → 28.9 | 0 | 0 | `HEDGE_NO_LONGER_VIABLE`; cancellation effective after 250 ms |
| `c916bf60` | San Francisco YES | 9 @ $0.35 | 21:29:29.238–30.738 | 1,500 ms | 25 → 57.91 | 0 | 0 | Quote expired |

The original `MakerQueue.consume` reproduces zero fills and unchanged activation queues. Its receipt/clock bounds and cancellation expiry are preserved; a quote touch, crossed market, disappearing depth or opposite-side trade gives no fill credit. Effective expiry, rather than the later close diagnostic, ends each active window. Minnesota's close ran 2 ms late and the last SF close 38 ms late; neither extends eligibility.

The **24 same-market processed prints** behind the old result comprise 20 during Minnesota's processing window, one during the first active SF quote and three during the second. **All 24 were opposite-side sales.** Fifteen Minnesota prints also had exchange-time bounds before activation. The 0.93-contract SF print was also before activation by exchange bounds and above the bid. The three later SF prints were received before activation but processed afterward; all also fail side, exchange-time and price tests. These exclusion reasons overlap. The other three orders had no processed active-window same-market print.

For the rejected Seattle order, cancellation was requested at **21:22:57.614**, effective **57.864**; attempted activation at **58.009** was already 145 ms beyond effective expiry. Its diagnostic also records `valid:false`, bid $0.12 and ask $0.18, so this was not a post-only crossing. A recorded rule-verification refresh from **57.511–58.144** cleared approval availability during that attempt. Both expiry and approval unavailability support rejection. The coarse `EXECUTION_STATE_INVALID` and `HEDGE_NO_LONGER_VIABLE` cancellation labels do not identify every underlying failed input: the former combines outer state, books and reservation checks; the latter includes unusable hedge books or failed current hedge economics. No exact unlogged predicate is invented.

## What the selection logs do and do not count

| Logged quantity | Count | Interpretation |
|---|---:|---|
| Selection events | 228,478 | Callback/sweep summaries, not opportunities |
| Processed pair slots | 236,628 | Includes slots skipped before pricing; the ledger calls these “pairs evaluated” |
| Zero-processed events | 0 | An empty eligible set is different from no processed slot |
| Events with no retained eligible plan | 225,999 | 2,479 events had at least one |
| Consecutive identical summary payloads | 215,065 | Repeated summary counts do not prove identical books/candidates |
| Retained eligible side/price plans | 3,172 | Economically assessed plans; sizes/instances can repeat |
| Plans without qualifying recent activity | 2,377 | 74.9% of retained plans |
| Plans with qualifying recent activity | 795 | Original 60-second same-market/side/price activity hint |
| Active plans rejected by observed-size economics | 787 | 99.0% of the active plans |
| Active plans surviving size stress | 8 | Across six selected events, which posted six orders |

The engine enumerates sizes but retains at most one scored size per side/price. Rejected pair/side/price/size identities were **not logged**, so the number of actual priced-but-rejected candidates and their exact per-gate runtime counts are unrecoverable. Six selected orders are individually identifiable. The 257 global runs of consecutive nonempty selection summaries are not 257 distinct pair-level opportunities. Neither repeated summaries nor empty selections are counted as new opportunities below.

## Captured-book admission comparison

The offline audit visits recorded book/control transitions and expiry deadlines for the **14 pair-side orientations**, using the cheapest retained price, the join bid, and the executed integer-size, depth, fee, allocation, scoring and size-stress functions. It evaluates the frozen capital scenario. No ledger writes, order submission or fill generation occur. The only alternative admission case removes the absolute profit floor while retaining **strictly positive net after fees and charged reserve**, ROI, recovery allocation, observed-size economics, activity, capital and observable data/approval gates.

This is a **counterfactual admission comparison**, not a recreation of every historical candidate call or an additional trading run. Rejected candidate identities and exact per-call book availability are absent. Capture timestamps mark processing start, and same-millisecond cross-table ordering is unresolved; endpoints carry at least 1 ms uncertainty. Captured connections/heartbeat telemetry establish conservative stream-health coverage; unseen heartbeats and unlogged transient metadata invalidations remain unknown. Actual outstanding maker reservations censor intervals. Four of the six all-gates intervals end because an actual order was posted, so their short recorded durations are not natural opportunity lifetimes. Join-bid economics cannot improve at a more expensive bid; activity/queue ranking can differ there, so this is not exhaustive price-level admission coverage.

The primary reason is the first failing stage: **startup → market closed → missing book → freshness → stream health → clock → approval refresh → maker busy → post-only depth → after-fee nonpositive → charged reserve → base capital → recovery headroom → ROI → absolute profit floor → activity → size stress → admissible**. Within economic stages, quantities surviving prior stages proceed; a stage is primary only when it eliminates every surviving size. Base capital includes actual venue balances and the $10 entry cap. The $40 commitment limit never binds in this zero-position, one-pending-order capture.

Accumulating pair-side time avoids counting every repeated callback as another opportunity. The full denominator is **16,797.480 orientation-seconds** (14 × 1,199.820), including startup. Recorded-book arithmetic was positive after fees in **2,044.508 orientation-seconds**; it can still be stale or otherwise non-executable. The following primary reasons partition only that positive-after-fee subset:

| Primary reason | Orientation-seconds |
|---|---:|
| Charged reserve erases edge | 1,621.339 |
| Freshness | 301.003 |
| Clock | 49.157 |
| Existing maker reservation | 21.231 |
| ROI | 17.875 |
| Approval refresh | 16.044 |
| Activity | 6.312 |
| Stream health unknown/down | 6.291 |
| Absolute profit floor | 3.629 |
| Observed-size stress | 1.422 |
| Recovery headroom | 0.178 |
| Base capital as sole primary blocker | 0 |
| Admissible under reconstructed gates | 0.027 |

The charged reserve is the largest measured economics blocker, **79.3%** of this subset. Overlapping flags are deliberately **non-additive** and refer to any qualifying size in the bounded ladder, including stale recorded-book arithmetic: reserve **2,031.654 s**, base capital **41.102 s**, recovery headroom **37.261 s**, ROI **32.150 s**, minimum profit **19.417 s**, activity **8.512 s**, size stress **4.703 s**. Larger quantities can fail capital/headroom while smaller ones survive and fail another gate. The machine summary also supplies the full primary table including missing, negative and startup states.

Distinct intervals join consecutive transitions with the same pair, side and condition; overlapping sides are separate. Counts across conditions are not additive:

| Condition | Intervals | Total time | Longest | At least 500 ms |
|---|---:|---:|---:|---:|
| Positive after fees, even when data gates fail | 763 | 2,044.508 s | 140.314 s | 268 |
| Funded, positive after reserve, observable data gates pass; before ROI/floor/activity/stress | 191 | 29.265 s | 1.776 s | 21 |
| All reconstructed gates | 6 | 0.027 s | 0.007 s | 0 |
| Counterfactual with floor removed | 22 | 0.964 s | 0.808 s | 1 |
| Additional floor-only admitted intervals | 17 | 0.937 s | 0.808 s | 1 |
| Recovery allocation removes all floor-satisfying sizes | 9 | 1.363 s | 1.055 s | 1 |

The last row still includes activity/size-stress failures; it is an arithmetic interaction, not another executable policy. The 500 ms column is context for placement delay, not a predicted fill count. Removing the floor can merge adjacent intervals, hence 6 + 17 need not equal 22.

At **21:28:41.384 UTC**, San Francisco NO at **$0.57** (book rows **247356 / 247325**) needed **10 contracts** to reach $0.10. Ten fit the base reservation, but recovery allocation reduced the funded maximum to **9**. Nine had **$0.095 planned net**, **1.0668% ROI**, **$8.905 charged cost** and **$9.445 total reserved cash** ($5.33 Kalshi + $4.115 PM-US). Recent qualifying volume was 11 against 29 ahead; the observed-size check passed. This demonstrates the floor/headroom interaction, but 11 contracts of past activity do not clear 29 ahead or establish a later fill.

A contrasting Seattle NO snapshot at **21:16:16.484** also reduced 10 contracts to 9 and $0.09 net, but the observed 0.03-contract print left **-$0.0064** under the size-stress calculation. Removing the floor would still reject it. The longest floor-only interval, Seattle NO **21:16:37.612–38.420**, lasted 808 ms and ended when the reserve erased its edge. No additional trade or profit is attributed to any of these examples.

## Actual coverage

Fresh paginated catalogs contained **110,969 Kalshi records and 62,773 PM-US records**. The matcher found **1,105 pairs**, including **454 conditional profiles**; **450** passed preliminary open/future-close/minimum-quantity gates. Catalog pagination completed, but matching was bounded: 181,137,986 comparisons were deferred by its limit. Thus 1,105 is an observed match count, not proof of exhaustive cross-venue matching or settlement equivalence.

The preparation window (event time from six hours before to four hours after screening, with a same-local-date fallback) contained **14 MLB mappings to seven distinct PM-US markets**. The screening script deduplicated by PM-US ID **before** activity sampling, keeping one of the two Kalshi outcome tickers for each event. Only **seven mappings** received REST book/activity samples (305 recent public trade records); all seven were selected. The screen's 60-sample bound and subsequent 30-selection bound did not bind.

During the run, discovery was disabled and the explicit configuration listed seven pairs. Stream telemetry reported **7 Kalshi + 7 PM-US subscriptions**, with 14 distinct captured venue/market keys. All seven pairs had some usable simultaneous books. Conservative reconstructed durations with both fresh stream books and recorded health evidence were:

| Selected Kalshi outcome / event | Usable simultaneous book seconds |
|---|---:|
| San Francisco / SF–LAD | 1,100.404 |
| Minnesota / MIN–LAA | 1,070.254 |
| New York Yankees / NYY–AZ | 1,058.804 |
| Seattle / SEA–COL | 1,043.268 |
| Miami / MIA–SD | 955.240 |
| Toronto / TOR–TEX | 870.910 |
| Milwaukee / MIL–BAL | 454.467 |

These are book/health availability durations, before economics, clock or approval checks. Four brief Kalshi reconnects are recorded. One explicit unavailable-clock period ran **21:20:02.048–21:20:27.134**, in addition to ordinary calibration-validity gates. Twenty rule refreshes completed; their in-flight windows were excluded from admission.

The configured **30 markets per venue was not the limiting factor**. The seven alternate Kalshi mappings were removed before their tape was sampled; their order books and activity during the run are **unknown**, not zero. The other **436** preliminary eligible profiles outside the event window likewise have no contemporaneous stream evidence here. Public metadata, catalog records and selected-market volume cannot establish missed profit elsewhere.

## Decision, verification and reproduction

**No runtime correction is justified.** There is a demonstrated floor/headroom interaction, but relaxing it chiefly adds brief admission intervals and does not address the observed absence of qualifying flow through an active queue. Among actual retained plans, inactivity and observed-size economics dominate. There is also a concrete coverage blind spot, without the tape needed to establish its economic consequence. The recovery policy and all frozen settings stay unchanged; no additional recovery refinement is performed.

The one selected next experiment is a **30-minute order-disabled coverage/activity capture in a current MLB window**, capped at **14 Kalshi markets / 7 PM-US markets**, including both distinct Kalshi outcome mappings for each selected event. Preserve the same economic, timing and queue assumptions. Record candidate pair/side/price/size and primary plus overlapping gate reasons only when the input identity changes. Compare the originally selected subset with its omitted counterparts within that same capture, measuring fresh simultaneous coverage, positive net after reserve/size stress, queue ahead and qualifying side-specific volume. Hard stop after 30 minutes; no retuning, orders, automatic restart or additional strategy. **Specified, not launched.**

Focused verification: **20 tests passed** (13 sizing/recovery regressions and 7 audit regressions), including strict-positive/ROI/reserve retention, capital/headroom, adverse fractional-size economics, opposite-side/expiry rejection, chronological transitions and reservation censoring. The offline capture replay completed. Synthetic fixtures are labeled and provide no market evidence. Full tests/typecheck/build are delegated to hosted CI for the published review branch; the short handoff records its observed status.

Local evidence remains in `work/sizing-recovery-20260920` and `work/missed-opportunity-20260920`; raw books/trades/databases are excluded from publication. The [sanitized summary](missed-opportunity-summary-2026-09-20.json) includes order IDs, source/database identities, gate totals, intervals and examples. Read-only reproduction, with the original capture and preserved executed source present:

```sh
python3 scripts/missed-opportunity-capture.py work/sizing-recovery-20260920 /tmp/lights-on-audit-new
node --experimental-strip-types scripts/missed-opportunity-audit.mjs /tmp/lights-on-audit-new work/missed-opportunity-20260920/source /tmp/lights-on-audit-result.json
node --experimental-strip-types --test tests/maker-recovery.test.ts tests/missed-opportunity-audit.test.ts
```

Extraction refuses an existing output directory, verifies source/configuration hashes and requires a stopped database without a WAL. Replay checks the supplied source against every frozen hash. Monetary integers in JSON are USD × 10,000. The historical **-$0.53** ledger/halt and the new zero-position/$100 PAPER ledger are unchanged, verified by their recorded hashes. No automatic halt reset or experiment restart occurred.
