# Handoff — 2026-09-24 EDT, PMXT POC complete

**READ ONLY / PAPER ONLY.** The PMXT experiment is complete and stopped. No real order, deposit, wallet action, venue trading credential, live execution change, or observer migration occurred. Primary main's existing staged, unstaged, and untracked work was preserved in place; this work used the isolated branch experiment/pmxt-poc.

## Verified result

- [Draft PR #20](https://github.com/tyhuffman7/lights_on/pull/20) targets main. GitHub CLI and the pinned remote used tyhuffman7. Source freeze 3675a87dbab49176d8576aa9432bd59bcdc12fa9 and results/fix fa164de are signed.
- pmxtjs 2.54.0 and the existing PMXT_API_KEY worked on https://api.pmxt.dev. The timed read-only run was 2026-09-24 04:15:46.758–05:15:49.697 UTC: 72 cycles, 146 logical SDK calls, zero rate-limit/auth/API/malformed failures.
- **Zero** Kalshi × Polymarket US target clusters, direct identity edges, flagged target book clusters, usable two-book candidates, gross/fee/reserve-positive candidate models, contract-verified candidates, and executable paper opportunities. No best target example, fills, or profit. A direct HTTP 200 check confirmed the target cluster response was an empty data array. PMXT's documented hosted catalog does not list Polymarket US ingestion.
- The frozen run took 12 extra cycles in its final minute; a post-run scheduler correction and regression test prevent that in future runs. Calls remained below PMXT's documented rate limit. No economic setting was tuned and the observed run was not repeated.
- Full local Node suite **229/229**, TypeScript no-emit check, production build, clean lockfile install, and 28 affected tests passed. GitHub CI is unavailable on this branch because main lacks a workflow file and automatic approval review rejected adding persistent automation. The initially sandboxed test attempts hit loopback EPERM; the normal suite passed with local loopback access.

## Blocker and next action

PMXT currently provides no observed target catalog matches, so its Polymarket US live-book capability and settlement equivalence remain untested. **Keep Lights On's current Kalshi × Polymarket US discovery/matching and economics.** Do not migrate or delete existing logic. Verify first-party PMXT hosted-catalog support for polymarket_us before considering a newly scoped repeat of this read-only POC. A live launch still requires separate authorization and current Ohio/account/product eligibility evidence. The previous bounded candidate watch and no-fill recovery are complete and should not be restarted as part of this work.

## Evidence and commands

Detailed methodology, comparison, limitations, and recommendation: [PMXT_POC_RESULTS.md](PMXT_POC_RESULTS.md). Ignored JSON/JSONL evidence is preserved both in this worktree and the primary checkout at research-data/pmxt-poc/2026-09-24T04-15-46.758Z/. The files were checked byte-for-byte and contain no PMXT key.

From the experiment branch with PMXT_API_KEY set:

    npm ci
    npm run research:pmxt -- --minutes=60 --interval-seconds=60

Local key-file alternative, reading only PMXT_API_KEY:

    npm run research:pmxt -- --key-file=/Users/tylerhuffman/Documents/code_projects/lights-on/.env.research --minutes=60 --interval-seconds=60

Validation commands:

    npm test
    npx tsc --noEmit
    npm run build
