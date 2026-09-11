import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PilotLedger } from "../lib/pilot/ledger.ts";
import { FillJournal } from "../lib/pilot/fill-journal.ts";
import {
  reconcileOrderEvidence,
  reservationDebit,
} from "../lib/pilot/order-evidence.ts";
import { encodePilotBuy } from "../lib/pilot/order-wire.ts";
import { pilotExitQuote } from "../lib/pilot/exit.ts";
import { pair, book } from "./research-fixture.ts";
// Synthetic exchange evidence only. No network, credentials or submit transport.
const expected = (venue: "kalshi" | "poly") => ({
  orderId: venue + "-order",
  marketId: venue === "kalshi" ? "Kp" : "Pp",
  side: venue === "kalshi" ? ("yes" as const) : ("no" as const),
  action: "buy" as const,
  quantity: 1,
});
const kFill = {
  fill_id: "k-fill",
  order_id: "kalshi-order",
  ticker: "Kp",
  market_ticker: "Kp",
  side: "yes",
  outcome_side: "yes",
  action: "buy",
  book_side: "bid",
  exchange_index: 0,
  subaccount_number: 0,
  count_fp: "1",
  yes_price_dollars: "0.40",
  no_price_dollars: "0.60",
  fee_cost: "0.02",
};
const kOrder = {
  ...kFill,
  status: "executed",
  initial_count_fp: "1",
  fill_count_fp: "1",
  remaining_count_fp: "0",
  taker_fees_dollars: "0.02",
  maker_fees_dollars: "0",
  taker_fill_cost_dollars: "0.40",
  maker_fill_cost_dollars: "0",
  last_update_time: "2026-09-11T12:00:00Z",
};
const pOrder = {
  id: "poly-order",
  marketSlug: "Pp",
  intent: "ORDER_INTENT_BUY_SHORT",
  outcomeSide: "OUTCOME_SIDE_NO",
  action: "ORDER_ACTION_BUY",
  quantity: 1,
  cumQuantity: 0.5,
  leavesQuantity: 0,
  state: "ORDER_STATE_CANCELED",
  commissionNotionalTotalCollected: { value: "0.01", currency: "USD" },
  lastTransactTime: "2026-09-11T12:00:01Z",
};
const pFill = {
  id: "p-fill-1",
  type: "EXECUTION_TYPE_PARTIAL_FILL",
  order: pOrder,
  lastShares: "0.5",
  lastPx: { value: "0.60", currency: "USD" },
  commissionNotionalCollected: { value: "0.01", currency: "USD" },
};
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "pilot-flow-"));
  let ledger = new PilotLedger(join(dir, "intents.sqlite")),
    journal = new FillJournal(join(dir, "fills.sqlite"));
  ledger.reservePair("entry", { kalshi: 4200, poly: 4100 });
  for (const venue of ["kalshi", "poly"] as const) {
    const e = expected(venue);
    encodePilotBuy(
      {
        venue,
        marketId: e.marketId,
        side: e.side,
        quantity: 1,
        limitPrice: 4000,
      },
      { marketId: e.marketId, tick: 100, minimumQuantity: 1, exchangeIndex: 0 },
      "entry-" + venue,
    );
    ledger.markSubmissionUnknown("entry:" + venue);
    journal.register(venue, e);
  }
  return {
    dir,
    get ledger() {
      return ledger;
    },
    get journal() {
      return journal;
    },
    restart() {
      ledger.close();
      journal.close();
      ledger = new PilotLedger(join(dir, "intents.sqlite"));
      journal = new FillJournal(join(dir, "fills.sqlite"));
    },
    close() {
      ledger.close();
      journal.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
function apply(
  x: ReturnType<typeof fixture>,
  venue: "kalshi" | "poly",
  raw: unknown,
  revision: number,
) {
  const r = reconcileOrderEvidence(
    venue,
    raw,
    expected(venue),
    x.journal.evidence(venue, expected(venue).orderId),
  );
  assert.equal(r.moneyScale, 1000000);
  x.ledger.reconcile("entry:" + venue, {
    revision,
    state: r.state as any,
    filled: r.filled,
    debit: reservationDebit(r),
    venueOrderId: r.orderId,
  });
  return r;
}
test("Restart after one venue fills preserves a canceled partial fill and blocks another entry", () => {
  const x = fixture();
  try {
    x.journal.record("kalshi", "kalshi-order", kFill);
    apply(x, "kalshi", kOrder, 0);
    x.restart();
    assert.throws(() => x.ledger.markSubmissionUnknown("entry:poly"));
    assert.equal(
      x.journal.record("kalshi", "kalshi-order", kFill).inserted,
      false,
    );
    x.journal.record("poly", "poly-order", pFill);
    apply(x, "poly", pOrder, 0);
    assert.equal(x.ledger.get("entry:kalshi").filled, 1);
    assert.equal(x.ledger.get("entry:poly").filled, 0.5);
    assert.equal(x.ledger.get("entry:poly").debit, 2100);
    assert.throws(() =>
      x.ledger.reservePair("next", { kalshi: 1000, poly: 1000 }),
    );
  } finally {
    x.close();
  }
});
test("Two reconciled fills can price an exit but do not manufacture realized profit", () => {
  const x = fixture();
  try {
    x.journal.record("kalshi", "kalshi-order", kFill);
    apply(x, "kalshi", kOrder, 0);
    x.journal.record("poly", "poly-order", pFill);
    x.journal.record("poly", "poly-order", {
      ...pFill,
      id: "p-fill-2",
      commissionNotionalCollected: { value: "0", currency: "USD" },
    });
    const p = apply(
      x,
      "poly",
      { ...pOrder, cumQuantity: 1, state: "ORDER_STATE_FILLED" },
      0,
    );
    assert.equal(p.cashFlowMicros, -410000);
    x.restart();
    assert.equal(x.journal.record("poly", "poly-order", pFill).inserted, false);
    const pairValue = pair(),
      wall = Date.now(),
      a = book("kalshi", "Kp", 100, wall),
      b = book("poly", "Pp", 100, wall);
    a.yesBids = [{ price: 5000, quantity: 100 }];
    b.noBids = [{ price: 5000, quantity: 100 }];
    const quote = pilotExitQuote({
      inventory: [
        {
          market: pairValue.a,
          side: "yes",
          confirmedQuantity: 1,
          soldQuantity: 0,
          entryDebit: 4200,
          reconciledAt: wall,
          unresolvedOrders: 0,
        },
        {
          market: pairValue.b,
          side: "no",
          confirmedQuantity: 1,
          soldQuantity: 0,
          entryDebit: 4100,
          reconciledAt: wall,
          unresolvedOrders: 0,
        },
      ],
      books: [a, b],
      wall,
      mono: 100,
      health: {
        streamHealthy: true,
        persistenceHealthy: true,
        eventLoopHealthy: true,
        executionProtocolValidated: false,
        feesValidated: false,
      },
    });
    assert.ok(quote.modeledNet! > 0);
    assert.equal(quote.eligible, false);
    assert.equal(quote.realizedProfit, null);
    assert.throws(() =>
      x.ledger.reservePair("next", { kalshi: 1000, poly: 1000 }),
    );
  } finally {
    x.close();
  }
});
