# Execution isolation and mapping coverage — September 22–23, 2026

This checkpoint implements the two PR #12 operational fixes and audits public catalog metadata. **No new PAPER session or real orders were run.** Julia/Oregon holdings, the unresolved White Sox exposure, fees, zero-margin PAPER admission, recovery policy and historical evidence remain unchanged. This is implementation and synthetic validation, not new execution or profit evidence.

## Reconnect accounting and stop evidence

Independent inspection of executed commit [`9096392`](https://github.com/tyhuffman7/lights_on/commit/90963927f8f40169a058a010df29134fee48ca0c) confirmed `worker/production-paper.ts` used one global counter, incremented by `affected.length`, despite the documented three-per-venue policy. After two PM-US rebuilds, a dual-venue rebuild exceeded the global remainder. The original [report](PRODUCTION-PAPER-SESSION.md) and [result](production-paper-results-20260922.json) are preserved verbatim.

The worker now permits at most **three Kalshi transport rebuilds and three PM-US transport rebuilds**, within the original monotonic deadline. A dual-venue rebuild spends one allowance per venue. Both lanes share their venue's budget; rebuilding two physical connections for one venue spends two allowances. Reservations are atomic and spent before dialing, including unsuccessful rebuilds. Initial connections are not rebuilds. No deadline, exposure halt or other risk gate is reset.

Only evidenced transport/heartbeat failures qualify for rebuilding. Parser, sequence, clock, ingress-integrity, lifecycle and unexplained health failures remain fail-closed. Stopped-session receipts retain each lane's health, failure codes, sanitized socket/heartbeat/backlog diagnostics, per-venue counters and stop classification. A failed health check alone is recorded as an unestablished cause, not asserted to be a physical disconnect. Supervisor and deadline stops are explicit.

## Dedicated strategy evidence

The five deeply reviewed strategy markets use one dedicated persistent feed per venue, including separate Kalshi lifecycle tracking. The existing broad discovery/shadow feeds remain separate: **four persistent feeds total**, with the existing bounded one-market transient PM-US confirmation connection. No new venue or external dependency is added.

Strategy selection, requested confirmation, exact-market synchronization, final admission and the modeled **500 ms arrival** use the dedicated lane. Its persistent book is the primary arrival evidence; broad books are recorded only as corroboration. The normal research lane continues to serve shadow execution. Actual negative market-state or material-terms evidence still blocks the affected route.

Dedicated backlog, missing/lagging books, invalid requests, clock failure or late processing remain inconclusive. No fallback to a broad book can turn unknown exposure into a fill or no-fill. Connections still share the process event loop, so this does not promise physical scheduling isolation; the existing processing-delay gate remains in force. Fresh-fill recovery is still unproven.

## Catalog and mapping audit

See [mapping coverage and review](MAPPING-COVERAGE-20260922.md), [sanitized statistics](mapping-coverage-results-20260922.json), and [external-source research](EXTERNAL-MAPPING-SOURCES-20260922.md).

The successful metadata-only refresh used the existing public endpoints, page sizes, pacing and 2,000-request/20-minute bounds. It finished with 460 wrapper requests and no pagination errors. Scope is the existing supported open Kalshi catalog (`mve_filter=exclude`) and active, non-closed Polymarket US catalog; it is not a claim about closed or inaccessible markets. Four identical PM-US records occurred across offset pages: **74,624 rows / 74,620 unique PM-US listings**, alongside **121,000 unique Kalshi listings**. The refresh spans time rather than an atomic venue snapshot; both matcher versions consume the exact same stored data.

Replaying all saved public responses through the unchanged PR #12 normalizer reproduced every normalized record exactly. This verifies baseline input fidelity. No database registry or historical verification state was mutated. New matches remain candidate routes for analysis, not settlement approvals or executable opportunities.

Public external research obtained zero native US pair records. Hosted PMXT/Prediction Hunt coverage could not be measured; international or synthetic examples were not admitted. No advertised dataset size is counted as measured coverage.

## Validation and preservation

The **24-test operational selection passed**, covering independent per-venue budgets, failed-dial accounting, classified diagnostics, an actual queued-frame discovery backlog, dedicated-lane inconclusive exposure, exact-market request synchronization, lifecycle isolation, and the unchanged historical result checksum. The **119-test mapping selection passed**, covering captured public template variants and negative alias, geography, date/window, threshold, orientation and market-family cases. Independent code review found and resolved ambiguous alias identity, canonical-index priority and contradictory orientation issues. Full tests, typecheck and build run in the hosted draft-PR CI; consult that PR's check for the exact published head. One extra local sustained-test attempt was blocked by sandbox loopback-listen permissions; hosted CI is the authoritative full-suite result.

Private read-only snapshot, raw public responses, comparison rows, normalization-parity and preservation receipts remain under ignored `work/mapping-coverage-20260922/`; external research receipts remain under ignored `work/execution-mapping-20260922/external/`. Outgoing scope is source, focused tests, minimal public test excerpts, documentation and derived statistics. Credentials, environment files, account data, databases, tape and unrelated changes are excluded. Existing commit signing is retained.

**Checkpoint stops after the signed draft publication.** Recommended next action: a bounded settlement review of one newly recovered market family. Any new PAPER execution or live launch requires separate authorization; the original PR #12 session must not restart.

Reproduction without trading:

```sh
# Public metadata only; use a new ignored output directory.
node --experimental-strip-types worker/catalog-coverage.ts work/new-catalog-directory
# Offline comparison against the preserved PR #12 checkout.
node --experimental-strip-types worker/mapping-coverage-report.ts \
  work/mapping-coverage-20260922/fresh-network/catalog.json \
  /private/tmp/lights-on-depth-discovery-20260922 \
  work/new-comparison-directory
```

These are reference commands, not an instruction to start another checkpoint automatically.
