# Candidate confirmation checkpoint

The completed September 21 baseline is preserved. Its 2.63% measures strict freshness passes, not connection uptime, and its hardcoded `qualifies:false` was not an opportunity-discovery metric.

The existing screen now has `confirmation-prepare` / `confirmation-observe` modes. This checkpoint reuses the previous category-neutral selection, refreshes each unique market once using existing adapters and matcher, and excludes only unavailable, closed or no-longer-matching routes with recorded reasons. It does not repeat catalog discovery or silently filter horizon, same-day, category, settlement review, cash-cap or strategy exclusions.

## Separate facts

Every price row reports independently:

- **Data validity:** sequenced/reconstructed book, market open state, feed health, processing backlog and clock checks. Quiet prices can be usable for discovery while still requiring confirmation.
- **Positive exchange-net economics:** displayed depth minus conservative fee bounds, regardless of trading disablement or policy admission.
- **Settlement equivalence:** a concrete completed review or explicitly unresolved/unreviewed. No automatic promotion from matching.
- **Additional policy admission:** historical risk, cash and horizon reasons remain visible without deleting economic evidence.
- **Trading authorization:** always false. There are no order or ledger calls. Confirmed displayed depth is not a fill or atomic cross-venue execution.

Money uses 1/10,000 USD. Quantity is the largest whole amount up to 10 available on both sides, respecting venue minimums. The ten-contract observation cap bounds exposure/work; it is not chosen to achieve positive economics. Historical $10/$40 policy limits do not constrain price discovery. Once an interval starts, its quantity is fixed through confirmation; insufficient later depth fails rather than shrinking the order. Fee bounds retain the baseline whole-contract cent-precision Kalshi assumption and PM-US cumulative-order ceiling. Unknown account classification/fractional fragmentation remain explicit. A 2-cent/contract additional risk allowance and separate 1-cent Kalshi / 5-cent PM recovery cash reservations remain unchanged. Recovery reservation is not an expense. $50/venue simulated capital is a separate policy comparison, not a funding or trading instruction.

## Feed semantics and confirmation

The [Kalshi snapshot format](https://docs.kalshi.com/websockets/orderbook-updates) has no required exchange timestamp. Snapshots preserve null exchange time and record local receipt, processing availability and snapshot receipt separately. Deltas retain exchange time and are rejected for discovery when delayed more than two seconds or untimed. Sequence gaps invalidate the existing BookCache. Disconnects stop the affected connection without restart. Any queued ingress, processing delay above 250 ms, closed state, or local wall/monotonic drift above one second prevents confirmation. Heartbeats indicate connection liveness only and never change price or snapshot timestamps.

[PM-US market-data messages](https://docs.polymarket.us/api-reference/websocket/markets) contain full books and a `transactTime`. The latter is preserved as the exchange's last market-data transaction, not fabricated as snapshot-generation time. An old value alone does not establish stale current depth. Quiet retained books remain explicitly unconfirmed until a new supported request obtains sufficient evidence.

For a positive taker/taker interval, the worker concurrently requests a supported Kalshi `get_snapshot` on the existing sequenced subscription, a [PM-US REST book](https://docs.polymarket.us/api-reference/markets/get-market-book), and Kalshi current market metadata to verify active status and unchanged primary terms. The requested snapshot must have a later sequence and transport receipt after the request; one request is outstanding at a time. Full public responses remain local, with request/response/processing times, selected cache headers and hashes retained. The Kalshi response has no request-ID echo; attribution is bounded by one outstanding request, exact market/subscription, sequence and request-time checks, not an invented ID.

PM-US book responses were observed with `Cache-Control: public, max-age=30`. A no-cache request alone is not accepted as proof. Cache HIT/STALE/UPDATING, positive Age, missing current HTTP Date, or unknown cache provenance fail confirmation. EXPIRED/MISS/REVALIDATED/DYNAMIC/BYPASS plus current Date and no positive Age are accepted as bounded proxy/origin-response evidence, not proof of an uncached internal exchange pipeline. Requests use the documented endpoint without cache-busting query parameters. Missing evidence stays FAILED, never zero surplus.

Confirmation keeps the same side, pair and quantity and reprices the newest usable Kalshi book and the latest PM representation available after both responses. An adverse intervening update replaces the earlier favorable quote. A REST representation older than an already-observed stream or equal-time conflicting book cannot establish survival. Cross-venue response separation and oldest confirmation age must each be <=2 seconds; response timeout is 1.5 seconds. Original prices and original timestamps are never overwritten. Results are EDGE_SURVIVED, EDGE_DISAPPEARED or FAILED with reasons; survival describes displayed fee-bound prices only.

## Frozen finite observation

One 30-minute supervised run, no automatic restart. At most the baseline's 60 routes; updates are coalesced for 250 ms and only dependent pairs are repriced. One-second health checks invalidate broken connections; they do not resample every price. Distinct positive intervals open on nonpositive/invalid-to-positive transitions, keep their identity across repeated updates/confirmation attempts, close on observed edge loss or invalid data, and are right-censored at stop. These are observation intervals, not proof of continuous tradability between updates. The 2,000-interval cap is reported if reached.

At most 120 confirmation attempts, one in flight, at least two seconds between starts globally and 35 seconds per candidate (longer than the observed 30-second cache TTL). Two concurrent GETs go to different hosts, at most 0.5 requests/second per host, below published [PM-US 20 requests/second](https://docs.polymarket.us/api-reference/rate-limits) and Kalshi default basic read budgets. No immediate retry follows a failed attempt; the next bounded attempt remains subject to the same cooldown and cap. FIFO by oldest attempt avoids economic retuning or one candidate monopolizing confirmation. After the attempt budget, detection continues and unconfirmed intervals remain explicit.

## Bounded contract review

Exactly one concrete historically positive-after-fee pair is reviewed in this checkpoint (below the three-pair maximum): `KXAOCRUN-28-27JAN01` / `cranc-uspres28-12-31-2026-aleoca`. [Completed clause comparison](aoc-contract-review-20260921.json) returns **UNRESOLVED**, not “no profile.” Both concern an AOC 2028 presidential announcement including nomination, but issuance windows, authorized representatives, source precedence, date-only versus explicit ET cutoff, conflicting Kalshi expiration metadata and exceptional payouts are not proven equivalent. Review hashes bind the result to those exact normalized terms. Other positive candidates remain UNRESOLVED / NOT_IN_BOUNDED_CONTRACT_REVIEW; this is not a universal review framework.

The review uses current primary market/series responses, RUN.pdf pp1–2, and Polymarket US's September 14 Rulebook 10.3–10.5. Kalshi's incorporated general rulebook exception provisions were not fully reconciled, and the deadline interpretation requires binding clarification. Missing evidence is specific and recorded. No discretionary exceptional payout is assumed to hedge.

## Commands and evidence

Use Node 22.23.2. These commands document this single authorization, not a future rerun:

```sh
node --experimental-strip-types worker/executable-screen.ts confirmation-prepare OUTPUT_DIR BASELINE_OUTPUT_DIR
node scripts/confirmation-launch.mjs OUTPUT_DIR ENV_FILE
```

Preparation freezes source hashes, review hashes, policy, refreshed pairs and subscription IDs. The launcher reuses the existing supervisor; both launcher and worker are single-use. Keep raw `evidence.ndjson`, credentials and any databases local. Publish only code/tests/docs and sanitized derived classification, interval, confirmation and review summaries. Baseline report files remain unchanged.
