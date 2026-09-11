# Sustained research validation — September 11, 2026

The implementation completed a bounded authenticated validation with a substantial storage reduction and a remaining stability limitation. This is a 15-minute research sample, not proof of multi-day reliability or profitable equivalence. Live trading is disabled; no mappings were approved. The final observer stopped cleanly after its bounded timer.

## Fifteen-minute live result before recovery offload

Started 2026-09-11T19:44:39.362Z; measured duration 900.4 seconds. Full evidence is in [sustained-validation.json](evidence/sustained-validation.json). Logical SQLite allocation includes final shutdown evidence and avoids counting the same pages twice in the WAL.

| Measure | Final sample |
|---|---:|
| Eligible mappings | 865 |
| Selected complete mappings | 536 |
| Deferred mappings | 329 |
| Unique Kalshi / Polymarket US subscriptions | 500 / 455 |
| Exploration mappings | 105 |
| Configured exploration / rotation | 20% / 15 minutes |
| Book updates processed before shutdown | 45858 |
| Book evidence records persisted before shutdown | 1494 |
| Book updates / evaluations per second | 50.93 / 124.54 |
| Valid-book processing p50 / p95 / p99 ms | 0.849 / 3.609 / 5.759 |
| Event-loop p50 / p95 / p99 / maximum ms | 11.035 / 13.099 / 16.892 / 629.670 |
| Persistence acknowledgment p50 / p95 / p99 ms | 1.109 / 148.310 / 276.127 |
| Persistence write p50 / p95 / p99 ms | 0.109 / 1.413 / 4.624 |
| Final pre-stop persistence backlog | 0 |
| Database growth bytes/hour | 69402310 |
| Projected decimal GB/day | 1.666 |
| Reduction vs approximate 3.18 GB/hour baseline | 45.82× |
| Raw occurrences / verified opportunities | 136 / 0 |

The update counter includes invalidations. Percentiles retain at most 10,000 recent observations; they are not uncapped whole-run distributions. Storage estimates depend on current opportunity frequency and catalog changes. A busier opportunity set can legitimately produce more evidence. The 128 MiB serialized-history guard fails closed; it does not silently drop evidence.

## Stability and request comparison

| Measure per hour | Previous preserved session | Final sample |
|---|---:|---:|
| Recovery reconnects | 707.20 | 39.98 |
| Reconciliation mismatches | 495.69 | 0.00 |
| Stream errors | 29.60 | 0.00 |
| Reconciliation checks | 5128.56 | 1647.21 |

The previous denominator is 1.858 hours from session start to its last diagnostic. It has no clean end marker and includes pauses. Its disconnect counter is not identical to the new actual-close diagnostics. See [baseline evidence](evidence/sustained-baseline.json).

The final sample recorded 29 close events (115.94/hour), including 19 planned subscription changes. Recovery reconnects and planned membership changes must not be combined into one stability claim. Final shard connection ages and ten-second connected-sample fractions are in the JSON; sampled fractions can miss brief outages and are not exact uptime. The run recorded 2 event-loop recovery episodes.

Observer REST attempts ran at 11178.67/hour plus 2754.69/hour in catalog workers. The old code did not count every metadata/catalog request, so an exact total-REST before/after comparison is unavailable. Reconciliation is now deduplicated across mappings, alternates venues and is paced at at most 30 attempts/minute by default. All REST host limits and official source links are in [the architecture notes](SUSTAINED-RESEARCH.md).

98 REST snapshots had an older venue timestamp than the stream and were classified separately. Their prices did not overwrite stream state or trigger a claim of stream inconsistency. Equal/newer/unknown-timestamp mismatches still quarantine/recover. The strict two-second age limit, sequence checks and fresh-snapshot requirement were not loosened. Clock offset remains unknown, so exchange-to-receive values are not one-way latency measurements.

## Failures retained and resolved

An earlier 15-minute stage reduced storage to about 71 MB/hour but still had 30 recovery reconnects and six event-loop-delay episodes. Its traversal failed to reach Polymarket reconciliation, so its zero mismatch count was misleading. [The intermediate evidence](evidence/sustained-intermediate.json) is retained.

Follow-up fixes moved review/capacity scoring to a reader worker, removed redundant sizing and repeated shard-hash computation from ingestion, alternated venue reconciliation, and distinguished stale REST evidence from stream contradictions. A live targeted-snapshot experiment was rejected by Polymarket US because the slug was already subscribed; that unsupported approach was removed. Kalshi uses its documented existing-subscription snapshot command. PM-US actionable mismatches retain affected-shard recovery. Parser diagnostics now distinguish known local failures without logging private payloads.

Two full live catalog scans completed during the final sample. A late event-loop stall subsequently triggered recovery of all ten active shards. Diagnostics reported metadata and reconciliation active, catalog discovery inactive, and a small persistence backlog at the first recovery. The precise source of the initial stall is not established; correlation with metadata activity is not proof of causation. This remains a follow-up profiling issue before claiming uninterrupted multi-day operation. Planned capacity changes still caused subscription churn; longer observation should evaluate its frequency, including multiple exploration rotations. No cap was increased above 500 per venue.

## Evidence and review

The final saved evidence replay reproduced 136 opening calculations and 665 state gross calculations. Both book references resolved for all 665 states. Database quick-check returned ok. [Replay evidence](evidence/sustained-replay.json) can be regenerated with `worker/audit-evidence.mjs DATABASE OUTPUT_JSON`. All observations remained unverified and produced 0 latency-profit rows. Separate regression fixtures reproduce all eight latency buckets for both first-leg venues and leave post-crash coverage unknown.

The final review snapshot counted 558 high-priority active unverified mappings, 110 with raw history, and 117 structural conflicts. These counts use active mappings; the historical export includes the entire retained registry and has different denominators.

[Review priorities](REVIEW-PRIORITIES.md) contain 40 candidate mappings and ten side-by-side packages drawn from 1,920 preserved historical occurrences across 198 mapping/orientation groups. They include canonical identities, matches/differences/unknowns, full available metadata rules, settlement sources, cancellation and tie/retirement caveats, orientation, and raw counts. External documents linked in rules are flagged for inspection. Repeated YES/NO labels are explicitly warned about. No identity, priority, export, or later approval retroactively turns these observations into verified profit.

## Required checks and remaining limits

115 tests, TypeScript, randomized detector equivalence, staged load, concurrent discovery load, build, authenticated dashboard access and script syntax passed. At 500 synthetic mappings the detector processed about 996 updates/sec with processing p50/p95/p99 0.247/0.416/0.521 ms. The 25,000-market-per-venue discovery load passed at about 997 updates/sec. [Test evidence](evidence/sustained-tests.json) records these separately from live measurements. The existing build route-classification notice remains. Visual browser interaction was not repeated.

The bounded validation meets the storage-reduction target and shows a substantial recovery improvement, but the remaining event-loop episode prevents a claim of uninterrupted reliability. It does not establish multi-day uptime, exchange execution quality, reliable one-way latency, a verified equivalent universe, or profitable arbitrage. The next research step is human rule review followed by longer monitored observation with these same fail-closed gates. No production trading deployment is implied.

## Final recovery-offload follow-up

After the longer sample, invalidation sizing was removed from the ingestion thread. Books become invalid immediately; the ordered worker still calculates and persists terminal evidence with the existing censoring semantics. A regression test verifies both immediate quarantine and saved invalid-book evidence.

The final 300.38-second authenticated sample recorded 10 recovery reconnects, 1 event-loop-delay episodes, 0 actionable reconciliation mismatches, and 0 stream errors. Its maximum event-loop delay was 3500.15 ms and final pre-stop queue depth was 0. It processed 17613 updates and persisted 1276 book evidence records before shutdown. Logical storage growth was 158.3 MB/hour (3.80 decimal GB/day), about 20.1× below the approximate prior rate; short-run catalog and controlled-recovery costs make this noisier than the 15-minute storage estimate.

An intentional pause/resume quarantined 942 books in a 68.20 ms HTTP round trip. The queue had 944 pending items at that measurement and drained; this was a controlled operational interruption, not a venue outage. Saved evidence replay reproduced 63 openings and 487 state gross calculations after the offload change. See [follow-up metrics](evidence/sustained-recovery-followup.json) and [follow-up replay](evidence/sustained-recovery-replay.json).

The short follow-up validates recovery behavior; it does not explain the initial spontaneous stall in the longer sample or replace multi-day observation. A synthetic load attempt run concurrently with this live observer exceeded the 250 ms persistence-p99 guard at 250 mappings (286.8 ms). The required isolated load run was repeated after the observer stopped; its result is recorded in the test evidence. This laptop should not be assumed to sustain unrestricted concurrent research and stress-test loads.
