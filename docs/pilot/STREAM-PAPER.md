# Event-driven paper worker

The live observer now connects to the existing paper execution/accounting engine. Incoming subscribed book updates trigger decisions; no dashboard, browser tab, `/api/run` polling or 30-second entry timer is required. Real order submission is still absent and disabled. This is not a profitability claim.

## Operation

Use the existing observer configuration and its preserved mapping registry. Do not run a second observer against the same database; leases prevent two owners.

```sh
cd /Users/tylerhuffman/Documents/code_projects/lights-on
npm run paper -- run observer.config.json research-data/paper-bot.sqlite
```

This runs continuously until Ctrl-C. It loads the existing ignored `.env.research` credentials for market-data streams, not account/order actions. Discovery/subscription coverage follows the existing config and capacity limits; it is not literally every exchange market at once. The machine must remain awake and connected. No remote host or restart service has been provisioned, and 24-hour reliability has not been demonstrated.

Inspect it from another terminal, or after stopping:

```sh
npm run paper -- status research-data/paper-bot.sqlite
```

Status reads persistent state and prints the actual paper positions: event, market IDs, sides, quantities, debits, hedging/open/unmatched/settled status, conditional entry profit and realized paper profit. It also shows cash, committed capital, pending hedge, halt reason and decision counts. An empty positions list means **no paper positions**, not a hidden trade.

The command also emits a status snapshot every ten seconds. Decisions respond to incoming book updates rather than that reporting timer. Settlements are checked every 60 seconds while running. No early-exit strategy is connected by this change.

For a bounded test, append seconds (1–600):

```sh
npm run paper -- run work/stream-paper-checkpoint/config.json work/stream-paper-checkpoint/paper.sqlite 60
npm run paper -- status work/stream-paper-checkpoint/paper.sqlite
```

That locally saved config contains only the four previously investigated pairs, with discovery disabled. It exists as validation evidence, not a recommended profitable watchlist. Continuous operation using the normal config is available; it was not left running by this checkpoint.

## Reused execution and safety

`Observer` stream handling → `LiveRecorder.update` → indexed affected-pair notification → `PaperBot` → current mapping/strict stream checks → existing `assess` → observer persistence barrier → existing `enter` → durable paper reservation → 500 ms modeled hedge delay → existing `completePaperHedge` → durable result.

`completePaperHedge` was extracted from the existing `executePaper`; the browser simulator still calls the same logic. It is not a second simulation engine. The headless process stores the existing paper State/accounting model in a separate small SQLite file. It does **not** import/reset the browser D1 ledger, synthetic demo ledger, exchange positions or research data. Status is the operational journal for this worker.

Simulated capital starts at $50 per venue. The existing $10 per-entry/$40 total commitment caps, two-second freshness, two-cent per-contract reserve, 30-day challenge/horizon, minimum profit/ROI and $5 daily loss stop remain. Sports are included in paper research and execution; unknown categories still block entries. Live-pilot eligibility is separate and unchanged. Whole-contract paper fees remain assumptions, not certified live fractional-fill fee bounds.

A verified, active mapping is required. Healthy connection alone is insufficient. Source, book validity, timestamp age, rule hashes and orientation are checked before committing; metadata and stream eligibility are checked again after the observer persistence barrier and before completing the hedge. REST data never masquerades as a strict stream book. Synthetic ledgers cannot be opened as live-data ledgers, and live-data mode refuses fixture books.

Updates coalesce in a bounded queue; a single in-flight executor avoids duplicate entries. Cash for both legs and a pending-hedge ID are persisted **before** the delay. If interrupted, restart conservatively restores an unmatched first leg and refunds only the absent second-leg reservation. Failed hedge/unmatched exposure halts entries for review; it is not erased by restarting. There is currently no command to clear that persistent halt. Settlement checks still account for open exposure, and are idempotent. Do not delete a ledger to bypass a halt.

Entry/settlement writes are durable immediately; decision counters are checkpointed every ten seconds and on clean shutdown, so a crash can lose recent diagnostics, not an acknowledged financial-state write. A persistence failure stops new entries. No throughput or 24-hour uptime claim is made from this short validation.

## What was actually demonstrated

Nine new integration/regression tests cover observer update → persisted entry, held-market deduplication, unapproved mapping rejection, non-opportunity/stale/invalid books, burst coalescing, missing hedge/unmatched exposure, interrupted reservation recovery, once-only settlement across reopening, sequence loss/unwind, persistence-barrier failure and fixture-source exclusion. Several checks share one test. These are synthetic protocol/accounting tests, not exchange fills.

One actual-market 60-second worker run completed and drained. Its durable status contained **nine pair decisions, nine unapproved-mapping rejections and nine strict-stream-evidence rejections**; reasons overlap. Zero paper positions, $50/$50 unchanged cash, no pending hedge, no real orders/fills/profit. The same four unresolved pairs were used; no discovery expansion or repeated search for a profitable result occurred. A subsequent reporting refinement names the individual venue and stale/sequence/health/source reason; the saved live run retains its original combined diagnostic.

The earlier evidence also establishes that these four contracts exceed the existing paper challenge horizon. Connecting the executor does not approve their settlement terms or remove that limit. The next substantive bottleneck is a demonstrably equivalent, eligible pair with usable current books and positive economics. This checkpoint proves an automatic paper execution path and a live no-trade path—not that the bot makes money.

Validation: 184/184 tests passed; TypeScript (`--noEmit --incremental false`) and production build passed. The existing vinext route-classification notice remains. No tests/builds overlapped the bounded live worker run. The user-owned demo process on port 5174 was left untouched.

Commit/push: the configured 1Password signer again failed (`failed to fill whole buffer`; `failed to write commit object`). All work, including the earlier fixture checkpoint, is staged locally but uncommitted and unpushed. No signing bypass was used. HEAD remains `184e9cd7472d034f4188c91949dd36ff31ba2212`.

## September 12 operational corrections

Sports are no longer categorically rejected by the paper engine, research detector or manual pair API; dashboard notices now reflect this. A synthetic sports pair passes the actual observer-to-paper execution path. Settlement review remains mandatory.

Observer startup rechecks active unverified restored candidates against the current matcher before indexing/subscriptions, persists rejections, and retains their history. Explicitly verified mappings retain their independent reviews. Rejected candidates may return through the existing catalog reconciliation only if they pass current matching. A read-only audit of the user's existing database found 180 candidates rejected and 781 retained; this audit did not change the original database or ledger. Rejections are matching failures, not a claim that every rejected pair is definitively inequivalent.

Paper events now dispatch only to capacity-selected pairs. Capacity-deferred pairs no longer produce misleading missing-second-book decisions. Legitimately missing/stale/invalid books still block execution with venue-specific reasons. Runtime summaries show approved active mappings, selected pairs, startup rejection count and an explicit scanning-only notice when approval count is zero.

SIGINT/SIGTERM handlers remain installed through cleanup, including initialization; repeated signals cannot bypass the database flush by removing handlers too early. Every cleanup operation is attempted even if another fails. A real subprocess regression confirms repeated signals produce a clean session end and release both leases. SIGKILL/power loss cannot perform graceful cleanup; persisted hedge recovery remains in place. The cause of the user's historical incomplete shutdown is not established.

Validation after corrections: 186 tests pass, TypeScript check and production build pass. No real trades or new live-market profitability claims. Restart the worker to load the changes.

See [SETTLEMENT-VALIDATION.md](SETTLEMENT-VALIDATION.md) for the subsequent paper-only conditional approval path, revised review diagnostics and NFL alias fix. No conditional approval is enabled by default.
