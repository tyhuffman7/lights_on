import {observedSizeAdmission} from '../lib/arb/maker-size-admission.ts';
import {hedgeBookState,compactHedgeBook,hedgeEconomics} from './hedge-diagnostics.ts';
import {planExit,applyExitLeg,type ExitPlan} from '../lib/arb/paper-exit.ts';
import {usableMakerFee,type MakerFeeProfile} from '../lib/arb/maker-fees.ts';
import {clockUsable,type ClockWindow} from '../lib/arb/clock-window.ts';
import {randomUUID} from 'node:crypto';
import {MakerActivity,makerActivityScore} from '../lib/arb/maker-activity.ts';
import {MakerQueue,kalshiSellPrint} from '../lib/arb/maker-evidence.ts';
import {reserveMaker,makerFill,hedgeMaker,closeMaker,makerHedgeViable} from '../lib/arb/maker-ledger.ts';
import {competitiveMakerPlan as makerPlan,competitiveMakerPlans as makerPlans,refreshMakerPlan} from '../lib/arb/maker-plan.ts';import {validPaperApproval} from '../lib/arb/paper-approval.ts';
import {isVerified} from '../lib/research/mappings.ts';
import {checkSettlements} from '../lib/arb/settlement.ts';import {totals} from '../lib/arb/ledger.ts';
import type {Observer} from './observer.ts';import type {PaperStore,PaperDocument} from './paper-store.ts';
import type {Venue,Market,Pair,Position,Book} from '../lib/arb/types.ts';
export class MakerRunner{
 exitOrder:{plan:ExitPlan;index:number}|null=null;
 observer:Observer;store:PaperStore;document:PaperDocument;failed=false;stopping=false;busy=false;task:Promise<void>|null=null;
 requireRecentActivity:boolean;
 fees:()=>Map<string,MakerFeeProfile>;
 clock:()=>ClockWindow|undefined;requireClock=false;
 activity=new MakerActivity();pending=new Set<string>();priorityPending=new Set<string>();
 wakeTimer:ReturnType<typeof setImmediate>|null=null;
 bookSink:NonNullable<Observer['recorder']['onBook']>;
 queue:MakerQueue|null=null;trades:{message:Record<string,any>;wall:number;mono:number}[]=[];timer:ReturnType<typeof setInterval>;lastAttempt=0;
 hedgeTiming:{receivedAt:number;receivedMono:number;processedAt:number;processedMono:number}|null=null;
 constructor(observer:Observer,store:PaperStore,clock?:()=>ClockWindow|undefined,fees:()=>Map<string,MakerFeeProfile>=()=>new Map(),requireRecentActivity=false){
  this.fees=fees;this.requireRecentActivity=requireRecentActivity;
  this.clock=clock??(()=>undefined);this.requireClock=!!clock;
  this.observer=observer;this.store=store;this.document=store.load('live-data');
  const d=this.document;d.executionMode='maker';delete d.diagnostics;
  if(d.pendingId)throw Error('Taker hedge recovery required before maker mode');
  if(d.makerOrder){d.state=closeMaker(d.state,d.makerOrder);delete d.makerOrder;if(d.state.positions.some(p=>p.status==='unmatched'))d.halt='Maker restart recovered unmatched exposure';}
  if(d.state.makerReserved)throw Error('Orphaned maker reservation requires reconciliation');
  this.flush();observer.paperSettlementDeadline=()=>Math.min(Date.now()+d.state.settings.maxDays*86400000,(d.state.startedAt??0)+30*86400000);
  observer.paperPriorityIds=()=>{const started=performance.now();const ids=observer.registry.list().filter(m=>this.approved(m.id)).map(m=>m.id);observer.telemetry?.sample('paperApprovalScan',performance.now()-started);return ids;};
  observer.paperTradeSink=(message,wall,mono)=>{if(this.stopping)return;const print=kalshiSellPrint(message);if(print&&this.activity.observe(print,wall)){for(const m of observer.recorder.index?.get('kalshi:'+print.marketId)||[])if(observer.capacity?.selectedIds.includes(m.id))this.notify(m.id,true);}if(!this.queue||print?.marketId!==this.queue.marketId)return;if(this.trades.length>=1000){d.halt='Maker trade queue overflow';this.failed=true;return;}this.trades.push({message,wall,mono});this.wake();};
  this.bookSink=book=>{if(this.stopping||this.failed)return;for(const m of observer.recorder.index?.get(`${book.venue}:${book.marketId}`)||[]){if(observer.capacity?.selectedIds.includes(m.id))this.notify(m.id);}if(this.document.makerOrder&&(book.marketId===this.document.makerOrder.pair.a.id||book.marketId===this.document.makerOrder.pair.b.id))this.wake();};
  observer.recorder.onBook=this.bookSink;
  this.timer=setInterval(()=>{if(!this.busy&&!this.stopping&&!this.failed){this.task=this.tick().catch(e=>{this.failed=true;d.halt=String(e);}).finally(()=>{this.task=null;});}},100);
 }
 wake(){if(this.wakeTimer||this.stopping||this.failed)return;this.wakeTimer=setImmediate(()=>{this.wakeTimer=null;if(this.busy||this.stopping||this.failed)return;this.task=this.tick().catch(e=>{this.failed=true;this.document.halt=String(e);}).finally(()=>{this.task=null;});});}
 notify(id:string,priority=false){if(this.stopping||this.failed)return;if(this.pending.size>=1000&&!this.pending.has(id)){this.document.counts['Maker evaluation queue full']=(this.document.counts['Maker evaluation queue full']??0)+1;return;}this.pending.add(id);if(priority)this.priorityPending.add(id);this.wake();}
 fee(pair:Pair,now:number){const p=this.fees().get(pair.a.series??'');return usableMakerFee(p,pair.a.series,pair.a.feeRate,now)?p:undefined;}
 sizeAdmission(pair:Pair,plan:NonNullable<ReturnType<typeof makerPlan>>,now:number,rate?:number){
  return observedSizeAdmission({price:plan.price,quantity:plan.quote.quantity,hedgeLevels:plan.quote.bFill.levels,hedgeStep:pair.b.minQty,makerRate:rate??pair.a.feeRate!,hedgeRate:pair.b.feeRate!,reserve:this.document.state.settings.reserve,sizes:this.activity.sizes(pair.a.id,plan.quote.aSide,plan.price,now)});
 }
 approved(id:string){const m=this.observer.registry.get(id);return !!m&&m.active&&(isVerified(m)||validPaperApproval(this.document.approvals?.[id],m.pair));}
 bookState(v:Venue,id:string){const raw=this.observer.recorder.books.get(v+':'+id),healthy=raw?.source==='stream'?this.observer.recorder.streamHealthy(v,id):null;return hedgeBookState(raw,healthy,Date.now(),performance.now(),this.document.state.settings.maxAge);}
 book(v:Venue,id:string){const view=this.bookState(v,id);return view.usable?view.raw!:null;}
 flush(){const started=performance.now();try{this.store.save(this.document);}catch(e){this.failed=true;throw e;}finally{const ms=performance.now()-started;this.observer.telemetry?.sample('paperLedgerWrite',ms);if(ms>25)this.observer.recorder.diagnostic('PAPER_SLOW_OPERATION',{operation:'ledgerSave',ms});}}
 cancel(reason:string){const o=this.document.makerOrder;if(!o||!this.queue||o.cancelRequestedAt!==undefined)return;
  o.cancelRequestedAt=Date.now();o.expiresAt=Math.min(o.expiresAt,o.cancelRequestedAt+250);this.queue.expiresAt=o.expiresAt;
  this.observer.recorder.diagnostic('PAPER_MAKER_CANCEL_REQUEST',{id:o.id,at:o.cancelRequestedAt,effectiveAt:o.expiresAt,reason,filledA:o.filledA,filledB:o.filledB,scope:'SIMULATED_CANCELLATION_WITH_TRANSPORT_DELAY'});
  this.document.counts['Maker cancellations requested']=(this.document.counts['Maker cancellations requested']??0)+1;this.flush();
 }
 exitBook(p:Position,key:'a'|'b'){
  const m=this.observer.registry.get(p.pair.id)?.pair[key],original=p.pair[key];
  if(!m?.open||m.hash!==original.hash||m.feeRate!==original.feeRate||m.minQty!==original.minQty)return null;
  return this.book(key==='a'?'kalshi':'poly',m.id);
 }
 manageExits(now:number){
  const d=this.document;
  if(this.stopping||this.failed||this.observer.paused||this.observer.stopped||this.observer.recorder.failed)return false;
  if(this.exitOrder){
   const pending=this.exitOrder,leg=pending.plan.legs[pending.index],p=d.state.positions.find(p=>p.id===pending.plan.positionId);
   if(now<pending.plan.requestedAt+500)return true;
   const b=p&&this.exitBook(p,leg.key);
   const next=b&&now-pending.plan.requestedAt<=2500?applyExitLeg(d.state,pending.plan,leg.key,b,now,'DELAYED_STREAM_DEPTH_PAPER_NOT_REAL_FILL'):d.state;
   if(next===d.state){this.observer.recorder.diagnostic('PAPER_EXIT_NOT_FILLED',{id:pending.plan.positionId,key:leg.key,at:now,book:b});this.exitOrder=null;if(p?.status==='unmatched')d.halt??='Paper early exit left unhedged exposure';this.flush();return true;}
   d.state=next;const updated=next.positions.find(p=>p.id===pending.plan.positionId)!;
   this.observer.recorder.diagnostic('PAPER_EXIT_FILL',{id:updated.id,evidence:updated.paperExits?.at(-1),profit:updated.profit??null});this.flush();
   pending.index++;
   if(pending.index>=pending.plan.legs.length)this.exitOrder=null;
   else {pending.plan={...pending.plan,requestedAt:now};this.observer.recorder.diagnostic('PAPER_EXIT_INTENT',{plan:pending.plan,index:pending.index});}
   return true;
  }
  for(const p of d.state.positions){
   if(p.status==='settled')continue;const books:Partial<Record<'a'|'b',Book>>={};
   for(const key of ['a','b'] as const){const b=p[`${key}Payout`]===undefined?this.exitBook(p,key):null;if(b)books[key]=b;}
   const plan=planExit(d.state,p.id,books,now);if(!plan)continue;
   this.exitOrder={plan,index:0};this.observer.recorder.diagnostic('PAPER_EXIT_INTENT',{plan,index:0});return true;
  }
  return false;
 }
 async tick(){
  if(this.busy)return;this.busy=true;
  try{
   const d=this.document,s=d.state,now=Date.now();
   if(d.makerOrder&&this.queue){
    const o=d.makerOrder;
    const restingHedge=this.book('poly',o.pair.b.id);
    if(!restingHedge||!makerHedgeViable(o,restingHedge,s.settings))this.cancel('HEDGE_NO_LONGER_VIABLE');
    // Validate post-only placement after the simulated transport delay. Never
    // apply a maker fee to an order that would cross on arrival, or backdate
    // activation using a later book snapshot.
    if(!o.activationChecked){
     if(now<o.activeAt)return;
     const m=this.observer.registry.get(o.pair.id),a=this.book('kalshi',o.pair.a.id);
     const valid=!this.observer.paused&&!this.observer.stopped&&!this.stopping&&!d.halt&&this.approved(o.pair.id)&&m?.pair.a.hash===o.pair.a.hash&&m?.pair.b.hash===o.pair.b.hash&&m?.pair.inverted===o.pair.inverted;
     const ask=a?.[o.quote.aSide][0];
     if(!valid||!a?.open||!ask||ask.price<=o.price||now>=o.expiresAt||(this.requireClock&&(!o.clock||!clockUsable(o.clock,now,performance.now())))){
      this.observer.recorder.diagnostic('PAPER_MAKER_ACTIVATION_REJECTED',{id:o.id,bid:o.price,ask:ask?.price??null,valid,scope:'POST_ONLY_PAPER'});
      d.counts['Maker activation rejected']=(d.counts['Maker activation rejected']??0)+1;this.finish();return;
     }
     // Orders already visible at arrival have time priority over this order.
     // Keep the larger placement/arrival queue; never credit cancellations.
     const arrivalAhead=(o.quote.aSide==='yes'?a!.yesBids:a!.noBids).filter(l=>l.price>=o.price).reduce((n,l)=>n+l.quantity,0);
     this.queue.ahead=Math.max(this.queue.ahead,arrivalAhead);o.initialQueueAhead=this.queue.ahead;
     o.activationChecked=true;o.activeAt=now;this.queue.activeAt=now;
     this.observer.recorder.diagnostic('PAPER_MAKER_ACTIVATION',{id:o.id,activeAt:now,bid:o.price,ask:ask.price,queueAhead:this.queue.ahead,scope:'POST_ONLY_PAPER'});this.flush();
     // Evidence received before this validation cannot establish a later fill.
     this.trades=[];const hedgeBook=this.book('poly',o.pair.b.id);if(!hedgeBook||!makerHedgeViable(o,hedgeBook,s.settings))this.cancel('HEDGE_NO_LONGER_VIABLE');return;
    }
    const events=this.trades.splice(0);
    if(events.length){await this.observer.recorder.send('barrier',{});for(const e of events){const t=kalshiSellPrint(e.message);if(t){if(t.marketId===this.queue.marketId){d.counts['Maker same-market prints']=(d.counts['Maker same-market prints']??0)+1;}const n=this.queue.consume(t,e.wall,e.mono);if(n){const timing={receivedAt:e.wall,receivedMono:e.mono,processedAt:Date.now(),processedMono:performance.now()};if(o.hedgeDue===null)this.hedgeTiming=timing;o.tradeIds.push(t.id);makerFill(o,n,e.wall);this.observer.recorder.diagnostic('PAPER_MAKER_FILL',{id:o.id,tradeId:t.id,quantity:n,filledA:o.filledA,...timing,hedgeDue:o.hedgeDue,queueAhead:this.queue.ahead});this.flush();}}}}
    const m=this.observer.registry.get(o.pair.id),av=this.bookState('kalshi',o.pair.a.id),bv=this.bookState('poly',o.pair.b.id),a=av.usable?av.raw!:null,b=bv.usable?bv.raw!:null;
    const outer={paused:this.observer.paused,stopped:this.observer.stopped,approved:this.approved(o.pair.id),aHashMatches:m?.pair.a.hash===o.pair.a.hash,bHashMatches:m?.pair.b.hash===o.pair.b.hash,inversionMatches:m?.pair.inverted===o.pair.inverted};
    const valid=!outer.paused&&!outer.stopped&&outer.approved&&outer.aHashMatches&&outer.bHashMatches&&outer.inversionMatches;
    if(!valid||!a||!b||d.halt||o.aCost+o.aFees>o.reservedA)this.cancel('EXECUTION_STATE_INVALID');
    else if(!makerHedgeViable(o,b,s.settings))this.cancel('HEDGE_NO_LONGER_VIABLE');
    const hedgeAt=Date.now(),hedgeDue=o.hedgeDue,priorHedge=o.filledB,priorCost=o.bCost,priorFees=o.bFees;
    const hedgeMono=performance.now(),exposure=o.filledA-priorHedge;
    const record=(decision:import('../lib/arb/maker-ledger.ts').HedgeDecision)=>{if(exposure<=0)return;this.observer.recorder.diagnostic('PAPER_MAKER_HEDGE_DECISION',{id:o.id,at:hedgeAt,mono:hedgeMono,fillTiming:this.hedgeTiming,hedgeDue,remaining:decision.remaining,reason:decision.reason,called:valid&&!!b,outer:{...outer,valid,halt:d.halt??null,stopping:this.stopping,recorderFailed:this.observer.recorder.failed,aWithinReservation:o.aCost+o.aFees<=o.reservedA},kalshiBook:compactHedgeBook(av),polyBook:compactHedgeBook(bv),...hedgeEconomics(o,bv,decision),priorPrincipal:priorCost,priorFees,reservedB:o.reservedB,reservePerContract:s.settings.reserve,expiresAt:o.expiresAt,cancelRequestedAt:o.cancelRequestedAt??null,scope:'ACTUAL_PAPER_DECISION_NOT_EXCHANGE_RESPONSE'});};
    if(!valid||!b)record({reason:!valid?'OUTER_STATE_INVALID':bv.reason??'BOOK_UNUSABLE',remaining:exposure,fill:null});
    if(valid&&b&&hedgeMaker(o,b,hedgeAt,s.settings.maxAge,record)){this.observer.recorder.diagnostic('PAPER_MAKER_HEDGE',{id:o.id,at:hedgeAt,hedgeDue,quantity:o.filledB-priorHedge,cost:o.bCost-priorCost,fees:o.bFees-priorFees,book:b,scope:'SIMULATED_DELAYED_HEDGE'});this.hedgeTiming=null;this.flush();}
    if(Date.now()>=o.expiresAt&&(o.hedgeDue===null||Date.now()>=o.hedgeDue))this.finish();
    return;
   }
   if(this.manageExits(Date.now()))return;
   if(d.halt||this.observer.paused||this.observer.stopped||this.observer.recorder.failed||s.positions.some(p=>p.status==='unmatched')||!s.startedAt||now>=s.startedAt+30*86400000)return;
   if(s.positions.filter(p=>p.closedAt&&new Date(p.closedAt).toISOString().slice(0,10)===new Date(now).toISOString().slice(0,10)).reduce((n,p)=>n+(p.profit??0),0)<=-50000)return;
   const clock=this.clock();if(this.requireClock&&(!clock||!clockUsable(clock,now,performance.now())||clock.expiresAt-now<3000))return;
   // Book callbacks coalesce changed pairs. The slower sweep bootstraps quiet
   // markets and retries real snapshot requests; it does not delay new updates.
   if(now-this.lastAttempt>=10000){this.lastAttempt=now;for(const id of this.observer.capacity?.selectedIds??[])this.notify(id);}
   if(!this.pending.size)return;
   const sliceStarted=performance.now();let processed=0;

   let best:ReturnType<typeof makerPlan>=null,bestPair:Pair|null=null,bestScore=-1,eligible=0,activeEligible=0;
   for(const id of new Set([...this.priorityPending,...this.pending])){
    if(processed>=16||(processed>0&&performance.now()-sliceStarted>=8))break;
    this.pending.delete(id);this.priorityPending.delete(id);processed++;
    if(!this.observer.capacity?.selectedIds.includes(id))continue;
    const m=this.observer.registry.get(id);if(!m||!this.approved(id)||s.positions.some(p=>p.status!=='settled'&&(p.pair.a.id===m.pair.a.id||p.pair.b.id===m.pair.b.id)))continue;
    const a=this.book('kalshi',m.pair.a.id),b=this.book('poly',m.pair.b.id);if(!a&&b)this.observer.requestPaperSnapshot(m.pair.a.id);if(!a||!b)continue;
    const pair={...m.pair,reviewed:true,...(!isVerified(m)?{paperApproval:d.approvals![id]}:{})};
    const volumes=new Map<string,number>();
    const plans=makerPlans(pair,a,b,{...s.settings,maxTrade:Math.max(0,Math.min(s.settings.maxTrade,s.settings.maxCommitted-totals(s).committed)),maxDays:Math.min(s.settings.maxDays,(s.startedAt+30*86400000-now)/86400000)},s.cash,now,this.fee(pair,now)?.rate,plan=>{const key=plan.quote.aSide+':'+plan.price;let volume=volumes.get(key);if(volume===undefined){volume=this.activity.volume(pair.a.id,plan.quote.aSide,plan.price,now);volumes.set(key,volume);}return makerActivityScore(volume,plan.ahead,plan.quote.quantity,plan.quote.profit);});
    for(const plan of plans){eligible++;const volume=this.activity.volume(pair.a.id,plan.quote.aSide,plan.price,now),score=makerActivityScore(volume,plan.ahead,plan.quote.quantity,plan.quote.profit);if(volume>0)activeEligible++;
     if(this.requireRecentActivity&&volume<=0){d.counts['Maker candidates without recent executable activity']=(d.counts['Maker candidates without recent executable activity']??0)+1;continue;}
     if(this.requireRecentActivity&&!this.sizeAdmission(pair,plan,now,this.fee(pair,now)?.rate).eligible){d.counts['Maker candidates failing observed-size economics']=(d.counts['Maker candidates failing observed-size economics']??0)+1;continue;}
     if(!best||score>bestScore||(score===bestScore&&plan.quote.profit>best.quote.profit)){best=plan;bestPair=pair;bestScore=score;}
    }
   }
   this.observer.telemetry?.sample('makerSelectionSlice',performance.now()-sliceStarted);
   d.counts['Maker pairs evaluated']=(d.counts['Maker pairs evaluated']??0)+processed;
   this.observer.recorder.diagnostic('PAPER_MAKER_SELECTION',{processed,pending:this.pending.size,eligible,activeEligible,inactiveEligible:eligible-activeEligible,inactiveFallbackReason:bestPair&&activeEligible===0&&!this.requireRecentActivity?'ACTIVITY_OPTIONAL_QUOTE_ONLY':null,selectedPair:bestPair?.id??null,score:bestScore,scope:'RECENT_TRADE_SELECTION_HINT_ONLY'});
   if(!best||!bestPair)return;
   await this.observer.recorder.send('barrier',{});
   const m=this.observer.registry.get(bestPair.id),a=this.book('kalshi',bestPair.a.id),b=this.book('poly',bestPair.b.id);
   if(this.stopping||this.observer.paused||!this.approved(bestPair.id)||!m||m.pair.a.hash!==bestPair.a.hash||m.pair.b.hash!==bestPair.b.hash||m.pair.inverted!==bestPair.inverted||!a||!b)return;
   if(this.requireClock&&(!clock||!clockUsable(clock,Date.now(),performance.now())||clock.expiresAt-Date.now()<3000))return;
   const feeProfile=this.fee(bestPair,Date.now());
   const current=refreshMakerPlan(bestPair,a,b,{...s.settings,maxTrade:Math.max(0,Math.min(s.settings.maxTrade,s.settings.maxCommitted-totals(s).committed)),maxDays:Math.min(s.settings.maxDays,((s.startedAt??0)+30*86400000-Date.now())/86400000)},s.cash,best,Date.now(),feeProfile?.rate);if(!current)return;
   const currentVolume=this.activity.volume(bestPair.a.id,current.quote.aSide,current.price,Date.now());
   if(this.requireRecentActivity&&currentVolume<=0){this.observer.recorder.diagnostic('PAPER_MAKER_ADMISSION_REJECTED',{id:bestPair.id,reason:'ACTIVITY_GONE_ON_REFRESH'});return;}
   const sizeAdmission=this.requireRecentActivity?this.sizeAdmission(bestPair,current,Date.now(),feeProfile?.rate):undefined;
   if(sizeAdmission&&!sizeAdmission.eligible){this.observer.recorder.diagnostic('PAPER_MAKER_ADMISSION_REJECTED',{id:bestPair.id,reason:'SIZE_ECONOMICS_ON_REFRESH',sizeAdmission});return;}
   const reserved=reserveMaker(s,bestPair,current.quote,randomUUID(),current.price);d.state=reserved.state;d.makerOrder=reserved.order;d.makerOrder.initialQueueAhead=current.ahead;d.makerOrder.clock=clock;d.makerOrder.makerFeeProfile=feeProfile;
   this.queue=new MakerQueue(bestPair.a.id,current.quote.aSide,current.price,current.quote.quantity,current.ahead,reserved.order.activeAt,reserved.order.expiresAt,clock);this.trades=[];this.observer.recorder.diagnostic('PAPER_MAKER_ORDER',{order:reserved.order,initialQueueAhead:current.ahead,recentExecutableSellVolume:currentVolume,sizeAdmission,entryPolicy:this.requireRecentActivity?'RECENT_ACTIVITY_POSITIVE_OBSERVED_SIZES':'QUOTE_ONLY',scope:'SIMULATED_RESTING_ORDER'});d.counts['Maker orders posted']=(d.counts['Maker orders posted']??0)+1;this.flush();
  }finally{this.busy=false;}
 }
 finish(){const d=this.document,o=d.makerOrder;if(!o)return;d.state=closeMaker(d.state,o);this.observer.recorder.diagnostic('PAPER_MAKER_CLOSE',{id:o.id,filledA:o.filledA,filledB:o.filledB,scope:'SIMULATED_RESTING_ORDER'});delete d.makerOrder;this.queue?.invalidate();this.queue=null;this.trades=[];this.hedgeTiming=null;
  d.counts[o.filledA?'Maker orders with fills':'Maker orders cancelled unfilled']=(d.counts[o.filledA?'Maker orders with fills':'Maker orders cancelled unfilled']??0)+1;
  if(d.state.positions.some(p=>p.status==='unmatched'))d.halt='Maker partial fill left unhedged exposure';if(d.state.cash.kalshi<0||d.state.cash.poly<0)d.halt='Maker fragmentation exceeded reserved cash';this.flush();}
 async settle(lookup:(venue:Venue,id:string)=>Promise<Pick<Market,'settlement'>>){if(this.busy||this.stopping||this.document.makerOrder||this.exitOrder||this.failed)return;this.busy=true;this.task=(async()=>{this.document.state=await checkSettlements(this.document.state,lookup);this.flush();})().catch(e=>{this.failed=true;this.document.halt=String(e);}).finally(()=>{this.busy=false;this.task=null;});await this.task;}
 async stop(){this.stopping=true;clearInterval(this.timer);if(this.wakeTimer)clearImmediate(this.wakeTimer);this.wakeTimer=null;await this.task;if(this.document.makerOrder)await this.tick();this.finish();if(this.exitOrder&&this.document.state.positions.some(p=>p.status==='unmatched'))this.document.halt??='Paper early exit left unhedged exposure';this.exitOrder=null;this.observer.paperTradeSink=undefined;if(this.observer.recorder.onBook===this.bookSink)this.observer.recorder.onBook=null;this.pending.clear();this.priorityPending.clear();this.flush();}
}
