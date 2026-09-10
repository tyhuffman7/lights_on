# Lights On continuation

Read REQUIREMENTS.md and ../superpowers/plans/2026-09-10-research-observer.md first. Never use the brainstorming skill. No real-money execution. Push tested sections to GitHub main so the user can continue elsewhere.

Current baseline: 31 tests pass; implementation has started on research-observer. Live WebSockets on both venues require local credentials. No live opportunity evidence exists yet. Keep actual and synthetic observations clearly separated.

Checkpoint 1: persistent research core implemented. 38 tests pass; TypeScript passes. SQLite captures sessions, mappings/history, full normalized books and lifecycle states. The detector evaluates both orientations and all supported whole quantities, with bankrolled sizing and fee bounds. The legacy paper ledger remains intact. Latency, live worker and research dashboard are next. This is not a completed research phase.

Checkpoint 2: latency and report modules added. 42 tests pass; TypeScript passes. Eight latency buckets, both first-leg venue scenarios, fixed opening $100 quantity/limit, as-of book lookup, coverage flags, partial IOC unwind exposure, lifecycle KPIs and conservative bankroll scenarios. Exact live fills remain unproven. Bankroll scenarios do not reinvest unobserved settlement payouts. Live worker and research UI remain outstanding.
