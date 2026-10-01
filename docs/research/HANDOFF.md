# Handoff — 2026-10-01 EDT, out-of-sample checkpoint stopped

**PAPER / READ-ONLY. Full 30-minute checkpoint complete; collection stopped. No orders, account mutations, fills, realized profit, recovery run, automation, merge or live launch. Stop here.**

[Draft PR #22](https://github.com/tyhuffman7/lights_on/pull/22), `codex/recall-first-detector`. Retained checkout: `/Users/tylerhuffman/Documents/code_projects/lights-on/work/recall-detector-20260930/checkout`. Primary local/staged work, credentials, signing, databases and old evidence are preserved. GitHub identity verified as `tyhuffman7`; repo-local SSH signature verified.

- Frozen signed source **`404ae5b19b467cdcb0c073c2900edd32467f41ef`**; classifier SHA-256 `28f926a5ec26b920a69e0ae3ce2dd05e73224430e3f490fd65bdabd3a07597f6`. **193/193 hashes unchanged after shutdown**, independent observer manifest/policy matches. No semantic changes, tuning or post-window repair/replay. Duration alone extended from 20 to 30 minutes; existing $50/venue simulated capital, $5 paired cap, ten contracts and two-second freshness preserved.
- Observation **12:24:40.918–12:54:40.918 EDT**, October 1; exit0, pending0, process check confirms worker/supervisor stopped. **21,840** discovered/visited/both-book routes;11,211 fresh routes;181/181 healthy feeds.61,482 fresh normal-fee positive one-contract readings;1,229 fresh executable confirmations:763 basis/466 unresolved/0 strict/0 frozen different. **188 unique route/orientation survivors** (185 pair IDs).
- Manual native-term reference audit: **50 strongest survivors +20 supplementary basis +50 rejected =120 unique records**. Top50: **14 nominal basis/36 different/0 strict**; top20 **20 different**. Reviewed basis promotions **30/30 ordinary**,false promotion0/30; reviewed legitimate routes incorrectly vetoed **0/50**. Different-question capture **50/86=58.1%** in this deliberately enriched sample;40/50 primary were frozen unresolved,including all36 false matches and four nominal legitimate hypotheses. These are finite, correlated agent reference labels, not population precision/recall or an independent human audit.
- Temporal holdout contains recurring contracts:13/50 primary candidate orientations have unseen pair/hash combinations (five nominal basis/eight different);only two are basis promotions. Full unseen-market generalization remains unproved. Novel/live failures:cross-game “neither team”/race thresholds,league rank ranges,Oscar categories,chart rank/song-versus-album,political cohort/trigger/cycle. Record for a future task; no repairs authorized here.
- Strongest nominal darts modeled net **$0.3911** at five contracts includes a16:00/16:25 UTC metadata timing gap and correlated orientations; treating those three rows unresolved leaves11 basis/36 different/3 unresolved in top50. Strongest without that extra event-binding gap: **Nebraska $0.35** at five contracts,K No0.25/P Yes0.65,$4.50+$0.15 fees. All34 manually ordinary quote rows fail fragmentation-fee stress;17 fail one-tick stress;three retain exposure blockers. **Zero strict equivalents, fills or realized profits.** Exact clauses/quotes/ages/depth/fees are retained.
- Confirmation median/p95:WS-only **2/11 ms**;fresh survivors **4/82 ms**,max10,197;all **7/9,063 ms**. Queue **3/19 ms**,peak7,pending0.58 PM-US429s and767 fallback confirmations explain the observed fallback mix, without a causal latency attribution. Frozen-head GitHubCI **921/921 tests, typecheck/build passed**;offline arithmetic120/120 and receipt/source invariants verified. Publication is evidence/docs only.

[Results](semantic-oos/RESULTS.md) · [Manual audit](semantic-oos/MANUAL-AUDIT.md) · [Recall audit](semantic-oos/RECALL-AUDIT.md) · [Metrics](semantic-oos/audit-metrics.json) · [Economics](semantic-oos/ECONOMICS.md) · [Native clauses](semantic-oos/CONTRACT-REVIEW.md) · [Verification](semantic-oos/verification-receipt.json). Raw evidence: `work/semantic-oos-20261001-v1`;390,283,869 bytes,SHA-256`648e62ac582604d989dc87c20bed7a71608e860d3ada229fa57406072d88b463`. Earlier [in-sample precision checkpoint](semantic-precision/RESULTS.md) and [WS baseline](hot-confirmation/RESULTS.md) remain preserved.

**Blockers:** unresolved false hypotheses still dominate strongest live survivors;recall beyond the finite audit is unproved;no strict settlement certificates;unconfirmed account fee precision and execution/recovery economics. Fresh-fill recovery remains unproven; do not repeat/refine the completed no-fill recovery test without new evidence.

**Next action:** user review of draft PR #22. A future classifier iteration/new collection needs new instructions. No follow-on work is scheduled.

```sh
cd /Users/tylerhuffman/Documents/code_projects/lights-on/work/recall-detector-20260930/checkout
git status --short --branch
gh api user --jq .login # must be tyhuffman7
gh pr view 22 --json headRefOid,isDraft,body
```

**SEMANTIC CLASSIFIER NEEDS ANOTHER ITERATION — 36/50 strongest survivors (20/20 top) are different questions left unresolved.**
