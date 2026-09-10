# Pre-observation hardening

Status: hardening code implemented and locally validated September 10, 2026. This remains the controlling specification. Evidence is in SCALE-VALIDATION.md, scale-validation.json, scale-soak.json and hardening-live-validation.json. The full research phase remains open: sustained verified-market observation and actual Linux reboot validation have not been completed.

Use built-in capabilities and native skills only; do not use user-installed skills, including Superpowers. Never use brainstorming. Work inline in tested sections and push completed checkpoints to GitHub. No live trading, account mutations, paid infrastructure provisioning, or full-universe subscription is required by this plan.

## Goal and operating boundaries

Continuously discover and observe as much of the safely matchable Kalshi × Polymarket US universe as measured API and observer capacity allow. The initial 10–30 verified mappings are a performance-validation stage, never a permanent cap. A temporary capacity limit must reflect a recorded measurement or current venue constraint, be configurable, and expose deferred coverage.

Keep one persistent Node service with durable SQLite on macOS or inexpensive Linux. SQLite remains the canonical research record unless measurements demonstrate a reason to change it. Do not introduce Supabase, PostgreSQL, Redis, Kafka, Kubernetes, or comparable infrastructure without that evidence.

The current baseline is authenticated stream acceptance, 56 passing tests, short live samples, two UNVERIFIED configured pairs, and a stopped observer. No safe scale envelope or verified-market profitability finding exists yet. Existing reports, loopback controls, mapping history and service template are foundations, not proof that the additions below are complete.

## Checkpoint 1 — Metric eligibility and evidence labels

Files: lib/research/{recorder,report,latency,types}.ts; tests/{research,latency}.test.ts; worker/dashboard.html; app/research.tsx.

- [x] Audit every aggregate and opportunity row against mapping status at observation time. Preserve raw discrepancies for UNVERIFIED candidates; exclude them from executable, arbitrage-profit, latency-adjusted-profit, bankroll-profit and future trading eligibility metrics.
- [x] Only AUTO_VERIFIED and MANUAL_VERIFIED mappings can enter those metrics, and only after ordinary fee, depth, freshness and threshold gates pass. Verification alone does not imply an executable opportunity.
- [x] Keep invalidation history and invalidate eligibility on changed settlement rules. Later verification must not retroactively upgrade unverified historical observations.
- [x] Define and expose RAW DISCREPANCY, UNVERIFIED CANDIDATE, VERIFIED ARBITRAGE, FEE-POSITIVE and LATENCY-SURVIVABLE separately. Price/depth estimates on raw rows must be labeled as estimates from observed books, not guaranteed hedges.
- [x] Test a mixed-status session, status transitions and empty eligible denominators across report, latency and exports. Include a profitable-looking unverified discrepancy and prove it cannot increase any eligible-profit result.

## Checkpoint 2 — Measurements before expansion

Files: worker/{observer,streams,server}.ts; lib/research/{store,report}.ts; new worker/telemetry.ts and tests/telemetry.test.ts.

- [x] Persist sampled telemetry with session identity and measurement intervals: subscribed markets per venue; messages/sec; book updates/sec; evaluations/sec; p50/p95/p99 processing lag; event-loop lag; persistence queue depth; reconnects; parser errors; sequence and reconciliation recoveries; CPU; memory; database size and growth rate.
- [x] Define processing lag as receive-to-processing timestamps, separately from processing duration and receive-to-persist latency. Record UTC and monotonic timestamps, exchange timestamps/sequence when supplied, and request/ping round-trip timings where supported.
- [x] Include host/runtime identity and clock uncertainty for local versus VPS comparisons. Exchange-to-receive differences are not proven one-way network latency. Never compare monotonic timestamps across processes or sessions.
- [x] Instrument the actual persistence path. If writes remain synchronous, disclose that there is no application queue and measure blocking write duration; do not present a constant zero backlog as proof of spare capacity.
- [x] Keep telemetry bounded and out of per-message hot-path expensive scans. Measure SQLite database plus WAL growth without copying a live database unsafely.
- [x] Test counters, time-window rates, percentiles, missing timestamp handling, queue/blocking-write semantics and session resets against deterministic clocks.

## Checkpoint 3 — Continuous discovery and dynamic subscriptions

Files: lib/arb/adapters.ts; lib/research/{matching,mappings}.ts; worker/{config,observer,streams}.ts; new worker/coverage.ts and tests/coverage.test.ts.

- [x] Implement the lifecycle: paginated exchange catalogs → candidate discovery → structured/text matching → persistent registry → subscription reconciliation → observation. Measure catalog completeness and expose fetch errors/truncation instead of claiming full-universe coverage.
- [x] Upsert new candidates as UNVERIFIED without duplicate history, stale metadata overwrites or silent promotion of prior invalidations. Text similarity remains candidate generation only.
- [x] Reconcile deduplicated venue subscriptions when new candidates arrive or markets close, resolve, invalidate or reopen. Preserve mappings/history; unsubscribe a market only when no remaining eligible observation mapping needs it.
- [x] Verify current official venue subscription, connection and request limits before implementation. Batch/shard within those limits, apply backoff, and expose active/deferred counts and reasons.
- [x] Fail closed during shard/reconnect changes; require fresh valid snapshots before using new books. Prevent duplicate subscriptions and double-counted updates when reconnect and discovery overlap.
- [x] Test catalog pagination, idempotent discovery, shared-market subscriptions, lifecycle removals, shard boundaries, capacity deferral and reconnect races with scripted feeds.

## Checkpoint 4 — Research results, drill-down and exports

Files: worker/{server,dashboard.html,cli.ts}; app/research.tsx; lib/research/report.ts; new lib/research/exports.ts; tests/{observer,latency}.test.ts and new tests/exports.test.ts.

- [x] Make the research dashboard/report the primary results interface. Expose uptime, venue stream health, subscribed markets, candidate totals and verified/unverified/invalidated counts, raw discrepancies, fee-positive opportunities, qualifying net arbs, every latency bucket, modeled orphan rate/loss, theoretical opportunity, bankroll-constrained opportunity at $100/$250/$500/$1,000, latency-adjusted opportunity, processing latency and persistence backlog.
- [x] Add a paginated opportunity table with first-seen timestamp, pair/event, orientation, each venue's executable price estimate, quantity/depth, gross edge, fees, reserve, net edge, ROI, lifetime, survival by latency bucket, $100-bankroll modeled profit, final status and rejection reason. Ineligible rows must not display eligible-profit values.
- [x] Add drill-down into the recorded lifecycle and referenced book states, including timestamps, consumed depth, mapping verification history and latency outcomes. Keep business calculations in shared research modules.
- [x] Provide session selection, session-level JSON reports, CSV opportunity export, database size/growth statistics and safe backup instructions. Preserve modeled-versus-real and fixture-versus-live distinctions in all formats.
- [x] Use allowlisted export fields; exclude credentials, signatures, authorization headers, private keys and control tokens. Escape CSV fields and guard spreadsheet formula interpretation in text fields.
- [x] Test mixed-status exports, session isolation, pagination, lifecycle references, CSV escaping, secret exclusion and authenticated access. Verify the actual dashboard flow without a visual redesign or gamification work.

## Checkpoint 5 — Persistent deployment and health

Files: deploy/lights-on-observer.service; worker/{cli,server,observer,config}.ts; docs/research/SETUP.md; tests/observer.test.ts; new docs/research/EXECUTION-BOUNDARY.md.

- [x] Document reproducible macOS development and inexpensive Linux/VPS deployment: supported Node installation, checkout/dependencies, durable disk, dedicated service user, owner-only secret file outside Git, service install/enable/start, upgrades and rollback, logs, SSH-tunneled control access, and backup/restore.
- [ ] Verify restart after process failure and server reboot, exclusive writer ownership, recovery/censorship of interrupted observations, fresh stream snapshots, and safe PAPER_RESEARCH resumption. Never restore stale books as live.
- [x] Add health monitoring that can detect an unexpectedly stopped process from outside that process, plus stream-stall and disk/recording failure visibility. Document how an operator checks failures; configuring third-party notifications is a separate authorized action.
- [x] Keep controls on loopback/private access and authenticated. Test unauthenticated and cross-origin denial. Do not provision a host or assume an optimal provider/region; compare timestamp and RTT evidence before deployment recommendations.
- [x] Document the future execution boundary only: actual venue order/fill APIs are authoritative; internal intents and acknowledgments are not fills; reconcile both venues independently; unknown, partial and orphan states remain explicit; two-leg success requires both fills confirmed. Add no trading client or order endpoint.

## Checkpoint 6 — Staged scale evidence and observation gate

Files: new worker/scale.ts, tests/scale.test.ts and docs/research/SCALE-VALIDATION.md; worker/cli.ts.

- [x] Build deterministic recorded/synthetic load replay through the real normalization, evaluation and persistence paths. Label it load-test evidence, never real opportunity evidence.
- [ ] Use 10–30 verified mappings → 100 → 250 → 500+ or the maximum viable eligible universe. Report candidate/verified counts separately; insufficient verified mappings is a recorded coverage limitation, not permission to weaken verification.
- [x] At each stage save all checkpoint-2 metrics, run duration, workload/update distribution, unique markets per venue, machine/disk/runtime details, configuration and correctness outcomes. Distinguish synthetic capacity tests from actual venue coverage.
- [x] Define and record stop thresholds before each stage relative to configured freshness and latency-analysis requirements. Stop expansion if processing/persistence falls behind, resource use grows without bound, parser/sequence failures remain unresolved, or reconnects distort coverage. Do not discard failed stages.
- [x] Document the tested safe envelope, bottlenecks, deferred markets and reasons for the selected operating capacity. Re-test after meaningful changes; do not extrapolate a short low-load run into 500-market reliability.
- [ ] Begin a sustained verified-market observation only after the preceding gates pass. Export a live session report and audit representative opportunities against recorded books, fees, labels and loss accounting. No verified opportunities means no supported profitability conclusion.

## Checkpoint verification and completion

For each implementation section, add behavioral regression coverage, run `npm test` and `npx tsc --noEmit --incremental false`, inspect `git diff --check`, update HANDOFF.md and VALIDATION.md, and push the tested checkpoint. Run the application build and browser-flow checks for dashboard changes; use staged worker tests for stream/load/deployment changes. Report exact commands and results, not assumed passes.

Completion requires recorded scale and operating evidence, usable authenticated research results/drill-down/exports, deployment/recovery instructions, health monitoring, and eligibility isolation across all views. Requirements documentation, a working dashboard, or a synthetic replay alone cannot close this phase. Real-money execution remains excluded.

## Implementation evidence and remaining gates

Checked items above describe implemented behavior with local tests; they do not certify all production operating conditions. Tests are grouped in hardening.test.ts, telemetry.test.ts, detector-equivalence.test.ts, scale.test.ts and the existing observer/research/latency suites; filenames in the original specification were indicative.

The detector uses cumulative depth and exact bounded branch-and-bound sizing, not a quantity-by-quantity full-depth walk. Selected optimal quotes replace exhaustive persisted curves. SQLite writes, expiry and latency analysis run in a persistence thread; read-only report workers protect ingestion from report scans. Queue count/bytes and failures are explicit. Processing lag, processing duration, receive-to-enqueue completion, write service time and enqueue-to-ack timings are separate measurements. Sample buffers are bounded; interval rates and session lifetime rates are labeled separately. Disk/WAL size and growth are sampled in the persistence thread. Runtime, host and clock limitations are recorded.

Orientation/identity/settlement changes invalidate verification and active lifecycles. Old metadata responses cannot override newer versions. Stream liveness is independent of book-change freshness. Socket recovery affects its own group; identical Kalshi subscription IDs on other connections are independent. Public catalog pagination feeds the persistent candidate registry and dynamic deduplicated subscriptions. Fuzzy matches remain UNVERIFIED.

Synthetic stages and a 30-second report-contention run pass up to 500 mappings. Actual verified-market stages remain unchecked because no justified equivalent mappings are available. The two live smoke mappings remain UNVERIFIED. Linux service restart/reboot is documented but not tested on an actual Linux host; local lease, interrupted-session censorship and fresh-snapshot behavior have regression coverage. External health check and backup integrity were exercised locally.

The actual authenticated dashboard was exercised for labels, both-first-venue reporting and recorded-state/mapping-history drilldown without JavaScript errors. JSON/CSV routes and access restrictions pass automated tests; CLI CSV was parsed. The embedded browser did not deliver its download event, so native save-dialog completion is not claimed. Deployment and execution-boundary instructions reflect the implemented system; no host was provisioned and live trading remains disabled.
