import type { ResearchStore } from "./store.ts";
import { firstQualifying } from "./latency.ts";
export function opportunityRows(
  s: ResearchStore,
  session: string,
  offset = 0,
  limit = 100,
) {
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 1000
  )
    throw new Error("Invalid pagination");
  return (
    s.db
      .prepare(
        "SELECT * FROM opportunities WHERE session_id=? ORDER BY first_mono,id LIMIT ? OFFSET ?",
      )
      .all(session, limit, offset) as any[]
  ).map((op) => {
    const opening = JSON.parse(op.body),
      qualified = firstQualifying(s, op.id);
    const first = s.db
      .prepare(
        "SELECT body FROM opportunity_states WHERE opportunity_id=? ORDER BY mono,id LIMIT 1",
      )
      .get(op.id) as any;
    const last = s.db
      .prepare(
        "SELECT body FROM opportunity_states WHERE opportunity_id=? ORDER BY mono DESC,id DESC LIMIT 1",
      )
      .get(op.id) as any;
    const e = qualified?.e ?? JSON.parse(first.body),
      end = JSON.parse(last.body),
      q = e.best ?? e.bestGross;
    const latency = s.db
      .prepare(
        "SELECT first_venue,latency_ms,status FROM latency_tests WHERE opportunity_id=?",
      )
      .all(op.id) as any[];
    const labels = qualified
      ? [
          "VERIFIED ARBITRAGE",
          ...(q?.feeProfit > 0 ? ["FEE-POSITIVE"] : []),
          ...(latency.some((x) => x.status === "SURVIVED")
            ? ["LATENCY-SURVIVABLE"]
            : []),
        ]
      : ["RAW DISCREPANCY", ...(!e.verified ? ["UNVERIFIED CANDIDATE"] : [])];
    return {
      id: op.id,
      mode:
        s.db.prepare("SELECT mode FROM sessions WHERE id=?").get(session)
          ?.mode ?? "unknown",
      firstSeenAt: op.first_seen_at,
      pair: opening.pair.a.title,
      orientation: op.orientation,
      labels,
      priceBasis: qualified
        ? "modeled executable VWAP"
        : "unverified observed-depth estimate",
      kalshiPrice: q?.aVwap ?? null,
      polymarketUSPrice: q?.bVwap ?? null,
      quantity: q?.quantity ?? null,
      depth: q ? { kalshi: q.aFill.levels, poly: q.bFill.levels } : null,
      grossEdge: q?.grossProfit ?? null,
      fees: q?.fees ?? null,
      feeUpper: q?.feeUpper ?? null,
      reserve: q?.reserve ?? null,
      netEdge: qualified ? (q?.profit ?? null) : null,
      roi: qualified ? (q?.roi ?? null) : null,
      lifetimeMs: op.duration_ms,
      survival: latency,
      bankroll100Profit:
        qualified &&
        e.bankroll["1000000"]?.profit >= opening.config.minProfit &&
        e.bankroll["1000000"]?.roi >= opening.config.minRoi
          ? e.bankroll["1000000"].profit
          : null,
      status: op.status,
      reasons: end.reasons,
    };
  });
}
export function opportunityDetail(
  s: ResearchStore,
  session: string,
  id: string,
  offset = 0,
  limit = 100,
) {
  if (
    !s.db
      .prepare("SELECT id FROM opportunities WHERE id=? AND session_id=?")
      .get(id, session)
  )
    throw new Error("Unknown opportunity");
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 1000
  )
    throw new Error("Invalid pagination");
  const rows = s.db
    .prepare(
      "SELECT id,at,mono,a_book_id,b_book_id,body FROM opportunity_states WHERE opportunity_id=? ORDER BY mono,id LIMIT ? OFFSET ?",
    )
    .all(id, limit, offset) as any[];
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    mono: r.mono,
    evaluation: JSON.parse(r.body),
    mappingHistory: s.db
      .prepare(
        "SELECT at,body FROM mapping_history WHERE pair_id=(SELECT pair_id FROM opportunities WHERE id=?) AND at<=? ORDER BY at,id",
      )
      .all(id, r.at)
      .map((h: any) => ({ at: h.at, mapping: JSON.parse(h.body) })),
    latency: s.db
      .prepare(
        "SELECT first_venue,latency_ms,status,body FROM latency_tests WHERE opportunity_id=?",
      )
      .all(id),
    books: [r.a_book_id, r.b_book_id].map((id) => {
      const row = s.db
        .prepare("SELECT body FROM book_updates WHERE id=?")
        .get(id) as any;
      return row ? JSON.parse(row.body) : null;
    }),
  }));
}
export function opportunityCSV(rows: ReturnType<typeof opportunityRows>) {
  const columns = [
    "id",
    "mode",
    "firstSeenAt",
    "pair",
    "orientation",
    "labels",
    "priceBasis",
    "kalshiPrice",
    "polymarketUSPrice",
    "quantity",
    "grossEdge",
    "fees",
    "feeUpper",
    "reserve",
    "netEdge",
    "roi",
    "lifetimeMs",
    "survival",
    "bankroll100Profit",
    "status",
    "reasons",
  ] as const;
  const cell = (value: unknown) => {
    let s =
      value === null
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    if (typeof value === "string" && /^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    [
      columns.join(","),
      ...rows.map((row) => columns.map((k) => cell(row[k])).join(",")),
    ].join("\r\n") + "\r\n"
  );
}
