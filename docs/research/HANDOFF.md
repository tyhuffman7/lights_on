# Lights On — handoff (2026-09-21, candidate confirmation)

PAPER ONLY / ORDER DISABLED. Candidate-confirmation implementation is published in draft PR [#5](https://github.com/tyhuffman7/lights_on/pull/5); one supervised collection is RUNNING_PENDING; the completed September 21 baseline is preserved. Its 2.63% figure was strict freshness passes, not uptime, and hardcoded combined qualification was not an opportunity-discovery measure.

- Correction: separate data validity, positive fee-bound exchange economics, settlement equivalence, additional policy admission and trading authorization. Reuses existing feeds/books/matcher/depth walker and supervisor; no passive-fill or recovery redesign, orders or ledger changes.
- Verification: 20 focused tests (19 initial checks plus a CLI startup regression) passed on Node 22.23.2, including baseline regression, feed failures, timestamp-free Kalshi snapshots, quiet books, cache/failed confirmation, same-quantity adverse repricing, intervals and disabled authorization. Hosted full CI pending.
- Bounded review: AOC pair `KXAOCRUN-28-27JAN01` / `cranc-uspres28-12-31-2026-aleoca` reviewed against primary terms and RUN.pdf, plus PM-US Rulebook 10.3–10.5. Outcome UNRESOLVED with specific cutoff, issuance/source-precedence and exception gaps. Exactly one concrete pair reviewed; no universal framework. See [clauses](aoc-contract-review-20260921.json).
- Observation launched once at **2026-09-21 19:16:59 UTC**, scheduled hard stop **19:46:59 UTC**. Frozen selection: 58 routes / 13 categories / 104 unique books; two baseline NPB routes unavailable or closed. All 104 books received at the startup snapshot. Limits: 10 contracts, 250 ms coalescing, 120 attempts, one in flight, 2-second global / 35-second per-candidate pacing, strict 2-second confirmation age/skew. No tuning or restart. See [method](CANDIDATE-CONFIRMATION.md).
- Interim evidence through 19:17:19 UTC: one distinct AOC taker/taker interval (Kalshi NO + PM-US YES), initial fee-bound surplus $0.15 at 10 contracts. First confirmation FAILED: cached response, unresolved cache provenance and REST older than already observed stream. Survival unknown, not a confirmed opportunity. Risk allowance $0.20; recovery reservation $0.10 Kalshi / $0.50 PM-US. Separate baseline horizon, profit, ROI and entry-cap blockers. See [interim table](CANDIDATE-CONFIRMATION-20260921.md) and [sanitized evidence](candidate-confirmation-summary-20260921.json). This is not a completed 30-minute result.
- Checkout `/private/tmp/lights-on-candidate-confirmation-20260921`, branch `codex/candidate-confirmation`, based on `1264e9d`. Original workspace remains on main with prior work preserved. Local evidence `work/candidate-confirmation-20260921`; no raw data/credentials/databases may be published.

Next: let the existing supervisor finish without restart. Collection and hosted CI remain pending; no repeated AI polling. After the deadline, read the existing status/summary once and regenerate sanitized results (no new capture):

```sh
cd /private/tmp/lights-on-candidate-confirmation-20260921
node scripts/confirmation-report.mjs /Users/tylerhuffman/Documents/code_projects/lights-on/work/candidate-confirmation-20260921 docs/research/candidate-confirmation-summary-20260921.json docs/research/CANDIDATE-CONFIRMATION-20260921.md
```

Publish the final derived summary and update this handoff with actual stop/CI results, then stop. No new strategy, merge, force push, orders or ledger changes. Historical baseline, ledger/halt and fresh-fill-recovery status unchanged.
