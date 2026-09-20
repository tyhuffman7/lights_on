import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makerHedgeDecision,hedgeMaker,makerFill} from '../lib/arb/maker-ledger.ts';
import {hedgeBookState,compactHedgeBook} from '../worker/hedge-diagnostics.ts';
import {MakerRunner} from '../worker/maker-runner.ts';
import {PaperStore} from '../worker/paper-store.ts';
import {pair,book} from './research-fixture.ts';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/hedge-reservation.json',import.meta.url),'utf8'));
function captured(){const o=structuredClone(fixture.order);makerFill(o,10,fixture.hedgeDue-500);return {o,b:structuredClone(fixture.book),now:fixture.hedgeDue};}
test('Captured due-time inputs fail reservation by $0.1106, not depth; no historical call is inferred',()=>{
 const {o,b,now}=captured(),before=structuredClone(o),d=makerHedgeDecision(o,b,now,2000);
 assert.equal(d.reason,'RESERVATION_EXCEEDED');assert.equal(d.fill!.cost,53500);assert.equal(d.fill!.fees,1700);assert.equal(d.fill!.cost+d.fill!.fees-o.reservedB,1106);
 const records:any[]=[];assert.equal(hedgeMaker(o,b,now,2000,d=>records.push(d)),false);assert.deepEqual(o,before);assert.equal(records.length,1);
});
for(const [name,change,reason] of [
 ['delay',(_o:any,_b:any,n:number)=>n-1,'NOT_YET_DUE'],
 ['closed',(_o:any,b:any,n:number)=>{b.open=false;return n;},'BOOK_CLOSED'],
 ['stale receipt',(_o:any,b:any,n:number)=>{b.receivedAt=n-2001;return n;},'RECEIPT_STALE'],
 ['stale exchange',(_o:any,b:any,n:number)=>{b.exchangeAt=n-2001;return n;},'EXCHANGE_STALE'],
 ['depth',(_o:any,b:any,n:number)=>{b.no=[{price:5000,quantity:9}];return n;},'INSUFFICIENT_FULL_DEPTH'],
 ['quantity',(o:any,_b:any,n:number)=>{o.filledA=.015;return n;},'QUANTITY_INVALID'],
 ['success',(_o:any,b:any,n:number)=>{b.no=[{price:5000,quantity:10}];return n;},'SUCCESS'],
] as const)test(`Hedge diagnostics preserve ${name} execution outcome`,()=>{
 const {o,b,now}=captured(),at=change(o,b,now),before=structuredClone(o),records:any[]=[];
 assert.equal(hedgeMaker(o,b,at,2000,d=>records.push(d)),reason==='SUCCESS');assert.equal(records[0].reason,reason);assert.equal(records.length,1);
 if(reason==='SUCCESS')assert.equal(o.filledB,10);else assert.deepEqual(o,before);
});
test('Compact reference distinguishes versions sharing transport receipt time; no levels copied',()=>{
 const {b,now}=captured();b.capture={sessionId:'s',version:1,processedAt:now,processedMono:100};b.receivedMono=90;
 const first=compactHedgeBook(hedgeBookState(b,true,now,100,2000));b.capture={...b.capture,version:2};
 const second=compactHedgeBook(hedgeBookState(b,true,now,100,2000));assert.equal(first.reference!.version,1);assert.equal(second.reference!.version,2);assert.equal('no' in second,false);
 assert.equal(hedgeBookState(undefined,null,now,100,2000).reason,'BOOK_MISSING');
 assert.equal(hedgeBookState(b,false,now,100,2000).reason,'STREAM_UNHEALTHY');
});
for(const skip of ['mapping','missing','stale','success'])test(`Runner persists actual exposed decision including ${skip}`,async()=>{
 const realNow=Date.now;let now=realNow();Date.now=()=>now;
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'hedge-diagnostic-')),'paper.sqlite'));
 const p={...pair('p'),reviewed:true},m={id:'p',pair:p,active:true,status:'MANUAL_VERIFIED'},books=new Map(),diagnostics:any[]=[];
 const refresh=()=>{for(const [v,id] of [['kalshi','Kp'],['poly','Pp']])books.set(v+':'+id,{...book(v,id),source:'stream',receivedAt:now,exchangeAt:now,capture:{sessionId:'test',version:now,processedAt:now,processedMono:performance.now()}});};refresh();
 const observer:any={paused:false,stopped:false,registry:{get:()=>m,list:()=>[m]},recorder:{books,failed:false,streamHealthy:()=>true,send:async()=>{},diagnostic:(kind:string,body:any)=>diagnostics.push({kind,body})},capacity:{selectedIds:['p']},requestPaperSnapshot:()=>false};
 const runner=new MakerRunner(observer,store);clearInterval(runner.timer);
 try{
  await runner.tick();const o=runner.document.makerOrder!;now+=500;refresh();await runner.tick();now+=100;refresh();
  const side=o.quote.aSide==='yes'?'no':'yes',yes=o.quote.aSide==='yes'?o.price:10000-o.price;
  observer.paperTradeSink({type:'trade',msg:{trade_id:'fixture',market_ticker:'Kp',yes_price_dollars:(yes/10000).toFixed(4),count_fp:String(runner.queue!.ahead+o.quote.quantity),taker_side:side,ts_ms:now}},now,performance.now());
  await runner.tick();const first=diagnostics.filter(d=>d.kind==='PAPER_MAKER_HEDGE_DECISION').at(-1).body;
  assert.equal(first.reason,'NOT_YET_DUE');assert.equal(first.fillTiming.receivedAt,now);assert.equal(first.fillTiming.processedAt,now);assert.equal(first.hedgeDue,now+500);
  now+=500;refresh();if(skip==='mapping')m.active=false;if(skip==='missing')books.delete('poly:Pp');if(skip==='stale')books.get('poly:Pp').receivedAt=now-2001;
  await runner.tick();const ds=diagnostics.filter(d=>d.kind==='PAPER_MAKER_HEDGE_DECISION'),last=ds.at(-1).body;
  assert.equal(ds.length,2);assert.equal(last.reason,{mapping:'OUTER_STATE_INVALID',missing:'BOOK_MISSING',stale:'RECEIPT_OUTSIDE_WINDOW',success:'SUCCESS'}[skip]);
  assert.equal(last.called,skip==='success');assert.equal(o.filledB,skip==='success'?o.filledA:0);assert.equal('book' in last,false);assert.equal(last.remaining,o.filledA);
  if(skip==='success'){assert.ok(last.requiredPrincipal>0);assert.equal(last.polyBook.reference.sessionId,'test');}
 }finally{await runner.stop();store.close();Date.now=realNow;}
});
