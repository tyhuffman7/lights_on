# Continue Lights On here

User preference: **never use the brainstorming skill**. The controlling brief is `REQUIREMENTS.md`. Work in tested sections and push each checkpoint to `tyhuffman7/lights_on` main. Do not implement real-money execution.

## Current status — September 10, 2026

Research implementation is ready for credentialed venue validation. The research phase is **not complete**: no authenticated observation period or profitable live arbitrage has been demonstrated. The user has no keys yet and asked for an exact setup list; `SETUP.md` provides it. Local `.env.research` and `observer.config.json` were created, ignored by Git. Neither contains exchange keys. Do not commit them.

Completed:

- Separate market-data, mapping/matching, detection/fee, and research/simulation modules.
- Persistent SQLite mapping registry/history, full normalized book records, opportunity lifecycles, rejection states, and restart censorship.
- Kalshi snapshot/delta parsing and subscription-scoped sequence checking; PM-US full-book replacements; reconnect/heartbeat and conservative freshness gates.
- Eight latency buckets, both first-leg venue scenarios, fixed $100 opening hedge and price limit, as-of book lookup, partial IOC unwind and residual exposure reporting.
- Research KPIs, censored lifetime accounting, independent theoretical profit, conservative chronological bankroll scenarios, breakdowns and JSON export.
- Background Node worker, metadata/reconciliation loops, single-observer lease with confirmed-dead-owner recovery, token-protected loopback controls, deterministic protocol replay fixture, and systemd template.
- Site home now shows research report snapshots and links to worker controls; the legacy challenge/scanner/ledger remains at `/challenge`.
- 53 tests pass, TypeScript passes, Sites/Vinext build passes. See `VALIDATION.md` for exact files and evidence.

GitHub checkpoints: `1fd8289` (persistent core), `7eb4496` (latency/reporting), plus subsequent observer/interface/setup commits. Read `git log -5` for the latest revision; do not assume an old chat's SHA is current.

## Next session

1. Read SETUP.md, SOURCES.md, VALIDATION.md, and REQUIREMENTS.md. Review known limitations before interpreting results.
2. Ask only whether the user has saved the keys, without requesting their values. Use `.env.research` locally and never log headers, signatures or key material.
3. Validate actual authenticated handshakes and stream payloads. Fix schema differences with recorded, sanitized fixtures and regression tests; push the fixes.
4. Run discovery, populate exact market IDs in the local config, and review both venues' settlement terms. Text similarity cannot authorize a pair. The structured-proof service is tested, but current public adapters do not populate all the source/void fields, so ordinary candidates require manual review.
5. Start a bounded observation window with a small verified set. Measure book freshness, disconnects, sequence recovery, processing lag and evidence growth. Scale only after throughput is measured.
6. Export a **live** report and audit depth, fees, opportunity IDs, loss accounting and missing-data denominators against saved books. A REST probe or synthetic replay is not a substitute.
7. Only then assess whether the research-phase definition of done is met. Live execution is still outside scope even if the report is favorable.

## Evidence already obtained

Actual public REST probe: `sample-public-probe.json`, September 10 16:29:43–16:29:55 UTC. Catalog samples: 445 Kalshi and 300 PM-US markets; four books retrieved; no request errors. Zero verified mappings and no authenticated stream coverage. This establishes public connectivity only.

Synthetic replay: `tests/fixtures/research/lifecycle.json` passed through the same book parsers/recorder, with output in ignored `research-data/replay.sqlite`. Never present its profit/lifetime as actual evidence.

## Operational constraints

The worker is separate from Sites/Cloudflare request handlers and requires a persistent disk/process. GitHub stores code and handoff docs, not running processes, local evidence or credentials. No cloud infrastructure was provisioned and the existing hosted Sites deployment was not republished; the user selected GitHub as the checkpoint destination. Remote worker control uses an SSH tunnel; the hosted report viewer is currently snapshot-only.

Fee arithmetic is exact for the declared model, but visible depth does not reveal fill fragmentation. Quotes retain fee bounds and assumptions. Bankroll scenarios do not reuse shared-market exposure or reinvest unobserved settlements. Partial hedges, queue priority and venue acknowledgments are not modeled. Review SETUP.md for full limits.
