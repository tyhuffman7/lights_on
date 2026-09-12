import {test} from 'node:test';import assert from 'node:assert/strict';
import {MakerActivity,makerActivityScore} from '../lib/arb/maker-activity.ts';
const print={id:'one',marketId:'K',side:'yes' as const,price:4000,quantity:5,at:10000};
test('Activity counts only distinct recent prints at executable prices on the correct side and market',()=>{
 const a=new MakerActivity();a.observe(print,10000);a.observe(print,10001);
 a.observe({...print,id:'other-side',side:'no'},10000);a.observe({...print,id:'other-market',marketId:'Q'},10000);
 a.observe({...print,id:'expensive',price:5000},10000);
 assert.equal(a.volume('K','yes',4000,10000),5);assert.equal(a.volume('K','yes',3999,10000),0);
 assert.equal(a.volume('K','yes',4000,70000),0);
});
test('Activity rejects stale and excessive future timestamps; limited clock lead is ranking only',()=>{
 const a=new MakerActivity();a.observe({...print,id:'stale',at:7999},10000);a.observe({...print,id:'future',at:11001},10000);
 assert.equal(a.volume('K','yes',4000,10000),0);a.observe({...print,at:10140},10000);assert.equal(a.volume('K','yes',4000,10000),5);
});
test('Activity ranking favors traded profitable quotes, accounts for queue ahead, and caps its score',()=>{
 assert.ok(makerActivityScore(5,0,10,300)>makerActivityScore(0,0,10,1000));
 assert.ok(makerActivityScore(5,0,10,300)>makerActivityScore(5,100,10,1000));
 assert.equal(makerActivityScore(100,0,10,300),300);
});
