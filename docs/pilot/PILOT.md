# $200 pilot: authorization, implementation and launch status

Latest evidence: [PROOF-OF-EDGE.md](PROOF-OF-EDGE.md). No profitability or execution proof; both new bounded live samples are complete.

The user authorized a pilot with $100 on Kalshi and $100 on Polymarket US and accepted a maximum loss of the full $200. Larger funding is not authorized. Account funding has not been verified. The objective is to establish actual fills and realized net results before scaling; there is no earnings promise.

This checkpoint implements preflight checks, a durable intent-ledger foundation and a historical capital-fit audit. It does **not** implement live exchange order submission or an automatic execution loop. Research mode remains unable to place orders. Budget authorization is recorded so it does not need to be requested again; factual launch prerequisites still apply.

## Initial operating limits

- $100 maximum lifetime budget per venue; larger balances or profits do not automatically increase authority.
- One contract per leg, at most $2 modeled combined debit and $10 reserved/committed in the initial stage.
- $10 cash reserve per venue. Initial entries use at most 25% of displayed depth at each level, rounded down to supported whole contracts.
- Both legs must have depth. The plan fixes a worst price and expires after 250 ms. A plan is never a confirmed fill.
- Existing two-second strict book freshness; fresh metadata and reconciled account state; healthy streams, event loop and persistence.
- Minimum modeled net of $0.01 after modeled fee bounds and an additional $0.01 uncertainty reserve. This is an initial screen, not a live fee guarantee.
- Long settlement horizons are allowed per user direction. Administrative close is not a guaranteed cash-release date; settlement availability must be confirmed before reusing funds.
- No unverified mapping, unsupported sports category, unvalidated fee bound, unvalidated execution protocol, unresolved order or unmatched inventory can pass preflight.

The ledger reserves both legs atomically, records submission-unknown before any future external request, and prevents repeating that transition. Acknowledgments do not create fills. Duplicate and older authoritative updates do not add spend; conflicting revisions are rejected. Partial fills and fills racing cancellation remain recorded and block new entries. Budget overruns trigger a persistent halt. Compare-and-swap updates protect intent transitions across independent readers.

The first-stage ledger deliberately has no automatic inventory-release or bankroll-recycling path. Filled inventory is still exposure, not settled cash. An exchange reconciliation adapter, paired-position accounting and tested unwind handling must be added before this can be an unattended trading system. Callers cannot establish real execution readiness by inventing the preflight health flags: no live transport consumes them in this checkpoint.

## Historical capital-fit result

The read-only audit inspected 1,920 historical opportunities and 10,399 saved states with assumed standalone $100-per-venue accounts. 347 events had a positive one-contract model with fresh saved books. These are hypothetical scenarios, not realized profit. The user has removed the initial horizon restriction. All 1,920 were unverified sports observations; **zero states were launch-eligible**.

[Historical audit JSON](historical-audit.json) includes selected frozen rules, books-derived plans, blockers and timing scenarios. Each scenario starts with hypothetical full funding, so events cannot be summed into a monthly profit forecast. Repeated states and overlapping opportunities are not independent earning opportunities. Blocker counts are per opportunity with at least one affected state, so they overlap.

An earlier near-term example is Jamaica Kingsmen versus Barbados Royals cricket. [Its rule review](CRICKET-REVIEW.md) remains unresolved; it has not been approved. The leading NFL review candidate also has a substantive 48-hour versus two-week postponement difference. Identity agreement does not establish settlement equivalence.

Reproduce the historical audit without credentials or network access:

```sh
npm run pilot:audit -- research-data/research.sqlite docs/pilot/historical-audit.json
```

## Execution protocol research

Kalshi's [current V2 create-order specification](https://docs.kalshi.com/api-reference/orders/create-order-v2) uses fixed-point prices and a YES-side bid/ask representation. Its documented fill-or-kill support does not make a cross-exchange pair atomic.

The [Polymarket US order overview](https://docs.polymarket.us/api-reference/orders/overview) distinguishes order acknowledgments, partial fills, fills, and cancellations; includes IOC/FOK; and requires an automatic-order indicator for automated activity. Its NO exposure and price representation require explicit translation tests. Do not copy a generic YES/NO price directly into an order request without validating those semantics.

The explicitly nonbinding PM-US preview endpoint has been tested; no order submission or cancellation endpoint was called. Remaining launch work is concrete: establish a genuinely eligible pair with reviewed rules, support its actual fee/tick/quantity regime, implement and test authoritative order/fill/balance adapters and paired recovery, resolve sustained-observer stalls, and collect a realistic fill simulation before any live pilot entry. The accepted loss budget does not remove those implementation requirements.

## Validation

The prior foundation checkpoint had 130 passing tests, including 15 pilot regressions covering two-leg depth, worst-price plans, unverified and unsupported markets, stale clocks/accounts/metadata, fixed funding authority, restart recovery, unknown submissions, acknowledgment-versus-fill, duplicate/conflicting evidence, partial cancellation, persistent halt, atomic pair reservations and long-dated eligibility. TypeScript and production build pass; the existing route-classification notice remains. Tests use synthetic fills; they do not prove venue execution reliability.

## Entry and early exit

The target is automatic execution, not alerts. The public [ARBS page](https://www.arbs.xyz/) describes a scanner with manual user execution; its public page does not establish the described early-exit crossing feature. Its generic Polymarket coverage is not evidence of Polymarket US liquidity.

An early exit must price the actual owned contracts against executable bids on both venues, subtract sale fees and the actual entry costs, and confirm both sales before reporting realized profit. A displayed cross alone is insufficient. Unmatched fills need a separate exposure-recovery path. Longer settlement horizons are acceptable, but rule differences, void outcomes, and incomplete fills prevent describing an unverified candidate as guaranteed profit. A quote-only early-exit evaluator implements bid/depth, actual entry cost, fee, freshness and inventory checks. It never reports realized profit. Early-exit execution, sale reconciliation and venue transports remain unimplemented.

## Read-only execution evidence follow-up

[Existing order checks](existing-order-schema-check.json) validate one completed Kalshi order and one canceled PM-US order with three partial-fill records. Individual fills and the fetched order agree on quantity and fees; Kalshi's cumulative fill cost also agrees. These are pre-existing user holdings, never bot trades. The canceled PM-US order retains inventory and must not release its filled amount as unused cash.

The order-evidence adapter refuses incomplete fill totals, inconsistent fees, unknown states, wrong order/market/side/venue, and unsupported precision. It reports source update time without inventing an exchange revision. The September 14 execution bridge now connects this evidence to the durable intent ledger through serialized reconciliation and explicit bot-owned order registration. A future submission transport must establish the correlated order identity; account-wide matching never grants ownership. The fill journal survives duplicate replay/restart, but does not itself prove order completion or apply accounting adjustments. Corrections/rebates outside the supported taker path remain fail-closed. No automatic submission or profit claim is enabled.


Fill/order evidence uses explicit microdollar fields so six-decimal fees and fractional trade notional remain exact. The preflight/reservation unit remains $0.0001; the execution bridge explicitly rounds reservation debit upward while retaining exact microdollar accounting. This conversion does not certify the fee bound. The Kalshi whole-contract fee estimate is not a certified fractional-fill bound; see the latest fee-rounding section in PROOF-OF-EDGE.md before any fee gate is enabled.

## September 14: durable execution reconciliation bridge

`PilotExecutionLedger` now stores immutable pair plans, owned intent/order bindings, raw evidence receipts, deduplicated fills, exact fees/cash flow, and reservation updates in one SQLite database. Accepted evidence applies atomically. Failed evidence survives for review and halts new submissions; pending receipts recover after restart without clearing the halt or resubmitting. Paired inventory is never reported as realized profit. Synthetic and live provenance cannot mix, and unrelated paper/research databases are refused.

`npm run pilot:reconcile -- EXISTING_OWNED_LIVE_PILOT_DB PAIR_ID` refreshes only an already-owned pair using signed GETs under an exclusive lease. It cannot create orders or adopt personal holdings. Unknown submission identity and incomplete pagination fail closed. The September 14 history update follows complete pagination up to 20 pages of 100 records; exceeded bounds and inconsistent pagination fail closed. No live execution database was populated by this checkpoint.

Verification: 302 passing tests, TypeScript and production build pass. New synthetic regressions cover restarts, duplicate/stale/conflicting evidence, partial fills, ambiguous submissions, persistence failure rollback, ownership, exact fees and persistent halts. A fresh authenticated read-only check of existing user records again reconciled one Kalshi fill and three PM-US partial fills against their orders; these are not bot trades.

Live submission remains disabled. Remaining gates include a correlated submission transport and lost-response recovery, tested unmatched-leg recovery and exits, settlement/account reconciliation, validated fees/protocols, and an eligible reviewed pair. The initial one-contract FOK design differs from the maker execution used by the profitable paper examples; those results cannot establish FOK profitability. The current paired settled paper total is +$0.282 across three positions including a loss, with +$8.16 directional recovery separate.

### Durable outbound preparation and recovery assessment

`stagePairDispatch` validates and saves both frozen FOK requests and marks both submissions unknown in one transaction. A failure on either side rolls back both; restart never stages again automatically. This is an outbound journal, not an exchange sender. A future sender must enforce fresh metadata and all launch gates. Full-fill versus terminal zero-fill now persists an unmatched-exposure halt. `recovery` identifies missing identity, unresolved order evidence and confirmed excess inventory before any future unwind decision; it never authorizes automatic recovery. The GET reconciliation command reports this assessment.

306 tests, TypeScript and build pass. New failure tests cover second-write rollback, malformed metadata, expiration, restart duplication and terminal mismatch. No real orders or recovery sales were sent.

### Settlement history acquisition

Authenticated read-only history acquisition now supports Kalshi primary-subaccount settlements and Polymarket US position-resolution activities, with bounded pagination. Fresh reads found one existing record on each venue and verified field shapes only. These personal records are not bot settlements. Payout semantics, ownership attribution, exact settlement credits and account cash conservation remain unfinished. 312 tests, TypeScript and build pass. See the latest research handoff for the next validation step.

### Kalshi settlement evidence assessment

The owned-order ledger can now assess an isolated Kalshi buy position against complete account fills, authenticated settlement quantities/costs/fees/revenue, and finalized public market metadata. Assessment preserves losses and rejects mismatches; it never credits account cash or releases inventory. Fresh existing personal records passed the parser without being adopted by the bot. 319 tests, TypeScript and build pass.

Polymarket US payout semantics remain unresolved: the observed resolution retains cost, reports zero realized change, and has null baseCost/fees despite zero remaining position. Those fields cannot be treated as a cash-credit record. Durable settlement credits and account conservation remain unfinished.

### Polymarket expected payout assessment

Owned-ledger assessment now checks final published binary settlement against authenticated position resolution and exact entry fills. The actual LONG sample passed; YES/NO and win/loss synthetic cases pass. Post-resolution sold quantity must exactly equal the resolved owned quantity. Returned payout is explicitly expected: observed account cash credit remains unknown. A winning sample's realized field remained zero and tradeId was empty, so neither is used to invent cash evidence.

325 tests, TypeScript and build pass. Durable account cash baselines, complete cash-movement reconciliation and confirmed settlement crediting remain unfinished. No real orders or credits are enabled.

### Exact account observations and entry baselines

Exact cash observations now retain microdollars separately from buying power and pilot funding limits. Both immutable observations must precede the plan and remain fresh before paired dispatch preparation; submitted pairs cannot receive retroactive baselines. Raw responses and normalized observations survive restart. Credential fingerprints prevent accidental continuity assumptions across keys but do not establish an exchange account ID.

330 tests, TypeScript/build pass; current authenticated balance reads passed on both venues. No live baseline or cash credit was created. Full classified cash movements and account conservation remain required before any settlement credit is confirmed.

### Classified cash audit

Unfiltered Polymarket history now feeds a durable diagnostic audit separating completed deposits, bot executions and unrelated trades. Duplicate events do not increase cash; unsupported movements, ambiguous observation timing and unexplained changes prevent reconciliation and persist a halt. Settlement resolutions still require additional validated evidence. No diagnostic result authorizes credits or reports realized profit.

339 tests, TypeScript and build pass. Actual personal history classified three trades and a deposit, retaining its settlement as unresolved. Kalshi cash movement adapters and complete settlement-to-cash integration remain unfinished.

### Durable settlement expectations in cash diagnostics

Validated owned Polymarket settlement expectations now persist with their raw evidence. Cash audits revalidate them against current supplied trade history and match the exact resolution record before including expected payout. Duplicates do not increase totals. Failed updates retain evidence and a persistent halt. Historical audit replay remains a frozen diagnostic, never current launch authorization.

341 tests, TypeScript/build pass, including synthetic restart/partial-fill/duplicate-resolution and injected persistence-failure tests. Actual cash confirmation, other movement types, Kalshi conservation and inventory release remain unfinished; credits and real trading stay disabled.

### Kalshi funding evidence

Bounded read-only deposit/withdrawal history now handles the observed optional cursor on short funding pages. Applied zero-fee deposits retain exact amounts and conservative application-time intervals; a missing finalization timestamp is never replaced with creation time. Pending/unsupported fees or withdrawals prevent a complete funding assessment.

345 tests, TypeScript/build pass; actual account reads found one applied deposit and no withdrawals. This covers funding evidence only. Primary-subaccount attribution, transfer coverage and full Kalshi cash conservation remain unfinished. No credits or real trading enabled.

### First-observed funding and transfer histories

Both Kalshi transfer histories now have bounded fixed GET readers. Immutable funding observations can establish that an applied deposit was already known before a later cash capture, with matching credential scope and no unresolved transfers. No completion date is invented.

348 tests, TypeScript/build pass. A separate small actual-data evidence database verified funding-before-cash timing and exact restart readback, with zero owned orders or credits. This is funding coverage only, not full account conservation or pilot readiness.

### Kalshi cash diagnostics and actual idle interval

Durable Kalshi diagnostics now combine exact fills, settlement records and funding observations, separating personal settlement cash from bot expectations. Earlier unchanged funding observations prevent old deposits being falsely placed in the current interval; unknown scope, transfers or changes remain blockers.

354 tests, TypeScript/build pass. An actual read-only idle interval reconciled with unchanged balance, zero unexplained cash and exact restart replay. No bot orders or credits existed. This validates idle accounting only, not live execution or settlement profit.

### Prior activity intervals and current readiness

Polymarket audits can use immutable completed history captured before the starting cash observation. Only identical completed records are excluded; changes, missing records, unsupported states or later unexplained cash remain blockers. A real 30.43-second idle interval had unchanged balance and zero unexplained cash with exact restart replay. No bot orders or credits existed.

359 tests, TypeScript/build pass. Current next priority is evidence for a consistent pilot strategy: maker paper results do not establish one-contract FOK economics or strict market eligibility. Both venues' idle diagnostics remain distinct from non-idle settlement proof.
