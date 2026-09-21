# Order-disabled executable-price screen

This screen reuses the catalog, candidate matcher, stream connections, sequenced book cache, outcome orientation and depth walker. It imports no order client or ledger. `TAKER_TAKER` walks currently displayed asks on both venues; `MAKER_TAKER_HYPOTHETICAL` joins the visible Kalshi bid and walks the PM-US hedge asks. The latter is a proposed resting quote, never an available fill. Neither is an atomic cross-venue execution or realized profit.

Money is integer ten-thousandths of USD. Every result retains market IDs, side/orientation, category, review class, receipt and exchange timestamps, used levels, fee provenance and a hash-addressed local book reference. Exchange-net economics precede the existing 2-cent/contract risk charge. The separate 1-cent Kalshi / 5-cent PM-US recovery cash reservation is not subtracted as an expense. The existing $10 entry reservation, $40 commitment ceiling, 10-cent profit floor, 1% ROI, 30-day horizon and 2-second freshness gates remain visible.

Sizing uses $50 simulated capital per venue ($100 total), at most 10 whole contracts, and worst displayed prices across the first ten contracts plus conservative fees, risk and recovery cash. Available whole depth and venue minimums further constrain size. No price/parameter search, ledger commitment, simultaneous portfolio allocation or larger-capital scenario is performed. Unknown fee schedules produce missing economics, never a zero-fee assumption.

`REVIEWED_PAIR` requires the existing reviewed flag. Ordinary matching under an existing settlement profile produces `CONDITIONAL_PAIR`; all remaining matched pairs are `UNVERIFIED_PRICE_COMPARISON`. The screen never upgrades either to settlement equivalence. Current discovered candidates carry no manual review approval. Ohio live eligibility and account fee classification are not revalidated; no row authorizes live trading.

## Frozen coverage

At most 60 distinct candidate routes are admitted by category round-robin, with same-day events ranked first within a category and stable ID ordering. Sports categories retain the existing competition label; non-sports categories use the existing catalog category. All mappings sharing one PM-US market within a category form an atomic bundle: the cap may omit a bundle, but cannot retain only its preferred Kalshi outcome mapping. Duplicate candidate IDs are removed; shared subscriptions are deduplicated independently. No observed prices or returns influence selection.

The cap bounds work to 240 route/side comparisons each second, with at most 60 unique markets per venue and one subscription per venue. Existing public-catalog requests use at least 300 ms per host between calls, with bounded 429 backoff. No REST requests are made during collection. This is below the published Kalshi basic read budget for default-cost requests; endpoint and infrastructure limits may still cause explicitly reported listing failures. Catalog errors, matcher rejection/deferred counts, per-category matched/selected counts, cap omissions, missing subscriptions and feed failures are preserved. No matching expansion is attempted.

Same-day, horizon and prior-strategy exclusions label observations; they are not collection filters. The fixed catalog is not refreshed during the 30-minute screen. Newly listed or changed contracts after preparation are a coverage limitation. Stream failures invalidate the affected books and stop that connection without reconnecting; healthy connections may finish the fixed window. No automatic restart, parameter changes or alternate sample is allowed.

## Fees and independent mechanics

The attached September 21 verifier was run against actual working source, not its bundled copies. Those runtime sources matched published base `049cbb15c04e172f358d1113e196a9ff2fa166d8`. Focused reference tests preserve its synthetic queue counterexample and independent Kalshi accumulator calculation. The PM-US reference independently applies per-fill half-even rounding and the cumulative ceiling. The passive-fill engine is unchanged.

* Queue fixture: production reports zero fills and nine ahead; an explicit price/time counterfactual book reports one fill. This does not overturn the September 20 capture, whose relevant same-side trade volume was absent.
* Kalshi fixture, four one-contract fills on one order at 50 cents with synthetic coefficient 0.0088: current per-fill bound totals $0.04; documented cent-precision accumulator totals $0.01; direct-member precision totals $0.0088. Member class is unknown.
* PM-US fixture, one order filled as four quarter-contract pieces at 25 cents: known collected commission is $0; the cumulative ceiling is $0.01. Separate orders have separate rounding boundaries. Unknown future fragmentation cannot justify choosing the favorable result.

Kalshi economics use the existing cent-rounded whole-contract fragmentation bound. This is explicitly conditional: it does not bound arbitrary fractional balance rounding. Maker rows retain the taker coefficient as a conservative fallback without assuming maker rebates. PM-US economics use the cumulative order ceiling, which may exceed actual collected fees. These estimates are not account-specific billing. Historical outputs remain untouched.

References checked September 21, 2026: [Kalshi rounding and per-order accumulator](https://docs.kalshi.com/getting_started/fee_rounding), [Kalshi schedule](https://kalshi.com/docs/kalshi-fee-schedule.pdf), [PM-US per-fill fee adjustment](https://docs.polymarket.us/fees), [Kalshi rate limits](https://docs.kalshi.com/getting_started/rate_limits).

## Run and evidence

Use the repository CI-pinned Node 22.23.2. Commands below are reusable documentation, not authorization for another capture.

```sh
node --experimental-strip-types worker/executable-screen.ts prepare /absolute/new-output-directory
node scripts/executable-screen-launch.mjs /absolute/new-output-directory /absolute/.env.research
```

The launcher reuses the prior bounded process supervisor, with a generic deadline label and a fixed 30-minute duration. It verifies a frozen source manifest, single-use output directory and preparation age. The supervisor stops on deadline, stalled output, low disk or failure; it cannot restart the child. A separate worker deadline also closes the feeds. Source/runtime edits after freezing are rejected.

`coverage.json` explains the observation set; `frozen.json` holds public market metadata, selection and source hashes; `started.json` records freeze hash and deadline; `status.json` records supervisor completion; `summary.json` retains best displayed and independently best fresh rows. `evidence.ndjson` contains hash-addressed book snapshots when a row becomes its route's best result. One-second sampling can miss shorter opportunities and is not a complete tick archive. Rejection counts are repeated observation counts, not unique opportunities. All raw/local records stay outside Git. Only sanitized derived summaries and this implementation are publishable.

The original September 20 21:10–21:30 UTC maker audit is historical evidence. It is not this screen and does not establish that the previously proposed coverage correction ran.

To derive a sanitized snapshot once, without polling or restarting:

```sh
node scripts/executable-screen-report.mjs /absolute/output-directory summary.json report.md
```

A running or prematurely stopped capture stays explicitly pending/incomplete. The report retains the strongest fresh and strongest displayed row separately for every category and execution route. See [September 21 interim evidence](EXECUTABLE-SCREEN-20260921.md).
