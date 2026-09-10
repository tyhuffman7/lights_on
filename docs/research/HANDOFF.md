# Continue Lights On here

User preference: **never use the brainstorming skill**. The controlling brief is `REQUIREMENTS.md`. Work in tested sections and push each checkpoint to `tyhuffman7/lights_on` main. Do not implement real-money execution.

## Current status — September 10, 2026

Both local credentials were accepted by the real authenticated market-data WebSockets. Sanitized actual frames exposed and now cover two parser fixes: omitted empty Kalshi sides and four-decimal PM-US quantities. The research phase is **not complete**: no verified-market observation period or profitable live arbitrage has been demonstrated. Local `.env.research` contains credentials; `research-data/kalshi-private-key.pem` contains the Kalshi private key. Both are owner-only and ignored by Git. Never print or commit them. The Kalshi path setting was repaired locally after a PEM was entered into the path field.

The observer is currently **stopped** after bounded validation. `observer.config.json` contains two UNVERIFIED Emmy supporting-actor pairs (Paul W. Downs and Michael Urie). No manual or automatic verification was granted: the available headline rules do not establish equivalent tie/cancellation/void handling. Do not ask the user to approve an unsupported equivalence claim.

Completed:

- Separate market-data, mapping/matching, detection/fee, and research/simulation modules.
- Persistent SQLite mapping registry/history, full normalized book records, opportunity lifecycles, rejection states, and restart censorship.
- Kalshi snapshot/delta parsing and subscription-scoped sequence checking; PM-US full-book replacements; reconnect/heartbeat and conservative freshness gates.
- Eight latency buckets, both first-leg venue scenarios, fixed $100 opening hedge and price limit, as-of book lookup, partial IOC unwind and residual exposure reporting.
- Research KPIs, censored lifetime accounting, independent theoretical profit, conservative chronological bankroll scenarios, breakdowns and JSON export.
- Background Node worker, metadata/reconciliation loops, single-observer lease with confirmed-dead-owner recovery, token-protected loopback controls, deterministic protocol replay fixture, and systemd template.
- Site home now shows research report snapshots and links to worker controls; the legacy challenge/scanner/ledger remains at `/challenge`.
- 56 tests pass, TypeScript passes, Sites/Vinext build passes. See `VALIDATION.md` for exact files and evidence.

GitHub checkpoints: `1fd8289` (persistent core), `7eb4496` (latency/reporting), plus subsequent observer/interface/setup commits. Read `git log -5` for the latest revision; do not assume an old chat's SHA is current.

## Next session

1. Read SETUP.md, SOURCES.md, VALIDATION.md, and REQUIREMENTS.md. Review known limitations before interpreting results.
2. Credentials are already saved and validated. Use `.env.research` locally; do not ask for the values or repeat setup. Check whether another worker owns the local database before starting.
3. Read `authenticated-stream-validation.json` and `sample-live-report.json`. The final 47-second observer run saved 38 valid stream books and shut down cleanly. The earlier run exercised event-loop recovery and has an unclosed session after process interruption; do not infer an end time.
4. Review both venues' full settlement terms and find a small genuinely equivalent non-sports set. The local discovery files are in `research-data/current-candidates.json` and `current-discovery.json`. Candidate matching now normalizes category aliases and does not confuse administrative close times with proven settlement deadlines. Text similarity cannot authorize a pair. The structured-proof service is tested, but current public adapters do not populate all the source/void fields, so ordinary candidates require manual review.
5. Start a bounded observation window with a small verified set. Measure book freshness, disconnects, sequence recovery, processing lag and evidence growth. Scale only after throughput is measured.
6. Export a **live** report and audit depth, fees, opportunity IDs, loss accounting and missing-data denominators against saved books. A REST probe or synthetic replay is not a substitute.
7. Only then assess whether the research-phase definition of done is met. Live execution is still outside scope even if the report is favorable.

## Evidence already obtained

Authenticated validation: `authenticated-stream-validation.json` records a 45-second standalone handshake/payload check (6 Kalshi parsed snapshots/deltas; 9 PM-US full books; no normalization errors after fixes) plus two bounded observer runs. `sample-live-report.json` is the final real 47-second session, with zero verified opportunities and null survival denominators. Its 42 book records include 4 shutdown invalidations. The sample demonstrates ingestion and persistence, not opportunity frequency, fills, or returns. `tests/fixtures/research/authenticated-books-2026-09-10.json` contains whitelisted public book payloads from the first live check; no credentials or account data.

Actual public REST probe: `sample-public-probe.json`, September 10 16:29:43–16:29:55 UTC. Catalog samples: 445 Kalshi and 300 PM-US markets; four books retrieved; no request errors. Zero verified mappings and no authenticated stream coverage. This establishes public connectivity only.

Synthetic replay: `tests/fixtures/research/lifecycle.json` passed through the same book parsers/recorder, with output in ignored `research-data/replay.sqlite`. Never present its profit/lifetime as actual evidence.

## Operational constraints

The worker is separate from Sites/Cloudflare request handlers and requires a persistent disk/process. GitHub stores code and handoff docs, not running processes, local evidence or credentials. No cloud infrastructure was provisioned and the existing hosted Sites deployment was not republished; the user selected GitHub as the checkpoint destination. Remote worker control uses an SSH tunnel; the hosted report viewer is currently snapshot-only.

Fee arithmetic is exact for the declared model, but visible depth does not reveal fill fragmentation. Quotes retain fee bounds and assumptions. Bankroll scenarios do not reuse shared-market exposure or reinvest unobserved settlements. Partial hedges, queue priority and venue acknowledgments are not modeled. Review SETUP.md for full limits.
