import {makerPlan} from '../lib/arb/maker-plan.ts';
import {newDiagnostics,recordDiagnostic} from './paper-diagnostics.ts';
import {setImmediate as yieldToIO} from 'node:timers/promises';
import {validPaperApproval} from '../lib/arb/paper-approval.ts';
import {assessSettlement,type SettlementAssessment} from '../lib/research/settlement-validation.ts';
import type {Pair} from '../lib/arb/types.ts';
import {randomUUID} from 'node:crypto';
import {assess} from '../lib/arb/engine.ts';
import {enter,log,totals} from '../lib/arb/ledger.ts';
import {completePaperHedge} from '../lib/arb/execution.ts';
import {checkSettlements} from '../lib/arb/settlement.ts';
import {fresh} from '../lib/research/books.ts';
import {isVerified} from '../lib/research/mappings.ts';
import type {Book,Market,Venue} from '../lib/arb/types.ts';
import type {Mapping,StreamBook} from '../lib/research/types.ts';
import type {Observer} from './observer.ts';
import {PaperStore,type PaperDocument} from './paper-store.ts';
const empty=():Book=>({yes:[],no:[],yesBids:[],noBids:[],receivedAt:Date.now(),exchangeAt:null,open:false});
export type PaperSource={mapping:(id:string)=>Mapping|undefined;book:(venue:Venue,id:string)=>StreamBook|undefined;
 healthy:(venue:Venue,id:string)=>boolean;ready:()=>boolean;barrier:()=>Promise<unknown>;requestSnapshot?:(id:string)=>boolean;measure?:(name:string,ms:number)=>void};
export class PaperBot{
 private settlementCache=new WeakMap<Pair,SettlementAssessment>();
 document:PaperDocument;queue=new Set<string>();task:Promise<void>|null=null;stopping=false;failed=false;
 store:PaperStore;source:PaperSource;delay:()=>Promise<void>;
 constructor(store:PaperStore,source:PaperSource,mode:'live-data'|'synthetic',delay=()=>new Promise<void>(r=>setTimeout(r,500))){
  this.store=store;this.source=source;this.delay=delay;
  this.document=store.load(mode);
  if(this.document.makerOrder||this.document.state.makerReserved)throw Error('Maker order recovery required before taker mode');
  this.document.executionMode='taker';
  this.document.diagnostics=newDiagnostics();
  if(this.document.pendingId){
   // The persisted first leg may have filled before a crash. Never invent a hedge on restart.
   this.document.state=completePaperHedge(this.document.state,this.document.pendingId,empty(),empty());
   this.document.pendingId=null;this.document.halt='Restart recovered an interrupted hedge; unmatched exposure blocks entries';
  }
  this.persist();
 }
 private persist(){const start=performance.now();try{this.store.save(this.document);}catch(e){this.failed=true;throw e;}finally{this.source.measure?.('paperPersistence',performance.now()-start);}}
 notify(id:string){
  if(this.stopping||this.failed)return;
  // Coalesce updated pairs rather than queueing every market event or polling the whole registry.
  if(this.queue.size>=1000&&!this.queue.has(id)){this.reject(id,['Paper evaluation queue full']);return;}
  this.queue.add(id);if(!this.task)this.task=Promise.resolve().then(()=>this.drain()).catch(e=>{this.failed=true;this.document.halt=String(e);}).finally(()=>{this.task=null;});
 }
 private reject(id:string,reasons:string[]){
  for(const r of reasons)this.document.counts[r]=(this.document.counts[r]||0)+1;
  delete this.document.lastDecisions[id];this.document.lastDecisions[id]={at:Date.now(),reasons};
  const keys=Object.keys(this.document.lastDecisions);if(keys.length>200)delete this.document.lastDecisions[keys[0]];
 }
 private usable(m:Market){
  const b=this.source.book(m.venue,m.id);
  return b&&this.source.healthy(m.venue,m.id)&&fresh(b,performance.now(),Date.now(),this.document.state.settings.maxAge)
   &&(this.document.mode==='synthetic'?b.source==='fixture':b.source==='stream')?b:null;
 }
 private canEnter(m:Mapping|undefined){
  return !!m&&m.active&&(isVerified(m)||(this.document.mode==='live-data'&&validPaperApproval(this.document.approvals?.[m.id],m.pair)));
 }
 private async drain(){
  let sliceStart=performance.now(),processed=0;
  while(this.queue.size&&!this.stopping&&!this.failed){
   const id=this.queue.values().next().value!;this.queue.delete(id);const started=performance.now();
   try{await this.consider(id);}finally{this.source.measure?.('paperDecision',performance.now()-started);}
   // Awaiting already-resolved promises does not service socket/timer callbacks.
   // Bound a burst by both count and elapsed time, then yield to the I/O loop.
   if(this.queue.size&&(++processed>=16||performance.now()-sliceStart>=8)){
    this.source.measure?.('paperDecisionSlice',performance.now()-sliceStart);
    await yieldToIO();sliceStart=performance.now();processed=0;
   }
  }
 }
 private async consider(id:string){
  const d=this.document,s=d.state,m=this.source.mapping(id),now=Date.now(),reasons:string[]=[];
  if(!this.source.ready())reasons.push('Observer paused, recovering or persistence unavailable');
  if(d.halt)reasons.push(d.halt);
  if(!this.canEnter(m)){
   reasons.push('Settlement mapping unapproved');
   if(m){let assessment=this.settlementCache.get(m.pair);if(!assessment){assessment=assessSettlement(m.pair);this.settlementCache.set(m.pair,assessment);}
    reasons.push(`Settlement: ${assessment.blockers[0]}`);
   }
  }
  if(s.positions.some(p=>p.status==='unmatched'))reasons.push('Unmatched first-leg exposure');
  if(s.positions.some(p=>p.status!=='settled'&&(p.pair.a.id===m?.pair.a.id||p.pair.b.id===m?.pair.b.id)))reasons.push('Market already held');
  if(!s.startedAt||now>=s.startedAt+30*86400000)reasons.push('Paper challenge ended');
  const today=new Date(now).toISOString().slice(0,10);
  if(s.positions.filter(p=>p.closedAt&&new Date(p.closedAt).toISOString().slice(0,10)===today).reduce((n,p)=>n+(p.profit||0),0)<=-50000)reasons.push('Daily paper loss limit');
  if(!m){this.reject(id,reasons);return;}
  const a=this.usable(m.pair.a),b=this.usable(m.pair.b);
  if(!a&&b&&d.mode==='live-data'&&this.canEnter(m)&&this.source.ready()&&!d.halt){
   const raw=this.source.book('kalshi',m.pair.a.id);
   if(raw?.valid&&raw.connection==='LIVE'&&raw.source==='stream'&&this.source.healthy('kalshi',m.pair.a.id)){
    const promising=(['yes','no'] as const).some(side=>{const bid=(side==='yes'?raw.yesBids:raw.noBids)[0],other=m.pair.inverted?side:side==='yes'?'no':'yes',ask=b[other][0];return bid&&ask&&bid.price+ask.price<10000;});
    if(promising)this.source.requestSnapshot?.(m.pair.a.id);
   }
  }
  for(const market of [m.pair.a,m.pair.b]){
   const raw=this.source.book(market.venue,market.id),label=market.venue==='kalshi'?'Kalshi':'Polymarket US';
   if(!raw){reasons.push(`${label}: no stream book received`);continue;}
   if(!raw.valid)reasons.push(`${label}: book invalidated by sequence/recovery checks`);
   if(raw.connection!=='LIVE'||!this.source.healthy(market.venue,market.id))reasons.push(`${label}: stream connection unhealthy`);
   if(performance.now()-raw.receivedMono>s.settings.maxAge)reasons.push(`${label}: last book update exceeds 2 seconds`);
   if(raw.exchangeAt!==null&&now-raw.exchangeAt>s.settings.maxAge)reasons.push(`${label}: exchange timestamp exceeds 2 seconds`);
   if(raw.receivedAt>now+1000||raw.receivedMono>performance.now()||(raw.exchangeAt!==null&&raw.exchangeAt>now+1000))reasons.push(`${label}: clock/timestamp anomaly`);
   if(raw.source!==(d.mode==='synthetic'?'fixture':'stream'))reasons.push(`${label}: wrong data source for this ledger`);
  }
  if(!a||!b)reasons.push('Missing, stale, unhealthy or sequence-invalid stream book');
  const limits={...s.settings,maxDays:Math.min(s.settings.maxDays,Math.max(0,((s.startedAt||0)+30*86400000-now)/86400000)),maxTrade:Math.max(0,Math.min(s.settings.maxTrade,s.settings.maxCommitted-totals(s).committed))};
  const pair={...m.pair,reviewed:this.canEnter(m),...(!isVerified(m)&&this.canEnter(m)?{paperApproval:this.document.approvals![m.id]}:{})};
  const q=a&&b?assess(pair,a,b,limits,s.cash,now):null;
  if(a&&b&&!q)reasons.push('No size within cash/depth limits or missing fee/minimum metadata');
  if(a&&b&&this.canEnter(m)&&!reasons.length){
   const plans=d.diagnostics!.makerPlans;plans.evaluated++;
   const plan=makerPlan(pair,a,b,limits,s.cash,now);
   if(plan){plans.eligible++;const sample={pairId:id,title:pair.a.title,at:now,quantity:plan.quote.quantity,bidUSD:plan.price/10000,ahead:plan.ahead,netUSD:plan.quote.profit/10000};
    const old=plans.best.find(x=>x.pairId===id);if(!old||sample.netUSD>old.netUSD){plans.best=plans.best.filter(x=>x.pairId!==id);plans.best.push(sample);plans.best.sort((a,b)=>b.netUSD-a.netUSD);plans.best=plans.best.slice(0,20);}
   }
  }
  if(q)reasons.push(...q.reasons);
  recordDiagnostic(d.diagnostics!,{pair,approved:this.canEnter(m),usable:!!a&&!!b,a:this.source.book(pair.a.venue,pair.a.id),b:this.source.book(pair.b.venue,pair.b.id),quote:q,reasons,at:now});
  if(reasons.length||!q?.eligible){this.reject(id,[...new Set(reasons)]);return;}
  // Prior observer evidence/verification must be durable before reserving simulated cash.
  await this.source.barrier();
  const current=this.source.mapping(id);
  if(this.stopping||!this.source.ready()||!current||!this.canEnter(current)||current.pair.a.hash!==pair.a.hash||current.pair.b.hash!==pair.b.hash||current.pair.inverted!==pair.inverted||this.usable(pair.a)!==a||this.usable(pair.b)!==b){this.reject(id,['Entry evidence changed before reservation']);return;}
  const positionId=randomUUID();
  d.state=enter(s,pair,q,positionId);d.pendingId=positionId;this.persist();
  await this.delay();
  const latest=this.source.mapping(id),valid=this.source.ready()&&latest&&this.canEnter(latest)&&latest.pair.a.hash===pair.a.hash&&latest.pair.b.hash===pair.b.hash&&latest.pair.inverted===pair.inverted;
  d.state=completePaperHedge(d.state,positionId,this.usable(pair.a)||empty(),valid?(this.usable(pair.b)||empty()):empty());
  d.pendingId=null;
  const position=d.state.positions.find(p=>p.id===positionId)!;
  if(position.status!=='open')d.halt=position.status==='unmatched'?'Unmatched first-leg exposure':'Failed hedge unwound; paper entries halted for review';
  log(d.state,'stream paper execution',`${position.status}: ${pair.a.title}; reaction ${Date.now()-now}ms including 500ms modeled hedge delay`);
  this.reject(id,[position.status==='open'?'Paper position opened':d.halt!]);this.persist();
 }
 async settle(lookup:(venue:Venue,id:string)=>Promise<Pick<Market,'settlement'>>){
  if(this.task||this.failed||this.stopping)return;
  this.task=(async()=>{this.document.state=await checkSettlements(this.document.state,lookup);this.persist();})()
   .catch(e=>{this.failed=true;this.document.halt=String(e);}).finally(()=>{this.task=null;if(this.queue.size&&!this.stopping)this.notify(this.queue.values().next().value!);});
  await this.task;
 }
 flush(){if(!this.failed)this.persist();}
 async stop(){this.stopping=true;this.queue.clear();await this.task;this.flush();}
}
export function attachPaperBot(observer:Observer,store:PaperStore,mode:'live-data'|'synthetic',delay?:()=>Promise<void>){
 const bot=new PaperBot(store,{mapping:id=>observer.registry.get(id),book:(v,id)=>observer.recorder.books.get(`${v}:${id}`),
  healthy:(v,id)=>observer.recorder.streamHealthy(v,id),ready:()=>!observer.paused&&!observer.stopped&&!observer.recorder.failed,
  requestSnapshot:id=>observer.requestPaperSnapshot(id),barrier:()=>observer.recorder.send('barrier',{}),measure:(name,ms)=>observer.telemetry.sample(name,ms)},mode,delay);
 observer.paperSettlementDeadline=()=>Math.min(Date.now()+bot.document.state.settings.maxDays*86400000,(bot.document.state.startedAt??0)+30*86400000);
 observer.paperPriorityIds=()=>observer.registry.list().filter(m=>m.active&&validPaperApproval(bot.document.approvals?.[m.id],m.pair)).map(m=>m.id);
 observer.recorder.onBook=book=>{for(const m of observer.recorder.index.get(`${book.venue}:${book.marketId}`)||[]){if(observer.capacity?.selectedIds.includes(m.id))bot.notify(m.id);}};
 return bot;
}
