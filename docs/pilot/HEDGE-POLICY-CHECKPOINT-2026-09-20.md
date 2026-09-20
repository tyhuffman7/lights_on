# Hedge diagnostics and offline recovery checkpoint — 2026-09-20

PAPER ONLY. The prior **-$0.53** simulated loss, halt, execution gates, cash limits and 500 ms delays remain unchanged. No observer, trader or experiment was started. The supplied checkpoint document was used as task context; the user's request authorizes the diagnostic patch and offline analysis, not deployment of a recovery policy.

## Diagnostic patch

`PAPER_MAKER_HEDGE_DECISION` now records every evaluated tick with remaining maker exposure, including outer-runner skips. It records wall/monotonic decision time; first pending fill receipt and processing clocks; due time; remaining quantity; exact gate outcome; mapping, stream and book state; book age; principal/fees for available full depth; prior spending; reservation; and cancellation/expiry state. An unusable book's arithmetic is explicitly a non-executable diagnostic quote. A missing book/depth yields null pricing. The existing `PAPER_MAKER_FILL` event records every fill's processing clocks as well as transport receipt clocks.

Book updates carry session-scoped version numbers and processing timestamps in their retained JSON bodies. Decision records reference these immutable versions, not ambiguous receipt timestamps, and contain no level arrays. Versions are retained even for invalid books. This uses the existing ordered asynchronous persistence worker and its 2,000-pending-message/64 MiB fail-closed bounds: no new synchronous SQLite/report writes, per-decision full-book duplication, or unbounded in-memory event history. Records occur only while maker exposure exists within the existing order lifetime/hedge deadline. The selected-paper-market full-capture setting must remain enabled to resolve references; missing references in legacy fixtures are explicitly null. Busy coalesced wakeups are not decisions and are not represented as calls.

The gate function now returns its reason to the optional diagnostic callback; gate precedence, mutations, fee arithmetic and success/failure behavior are preserved. In particular, the existing actual hedge gate considers reserved cost+fees, while resting quote viability also charges the reserve and entry-profit threshold. The patch does not silently reconcile these two policies or add partial hedging. The halt still blocks new entries. All recovery-policy code below is an **offline script**, not imported into the worker.

Focused tests cover delay, absent/stale/closed books, insufficient full depth, invalid increments, reservation failure, invalid outer mapping state, success, immutable references, and persistence. The captured fixture establishes $5.35 + $0.17 > $5.4094 **when supplied those inputs**, not which missing historical call occurred. Offline tests reject hindsight fallback, reprice at arrival, and retain exposure after failed hedge/residual recovery. Targeted result: **60 tests passed**. Hosted correctness status is recorded in the handoff/PR after completion.

## Evidence and assumptions

Baseline: [prior diagnosis](FILL-FIRST-DIAGNOSIS-2026-09-20.md), session `acf6e470-ded5-4527-a6e8-42f63b65d8d6`, historical source `44246fac5f05ca35423f1f070c856ed8122c7d8c`. [Machine-readable comparison](hedge-policy-comparison-2026-09-20.json) contains all amounts in USD × 10,000, book row IDs, intent/arrival timestamps, reasons and adverse cases. [Local capture](../../work/fill-first-20260919/recovery-window.json) contains **762** records for the two markets, 21:09:02.000–07.500 UTC. The model does not use later market outcomes. Historical ledger SHA-256: `ff1eeed834ec29779f7ce8684426a6f9de7aa7983d96d2b4d3395a02e7dd551e`.

At each scenario time, use the latest receipt timestamp, breaking ties by persisted book order; never substitute an older cheap book after a newer expensive/unusable one. Apply freshness, open/depth, fees, per-venue budgets and the $10 all-in entry cap. However, old captures lack book **processing-availability** timestamps, and multiple later-processed Kalshi updates share earlier transport receipt times. Thus these are **conditional depth/economics scenarios, not demonstrated counterfactual fills or historical failed checks**. The new diagnostic patch cannot repair that old information gap. The observed unwind alone has recorded intent/fill books proving its outcome. No statistical inference is justified from one filled order.

## Recovery comparison

All net outcomes below include the original fee conventions and simulated reserve charges. A conditional ordinary payout is not guaranteed settlement or realized profit.

| Alternative | Policy/cash admissibility and modeled result | Remaining risk |
|---|---|---|
| Historical baseline: unwind 10 | Recorded -$0.53 (-$0.33 before reserves), flat at 21:09:04.846 | None remaining; halt retained |
| Full PM hedge of original 10 at original due 04.340 | 10 @$0.535: $5.35 + $0.17 fee + $0.10 reserve = $5.62, exceeding $5.4094. Total $10.07 exceeds $10. **Infeasible.** Conditional -$0.07 (+$0.13 before reserves) cannot authorize it. | Would hold 10 pairs; not executed |
| Partial 9 + separately unwind residual 1 | Intent at 04.340, fixed 9-contract budgeted IOC arrives 04.840: latest PM ask is $0.565, not the intent's $0.535. Debit $5.085 + $0.15 + $0.09 = $5.325, inside existing reservation. Residual unwind submitted then, arrives 05.340: $0.42 gross -$0.02 fee -$0.01 reserve = $0.39. Total conditional outcome **-$0.385**, versus the misleading intent-price -$0.125. | Nine pairs remain; $9.385 net capital committed until settlement. Either leg may fail. Unsupported by current executor. |
| Proposed pre-entry headroom, 9 contracts | Before entry reserve $4 Kalshi + $6 PM = **$10**, within existing caps. At modeled notification 03.895, freeze PM recovery spending ceiling $5.47 (explained below). At arrival 04.395 after **500 ms**, reprice to 9 @$0.535: $4.815 + $0.16 + $0.09 = $5.065. Combined $9.065; conditional **-$0.065** (+$0.115 before reserves). | Nine pairs remain; $9.065 committed until settlement. Counterfactual smaller entry/fill is assumed, not observed. |
| Unwind those proposed 9 instead | At $0.42, net proceeds $3.53 against $4 entry debit: **-$0.47** | Flat if delayed sell executes; otherwise exposure remains |

The fractional maximum 9.61 PM contracts is not treated as a clean recovery policy: it leaves 0.39 unpaired Kalshi exposure, below Kalshi's 1-contract trading increment. The offline partial alternative uses whole contracts so its residual can actually be submitted independently. It retains two separate 500 ms recovery legs and never assumes atomic cross-venue execution.

Headroom is funded **before entry** by removing one contract, not by drawing free cash after a fill. At the original placement book, nine contracts pass unchanged admission economics: $3.87 principal + $0.04 maker fee + $0.09 reserve = $4; PM planned $4.6194 + $0.16 fee + $0.09 reserve = $4.8694; total $8.8694, conditional profit $0.1306 (about 1.47%). Extra reserved PM headroom is $1.1306, not an expense or removed reserve. Cash after locking $4/$6 would be $48.6096 Kalshi/$49.8324 PM, versus starting $52.6096/$55.8324. Total reserved $10 is below $40 committed with zero prior commitment. For any future order, available cash and prior commitments must pass before admission; otherwise reject/reduce, never borrow from them afterward.

The recovery rule is full hedge only when (a) within the preallocated inclusive-reserve budget, (b) within total limits, and (c) its conditional loss does not exceed the **submission-time** estimated delayed-unwind loss. At the notification scenario, nine-contract unwind quote is $3.53; ceiling = $9 payout − $3.53 = **$5.47** PM debit, tighter than its $6 reservation. That ceiling is fixed before transport; arrival cannot relax it. It is a fee-inclusive budgeting assumption for a paper IOC, not a claim an exchange accepts a dollar-budget order. If submission lacks a usable unwind quote, or full hedge cannot qualify/execute, request a separately delayed unwind and retain any failed residual. Applying this in an executor is not part of this patch.

## Latency sensitivity

The fixed grid **0, 100, 250, 500, 750, 1,000 ms** was declared before computing comparisons. Public tape exchange time was 03.191; transport receipt 03.840; the modeled fill diagnostic was persisted at 03.895. Actual decision-processing timestamps between receipt and diagnostic are unknown. Public prints are not private user-fill notifications. A future live executor must measure user-fill notification, decision/submission, acknowledgement and fill separately; this capture and unrelated REST timings establish none of those live latencies.

Two clock anchors bound the interpretation: (1) receipt + delay, floored at 03.895 to avoid acting before the fill diagnostic; (2) a conservative hypothetical submission at 03.895 + transport delay. Baseline remains receipt +500 = **04.340**. The primary table uses anchor (2), fixes the headroom policy's budget at submission, and reprices on arrival. Values are conditional capture scenarios with the processing-availability limitation above.

| Delay | Arrival | Original 10 full-hedge debit incl. reserve / feasible? | Proposed 9 outcome with fixed $5.47 ceiling |
|---|---|---|---|
| 0 ms | 03.895 | $5.3344 / yes | +$0.205 conditional; zero-delay boundary only |
| 100 ms | 03.995 | $5.3344 / yes | +$0.205 conditional |
| 250 ms | 04.145 | $9.54 / no ($0.94 book) | Hedge rejected by simulator; delayed unwind scenario -$0.47, flat |
| **500 ms** | **04.395** | **$5.62 / no** | **-$0.065 conditional**, nine held pairs |
| 750 ms | 04.645 | $5.77 / no | -$0.19 conditional |
| 1,000 ms | 04.895 | $5.92 / no | -$0.325 conditional |

At 250 ms, receipt anchoring lands at **04.090**, just **2 ms before** the $0.94 snapshot's receipt, and therefore produces an affordable quote instead. This flips the scenario across the unmeasured processing interval: a strong reason **not** to choose 250 ms (or any production delay) from this trade. Latency impact is non-monotonic; faster is not a guaranteed hedge. The full grid and both anchors are retained, including the losing/infeasible alternatives.

## Adverse cases and policy hypothesis

Synthetic stresses are labeled separately from recorded books. At PM $0.94 (a captured adverse price), $0.70 (larger than the due-time price), and $0.99, the proposed full nine-contract hedge breaches its preallocated $6 budget. Policy chooses unwind, not more cash. Partial-hedge-plus-unwind scenarios for those inputs produce respectively **-$2.55, -$1.41, -$2.83**; affordability alone does not make them good recovery choices. Eight contracts of depth cannot fill nine: full-only policy unwinds rather than inventing a complete hedge. Empty PM depth also selects unwind. If the later Kalshi sell lacks depth, result is **unresolved exposure, null realized profit**, not an assumed sale or settlement. A partially filled recovery with failed residual sell retains both paired and unpaired inventory.

**Recommend one out-of-sample hypothesis:** preallocate recovery headroom by reducing admitted size by one Kalshi contract inside the same $10/$40 limits; retain the 500 ms baseline; use the fixed-budget, full-hedge-versus-unwind rule above. Test whether it reduces reservation-driven unmatched exposure and total loss **after fees/reserves**, without worse unresolved inventory or unacceptable capital lockup. It is a hypothesis, not demonstrated superiority: the conditional hedge carries postponement-window, fair-price cancellation, tie/correction and settlement-timing risks that a flat unwind does not. Settlement duration is unmeasured here; market close timestamps are not proof of when capital returns.

No current numerical limit needs increasing. Executing the original ten-contract full alternative would have required +$0.2106 PM reservation and a $10.07 trade cap; those changes would require Tyler's approval and are **not proposed or implemented**. The future recovery allocation/selection policy and experiment itself require separate approval. Freeze the hypothesis and grid before new data; a next bounded PAPER test may stop at the first filled-order resolution or 20 minutes, retaining the halt and all failures. There is no automatic restart or observer-only continuation.

Reproduce offline (from repository root):

```sh
python3 scripts/hedge-policy-capture.py work/fill-first-20260919/observer.sqlite work/fill-first-20260919/recovery-window.json
node --experimental-strip-types scripts/hedge-policy-audit.ts work/fill-first-20260919/recovery-window.json docs/pilot/hedge-policy-comparison-2026-09-20.json
node --experimental-strip-types --test tests/hedge-diagnostics.test.ts tests/hedge-policy-audit.test.ts tests/maker-ledger.test.ts tests/maker-runner.test.ts tests/paper-capture.test.ts tests/hardening.test.ts
```
