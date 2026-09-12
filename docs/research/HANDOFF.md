## Activity-aware maker checkpoint — September 12

MakerRunner now tracks public sell activity while idle, ranks otherwise eligible quotes using recent executable sell volume relative to queue ahead + requested quantity, and logs PAPER_MAKER_SELECTION. No fill gates or lifetime changes. 219 tests, TypeScript, build pass. Three-minute session `8b1ffeda-8d94-4e7c-a17a-13351414f0d8`: 105 prints / 45 markets, eight orders all canceled unfilled, zero active eligible candidates in 18 selection checks. Orders were in NFL receiving props with no prints; most activity was college football. Cash $50/$50; no positions, pending maker order, halt, or leases. Worker stopped. See docs/pilot/MAKER-ACTIVITY.md and work/maker-activity/results.json. Next: quantify actively traded approved CFB hedge gaps and event-driven selection; do not claim TTL caused zero fills. Signing remains deferred; no commit/push or real orders.

## Connected maker execution checkpoint — September 12

User: “Keep going. Make us some money!” Existing authorization is paper only, conditional sports risk accepted, signing deferred. MakerRunner now connects public prints to reservations, partial fills, hedge timer and the existing positions/settlement ledger. CLI `npm run paper -- maker-run observer.config.json research-data/paper-bot.sqlite 180`. One outstanding order, ten-second scan cadence, 500ms activation/hedge delays, two-second lifetime, up to 250ms invalidation cancellation delay. Bid improvement to next whole cent when inside spread and profitable. No maker rebates assumed. New fractional.ts / maker-ledger.ts use integer money and fixed-point quantities. State.makerReserved is included in totals; Position has optional per-leg quantities/evidence. Taker startup refuses an unresolved maker reservation. Restart/shutdown preserve already recorded/queued first-leg fills. Below-minimum hedge residual becomes unmatched and halts.

215 tests + TypeScript + production build pass. Synthetic integration demonstrates paired payout exactly $1 per contract and positive profit; NOT actual-market profit. Live sessions 262cc09c-bb5a-444d-8242-e7154e2e2983 (183.071s, seven unfilled orders) and a0ba08bc-c8c7-42ad-b38f-d1795810f156 (122.816s, four improved-price unfilled orders) stopped cleanly with both leases empty. Cash $50/$50, no positions, no maker reservation, no halt. Second run logged PAPER_MAKER_ORDER/CLOSE; first predated those detailed event records. Raw trade counts 71/75 across subscribed markets. MakerQueue remains conservative about future exchange timestamps; examine clock mismatch before interpreting zero fills, without manufacturing timestamps. Maker selection currently maximizes quoted profit, not recent trading activity, and short TTL can limit fills. See docs/pilot/MAKER-EXECUTION.md, work/maker-execution/. No real orders or signing attempts.

## Maker feasibility, tape and genuine snapshot refresh — September 12

User authorizes autonomous continued paper development and research; no new approval needed for conditional paper risk. Added maker-plan.ts and maker-evidence.ts: prospective Kalshi bid + PM-US hedge planner, conservative taker fee on maker leg, public-print parser and queue consumption tests. Not wired to ledger: do not claim maker fills. Queue supports partial volume but financial whole-contract ledger integration remains outstanding. Paper CLI opts into Kalshi public trades; persisted as PAPER_PUBLIC_TRADE diagnostics. Explicit use_yes_price:false now protects current book-decoder convention. New rate-limited observer.requestPaperSnapshot requests genuine stream evidence for promising approved pairs with stale Kalshi books; freshness policy unchanged.

205 tests + TypeScript passed. Live sessions 16d6f3bb-0f4f-4cb2-a2d4-e5e7cbebc5b4 (183.05s, 66 prints, 409 prospective profitable plans; no trades in any of 20 retained best sample markets) and 90c59543-62ce-4ae1-85d9-c65d216186b8 (122.917s, 178 snapshot requests, 37 prints, 84 prospective plans, no parser recoveries) stopped cleanly, both leases empty. Cash $50/$50; zero positions/profit. See docs/pilot/MAKER-PROBE.md and work/maker-probe/. Scope labels were clarified after tests only; no financial behavior changed. No signing attempt. Next: queue/capital/partial-fill/hedge integration with honest fractional exposure handling; do not invent fills from quote touches or assume all candidate quotes can run simultaneously.

## Strategy research and live diagnostics — September 12 continuation

User authorizes continued implementation and online research. Conditional paper risk acceptance persists; real orders remain disabled. Added worker/paper-diagnostics.ts, integrated into PaperBot/Store/CLI with per-run primary blockers and bounded closest quotes. 198 tests + TypeScript pass; targeted 10 integration tests passed after a stronger persistence assertion. Latest diagnostics reset at worker startup, with run logs preserving previous output; old cumulative counters untouched.

Expanded approvals to 199 unique pairs (100 additional NFL player/statistic picks overlapped one previous approval), all fresh validated. Session 008628f8-9623-46ed-9b81-4cf7c9ad46de: 182.935s, 12,252 decisions, 5,007 approved, 1,619 usable+sized; 1,547 selected quotes failed prices, 72 failed fees. Zero positions/profit. 309 unusable indicative gross-spread observations are not executable evidence. Four distinct best fresh quote samples were reconstructed and repriced with 2c/1c/zero reserve; none passed. Both leases released. See docs/pilot/STRATEGY-AUDIT.md and work/strategy-audit/. No freshness/reserve/fee policy changes. No claims of successful maker strategy or actual profitable bot identified; historical academic evidence is international Polymarket, and reviewed repositories have educational/negative-result caveats. Keep signing deferred.

## Conditional paper trading authorized and tested — September 12

User explicitly accepted cancellation/postponement differences: “Yes, we can lift that condition.” This authorizes conditional paper testing; do not ask again. Real orders remain disabled, strict registry approvals unchanged, and freshness/fees/risk checks stay enforced. Validated fresh metadata and wrote 100 exact CFB pair approvals (earliest game dates first), expiring within 24 hours. Approved IDs and evidence are in work/conditional-first/approvals.log and the existing paper ledger.

Five-minute session 3174f4a9-8d1c-44cf-ad22-52bf817e8c96 ended cleanly after 302.792 seconds, both leases released. Zero positions, zero positive research states, cash $50/$50 and realized profit $0. All 100 conditional approvals active during run; quote permission is now available. Net-edge rejections increased 4,374 (including unapproved pairs), with 12,497 missing/stale/unhealthy book decisions. Counts overlap. Latest saved Maryland quote was negative $0.045 for one pair, with stale books; diagnostic only. No claimed fill. Results: work/conditional-first/results.json. User still wants first profitable paper trade; this has NOT been achieved. Signing remains deferred; no commits or real trades.

## September 12 continuation: NFL prose consistency

User cannot approve 1Password now; do not prompt for signing or bypass it. Added game/date/statistic prose checks to the existing NFL ordinary-outcome diagnostic, preserving league aliases. Regression reproduced first; 196 tests and TypeScript pass. Read-only audit: all 1,709 mappings retain their prior statuses (898 conditional, 809 unsupported, 2 conflict). No live run, approvals, orders or ledger mutations. See `docs/pilot/SETTLEMENT-PROSE-CHECK.md`. Strict verification remains the gate; ordinary matches are not guaranteed hedges.

## Latest: paper horizon allocation and burst responsiveness

See `docs/pilot/PAPER-READINESS.md`. Paper-only allocation excludes out-of-horizon pairs; decision bursts yield to I/O; paper timing telemetry added. 195 tests, typecheck/build pass. Two bounded live checks drained: zero positions/profit and no conditional approvals. One run recovered from an event-loop delay, the CPU-profile run did not reproduce it; root cause remains unproven. Preserve strict mode. No process left running.

## Latest: settlement validation and paper-only approvals

See `docs/pilot/SETTLEMENT-VALIDATION.md`. Added read-only settlement/economics review, explicit expiring conditional-paper approvals with position risk evidence and subscription priority, and corrected NFL alias consistency between discovery and single-market refresh. Shared registry/live gates unchanged. No conditional approvals written: user policy question remains pending. 193 tests, typecheck and build pass. No qualifying quote found among the previous run's positive research states under current paper limits, even counterfactually assuming review.

## Latest: September 12 paper operation fixes

See `docs/pilot/STREAM-PAPER.md`, September 12 operational corrections. Sports enabled for paper only; restored unverified candidates revalidated before subscriptions; capacity-deferred pairs excluded from paper notifications; signal cleanup hardened and tested. 186 tests, typecheck and build pass. Existing ledgers retained; original database audited read-only. Worker must restart to load changes; no live order transport enabled. Earlier sports-exclusion statements below describe historical behavior.

## Event-driven paper integration (latest)

Validation: 184/184 tests, TypeScript and production build passed. The new signed commit attempt also failed with `1Password: failed to fill whole buffer`. All checkpoint work is staged, uncommitted and unpushed; HEAD remains `184e9cd7472d034f4188c91949dd36ff31ba2212`.

See [STREAM-PAPER.md](../pilot/STREAM-PAPER.md). The existing observer now notifies an event-driven worker using the same paper sizing/execution/accounting functions. `npm run paper -- run observer.config.json research-data/paper-bot.sqlite` runs without a browser; `npm run paper -- status research-data/paper-bot.sqlite` reports durable positions and reasons. Prior staged fixture work remains preserved. No live order transport or approval-gate relaxation. A new 60-second four-pair live worker test finished/stopped with nine rejected decisions, zero positions and unchanged $50/$50 simulated cash. User's separate demo process on port 5174 was left untouched.

## Bounded paper checkpoint completed (September 11–12, 2026)

**Delivery status:** tested changes are staged but uncommitted/unpushed. 1Password signing failed (`failed to fill whole buffer`; no commit object written). HEAD remains `184e9cd7472d034f4188c91949dd36ff31ba2212`. Preserve the staged work and keep configured signing.

See [PAPER-CHECKPOINT.md](../pilot/PAPER-CHECKPOINT.md) for exact launch commands and measured results. `npm run paper:demo` exercises the existing `/challenge`/HTTP/D1 paper path with isolated synthetic data. Paired entry, no-edge rejection, failed hedge unwind/unmatched exposure, concurrent entry, restart and once-only settlement passed; browser journal verified pending then $0.48 synthetic realized profit. Full suite 175/175, TypeScript and production build passed. Demo substitutions are excluded from production builds.

One four-pair 60-second live session completed (63.553 seconds including setup/drain), no repeat or expansion. All pairs unapproved and outside the unchanged 30-day paper horizon. Seven targeted REST leg snapshots matched healthy but strict-stale stream depth. Six positive one-contract conditional observations across two rounds remain research only; zero live-data paper entries, real orders/fills/profit. Live gates unchanged. All processes started for this checkpoint stopped. The requested bounded stopping point has been reached; do not resume an old usage-percentage goal.

## Completed filtered 242-pair run

Ten-minute run `work/proof/live-filtered-phase12` stopped and drained. 31,309 updates, no event-loop delay episodes or recovery reconnects, two subscription-change disconnects, processing p99 4.11ms, event-loop max 104.79ms, final pre-stop queue zero. Reports `docs/pilot/live-filtered-phase12-{audit,health,full-budget-size-audit}.json`. No builds/tests during collection; other host activity not instrumented. Different load and short duration prevent attributing all improvement to telemetry sorting.

13 opportunity intervals / 32 states yielded one positive one-contract model. It is a confirmed false pair: Kalshi losing House majority before November 3 versus PM-US control won in the midterm election. New tested chamber-event exclusion removes that pair. Thus no positive one-contract occurrence in this run survives current matching. No profitable or filled trade established. Live trading disabled; no orders submitted.

## Telemetry reporting overhead

Numeric typed-array sorting reduces the 16-metric / 10,000-sample synthetic snapshot benchmark median from 32.15ms to 9.67ms (30 iterations each). The quantile regression checks finite values, duplicates, empty/singleton arrays, and preserves source order. See `docs/pilot/telemetry-snapshot-performance.json`. This reduces main-thread reporting work but does not establish the cause or resolution of the prior recovery episode. No fresh live stability run yet. The historical telemetry snapshot just before recovery had zero persistence backlog; recovery itself added invalidation messages. Do not blame the network or metadata refresh solely from their concurrent activity.

## Acting/interim follow-up

173 tests, TypeScript and build passed. Explicit opposing acting/interim office-service clauses now exclude candidates. See `docs/pilot/REMAINING-RULE-REVIEW.md` for review of the remaining nominee, AOC and artist pairs against public contract PDFs. None approved. The earlier five-pair count below predates this exclusion; regenerated audit reports use current matching. The 299-pair observer is stopped.

## Latest: announcement deadlines and restart evidence

The 299-pair non-sports observer completed its 900 seconds and stopped. Reports: `docs/pilot/live-all-nonsports-current-{audit,health,full-budget-size-audit}.json`. It recorded 42 opportunity intervals / 135 states, 19 positive standalone one-contract modeled occurrences, zero eligible orders. A newly tested announcement-deadline exclusion removes nine positive occurrences: a shared 2028 election year must not conflate an announcement deadline in 2026 with one in 2027. Equal calendar deadline hints remain UNVERIFIED; time zones, party scope and exceptions still require settlement review.

Current matching retains ten positive occurrences across five pairs. At 100/100ms, four have both sides displayed and six insufficient evidence; at 500/500ms, two have both displayed, one only one leg, seven insufficient evidence. These are not confirmed fills. Remaining review pairs: Gavin Newsom and Rahm Emanuel Democratic nomination, Scott Jennings press secretary, AOC announcement by year-end 2026, and YoungBoy Never Broke Again number-one album. Full-budget size sweep is hypothetical and cannot be summed as earnings.

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
