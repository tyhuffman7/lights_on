import {test} from 'node:test';import assert from 'node:assert/strict';import {clockUsable,parseNtp} from '../lib/arb/clock-window.ts';import {MakerQueue} from '../lib/arb/maker-evidence.ts';
const clock={minOffsetMs:100,maxOffsetMs:300,measuredAt:1000,measuredMono:0,expiresAt:61000,sources:['fixture']};
const trade={id:'one',marketId:'K',side:'yes' as const,price:4000,quantity:1,at:1900};
test('Clock parser rejects missing, excessive, or unbounded time evidence',()=>{assert.deepEqual(parseNtp('+0.200000 +/- 0.100000 time.example'),{min:100,max:300});for(const s of ['garbage','+3.0 +/- 0.1','+0.2 +/- 0.6'])assert.throws(()=>parseNtp(s));});
test('Calibrated queue accepts a locally future timestamp only when its entire interval is after activation',()=>{
 const q=new MakerQueue('K','yes',4000,1,0,1500,3000,clock);assert.equal(q.consume(trade,1800,800),1);assert.equal(trade.at,1900,'source timestamp preserved');
 const ambiguous=new MakerQueue('K','yes',4000,1,0,1500,3000,clock);assert.equal(ambiguous.consume({...trade,at:1700},1800,800),0);
 const strict=new MakerQueue('K','yes',4000,1,0,1500,3000);assert.equal(strict.consume(trade,1800,800),0);
});
test('Calibration expiry, local clock steps, and uncertain expiry boundaries fail closed',()=>{
 assert.equal(clockUsable(clock,61000,60000),false);assert.equal(clockUsable(clock,1800,600),false);
 const q=new MakerQueue('K','yes',4000,1,0,1500,2000,clock);assert.equal(q.consume({...trade,at:2150},1900,900),0);assert.equal(q.consume(trade,1800,600),0);
});
