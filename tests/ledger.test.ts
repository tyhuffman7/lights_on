import {test} from 'node:test';import assert from 'node:assert/strict';
import {initial,totals,enter,settle} from '../lib/arb/ledger.ts';
const pair={id:'p',a:{venue:'kalshi'},b:{venue:'poly'}};
const quote={eligible:true,quantity:10,aSide:'yes',bSide:'no',aFill:{cost:40000,fees:1700},bFill:{cost:50000,fees:1500},cost:90000,fees:3200,reserve:2000,payout:100000,profit:4800};
test('Initial cash is exactly $100 split across venues',()=>assert.equal(totals(initial()).cash,1000000));
test('Entry debits both venues and does not book pending profit',()=>{const x=enter(initial(),pair,quote,'one');assert.equal(x.cash.kalshi,457300);assert.equal(x.cash.poly,447500);assert.equal(totals(x).realized,0);assert.equal(totals(x).cash+totals(x).committed,1000000)});
test('Duplicate entry is rejected',()=>assert.throws(()=>enter(enter(initial(),pair,quote,'one'),pair,quote,'one')));
test('Settlement is idempotent and cannot release the other venue cash early',()=>{let s=enter(initial(),pair,quote,'one');s=settle(s,'one',10000,null);assert.equal(s.cash.kalshi,557300);assert.equal(s.cash.poly,447500);assert.equal(s.positions[0].status,'open');s=settle(s,'one',10000,10000);assert.equal(s.positions[0].status,'settled');assert.equal(totals(s).realized,4800);assert.equal(totals(s).equity,1004800);assert.deepEqual(settle(s,'one',10000,10000),s)});
test('Negative cash and ineligible quotes are rejected',()=>{assert.throws(()=>enter({...initial(),cash:{kalshi:0,poly:500000}},pair,quote,'one'));assert.throws(()=>enter(initial(),pair,{...quote,eligible:false},'one'))});
