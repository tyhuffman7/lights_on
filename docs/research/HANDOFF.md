# Handoff — 2026-09-30 EDT, scoped recall checkpoint stopped

**READ ONLY / PAPER. The authorized implementation, verification, bounded observation and draft-publication checkpoint is finished. All observation and native-check processes are stopped. Full arbitrage confirmation remains incomplete. Stop here; no automatic continuation, merge or live launch.** No orders, previews, cancellations, funding or wallet actions occurred.

[Draft PR #22](https://github.com/tyhuffman7/lights_on/pull/22), branch `codex/recall-first-detector`, exact requested base `a200abf36cd590c894f936dbe1d6f4c81f461468`. Persistent checkout: `/Users/tylerhuffman/Documents/code_projects/lights-on/work/recall-detector-20260930/checkout`. Preserve main's local/staged work, `tyhuffman7` identity and repo-local SSH signing.

- Implementation `fb9da7f08733019df3e994b22559f7a61b0f6f64`: **30/30 targeted tests; CI 789/789 tests, typecheck and build passed** ([receipt](recall-detector/ci-receipt.json)). Signed implementation and documentary commits; PR remains draft.
- Final frozen run `work/final-20260930-batched`, 23:09:56–23:29:56 UTC: complete native catalogs, 17,817 matched/visited/two-book routes, zero unvisited, 6,512 routes with fresh paired books, 171/171 feeds healthy at stop. **163,517 fresh two-book observations; 592,856 gross and 512,108 normal-fee-positive readings including stale; 160 confirmation dispatches, 147 economic survivors, three fresh quote-executable candidates, zero strict-equivalence proofs.** Readings repeat updates, not trades/profit.
- Each bounded run froze parameters and source hashes before collection. The first exposed serial catalog normalization and matching false-positive priority. Final batches normalization by native page, matches off-thread, reserves every third confirmation oldest-first, and retries public 429s at most three times with shared bounded backoff. Public PM-US book throttles remain the measured bottleneck: **101 HTTP 429s; one refresh took 824.344 seconds fetch/normalize + 55.199 seconds matching; median queue wait 467.939 seconds; 7,939 confirmations pending at stop.** No five-minute completed-refresh or immediate-all-candidate guarantee.
- Three fresh survivors: different-question Alaska House pairing; Purdue season-win basis candidate (quantity 4, modeled net $0.04); unresolved Mistral IPO candidate (quantity 3, modeled net $0.02). Full Kalshi IPO terms include equivalent foreign filings, correcting abbreviated inline wording; exact issuance/deadline/source/review equivalence remains unresolved. Do not conclude no arbs from an unsupported verifier.
- Delay zero had six clean depth counterfactuals; every 100/250/500/1,000 ms follow-up on those entries was stale/unobserved. No fills, realized/portfolio profit, fresh-fill recovery or successful unwind proved. Do not repeat/refine prior completed recovery tests without new evidence.
- Independent native checks: **43 routes, zero failed requests, 34 normal-fee-positive routes, all previously surfaced; 112 arithmetic cases, zero disagreements or suppressed positives.** Selected-route checks do not establish catalog-wide absence or complete matching recall.
- September 22 replay preserves 51/51 ordinary-fee positives, four fresh. September 23/24 temporary raw L2 absent; user knows no alternate copy; exact 662/71/12 replay remains unverified. Synpath hosted matching failed TLS; SDK orientation/fee cross-check helped; example bot targets offshore PM.

[Final evidence](recall-detector/final-receipt.json) · [Native check](recall-detector/native-check.json) · [Contract review](recall-detector/CONTRACT-REVIEW.md) · [Methodology and examples](recall-detector/README.md) · [First bounded run](recall-detector/bounded-1-receipt.json).

If the user explicitly continues a new checkpoint: first inspect branch/status and this handoff. The next concrete work is to pace the **PM-US book endpoint** without throttling unrelated full-catalog discovery, validate confirmation access under its actual public limits, and close the Mistral IPO issuance/deadline/source proof. Preserve broad paper candidates and native timestamps. Do not redesign or replay completed recovery work, claim equivalence from a name/template, enable orders, or infer live eligibility from the paper capital assumptions. Current corrected observer command, only for a newly requested run:

```sh
cd /Users/tylerhuffman/Documents/code_projects/lights-on/work/recall-detector-20260930/checkout
npm run research:recall -- work/NEW-PAPER-WINDOW --duration-seconds=1200 --env=/Users/tylerhuffman/Documents/code_projects/lights-on/.env.research
```

Ignored raw catalogs, books, source freezes, smoke logs and native checks remain under this checkout's `work/`; no evidence is deleted. Primary pre-task handoff and staged-index fingerprint remain in sibling `primary-handoff-before.md` and `primary-index.sha256`.

DETECTOR STILL BROKEN — native throttling/backlog prevents prompt confirmation, and IPO settlement equivalence remains unresolved
