# Sustained observer research

Live trading remains disabled. Candidate normalization and review priority never establish settlement equivalence. Existing human approval, immediate rule-hash refresh, and historical verification snapshots remain authoritative.

## Evidence persistence

Every book update reaches the in-memory evaluator and persistence worker. The worker keeps a five-second per-market history plus an as-of anchor. Opening a raw discrepancy flushes both legs' history and current books. Every change during the event and for 2.5 seconds after its last state is retained, including invalidation. Overlapping captures share book rows. All 0/50/100/150/250/500/1000/2000 ms as-of calculations remain reproducible. Crashes censor open opportunities; missing post-crash coverage remains unknown.

Unrelated full books are not written indefinitely. Telemetry stores compact coverage, activity/freshness counters, stream diagnostics, and storage statistics. A 128 MiB serialized-history budget and 10,000 records per market fail closed on overload; they never silently drop evidence. Actual memory includes JavaScript object overhead beyond serialized bytes. Opportunity-heavy activity can still generate substantial evidence: storage cannot promise a constant growth rate while retaining all event changes.

## Capacity and review

Canonical entity aliases live in one competition-scoped registry. Explicit venue IDs are recorded with venue namespaces. Conflicting aliases do not resolve. The seed set is deliberately small; structured catalog team/player aliases broaden candidate normalization without teaching the verification gate equivalences. Unknown settlement details stay unknown. Non-sports structured names, tickers, assets, locations, indicators and windows are represented separately.

Capacity selects complete mappings and accounts for shared legs. Verified pairs take precedence. Existing priority membership is retained, category round-robin fills open slots, and 20% of unique-market capacity is reserved for exploration when verified demand permits. Exploration rotates every 15 minutes. Both are configurable. Subscription changes yield between groups to avoid monopolizing ingestion. Review scoring and capacity selection run in a reader worker, and live processing reuses the existing size evaluation for freshness diagnostics.

The authenticated `/api/review` endpoint and Mappings Needing Review section provide deterministic priority, side-by-side rules, normalized matches/differences/unknowns, structural conflicts, discovery reasoning, and raw discrepancy counts. Rule clause extraction is literal evidence organization, not legal or semantic equivalence analysis. A high score is never approval. `worker/review-export.ts` reads historical evidence and exports 40 review priorities and ten full review packages.

## Reconciliation and recovery

Unique subscribed markets are visited by a rotating, paced scheduler, at most 30 requests per 60 seconds by default, one request every two seconds. Repeated mappings do not multiply REST work. Suspicious markets receive a bounded priority advantage. Metadata requests are deduplicated per cycle. Existing adapter pacing allows at most approximately 3.33 requests/sec/host/process; catalog work remains in its own worker. Account-wide activity from other applications is outside this limiter.

Mismatch comparisons require the stream book to be unchanged during the REST request. A REST snapshot with an older venue timestamp is logged separately; it cannot establish a contradiction of a newer stream state. The REST response never restores eligibility. Kalshi's documented `get_snapshot` command quarantines only the affected market until a fresh sequence-valid snapshot arrives; timeout recovers the shard. A live PM-US probe rejected a second subscription to the same slug ("slug already subscribed"), so PM-US actionable mismatches retain shard recovery rather than an unsupported duplicate-subscription repair. Quarantine is immediate; the ordered persistence worker calculates invalidation/closing evidence so a full recovery does not synchronously size every unusable book on the ingestion thread. Protocol/sequence failure, lost heartbeat and event-loop uncertainty recover the affected connection with exponential backoff and jitter. A socket still connecting has no valid books to recover, so the event-loop watchdog leaves it to complete its snapshot handshake.

Disconnect diagnostics record venue/shard, market count, connection age, close code/reason, known initiator (or unknown for abnormal remote closure), heartbeat/message age, event-loop delay, persistence backlog, discovery/metadata/REST activity, and recovery reason. No credential headers or private payloads are logged.

## Official documentation checked September 11, 2026

- [Kalshi rate limits](https://docs.kalshi.com/getting_started/rate_limits): Basic read budget is 200 tokens/sec; most requests cost 10 tokens. Endpoint costs and account limits are authoritative; do not interpret tokens as requests. Apply backoff after HTTP 429.
- [Kalshi WebSocket quick start](https://docs.kalshi.com/getting_started/quick_start_websockets) and [official AsyncAPI](https://docs.kalshi.com/asyncapi.yaml): initial snapshots precede deltas; server ping frames arrive every ten seconds and require pong; client ping is supported. The protocol documents subscription-limit errors and `update_subscription/get_snapshot`, but the inspected pages/spec do not publish a universal numeric concurrent-connection or markets-per-subscription ceiling.
- [Polymarket US Retail rate limits](https://docs.polymarket.us/api-reference/rate-limits): 20 requests/sec per API key for authenticated endpoints, and 20/sec/IP for public endpoints. Back off at least one second on 429.
- [Polymarket US WebSocket overview](https://docs.polymarket.us/api-reference/websocket/overview) and [market stream](https://docs.polymarket.us/api-reference/websocket/markets): heartbeat monitoring, keepalive and exponential reconnection are recommended. The market-stream page specifies a maximum of 100 markets per subscription; the inspected pages do not specify numeric concurrent-connection or subscription-count limits. The tested camelCase protobuf JSON subscription format remains in use.

The 100-market shard size is retained as a measured configuration, not claimed to be an official optimum or ceiling. Total per-venue capacity remains 500. No live order APIs have been added.

## Validation

Implementation checkpoints are not completion of the research phase. Live measurements and the final comparison will be recorded in SUSTAINED-VALIDATION.md after testing. Do not infer multi-day reliability from synthetic throughput or a short authenticated sample.
