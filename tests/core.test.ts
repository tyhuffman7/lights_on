import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fee, calculate } from '../lib/arb/core.ts';

test('Kalshi rounds a one-contract fractional-cent fee upward', () => {
  assert.equal(fee(1, 5000, 700, 'ceil'), 200);
});
test('Polymarket US July schedule at 50 cents costs $1.50 per 100 contracts', () => {
  assert.equal(fee(100, 5000, 600, 'even'), 15000);
});
test('Polymarket ties round to an even cent', () => {
  assert.equal(fee(1, 5000, 200, 'even'), 0);
  assert.equal(fee(1, 5000, 600, 'even'), 200);
});
test('A gross two-cent gap is rejected after fees and execution reserve', () => {
  assert.ok(calculate(4900, 4900, 10).profit < 0);
});
test('A ten-cent gap yields $0.58 net on ten pairs after fees and reserve', () => {
  const x = calculate(4000, 5000, 10);
  assert.equal(x.cost, 90000);
  assert.equal(x.fees, 3200);
  assert.equal(x.profit, 5800);
});
test('Invalid prices and quantities never silently produce profit', () => {
  assert.throws(() => calculate(NaN, 5000, 5));
  assert.throws(() => calculate(2000, 5000, -1));
});
