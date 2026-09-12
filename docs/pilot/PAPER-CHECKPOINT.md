# Demonstrated paper checkpoint — September 11–12, 2026

The existing simulator is demonstrated end to end. Live-data paper execution is **not** demonstrated. No real orders, cancellations, account changes, bot fills or real bot profit occurred. Live execution and pilot fee/protocol gates remain disabled/unchanged.

## Run the demonstration

From the existing repository (Node >=22.16; dependencies already installed):

```sh
cd /Users/tylerhuffman/Documents/code_projects/lights-on
npm run paper:demo
```

Open `http://127.0.0.1:5174/paper-demo?case=eligible&run=manual`.
The local sign-in redirects to the existing `/challenge` page. Click **Start paper challenge**, then **Pause paper bot** after the entry and open **Paper journal**. The synthetic banner, market titles and source labels identify this as a fixture. The row initially shows **open / Pending**, not realized winnings.

To publish the synthetic settlement for that same ledger, open `http://127.0.0.1:5174/paper-demo?case=eligible&run=manual&settled=1`, then **Paper journal → Check synthetic settlements**. Wait at least 30 seconds from the prior cycle; the normal cooldown is unchanged. Use the settlement control, rather than starting more entry cycles. It credits $0.48 once. Rechecking or restarting does not credit it again.

Other cases use the same URL with `case=no-edge`, `case=unwind`, or `case=unmatched`. Each has a separate ledger. Change `run=manual` to a new alphanumeric/hyphen name for a fresh ledger; existing ones are retained. Do not delete/reset a ledger to repeat the demonstration.

The demo uses `work/paper-demo/state`, separate from normal `.wrangler/state`, plus a synthetic user/case namespace. It creates the existing experiments table only in that separate database. It never copies research databases or accesses real accounts. Stop with Ctrl-C. These demo substitutions are installed only for explicit local Vite **serve** mode; production **build** ignores the demo environment flag. Local discovery/review endpoints are disabled in demo mode.

Normal public-data workflow remains `npm run dev` → `http://localhost:5173/challenge` → local sign-in → review a suitable pair → **Start paper challenge**. This uses the existing ordinary local ledger; no fixture is seeded. A new ordinary local database still requires the repository's existing schema setup. Hosted authentication/storage is unchanged. **No current shortlist pair is approved for that workflow.**

Cycles require the browser page to remain open and running. Reload pauses the loop, while balances/positions persist. This is not an unattended worker. The newer read-only observer does not feed the paper ledger.

## Actual path and demonstrated accounting

`/challenge` → `/api/state` start → `/api/run` → fresh market metadata/books → `assess` → 500 ms delayed hedge book → `executePaper` → `enter` / `settle` → existing `saveState` optimistic D1 revision → `/api/state` retrieval → existing journal and scoreboard.

The new `paper-data` module is only a data boundary for run/scan. Test code supplies synthetic metadata and books; the application routes, sizing, fee functions, execution, settlement and D1 persistence run unchanged. Production ineligible quotes now write their rejection reasons to the activity log.

Each fixture starts with **$50 Kalshi + $50 Polymarket US simulated cash**. Original defaults remain: $10 per pair, $40 committed total, $0.10 minimum modeled profit, 1% minimum ROI, 2¢ execution reserve per pair, 30-day horizon, two-second quote age, whole contracts, $5 daily realized-loss stop and unmatched-exposure block.

| Scenario | Demonstrated result through HTTP/D1 |
|---|---|
| Eligible | 10 paired contracts: Kalshi YES at 40¢, PM-US NO at 50¢. $9 purchase + $0.17/$0.15 fees + $0.20 reserve = $9.52 debit. Cash $45.73/$44.75. $0 realized while open; $0.48 conditional modeled profit. |
| No edge | 60¢ + 60¢ purchase rejected with a net-edge reason; no position, cash remains $50/$50. |
| Hedge disappears, unwind available | Missing PM-US NO depth; first leg sells at synthetic 38¢ bids with $0.17 exit fee. PM-US cash remains $50; Kalshi cash $49.36. Realized **paper loss $0.64**. |
| Hedge disappears, no unwind | First leg remains unmatched, $4.27 exposed; cash $45.73/$50. A later actual run blocks further entries and preserves exposure. |
| Persistence/duplicates | Reload retrieves identical state. Concurrent runs admit one entry; immediate retries hit normal cooldown. Server restart preserves all four ledgers. |
| Settlement | Synthetic YES settlement at both venues pays $10 to Kalshi and $0 to PM-US. Final cash $55.73/$44.75, $100.48 total, $0 committed. Repeated settlement after restart leaves cash/profit unchanged. |

Native browser verification clicked Start, Pause, Paper journal and the settlement control. It observed pending profit before settlement, retained balances after server restart/reload, and the settled $0.48 afterward. Other fault cases were verified over actual HTTP routes and retrieved via `/api/state` and `/api/scan`, rather than individually clicked in the browser.

Fees are the existing conservative whole-contract paper assumptions. They do **not** certify live fractional-fill fee bounds. The reserve is charged as a simulated cost. No synthetic rule approval applies to a real pair.

Reproduce the API acceptance checks while the demo server runs:

```sh
npm run test:paper-http
# Stop and restart npm run paper:demo; wait 30 seconds since the last cycle:
node tests/paper-demo/http.mjs --restart
```

Each test creates a new run ID. Evidence stays in `work/paper-checkpoint/http-<run-id>.json`; `http-latest.json` points to the newest run. Earlier reports and ledgers are preserved.

## One bounded live session

Exactly four requested pairs; discovery disabled, no category expansion. Collection ran for 60 seconds, **63.553 seconds including setup/drain**, with 21 book updates, zero reconnects, zero event-loop-delay episodes, and an empty/nonfailed persistence queue before stop. Both authenticated streams connected; no unavailable-credential blocker was observed. No account endpoints were queried. Other host activity was not instrumented.

Two targeted REST rounds retained 57 raw public responses overall, 16 normalized leg confirmations, metadata/rule hashes, request/receive times, provided exchange times, quantities, sequence/health evidence and both orientations. Local evidence totals about 0.8 MB in `work/paper-checkpoint/live-20260912`; no historical database was duplicated. The observer's normal book ring is not a claim that every raw stream message was archived; the dedicated files retain the sampled stream books and public REST bodies.

Rejections overlap; counts are per **eight pair snapshots**, not trades:

| Reason | Count |
|---|---:|
| Settlement rules require review | 8/8 (4 distinct pairs) |
| Outside unchanged 30-day challenge horizon | 8/8 |
| Stale REST exchange timestamp | 8/8 |
| Net edge below challenge threshold | 4/8 |
| REST errors / unavailable credentials | 0 observed |
| Unknown fee/minimum metadata in these normalized snapshots | 0 |
| Insufficient one-contract depth after 75% haircut | 0/16 orientations |

The one-contract **research-only** model used 25% displayed depth, whole-contract fee upper estimates and a 1¢ reserve (distinct from the challenge's 2¢ reserve). Both rounds showed the same conditional net:

| Pair | Kalshi YES + PM-US NO | Opposite orientation |
|---|---:|---:|
| Newsom | −$0.030 | −$0.050 |
| Emanuel | +$0.017 | −$0.069 |
| AOC | +$0.020 | −$0.130 |
| YoungBoy Never Broke Again | +$0.010 | −$0.130 |

Six positive observations are repeated views of three pairs, **not six trades or earnings**. None is approved. Nomination end-date interpretation, AOC legal issuance/start-window, and artist issuance/intervening chart history/credit/revision-delay questions remain unresolved. Existing matching corrections and category restrictions are unchanged. We did not try unrelated categories or another live session.

## What freshness established

Of 472 sampled leg states, 24 passed strict freshness, 444 were valid and connection-healthy but failed it, and four had no book yet. In 194 leg samples, local book age was over two seconds while exchange time was either absent or within its allowed range: the local age gate alone failed **at the book level**, not at full trade eligibility.

Seven of sixteen targeted REST leg confirmations exactly matched the unchanged stream depth while the stream was healthy but strict-stale. There were no request races in these confirmations. The other nine did not have exact full-depth equality; seven background reconciliations separately identified older REST exchange timestamps. No mismatched or older response was promoted into strict stream evidence.

`BookCache` timestamps represent the most recent received book update. The existing health field `bookChangeAgeMs` uses that same timestamp; it is not an independent proof of when economic depth last changed. REST request/receive times are separate confirmations. Heartbeat/connection health is separate again. A healthy socket is insufficient, two REST responses are non-atomic, and unchanged displayed depth cannot prove executable quantity or fill probability.

The existing `strictBookAgeOnlyRejectedEvaluations` counter was 10, but its implementation counts positive **gross** research evaluations and does not remove rule/fee blockers. It must not be read as ten tradable opportunities. The smallest supported finding is that age gating can exclude resting books; it is **not** the sole live-data blocker. No timeout, timestamp, sequence, recovery, identity, persistence or pilot gate was relaxed.

Reproduction script (explicitly starts a new bounded live session; not run automatically by tests):

```sh
node --experimental-strip-types tests/paper-demo/live-check.ts work/paper-checkpoint/NEW-DIRECTORY
```

The single most important remaining blocker is an actually reviewed, settlement-equivalent live pair that fits the existing paper challenge. The four research candidates do not meet that condition. This checkpoint stops here.

## Validation and saved checkpoint

Checks actually run for this checkpoint: 18 targeted tests, then **175/175 full tests**, TypeScript with `--noEmit --incremental false`, the HTTP/D1 acceptance run including concurrent entry and server restart, and native browser checks described above. Production build passed with `LIGHTS_ON_PAPER_DEMO=1`; fixture seed/control code was absent from its output. The existing vinext route-classification notice remains. No builds/tests overlapped live collection.

Sanitized evidence: [fixtures](paper-checkpoint-fixtures.json), [live sample](paper-checkpoint-live.json). Detailed raw/public and test-run evidence remains local under `work/paper-checkpoint`; GitHub does not back up that local database/data. All demo/observer processes started here were stopped and the observer drained. Normal paper/account ledgers and historical evidence were not reset.

Commit/push status: the signed commit attempt failed with `1Password: failed to fill whole buffer` / `failed to write commit object`. The checkpoint remains **staged, uncommitted and unpushed**. HEAD remains `184e9cd7472d034f4188c91949dd36ff31ba2212`, matching the last fetched `origin/main`. Signing was not bypassed or reconfigured.
