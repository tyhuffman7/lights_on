# Bounded-basis candidate watch — September 23, 2026

This checkpoint authorizes market observation only. Unresolved Ohio, account and product permission is `LIVE_SUBMISSION_BLOCKED`; it does not block subscriptions, pricing, ranking or requested-book confirmation. The existing live adapter, dormant pilot and lifetime execution ledger are untouched. No order creation, preview, cancellation, modification, PAPER experiment or new mapping is part of this run.

## Frozen universe and coverage

The watch verifies the previously published route-audit digest and exact market hashes, then uses only its 2,852 ordinary-complementary BOUNDED_BASIS routes. INCOMPATIBLE and UNRESOLVED predicates cannot enter. All family exceptions remain attached to their original routes.

The schedule contains 48 shards, with at most 60 routes active concurrently. Within sports and non-sports it prefers the earliest later-of-two venue close estimates, placing already expired estimates last. Each shard takes up to 30 routes from each category and fills unused capacity from the other. This avoids limiting observation to the historical 26-route shortlist. A shard receives 90 seconds of persistent WebSocket observation after current metadata acquisition. Once the fixed universe has been visited, the same schedule may repeat only within the original two-hour deadline. Acquisition, missing books, feed faults and rotation gaps do not count as usable observation.

Current metadata refreshes existing IDs only; no matching or family research is rerun. The current metadata hashes must equal the audited hashes. Closed markets, fee overrides requiring review, changed terms or times, unsupported fees and indicated exceptional states are excluded. Consequently, a changed administrative end date can conservatively exclude a route even if its underlying ordinary predicate may remain equivalent. Exclusion counts describe this exact watch, not permanent incompatibility.

Usable route-hours integrate consecutive healthy samples on a monotonic clock. A route counts once regardless of its two orientations. A gap resets continuity; intervals over one second are capped rather than credited as observed time. The reported monitorable count means routes that actually had both usable streamed books, and is distinct from the number whose metadata was visited. Visited, metadata-eligible and monitorable counts are cumulative unique routes. Exclusions describe each route’s latest failed metadata refresh; after revisiting routes, these can overlap earlier successful coverage and should not be added as mutually exclusive totals.

## Economics and selection

Both complementary orientations are evaluated over current executable depth. Whole paired quantities are enumerated within available depth and the existing $5 total-commitment bound. Fractional depth is retained. Entry debit reserves all units at each leg's last consumed limit price and the applicable maximum fee. One reducing-unwind fee reserve is included in commitment, separately from ordinary settlement profit. Ordinary payout is $1 per paired contract; no fill or realized profit is claimed.

Current market/series coefficients are used. Account-specific precision is not inferred from balances. Where account precision is unproven, the existing Kalshi cent-precision bound allows 0.01-contract fragmentation, adds rounding per possible fill and credits no rebate. PM-US uses the existing cumulative quadratic fee ceiling rounded upward to cents. These are conservative bounds rather than predicted actual commissions. The Kalshi unknown-precision bound can exceed $1 per whole contract by itself, making positive fee-net economics impossible under that bound even when a raw spread is visible. This limitation is reported explicitly; settings are not tightened in response to observed prices.

There is no 2-cent admission cushion and no modeled settlement-risk probability or dollar penalty. All strictly positive fee-net episodes count. Ranking is fee-net dollars, return on total committed capital, earlier indicative release, then executable depth. A meaningful stopping candidate must also remain positive and within $5 after repricing the same quantity one adverse native tick on each leg. This is an execution-noise sensitivity check using observed venue grids, not an extra exchange fee or settlement-risk deduction. Unknown tick grids cannot establish that stopping criterion.

## Requested confirmation and residual checks

A positive episode freezes its exact quantity before requesting both books. Each confirmation uses independent exact-market execution feeds, a Kalshi requested snapshot and a separately correlated PM-US subscription snapshot. The existing sequence, version, processing-age, clock and cross-venue timing checks apply. Confirmation reprices that exact quantity, rejects changed fee coefficients, and never substitutes a smaller size. Disappearing or failed confirmations do not stop the watch.

Current venue metadata and lifecycle messages reject known adverse or changed status. They do not establish that no unreported real-world exceptional event exists. A frozen economic candidate must retain this evidence scope and list any independent event review and account/ledger reconciliation still required. Thus `PILOT_CANDIDATE` is an observation artifact; the report separately answers whether every non-eligibility pilot prerequisite is complete. A candidate does not enable or consume a live attempt.

## Resource and stop rules

The supervisor and worker share the original two-hour deadline. There is one session marker and no restart or extension. Per-venue reconnect budgets, stream integrity checks, a 768 MiB resident-memory ceiling and a 2 GiB free-space reserve remain finite. Routine planned shard rotations are distinct from failure reconnects. Evidence retains eight rolling 8 MiB monitoring segments and a separate 64 MiB protected, hash-chained decision budget. An evidence/resource fault stops observation. Private raw books, metadata, tapes, account responses and credentials are excluded from publication.

The worker stops at a strong confirmed frozen candidate, the original deadline, or an integrity/resource failure. No parameters are tuned during collection. Full tests, typechecking and production build run on GitHub CI after collection; targeted pre-run tests exercise the observation/eligibility separation, universe coverage, time accounting, fee diagnostics, native-tick sensitivity and ranking.
