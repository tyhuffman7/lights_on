import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MultiPaper,multiPolicy,reviewedRows,bookFingerprint} from '../lib/arb/multi-paper.ts';
import type {ReviewRow} from '../lib/arb/multi-paper.ts';
import {modelLeg,accountLeg,recoveryPlan,recover,accounting} from '../lib/arb/ksu-paper.ts';
import type {Session} from '../lib/arb/ksu-paper.ts';
import {quoteCandidate} from '../lib/screen/confirmation.ts';
import type {Book,Pair,Venue} from '../lib/arb/types.ts';
const read=(p:string)=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const review=read('../docs/research/contract-shortlist/review.json'),retained=read('../docs/research/contract-shortlist/retained-markets.json');
const rows=reviewedRows(review),at=Date.parse('2026-09-22T12:00:00Z');
const c={kalshi:{tick:100,minimum:1},poly:{tick:100,minimum:0.01}};
const status={knownBlocked:false,reportedStatus:'active',reasons:['STATUS_CACHE_CURRENTNESS_UNPROVEN','NON_ATOMIC_INITIAL_STATE']};
const pair=(row:ReviewRow):Pair=>({id:row.pairId,a:retained.kalshi.find((m:any)=>m.id===row.kalshiId),b:retained.poly.find((m:any)=>m.id===row.polyId),inverted:false,reviewed:false});
// SYNTHETIC ONLY: deliberately favorable displayed books, never market outcomes.
const book=(side:'yes'|'no',price=4000,quantity=10):Book=>({yes:[],no:[],yesBids:[{price:3900,quantity}],noBids:[{price:3900,quantity}],[side]:[{price,quantity}],receivedAt:at,exchangeAt:at,open:true});
const books=(row:ReviewRow)=>({kalshi:book(row.sides.kalshi),poly:book(row.sides.poly)});
const selected=(p:MultiPaper,row:ReviewRow)=>{const b=books(row);return p.select(row,pair(row),b.kalshi,b.poly,status,c,at).selected!;};
async function execute(p:MultiPaper,row:ReviewRow,modify?:(s:Session,b:Record<Venue,Book>)=>void,proofReasons:string[]=[],canEnter=()=>true){
  const b=books(row),q=selected(p,row);
  return p.execute(row,pair(row),q,async()=>({quote:q,status,constraints:c,reasons:proofReasons}),async s=>{
    assert.ok(s.held.kalshi>0&&s.held.poly>0);assert.equal(s.state.positions.length,0);
    if(modify)modify(s,b);else for(const v of ['kalshi','poly'] as const)accountLeg(s,pair(row),v,modelLeg(s.plan![v],v==='kalshi'?pair(row).a:pair(row).b,b[v],[],false,at+500,600));
  },()=>at,()=>100,canEnter);
}
test('frozen mode has exact cash, risk, position, attempt, delay, recovery and time boundaries',()=>{
  assert.equal(rows.retained.length,34);assert.equal(rows.authorized.length,5);
  assert.deepEqual([multiPolicy.capitalPerVenue,multiPolicy.maxReservation,multiPolicy.maxCommitted,multiPolicy.maxPositions,multiPolicy.maxAttempts,multiPolicy.maxRealizedLoss],[500000,150000,450000,3,5,20000]);
  assert.equal(multiPolicy.transportMs,500);assert.equal(multiPolicy.maxReconnects,3);assert.equal(multiPolicy.durationMs,3600000);assert.equal(multiPolicy.ordersEnabled,false);
});
test('SYNTHETIC POSITIVE integration: all five exact reviewed orientations reach BOTH delayed modeled legs',async()=>{
  for(const row of rows.authorized){const p=new MultiPaper(review),q=selected(p,row);assert.ok(q.economics!.afterRisk>0);
    const result=await execute(p,row);assert.equal(result.attempted,true);const s=p.entries[0].session;
    for(const v of ['kalshi','poly'] as const){assert.equal(s.plan![v].side,row.sides[v]);assert.equal(s.plan![v].arrivalMono,600);assert.equal(s.results[v]?.outcome,'FILLED');}
    assert.equal(p.openPositions(),1);assert.equal(p.summary().realizedProfit,0);assert.equal(accounting(s).realizedProfit,null);
    const spent=s.state.positions[0].aDebit+s.state.positions[0].bDebit;
    assert.equal(p.cash.kalshi+p.cash.poly+s.held.kalshi+s.held.poly+spent,1000000);
  }
});
test('sub-10-cent and sub-1-percent net case is admitted only while strictly positive after risk',()=>{
  const p=new MultiPaper(review),row=rows.authorized.find(r=>r.kalshiId.includes('DWTS'))!,p0=pair(row);
  const a=book('yes',1000,10),b=book('no',8600,10),q=p.select(row,p0,a,b,status,c,at).selected!;
  assert.ok(q);assert.ok(q.economics!.afterRisk>0&&q.economics!.afterRisk<1000);
  assert.ok(q.economics!.afterRisk/q.economics!.reservedCash*100<1);
  for(const price of [9000,10000])assert.equal(p.select(row,p0,a,book('no',price,7),status,c,at).selected,null);
});
test('observation-only, wrong direction, closure, contradictory status, grid and insufficient cash block entry',async()=>{
  const p=new MultiPaper(review),row=rows.authorized[0],q=selected(p,row),other=rows.retained.find(r=>r.reviewDepth!=='DEEP')!;
  assert.equal(p.select(other,pair(other),books(other).kalshi,books(other).poly,status,c,at).selected,null);
  for(const state of [{...status,knownBlocked:true},{...status,reasons:['BASELINE_LIFECYCLE_CONTRADICTION']},{...status,reportedStatus:'closed'}])assert.ok(p.gates(row,pair(row),q,state,c).length);
  assert.ok(p.gates(row,pair(row),{...q,aSide:row.sides.poly},status,c).length);
  assert.ok(p.gates(row,pair(row),q,status,{...c,poly:{tick:300,minimum:0.01}}).length);
  p.cash.poly=1;assert.ok(p.gates(row,pair(row),q,status,c).includes('poly_CASH'));
});
test('confirmation failures and expired session never reserve or submit',async()=>{
  for(const failure of ['FEED_DISCONNECTED','PROCESSING_BACKLOG','SAME_VERSION_CONFLICTING_BOOKS','SNAPSHOT_CONFIRMATION_EXPIRED','MATERIAL_TERMS_CHANGED']){
    const p=new MultiPaper(review);assert.equal((await execute(p,rows.authorized[0],undefined,[failure])).attempted,false);assert.equal(p.entries.length,0);assert.deepEqual(p.cash,{kalshi:500000,poly:500000});
  }
  const p=new MultiPaper(review);assert.equal((await execute(p,rows.authorized[0],undefined,[],()=>false)).attempted,false);
});
test('confirmation must retain exact discovered quantity; no silent quantity substitution',async()=>{
  const p=new MultiPaper(review),row=rows.authorized[0],q=selected(p,row),b=books(row);
  const result=await p.execute(row,pair(row),q,async()=>({quote:quoteCandidate(pair(row),b.kalshi,b.poly,row.sides.kalshi,at,1),status,constraints:c,reasons:[]}),async()=>assert.fail('submission'),()=>at,()=>100,()=>true);
  assert.ok(result.reasons.includes('CONFIRMED_CANDIDATE_CHANGED'));assert.equal(p.entries.length,0);
});
test('three paired positions lock capital and block later entries; unchanged liquidity cannot earn again',async()=>{
  const p=new MultiPaper(review);for(const row of rows.authorized.slice(0,3))await execute(p,row);
  assert.equal(p.openPositions(),3);assert.equal(p.stopReason(),'THREE_OPEN_POSITIONS');assert.ok(p.commitment()>0);
  assert.equal((await execute(p,rows.authorized[0])).attempted,false);assert.equal(p.entries.length,3);
  assert.equal(bookFingerprint(books(rows.authorized[0]).kalshi,books(rows.authorized[0]).poly),bookFingerprint(books(rows.authorized[0]).kalshi,books(rows.authorized[0]).poly));
});
test('total commitment includes occupied cash and recovery; quantity selection compares all ten under remaining capacity',async()=>{
  const p=new MultiPaper(review);await execute(p,rows.authorized[0]);const row=rows.authorized[1],b=books(row);
  const actual=p.commitment();p.commitment=()=>445000;
  assert.equal(p.select(row,pair(row),b.kalshi,b.poly,status,c,at).selected,null);
  p.commitment=()=>440000;assert.equal(p.select(row,pair(row),b.kalshi,b.poly,status,c,at).selected?.quantity,1);assert.ok(actual>0);
});
test('five confirmed no-fill attempts stop and refund only known unfilled inventory',async()=>{
  const p=new MultiPaper(review);for(const row of rows.authorized)await execute(p,row,(s,b)=>{for(const v of ['kalshi','poly'] as const)accountLeg(s,pair(row),v,modelLeg(s.plan![v],v==='kalshi'?pair(row).a:pair(row).b,book(row.sides[v],4100),[],false,at+500,600));});
  assert.equal(p.stopReason(),'FIVE_ENTRY_ATTEMPTS');assert.equal(p.commitment(),0);assert.deepEqual(p.cash,{kalshi:500000,poly:500000});
});
test('one-leg unknown or failure retains capital, exposes holdings, and cannot reconnect out of halt',async()=>{
  for(const unknown of [true,false]){const p=new MultiPaper(review),row=rows.authorized[0];await execute(p,row,(s,b)=>{
    accountLeg(s,pair(row),'kalshi',modelLeg(s.plan!.kalshi,pair(row).a,b.kalshi,[],false,at+500,600));
    accountLeg(s,pair(row),'poly',modelLeg(s.plan!.poly,pair(row).b,book(row.sides.poly,4100),unknown?['FEED_DISCONNECTED']:[],false,at+500,600));
  });assert.equal(p.halt,'UNRESOLVED_EXECUTION_EXPOSURE');assert.equal(p.reconnect(700,10000),false);assert.ok(p.commitment()>0);assert.equal(p.entries[0].session.state.positions[0].aQuantity,10);}
});
test('YES-side bounded recovery sells purchased side, charges fees and preserves realized loss trigger',async()=>{
  const p=new MultiPaper(review),row=rows.authorized.find(r=>r.sides.kalshi==='yes')!;
  const b={kalshi:book('yes',8600),poly:book('no',400)},q=p.select(row,pair(row),b.kalshi,b.poly,status,c,at).selected!;
  await p.execute(row,pair(row),q,async()=>({quote:q,status,constraints:c,reasons:[]}),async s=>{
    accountLeg(s,pair(row),'kalshi',modelLeg(s.plan!.kalshi,pair(row).a,b.kalshi,[],false,at+500,600));
    accountLeg(s,pair(row),'poly',modelLeg(s.plan!.poly,pair(row).b,book(row.sides.poly,4100),[],false,at+500,600));
    const rp=recoveryPlan(s,1600)!;b.kalshi.yesBids=[{price:8500,quantity:10}];b.kalshi.noBids=[];recover(s,rp,pair(row).a,b.kalshi,[],at+2000,2100);
    assert.equal((s.recovery as any).outcome,'FILLED');assert.ok(s.recoveryLoss!>0);
  },()=>at,()=>100,()=>true);assert.equal(p.halt,null);assert.ok(p.summary().realizedProfit<0);assert.equal(p.commitment(),0);
  p.entries[0].session.recoveryLoss=20001;assert.equal(p.stopReason(),'REALIZED_LOSS_TRIGGER');
});
test('submission exceptions preserve reservations and permanently halt; only one sequence runs at a time',async()=>{
  const p=new MultiPaper(review),row=rows.authorized[0],q=selected(p,row);let release:()=>void=()=>{};
  const running=p.execute(row,pair(row),q,async()=>{await new Promise<void>(r=>release=r);return {quote:q,status,constraints:c,reasons:[]};},async()=>{throw Error('synthetic failure');},()=>at,()=>100,()=>true);
  assert.ok((await execute(p,rows.authorized[1])).reasons.includes('SEQUENCE_BUSY'));release();await assert.rejects(running,/synthetic failure/);assert.equal(p.halt,'SUBMISSION_FAILURE_UNRESOLVED');assert.ok(p.commitment()>0);
});
test('reconnection budget stays within original deadline and never permits a fourth reconnect',()=>{
  const p=new MultiPaper(review);for(let i=0;i<3;i++)assert.equal(p.reconnect(100,1000),true);assert.equal(p.reconnect(100,1000),false);
  const q=new MultiPaper(review);assert.equal(q.reconnect(1000,1000),false);q.busy=true;assert.equal(q.reconnect(0,1000),false);
});
