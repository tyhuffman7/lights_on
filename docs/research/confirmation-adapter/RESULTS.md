# Actual control results — September 21, 2026

The single targeted run completed **2026-09-21T20:13:11.520+00:00–2026-09-21T20:14:21.113+00:00** in 69.593 seconds. **12/20** maximum targeted attempts used; no retry, broad screen, profit search, orders or ledger activity.

Four requested WebSocket books passed. Both public PM-US REST books were older and rejected. Kalshi books passed separately from market status, whose currentness remains unproven. These are protocol book confirmations, not fills or confirmed arbitrage opportunities.

| Venue / role / market | Depth changes in initial minute | Confirmed UTC | Request → receipt ms | Book unchanged at confirmation | Book proof | REST / status assessment |
|---|---:|---|---:|---|---|---|
| kalshi / active / `KXMLBGAME-26SEP211835TORBAL-TOR` | 21 | 2026-09-21T20:14:13.966+00:00 | 126.546 | true | PASS | MARKET_STATUS_CURRENTNESS_UNPROVEN |
| kalshi / quiet / `KXU3-26SEP-T3.7` | 0 | 2026-09-21T20:14:16.317+00:00 | 43.527 | true | PASS | MARKET_STATUS_CURRENTNESS_UNPROVEN |
| poly / active / `aec-mlb-tor-bal-2026-09-21` | 90 | 2026-09-21T20:14:18.577+00:00 | 55.880 | true | PASS | REST_OLDER_THAN_STREAM |
| poly / quiet / `urc-usunemp-sa-september-2026-10-02-gt3pt7pct` | 2 | 2026-09-21T20:14:21.058+00:00 | 49.265 | true | PASS | REST_OLDER_THAN_STREAM |

The expected quiet PM control had two depth changes during the initial minute; it was substantially less active than baseball and then unchanged for approximately 26 seconds before confirmation. Kalshi unemployment had zero depth changes and confirmed after more than a minute unchanged. No changed price was required to pass.

Exact selected response evidence is in [control-results.json](control-results.json). PM quiet WebSocket `transactTime` stayed `2026-09-21T20:13:54.696427112Z`; receipt/confirmation was `2026-09-21T20:14:21.058Z`. Kalshi quiet snapshot was sequence 47, subscription 1, with no exchange timestamp. Its confirmation receipt was `2026-09-21T20:14:16.317Z`. Request IDs, original timestamps, processing times and book hashes are retained separately.

Both PM REST responses reported `age: 4`, `cache-control: public, max-age=30`, and `cf-cache-status: HIT`. They carried older versions than the accepted requested books; neither was applied. Kalshi status response retained headers were only `date: Mon, 21 Sep 2026 20:14:14 GMT` and `date: Mon, 21 Sep 2026 20:14:16 GMT`. Both bodies reported active, but neither established a cache age or independent current-state guarantee. The adapter does not turn this unknown into execution admission.

**Remaining limitation and one next action:** Kalshi order-book snapshots omit market status, while these status GETs provide insufficient provenance for the strict current-state gate. Obtain a documented current-status bootstrap guarantee from Kalshi developer support, supplying these dated responses and asking whether Get Market is uncached or which lifecycle protocol supplies authoritative initial state. No support message was sent, and the gate remains closed. PM-US full books include open state. All confirmations remain bounded observations without atomic cross-venue or future-fill guarantees.

**Verification:** 20 focused tests passed before the real control run. After capture, two additional focused tests replay the actual successful envelopes and old REST responses and cover current-stream supersession during REST processing; final focused result **22/22 passed**. Final defensive additions recheck the latest feed after REST and reject sub-millisecond PM version reversal. Those guards were tested against retained responses without repeating the live collection; the source hashes in the live summary identify the exact collected revision. No change to the four original live outcomes is claimed. Hosted full CI pending publication.

AOC settlement remains unresolved. PR #5 and its historical results are unchanged. Stop at this checkpoint; no next market screen launched.
