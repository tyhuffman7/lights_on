# Depth-aware discovery — frozen plan, September 22, 2026

Base: PR #7, `0c8edac07e9c3b8e31ee10e124f616bb75d0f7f1`; hosted CI [35672174459](https://github.com/tyhuffman7/lights_on/actions/runs/35672174459) passed. Prior runs, fees, matcher, recovery, passive fills, ledgers and trading authorization are unchanged.

Discovery compares **every legal whole quantity through ten** using the existing cumulative-depth walker and fee calculations. It selects the largest fee-bound dollar surplus, breaking ties toward less capital. A selected request is repriced at that exact quantity; later insufficient depth fails, even if a smaller quantity is profitable. Quantity changes create alternative intervals, not additional trades. Fees, extra risk allowance, recovery reservation, status, settlement, cash/horizon policy and trading authorization remain separate. Baseline failures do not erase price evidence.

The unchanged simulated capital is **$50 per venue ($100 total)**; at most ten contracts are priced, with venue cash requirements reported explicitly. This is a small-capital experiment. **No quantities above ten or larger-capital scenarios are evaluated.** The ten-contract bound limits entry to less than $10 per venue before fees and reservations, comfortably within the simulated budget; account cash is neither read nor inferred. The separately recorded live cap grants no trading permission.

## Collection and resource limits fixed before observation

- Refresh the full supported open-market catalogue once, using existing normalization and matcher. Catalogue budget: 20 minutes / 2,000 logical requests, with the existing 300 ms host pacing and bounded HTTP retries. Preserve catalogue incompleteness. No price-dependent route selection or matcher changes; matching is not settlement equivalence.
- Reuse category round-robin selection and atomic shared-PM-market bundles. Up to **20 sequential batches of 60 routes (1,200 total)**, deduplicated feed IDs within each batch. Oversize bundles and routes beyond the finite window receive explicit omission reasons. No silent route collapse. All current matched categories are attempted subject to these limits.
- One supervised **30-minute maximum** window. Equal batch durations are computed from the actual batch count before launch, with two-second gaps and a ten-second shutdown reserve. No restart, automatic extension, reconnect, or second pass. Actual batch and per-route observation times are reported; batching never establishes simultaneous coverage or absence while a market was unobserved.
- Two persistent market-data sockets per batch, at most one additional requested PM-US book socket, at most 60 unique markets per venue. One shared Kalshi lifecycle subscription per batch, acknowledged before serial status GETs with 250 ms spacing after responses. Stop status bootstrap on 429. Stop a failed feed with no reconnect.
- At most 120 paired confirmations total, one in flight, two-second global spacing and 35-second per-route-side cooldown. Equal remaining budget per remaining batch. Prioritize routes not previously attempted, then new routes ahead of the AOC reference, then fee-net dollars. Confirm only positive candidates. Consumed depth, selected quantity or fee changes may permit another request; unused depth and timestamps do not. Never repeat a previously attempted identical executable signature in its batch.
- Keep existing 1,500 ms response, 250 ms processing, 2,000 ms age/cross-venue, 1,000 ms clock and version/supersession gates. 250 ms evaluation coalescing, 256 MiB streaming event/confirmation logs (public catalogue metadata and derived summaries are stored separately), 2 GiB free-disk floor, 60-second worker silence limit. A resource/clock fault stops the window. All orders disabled; no private account or ledger calls.
- Triage at most three strongest **new** requested-book confirmed-positive routes against actual primary contract terms after collection. Equivalent / conditional / incompatible / unresolved with reasons. AOC remains reference-only and unresolved.

The documented [PM-US public REST limit](https://docs.polymarket.us/api-reference/rate-limits) is 20 requests/second/IP; this process is below four. [Kalshi basic read budget](https://docs.kalshi.com/getting_started/rate_limits) is 200 tokens/second with a default ten-token cost; serial status requests stay below four/second. WebSocket batch sizes are conservative process limits, not claims of a published venue cap. No orders are submitted.

## Reproduction (requires a new authorized checkpoint)

```sh
node --experimental-strip-types worker/executable-screen.ts discovery-prepare NEW_RUN_DIRECTORY
node scripts/confirmation-launch.mjs NEW_RUN_DIRECTORY ENV_FILE
node scripts/discovery-report.mjs RUN_DIRECTORY docs/research/depth-discovery/summary.json docs/research/depth-discovery/RESULTS.md
```

Directories are single-use. Freeze contains source hashes and planned batches. Raw catalogue, terms, books, HTTP bodies, environment and private databases remain local. Only allowlisted derived summaries are published. Hosted CI runs full tests/typecheck/build; targeted checks run before observation, with no tests/builds or repeated CI polling during collection.
