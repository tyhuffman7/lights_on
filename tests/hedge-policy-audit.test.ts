import {test} from 'node:test';
import assert from 'node:assert/strict';
import {latest,entry,full,partialRecovery,delayedHeadroom,delayedUnwind,type Row} from '../scripts/hedge-policy-audit.ts';
import {book} from './research-fixture.ts';
function rows():Row[]{return [{id:1,at:1000,book:{...book('poly','p'),receivedAt:1000,exchangeAt:1000,no:[{price:5350,quantity:10}]}},{id:2,at:1000,book:{...book('kalshi','k'),receivedAt:1000,exchangeAt:1000,yesBids:[{price:4200,quantity:20}]}}] as Row[];}
test('Offline full hedge preserves reserve costs and caps; pre-entry one-lot reduction fits unchanged limits',()=>{
 const b=rows()[0];assert.equal(full(10,b,1000,54094).conditionalProfit,-700);assert.deepEqual(full(10,b,1000,54094).reasons,['PREALLOCATED_HEDGE_BUDGET','MAX_TRADE']);
 assert.equal(entry(9).debit,40000);assert.equal(full(9,b,1000,60000).conditionalProfit,-650);assert.equal(full(9,b,1000,60000).feasible,true);
});
test('Newer missing-depth book censors older cheap liquidity; future rows never selected',()=>{
 const rs=rows();rs.push({...rs[0],id:3,at:1100,book:{...rs[0].book,receivedAt:1100,no:[]}});rs.push({...rs[0],id:4,at:1600});
 assert.equal(latest(rs,'poly',1200)!.id,3);assert.equal(full(9,latest(rs,'poly',1200),1200,60000).feasible,false);
});
test('Recovery cannot fill at submission prices; rejection retains inventory when unwind also fails',()=>{
 const rs=rows();rs.push({...rs[0],id:3,at:1500,book:{...rs[0].book,receivedAt:1500,exchangeAt:1500,no:[{price:9400,quantity:100}]}});
 rs.push({...rs[1],id:4,at:2000,book:{...rs[1].book,receivedAt:2000,exchangeAt:2000,yesBids:[]}});
 const h=delayedHeadroom(rs,1000,500);assert.equal(h.choice,'HEDGE_FAILED_THEN_UNWIND');assert.equal(h.recovery!.status,'UNRESOLVED_EXPOSURE');assert.equal(h.recovery!.profit,null);
});
test('Partial amount fixed at intent; residual has a separate 500ms leg and can remain unfilled',()=>{
 const rs=rows();rs.push({...rs[0],id:3,at:1500,book:{...rs[0].book,receivedAt:1500,exchangeAt:1500,no:[{price:5650,quantity:100}]}});
 rs.push({...rs[1],id:4,at:2000,book:{...rs[1].book,receivedAt:2000,exchangeAt:2000,yesBids:[]}});
 const p=partialRecovery(rs,10,1000,54094);assert.equal(p.quantity,9);assert.equal(p.status,'RESIDUAL_UNRESOLVED');assert.equal(p.conditionalProfit,null);assert.equal(p.fill!.debit,53250);assert.equal(p.unwind!.arrival,2000);
 assert.equal(delayedUnwind(rs,10,1500).status,'UNRESOLVED_EXPOSURE');
});
