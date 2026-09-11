import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pilotPreflight, pilotPolicy } from "../lib/pilot/preflight.ts";
import { PilotLedger } from "../lib/pilot/ledger.ts";
import { pair, book } from "./research-fixture.ts";
const now = Date.now();
function fixture() {
  const p = pair();
  p.reviewed = true;
  return {
    mapping: {
      id: p.id,
      pair: p,
      status: "MANUAL_VERIFIED",
      active: true,
      reason: null,
      createdAt: now,
      metadataAt: now,
      lastVerifiedAt: now,
      normalized: {},
    },
    a: book("kalshi", p.a.id, 100, now),
    b: book("poly", p.b.id, 100, now),
    aSide: "yes",
    wall: now,
    mono: 100,
    health: {
      streamHealthy: true,
      persistenceHealthy: true,
      eventLoopHealthy: true,
      executionProtocolValidated: true,
      feesValidated: true,
    },
    accounts: {
      kalshi: {
        venue: "kalshi",
        available: 1000000,
        cumulativeSpent: 0,
        reserved: 0,
        reconciledAt: now,
        unresolvedOrders: 0,
        unmatchedContracts: 0,
        occupiedMarkets: [],
      },
      poly: {
        venue: "poly",
        available: 1000000,
        cumulativeSpent: 0,
        reserved: 0,
        reconciledAt: now,
        unresolvedOrders: 0,
        unmatchedContracts: 0,
        occupiedMarkets: [],
      },
    },
  } as any;
}
test("Pilot uses $100 per venue, one contract and buffered two-leg depth", () => {
  const x = fixture();
  const r = pilotPreflight(x);
  assert.equal(r.eligible, true);
  assert.equal(r.quantity, 1);
  assert.equal(r.policy.capitalPerVenue, 1000000);
  assert.equal(r.policy.totalLossLimit, 2000000);
  assert.equal(r.mode, "PILOT_PREFLIGHT_ONLY");
  assert.equal(r.legs.length, 2);
  assert.ok(r.legs.every((l) => l.quantity === 1));
});
test("Pilot blocks unverified rules even when its modeled net edge is positive", () => {
  const x = fixture();
  x.mapping.status = "UNVERIFIED";
  const r = pilotPreflight(x);
  assert.ok(r.modeledNet! > 0);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("RULE_EQUIVALENCE_UNVERIFIED"));
});
test("Pilot refuses thin books and will not substitute the opposite outcome", () => {
  const x = fixture();
  x.b.no = [{ price: 1000, quantity: 3 }];
  assert.ok(pilotPreflight(x).reasons.includes("INSUFFICIENT_BUFFERED_DEPTH"));
  x.b.marketId = "other";
  assert.ok(pilotPreflight(x).reasons.includes("BOOK_IDENTITY_MISMATCH"));
});
test("Pilot walks buffered depth and freezes the worst price in its order plan", () => {
  const x = fixture();
  x.a.yes = [
    { price: 1000, quantity: 3 },
    { price: 2000, quantity: 4 },
  ];
  const r = pilotPreflight(x);
  assert.equal(r.legs[0].limitPrice, 2000);
  assert.ok(r.legs[0].modeledDebit >= 2000);
});
test("Pilot enforces stale books, metadata, account reconciliation and health gates", () => {
  const x = fixture();
  x.a.receivedMono = -2001;
  x.mapping.metadataAt = now - 60001;
  x.accounts.poly.reconciledAt = now - 5001;
  x.health.eventLoopHealthy = false;
  x.health.executionProtocolValidated = false;
  x.health.feesValidated = false;
  const r = pilotPreflight(x);
  for (const reason of [
    "BOOK_NOT_STRICTLY_FRESH",
    "METADATA_REFRESH_REQUIRED",
    "ACCOUNT_RECONCILIATION_REQUIRED",
    "EVENT_LOOP_UNHEALTHY",
    "EXECUTION_PROTOCOL_UNVALIDATED",
    "LIVE_FEE_BOUND_UNVALIDATED",
  ])
    assert.ok(r.reasons.includes(reason));
});
test("Pilot does not replenish lifetime authority from profits or larger account balances", () => {
  const x = fixture();
  x.accounts.kalshi.available = 100000000;
  x.accounts.kalshi.cumulativeSpent = pilotPolicy.capitalPerVenue;
  assert.ok(
    pilotPreflight(x).reasons.includes("VENUE_LIFETIME_BUDGET_EXCEEDED"),
  );
  x.accounts.kalshi.unresolvedOrders = 1;
  assert.ok(pilotPreflight(x).reasons.includes("UNRESOLVED_EXPOSURE"));
});
test("Pilot retains unsupported sports execution exclusion", () => {
  const x = fixture();
  x.mapping.pair.a.category = "Sports";
  assert.ok(
    pilotPreflight(x).reasons.includes("CATEGORY_NOT_EXECUTION_SUPPORTED"),
  );
});
test("Pilot reservations survive restart and unknown submissions cannot be retried", () => {
  const path = join(mkdtempSync(join(tmpdir(), "pilot-")), "pilot.sqlite");
  let l = new PilotLedger(path);
  l.reserve("a", "kalshi", 5000);
  l.markSubmissionUnknown("a");
  l.close();
  l = new PilotLedger(path);
  try {
    assert.equal(l.get("a").state, "SUBMISSION_UNKNOWN");
    assert.throws(() => l.markSubmissionUnknown("a"));
    assert.throws(() => l.reserve("b", "poly", 5000));
    assert.equal(l.reserve("a", "kalshi", 5000).state, "SUBMISSION_UNKNOWN");
    assert.throws(() => l.reserve("a", "kalshi", 6000));
  } finally {
    l.close();
  }
});
test("Order acknowledgment is not a fill and stale or duplicate updates cannot add spend", () => {
  const l = new PilotLedger(":memory:");
  try {
    l.reserve("a", "kalshi", 5000);
    l.markSubmissionUnknown("a");
    const s = {
      revision: 1,
      state: "ACKNOWLEDGED" as const,
      filled: 0,
      debit: 0,
      venueOrderId: "order-a",
    };
    l.reconcile("a", s);
    assert.equal(l.get("a").filled, 0);
    assert.equal(l.reconcile("a", s), false);
    assert.equal(l.reconcile("a", { ...s, revision: 0 }), false);
    assert.throws(() => l.reconcile("a", { ...s, debit: 100 }));
    assert.throws(() => l.reserve("b", "poly", 5000));
  } finally {
    l.close();
  }
});
test("Cancellation racing a partial fill preserves spend and halts new entries", () => {
  const l = new PilotLedger(":memory:");
  try {
    l.reserve("a", "kalshi", 5000);
    l.markSubmissionUnknown("a");
    l.reconcile("a", {
      revision: 1,
      state: "CANCELED",
      filled: 0.5,
      debit: 2000,
      venueOrderId: "order-a",
    });
    assert.equal(l.get("a").filled, 0.5);
    assert.equal(l.get("a").debit, 2000);
    assert.throws(() => l.reserve("b", "poly", 5000));
    assert.throws(() =>
      l.reconcile("a", {
        revision: 2,
        state: "ACKNOWLEDGED",
        filled: 0.5,
        debit: 2000,
        venueOrderId: "order-a",
      }),
    );
  } finally {
    l.close();
  }
});
test("Execution beyond reserved funds trips a persistent halt", () => {
  const l = new PilotLedger(":memory:");
  try {
    l.reserve("a", "kalshi", 5000);
    l.markSubmissionUnknown("a");
    assert.throws(() =>
      l.reconcile("a", {
        revision: 1,
        state: "FILLED",
        filled: 1,
        debit: 5001,
        venueOrderId: "order-a",
      }),
    );
    assert.throws(() => l.reserve("b", "poly", 5000));
  } finally {
    l.close();
  }
});
test("Both pilot legs reserve atomically and confirmed inventory blocks a new pair", () => {
  const l = new PilotLedger(":memory:");
  try {
    assert.throws(() => l.reservePair("bad", { kalshi: 5000, poly: -1 }));
    assert.equal(l.get("bad:kalshi"), undefined);
    l.reservePair("p", { kalshi: 5000, poly: 4000 });
    l.markSubmissionUnknown("p:kalshi");
    l.reconcile("p:kalshi", {
      revision: 1,
      state: "FILLED",
      filled: 1,
      debit: 4900,
      venueOrderId: "k",
    });
    assert.throws(() => l.reservePair("next", { kalshi: 5000, poly: 4000 }));
    l.markSubmissionUnknown("p:poly");
    assert.equal(l.get("p:poly").state, "SUBMISSION_UNKNOWN");
  } finally {
    l.close();
  }
});

test("Long settlement horizons remain eligible when all other checks pass", () => {
  const x = fixture();
  x.mapping.pair.a.closeAt = new Date(now + 31 * 86400000).toISOString();
  assert.equal(pilotPreflight(x).eligible, true);
});

import { pilotExitQuote } from "../lib/pilot/exit.ts";
function exitFixture() {
  const x = fixture();
  x.a.yesBids = [{ price: 6000, quantity: 20 }];
  x.b.noBids = [{ price: 6000, quantity: 20 }];
  return {
    inventory: [
      {
        market: x.mapping.pair.a,
        side: "yes",
        confirmedQuantity: 1,
        soldQuantity: 0,
        entryDebit: 4500,
        reconciledAt: now,
        unresolvedOrders: 0,
      },
      {
        market: x.mapping.pair.b,
        side: "no",
        confirmedQuantity: 1,
        soldQuantity: 0,
        entryDebit: 4500,
        reconciledAt: now,
        unresolvedOrders: 0,
      },
    ],
    books: [x.a, x.b],
    health: x.health,
    wall: now,
    mono: 100,
  } as any;
}
test("Early exit uses executable bids and actual entry costs, never reports realized profit", () => {
  const x = exitFixture(),
    quote = pilotExitQuote(x);
  assert.equal(quote.eligible, true);
  assert.equal(quote.realizedProfit, null);
  x.books[1].noBids = [];
  assert.ok(pilotExitQuote(x).reasons.includes("INSUFFICIENT_EXIT_DEPTH"));
});
test("Early exit rejects fee-negative crossing, stale inventory and partial or unknown fills", () => {
  const x = exitFixture();
  x.inventory.forEach((i: any) => (i.entryDebit = 5990));
  assert.ok(pilotExitQuote(x).reasons.includes("NO_NET_EXIT_PROFIT"));
  for (const patch of [
    { confirmedQuantity: 0.5 },
    { soldQuantity: 1 },
    { unresolvedOrders: 1 },
  ]) {
    const y = exitFixture();
    Object.assign(y.inventory[0], patch);
    assert.ok(
      pilotExitQuote(y).reasons.includes("INVENTORY_REQUIRES_RECONCILIATION"),
    );
  }
  const y = exitFixture();
  y.inventory[0].reconciledAt = now - 6000;
  assert.ok(pilotExitQuote(y).reasons.includes("INVENTORY_STALE"));
});

import { arrivalEvidence } from "../lib/pilot/timing.ts";
test("Delayed arrival retains original limits and distinguishes one-leg exposure", () => {
  const x = fixture(),
    plan = pilotPreflight(x);
  const arrivals = [
    { book: x.a, wall: now + 100, mono: 200, covered: true },
    { book: x.b, wall: now + 250, mono: 350, covered: true },
  ] as any;
  assert.equal(
    arrivalEvidence(x.mapping.pair, plan, arrivals).status,
    "BOTH_DISPLAYED_AVAILABLE",
  );
  assert.equal(
    arrivalEvidence(x.mapping.pair, plan, arrivals).confirmedFills,
    0,
  );
  x.b[plan.legs[1].side] = [{ price: 9999, quantity: 100 }];
  assert.equal(
    arrivalEvidence(x.mapping.pair, plan, arrivals).status,
    "ONE_LEG_ONLY",
  );
  arrivals[1].covered = false;
  assert.equal(
    arrivalEvidence(x.mapping.pair, plan, arrivals).status,
    "INSUFFICIENT_EVIDENCE",
  );
});
test("Delayed arrival does not treat stale books or vanished buffered depth as fills", () => {
  const x = fixture(),
    plan = pilotPreflight(x);
  const arrivals = [
    { book: x.a, wall: now + 2100, mono: 2200, covered: true },
    { book: x.b, wall: now + 2100, mono: 2200, covered: true },
  ] as any;
  assert.equal(
    arrivalEvidence(x.mapping.pair, plan, arrivals).status,
    "INSUFFICIENT_EVIDENCE",
  );
  arrivals.forEach((a: any) => {
    a.wall = now + 100;
    a.mono = 200;
  });
  x.a[plan.legs[0].side] = [{ price: plan.legs[0].limitPrice, quantity: 3 }];
  assert.equal(
    arrivalEvidence(x.mapping.pair, plan, arrivals).status,
    "ONE_LEG_ONLY",
  );
});

test("Pilot rejects an occupied selected market and missing position inspection", () => {
  const x = fixture();
  x.accounts.kalshi.occupiedMarkets = [x.mapping.pair.a.id];
  assert.ok(pilotPreflight(x).reasons.includes("EXISTING_MARKET_POSITION"));
  x.accounts.kalshi.occupiedMarkets = ["unrelated-manual-market"];
  assert.equal(pilotPreflight(x).eligible, true);
  delete x.accounts.kalshi.occupiedMarkets;
  assert.ok(pilotPreflight(x).reasons.includes("INVALID_ACCOUNT_STATE"));
});

test("Paired exits reject expired metadata and unsupported minimum size", () => {
  const x = exitFixture();
  x.inventory[0].market.closeAt = new Date(now - 1).toISOString();
  assert.ok(pilotExitQuote(x).reasons.includes("BOOK_NOT_EXECUTABLE"));
  const y = exitFixture();
  y.inventory[1].market.minQty = 2;
  assert.ok(pilotExitQuote(y).reasons.includes("EXIT_SIZE_UNSUPPORTED"));
});
