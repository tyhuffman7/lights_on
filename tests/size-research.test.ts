import { test } from "node:test";
import assert from "node:assert/strict";
import { pair, book } from "./research-fixture.ts";
import { affordableSizes } from "../lib/pilot/size-research.ts";
test("Research sizing detects fee amortization while respecting buffered depth and budget", () => {
  const p = pair(),
    wall = Date.now(),
    a = book("kalshi", p.a.id, 100, wall),
    b = book("poly", p.b.id, 100, wall);
  a.yes = [{ price: 4500, quantity: 8 }];
  b.no = [{ price: 5000, quantity: 8 }];
  const q = affordableSizes(p, a, b, "yes", wall, 100);
  assert.equal(q.length, 2);
  assert.equal(q[0].modeledNet, 0);
  assert.equal(q[1].modeledNet, 100);
  assert.equal(q[1].eligible, false);
  assert.equal(q[1].debit, 19700);
  a.yes[0].quantity = 100;
  b.no[0].quantity = 100;
  assert.ok(
    affordableSizes(p, a, b, "yes", wall, 100).every(
      (q) => q.debit <= 100000 && q.quantity <= 10,
    ),
  );
  p.b.minQty = 0;
  assert.deepEqual(affordableSizes(p, a, b, "yes", wall, 100), []);
});

test("Full pilot research keeps a cash reserve independently at each venue", () => {
  const p = pair(),
    wall = Date.now(),
    a = book("kalshi", p.a.id, 100, wall),
    b = book("poly", p.b.id, 100, wall);
  a.yes = [{ price: 9000, quantity: 2000 }];
  b.no = [{ price: 500, quantity: 2000 }];
  const sizes = affordableSizes(p, a, b, "yes", wall, 100, true);
  assert.ok(sizes.some((q) => q.quantity > 10));
  assert.ok(
    sizes.every(
      (q) =>
        q.legs.every((l) => l.modeledDebit <= 900000) && q.debit <= 1800000,
    ),
  );
});
