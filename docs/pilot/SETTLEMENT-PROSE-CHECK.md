# NFL settlement prose validation — September 12, 2026

The NFL player-yards diagnostic previously checked player names and thresholds against rule prose, but accepted the game teams and date from normalized metadata. Conflicting prose could therefore receive an ordinary-outcome match. It also allowed both venues' prose to agree on a statistic that contradicted the normalized statistic.

The diagnostic now parses and checks both rule sentences against the normalized teams, game date and statistic. League-scoped aliases remain supported. Unsupported templates fail closed. This applies to passing, receiving and rushing yards; it is not a one-team exception.

Regression coverage first reproduced a conflicting date being accepted, then passed after the fix. It checks conflicting teams, dates and statistics at either venue, mutually consistent prose that contradicts metadata, rejection of conditional approval creation, and Bills/Texans aliases. Full suite: 196 tests passed. TypeScript check passed. No live collector was running during verification.

A read-only rerun against 1,709 saved active mappings produced unchanged diagnostic counts: 898 conditional ordinary matches, 809 unsupported profiles and 2 conflicts. No existing candidate was newly approved or invalidated. The selected historical session, 6fe361a3-7b5e-4f03-b5d3-93390779285c, still contains zero positive research states. No new live observation or fills occurred in this check.

Strict settlement equivalence remains unresolved. In the reviewed football families, an ordinary result match does not establish complementary exceptional payouts. The existing diagnostic records postponement and independently determined fair-price settlement risks. This patch does not remove those risks, approve conditional paper trading, enable real orders, or demonstrate profitability.

Signing is deferred at the user's request because they cannot approve 1Password at their PC. Changes remain local and uncommitted; no signing configuration was changed.
