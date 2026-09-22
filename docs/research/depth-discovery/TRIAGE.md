# Bounded primary-term triage

Only the three strongest new requested-book confirmed-positive routes were reviewed. All three are **INCOMPATIBLE** under the retrieved predicates. The arithmetic assumes complementary $1 payouts; these mismatches invalidate that assumption. No arbitrage, fill or realized profit is established. Status, horizon/cash policy and trading authorization remain separate blockers.

All six normalized contract metadata hashes matched the frozen catalogue when re-fetched after observation. Public source bodies and the PDF stay in local evidence; only references, hashes and paraphrases are published.

## 1. KXTOPARTIST-26B-BAD::ccrc-sptfy-1-artst-us-yr-2026-badbun

**INCOMPATIBLE**

- Kalshi has an unqualified annual most-streamed-artist predicate; its TOPARTIST document links Spotify’s global annual report. PM-US expressly uses the Top Artists in the US ranking. These are different geographic rankings.
- The global reading of Kalshi is an inference from its unqualified payout wording and linked primary report; the retrieved Kalshi terms contain no US-only qualifier. The PDF calls its access instructions nonbinding.
- Counterexample for the selected NO + YES legs: Bad Bunny ranks first globally but not first in the US; both purchased predicates are false.

Primary sources: [kalshi contract](https://external-api.kalshi.com/trade-api/v2/markets/KXTOPARTIST-26B-BAD), [poly contract](https://gateway.polymarket.us/v1/market/slug/ccrc-sptfy-1-artst-us-yr-2026-badbun), [contract specification](https://assets.kalshi.com/contract_terms/TOPARTIST.pdf), [Spotify global report](https://newsroom.spotify.com/2023-11-29/top-songs-artists-podcasts-albums-trends-2023/).

## 2. KXTOPARTIST-26B-DRA::ccrc-sptfy-1-artst-us-yr-2026-drake

**INCOMPATIBLE**

- The same unqualified/global-versus-US ranking mismatch applies to Drake. PM-US expressly uses the US Wrapped ranking, even when released before calendar-year end.
- Kalshi’s global scope is inferred from its unqualified criterion and linked global report, not an explicit word added to the binding PDF. There is no retrieved US-only alignment.
- Counterexample for the selected YES + NO legs: Drake ranks first in the US but not globally; both purchased predicates are false.

Primary sources: [kalshi contract](https://external-api.kalshi.com/trade-api/v2/markets/KXTOPARTIST-26B-DRA), [poly contract](https://gateway.polymarket.us/v1/market/slug/ccrc-sptfy-1-artst-us-yr-2026-drake), [contract specification](https://assets.kalshi.com/contract_terms/TOPARTIST.pdf), [Spotify global report](https://newsroom.spotify.com/2023-11-29/top-songs-artists-podcasts-albums-trends-2023/).

## 3. KXISRDEFMIN-30-BNET::mlaec-isrpol-pm-2026-10-27-bennet

**INCOMPATIBLE**

- Kalshi requires Benjamin Netanyahu to become the first Defense Minister in the relevant new government, reported by The Times of Israel before October 28, 2030. PM-US requires him to become Prime Minister and sources the outcome from the Government of Israel. Holding the two offices is not equivalent.
- Counterexample for the selected YES + NO legs: Netanyahu becomes Prime Minister while somebody else holds Defense; both purchased predicates are false.
- Both actual titles/predicates name Netanyahu despite the opaque PM-US slug ending in bennet. No name mismatch is inferred from that slug. Source and reporting-cutoff differences add blockers; displayed close dates are not treated as identical payout deadlines.

Primary sources: [kalshi contract](https://external-api.kalshi.com/trade-api/v2/markets/KXISRDEFMIN-30-BNET), [poly contract](https://gateway.polymarket.us/v1/market/slug/mlaec-isrpol-pm-2026-10-27-bennet), [contract specification](https://assets.kalshi.com/contract_terms/REPORTTOPIC.pdf).

No fourth case was reviewed. AOC remains an unresolved reference case; its review was not expanded. The other new confirmed-positive price comparisons remain unreviewed, not settlement-equivalent.

One next research action: add narrow predicate-conflict regressions/exclusions for these Spotify geography and Israeli office-role mismatches before any separately authorized discovery run. The matcher was not changed in this checkpoint.
