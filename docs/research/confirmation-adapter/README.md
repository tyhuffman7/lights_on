# Requested-book confirmation adapter — September 21, 2026

This checkpoint tests market-data confirmation independently of arbitrage detection. PR #5 at `8447acd0a21feda6f9101c3a0738539a5be731d4` and its completed results are preserved. No broad screen, fee or size changes, contract-review expansion, recovery work, orders or ledger writes are part of this checkpoint.

## What the retained failures establish

The [retained evidence audit](retained-evidence-audit.json) records exact selected headers, public book fields, original timestamps, body hashes and comparison books. The original collector retained an allowlist of response headers; headers outside that set are unknown, not absent by inference.

- **51** cache-provenance failures included Kalshi **market-status** GETs whose retained headers contained only `Date`. Those responses did not establish a cache age. The old combined check treated this metadata gap as a book-confirmation failure.
- **12** attempts failed solely on that missing expected metadata. This does not retroactively prove current market status or turn them into successful historical confirmations.
- **32** PM-US responses were flagged cached. **19** REST book versions were older than the already received stream version; seven of those 19 had no cached-response flag. Of these 19 older versions, 14 had different retained depth and five had the same depth with an older version. All 12 solely missing-metadata cases had matching depth. Thus a cache miss/expired response can still carry an older book version.
- Remaining combinations: 19 cached + missing-provenance without proven older data, 12 cached + missing-provenance + older data, seven missing-provenance + older data, one cached + missing-provenance + ingress backlog, and one fetch failure. Counts overlap as shown in the JSON.

Representative exact retained evidence:

| Case | Response evidence | Version evidence |
|---|---|---|
| Sole missing metadata, 19:25:49 UTC | Kalshi headers `{"date":"Mon, 21 Sep 2026 19:25:49 GMT"}`; PM `cache-control: public, max-age=30`, `cf-cache-status: EXPIRED`, `date` and `last-modified: Mon, 21 Sep 2026 19:25:49 GMT`; no retained Age | PM `transactTime: 2026-09-21T19:25:34.462162197Z`; retained stream exchange time `1790018734462` ms |
| Older cached response, 19:17:00 UTC | PM `age: 15`, `cache-control: public, max-age=30`, `cf-cache-status: HIT`, `date: Mon, 21 Sep 2026 19:17:00 GMT`, `last-modified: Mon, 21 Sep 2026 19:16:45 GMT` | REST `transactTime: 2026-09-21T19:14:07.760226343Z`; already observed stream `1790018192569` ms |

Neither HTTP receipt nor Date replaces these market timestamps. The original stream representation retained milliseconds; its missing nanoseconds cannot be reconstructed.

## Small reusable correction

`ConfirmationFeed` reuses the existing signed read-only stream, transport-arrival queue, strict book parser and sequence checks. Kalshi confirmation sends supported `get_snapshot` on the existing subscription and binds the response to the ticker, subscription ID, increasing sequence and bounded request window. The documented snapshot has no exchange timestamp: that field remains null. The snapshot command's request ID is not echoed in the book response; one pending request and the sequence window provide bounded correlation, not an invented echoed ID.

PM-US confirmation opens one bounded, dedicated subscription and requires its initial full book to echo the unique request ID and expected slug. It does not duplicate a subscription on the existing socket or wait for a price change. Full-book `transactTime` is retained exactly, including nanoseconds. Latest stream evidence is checked again when the response becomes available. A newer stream version wins; an older requested version or equal-version/different-book conflict rejects confirmation.

HTTP transport integrity and cache evidence are now inspected separately. Missing Age remains null, not zero. Optional Cloudflare headers are observations, not mandatory proof. REST may be corroborated by an independently accepted, exact-version/exact-depth requested WebSocket book within the original two-second window, even when optional HTTP cache headers are absent. A matching cache hit proves nothing on its own; acceptance comes from the requested book. Older, newer-but-uncorroborated, conflicting, malformed, closed or late REST responses remain rejected. No request `no-cache` directive is assumed honored. The legacy HTTP-only caller remains conservative for unknown provenance.

A confirmed book is a bounded protocol observation, not a matching-engine timestamp, guaranteed fill or authorization. Heartbeats support connection liveness only. Market-change time, transport receipt, processing availability, requested snapshot confirmation and HTTP cache uncertainty remain separate. Disconnects, parser/sequence failures, clock discontinuity, processing delay, backlog and closed PM books reject confirmation. Kalshi's book does not carry market-open state: its status GET is assessed separately; unknown status currentness cannot authorize execution, and any reported closed/expired state blocks the control. The old screen remains unlaunched and conservatively gated; this checkpoint does not manufacture certainty about Kalshi status.

## Frozen control plan

Four control markets were selected before the run, without reading their economics: current Toronto/Baltimore MLB (expected active) and September unemployment above 3.7% (expected quiet), on each venue. Sixty seconds of existing streams measure actual depth-change activity; “active” and “quiet” must be interpreted against the recorded activity, not their labels alone.

Maximum **20 targeted attempts total**, planned **12**: four initial market subscriptions, two requested Kalshi snapshots, two new PM subscriptions and four public REST comparisons/status requests. Four comparison rounds start at least two seconds apart; only one confirmation round is in progress. No repeated identical failure loop or automatic restart. A 429 stops further rounds. Limits remain 1,500 ms response, 250 ms processing, 2,000 ms proof age and 1,000 ms clock divergence. Quiet-book age thresholds were not increased. Hard deadline: 120 seconds.

The single-use command (do not rerun this completed output directory):

```sh
node --experimental-strip-types worker/confirmation-controls.ts OUTPUT_DIRECTORY ENV_FILE
```

Raw public messages remain local. Published summaries contain selected response fields, versions, timing, depth hashes and top levels; no credential/request-auth headers, account data or databases.

## Primary protocol references

- [Kalshi order-book snapshots, deltas and get_snapshot](https://docs.kalshi.com/websockets/orderbook-updates)
- [PM-US full-book subscriptions and request-ID response](https://docs.polymarket.us/api-reference/websocket/markets)
- [PM-US public REST market book](https://docs.polymarket.us/api-reference/markets/get-market-book)
- [PM-US rate limits and stream guidance](https://docs.polymarket.us/api-reference/rate-limits)
- [Kalshi market metadata/status](https://docs.kalshi.com/api-reference/market/get-market)

AOC settlement remains UNRESOLVED. No next screen is authorized or launched by this adapter test.

[Actual control results and limitations](RESULTS.md).
