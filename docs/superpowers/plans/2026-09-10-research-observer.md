# Research observer implementation plan

Goal: record whether rule-equivalent Kalshi × Polymarket US opportunities remain executable after costs and latency. User requirements: docs/research/REQUIREMENTS.md. Never add trading. User says never use brainstorming. Execute inline and push each verified checkpoint to GitHub main.

Architecture: venue streaming adapters feed normalized in-memory books. A persistent mapping registry indexes markets to verified pairs. Pure detection and fee services feed a lifecycle recorder and observed-book latency/unwind analysis. A Node background process owns SQLite; the existing Sites UI remains a consumer. Synthetic replay results and actual observations must remain distinct.

Tech: existing TypeScript and node:test, Node built-in SQLite, ws for authenticated WebSockets. Keep current paper ledger and regression tests.

## Checkpoints

- [ ] 1. Research core: lib/research/{fees,books,mappings,detector,store,recorder}.ts; tests/research.test.ts. Persist sessions, mapping audit, normalized book updates, opportunities and lifecycle states. Test duplicate suppression, both orientations, stale/gapped books, depth, integer fee boundaries, invalidation and restart censorship. Remove implicit fee fallbacks from eligible quotes. Run node --experimental-strip-types --test tests/*.test.ts and npx tsc --noEmit --incremental false. Commit and push.
- [ ] 2. Latency: lib/research/latency.ts and report.ts; deterministic fixtures and tests. Freeze the opening hedge quantity and limit; reconstruct state as-of each deadline without look-ahead. Store coverage failures, hedge economics and partial unwind residual exposure. Report empty denominators as null; censored lifetimes separately. Bankroll totals must not reuse occupied capital or overlapping market depth. Commit and push passing tests.
- [ ] 3. Observer: worker/{observer,streams,cli}.ts. Authenticated GET-only feeds, full snapshots/deltas, subscription-scoped sequence checking, disconnect invalidation, heartbeat timeout and exponential reconnect, REST metadata/reconciliation. Add schema-checked config, graceful shutdown, health/report server bound to loopback, replay and service instructions. Test with a local scripted WebSocket server. Commit and push.
- [ ] 4. Dashboard research measurements and handoff: minimal display/control interface, no visual redesign. Document long-lived worker deployment separate from Sites request runtime. Run full regression/type/build checks. Record actual public observation probe and clearly state whether authenticated coverage exists; never substitute fixture results for live findings. Commit and push exact files/tests/limitations/run/schema/report instructions.

## Critical decisions

- Kalshi snapshot precedes deltas; seq is scoped to subscription. A gap invalidates affected books; REST alone cannot safely bridge stream sequence. Recover through a new stream snapshot.
- PM-US SUBSCRIPTION_TYPE_MARKET_DATA delivers complete displayed-depth books, not additive deltas. No fabricated sequence guarantee. Ignore lite/last-trade feeds for execution.
- Use monotonic local timestamps for durations/deadlines and wall UTC for reports. Persist session identity; never compare monotonic clocks across sessions. Book freshness is conservative: a heartbeat alone cannot refresh depth.
- Structured equivalence must include resolution source, void/tie treatment, thresholds/comparators and times. Text only suggests candidates. Missing structure requires manual review of fresh fingerprints.
- L2 data cannot reveal individual fill fragmentation. Preserve exact integer fee arithmetic but describe aggregate fee estimates/bounds honestly.
- No credentials are copied into source or logs. Missing authenticated stream credentials blocks live validation, not replay implementation.

## Verification baseline

2026-09-10: 31 existing tests pass. Local and GitHub main both fae43c9. No saved origin originally; configured origin to tyhuffman7/lights_on. Implementation branch research-observer; fast-forward main at each tested checkpoint.
