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

No exchange write endpoint was called. Remaining launch work is concrete: establish a genuinely eligible pair with reviewed rules, support its actual fee/tick/quantity regime, implement and test authoritative order/fill/balance adapters and paired recovery, resolve sustained-observer stalls, and collect a realistic fill simulation before any live pilot entry. The accepted loss budget does not remove those implementation requirements.

## Validation

The prior foundation checkpoint had 130 passing tests, including 15 pilot regressions covering two-leg depth, worst-price plans, unverified and unsupported markets, stale clocks/accounts/metadata, fixed funding authority, restart recovery, unknown submissions, acknowledgment-versus-fill, duplicate/conflicting evidence, partial cancellation, persistent halt, atomic pair reservations and long-dated eligibility. TypeScript and production build pass; the existing route-classification notice remains. Tests use synthetic fills; they do not prove venue execution reliability.

## Entry and early exit

The target is automatic execution, not alerts. The public [ARBS page](https://www.arbs.xyz/) describes a scanner with manual user execution; its public page does not establish the described early-exit crossing feature. Its generic Polymarket coverage is not evidence of Polymarket US liquidity.

An early exit must price the actual owned contracts against executable bids on both venues, subtract sale fees and the actual entry costs, and confirm both sales before reporting realized profit. A displayed cross alone is insufficient. Unmatched fills need a separate exposure-recovery path. Longer settlement horizons are acceptable, but rule differences, void outcomes, and incomplete fills prevent describing an unverified candidate as guaranteed profit. A quote-only early-exit evaluator implements bid/depth, actual entry cost, fee, freshness and inventory checks. It never reports realized profit. Early-exit execution, sale reconciliation and venue transports remain unimplemented.
