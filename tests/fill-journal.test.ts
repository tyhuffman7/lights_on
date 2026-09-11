import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FillJournal } from "../lib/pilot/fill-journal.ts";
const expected = {
  orderId: "bot-order",
  marketId: "fixture",
  side: "yes" as const,
  action: "buy" as const,
};
const raw = {
  id: "fill-a",
  type: "EXECUTION_TYPE_PARTIAL_FILL",
  order: {
    id: "bot-order",
    marketSlug: "fixture",
    intent: "ORDER_INTENT_BUY_LONG",
    outcomeSide: "OUTCOME_SIDE_YES",
    action: "ORDER_ACTION_BUY",
  },
  lastShares: "0.50",
  lastPx: { value: "0.40", currency: "USD" },
  commissionNotionalCollected: { value: "0.01", currency: "USD" },
};
test("Fill journal preserves deduplication and ownership across restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "lights-fills-")),
    path = join(dir, "fills.sqlite");
  let journal = new FillJournal(path);
  try {
    assert.throws(() => journal.record("poly", "bot-order", raw));
    assert.throws(() => journal.totals("poly", "bot-order"));
    journal.register("poly", expected);
    journal.register("poly", expected);
    assert.throws(() =>
      journal.register("poly", { ...expected, marketId: "other" }),
    );
    assert.equal(
      journal.record("poly", "bot-order", raw).cashFlowMicros,
      -210000,
    );
    journal.close();
    journal = new FillJournal(path);
    assert.equal(journal.record("poly", "bot-order", raw).inserted, false);
    const totals = journal.record("poly", "bot-order", {
      ...raw,
      id: "fill-b",
    });
    assert.equal(totals.quantity, 1);
    assert.equal(totals.cashFlowMicros, -420000);
    assert.equal(totals.orderCompletionKnown, false);
    assert.throws(() =>
      journal.record("poly", "bot-order", { ...raw, lastShares: "0.25" }),
    );
    assert.equal(journal.totals("poly", "bot-order").quantity, 1);
    assert.throws(() => journal.record("kalshi", "bot-order", raw));
  } finally {
    journal.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
