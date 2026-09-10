# Run Lights On research

This phase observes market data and simulates fills. It has no order-submission client or live-trading mode. Read `HANDOFF.md` for completion status.

## Local setup status

Both credentials are saved and were accepted by the exchanges on September 10, 2026. No credential setup is pending for this machine. The bounded validation worker is stopped; two configured Emmy candidates remain UNVERIFIED pending exceptional-settlement review. See `HANDOFF.md` before restarting.

## Credential setup for a fresh machine

The local setup files already exist at:

- `/Users/tylerhuffman/Documents/code_projects/lights-on/.env.research`
- `/Users/tylerhuffman/Documents/code_projects/lights-on/observer.config.json`

Both are ignored by Git. The first file has owner-only permissions and an automatically generated dashboard control token. The local Kalshi PEM is at `research-data/kalshi-private-key.pem` with owner-only permissions. Keep that token in the file.

1. Create a Kalshi API key for access to the read stream. Put its key ID after `KALSHI_KEY_ID=`. Save the downloaded private key outside Git (for example, `research-data/kalshi-private-key.pem`) and put its absolute path after `KALSHI_PRIVATE_KEY_PATH=`. Quote a path containing spaces. Prefer the narrowest read-only permissions the venue supports.
2. Create a **Polymarket US** API key through its developer portal. Put its key ID after `POLYMARKET_KEY_ID=` and its base64 secret after `POLYMARKET_SECRET_KEY=`. These are the U.S. API credentials, not international wallet credentials.
3. Tell your assistant that the credentials are saved. Do not send their values. We can then verify the actual handshakes, discover suitable non-sports markets, populate market IDs, review settlement equivalence, and begin a measured observation session.

Official instructions: [Kalshi WebSockets and key setup](https://docs.kalshi.com/getting_started/quick_start_websockets), [Polymarket US API keys](https://docs.polymarket.us/api-reference/authentication).

For a fresh clone, run `npm ci`, then `npm run research:init`. Node 22.13+ is required for the research worker; Node 24 LTS is a reasonable deployment baseline. Tested here with Node 25.8.1. Copy secrets through your own secure storage; they are not on GitHub.

## Start and control the observer

From the project folder:

```sh
npm run research:observe
```

Open `http://127.0.0.1:8789`. Enter the value of `RESEARCH_CONTROL_TOKEN` from `.env.research`. The page offers reports, mapping review, and pause/resume controls. Restart the worker after changing credentials or the configured market list; pause/resume does not reload environment files. Closing the page does not stop the worker. Stop it with Ctrl-C.

With missing credentials or no mappings, the process stays paused and serves the setup dashboard. It cannot collect authenticated books yet. There is no implicit REST fallback that labels polled quotes as streaming evidence.

To discover candidate markets:

```sh
node --experimental-strip-types worker/cli.ts discover > research-data/candidates.json
```

Candidate status is not a saved approval. Current public adapters do not supply every structured equivalence field, so ordinary discovered pairs require manual verification. Populate `markets` in `observer.config.json` with exact IDs:

```json
{
  "database": "research-data/research.sqlite",
  "port": 8789,
  "markets": [
    {"kalshi": "EXACT-KALSHI-TICKER", "poly": "exact-pm-us-slug", "inverted": false}
  ]
}
```

The IDs above describe the format; they are not real market recommendations. `inverted: false` means both YES outcomes represent the same event. Review both rules and fingerprints in the local dashboard before granting research verification. Invalidated mappings stay in the registry. An intentional inactive mapping is preserved across config imports; re-review is required to reactivate a changed mapping.

## Evidence, reports and replay

Default live database: `research-data/research.sqlite`, with SQLite WAL and prepared statements. Back up a live database through SQLite's backup facilities; copying only the main file during writes can omit WAL data. Local evidence and secrets are excluded from Git. Stop the worker before manually copying the database files.

```sh
npm run research:report -- research-data/research.sqlite
node --experimental-strip-types worker/cli.ts report research-data/research.sqlite > research-data/report.json
npm run research:replay
```

The replay fixture is synthetic, explicitly labeled `fixture`, and writes `research-data/replay.sqlite`. The public REST probe uses `rest_probe`. Neither is evidence of authenticated streaming profitability. Load report JSON in the site home page to view a snapshot; its optional paper challenge is at `/challenge`. Live controls are served by the worker itself. The hosted page cannot reach a private laptop process and currently has no remote worker synchronization.

## Continuous operation

For a local observation window, keep the terminal process running and prevent the computer from sleeping. For unattended operation, use a persistent Node process with a writable disk on a small VM or always-on machine. The repository includes `deploy/lights-on-observer.service` as a systemd template; adjust the user, checkout path and Node executable before installation. The worker listens only on loopback. Use an SSH tunnel for remote access:

```sh
ssh -L 8789:127.0.0.1:8789 your-worker-host
```

Then open the same local dashboard URL. Keep secrets in the worker environment or `.env.research`, with mode 600. The service restarts after failure. An atomic SQLite lease beside the evidence database prevents two observers from running together and reclaims ownership only when the prior local PID is confirmed absent. If the host cannot check that PID, startup fails closed. Use a local disk, not a shared cross-host volume.

The existing Sites/Cloudflare app is request-oriented and uses D1. This implementation does not assume a request handler can own an always-running outbound WebSocket consumer. Deploy the Node observer separately. No cloud worker, VM, public control endpoint or new paid service has been provisioned by this change.

## Data tables

Schema version 1 is implemented in `lib/research/store.ts`:

| Table | Contents |
| --- | --- |
| `sessions` | Session UUID, start/end UTC milliseconds, mode, research configuration. |
| `mappings` | Latest mapping JSON: both venue IDs/market metadata, orientation, normalized fields, fingerprints, status, active reason, creation/verification times. |
| `mapping_history` | Append-only mapping versions and audit timestamps. |
| `book_updates` | Session, venue/market, UTC and monotonic times, full normalized depth, exchange timestamp/sequence, source and validity/connection state. |
| `opportunities` | Stable lifecycle UUID per continuous pair/orientation, first/last times, duration, OPEN/CLOSED/CENSORED, opening mapping/config snapshot. |
| `opportunity_states` | Every evaluated book change while gross edge exists, including closing/rejection state, consumed depth and every supported whole quantity, fee bounds, ROI, bankroll sizes, both referenced book row IDs and ages. |
| `latency_tests` | Unique opportunity/delay/first-venue result. Frozen first qualifying $100 quote, as-of book references, coverage, hedge limit, P&L, unwind fills and residual exposure. |
| `diagnostics` | Connection/recovery, metadata/reconciliation, shutdown and probe observations. No auth headers or private keys. |

Money uses integer 1/10,000 USD; ROI is percent; quantity is whole contracts, conservatively flooring fractional displayed quantities per level. Durations use `performance.now()` and must only be compared inside the same session. The 0/50/100/150/250/500/1000/2000ms cases are independent counterfactuals, not eight simultaneous trades.

## Limits to interpret correctly

- Live venue handshakes and sampled payload compatibility passed on September 10, 2026; see `authenticated-stream-validation.json`. Sustained throughput and research results still require a longer verified-market run. The first bounded observer run experienced event-loop recoveries; the final 47-second run recorded no recoveries. Neither establishes long-term reliability.
- PM-US streams expose displayed top depth with no documented sequence counter. Full replacements and timestamps are checked; recovery uses new subscriptions. Kalshi checks sequences across each subscription, including markets sharing that subscription.
- Book freshness is deliberately conservative: a 2-second default timeout and exchange timestamp check can reject idle but still resting liquidity. Heartbeats do not refresh depth. This can undercount opportunities.
- REST reconciliation is sampled, not atomic with stream updates. Comparisons skip a raced snapshot; mismatches force a fresh stream subscription. Rule metadata is checked every 60 seconds by default, so changes between metadata polls are not instantly known.
- Fuzzy matching never authorizes research. The structured proof service is implemented and tested, but no generic parser is allowed to invent missing settlement/void fields. Most real candidates need manual review.
- Exact integer fee arithmetic is shared. L2 data does not expose individual resting-order fills. Kalshi records a per-level estimate and conservative whole-contract fragmentation bound; PM-US records the cumulative rounded taker upper bound. Unknown coefficients fail closed. Exact collected commission and fractional fragmentation are not known.
- The hedge model assumes an all-or-none fill at the opening price limit. Unwind models partial IOC fills explicitly; residual shares mean P&L is unknown. It does not model partially filled hedges, queue priority, network send latency or venue acknowledgments.
- Capital scenarios allocate equal cash per venue and keep capital locked for the entire observation session. They do not infer settlement payouts or reinvest winnings. Independent theoretical/latency totals must not be mistaken for a realizable reusable-bankroll return.
- Lifetime percentiles measure continuous verified intervals above the configured net thresholds and exclude censored/open intervals. A gross spread can persist after the qualifying interval ends. Missing data does not count as a successful hedge. An unresolved orphan makes expected net profit unavailable.
- Full normalized books and quantity curves can grow quickly. The SQLite writer and calculations run in one process; the event-loop delay gate invalidates feeds when processing falls behind. Throughput and disk growth must be measured on the intended subscription set before increasing coverage. Quantities above 1,000,000 are explicitly rejected, not silently truncated.
- This phase is **not complete** until an actual authenticated observation period produces usable research evidence. The public probe below does not establish absence or presence of arbitrage.

## Validation and actual sample

Run `npm test`, `npx tsc --noEmit --incremental false`, and `npm run build`. See `VALIDATION.md` for recorded results and exact changed files.

`sample-public-probe.json` records an actual public REST sample on September 10, 2026, 16:29:43–16:29:55 UTC: catalog samples of 445 Kalshi and 300 PM-US markets, four retrieved order books, no request errors. No mappings were verified and no authenticated streams were observed. Counts and latency rates therefore cannot answer the strategy research question yet.
