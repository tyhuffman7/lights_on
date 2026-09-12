import {randomUUID} from 'node:crypto';
import {MakerActivity,makerActivityScore} from '../lib/arb/maker-activity.ts';
import {MakerQueue,kalshiSellPrint} from '../lib/arb/maker-evidence.ts';
import {reserveMaker,makerFill,hedgeMaker,closeMaker} from '../lib/arb/maker-ledger.ts';
import {makerPlan} from '../lib/arb/maker-plan.ts';import {validPaperApproval} from '../lib/arb/paper-approval.ts';
import {isVerified} from '../lib/research/mappings.ts';import {fresh} from '../lib/research/books.ts';
import {checkSettlements} from '../lib/arb/settlement.ts';import {totals} from '../lib/arb/ledger.ts';
import type {Observer} from './observer.ts';import type {PaperStore,PaperDocument} from './paper-store.ts';
import type {Venue,Market,Pair} from '../lib/arb/types.ts';
export class MakerRunner{
 observer:Observer;store:PaperStore;document:PaperDocument;failed=false;stopping=false;busy=false;task:Promise<void>|null=null;
 activity=new MakerActivity();
 queue:MakerQueue|null=null;trades:{message:Record<string,any>;wall:number}[]=[];timer:ReturnType<typeof setInterval>;lastAttempt=0;
 constructor(observer:Observer,store:PaperStore){
  this.observer=observer;this.store=store;this.document=store.load('live-data');
  const d=this.document;d.executionMode='maker';delete d.diagnostics;
  if(d.pendingId)throw Error('Taker hedge recovery required before maker mode');
  if(d.makerOrder){d.state=closeMaker(d.state,d.makerOrder);delete d.makerOrder;if(d.state.positions.some(p=>p.status==='unmatched'))d.halt='Maker restart recovered unmatched exposure';}
  if(d.state.makerReserved)throw Error('Orphaned maker reservation requires reconciliation');
  this.flush();observer.paperSettlementDeadline=()=>Math.min(Date.now()+d.state.settings.maxDays*86400000,(d.state.startedAt??0)+30*86400000);
  observer.paperPriorityIds=()=>observer.registry.list().filter(m=>this.approved(m.id)).map(m=>m.id);
  observer.paperTradeSink=(message,wall)=>{if(this.stopping)return;const print=kalshiSellPrint(message);if(print)this.activity.observe(print,wall);if(!this.queue||print?.marketId!==this.queue.marketId)return;if(this.trades.length>=1000){d.halt='Maker trade queue overflow';this.failed=true;return;}this.trades.push({message,wall});};
  this.timer=setInterval(()=>{if(!this.busy&&!this.stopping&&!this.failed){this.task=this.tick().catch(e=>{this.failed=true;d.halt=String(e);}).finally(()=>{this.task=null;});}},100);
 }
 approved(id:string){const m=this.observer.registry.get(id);return !!m&&m.active&&(isVerified(m)||validPaperApproval(this.document.approvals?.[id],m.pair));}
 book(v:Venue,id:string){const b=this.observer.recorder.books.get(v+':'+id);return b?.source==='stream'&&this.observer.recorder.streamHealthy(v,id)&&fresh(b,performance.now(),Date.now(),this.document.state.settings.maxAge)?b:null;}
 flush(){try{this.store.save(this.document);}catch(e){this.failed=true;throw e;}}
 async tick(){
  if(this.busy)return;this.busy=true;
  try{
   const d=this.document,s=d.state,now=Date.now();
   if(d.makerOrder&&this.queue){
    const o=d.makerOrder,events=this.trades.splice(0);
    if(events.length){await this.observer.recorder.send('barrier',{});for(const e of events){const t=kalshiSellPrint(e.message);if(t){if(t.marketId===this.queue.marketId){d.counts['Maker same-market prints']=(d.counts['Maker same-market prints']??0)+1;}const n=this.queue.consume(t,e.wall);if(n){o.tradeIds.push(t.id);makerFill(o,n,e.wall);this.flush();}}}}
    const m=this.observer.registry.get(o.pair.id),a=this.book('kalshi',o.pair.a.id),b=this.book('poly',o.pair.b.id);
    const valid=!this.observer.paused&&!this.observer.stopped&&this.approved(o.pair.id)&&m?.pair.a.hash===o.pair.a.hash&&m?.pair.b.hash===o.pair.b.hash&&m?.pair.inverted===o.pair.inverted;
    if(!valid||!a||!b||d.halt||o.aCost+o.aFees>o.reservedA){o.expiresAt=Math.min(o.expiresAt,Date.now()+250);this.queue.expiresAt=o.expiresAt;}
    if(valid&&b&&hedgeMaker(o,b,Date.now(),s.settings.maxAge))this.flush();
    if(Date.now()>=o.expiresAt&&(o.hedgeDue===null||Date.now()>=o.hedgeDue))this.finish();
    return;
   }
   if(d.halt||this.observer.paused||this.observer.stopped||this.observer.recorder.failed||now-this.lastAttempt<10000||s.positions.some(p=>p.status==='unmatched')||!s.startedAt||now>=s.startedAt+30*86400000)return;
   if(s.positions.filter(p=>p.closedAt&&new Date(p.closedAt).toISOString().slice(0,10)===new Date(now).toISOString().slice(0,10)).reduce((n,p)=>n+(p.profit??0),0)<=-50000)return;
   this.lastAttempt=now;
   let best:ReturnType<typeof makerPlan>=null,bestPair:Pair|null=null,bestScore=-1,eligible=0,activeEligible=0;
   for(const id of this.observer.capacity?.selectedIds??[]){
    const m=this.observer.registry.get(id);if(!m||!this.approved(id)||s.positions.some(p=>p.status!=='settled'&&(p.pair.a.id===m.pair.a.id||p.pair.b.id===m.pair.b.id)))continue;
    const a=this.book('kalshi',m.pair.a.id),b=this.book('poly',m.pair.b.id);if(!a&&b)this.observer.requestPaperSnapshot(m.pair.a.id);if(!a||!b)continue;
    const pair={...m.pair,reviewed:true,...(!isVerified(m)?{paperApproval:d.approvals![id]}:{})};
    const plan=makerPlan(pair,a,b,{...s.settings,maxTrade:Math.max(0,Math.min(s.settings.maxTrade,s.settings.maxCommitted-totals(s).committed)),maxDays:Math.min(s.settings.maxDays,(s.startedAt+30*86400000-now)/86400000)},s.cash,now,true);
    if(plan){eligible++;const volume=this.activity.volume(pair.a.id,plan.quote.aSide,plan.price,now),score=makerActivityScore(volume,plan.ahead,plan.quote.quantity,plan.quote.profit);if(volume>0)activeEligible++;
     if(!best||score>bestScore||(score===bestScore&&plan.quote.profit>best.quote.profit)){best=plan;bestPair=pair;bestScore=score;}
    }
   }
   this.observer.recorder.diagnostic('PAPER_MAKER_SELECTION',{eligible,activeEligible,selectedPair:bestPair?.id??null,score:bestScore,scope:'RECENT_TRADE_SELECTION_HINT_ONLY'});
   if(!best||!bestPair)return;
   await this.observer.recorder.send('barrier',{});
   const m=this.observer.registry.get(bestPair.id),a=this.book('kalshi',bestPair.a.id),b=this.book('poly',bestPair.b.id);
   if(this.stopping||this.observer.paused||!this.approved(bestPair.id)||!m||m.pair.a.hash!==bestPair.a.hash||m.pair.b.hash!==bestPair.b.hash||m.pair.inverted!==bestPair.inverted||!a||!b)return;
   const current=makerPlan(bestPair,a,b,{...s.settings,maxTrade:Math.max(0,Math.min(s.settings.maxTrade,s.settings.maxCommitted-totals(s).committed)),maxDays:Math.min(s.settings.maxDays,((s.startedAt??0)+30*86400000-Date.now())/86400000)},s.cash,Date.now(),true);if(!current)return;
   const reserved=reserveMaker(s,bestPair,current.quote,randomUUID(),current.price);d.state=reserved.state;d.makerOrder=reserved.order;d.makerOrder.initialQueueAhead=current.ahead;
   this.queue=new MakerQueue(bestPair.a.id,current.quote.aSide,current.price,current.quote.quantity,current.ahead,reserved.order.activeAt,reserved.order.expiresAt);this.trades=[];this.observer.recorder.diagnostic('PAPER_MAKER_ORDER',{order:reserved.order,initialQueueAhead:current.ahead,recentExecutableSellVolume:this.activity.volume(bestPair.a.id,current.quote.aSide,current.price,Date.now()),scope:'SIMULATED_RESTING_ORDER'});d.counts['Maker orders posted']=(d.counts['Maker orders posted']??0)+1;this.flush();
  }finally{this.busy=false;}
 }
 finish(){const d=this.document,o=d.makerOrder;if(!o)return;d.state=closeMaker(d.state,o);this.observer.recorder.diagnostic('PAPER_MAKER_CLOSE',{id:o.id,filledA:o.filledA,filledB:o.filledB,scope:'SIMULATED_RESTING_ORDER'});delete d.makerOrder;this.queue?.invalidate();this.queue=null;this.trades=[];
  d.counts[o.filledA?'Maker orders with fills':'Maker orders cancelled unfilled']=(d.counts[o.filledA?'Maker orders with fills':'Maker orders cancelled unfilled']??0)+1;
  if(d.state.positions.some(p=>p.status==='unmatched'))d.halt='Maker partial fill left unhedged exposure';if(d.state.cash.kalshi<0||d.state.cash.poly<0)d.halt='Maker fragmentation exceeded reserved cash';this.flush();}
 async settle(lookup:(venue:Venue,id:string)=>Promise<Pick<Market,'settlement'>>){if(this.busy||this.stopping||this.document.makerOrder||this.failed)return;this.busy=true;this.task=(async()=>{this.document.state=await checkSettlements(this.document.state,lookup);this.flush();})().catch(e=>{this.failed=true;this.document.halt=String(e);}).finally(()=>{this.busy=false;this.task=null;});await this.task;}
 async stop(){this.stopping=true;clearInterval(this.timer);await this.task;if(this.document.makerOrder)await this.tick();this.finish();this.observer.paperTradeSink=undefined;this.flush();}
}
