import {test} from 'node:test';import assert from 'node:assert/strict';
import {checkSettlements} from '../lib/arb/settlement.ts';
import {initial,enter} from '../lib/arb/ledger.ts';
const pair={id:'p',a:{id:'a',venue:'kalshi'},b:{id:'b',venue:'poly'}};
const q={eligible:true,quantity:10,aSide:'yes',bSide:'no',aFill:{cost:40000,fees:1700},bFill:{cost:50000,fees:1500},reserve:2000};
test('Available payout is credited even when other venue fails',async()=>{const s=await checkSettlements(enter(initial(),pair,q,'one'),async venue=>{if(venue==='poly')throw Error('outage');return {settlement:10000};});assert.equal(s.cash.kalshi,557300);assert.equal(s.cash.poly,447500);assert.equal(s.positions[0].aPayout,100000);assert.equal(s.positions[0].bPayout,undefined);});
test('Already credited legs are not fetched again',async()=>{const s=enter(initial(),pair,q,'one');s.positions[0].bPayout=0;const venues=[];const result=await checkSettlements(s,async venue=>{venues.push(venue);return {settlement:0};});assert.deepEqual(venues,['kalshi']);assert.equal(result.positions[0].status,'settled');});
