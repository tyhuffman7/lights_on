# Future execution boundary — design only

This repository's research worker has no order client or trading endpoint. `PAPER_RESEARCH` cannot be switched into live execution by configuration. Research verification, displayed depth, simulated fills and favorable latency tests do not authorize an order.

If execution is separately authorized in a later project, the exchange order and fill APIs must be authoritative. A local intent, queued request, HTTP success, order ID or acknowledgment is not a fill. Each venue needs an independent reconciliation ledger keyed by durable intent and venue order/fill IDs, with idempotent recovery after timeout and restart. Query authoritative status before retrying an ambiguous submission.

States must distinguish not submitted, submission unknown, acknowledged, partially filled, filled, canceled, rejected and unresolved. A two-leg hedge succeeds only after both venues confirm the required matched fills. Different filled quantities produce explicit unmatched inventory; a cancellation acknowledgment does not erase fills that raced it. Unknown quantities/prices/commissions keep realized P&L unknown.

Record Kalshi-first and Polymarket-US-first separately. Reconcile fees and funds on each venue; do not infer a second-leg fill from the first leg or infer spendable proceeds from a settlement prediction. Partial or orphan positions require separately authorized risk handling with explicit limits and durable reconciliation. This document adds none of those capabilities.
