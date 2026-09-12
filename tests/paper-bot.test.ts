import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PaperStore} from '../worker/paper-store.ts';
import {PaperBot,attachPaperBot} from '../worker/paper-bot.ts';
import {ResearchStore} from '../lib/research/store.ts';
import {Observer} from '../worker/observer.ts';
import {configSchema} from '../worker/config.ts';
import {pair,book} from './research-fixture.ts';
const mapping=()=>({id:'p',pair:{...pair('p'),reviewed:true},status:'MANUAL_VERIFIED',active:true,lastVerifiedAt:Date.now()});
function setup(){const dir=mkdtempSync(join(tmpdir(),'lights-paper-')),path=join(dir,'paper.sqlite');const store=new PaperStore(path),m=mapping();
 const books=new Map([['kalshi:Kp',book('kalshi','Kp')],['poly:Pp',book('poly','Pp')]]);
 const source={mapping:()=>m,book:(v,id)=>books.get(`${v}:${id}`),healthy:()=>true,ready:()=>true,barrier:async()=>{}};
 return {store,m,books,source,path};}
test('Observer recorder update automatically enters a durable sports paper position without browser polling',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'lights-observer-paper-')),research=new ResearchStore(join(dir,'research.sqlite'));
 const observer=new Observer(research,configSchema.parse({database:research.path,discoveryEnabled:false}));const store=new PaperStore(join(dir,'paper.sqlite'));
 let bot;
 try{await observer.initialize();const sports=pair('p');sports.a.category=sports.b.category='Sports';observer.registry.add(sports);observer.registry.verify('p','MANUAL_VERIFIED','Synthetic fixture only');observer.recorder.reindex();observer.paused=false;observer.recorder.streamHealthy=()=>true;
  observer.capacity={selectedIds:['p']} as any;
  bot=attachPaperBot(observer,store,'synthetic',async()=>{});
  observer.recorder.update(book('kalshi','Kp'));observer.recorder.update(book('poly','Pp'));
  await bot.task;assert.equal(bot.failed,false);assert.equal(store.read().diagnostics.eligible,1);assert.equal(store.read().diagnostics.blockers.eligible,1);assert.equal(store.read().state.positions.length,1);assert.equal(store.read().state.positions[0].status,'open');
  observer.recorder.update(book('poly','Pp'));await bot.task;assert.equal(store.read().state.positions.length,1);
  assert.ok(bot.document.counts['Market already held']);
  observer.capacity={selectedIds:[]} as any;
  const decisions=JSON.stringify(bot.document.counts);observer.recorder.update(book('poly','Pp'));await bot.task;
  assert.equal(JSON.stringify(bot.document.counts),decisions,'capacity-deferred pairs must not be evaluated');
 }finally{await bot?.stop();await observer.stop();store.close();research.close();}
});
test('Unapproved live mapping never enters, while reporting its blocker',async()=>{
 const x=setup();x.m.status='UNVERIFIED';const bot=new PaperBot(x.store,x.source,'live-data',async()=>{});
 try{bot.notify('p');await bot.task;assert.equal(bot.document.state.positions.length,0);assert.equal(bot.document.counts['Settlement mapping unapproved'],1);assert.equal(bot.document.state.cash.kalshi,500000);}finally{await bot.stop();x.store.close();}
});
test('Non-opportunity and stale/sequence-invalid stream are rejected without cash changes',async()=>{
 const x=setup();const b=x.books.get('poly:Pp');b.no=[{price:7000,quantity:100}];const a=x.books.get('kalshi:Kp');a.no=[{price:7000,quantity:100}];
 const bot=new PaperBot(x.store,x.source,'synthetic',async()=>{});
 try{bot.notify('p');await bot.task;assert.ok(bot.document.counts['Net edge below threshold']);a.valid=false;bot.notify('p');await bot.task;assert.ok(bot.document.counts['Missing, stale, unhealthy or sequence-invalid stream book']);assert.deepEqual(bot.document.state.cash,{kalshi:500000,poly:500000});}finally{await bot.stop();x.store.close();}
});
test('Burst updates coalesce; missing hedge preserves exposure and blocks further entries',async()=>{
 const x=setup();const bot=new PaperBot(x.store,x.source,'synthetic',async()=>{x.books.get('poly:Pp').no=[];x.books.get('kalshi:Kp').yesBids=[];});
 try{for(let i=0;i<100;i++)bot.notify('p');await bot.task;assert.equal(bot.document.state.positions.length,1);assert.equal(bot.document.state.positions[0].status,'unmatched');assert.equal(bot.document.state.cash.poly,500000);bot.notify('p');await bot.task;assert.equal(bot.document.state.positions.length,1);}finally{await bot.stop();x.store.close();}
});
test('Interrupted hedge is durably reserved and recovered as unmatched after restart',async()=>{
 const x=setup();let resume;const bot=new PaperBot(x.store,x.source,'synthetic',()=>new Promise(r=>resume=r));
 bot.notify('p');await new Promise(r=>setTimeout(r,10));assert.ok(x.store.read().pendingId);
 const snapshot=x.store.read();const recoveryPath=x.path+'-crash';const recovery=new PaperStore(recoveryPath);recovery.save(snapshot);
 const recovered=new PaperBot(recovery,x.source,'synthetic',async()=>{});
 assert.equal(recovered.document.state.positions[0].status,'unmatched');assert.equal(recovered.document.state.cash.poly,500000);assert.ok(recovered.document.halt);
 await recovered.stop();recovery.close();resume();await bot.task;await bot.stop();x.store.close();
});
test('Settlement persists exactly once across reopening the paper ledger',async()=>{
 const x=setup();let bot=new PaperBot(x.store,x.source,'synthetic',async()=>{});bot.notify('p');await bot.task;
 await bot.settle(async()=>({settlement:10000}));const cash=structuredClone(bot.document.state.cash);assert.ok(bot.document.state.positions[0].profit>0);await bot.stop();x.store.close();
 const reopened=new PaperStore(x.path);bot=new PaperBot(reopened,x.source,'synthetic');await bot.settle(async()=>({settlement:10000}));assert.deepEqual(bot.document.state.cash,cash);await bot.stop();reopened.close();
});
test('Sequence loss during hedge prevents second leg and uses existing modeled unwind',async()=>{
 const x=setup();const bot=new PaperBot(x.store,x.source,'synthetic',async()=>{x.books.get('poly:Pp').valid=false;});
 try{bot.notify('p');await bot.task;const p=bot.document.state.positions[0];assert.equal(p.status,'settled');assert.ok(p.profit<0);assert.equal(bot.document.state.cash.poly,500000);assert.ok(bot.document.halt);}finally{await bot.stop();x.store.close();}
});
test('Persistence barrier failure cannot reserve cash or enter a position',async()=>{
 const x=setup();x.source.barrier=async()=>{throw Error('Observer persistence failed');};const bot=new PaperBot(x.store,x.source,'synthetic',async()=>{});
 try{bot.notify('p');await bot.task;assert.equal(bot.failed,true);assert.equal(x.store.read().state.positions.length,0);assert.equal(x.store.read().pendingId,null);}finally{await bot.stop();x.store.close();}
});
test('Live-data mode rejects fixture books even when mapping is verified',async()=>{
 const x=setup();const bot=new PaperBot(x.store,x.source,'live-data',async()=>{});try{bot.notify('p');await bot.task;assert.equal(bot.document.state.positions.length,0);assert.ok(bot.document.counts['Missing, stale, unhealthy or sequence-invalid stream book']);}finally{await bot.stop();x.store.close();}
});
test('A queued paper-decision burst yields to incoming I/O before draining completely',async()=>{
 const x=setup();x.m.status='UNVERIFIED';const bot=new PaperBot(x.store,x.source,'live-data',async()=>{});
 try{
  const io=new Promise<number>(resolve=>setImmediate(()=>resolve(bot.queue.size)));
  for(let i=0;i<100;i++)bot.notify('burst-'+i);
  const remaining=await io;assert.ok(remaining>0,'I/O must run before the whole decision burst completes');
  await bot.task;assert.equal(bot.queue.size,0);assert.equal(bot.document.state.positions.length,0);
 }finally{await bot.stop();x.store.close();}
});

test('Promising approved stale Kalshi book requests genuine snapshot without changing freshness or entering',async()=>{
 const x=setup();let requests=0;x.source.requestSnapshot=()=>{requests++;return true;};
 for(const b of x.books.values())b.source='stream';const a=x.books.get('kalshi:Kp');a.receivedAt-=10000;a.receivedMono-=10000;const old=a.receivedAt;
 const bot=new PaperBot(x.store,x.source,'live-data',async()=>{});
 try{bot.notify('p');await bot.task;assert.equal(requests,1);assert.equal(a.receivedAt,old);assert.equal(bot.document.state.positions.length,0);x.m.status='UNVERIFIED';bot.notify('p');await bot.task;assert.equal(requests,1);}finally{await bot.stop();x.store.close();}
});
