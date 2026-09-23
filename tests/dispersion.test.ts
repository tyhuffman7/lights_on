import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dispersionQuote,DispersionIntervals,dispersionPolicy} from '../lib/research/dispersion.ts';
import {selectDispersionRoutes} from '../worker/non-sports-observation.ts';
import {market} from './research-fixture.ts';
import type {Book,Pair} from '../lib/arb/types.ts';
const p:Pair={id:'test',a:{...market('kalshi'),venue:'kalshi',feeRate:700,feeRounding:'ceil',minQty:1},b:{...market('poly'),venue:'poly',feeRate:695,feeRounding:'even',minQty:1},inverted:false,reviewed:false};
const book=(yes:number,no:number,q=10):Book=>({yes:[{price:yes,quantity:q}],no:[{price:no,quantity:q}],yesBids:[],noBids:[],receivedAt:0,exchangeAt:null,open:true});
test('Complementary costs consume the same quantity at full depth and current fee bounds',()=>{
 const a=book(4000,6000),b=book(6500,3500);const q=dispersionQuote(p,a,b,'yes',1)!;
 assert.equal(q.rawGap,2500);assert.equal(q.feeUpper,400);assert.equal(q.feeNetGap,2100);
 assert.equal(q.bSide,'no');assert.equal(q.quantity,1);assert.equal(q.smallCapital,true);
 a.yes=[{price:4000,quantity:1},{price:5000,quantity:1}];
 const two=dispersionQuote(p,a,b,'yes',2)!;assert.equal(two.rawSurplus,4000);assert.equal(two.kalshiLevels.length,2);assert.equal(dispersionQuote(p,a,b,'yes',3),null);
 assert.equal(dispersionQuote({...p,inverted:true},a,b,'yes',1)?.bSide,'yes');
});
test('Missing fees, minimum, closed books, fractional-only depth and over-cap sizes fail closed',()=>{
 for(const pair of [{...p,a:{...p.a,feeRate:null}},{...p,b:{...p.b,minQty:0}}])assert.equal(dispersionQuote(pair,book(4000,6000),book(6500,3500),'yes',1),null);
 assert.equal(dispersionQuote(p,{...book(4000,6000),open:false},book(6500,3500),'yes',1),null);
 assert.equal(dispersionQuote(p,book(4000,6000,.8),book(6500,3500),'yes',1),null);
 assert.equal(dispersionQuote(p,book(4000,6000),book(6500,3500),'yes',11),null);
});
test('Intervals merge repeated updates and size changes, censor gaps, and track observed onsets',()=>{
 const tracker=new DispersionIntervals(),q=dispersionQuote(p,book(4000,6000),book(6500,3500),'yes',1)!;
 assert.equal(tracker.sample('route',0,[q]),true);assert.equal(tracker.sample('route',1000,[{...q,quantity:2}]),false);
 tracker.sample('route',2000,null);assert.equal(tracker.completed.length,1);assert.equal(tracker.completed[0].spanMs,1000);assert.equal(tracker.completed[0].leftCensored,true);
 tracker.sample('route',3000,[q]);tracker.sample('route',4000,[]);tracker.sample('route',5000,[q]);tracker.stop(6000);
 assert.equal(tracker.completed.length,3);assert.equal(tracker.completed[1].leftCensored,true);assert.equal(tracker.completed[2].leftCensored,false);assert.equal(tracker.active.size,0);
});
test('Frozen selection is deterministic, price-blind and capped with distinct PM markets',()=>{
 const rows=Array.from({length:40},(_,i)=>({pair:{...p,id:'pair'+i,a:{...p.a,id:'k'+i,category:'Entertainment',title:'TIME Person of the Year 2026',rules:'If Someone is Time Person of the Year for 2026, then the market resolves to Yes.'},b:{...p.b,id:'p'+Math.floor(i/2)}},status:'UNVERIFIED' as const,score:i,reasons:[],structured:{a:{},b:{}}}));
 const a=selectDispersionRoutes(rows),b=selectDispersionRoutes([...rows].reverse());assert.equal(a.length,dispersionPolicy.perFamily);assert.deepEqual(a.map(c=>c.pair.id),b.map(c=>c.pair.id));assert.equal(new Set(a.map(c=>c.pair.b.id)).size,a.length);
});
