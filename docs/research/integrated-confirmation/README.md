# Integrated opportunity confirmation — September 21, 2026

The existing `candidate-confirmation.ts` screen now calls PR #6's `ConfirmationFeed.confirmKalshi` and `confirmPolyBook` adapters directly. There is no PM-US REST book request in this screen. The control mode and the 30-minute experiment share the same confirmation, latest-book checks, same-quantity repricing and classification path. PR #5/#6 source heads, controls and historical evidence remain preserved.

Book confirmation, fee-bound economics, market status, settlement equivalence, additional policy admission and trading authorization are separate fields. A positive spread surviving requested books is useful observed economics, not executable arbitrage or a fill. Status or settlement uncertainty does not turn successful book confirmation into failure. Adverse newer stream versions supersede earlier depth; a superseded proof remains failed/unknown survival even when newer displayed economics can be calculated. Known nontrading states block tradability and further candidate checks; their price evidence is retained.

## Kalshi status bootstrap

One shared `market_lifecycle_v2` subscription is added to the existing Kalshi book socket. It has no unsupported ticker filter. The worker waits for the server's correlated subscription acknowledgement before issuing any baseline Get Market request. It processes all message sequences for that subscription, including unrelated market/event messages, but stores only selected-market events. Each status fetch records its request/response times, retained headers and body hash; events arriving before or during the request remain retained. A baseline does not overwrite deactivation or erase contradictory evidence.

A strict sequence gap/reorder, missing sequence, changed subscription, disconnect, unknown event or buffer overflow retains a status block. Relevant event arrival ordering is retained; the REST response cannot be placed atomically in that ordering. Limits: 2,048 relevant events total, 32 per selected market, with sticky blocking on overflow. Irrelevant events are counted but not logged individually. Stream ingress limits and the overall 256 MiB evidence limit bound other logging/buffers.

The reducer tracks reported status, deactivation/activation, determination/settlement, close-date changes, metadata changes, implicit close time, contradictions and unresolved reactivation. Reopening never silently clears a negative observation. **No atomic initial-state guarantee is claimed.** Missing cache evidence stays unknown. An active Get Market report plus no deactivation event does not prove current active status. The published classification therefore remains UNRESOLVED or KNOWN_BLOCKED; status admission stays false. This gate does not suppress book-confirmed economics. No developer-support reply is required and no support contact is made.

Primary references: [Get Market](https://docs.kalshi.com/api-reference/market/get-market), [lifecycle channel](https://docs.kalshi.com/websockets/market-and-event-lifecycle), [documented status transitions](https://docs.kalshi.com/getting_started/market_lifecycle), [subscription acknowledgement](https://docs.kalshi.com/websockets/websocket-connection). Kalshi explicitly documents time-based opening/closure without lifecycle events; heartbeat and event silence are not status proof.

## Frozen observation parameters

Refresh the existing category-neutral matched selection; retain distinct routes and deduplicate shared book subscriptions. No listing search, matching rewrite or price-driven selection. Baseline fee schedules, quantity cap of 10, same-quantity confirmation, risk allowances and reservations are unchanged.

- One 30-minute supervisor deadline, no restart; 2 GiB minimum free space, worker silence limit 60 seconds, evidence cap 256 MiB.
- At most 120 paired confirmations; one in flight; at least two seconds globally and 35 seconds per candidate. A previously attempted unchanged book-content fingerprint is not retried. Price/depth changes permit a later check within these bounds; repeated samples do not create new intervals.
- 250 ms event coalescing; 1,500 ms snapshot response bound, 250 ms processing bound, 2,000 ms confirmation age/cross-venue delay, 1,000 ms clock-divergence bound. No age threshold increase.
- Baseline status GETs are serial with 250 ms spacing after each response, below four requests/second. No repeated status polling; ongoing lifecycle and close-time evidence retain their initialization/cache uncertainty. A 429 stops status bootstrap and retains the status block.
- AOC settlement remains UNRESOLVED. Orders and real profit measurement are disabled.

## Brief integrated control

The same screen ran for 30 supervised seconds over unemployment and Toronto/Baltimore routes, forcing one `NO+YES` quote check per route independently of profitability. Both requested-book confirmations passed; both price comparisons were nonpositive. Their internal outcome enum is not evidence that a previously detected edge disappeared. Kalshi status remained UNRESOLVED; lifecycle acknowledgement preceded both baseline requests. No lifecycle transition arrived during this short check, so actual deactivation handling is demonstrated by focused integration tests, not claimed as a live event.

See [actual control evidence](control-summary.json) and [control report](CONTROL.md). The experiment uses a separately refreshed/frozen selection and the same source. The control and experiment use the existing supervisor and reporting command; no standalone auditing tool was added.

```sh
node --experimental-strip-types worker/executable-screen.ts confirmation-control-prepare CONTROL_DIR PREVIOUS_FREEZE_DIR
node scripts/confirmation-launch.mjs CONTROL_DIR ENV_FILE
node --experimental-strip-types worker/executable-screen.ts confirmation-prepare EXPERIMENT_DIR PREVIOUS_FREEZE_DIR
node scripts/confirmation-launch.mjs EXPERIMENT_DIR ENV_FILE
node scripts/confirmation-report.mjs EXPERIMENT_DIR SUMMARY_JSON REPORT_MD
```

Output directories are single-use. Do not run these commands again against completed or active evidence. Hosted CI performs full tests/typecheck/build; focused integration/adapter/stream tests ran before collection. No fee tuning, sizing optimization, recovery changes, private-account reads or ledger writes.
