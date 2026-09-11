## Latest: announcement deadlines and restart evidence

The 299-pair non-sports observer completed its 900 seconds and stopped. Reports: `docs/pilot/live-all-nonsports-current-{audit,health,full-budget-size-audit}.json`. It recorded 42 opportunity intervals / 135 states, 19 positive standalone one-contract modeled occurrences, zero eligible orders. A newly tested announcement-deadline exclusion removes nine positive occurrences: a shared 2028 election year must not conflate an announcement deadline in 2026 with one in 2027. Equal calendar deadline hints remain UNVERIFIED; time zones, party scope and exceptions still require settlement review.

Current matching retains ten positive occurrences across five pairs. At 100/100ms, four have both sides displayed and six insufficient evidence; at 500/500ms, two have both displayed, one only one leg, seven insufficient evidence. These are not confirmed fills. Remaining review pairs: Gavin Newsom and Rahm Emanuel Democratic nomination, Scott Jennings press secretary, AOC announcement by year-end 2026, and You Again album. Full-budget size sweep is hypothetical and cannot be summed as earnings.

The observer recorded one event-loop-delay episode and six reconnects; metadata refresh was active at the event but causation is unproven. Processing p99 6.43ms; receive-to-persistence-ack p99 169.48ms. Targeted tests/light development overlapped; no claim of host isolation. Cloud migration is not provisioned and would require measured comparison.

Persistent fill journal evidence can now be restored and revalidated against the registered order identity. Integration fixtures exercise partial cancellation across a restart, duplicate fills, preserved unmatched inventory, and blocked further entries. Exact microdollar actual evidence is retained; only the budget reservation converts upward to $0.0001 units. Synthetic tests are not venue fills. Live trading remains disabled. Validation: 172 tests passing and TypeScript passed; production build checked at checkpoint.

## Fee precision follow-up

Current fill and order evidence uses explicit integer microdollars, preserving six-decimal fees and fractional notional. Existing Kalshi/PM-US order checks still reconcile. New published-mechanics rounding simulation documents account precision and fractional rebate-cap sensitivity; the old whole-contract `feeUpper` is not an unconditional live bound. Live fee validation remains off. See PROOF-OF-EDGE.md and `fee-rounding-research.json`. 168 tests and TypeScript pass after these edits; build also passed. Last usage reading was 23% used / 77% remaining. User has returned and authorized retrying the existing signed checkpoint. Verify actual Git state before reporting push completion.

## Latest working state

Previous pushed checkpoint: `1609cd5`. During this checkpoint preparation, 1Password signing failed while the user was away; they have now returned. Keep signed commits enabled. Verify HEAD and origin/main to determine the latest pushed checkpoint.

Latest evidence is at the end of [PROOF-OF-EDGE.md](../pilot/PROOF-OF-EDGE.md). Both the 26-pair 30-minute observer and corrected 22-pair 600-second quieter run finished and stopped. The latter processed 1,462 updates, no reconnects/delay episodes, zero positive models even with a full-$200-budget size sweep. Fresh full catalog produced 1,773 unverified candidates, but the 30-minute non-sports run's three positive models were all Forbes/Bloomberg conflicts now rejected. No eligible pairs, bot fills or profits. Existing position/cash snapshot guards, unknown minimum sizing guards, source mismatch rejection, capital replay, historical early-exit audit, buy/sell serialization, nonbinding preview, fill parsers and restart-safe fill journal are local additions. No submit transport. One Kalshi and three PM-US pre-existing fills parsed; private amounts/IDs were not stored in reports.

Final validation: 165 tests, TypeScript and build pass (existing route-classification notice). Fresh load passed 997.16 updates/sec / processing p99 0.497ms. Run final verification after remaining edits. Signing/push are pending. Latest usage check: 21% used / 79% remaining, stop target 30% used / 70% remaining; continue useful work until then or substantiated confidence. No skills or subagents.

# Continue Lights On here

Use built-in capabilities/native skills only. Do not use installed skills, including Superpowers, and never brainstorming. No sub-agents unless the user authorizes them. The user subsequently authorized a $100-per-venue pilot and accepted at most $200 total loss; see ../pilot/PILOT.md. Live trading remains technically disabled until the documented launch prerequisites are satisfied. Do not request the same budget authorization again. Push tested implementation checkpoints to `tyhuffman7/lights_on` main. HARDENING.md remains the implementation specification.

## Protocol and capital follow-up

Pure one-contract order serialization and a fixed nonbinding PM-US preview client are added. Live Spotify YES/NO previews returned HTTP 200, pending state and zero cumulative fills; no actual orders were submitted. Capital replay excludes repeated market inventory and settlement cash recycling, but isolates budget constraints rather than the stricter current intent-ledger inventory halt. Historical scenarios show only $0.27–$0.39 conditional modeled net under $10 committed, not earnings. 146 tests, TypeScript and build pass. A 26-pair non-sports observer is currently bounded to 1800 seconds at `work/proof/live-nonsports-long`; inspect its result/progress before doing anything with it. A five-minute economics/Netflix sample ended with zero recorded opportunities and no reconnects. Current private reads show neither venue meets the full $100 pilot funding level; do not move funds or publish balances. Usage last checked at 15% used (85% remaining), below the user stop threshold. Continue the active goal.

## Current follow-up

See the follow-up section in PROOF-OF-EDGE.md. Raw authenticated account GETs succeeded on both venues, but funding/reconciliation are unverified and user-owned positions must stay separate. Economics aliases and Netflix chart conflicts are now covered by tests. Filtered discovery yields 25 research candidates. The Spotify-only 600-second run finished with one $0.01 modeled opportunity, insufficient arrival evidence, two delay episodes and four reconnects; no fills. 140 tests, typecheck and build pass. User requested continued work until evidence supports confidence or Codex usage reaches 30% used (70% remaining); latest check was 13% used. Do not stop solely because a checkpoint was pushed.

## Proof-of-edge investigation (latest)

Read [PROOF-OF-EDGE.md](../pilot/PROOF-OF-EDGE.md). Matching now rejects relegation/title, conference/national-event, election-year and decade/year conflicts. Explicit NFL yardage clauses normalize integer alternate lines without equating different players, games, statistics or thresholds. The full catalog remains broad. Fixed-limit arrival replay is hypothetical, never fills. A bounded 378-pair all-category sample and 100-pair alternate-line sample are finished and stopped; databases are under ignored work/proof. The Spotify Bad Bunny pair had a $0.02 modeled one-contract edge surviving a 500ms display check, but remains unapproved. Israel government-formation rules conflict; sports cancellation and reversal provisions remain unresolved. Live execution, fees, profitability and stability are still unproven. No orders were sent.

## $200 pilot foundation

Read [PILOT.md](../pilot/PILOT.md) before continuing. Preflight sizing and durable intent reservations are implemented with 130 passing tests; there is still no live order transport. The capital-fit audit found 347 fresh positive one-contract scenarios, but zero eligible states. Long settlement horizons are allowed. A paired early-exit quote evaluator now checks actual entry costs, executable bids, fees and reconciled inventory; no order transport or exit reconciliation is connected. The cricket rule review is unresolved. Do not turn the 347 unrestricted positive standalone models into earnings claims. No funding increase, replenishment or withdrawal is authorized.

## Sustained-research checkpoint (September 11)

The broad-discovery implementation below is historical context. The sustained-research implementation now includes bounded opportunity evidence, scoped canonical entities, assisted review packages, pair-level capacity/exploration, paced venue-fair reconciliation, reader-worker scoring, and detailed recovery diagnostics. See [SUSTAINED-RESEARCH.md](SUSTAINED-RESEARCH.md), [SUSTAINED-VALIDATION.md](SUSTAINED-VALIDATION.md), and [REVIEW-PRIORITIES.md](REVIEW-PRIORITIES.md).

The historical database is preserved locally at `research-data/research.sqlite` (approximately 4.16 GB); do not resume indefinite full-book persistence or delete old evidence. The original 8789 observer was not listening during this work. Bounded validation uses separate ignored databases under `work/sustained/` and ends by stopping streams, draining persistence and closing the session. Verify process state instead of assuming any old observer is running.

Recovery invalidations immediately quarantine in memory; their closing calculations run in the ordered persistence worker to avoid a synchronous full-subscription sizing burst. The longer sample still observed an initial event-loop stall whose source is not established. Preserve that limitation and profile it before claiming uninterrupted multi-day reliability.

A live probe established that Polymarket US rejects a duplicate subscription to an already subscribed slug. Do not implement temporary duplicate subscriptions as snapshot recovery. Kalshi supports `get_snapshot` on its existing subscription. An older REST venue timestamp is separately classified and never used to overwrite a newer stream; strict two-second freshness remains unchanged. Unknown timestamps are not exempted from mismatch checks.

Historical export contains 1,920 raw occurrences, 198 mapping/orientation groups, 40 review candidates and ten side-by-side packages. These are UNVERIFIED research observations, never retroactively verified profit. External contract documents linked in metadata still require inspection. The human approval path refreshes rule hashes immediately before approval.

Completed checkpoints are pushed to GitHub. Credentials and local databases are intentionally excluded. No live order placement was added. Multi-day reliability and verified opportunity economics remain unproven; the bounded validation report defines the measured result and limitations.

## Earlier broad-discovery implementation

Broad persistent discovery includes sports, paginates active catalogs, normalizes team/player aliases, leagues, scheduled dates, periods, lines and outcome concepts, and uses bounded indexes instead of an all-to-all title scan. Candidate generation is separate from settlement proof. Catalog fetch/normalization/matching runs in a worker; registry updates are batched and immediately patch the evaluation/persistence indexes. Previously auto-discovered unverified candidates that cease matching are retired; orientation changes invalidate verification. Dashboard discovery diagnostics, five-second health polling, ten-second report polling and mapping pagination are implemented.

Live validation exposed and fixed duplicate invalidations on recovery plus socket-close, an unhandled persistence-failure throw, a dashboard script parse error, and numerous false candidate classes. Regression tests cover qualification versus championship/seed, cross-sport futures, first-inning runs versus game winners, winner versus placement, distinct award categories, declaration/candidacy versus election victory, wrong districts, and ranking platforms. This is not proof of perfect candidate precision or recall.

The earlier hardening implementation remains: bounded exact detector sizing; worker SQLite writes/expiry/analysis; separate report readers; bounded persistence queue count/bytes and failure pause; separate freshness/stream liveness; group-local caches/recovery; both first-leg venue scenarios; raw versus verified labels; session/evidence/CSV/backup support. No order API or trading client exists.

## Validation evidence

Read COVERAGE-VALIDATION.md, coverage-validation.json and coverage-performance.json. Final recorded catalog: 124,238 Kalshi non-MVE records / 105,873 PM-US active-filtered records; 1,010 candidates (660 sports / 350 non-sports); 500 subscriptions per venue; zero automatic verifications. Twelve identity samples were inspected and remain UNVERIFIED. Cumulative registry counts differ from current candidates because history, invalidations and retired candidates are retained.

All 89 tests passed, as did TypeScript without incremental cache, production build, randomized detector-equivalence tests, 30/100/250/500 mapping load and concurrent matching/report load. At 500 synthetic mappings, approximately 996 updates/sec processed with p50/p95/p99 0.235/0.348/0.403 ms. Concurrent 25,000-market-per-venue matching reached approximately 997 updates/sec with p50/p95/p99 0.243/0.359/0.487 ms. These are short synthetic measurements, not venue fills.

The approximately five-hour pre-final-guard run recorded over 800,000 book records and zero verified opportunities, but also substantial reconciliation, reconnection, event-loop and metadata errors. The final capture had all 1,000 subscribed books valid, but only 9 Kalshi / 114 PM-US books changed within two seconds. Valid-book processing p99 was about 3.50 ms; overall processing including invalidation batches was about 31.92 ms. Event-loop maximum was 4.67 seconds. Do not claim production reliability, profitable arbitrage or full-universe executable coverage. Preserve the failed stage and these limitations when discussing results.

## Earlier local state (superseded by sustained checkpoint above)

The main observer was restarted with the final code and left running at http://127.0.0.1:8789, using ignored `observer.config.json` and `research-data/research.sqlite`. Verify it is still alive before assuming continued operation. Default capacity is 500 markets per venue, 100 per group. It automatically discovers new candidates; the original two manually configured Emmy pairs remain in the config. Do not delete existing evidence or approve mappings merely to improve counts.

Credentials are saved in ignored owner-only `.env.research`; the Kalshi PEM is ignored at `research-data/kalshi-private-key.pem`. Never print or commit secrets. Scratch catalog/validation files are in ignored `work/coverage/`; separate earlier test DB is `research-data/broad-coverage.sqlite`. The synthetic browser fixture and test observer on ports 8790/8792 were stopped. The real database had grown to roughly 2.37 GB during validation; check disk growth before lengthy runs.

GitHub preserves source and sanitized evidence, not credentials, local databases or a running process. A separate persistent host/process is needed to observe when this computer is off. No host was provisioned or paid service purchased.

## Next work, without weakening safety

1. Inspect current Git status and health. The implementation is present; do not replace it with another planning document.
2. Investigate the high reconciliation/reconnect and metadata-unavailable rates. REST/stream snapshots are non-atomic; capacity should be judged by fresh usable books and recovery behavior, not connection count. Do not bypass freshness, sequence, metadata or persistence gates to make the dashboard look healthy.
3. Review candidate quality and available settlement evidence. Full rules, outcomes, dates, resolution sources, cancellation/postponement/tie/retirement treatment are still required for verified observation. Candidate titles/identity are insufficient.
4. Once justified mappings exist, run actual verified observation in stages and audit any opportunities against recorded books, fees, both first-leg scenarios and orphan/unknown denominators. No verified opportunities means no profitability conclusion.
5. Linux service reboot/recovery and native export save-dialog completion remain unverified. Existing SETUP.md/service/health/backup tools are available; no deployment is implied by a Git push.

The hosted site remains a report-snapshot viewer. Continuous controls are loopback-only and authenticated. EXECUTION-BOUNDARY.md is design only; live trading stays disabled.
