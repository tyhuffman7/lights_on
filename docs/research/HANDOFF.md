# Lights On — PR #2 scoped typecheck fix

2026-09-20: retrieved the retained types.log and summary.json from hosted run 35535067442. Installation, all 449 tests, build and log artifact upload passed; typecheck exited 2 with exactly: `scripts/hedge-policy-audit.ts(13,31): error TS2339: Property 'venue' does not exist on type 'Book'.`

Reproduced that error on the unchanged PR head 78d11a9af452febdcd088f81b227b313837f60e7 using pinned Node 22.23.2 and TypeScript 5.9.3. Corrected the offline captured Row.book type to the existing StreamBook, which declares venue and the captured stream metadata; removed the now-unnecessary narrow assertion in usable(). No runtime expressions, compiler settings, dependencies, execution strategy, limits or delays changed.

Verified locally on Node 22.23.2: `npx --no-install tsc --noEmit --incremental false` exits 0; all four `tests/hedge-policy-audit.test.ts` cases pass. Full validation belongs to the existing hosted CI on draft [PR #2](https://github.com/tyhuffman7/lights_on/pull/2), branch codex/hedge-policy-checkpoint. This signed follow-up publishes only the offline script type fix and this short handoff. Original working-checkout source changes remain untouched.

Next checkpoint: push the signed follow-up without force, take one hosted CI snapshot, and report actual results (pending if still running). Do not merge or rerun an experiment. Historical PAPER loss and halt remain intact; no recovery policy activation or live orders. [Policy checkpoint](../pilot/HEDGE-POLICY-CHECKPOINT-2026-09-20.md) retains the offline comparison and its uncertainty.
