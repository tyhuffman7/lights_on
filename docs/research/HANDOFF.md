# Continue Lights On here

Use built-in capabilities/native skills only. Do not use installed skills, including Superpowers, and never brainstorming. Keep live trading completely disabled. Push tested implementation checkpoints to `tyhuffman7/lights_on` main. HARDENING.md is the implementation specification; REQUIREMENTS.md preserves the original brief.

## September 10 hardening implementation

The hardening code is implemented. Detector sizing uses cumulative depth and bounded exact search; randomized tests compare it to the original exhaustive implementation. SQLite writes/expiry/latency analysis run in a dedicated worker with ordered messages, bounded queue count/bytes, failure pause and shutdown drain. Reports use a separate read-only worker. Performance instrumentation covers processing, persistence, event loop, request/ping RTT, CPU/memory, coverage and database growth.

Mapping orientation/identity/hash changes invalidate prior verification and censor active opportunities. Older metadata cannot replace newer review state. Discovery now paginates catalogs, persists UNVERIFIED candidates, reconciles deduplicated subscriptions and reports incomplete/deferred coverage. Groups have their own cache/connection/recovery; a default configurable 500-market-per-venue ceiling and 100-market group size reflect local synthetic measurements. Text similarity never grants verification. Heartbeat health does not renew stale books.

Schema-2 reports represent Kalshi-first and PM-US-first separately, keep unavailable profit unknown, and exclude raw candidates from eligible profit. The dashboard supports sessions, opportunity pages, recorded-book/mapping-history detail and JSON/CSV export. Full-session CSV, consistent SQLite backup, external health checker and systemd health timer are included. EXECUTION-BOUNDARY.md is design only; no order client was added.

See VALIDATION.md and SCALE-VALIDATION.md for exact checks and measurements. The staged 30/100/250/500 synthetic mapping run passed, as did a 30-second 500-mapping run with five concurrent reports. These are not exchange fill or full-universe reliability measurements. Earlier failed stages are preserved in scale-validation.json.

## Current local state

The observer is **stopped**. Credentials are already saved and validated in ignored owner-only `.env.research`; the Kalshi PEM is in ignored `research-data/kalshi-private-key.pem`. Never print or commit either. `observer.config.json` still has two UNVERIFIED Emmy supporting-actor candidates. Do not approve equivalence without full settlement/tie/cancellation/void evidence.

The latest bounded authenticated smoke session lasted about four minutes, persisted 28 book records including invalidations, exercised three reconciliation mismatch recoveries, passed the external health check and shut down cleanly. It found zero opportunities. Its summary is hardening-live-validation.json. The database is local-only at research-data/hardening-smoke.sqlite. A consistent backup passed integrity and matched table counts. Earlier authenticated-stream-validation.json and sample-live-report.json remain historical evidence.

## Remaining operating/research work

1. Check current Git status/log and HARDENING.md before modifying anything. Implementation is present; do not recreate a plan instead of inspecting code.
2. Review representative catalog candidates against both venues' authoritative settlement terms. No justified real verified mapping set exists yet. Missing equivalence evidence is a real observation gate, not permission to weaken verification.
3. Once suitable mappings exist, run actual verified-market observation in stages, retaining telemetry and failed stages. The synthetic 500 ceiling is configurable, not a promise of hours-long reliability or arbitrage profitability. Measure real catalog size, shared-market fanout, books, recovery and disk growth on the chosen host.
4. Audit any qualifying opportunity against recorded books, timestamps, fee bounds, both first-leg scenarios and loss/unknown denominators. Export a live report. Zero verified opportunities gives no profitability conclusion.
5. If deploying to Linux, follow SETUP.md. Actual service-failure/reboot validation still needs a Linux host. No host was provisioned, paid service purchased, notification sent or public control endpoint enabled. Test restart, fresh snapshots and the external timer on that host before unattended observation.
6. The embedded browser exercised authenticated reports and detail without JavaScript errors but did not expose the download completion event. API/CLI exports pass tests; native save-dialog completion remains unverified.

## Limits

SQLite remains canonical, with full books and compact selected quote evidence. A bounded detector search can reject pathological depth; it never substitutes an approximate profitable result. Queue failure pauses observation. Price freshness remains conservatively two seconds even on healthy idle streams. REST reconciliation is sampled and non-atomic; metadata polling is not instantaneous. The periodic metadata/reconciliation sweep can take longer than its timer at broad coverage because requests are throttled.

Synthetic modes are explicit. Simulated fills are not actual fills; fill fragmentation/queue priority/partial hedge submissions remain unmodeled. Residual orphan exposure keeps net P&L unknown. Capital is locked per venue and is not recycled from assumed settlements. Full research-phase completion still requires sustained verified live evidence.

GitHub preserves source and sanitized validation/handoff files, not credentials, local databases or a running observer. The worker needs a persistent process/disk separate from the hosted request-oriented site. The hosted site remains a report-snapshot viewer; live controls are loopback-only and use an SSH tunnel remotely.
