# Promotion certificate checkpoint — October 1, 2026

The only basis-promotion path is `promotionCertificate`, consumed by `paperSettlement`. Neither canonical discovery keys nor `assessment.normalOutcomeMatched` can bypass it. Each certificate carries required dimensions, normalized left/right values, their native evidence, the equality rule, unknown/conflicting fields, exceptional settlement branches, and its decision. Known conflict wins over unknown evidence; unknown required evidence stays unresolved; only complete equality promotes. Strict equivalence is never inferred. Broad discovery and route generation are unchanged.

| Family | Required ordinary dimensions (in addition to family and orientation) |
|---|---|
| Season/team wins | Team, competition, statistic, comparator, integer-normalized threshold, units, season, regular-season period, team scope, counted games, conditions |
| Qualification | Participant, competition, advancement metric, season, exact reached stage, participant scope, settlement scope, conditions |
| Championship | Participant, competition, champion predicate, season, championship level, participant scope, settlement scope, conditions |
| Player statistical leader | Player, competition, single affirmative statistic, maximum/leader predicate, season, period, player/team scope, counted scope, conditions |
| Player statistic | Player, fixture, competition, metric, comparator/threshold/units, date, period, scope, conditions |
| Sports awards | Nominee, award event, award category, winner/finalist predicate, year, conditions |
| Ceremony/list awards | Nominee/work, native event/category, ceremony/year, outcome, plus exact canonical ordinary fields |
| Charts | Artist/work, chart, content type, rank, measurement window, geography; creator required for work charts; explicit artist-role differences cannot disappear |
| Generic any-work chart | Artist, chart/rank/content, artist/work scope, credit role, start/end measurement bounds, conditions |
| Political election/nomination | Person/cohort, office/event predicate, outcome, trigger/action, ordinal, cycle/window, geography, scope, conditions |
| Office departure | Person, departure predicate, office-holder scope, actual/announced trigger, ordinal, cohort and explicit VP/OSTP membership, start/end windows, conditions |
| IPO/model release | Named issuer/model and ordinary event, date, exact deadline evidence, conditions; date-only normalization is insufficient |
| Reality placement/economic releases/game totals/spreads | Supported exact canonical grammar fields remain required individually; fixture additionally required for game totals/spreads |

Unknown family has no positive profile. Complement orientation requires separate native two-participant winner proof, and an explicit regulation draw blocks opposite-winner exhaustiveness. Positive profiles do not establish identical exceptional settlement payouts, fee confidence, eligibility or execution admission.

The parser now separates the statistic from Champions League context, including goals/assists/shots and qualified football yard/attempt/touchdown/reception metrics. Multiple recognized primary statistics are uncertain. Unknown leader statistic remains a leader family with missing metric; it cannot become a championship. Tournament qualifier-count scope also requires native evidence. Championship winner profiles retain named conference levels, but the qualification stage branch does not reliably retain them: post-stop controls expose a false-promotion path (see RESULTS.md). Generic “wins … season” no longer means a team win count. No exact market-ID exclusions.

## Retained review and certificate inspection

The retained replay contains the previous 120 enriched rows plus all 120 latest reviewed rows. Frozen labels and native clauses are preserved; correlated repetitions are not independent accuracy samples. All 31 original basis rows remain basis. All three new UCL goals/assists failures reject. Zero false promotions and zero legitimate rejections. The two Anthropic IPO rows and one Grok release row move from prior promotion to unresolved because exact clock/deadline boundaries are not affirmatively bound. Eighteen prior confirmed-unresolved ordinary references remain unresolved: parent/contract context or positive predicate evidence is missing. No invented negative labels replace those references.

Agent manually inspected representative certificates across seven promoted families: Nebraska >=7/over6.5 regular-season wins; Dario Amodei TIME 2026; Anaheim Ducks 2026–27/2027 Western Conference Finals; Texas Tech final qualification with recorded native season parent context; Robert Pattinson Best Actor/99th Academy Awards; Derrick Henry 2026 regular-season rushing-yard leader; Taylor Brown exact third place/Big Brother season28. Each native clause supports the normalized values, each required field has evidence, and exceptional branches remain explicit. These are agent inspections, not independent human review. Every retained basis row emits a full certificate in the replay JSON.

## Predeclared fresh validation

After retained tests and GitHub correctness CI pass, freeze all runtime sources and existing paper policy. Run exactly one new 1,800-second observation after catalog preparation, with a bounded supervisor, preserving $50 simulated capital/venue, $5 paired commitment, max 10 contracts, 2s freshness and existing confirmation settings. Do not tune during or after the window. No recovery work.

After collection stops, select the strongest positive normal-fee modeled net for each distinct route/orientation. Review top 50 fresh executable promoted confirmations (all if fewer); top 30 fresh executable confirmed unresolved; and top 30 economically strongest rejected nominal candidates. Rejected nominal rows can be stale/unconfirmed and must be labeled. Review native propositions before accepting certificates, keep reference rationale and missing dimensions, publish separate matrices. No post-window classifier replay can replace frozen predictions. Success requires >=98% precision, no obvious category/metric/event mismatch and zero legitimate reviewed rejections; no promoted sample means insufficient validation. Report strict candidates, exact quote economics and latency against prior baseline. Keep all collection stopped at completion and update draft PR #22 only.

## Post-stop design finding

The fresh top 50 actual pairs all match, but two frozen-runtime synthetic negative controls falsely promote Conference USA final qualification versus Mountain West and national finals. Required field presence is insufficient when normalization erases material competition/event identity. This design is not validated; [RESULTS.md](RESULTS.md) preserves the failed checkpoint. The required qualification fields above remain the intended requirement, not a claim that the current extractor soundly implements it. No source changes or further collection follow this run.
