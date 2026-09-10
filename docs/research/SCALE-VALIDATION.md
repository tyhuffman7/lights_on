# Hardening capacity evidence — September 10, 2026

The implementation is tested with synthetic data through JSON parsing, book normalization, indexed pair evaluation, a persistence worker and real SQLite WAL writes. These are capacity measurements, not exchange execution latency, fill probability, arbitrage availability or profitability.

Machine/runtime, complete telemetry and earlier failures are recorded in `scale-validation.json`. The workload uses unique markets on each venue, five levels per side and 1,000 contracts of depth, round-robin snapshots, 100-market cache shards, two evaluations per update after warm-up, periodic expiry and latency analysis. Initial snapshots are drained before timing. Every accepted book record must be present after shutdown. Each staged run lasts six seconds after warm-up.

Predeclared expansion stops: processing p99 above 20 ms; persistence acknowledgment p99 above 250 ms; event-loop p99 above 100 ms; backlog above 1,000 pending messages. The runtime fails closed at 2,000 messages or 64 MiB queued. Detector search fails closed at 8,192 exact quote probes. Freshness remains 2 seconds; the 50 ms analysis bucket is not a guaranteed processing SLA.

The initial staged evidence passed 30/100/250/500 synthetic verified mappings at requested 200/400/800/1,000 updates per second. See the JSON for the final rerun and its p50/p95/p99 measurements. At 500 mappings the initial isolated run achieved 996.3 updates/sec and processing 0.242/0.371/0.423 ms. A separate 30-second run with five concurrent report requests achieved 999.1 updates/sec, processing 0.237/0.355/0.436 ms and persistence acknowledgment 13.46/38.15/76.13 ms. That run is in `scale-soak.json`. Its quantiles retain the last 10,000 samples, not all 30,000 updates.

Earlier failed stages are preserved in the evidence: before batching latency analysis, the 250-mapping stage exceeded the persistence limit (about 660 ms p99); batching alone still failed at 500 mappings (about 590 ms). Analysis is now bounded to 32 opportunities per pass with a rotating cursor, and report queries use a separate read-only worker. The first failed run overlapped an application build, so it is not an isolated baseline.

The configurable default ceiling is 500 subscribed markets per venue, with groups of at most 100. Deferred counts are exposed. This is a temporary locally measured ceiling, not a permanent pair limit or certification of continuous exchange coverage. Shared-market fanout, deeper books, a large catalog, dense opportunity churn, cold storage and a different host can change performance. Discovery scans complete paginated non-sports catalogs independently of that subscription ceiling and never upgrades fuzzy candidates into verified mappings.

A 30-second soak does not establish hours-long reliability or full-universe capacity. Real verified-market stages remain blocked by lack of justified settlement-equivalent mappings. The authenticated smoke sample observed two UNVERIFIED mappings, 28 persisted book records including invalidations, zero opportunities, and three reconciliation mismatch recoveries. It shut down cleanly. See `hardening-live-validation.json`; no live orders were placed.

Reproduce: `npm run test:detector`, then `npm run test:load` without concurrent builds/tests. To repeat the report-contention soak, import `loadStage` from `worker/scale.ts` and call `loadStage(500,1000,30000,5000)`. Do not compare process-local monotonic timestamps between runs. Exchange timestamp offsets include unknown clock and source-age effects; REST/ping RTT is measured separately.

## Final staged rerun

| Mappings | Updates/sec | Processing p50 / p95 / p99 (ms) | Persistence ack p99 (ms) | Peak backlog |
| ---: | ---: | --- | ---: | ---: |
| 30 | 198.9 | 0.388 / 2.211 / 4.561 | 8.809 | 6 |
| 100 | 398.9 | 0.273 / 0.493 / 1.064 | 20.144 | 31 |
| 250 | 797.1 | 0.252 / 0.425 / 0.523 | 20.764 | 44 |
| 500 | 996.0 | 0.245 / 0.406 / 0.490 | 30.293 | 49 |

All stages passed and drained every accepted record. The final stage used 500 synthetic verified mappings, 500 distinct markets per venue and five cache shards per venue. Approximately two pair-orientation evaluations occur per update. No real venue throughput limit is inferred.
