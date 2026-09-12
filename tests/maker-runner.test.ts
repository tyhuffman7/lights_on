import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {MakerRunner} from '../worker/maker-runner.ts';import {PaperStore} from '../worker/paper-store.ts';import {pair,book} from './research-fixture.ts';
async function scenario(partial:boolean,stopWithQueued=false){
 const realNow=Date.now;let now=realNow();Date.now=()=>now;
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-protocol-')),'paper.sqlite'));
 const p={...pair('p'),reviewed:true},m={id:'p',pair:p,active:true,status:'MANUAL_VERIFIED'};
 const books=new Map();const refresh=()=>{for(const [v,id] of [['kalshi','Kp'],['poly','Pp']])books.set(v+':'+id,{...book(v,id),source:'stream',receivedAt:now,exchangeAt:now});};refresh();
 // Synthetic protocol data only. Actual-market testing uses the real observer.
 const observer={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:()=>{}},capacity:{selectedIds:['p']},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer as any,store);clearInterval(runner.timer);
 try{
  await runner.tick();assert.ok(runner.document.makerOrder);const o=runner.document.makerOrder!,queue=runner.queue!;const requested=partial?.25:o.quote.quantity;
  now+=600;refresh();const taker=o.quote.aSide==='yes'?'no':'yes';const yes=o.quote.aSide==='yes'?o.price:10000-o.price;
  observer.paperTradeSink({type:'trade',msg:{trade_id:'actual-test-print',market_ticker:'Kp',yes_price_dollars:(yes/10000).toFixed(4),count_fp:String(queue.ahead+requested),taker_side:taker,taker_outcome_side:taker,taker_book_side:taker==='yes'?'bid':'ask',ts_ms:now}},now,performance.now());
  if(stopWithQueued){await runner.stop();assert.equal(runner.document.state.positions[0].aQuantity,requested);assert.equal(runner.document.state.positions[0].status,'unmatched');return;}
  await runner.tick();assert.equal(o.filledA,requested);assert.equal(o.filledB,0,'hedge delay must be respected');
  now+=600;refresh();await runner.tick();assert.equal(o.filledB,partial?0:requested);
  now=o.expiresAt+1;refresh();await runner.tick();const pos=runner.document.state.positions[0];assert.equal(pos.status,partial?'unmatched':'open');assert.deepEqual(pos.makerEvidence.publicTradeIds,['actual-test-print']);assert.equal(runner.document.state.makerReserved,undefined);
  if(partial)assert.ok(runner.document.halt);else{await runner.settle(async()=>({settlement:10000}));assert.ok(runner.document.state.positions[0].profit>0);assert.equal(runner.document.state.positions[0].aPayout+runner.document.state.positions[0].bPayout,requested*10000);}
 }finally{await runner.stop();store.close();Date.now=realNow;}
}
test('Maker protocol reserves, waits for printed volume, hedges after delay, and settles profit',async()=>scenario(false));
test('Fractional maker exposure below hedge minimum is retained and halts entries',async()=>scenario(true));
test('Shutdown accounts for already queued trade evidence instead of refunding a filled order',async()=>scenario(true,true));

import {makerPlan} from '../lib/arb/maker-plan.ts';import {reserveMaker,makerFill} from '../lib/arb/maker-ledger.ts';
test('Restart preserves a persisted fractional fill and refunds only unused reservations',async()=>{
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-recovery-')),'paper.sqlite'));const d=store.load('live-data'),p={...pair('p'),reviewed:true},plan=makerPlan(p,book('kalshi','Kp'),book('poly','Pp'),d.state.settings,d.state.cash)!;
 const reserved=reserveMaker(d.state,p,plan.quote,'recovered',plan.price);d.state=reserved.state;d.makerOrder=reserved.order;makerFill(d.makerOrder,.25,Date.now());store.save(d);
 const observer={registry:{list:()=>[]},recorder:{diagnostic:()=>{}}};const runner=new MakerRunner(observer as any,store);clearInterval(runner.timer);
 try{assert.equal(runner.document.state.positions[0].aQuantity,.25);assert.equal(runner.document.state.positions[0].bQuantity,0);assert.equal(runner.document.state.positions[0].status,'unmatched');assert.equal(runner.document.state.cash.poly,500000);assert.ok(runner.document.halt);assert.equal(runner.document.makerOrder,undefined);assert.equal(runner.document.state.makerReserved,undefined);}finally{await runner.stop();store.close();}
});

test('Maker runner learns while idle and selects an active profitable market over a richer idle quote',async()=>{
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-selection-')),'paper.sqlite'));
 const mappings=['idle','active'].map(id=>({id,pair:{...pair(id),reviewed:true},active:true,status:'MANUAL_VERIFIED'}));
 const books=new Map();for(const m of mappings)for(const [v,id] of [['kalshi',m.pair.a.id],['poly',m.pair.b.id]]){
  const b={...book(v,id),source:'stream'};if(m.id==='active'&&v==='poly')b.no=[{price:4500,quantity:100}];books.set(v+':'+id,b);
 }
 const observer={paused:false,stopped:false,registry:{get:(id:string)=>mappings.find(m=>m.id===id),list:()=>mappings},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:()=>{}},capacity:{selectedIds:['idle','active']},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer as any,store);clearInterval(runner.timer);
 try{
  const now=Date.now();observer.paperTradeSink({type:'trade',msg:{trade_id:'prior-activity',market_ticker:'Kactive',yes_price_dollars:'0.3000',count_fp:'10.00',taker_side:'no',ts_ms:now}},now,performance.now());
  await runner.tick();assert.equal(runner.document.makerOrder?.pair.id,'active');assert.equal(runner.document.makerOrder?.filledA,0,'historical activity never credits a new order');
 }finally{await runner.stop();store.close();}
});
