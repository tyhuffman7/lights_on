# Continue Lights On here

Use built-in capabilities/native skills only. Do not use installed skills, including Superpowers, and never brainstorming. No sub-agents unless the user authorizes them. Keep live trading completely disabled. Push tested implementation checkpoints to `tyhuffman7/lights_on` main. HARDENING.md remains the implementation specification.

## Implemented September 11

Broad persistent discovery includes sports, paginates active catalogs, normalizes team/player aliases, leagues, scheduled dates, periods, lines and outcome concepts, and uses bounded indexes instead of an all-to-all title scan. Candidate generation is separate from settlement proof. Catalog fetch/normalization/matching runs in a worker; registry updates are batched and immediately patch the evaluation/persistence indexes. Previously auto-discovered unverified candidates that cease matching are retired; orientation changes invalidate verification. Dashboard discovery diagnostics, five-second health polling, ten-second report polling and mapping pagination are implemented.

Live validation exposed and fixed duplicate invalidations on recovery plus socket-close, an unhandled persistence-failure throw, a dashboard script parse error, and numerous false candidate classes. Regression tests cover qualification versus championship/seed, cross-sport futures, first-inning runs versus game winners, winner versus placement, distinct award categories, declaration/candidacy versus election victory, wrong districts, and ranking platforms. This is not proof of perfect candidate precision or recall.

The earlier hardening implementation remains: bounded exact detector sizing; worker SQLite writes/expiry/analysis; separate report readers; bounded persistence queue count/bytes and failure pause; separate freshness/stream liveness; group-local caches/recovery; both first-leg venue scenarios; raw versus verified labels; session/evidence/CSV/backup support. No order API or trading client exists.

## Validation evidence

Read COVERAGE-VALIDATION.md, coverage-validation.json and coverage-performance.json. Final recorded catalog: 124,238 Kalshi non-MVE records / 105,873 PM-US active-filtered records; 1,010 candidates (660 sports / 350 non-sports); 500 subscriptions per venue; zero automatic verifications. Twelve identity samples were inspected and remain UNVERIFIED. Cumulative registry counts differ from current candidates because history, invalidations and retired candidates are retained.

All 89 tests passed, as did TypeScript without incremental cache, production build, randomized detector-equivalence tests, 30/100/250/500 mapping load and concurrent matching/report load. At 500 synthetic mappings, approximately 996 updates/sec processed with p50/p95/p99 0.235/0.348/0.403 ms. Concurrent 25,000-market-per-venue matching reached approximately 997 updates/sec with p50/p95/p99 0.243/0.359/0.487 ms. These are short synthetic measurements, not venue fills.

The approximately five-hour pre-final-guard run recorded over 800,000 book records and zero verified opportunities, but also substantial reconciliation, reconnection, event-loop and metadata errors. The final capture had all 1,000 subscribed books valid, but only 9 Kalshi / 114 PM-US books changed within two seconds. Valid-book processing p99 was about 3.50 ms; overall processing including invalidation batches was about 31.92 ms. Event-loop maximum was 4.67 seconds. Do not claim production reliability, profitable arbitrage or full-universe executable coverage. Preserve the failed stage and these limitations when discussing results.

## Current local state

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
