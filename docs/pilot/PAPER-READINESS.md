# Paper selection and responsiveness checkpoint

## Why no trades

Strict registry approvals remain zero. Matching names/events is not settlement equivalence: the supported ordinary-outcome sports profiles still have exceptional-state differences, and conditional approvals remain disabled at the user's request. The completed two-minute live check and 90-second profiling check also recorded zero positive research states. The existing paper costs, minimum profit, ROI, cash, sequence and freshness gates remain unchanged. No paper entry or profit was manufactured to demonstrate activity.

## Changes

Paper subscription selection now excludes pairs whose latest venue closure exceeds the lesser of the configured paper horizon and the existing challenge end. Full research observer selection is unchanged. Exclusions are reported separately from capacity deferrals. Already approved but out-of-horizon pairs cannot consume paper subscription priority. This does not remove mappings or historical evidence.

A fresh allocation using the saved registry previously selected 296 out-of-horizon pairs among 510 selections. The corrected allocation selects 501 pairs, zero beyond the paper horizon, from 1,262 compatible candidates; 447 mappings are excluded by the paper horizon. Those are allocation comparisons, not a reconstructed historical subscription list.

Paper decision bursts now yield to the I/O event loop after 16 decisions or eight milliseconds, instead of draining indefinitely through promise microtasks. This lets socket/timer callbacks run during bursts. A 1,000-candidate cold diagnostic benchmark previously held the I/O callback for 381.64 ms; after the change it ran after 9.06 ms with 990 candidates still queued. This measures responsiveness, not reduced total calculation time or guaranteed trade latency.

Paper decision, decision-slice and SQLite write timings are now recorded in existing observer telemetry. No execution, settlement or money-risk gate was relaxed.

## Bounded live evidence

- 120-second run (`6a478486-04e1-4cf7-ae96-d11afdca1bc1`): 122.968 seconds including setup/drain. Last telemetry: 8,246 book updates, 17,082 research orientation evaluations, 501 selected pairs, zero positive research states. Paper decision p99 0.432 ms, write p99 1.765 ms. One event-loop recovery episode occurred, and connections recovered.
- 90-second CPU-profile run (`6fe361a3-7b5e-4f03-b5d3-93390779285c`): 92.833 seconds including setup/drain. Last telemetry: 6,561 updates, 13,030 research orientation evaluations, 501 selected pairs, zero positive research states. Paper decision p99 0.507 ms, write p99 2.450 ms. No event-loop recovery episode occurred. CPU sampling did not establish the cause of the intermittent stall; do not claim it fixed.

Both processes exited zero, saved session end times and released both leases. Final stream snapshots were connected with an empty persistence queue and no persistence failure. The $50/$50 paper cash, zero positions and zero conditional approvals were preserved. Last telemetry counters precede shutdown and are not exact whole-session totals. No build, test suite or load benchmark overlapped live collection.

## Validation and operation

195 tests pass, TypeScript check passes and production build passes. New tests cover I/O interleaving during a burst and horizon-aware allocation without changing general research selection. The working command remains:

```sh
npm run paper -- run observer.config.json research-data/paper-bot.sqlite
npm run paper -- status research-data/paper-bot.sqlite
npm run paper:review -- observer.config.json research-data/paper-bot.sqlite
```

No worker is left running. The remaining blocker is strict settlement approval and an actual opportunity that meets paper costs/limits. Neither more runtime nor better UI is evidence that those conditions are satisfied. Actual-market entry/hedge execution and profitability remain unproven; real trading stays disabled.

Commit/push: the configured 1Password signer failed with `failed to fill whole buffer` and Git could not write the commit object. All checkpoint changes remain local/staged; no commit or push was made. Signing was not bypassed.
