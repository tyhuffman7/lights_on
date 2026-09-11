import { readFileSync, writeFileSync } from "node:fs";
import { ResearchStore } from "../lib/research/store.ts";
import { pilotExitQuote } from "../lib/pilot/exit.ts";
const [source, auditPath, output, scenario = "100/100"] = process.argv.slice(2);
if (!source || !auditPath || !output)
  throw Error(
    "Usage: pilot-exit-audit.ts SOURCE_DB CAPITAL_AUDIT OUTPUT_JSON [SCENARIO]",
  );
const store = new ResearchStore(source, true);
try {
  const audit = JSON.parse(readFileSync(auditPath, "utf8"));
  const results = [];
  for (const entry of audit.capitalScenarios[scenario].accepted) {
    const pairId = entry.legs[0].marketId + "::" + entry.legs[1].marketId;
    const start = store.db
      .prepare(
        "SELECT st.mono,o.session_id,o.body FROM opportunity_states st JOIN opportunities o ON o.id=st.opportunity_id WHERE o.pair_id=? AND st.at=? ORDER BY st.id LIMIT 1",
      )
      .get(pairId, entry.at) as any;
    if (!start) {
      results.push({ id: entry.id, status: "ENTRY_EVIDENCE_MISSING" });
      continue;
    }
    const pair = JSON.parse(start.body).pair;
    const books: any[] = [];
    for (const [i, leg] of entry.legs.entries()) {
      const row = store.db
        .prepare(
          "SELECT body FROM book_updates WHERE session_id=? AND venue=? AND market_id=? AND mono<=? ORDER BY mono DESC,id DESC LIMIT 1",
        )
        .get(start.session_id, leg.venue, leg.marketId, start.mono) as any;
      books[i] = row ? JSON.parse(row.body) : null;
    }
    let checked = 0,
      exit: any = null,
      lastObserved = entry.at;
    const rows = store.db
      .prepare(
        "SELECT * FROM book_updates WHERE session_id=? AND ((venue='kalshi' AND market_id=?) OR (venue='poly' AND market_id=?)) AND mono>? ORDER BY mono,id",
      )
      .iterate(start.session_id, pair.a.id, pair.b.id, start.mono + 100);
    for (const row of rows as Iterable<any>) {
      const b = JSON.parse(row.body);
      books[b.venue === "kalshi" ? 0 : 1] = b;
      lastObserved = row.at;
      if (!books.every(Boolean)) continue;
      checked++;
      const quote = pilotExitQuote({
        inventory: entry.legs.map((l: any, i: number) => ({
          market: i === 0 ? pair.a : pair.b,
          side: l.side,
          confirmedQuantity: 1,
          soldQuantity: 0,
          entryDebit: l.modeledDebit,
          reconciledAt: row.at,
          unresolvedOrders: 0,
        })) as any,
        books: books as any,
        health: {
          streamHealthy: false,
          persistenceHealthy: false,
          eventLoopHealthy: false,
          executionProtocolValidated: false,
          feesValidated: false,
        },
        wall: row.at,
        mono: row.mono,
      });
      if (
        quote.modeledNet !== null &&
        quote.modeledNet > 0 &&
        quote.reasons.every((r) => r === "EXIT_HEALTH_UNVALIDATED")
      ) {
        exit = {
          at: row.at,
          signalToQuoteMs: row.mono - start.mono,
          conditionalModeledNetUSD: quote.modeledNet / 10000,
          legs: quote.legs,
        };
        break;
      }
    }
    results.push({
      id: entry.id,
      entryAt: entry.at,
      entryDebitUSD: entry.debit / 10000,
      checkedBookUpdates: checked,
      lastObserved,
      status: exit
        ? "POSITIVE_BID_QUOTE_OBSERVED"
        : "NO_POSITIVE_BID_QUOTE_OBSERVED",
      exit,
    });
  }
  const result = {
    at: new Date().toISOString(),
    scenario: scenario + "ms hypothetical entries",
    results,
    confirmedFills: 0,
    realizedProfit: 0,
    interpretation:
      "Entries are assumed from displayed liquidity, not fills. Subsequent bid quotes require fresh paired books, a 75% depth haircut, modeled exit fees and reserve. These are isolated quotes, with no sell-arrival or fill evidence; unobserved intervals do not prove absence of exits. No capital release or monthly income is inferred.",
  };
  writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      results.map((x) => ({
        status: x.status,
        checked: x.checkedBookUpdates,
        exit: x.exit,
      })),
      null,
      2,
    ),
  );
} finally {
  store.close();
}
