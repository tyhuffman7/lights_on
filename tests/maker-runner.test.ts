import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {MakerRunner} from '../worker/maker-runner.ts';import {PaperStore} from '../worker/paper-store.ts';import {pair,book} from './research-fixture.ts';
async function scenario(partial:boolean,stopWithQueued=false){
 const realNow=Date.now;let now=realNow();Date.now=()=>now;
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-protocol-')),'paper.sqlite'));
 const p={...pair('p'),reviewed:true},m={id:'p',pair:p,active:true,status:'MANUAL_VERIFIED'};
 const books=new Map();const refresh=()=>{for(const [v,id] of [['kalshi','Kp'],['poly','Pp']])books.set(v+':'+id,{...book(v,id),source:'stream',receivedAt:now,exchangeAt:now});};refresh();
 // Synthetic protocol data only. Actual-market testing uses the real observer.
 const diagnostics:any[]=[];
 const observer={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:(kind:string,body:any)=>diagnostics.push({kind,body})},capacity:{selectedIds:['p']},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer as any,store);clearInterval(runner.timer);
 try{
  await runner.tick();assert.ok(runner.document.makerOrder);const o=runner.document.makerOrder!,queue=runner.queue!;const requested=partial?.25:o.quote.quantity;
  now+=500;refresh();await runner.tick();assert.equal(o.activationChecked,true);
  now+=100;refresh();const taker=o.quote.aSide==='yes'?'no':'yes';const yes=o.quote.aSide==='yes'?o.price:10000-o.price;
  observer.paperTradeSink({type:'trade',msg:{trade_id:'actual-test-print',market_ticker:'Kp',yes_price_dollars:(yes/10000).toFixed(4),count_fp:String(queue.ahead+requested),taker_side:taker,taker_outcome_side:taker,taker_book_side:taker==='yes'?'bid':'ask',ts_ms:now}},now,performance.now());
  if(stopWithQueued){await runner.stop();assert.equal(runner.document.state.positions[0].aQuantity,requested);assert.equal(runner.document.state.positions[0].status,'unmatched');return;}
  await runner.tick();assert.equal(o.filledA,requested);assert.equal(o.filledB,0,'hedge delay must be respected');
  now+=600;refresh();await runner.tick();assert.equal(o.filledB,partial?0:requested);
  if(!partial){const h=diagnostics.find(d=>d.kind==='PAPER_MAKER_HEDGE')?.body;assert.ok(h);assert.ok(h.at>=h.hedgeDue);assert.equal(h.quantity,requested);assert.equal(h.book.marketId,'Pp');assert.equal(h.book.receivedAt,now);assert.ok(diagnostics.some(d=>d.kind==='PAPER_MAKER_FILL'&&d.body.tradeId==='actual-test-print'));}
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

test('Book updates trigger maker selection before the ten-second fallback sweep',async()=>{
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-event-')),'paper.sqlite'));
 const p={...pair('p'),reviewed:true},m={id:'p',pair:p,active:true,status:'MANUAL_VERIFIED'},books=new Map();
 const observer={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,index:new Map([['kalshi:Kp',[m]],['poly:Pp',[m]]]),failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:()=>{}},capacity:{selectedIds:['p']},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer as any,store);clearInterval(runner.timer);
 try{
  await runner.tick();assert.equal(runner.document.makerOrder,undefined);
  const lastAttempt=runner.lastAttempt;
  for(const [v,id] of [['kalshi','Kp'],['poly','Pp']]){const b={...book(v,id),source:'stream'};books.set(v+':'+id,b);observer.recorder.onBook(b);}
  assert.equal(runner.pending.size,1,'multiple book updates coalesce');await runner.tick();
  assert.equal(runner.lastAttempt,lastAttempt,'did not wait for or run another fallback sweep');assert.ok(runner.document.makerOrder);
  await runner.stop();assert.equal(observer.recorder.onBook,null);assert.equal(runner.pending.size,0);
 }finally{await runner.stop();store.close();}
});

test('Maker evaluation drains bounded slices and discards deselected pairs',async()=>{
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-slice-')),'paper.sqlite'));
 const ids=Array.from({length:40},(_,i)=>String(i));const observer={paused:false,stopped:false,registry:{get:()=>undefined,list:()=>[]},recorder:{books:new Map(),failed:false,diagnostic:()=>{}},capacity:{selectedIds:ids}};
 const runner=new MakerRunner(observer as any,store);clearInterval(runner.timer);
 try{await runner.tick();assert.ok(runner.pending.size>=24);assert.ok(runner.pending.size<40);observer.capacity.selectedIds=[];for(let i=0;i<40&&runner.pending.size;i++)await runner.tick();assert.equal(runner.pending.size,0);assert.equal(runner.document.makerOrder,undefined);}
 finally{await runner.stop();store.close();}
});

test('A traded market beyond the ordinary batch is evaluated first without historical fills',async()=>{
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-priority-')),'paper.sqlite'));
 const mappings=[...Array.from({length:40},(_,i)=>'idle'+i),'active'].map(id=>({id,pair:{...pair(id),reviewed:true},active:true,status:'MANUAL_VERIFIED'}));
 const books=new Map(),index=new Map();for(const m of mappings)for(const [v,id] of [['kalshi',m.pair.a.id],['poly',m.pair.b.id]]){books.set(v+':'+id,{...book(v,id),source:'stream'});index.set(v+':'+id,[m]);}
 const observer={paused:false,stopped:false,registry:{get:(id:string)=>mappings.find(m=>m.id===id),list:()=>mappings},recorder:{books,index,failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:()=>{}},capacity:{selectedIds:mappings.map(m=>m.id)},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer as any,store);clearInterval(runner.timer);
 try{for(const m of mappings)runner.notify(m.id);const now=Date.now();observer.paperTradeSink({type:'trade',msg:{trade_id:'recent-sell',market_ticker:'Kactive',yes_price_dollars:'0.3000',count_fp:'10.00',taker_side:'no',ts_ms:now}},now,performance.now());
  await runner.tick();assert.equal(runner.document.makerOrder?.pair.id,'active');assert.equal(runner.document.makerOrder?.filledA,0);assert.ok(runner.pending.size>0,'ordinary queue still drains in bounded batches');
 }finally{await runner.stop();store.close();}
});

for(const arrival of ['crossed','closed','valid'])test(`Post-only activation handles ${arrival} arrival without earlier fills`,async()=>{
 const crossed=arrival==='crossed';
 const realNow=Date.now;let now=realNow();Date.now=()=>now;
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-activation-')),'paper.sqlite'));
 const p={...pair('p'),reviewed:true},m={id:'p',pair:p,active:true,status:'MANUAL_VERIFIED'},books=new Map();
 const refresh=()=>{for(const [v,id] of [['kalshi','Kp'],['poly','Pp']])books.set(v+':'+id,{...book(v,id),source:'stream',receivedAt:now,exchangeAt:now});};refresh();
 const observer={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:()=>{}},capacity:{selectedIds:['p']},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer as any,store);clearInterval(runner.timer);
 try{
  await runner.tick();const o=runner.document.makerOrder!;assert.ok(o);
  now+=600;refresh();if(crossed)books.get('kalshi:Kp')[o.quote.aSide]=[{price:o.price,quantity:100}];
  else books.get('kalshi:Kp')[o.quote.aSide==='yes'?'yesBids':'noBids']=[{price:o.price,quantity:100}];
  if(arrival==='closed')books.get('kalshi:Kp').open=false;
  const taker=o.quote.aSide==='yes'?'no':'yes',yes=o.quote.aSide==='yes'?o.price:10000-o.price;
  observer.paperTradeSink({type:'trade',msg:{trade_id:'before-activation',market_ticker:'Kp',yes_price_dollars:(yes/10000).toFixed(4),count_fp:'1000',taker_side:taker,ts_ms:now}},now,performance.now());
  await runner.tick();assert.equal(o.filledA,0);assert.equal(runner.document.state.positions.length,0);
  if(arrival!=='valid'){assert.equal(runner.document.makerOrder,undefined);assert.deepEqual(runner.document.state.cash,{kalshi:500000,poly:500000});}
  else{assert.equal(o.activeAt,now);assert.equal(o.activationChecked,true);assert.equal(runner.trades.length,0);assert.equal(runner.queue!.ahead,100,'arrival depth has priority over our new order');}
 }finally{await runner.stop();store.close();Date.now=realNow;}
});

for(const fillDuringCancel of [false,true])test(`Uneconomic hedge requests delayed cancellation and preserves racing fills (${fillDuringCancel})`,async()=>{
 const realNow=Date.now;let now=realNow();Date.now=()=>now;
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-hedge-cancel-')),'paper.sqlite'));
 const p={...pair('p'),reviewed:true},m={id:'p',pair:p,active:true,status:'MANUAL_VERIFIED'},books=new Map(),diagnostics:any[]=[];
 const refresh=()=>{for(const [v,id] of [['kalshi','Kp'],['poly','Pp']])books.set(v+':'+id,{...book(v,id),source:'stream',receivedAt:now,exchangeAt:now});};refresh();
 const observer={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:(kind:string,body:any)=>diagnostics.push({kind,body})},capacity:{selectedIds:['p']},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer as any,store);clearInterval(runner.timer);
 try{
  await runner.tick();const o=runner.document.makerOrder!;assert.ok(o);
  now+=600;refresh();books.get('poly:Pp')[o.quote.bSide]=[{price:9900,quantity:100}];await runner.tick();
  assert.equal(o.activationChecked,true,'cross-venue move cannot magically reject an accepted maker order');
  assert.equal(o.expiresAt,now+250,'retain cancellation transport delay');assert.ok(runner.document.makerOrder);
  assert.ok(diagnostics.some(d=>d.kind==='PAPER_MAKER_CANCEL_REQUEST'&&d.body.reason==='HEDGE_NO_LONGER_VIABLE'));
  now+=fillDuringCancel?100:251;const taker=o.quote.aSide==='yes'?'no':'yes',yes=o.quote.aSide==='yes'?o.price:10000-o.price;
  observer.paperTradeSink({type:'trade',msg:{trade_id:'cancellation-race',market_ticker:'Kp',yes_price_dollars:(yes/10000).toFixed(4),count_fp:String(o.quote.quantity+runner.queue!.ahead),taker_side:taker,ts_ms:now}},now,performance.now());
  await runner.tick();assert.equal(o.filledA,fillDuringCancel?o.quote.quantity:0);
  now+=700;await runner.tick();
  assert.equal(runner.document.makerOrder,undefined);
  if(fillDuringCancel){assert.equal(runner.document.state.positions[0].status,'unmatched');assert.ok(runner.document.halt);}else{assert.equal(runner.document.state.positions.length,0);assert.deepEqual(runner.document.state.cash,{kalshi:500000,poly:500000});}
 }finally{await runner.stop();store.close();Date.now=realNow;}
});

test('Activity ranks both eligible sides and final refresh preserves the selected side',async()=>{
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-side-')),'paper.sqlite')),p={...pair('side'),reviewed:true},m={id:p.id,pair:p,active:true,status:'MANUAL_VERIFIED'};
 const a={...book('kalshi',p.a.id),source:'stream',yes:[{price:8000,quantity:100}],no:[{price:8000,quantity:100}]},b={...book('poly',p.b.id),source:'stream',yes:[{price:4000,quantity:100}],no:[{price:4000,quantity:100}]};const books=new Map([['kalshi:'+p.a.id,a],['poly:'+p.b.id,b]]);
 const observer={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:()=>{}},capacity:{selectedIds:[p.id]},requestPaperSnapshot:()=>false};const runner=new MakerRunner(observer as any,store);clearInterval(runner.timer);
 try{const now=Date.now();runner.activity.observe({id:'no-side-sell',marketId:p.a.id,side:'no',price:3000,quantity:100,at:now},now);await runner.tick();assert.equal(runner.document.makerOrder?.quote.aSide,'no');assert.equal(runner.document.makerOrder?.filledA,0,'ranking print must not become fill evidence');}finally{await runner.stop();store.close();}
});

test('Production activity admission skips idle quotes and accepts a newly active eligible side without retroactive fills',async()=>{
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-admission-')),'paper.sqlite')),p={...pair('admission'),reviewed:true},m={id:p.id,pair:p,active:true,status:'MANUAL_VERIFIED'};
 const books=new Map([['kalshi:'+p.a.id,{...book('kalshi',p.a.id),source:'stream'}],['poly:'+p.b.id,{...book('poly',p.b.id),source:'stream'}]]);
 const observer={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:()=>{}},capacity:{selectedIds:[p.id]},requestPaperSnapshot:()=>false};const runner=new MakerRunner(observer as any,store,undefined,undefined,true);clearInterval(runner.timer);
 try{await runner.tick();assert.equal(runner.document.makerOrder,undefined);const now=Date.now();runner.activity.observe({id:'sell',marketId:p.a.id,side:'yes',price:3000,quantity:10,at:now},now);runner.notify(p.id,true);await runner.tick();assert.equal(runner.document.makerOrder?.quote.aSide,'yes');assert.equal(runner.document.makerOrder?.filledA,0);}finally{await runner.stop();store.close();}
});

test('Production size admission rejects tiny losing prints, rechecks after barrier, and retains later tiny fills',async()=>{
 const realNow=Date.now;let now=realNow();Date.now=()=>now;
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-size-policy-')),'paper.sqlite'));
 const p={...pair('p'),reviewed:true};p.b.minQty=.01;
 const m={id:'p',pair:p,active:true,status:'MANUAL_VERIFIED'},books=new Map();
 const refresh=()=>{for(const [v,id] of [['kalshi','Kp'],['poly','Pp']])books.set(v+':'+id,{...book(v,id),source:'stream',receivedAt:now,exchangeAt:now});};refresh();
 let atBarrier=()=>{};const diagnostics:any[]=[];
 const observer={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>atBarrier(),diagnostic:(kind:string,body:any)=>diagnostics.push({kind,body})},capacity:{selectedIds:['p']},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer as any,store,undefined,()=>new Map(),true);clearInterval(runner.timer);
 const print=(id:string,q:number,price=3000)=>observer.paperTradeSink({type:'trade',msg:{trade_id:id,market_ticker:'Kp',yes_price_dollars:(price/10000).toFixed(4),count_fp:String(q),taker_side:'no',ts_ms:now}},now,performance.now());
 try{
  print('tiny-before',.01);await runner.tick();assert.equal(runner.document.makerOrder,undefined);assert.ok(runner.document.counts['Maker candidates failing observed-size economics']>0);
  now+=60001;refresh();print('large-before',10);atBarrier=()=>print('tiny-at-barrier',.01);await runner.tick();assert.equal(runner.document.makerOrder,undefined);assert.ok(diagnostics.some(d=>d.kind==='PAPER_MAKER_ADMISSION_REJECTED'&&d.body.reason==='SIZE_ECONOMICS_ON_REFRESH'));
  now+=60001;refresh();atBarrier=()=>{};print('large-only',10);await runner.tick();const o=runner.document.makerOrder!;assert.ok(o);assert.equal(o.filledA,0);
  now+=500;refresh();await runner.tick();now++;refresh();print('tiny-after-entry',.01,o.price);await runner.tick();assert.equal(o.filledA,.01,'new tiny fill is retained despite stricter entry admission');
  now+=600;refresh();await runner.tick();assert.equal(o.filledB,.01,'hedge is still performed even when partial economics lose');
  now=o.expiresAt+1;refresh();await runner.tick();assert.equal(runner.document.state.positions[0].aQuantity,.01);assert.ok(runner.document.state.positions[0].quote.profit<0);
 }finally{await runner.stop();store.close();Date.now=realNow;}
});

test('Relevant book events cancel an uneconomic pending quote before activation with a coalesced wake',async()=>{
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-wake-')),'paper.sqlite')),p={...pair('wake'),reviewed:true},m={id:p.id,pair:p,active:true,status:'MANUAL_VERIFIED'};
 const books=new Map([['kalshi:'+p.a.id,{...book('kalshi',p.a.id),source:'stream'}],['poly:'+p.b.id,{...book('poly',p.b.id),source:'stream'}]]);
 const observer={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:()=>{},index:new Map()},capacity:{selectedIds:[p.id]},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer as any,store);clearInterval(runner.timer);
 try{await runner.tick();const o=runner.document.makerOrder!;assert(o);const b={...books.get('poly:'+p.b.id)!,[o.quote.bSide]:[{price:9900,quantity:100}]};books.set('poly:'+p.b.id,b);runner.bookSink(b as any);const scheduled=runner.wakeTimer;runner.bookSink(b as any);assert.equal(runner.wakeTimer,scheduled);await new Promise(resolve=>setImmediate(resolve));await runner.task;assert(o.cancelRequestedAt!==undefined);assert(runner.document.makerOrder,'request is not confirmed cancellation');assert.equal(o.filledA,0);}finally{await runner.stop();store.close();}
});

for(const invalidated of [false,true])test(`Final reservation refresh ${invalidated?'rejects an invalid exact size':'preserves ranked quantity despite changed depth'}`,async()=>{
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'maker-exact-size-')),'paper.sqlite'));
 const p={...pair('exact'),reviewed:true};p.a.feeRate=0;p.b.feeRate=695;
 const m={id:p.id,pair:p,active:true,status:'MANUAL_VERIFIED'};
 const a={...book('kalshi',p.a.id),source:'stream',yesBids:[{price:4000,quantity:1}],yes:[{price:4100,quantity:10}],noBids:[]};
 const b={...book('poly',p.b.id),source:'stream',no:[{price:4000,quantity:1},{price:5600,quantity:9}]};
 const books=new Map([['kalshi:'+p.a.id,a],['poly:'+p.b.id,b]]);let barriers=0;
 const observer={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>{barriers++;b.no=[{price:4000,quantity:invalidated?.5:10}];},diagnostic:()=>{}},capacity:{selectedIds:[p.id]},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer as any,store,undefined,undefined,true);clearInterval(runner.timer);
 Object.assign(runner.document.state.settings,{reserve:200,minProfit:1000,minRoi:1,maxTrade:100000});
 try{
  const now=Date.now();runner.activity.observe({id:'one-contract',marketId:p.a.id,side:'yes',price:4000,quantity:1,at:now},now);
  await runner.tick();assert.equal(barriers,1);
  if(invalidated)assert.equal(runner.document.makerOrder,undefined);
  else{const order=runner.document.makerOrder!;assert(order);assert.equal(order.quote.aSide,'yes');assert.equal(order.price,4000);assert.equal(order.quote.quantity,1);assert.equal(order.filledA,0);}
 }finally{await runner.stop();store.close();}
});
