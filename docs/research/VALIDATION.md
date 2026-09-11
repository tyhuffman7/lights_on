# Validation

## Sustained-research implementation — September 11, 2026

115 regression tests, TypeScript without incremental cache, randomized detector equivalence, 30/100/250/500 mapping load, concurrent discovery load and production build passed. The build retains its existing route-classification notice. New evidence tests reconstruct all eight latency buckets for both first-leg scenarios and preserve unknown coverage after a crash. Strict freshness, frozen historical verification and human rule-hash approval remain unchanged.

The authenticated dashboard and review endpoints passed script-syntax/access checks; a new visual browser pass was not performed. [SUSTAINED-VALIDATION.md](SUSTAINED-VALIDATION.md) contains the actual bounded live comparison, including storage, throughput, recovery, REST load and coverage. [REVIEW-PRIORITIES.md](REVIEW-PRIORITIES.md) and its JSON contain the historical review deliverables. Synthetic success alone does not establish sustained reliability.

## Earlier validation — September 10, 2026

## Architecture and completion status

Four components are explicit: `lib/research/books.ts` plus `worker/streams.ts` for market data; `mappings.ts` and `matching.ts` for matching/verification; `detector.ts` and the canonical `fees.ts` for calculations; `recorder.ts`, `latency.ts`, `report.ts` and `store.ts` for persistent research. `worker/observer.ts` orchestrates them independently of the browser. The existing paper ledger is preserved. The local worker serves live controls, while the Sites home consumes exported reports and links to the optional challenge.

**Implementation checkpoint, not completed strategy validation.** Both authenticated venue streams have now been exercised with real credentials and public book messages. A short live report is saved, but the verified-market observation/report required by the user's definition of done remains outstanding. No live trading was implemented.

## Hardening implementation validation — latest checkpoint

Actual code now implements optimized detector sizing, worker-thread persistence and report readers, latency/health telemetry, orientation invalidation, per-group recovery, continuous candidate discovery/subscriptions, eligible-profit isolation, both-first-venue reporting, paginated evidence/CSV, backup and external health checks. HARDENING.md records the remaining operating gates; it is not the deliverable in place of code.

- `npm test`: **72 passed, 0 failed** after the hardening changes. Includes all prior safety tests, mixed/raw eligibility, registry version races, independent shards, queue overflow/drain, actual SQLite worker recording and staged-load correctness.
- `npx tsc --noEmit --incremental false`: **passed**.
- `npm run build`: **passed**. Vinext still prints its informational route-classification limitation.
- `npm run test:detector`: **3 passed**: 5,000 seeded randomized comparisons against the original exhaustive detector, million-contract bounded-probe sizing, and the zero-fee qualifying-interior regression. Both orientations, fee schedules, fractional displayed depth, bankroll limits and thresholds are compared.
- `npm run test:load`: staged real parser/evaluator/worker/SQLite run at 30, 100, 250, 500 synthetic verified mappings. Full measured results and predeclared thresholds are in scale-validation.json; earlier failed stages were retained. A 30-second 500-mapping run with five concurrent report reads also passed, in scale-soak.json.
- Authenticated dashboard: synthetic fixture/raw labels, both venue-first tables, lifecycle books and mapping history were exercised in the actual embedded browser; no JavaScript errors. Native download-event completion was unavailable in that browser. Authenticated JSON/CSV endpoints, attachment headers, unauthenticated denial, cross-origin denial and secret exclusion pass API tests; CLI CSV was generated and parsed.
- Actual read-stream smoke: about four minutes, two unverified pairs, 28 persisted records including invalidations, zero opportunities, three reconciliation mismatch recoveries, external health check passed, clean stop. See hardening-live-validation.json. No order/account mutation endpoint was called.
- Online SQLite backup command: passed; `PRAGMA integrity_check` returned `ok`, and sessions/books/opportunities/diagnostic counts matched. Linux power-loss/reboot validation is not claimed.
- `git diff --check`: passed. Secret audit found no configured credential/control-token values or private-key payload in tracked/proposed files or reachable Git-history blobs; local secret/config/evidence paths remain ignored. Review the final commit for the exact audit counts.

The observer is stopped and live trading remains disabled. Synthetic capacity and authenticated ingestion are established; verified live profitability, sustained broad venue coverage, actual Linux restart/reboot and native save-dialog completion are not established.

## Earlier checks completed

- `npm test`: **56 passed, 0 failed**, including all 31 original tests and 25 added research/worker tests.
- `npx tsc --noEmit --incremental false`: **passed**.
- Previous interface checkpoint: Sites build helper invoking `npm run build`: **passed**, including the research home, retained `/challenge`, and existing authenticated API routes. Vinext reported its informational static-route-classification limitation.
- `git diff --check`: **passed**.
- Deterministic replay command: **passed** using `tests/fixtures/research/lifecycle.json`; results explicitly labeled synthetic.
- Actual paused worker startup: **passed**. HTTP shell returned 200, unauthenticated state request returned 403, authenticated state request returned 200 with `PAPER_RESEARCH` and `paused: true`. Credentials were neither printed nor transmitted to exchange order endpoints.
- Public REST probe: **passed**, four book updates and no request errors. See `sample-public-probe.json` and SETUP.md for the actual window and limits.
- Ignore rules confirmed for `.env.research`, `observer.config.json`, and local evidence databases. They are absent from the staged source changes.

## Authenticated live validation

`authenticated-stream-validation.json` contains actual handshake and parser statistics, followed by bounded observer diagnostics. Both exchanges accepted local credentials. Initial venue payloads failed the synthetic-only parser assumptions; tests reproduced these failures before the parser fixes. Kalshi omits empty sides, and PM-US emits quantities with four decimal places. The repeat 45-second check parsed 6 Kalshi books and 9 PM-US books with no normalization errors.

The final observer run lasted 47 seconds, saved 38 valid stream books plus 4 shutdown invalidation records, and shut down cleanly. `sample-live-report.json` contains zero opportunities and null latency denominators because no verified opportunities were observed. Both configured mappings remain UNVERIFIED. The earlier observer run recorded event-loop-delay recovery/reconnect diagnostics and was interrupted after pausing; its session has no inferred end time. Longer throughput and rule-equivalence validation remain necessary.

Secrets and full local databases remain ignored. Sanitized public book fixtures and summary/report JSON are committed for reproducibility. No order endpoint was called.

## Added regression coverage

`tests/research.test.ts` (14): unknown/cumulative fee handling; Kalshi snapshot/delta/zero deletion/gap recovery; subscription-scoped sequences; PM replacement/malformed books; persistent mapping invalidation/audit; direct/inverted orientation, sizing and freshness; lifecycle duplicate suppression/censorship; structured conflicts vs text-only suggestions; partial depth; metadata unavailability/recovery; smaller qualifying size retained despite a larger low-ROI alternative; category aliases/administrative expiries remain unverified candidates; actual authenticated omitted-empty-side/four-decimal payloads; accepted fractional precision preserved through deltas.

`tests/latency.test.ts` (5): as-of selection without future-book look-ahead, frozen hedge quantity/limit, duplicate latency suppression; missing coverage and partial unwind residuals; opportunity-count reporting and bankroll exclusion; empty denominators; qualifying lifetimes stop at net-edge loss even while gross spread persists.

`tests/streams.test.ts` (3): subscription batching/debouncing; actual RSA-PSS signature verification and missing-key failure; local WebSocket frame/disconnect/reconnect behavior.

`tests/observer.test.ts` (3): token and same-origin controls; configuration validation; exclusive observer ownership and recovery after a confirmed dead PID.

## Not yet verified

Sustained throughput, real opportunity frequency/duration/profit, and uninterrupted long-term operation await a reviewed subscription set and a longer run. The short live acceptance check covers only sampled market-data messages; no private order stream or execution was tested. Browser click/visual QA was not performed. The legacy HTTP smoke script was preserved but not rerun; existing pure ledger/settlement tests and the application build passed. A cloud worker has not been provisioned. Known modeling/hosting limitations, continuous-running instructions and the complete SQLite table schema are in SETUP.md.

## Exact changed files relative to fae43c9

- `.gitignore`
- `README.md`
- `app/api/pair/route.ts`
- `app/challenge/page.tsx`
- `app/page.tsx`
- `app/research.tsx`
- `deploy/lights-on-observer.service`
- `docs/research/HANDOFF.md`
- `docs/research/REQUIREMENTS.md`
- `docs/research/SETUP.md`
- `docs/research/SOURCES.md`
- `docs/research/VALIDATION.md`
- `docs/research/sample-public-probe.json`
- `docs/superpowers/plans/2026-09-10-research-observer.md`
- `lib/arb/adapters.ts`
- `lib/arb/core.ts`
- `lib/arb/engine.ts`
- `lib/research/books.ts`
- `lib/research/detector.ts`
- `lib/research/fees.ts`
- `lib/research/latency.ts`
- `lib/research/mappings.ts`
- `lib/research/matching.ts`
- `lib/research/recorder.ts`
- `lib/research/report.ts`
- `lib/research/store.ts`
- `lib/research/types.ts`
- `package-lock.json`
- `package.json`
- `tests/fixtures/research/lifecycle.json`
- `tests/latency.test.ts`
- `tests/observer.test.ts`
- `tests/research.test.ts`
- `tests/streams.test.ts`
- `worker/cli.ts`
- `worker/config.ts`
- `worker/dashboard.html`
- `worker/observer.ts`
- `worker/server.ts`
- `worker/streams.ts`

Additional credential-validation checkpoint files: `docs/research/authenticated-stream-validation.json`, `docs/research/sample-live-report.json`, and `tests/fixtures/research/authenticated-books-2026-09-10.json`.

## September 11 coverage implementation

See [COVERAGE-VALIDATION.md](COVERAGE-VALIDATION.md) for current code, live catalog/category counts, twelve inspected examples, failed/longer-run evidence and performance limits. Full suite: 89 passing tests. TypeScript without incremental cache, production build, 5,000 randomized detector comparisons plus regressions, 30/100/250/500 mapping load and concurrent 25,000-market-per-venue discovery load all passed. Browser inspection confirmed diagnostics, mapping pagination and automatic timestamps after fixing a script parse error. No live trading or automatic settlement verification was introduced.
