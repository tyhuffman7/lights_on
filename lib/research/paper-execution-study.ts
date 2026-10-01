// Public native-book counterfactuals only. No order/account/ledger interfaces.
import type {Side,Venue,Level} from '../arb/types.ts';
import {currentBook,bookAges,type RecallRoute,type ObservedBook} from './recall-detector.ts';
import {evaluateEvArb,normalFee,takeDepth,USD_SCALE,type ArbEvaluation,type Taken} from './ev-arb.ts';
import {isPromoted} from './semantic-lists.ts';
import type {paperSettlement} from './hot-confirmation.ts';
export const executionStudyPolicy=Object.freeze({version:1,ordersEnabled:false,latenciesMs:[0,10,25,50,100,250,500,1000],
 capitalCapsDollars:[5,10,25,50,100],baselineCapDollars:10,baselineLatencyMs:100,bankrollPerVenueDollars:100,
 maxContracts:200,maxBookAgeMs:2000,minimumAbsenceMs:1000,unknownGapMs:2000,maxCaptureLagMs:250,
 unwindDelayMs:250,maxEpisodes:10000,maxActiveCaptures:512,settlementBufferMs:24*3600_000,
 firstLeg:'kalshi',fillAssumption:'CONDITIONAL_DISPLAYED_TAKER_DEPTH_NOT_ACTUAL_FILLS'});
export type Outcome='CLEAN_PAIR'|'PARTIAL_HEDGE'|'EDGE_DISAPPEARED'|'FIRST_LEG_ONLY'|'UNWIND'|'ORPHAN'|'UNOBSERVED';
export type StudyBook=ObservedBook&{proof?:unknown};
type Books=Record<Venue,StudyBook>;
type Settlement=ReturnType<typeof paperSettlement>;
export type Plan={capDollars:number;evaluation:ArbEvaluation;kalshiFee:number;polyFee:number;commitment:number};
export type Attempt={capDollars:number;delayMs:number;outcome:Outcome;reason?:string;first:Taken;firstFee:number;
 second:Taken|null;secondFee:number|null;pairedQuantity:number;residualQuantity:number;ordinaryProfit:number|null;
 committed:number;futureDepth:number|null;unwind?:{outcome:Outcome;quantity:number;proceeds:number;fees:number;loss:number;levels:Level[]}};
export type Episode={id:number;key:string;route:RecallRoute;settlement:Settlement;side:Side;start:number;startMono:number;
 lastEligibleAt:number;end:number|null;endReason:string|null;leftCensored:boolean;rightCensored:boolean;quoteUpdates:number;
 netEdges:number[];maxQuantity:number;plans:Plan[];attempts:Attempt[];resolutionHorizon:number|null;lockupBasis:string};
const dollars=(n:number)=>n*USD_SCALE;
const sumDepth=(ls:Level[])=>Math.floor(ls.reduce((n,l)=>n+Math.round(l.quantity*10000),0)/10000);
const otherSide=(r:RecallRoute,s:Side):Side=>r.pair.inverted?s:s==='yes'?'no':'yes';
export function studyEligible(r:RecallRoute,b:Books|null,at:number,c:Settlement){
 return !!b&&isPromoted(c.classification)&&r.pair.a.open&&r.pair.b.open&&(r.pair.a.exchangeIndex??0)===0&&
 !r.warnings.includes('ORIENTATION_UNPROVEN')&&(['kalshi','poly'] as Venue[]).every(v=>b[v].proof!==undefined&&
 b[v].book.marketId===(v==='kalshi'?r.pair.a.id:r.pair.b.id)&&b[v].book.source==='stream'&&currentBook(b[v],at,executionStudyPolicy.maxBookAgeMs))&&
 r.pair.a.minQty>0&&r.pair.b.minQty>0;
}
// Scan bounded integer support; consumes actual levels, honors minimum quantity,
// normal fees, budget and depth. Diagnostic stress never vetoes ordinary net.
export function studyPlans(r:RecallRoute,b:Books,side:Side,at:number):Plan[]{
 const results=new Map<number,Plan>(),minimum=Math.ceil(Math.max(r.pair.a.minQty,r.pair.b.minQty));
 const maximum=Math.min(executionStudyPolicy.maxContracts,sumDepth(b.kalshi.book[side]),sumDepth(b.poly.book[otherSide(r,side)]));
 for(let q=minimum;q<=maximum;q++){
  const e=evaluateEvArb(r.pair,{kalshi:b.kalshi.book,poly:b.poly.book},side,q,at,'UNVERIFIED',undefined,r.ticks);
  if(e.economicStatus!=='REALISTIC_NET_POSITIVE'||!e.kalshi||!e.poly||e.estimatedFees===null||e.acquisitionCost===null)continue;
  const kf=normalFee(e.kalshi.levels,r.pair.a.feeRate!,'kalshi')!,pf=normalFee(e.poly.levels,r.pair.b.feeRate!,'poly')!;
  const commitment=e.acquisitionCost+e.estimatedFees;
  for(const capDollars of executionStudyPolicy.capitalCapsDollars)if(commitment<=dollars(capDollars)&&e.kalshi.cost+kf<=dollars(executionStudyPolicy.bankrollPerVenueDollars)&&e.poly.cost+pf<=dollars(executionStudyPolicy.bankrollPerVenueDollars))
   results.set(capDollars,{capDollars,evaluation:e,kalshiFee:kf,polyFee:pf,commitment});
 }
 return [...results.values()];
}
export function secondLegAttempt(r:RecallRoute,p:Plan,b:StudyBook|null,at:number,delayMs:number,observable=true):Attempt{
 const first=p.evaluation.kalshi!,firstFee=p.kalshiFee;
 const base:Attempt={capDollars:p.capDollars,delayMs,outcome:'UNOBSERVED',first,firstFee,second:null,secondFee:null,pairedQuantity:0,
  residualQuantity:first.quantity,ordinaryProfit:null,committed:first.cost+firstFee,futureDepth:null};
 if(!observable||!b||b.book.marketId!==r.pair.b.id||b.book.source!=='stream'||!currentBook(b,at))return {...base,reason:'MISSING_STALE_INVALID_OR_CENSORED_NATIVE_STATE'};
 const levels=b.book[p.evaluation.polySide];base.futureDepth=sumDepth(levels);
 // Limit second-leg spend so the original cap and positive ordinary-world net
 // remain true. Never force a negative-net hedge just to call it a clean pair.
 for(let q=first.quantity;q>=Math.ceil(r.pair.b.minQty);q--){
  const second=takeDepth(levels,q);if(!second)continue;
  const secondFee=normalFee(second.levels,r.pair.b.feeRate!,'poly');if(secondFee===null)return {...base,reason:'FEE_UNAVAILABLE'};
  const pairedFirst=takeDepth(first.levels,q)!;
  // Original first-leg fee remains sunk; this is conservative for partial pairs.
  const ordinaryProfit=q*USD_SCALE-pairedFirst.cost-firstFee-second.cost-secondFee;
  const committed=first.cost+firstFee+second.cost+secondFee;
  if(ordinaryProfit<=0||committed>dollars(p.capDollars))continue;
  return {...base,outcome:q===first.quantity?'CLEAN_PAIR':'PARTIAL_HEDGE',second,secondFee,pairedQuantity:q,residualQuantity:first.quantity-q,ordinaryProfit,committed};
 }
 return {...base,outcome:base.futureDepth===0?'FIRST_LEG_ONLY':'EDGE_DISAPPEARED'};
}
export function residualUnwind(r:RecallRoute,side:Side,a:Attempt,b:StudyBook|null,at:number):Attempt{
 if(a.outcome==='UNOBSERVED'||!a.residualQuantity)return a;
 if(!b||!currentBook(b,at)||b.book.marketId!==r.pair.a.id||b.book.source!=='stream')return {...a,unwind:{outcome:'UNOBSERVED',quantity:0,proceeds:0,fees:0,loss:0,levels:[]}};
 const ls=b.book[side==='yes'?'yesBids':'noBids'],q=Math.min(a.residualQuantity,sumDepth(ls)),sell=q?takeDepth(ls,q,true):null;
 const fees=sell?normalFee(sell.levels,r.pair.a.feeRate!,'kalshi'):0;
 if(fees===null)return {...a,unwind:{outcome:'UNOBSERVED',quantity:0,proceeds:0,fees:0,loss:0,levels:[]}};
 const pairedFirst=a.pairedQuantity?takeDepth(a.first.levels,a.pairedQuantity)!.cost:0;
 const residualCost=a.first.cost-pairedFirst+(a.pairedQuantity?0:a.firstFee);
 return {...a,unwind:{outcome:q===a.residualQuantity?'UNWIND':'ORPHAN',quantity:q,proceeds:sell?.cost??0,fees,
  loss:q===a.residualQuantity?residualCost-(sell?.cost??0)+fees:0,levels:sell?.levels??[]}};
}
type History={at:number;mono:number;book:StudyBook|null};
type Capture={episode:Episode;books:Books;histories:Record<Venue,History[]>;next:number;done:Set<number>;invalid:boolean};
export class PaperExecutionStudy{
 episodes:Episode[]=[];active=new Map<string,Episode>();captures:Capture[]=[];
 states=new Map<string,{seen:boolean;absentAt:number|null;unknownAt:number|null;fingerprint:string}>();
 skipped:Record<string,number>={};timing:{delayMs:number;lagMs:number}[]=[];stopped=false;
 record:(kind:string,body:unknown)=>void;native:(r:RecallRoute)=>Books|null;
 constructor(native:(r:RecallRoute)=>Books|null,record:(kind:string,body:unknown)=>void){this.native=native;this.record=record;}
 book(venue:Venue,id:string,b:StudyBook,at=Date.now(),mono=performance.now()){
  let recorded=false;for(const c of this.captures)if((venue==='kalshi'?c.episode.route.pair.a.id:c.episode.route.pair.b.id)===id){
   c.histories[venue].push({at,mono,book:structuredClone(b)});recorded=true;
  }if(recorded)this.record('PAPER_NATIVE_STATE',{venue,id,at,mono,book:b});
 }
 invalidate(venue:Venue,at=Date.now(),mono=performance.now()){
  for(const c of this.captures){c.invalid=true;c.histories[venue].push({at,mono,book:null});}
 }
 close(e:Episode,at:number,reason:string,censored=false){e.end=at;e.endReason=reason;e.rightCensored=censored;this.active.delete(e.key);this.record('PAPER_EPISODE_END',{id:e.id,end:at,reason,censored});}
 observe(r:RecallRoute,b:Books|null,c:Settlement,at=Date.now(),mono=performance.now()){
  if(this.stopped||!isPromoted(c.classification))return;
  for(const side of ['yes','no'] as Side[]){const key=r.pair.id+':'+side,state=this.states.get(key)??{seen:false,absentAt:null,unknownAt:null,fingerprint:''};
   const nativeOkay=studyEligible(r,b,at,c);
   let plans:Plan[]=[];try{if(nativeOkay)plans=studyPlans(r,b!,side,at);}catch(error){this.skipped[(error as Error).message]=(this.skipped[(error as Error).message]??0)+1;}
   const eligible=plans.length>0;let e=this.active.get(key);
   if(!eligible){
    if(nativeOkay){state.absentAt??=at;state.unknownAt=null;if(e&&at-state.absentAt>=executionStudyPolicy.minimumAbsenceMs)this.close(e,state.absentAt,'ECONOMIC_DISAPPEARANCE');}
    else{state.unknownAt??=at;state.absentAt=null;if(e&&at-state.unknownAt>=executionStudyPolicy.unknownGapMs)this.close(e,state.unknownAt,'OBSERVATION_GAP',true);}
   }else{
    if(e&&state.absentAt!==null&&at-state.absentAt>=executionStudyPolicy.minimumAbsenceMs){this.close(e,state.absentAt,'ECONOMIC_DISAPPEARANCE');e=undefined;}
    if(e&&state.unknownAt!==null&&at-state.unknownAt>=executionStudyPolicy.unknownGapMs){this.close(e,state.unknownAt,'OBSERVATION_GAP',true);e=undefined;}
    const fingerprint=JSON.stringify([b!.kalshi.book.yes,b!.kalshi.book.no,b!.poly.book.yes,b!.poly.book.no]);
    const best=plans.at(-1)!;
    if(!e){
     if(this.episodes.length>=executionStudyPolicy.maxEpisodes||this.captures.length>=executionStudyPolicy.maxActiveCaptures){this.skipped.CAPTURE_LIMIT=(this.skipped.CAPTURE_LIMIT??0)+1;this.states.set(key,state);continue;}
     const closes=[r.pair.a.closeAt,r.pair.b.closeAt].map(Date.parse),horizon=closes.every(t=>Number.isFinite(t)&&t>at)?Math.max(...closes)+executionStudyPolicy.settlementBufferMs:null;
     e={id:this.episodes.length+1,key,route:structuredClone(r),settlement:structuredClone(c),side,start:at,startMono:mono,lastEligibleAt:at,end:null,endReason:null,
      leftCensored:!state.seen||state.unknownAt!==null,rightCensored:false,quoteUpdates:0,netEdges:[],maxQuantity:0,plans,attempts:[],resolutionHorizon:horizon,
      lockupBasis:'Later native closeAt + 24h assumption; actual settlement/admin extensions unknown; unknown horizons lock indefinitely'};
     this.episodes.push(e);this.active.set(key,e);
     const initial=structuredClone(b!),capture:Capture={episode:e,books:initial,histories:{kalshi:[{at,mono,book:initial.kalshi}],poly:[{at,mono,book:initial.poly}]},next:0,done:new Set(),invalid:false};
     this.captures.push(capture);this.record('PAPER_EPISODE_START',{episode:e,books:initial,ages:{kalshi:bookAges(initial.kalshi,at),poly:bookAges(initial.poly,at)}});
     for(const p of plans)e.attempts.push(secondLegAttempt(r,p,initial.poly,at,0));capture.done.add(0);
    }
    e.lastEligibleAt=at;e.maxQuantity=Math.max(e.maxQuantity,best.evaluation.quantity);
    if(fingerprint!==state.fingerprint||!e.netEdges.length){e.quoteUpdates++;e.netEdges.push(best.evaluation.estimatedNetProfit!/best.evaluation.quantity);state.fingerprint=fingerprint;
     this.record('PAPER_EPISODE_QUOTE',{id:e.id,at,quantity:best.evaluation.quantity,perContractNet:e.netEdges.at(-1)});}
    state.absentAt=null;state.unknownAt=null;
   }
   state.seen=true;this.states.set(key,state);
  }
 }
 // Reconstruction uses only recorded states captured at or before the exact
 // target. A timer/loop delay never admits a later quote as an earlier fill.
 asof(c:Capture,v:Venue,targetMono:number,targetAt:number,current:Books|null,nowMono:number):StudyBook|null{
  if(c.invalid||nowMono-targetMono>executionStudyPolicy.maxCaptureLagMs||!current||!currentBook(current[v],targetAt+Math.max(0,nowMono-targetMono))||current[v].book.source!=='stream')return null;
  const h=c.histories[v];
  // A frame received before the target but processed afterwards creates an
  // unobserved arrival gap, rather than permitting stale state or look-ahead.
  if(h.some(x=>x.mono>targetMono&&x.book&&x.book.book.receivedMono<=targetMono))return null;
  const latest=h.filter(x=>x.mono<=targetMono).at(-1)?.book??null;
  return latest&&currentBook(latest,targetAt)?latest:null;
 }
 pulse(at=Date.now(),mono=performance.now()){
  for(const c of this.captures){const e=c.episode,current=this.native(e.route);
   for(const delayMs of executionStudyPolicy.latenciesMs){if(c.done.has(delayMs)||mono<e.startMono+delayMs)continue;
    const target=e.start+delayMs,targetMono=e.startMono+delayMs,b=this.asof(c,'poly',targetMono,target,current,mono);
    this.timing.push({delayMs,lagMs:mono-targetMono});
    this.record('PAPER_LATENCY_STATE',{id:e.id,delayMs,targetAt:target,capturedAt:at,capturedMono:mono,lagMs:mono-targetMono,book:b,
     unchangedSinceSignal:!!b&&b.book.receivedAt===c.books.poly.book.receivedAt});
    for(const p of e.plans)e.attempts.push(secondLegAttempt(e.route,p,b,target,delayMs,!!b));c.done.add(delayMs);
   }
   for(const a of e.attempts)if(!a.unwind&&a.residualQuantity&&a.outcome!=='UNOBSERVED'&&mono>=e.startMono+a.delayMs+executionStudyPolicy.unwindDelayMs){
    const delay=a.delayMs+executionStudyPolicy.unwindDelayMs,target=e.start+delay,b=this.asof(c,'kalshi',e.startMono+delay,target,current,mono);
    Object.assign(a,residualUnwind(e.route,e.side,a,b,target));this.record('PAPER_UNWIND_STATE',{id:e.id,delayMs:a.delayMs,targetAt:target,book:b,result:a.unwind});
   }
  }
  const complete=(c:Capture)=>c.done.size===executionStudyPolicy.latenciesMs.length&&c.episode.attempts.every(a=>a.outcome==='UNOBSERVED'||!a.residualQuantity||a.unwind);
  for(const c of this.captures.filter(complete))this.record('PAPER_ATTEMPTS',{id:c.episode.id,attempts:c.episode.attempts});
  this.captures=this.captures.filter(c=>!complete(c));
 }
 stop(at=Date.now()){
  this.stopped=true;for(const e of this.active.values())this.close(e,at,'WINDOW_END',true);
  for(const c of this.captures){for(const delay of executionStudyPolicy.latenciesMs)if(!c.done.has(delay))for(const p of c.episode.plans)
   c.episode.attempts.push(secondLegAttempt(c.episode.route,p,null,at,delay,false));
   for(const a of c.episode.attempts)if(a.residualQuantity&&!a.unwind&&a.outcome!=='UNOBSERVED')Object.assign(a,residualUnwind(c.episode.route,c.episode.side,a,null,at));
   this.record('PAPER_ATTEMPTS',{id:c.episode.id,attempts:c.episode.attempts});}
  this.captures=[];
 }
 summary(){return {policy:executionStudyPolicy,ordersEnabled:false,fillClaim:false,episodes:this.episodes,skipped:this.skipped,timing:this.timing,pending:this.captures.length};}
}
