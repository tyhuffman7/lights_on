import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initial,totals} from '../lib/arb/ledger.ts';
import {makerPlan,refreshMakerPlan} from '../lib/arb/maker-plan.ts';
import {makerAllocation} from '../lib/arb/maker-allocation.ts';
import {reserveMaker,makerFill,closeMaker} from '../lib/arb/maker-ledger.ts';
import {submitMakerRecovery,executeMakerRecovery} from '../lib/arb/maker-recovery.ts';
import {MakerRunner} from '../worker/maker-runner.ts';
import {PaperStore} from '../worker/paper-store.ts';
import {pair,book} from './research-fixture.ts';
function setup(){
 const now=Date.now(),s=initial();s.settings.makerRecovery='bounded-v1';s.cash={kalshi:500000,poly:500000};
 const p={...pair(),reviewed:true},a=book('kalshi','Kp'),b=book('poly','Pp');
 a.yesBids=[{price:4300,quantity:100}];a.yes=[{price:5100,quantity:100}];a.noBids=[];b.no=[{price:5150,quantity:100}];
 const plan=makerPlan(p,a,b,s.settings,s.cash,now,false,0)!;
 const held=reserveMaker(s,p,plan.quote,'o',plan.price,now);held.order.makerFeeProfile={rate:0} as any;
 return {now,s,p,a,b,plan,...held};
}
test('Sizing uses full recovery allocation, available venue cash and exact refresh; baseline unchanged',()=>{
 const {s,p,a,b,plan,now,state,order}=setup();
 assert.equal(plan.quote.quantity,9);assert.equal(makerPlan(p,a,b,{...s.settings,makerRecovery:undefined},s.cash,now,false,0)!.quote.quantity,10);
 assert.deepEqual(plan.quote.makerAllocation,makerAllocation(plan.quote));
 assert.ok(order.reservedA+order.reservedB<=s.settings.maxTrade);
 assert.equal(state.cash.kalshi+order.reservedA,s.cash.kalshi);assert.equal(state.cash.poly+order.reservedB,s.cash.poly);
 assert.equal(refreshMakerPlan(p,a,b,s.settings,{...s.cash,poly:order.reservedB-1},plan,now,0),null);
 assert.equal(makerPlan(p,a,b,s.settings,{kalshi:0,poly:0},now,false,0),null);
 const already=structuredClone(s);already.settings.maxCommitted=order.reservedA+order.reservedB-1;
 assert.throws(()=>reserveMaker(already,p,plan.quote,'x',plan.price,now),/bankroll/);
 const malformed=structuredClone(plan.quote);malformed.makerAllocation!.poly=1;
 assert.throws(()=>reserveMaker(s,p,malformed,'x',plan.price,now),/allocation/);
});
test('Full hedge includes fees/reserves, releases unused headroom, retains conditional loss and inventory',()=>{
 const {s,state,order:o,a,b,now}=setup();makerFill(o,9,now+600);o.expiresAt=now+850;
 a.receivedAt=a.exchangeAt=now+850;a.yesBids=[{price:4200,quantity:100}];
 const intent=submitMakerRecovery(o,s,a,now+850);assert.equal(intent.ceiling,Math.min(o.reservedB,90000-intent.unwindProceeds!));
 b.receivedAt=b.exchangeAt=now+1350;b.no=[{price:5500,quantity:9}];
 assert.equal(executeMakerRecovery(o,s,b,true,now+1349).reason,'NOT_YET_DUE');assert.equal(intent.done,false);
 assert.equal(executeMakerRecovery(o,s,b,true,now+1350).reason,'SUCCESS');
 const closed=closeMaker(state,o,now+1350),p=closed.positions[0];
 assert.equal(p.status,'open');assert.ok(p.quote.profit<0);assert.equal(p.profit,undefined);assert.equal(totals(closed).realized,0);
 assert.equal(closed.cash.kalshi+closed.cash.poly+p.aDebit+p.bDebit,1000000);assert.equal(closed.makerReserved,undefined);
});
for(const scenario of ['missing-unwind','missing-hedge','thin','ceiling','invalid-state','fee-overrun','late-cheap'] as const)test(`Recovery fails once and retains exposure: ${scenario}`,()=>{
 const {s,state,order:o,a,b,now}=setup();makerFill(o,9,now+600);o.expiresAt=now+850;
 a.receivedAt=a.exchangeAt=now+850;
 if(scenario==='ceiling')a.yesBids=[{price:4700,quantity:100}];
 assert.throws(()=>submitMakerRecovery(o,s,a,now+849),/submission/);
 const intent=submitMakerRecovery(o,s,scenario==='missing-unwind'?null:a,now+850),frozen=intent.ceiling;
 b.receivedAt=b.exchangeAt=now+1350;b.no=[{price:scenario==='late-cheap'?9400:5500,quantity:scenario==='thin'?8:9}];
 if(scenario==='fee-overrun')o.aFees=o.reservedA;
 const result=executeMakerRecovery(o,s,scenario==='missing-hedge'?null:b,scenario!=='invalid-state',now+1350);
 assert.notEqual(result.reason,'SUCCESS');assert.equal(o.filledB,0);assert.equal(intent.done,true);assert.equal(intent.ceiling,frozen);
 b.no=[{price:1000,quantity:100}];assert.equal(executeMakerRecovery(o,s,b,true,now+1351).reason,'RECOVERY_ALREADY_ATTEMPTED');
 const closed=closeMaker(state,o,now+1350);assert.equal(closed.positions[0].status,'unmatched');assert.equal(closed.positions[0].aQuantity,9);assert.equal(closed.positions[0].profit,undefined);
});
for(const scenario of ['hedge','unwind','unwind-fails','no-unwind-book'] as const)test(`Worker checkpoint cancels, submits, reprices and stops: ${scenario}`,async()=>{
 const realNow=Date.now;let now=realNow();Date.now=()=>now;
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'bounded-recovery-')),'paper.sqlite'));
 const d=store.load('live-data');d.state.settings.makerRecovery='bounded-v1';d.state.cash={kalshi:500000,poly:500000};store.save(d);
 const p={...pair('p'),reviewed:true},m={id:'p',pair:p,active:true,status:'MANUAL_VERIFIED'},books=new Map(),diagnostics:any[]=[];
 const refresh=()=>{for(const [v,id] of [['kalshi','Kp'],['poly','Pp']])books.set(v+':'+id,{...book(v,id),source:'stream',receivedAt:now,exchangeAt:now,capture:{sessionId:'test',version:now,processedAt:now,processedMono:performance.now()}});};refresh();
 const observer:any={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:(kind:string,body:any)=>diagnostics.push({kind,body:structuredClone(body)})},capacity:{selectedIds:['p']},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer,store);clearInterval(runner.timer);
 try{
  await runner.tick();const o=runner.document.makerOrder!;assert.ok(o);
  now+=500;refresh();await runner.tick();now+=100;refresh();
  const side=o.quote.aSide==='yes'?'no':'yes',yes=o.quote.aSide==='yes'?o.price:10000-o.price;
  observer.paperTradeSink({type:'trade',msg:{trade_id:'synthetic-fixture',market_ticker:'Kp',yes_price_dollars:(yes/10000).toFixed(4),count_fp:String(runner.queue!.ahead+o.quote.quantity),taker_side:side,ts_ms:now}},now,performance.now());
  await runner.tick();assert.equal(o.filledA,o.quote.quantity);assert.equal(o.filledB,0);assert.equal(o.expiresAt,now+250);
  now+=250;refresh();await runner.tick();assert.equal(o.recovery!.submittedAt,now);assert.equal(o.hedgeDue,now+500);
  now+=500;refresh();books.get('poly:Pp')[o.quote.bSide]=[{price:scenario==='hedge'?4400:9400,quantity:100}];
  await runner.tick();assert.equal(runner.document.makerOrder,undefined);assert.equal(runner.document.state.makerReserved,undefined);
  if(scenario==='hedge'){assert.equal(runner.document.state.positions[0].status,'open');assert.equal(runner.checkpointComplete(),true);}
  else{
   assert.ok(runner.document.halt);assert.equal(runner.checkpointComplete(),false);
   if(scenario==='no-unwind-book')books.delete('kalshi:Kp');
   await runner.tick();
   if(scenario==='no-unwind-book'){assert.equal(runner.exitOrder,null);now+=2500;assert.equal(runner.checkpointComplete(),true);}
   else{assert.ok(runner.exitOrder);now+=500;refresh();if(scenario==='unwind-fails')books.get('kalshi:Kp').yesBids=[];
    await runner.tick();assert.equal(runner.checkpointComplete(),true);assert.equal(runner.document.state.positions[0].status,scenario==='unwind'?'settled':'unmatched');
   }
  }
  await runner.tick();assert.equal(runner.document.makerOrder,undefined);assert.equal(runner.document.state.positions.length,1);
  assert.equal(diagnostics.filter(d=>d.kind==='PAPER_MAKER_RECOVERY_INTENT').length,1);
  assert.equal(diagnostics.filter(d=>d.kind==='PAPER_MAKER_RECOVERY_RESULT').length,1);
  if(scenario!=='hedge')assert.ok(runner.document.halt);
 }finally{await runner.stop();store.close();Date.now=realNow;}
});
