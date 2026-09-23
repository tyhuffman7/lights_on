import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {studyQuotes,derivedQuote,bestQuote,StreamingIntervals,WeightedValues,streamingStudyPolicy,confirmedIntervalStatus} from '../lib/research/streaming-dispersion.ts';
import {market} from './research-fixture.ts';
import type {Book,Pair} from '../lib/arb/types.ts';
const pair:Pair={id:'study-fixture',a:{...market('kalshi'),feeRate:700,feeRounding:'ceil',minQty:1},b:{...market('poly'),feeRate:695,feeRounding:'even',minQty:1},inverted:false,reviewed:false};
const book=(yes:number,no:number,depth=10):Book=>({yes:[{price:yes,quantity:depth}],no:[{price:no,quantity:depth}],yesBids:[],noBids:[],open:true,receivedAt:0,exchangeAt:null});
const quotes=()=>studyQuotes(pair,book(4000,6000),book(6500,3500),'yes',0);
test('same existing fee/depth routine evaluates every legal quantity, principal excludes reserved risk',()=>{
 const qs=quotes();assert.deepEqual(qs.map(q=>q.quantity),[1,2,3,4,5,6,7,8,9,10]);const q=derivedQuote(qs[0])!;
 assert.equal(q.principal,7500);assert.equal(q.feeBound,400);assert.equal(q.feeNetSurplus,2100);assert.equal(q.riskCash,200);assert.equal(q.totalReservedCash,8700);
 assert.equal(q.settlementAssumed,false);assert.equal(q.fillClaim,false);
});
test('whole quantities respect minimums, multilevel depth and inverted native orientation',()=>{
 const a=book(4000,6000);a.yes=[{price:4000,quantity:1.8},{price:4100,quantity:1}];const qs=studyQuotes({...pair,b:{...pair.b,minQty:2}},a,book(6500,3500),'yes',0);
 assert.deepEqual(qs.map(q=>q.quantity),[2]);assert.equal(qs[0].economics?.cost,15100);assert.equal(qs[0].economics?.kalshi.levels.length,2);
 assert.equal(studyQuotes({...pair,inverted:true},a,book(3500,6500),'yes',0)[0].bSide,'yes');
 assert.equal(studyQuotes({...pair,a:{...pair.a,feeRate:null}},a,book(3500,6500),'yes',0).length,0);
});
test('quantity changes and repeated callbacks are a single positive interval',()=>{
 const t=new StreamingIntervals(),qs=quotes();t.update('p|yes','fee',0,[]);t.update('p|yes','fee',100,[qs[0]]);for(let at=200;at<=900;at+=100)t.update('p|yes','fee',at,qs);t.update('p|yes','fee',1000,[]);
 assert.equal(t.rows.length,1);assert.equal(t.rows[0].knownOnset,true);assert.equal(t.rows[0].observedMs,900);assert.deepEqual(t.rows[0].quantitySet,[1,2,3,4,5,6,7,8,9,10]);
});
test('unknown gaps censor duration and never manufacture an independent interval',()=>{
 const t=new StreamingIntervals(),qs=quotes();t.update('p|yes','fee',100,qs);t.update('p|yes','fee',200,null);t.update('p|yes','fee',1000,qs);t.update('p|yes','fee',1100,[]);t.update('p|yes','fee',1200,qs);t.stop(1500);
 assert.equal(t.rows.length,2);assert.equal(t.rows[0].observedMs,200);assert.equal(t.rows[0].segments.length,2);assert.equal(t.rows[0].leftCensored,true);assert.equal(t.rows[1].knownOnset,true);assert.equal(t.rows[1].rightCensored,true);
});
test('raw positives remain separate when fees remove all surplus',()=>{
 const qs=studyQuotes(pair,book(5000,5000),book(5200,4800),'yes',0);const t=new StreamingIntervals();t.update('p|yes','raw',0,qs);t.update('p|yes','fee',0,qs);
 assert.equal(t.rows.length,1);assert.equal(t.rows[0].kind,'raw');assert(bestQuote(qs)!.economics!.feeBoundSurplus<0);
});
test('duration-weighted median is unaffected by callback duplication; no samples stays unavailable',()=>{
 const v=new WeightedValues();assert.deepEqual(v.summary(),{median:null,max:null,weightedMs:0});v.observe(-100,900);v.observe(300,100);for(let i=0;i<1000;i++)v.observe(300,0);
 assert.deepEqual(v.summary(),{median:-100,max:300,weightedMs:1000});
});
test('confirmation cannot call a later episode or censored continuation continuous survival',()=>{
 const t=new StreamingIntervals(),qs=quotes(),first=t.update('p|yes','fee',0,qs).row!;
 assert.equal(confirmedIntervalStatus('EDGE_SURVIVED',first.id,1,first).status,'EDGE_SURVIVED');
 t.update('p|yes','fee',100,null);t.update('p|yes','fee',200,qs);
 assert.equal(confirmedIntervalStatus('EDGE_SURVIVED',first.id,1,first).status,'FAILED');
 t.update('p|yes','fee',300,[]);const next=t.update('p|yes','fee',400,qs).row!;
 assert.equal(confirmedIntervalStatus('EDGE_SURVIVED',first.id,2,next).status,'FAILED');
 assert.equal(confirmedIntervalStatus('EDGE_DISAPPEARED',first.id,2,undefined).status,'EDGE_DISAPPEARED');
});
test('study has a hard 90-minute ceiling and no account/order/ledger worker imports',()=>{
 assert.equal(streamingStudyPolicy.durationMs,5400000);assert.equal(streamingStudyPolicy.maxCultureRoutes,10);assert.equal(streamingStudyPolicy.ordersEnabled,false);assert.equal(streamingStudyPolicy.ledgerAccess,false);
 const worker=readFileSync(new URL('../worker/streaming-dispersion.ts',import.meta.url),'utf8');assert(!/from ['"].*(?:paper-store|account-read|pilot\/|maker-runner|production-paper\.ts)/.test(worker));assert(worker.includes('VenueRebuildBudget'));
});
