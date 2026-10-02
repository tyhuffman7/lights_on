# Small paper bot validation — October 2, 2026

Branch `codex/simple-paper-bot` starts at PR #22 head `9362b703aa575718c5be7ea67ab5d6dc4fd92682`. The primary checkout's unrelated edits and staging remain preserved.

- Targeted checks: **12/12 passed**. Explicitly synthetic scenarios verify positive spreads, paper entry, both orientations, fee rounding, multi-level sizing, capital constraints, early bid exits, settled cashflows and divergence. Retained native WS messages verify normalization and sequence-gap invalidation. These tests do not invent live opportunities or fills.
- Public candidate-research check: 564 Kalshi markets in the selected series, 2 PM-US markets in the bounded search response, 30 suggestions requiring manual review. First approved pair's current native metadata passed exact rules/deadline checks; fee coefficients were Kalshi 0.07 and PM-US 0.0695. Local output: `research-data/simple-paper-validation/candidates.json` (ignored).
- Full GitHub CI and the single frozen five-minute WS smoke: pending; receipts will replace this line after collection.

Frozen settings: 15 reviewed ordinary season-win pairs; PAPER only; $200 total locked-capital limit; $100 simulated cash per venue; 2-second book age; 1-second leg skew; 2-minute metadata expiry; maximum equal whole-contract depth subject to fees/cash; one open position per pair; 30-second re-entry cooldown plus newer books on both venues. No real orders or fresh-fill recovery test.
