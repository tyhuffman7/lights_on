# Handoff — 2026-09-23, settlement-family checkpoint

**Checkpoint complete; remain PAPER ONLY and STOP.** No new watch, PAPER session, mapping, real order, preview, cancellation, live enablement or recovery refinement. The existing disabled live build gate is unchanged. The ≤$5 bounded-basis policy is a separate, unconsumed design with no authorization.

## Verified state

- Isolated branch `codex/settlement-family-matrix`, based on PR #16 head `16e9a15cdb7886bae9721b8ded4f08f035ee6f00`; public draft stacks on `codex/tiny-live-readiness`. Primary checkout's unrelated staged/unstaged/untracked work preserved. GitHub identity is only `tyhuffman7`; repo-local SSH commit signing retained.
- Full unmodified matcher output over the latest complete saved catalog (2026-09-22 00:55:59 UTC): **3,120 routes, 46 semantic family pairs, 52 source-document pairs, 78 pinned rule sources**. **0 LIVE_EXACT; 0 STATE_CONDITIONED; 2,852 BOUNDED_BASIS; 63 INCOMPATIBLE; 205 UNRESOLVED.** These are settlement classes, not current profitable/tradable opportunities.
- [Methodology, conclusions, late-state investigation and prerequisites](settlement-families/README.md) · [complete family index](settlement-families/FAMILY-INDEX.md) · [16-dimension matrix](settlement-families/matrix.json) · [sanitized aggregate](settlement-families/aggregate.json).
- Twelve focused tests passed. Hosted CI passed **732/732 tests, typecheck and production build**, with zero failures or skips; receipt below. No full local build or market collection was run.
- Authenticated GET account/capability/history checks completed privately. No account state, balances, identifiers or responses are published. Exact Ohio/product/account eligibility, PM trading-status evidence and useful fee precision/bounds remain incomplete. Refresh account reconciliation before any future launch.

## Consequence and next action

Strict cross-venue payout identity is not demonstrated at scale: official starts/results remove some contingencies, but independent correction/review/emergency/fair-allocation branches survive. CPI/GDP/U3 and current Netflix contracts close on Kalshi before the proposed publication state. Some other late-state windows are possible by terms but unverified; no new observation was authorized/run.

The shortest next step is a current venue/account-specific Ohio eligibility and order-permission determination for the intended product class. A later separately authorized launch-preparation checkpoint may bind a short-horizon bounded-basis route, conservative fees, fresh status/reconciliation/economics and an exact ≤$5 plan. Actual acceptance, latency, fills, commissions, sequencing and recovery-if-needed are pilot learning objectives, not circular prerequisites. Do not force recovery or repeat the completed no-fill operating test.

## Needed commands (offline only)

```sh
node --experimental-strip-types --test tests/family-settlement.test.ts
node --experimental-strip-types worker/settlement-family-audit.ts --catalog /absolute/path/to/catalog.json --private-output work/family-audit
```

The worker pins the reviewed catalog and source hashes, leaves private route evidence under the requested local output directory and never writes mappings or orders. Main local catalog: `work/depth-discovery-20260922/catalog.json`. Isolated implementation and private source/account evidence: `/private/tmp/lights-on-family-matrix-20260923` (ignored `work/family-matrix`). Keep it private and preserve evidence. Do not copy raw responses, environments or unrelated work into a PR.

## Publication receipt

[Draft PR #17](https://github.com/tyhuffman7/lights_on/pull/17), stacked on #16. Signed implementation `eb2bd8a` (research commit `e7cf171` plus optional-lookup type correction) passed [hosted CI 35910971866](https://github.com/tyhuffman7/lights_on/actions/runs/35910971866): 732/732 tests, typecheck and production build; no failures/skips. A final documentation-only receipt commit follows that tested implementation. All scoped commits use the repo-local SSH signing key. No merge, force-push or live order.
