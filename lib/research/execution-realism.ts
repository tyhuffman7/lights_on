// Frozen bounded counterfactual scenarios. Public L2 cannot prove acceptance/fills.
import type {Level,Venue} from '../arb/types.ts';
import type {Episode,Plan,StudyBook,Attempt,Outcome} from './paper-execution-study.ts';
import {takeDepth,USD_SCALE} from './ev-arb.ts';
import {orderFee} from './study-fees.ts';
import {conservativeOpportunityGroups} from './paper-execution-report.ts';
export const realismPolicy=Object.freeze({version:1,ordersEnabled:false,durationSeconds:10800,
 caps:[5,10,25,50],latenciesMs:[0,10,25,50,100,250,500,1000],baselineCap:10,baselineLatency:100,
 bankrollPerVenue:100,depthHaircutPercent:50,unwindDelayMs:250,settlementBufferHours:24,
 decisionRubric:'Compelling only if conservative net >= $10, median lockup <= 7 days, 100/250ms clean >=80%, one-tick portfolio positive; unresolved evidence takes precedence',
 feeModel:'Kalshi cent balance accumulator, one fill per level; PM-US cumulative rounded commission ceiling',
 entry:'largest profitable supported integer within paired cap; first eligible sample per conservative economic group; chronological held-market suppression',
 models:['DISPLAYED','HAIRCUT_50','ONE_TICK','FEE_LEVEL_DIAGNOSTIC','EXTREME_FRAGMENT_DIAGNOSTIC'] as const});
export type Model=typeof realismPolicy.models[number];
export type Evidence={initial:Record<Venue,StudyBook>;future:Map<number,StudyBook|null>;unwind:Map<number,StudyBook|null>};
export type RealAttempt=Attempt&{model:Model;targetQuantity:number;firstFillQuantity:number;grossProfit:number|null;fees:number;slippage:number;edgeRetained:boolean|null;negativeKnownPnl:number|null;knownPnl:number};
const depth=(ls:Level[])=>Math.floor(ls.reduce((n,l)=>n+Math.round(l.quantity*10000),0)/10000);
const cost=(ls:Level[])=>ls.reduce((n,l)=>n+l.price*Math.round(l.quantity*10000),0);
function adjusted(ls:Level[],model:Model,tick:number,sell=false):Level[]|null{
 if(model==='ONE_TICK'&&(!Number.isSafeInteger(tick)||tick<=0))return null;
 const result=ls.map(l=>({price:l.price+(model==='ONE_TICK'?(sell?-tick:tick):0),quantity:model==='HAIRCUT_50'?Math.floor(Math.round(l.quantity*10000)/2)/10000:l.quantity})).filter(l=>l.quantity>0);
 if(result.some(l=>l.price<=0||l.price>=10000))return null;
 return result;
}
function fee(ls:Level[],rate:number,v:Venue,model:Model,sell=false):number|null{
 if(model==='EXTREME_FRAGMENT_DIAGNOSTIC'&&v==='kalshi'){
  // Mathematical upper diagnostic at 0.01-contract fragmentation, no rebates.
  if(ls.some(l=>Math.abs(l.quantity*100-Math.round(l.quantity*100))>1e-7))return null;
  return ls.reduce((n,l)=>n+Math.round(l.quantity*100)*orderFee([{price:l.price,quantity:.01}],rate,v,sell,true)!,0);
 }
 return orderFee(ls,rate,v,sell,model==='FEE_LEVEL_DIAGNOSTIC');
}
export function realisticAttempt(e:Episode,p:Plan,ev:Evidence,delayMs:number,model:Model):RealAttempt{
 const r=e.route,original=p.evaluation.kalshi!,tick=r.ticks??{kalshi:0,poly:0};
 const base:RealAttempt={model,targetQuantity:original.quantity,firstFillQuantity:0,capDollars:p.capDollars,delayMs,outcome:'UNOBSERVED',first:original,firstFee:0,
  second:null,secondFee:null,pairedQuantity:0,residualQuantity:0,ordinaryProfit:null,committed:0,futureDepth:null,grossProfit:null,fees:0,slippage:0,edgeRetained:null,negativeKnownPnl:null,knownPnl:0};
 const firstLevels=adjusted(ev.initial.kalshi.book[e.side],model,tick.kalshi);
 if(!firstLevels)return {...base,reason:'NATIVE_TICK_OR_PRICE_BOUND_UNAVAILABLE'};
 const q=Math.min(original.quantity,depth(firstLevels));
 if(q<Math.ceil(r.pair.a.minQty))return {...base,outcome:'FIRST_LEG_UNFILLED' as Outcome,reason:'HAIRCUT_DEPTH_BELOW_MINIMUM',ordinaryProfit:0,grossProfit:0,negativeKnownPnl:0};
 const first=takeDepth(firstLevels,q)!,kf=fee(first.levels,r.pair.a.feeRate!, 'kalshi',model);
 if(kf===null)return {...base,reason:'FEE_UNAVAILABLE'};
 Object.assign(base,{first,firstFee:kf,firstFillQuantity:q,residualQuantity:q,committed:first.cost+kf,fees:kf});
 const future=delayMs===0?ev.initial.poly:ev.future.get(delayMs);
 if(!future)return {...base,reason:'MISSING_STALE_INVALID_OR_LATE_FUTURE'};
 const ls=adjusted(future.book[p.evaluation.polySide],model,tick.poly);
 if(!ls)return {...base,reason:'NATIVE_TICK_OR_PRICE_BOUND_UNAVAILABLE'};
 base.futureDepth=depth(ls);base.outcome=base.futureDepth?'EDGE_DISAPPEARED':'FIRST_LEG_ONLY';
 for(let h=Math.min(q,depth(ls));h>=Math.ceil(r.pair.b.minQty);h--){
  const second=takeDepth(ls,h)!,pf=fee(second.levels,r.pair.b.feeRate!,'poly',model);
  if(pf===null)return {...base,outcome:'UNOBSERVED',reason:'FEE_UNAVAILABLE'};
  const firstPaired=takeDepth(first.levels,h)!,net=h*USD_SCALE-firstPaired.cost-kf-second.cost-pf;
  if(net<=0||first.cost+kf+second.cost+pf>p.capDollars*USD_SCALE)continue;
  Object.assign(base,{second,secondFee:pf,pairedQuantity:h,residualQuantity:q-h,ordinaryProfit:net,
   committed:first.cost+kf+second.cost+pf,fees:kf+pf,grossProfit:h*USD_SCALE-firstPaired.cost-second.cost,
   outcome:h===q?'CLEAN_PAIR':'PARTIAL_HEDGE',edgeRetained:net>=p.evaluation.estimatedNetProfit!});break;
 }
 base.slippage=first.cost-cost([{price:ev.initial.kalshi.book[e.side][0].price,quantity:q}]);
 if(base.second){
  const signalSecond=takeDepth(ev.initial.poly.book[p.evaluation.polySide],base.pairedQuantity)!;
  base.slippage+=base.second.cost-signalSecond.cost+signalSecond.cost-ev.initial.poly.book[p.evaluation.polySide][0].price*base.pairedQuantity*10000;
 }
 base.knownPnl=base.ordinaryProfit??0;
 if(base.residualQuantity){
  const b=ev.unwind.get(delayMs),bids=b?adjusted(b.book[e.side==='yes'?'yesBids':'noBids'],model,tick.kalshi,true):null;
  if(!bids){base.unwind={outcome:'UNOBSERVED',quantity:0,proceeds:0,fees:0,loss:0,levels:[]};return base;}
  const sellQ=Math.min(base.residualQuantity,depth(bids)),sold=sellQ?takeDepth(bids,sellQ,true):null;
  const sf=sold?fee(sold.levels,r.pair.a.feeRate!,'kalshi',model,true):0;
  if(sf===null){base.unwind={outcome:'UNOBSERVED',quantity:0,proceeds:0,fees:0,loss:0,levels:[]};return base;}
  const pairedCost=base.pairedQuantity?takeDepth(first.levels,base.pairedQuantity)!.cost:0;
  const residualCost=first.cost-pairedCost+(base.pairedQuantity?0:kf);
  const soldCost=sellQ?takeDepth(first.levels,base.pairedQuantity+sellQ)!.cost-pairedCost:0;
  base.knownPnl=(base.ordinaryProfit??0)+(sold?.cost??0)-soldCost-sf-(base.pairedQuantity?0:kf);
  base.grossProfit=(base.grossProfit??0)-soldCost+(sold?.cost??0);
  base.unwind={outcome:sellQ===base.residualQuantity?'UNWIND':'ORPHAN',quantity:sellQ,proceeds:sold?.cost??0,fees:sf,
   loss:sellQ===base.residualQuantity?residualCost-(sold?.cost??0)+sf:0,levels:sold?.levels??[]};
  if(sellQ===base.residualQuantity)base.negativeKnownPnl=base.knownPnl;
 }else{base.negativeKnownPnl=base.ordinaryProfit;base.knownPnl=base.ordinaryProfit??0;}
 return base;
}
const median=(ns:number[])=>ns.length?[...ns].sort((a,b)=>a-b)[Math.floor((ns.length-1)/2)]:null;
const counts=(ns:string[])=>ns.reduce((o,k)=>(o[k]=(o[k]??0)+1,o),{} as Record<string,number>);
export function realismPortfolio(rows:{e:Episode;a:RealAttempt}[],cap:number,delay:number,model:Model){
 const cash={kalshi:100*USD_SCALE,poly:100*USD_SCALE},held=new Set<string>();
 const entries:{episodeId:number;classification:string;lockupDays:number|null;attempt:RealAttempt}[]=[];
 let committed=0,locked=0,peak=0,known=0,unpriced=0,gross=0,fees=0,unwindLoss=0,slippage=0;const skips:Record<string,number>={};
 const skip=(k:string)=>skips[k]=(skips[k]??0)+1;
 for(const {e,a} of rows.sort((x,y)=>x.e.start-y.e.start||x.e.id-y.e.id)){
  const ids=['kalshi:'+e.route.pair.a.id,'poly:'+e.route.pair.b.id];
  if(ids.some(id=>held.has(id))){skip('MARKET_ALREADY_HELD');continue;}
  const k=a.first.cost+a.firstFee,pReserve=cap*USD_SCALE-k;
  if(k<0||pReserve<0||k>cash.kalshi||pReserve>cash.poly){skip('INSUFFICIENT_RESERVED_CASH');continue;}
  if(a.firstFillQuantity===0){skip(a.outcome);continue;}
  const p=a.outcome==='UNOBSERVED'?pReserve:(a.second?.cost??0)+(a.secondFee??0);
  const proceeds=a.unwind?(a.unwind.proceeds-a.unwind.fees):0;
  // Original capital is debited; only observed scenario unwind proceeds return.
  cash.kalshi-=k-proceeds;cash.poly-=p;committed+=a.committed;
  const unresolved=a.outcome==='UNOBSERVED'||a.residualQuantity>(a.unwind?.quantity??0);
  
  const pairK=a.pairedQuantity?takeDepth(a.first.levels,a.pairedQuantity)!.cost+a.firstFee:0;
  const soldQ=a.unwind?.quantity??0,pairedCost=a.pairedQuantity?takeDepth(a.first.levels,a.pairedQuantity)!.cost:0;
  const soldCost=soldQ?takeDepth(a.first.levels,a.pairedQuantity+soldQ)!.cost-pairedCost:0;
  const exposure=unresolved?k-soldCost+p:pairK+p;
  if(unresolved)unpriced+=exposure;
  peak=Math.max(peak,locked+a.committed);locked+=exposure;peak=Math.max(peak,locked);if(exposure>0)ids.forEach(id=>held.add(id));
  known+=a.knownPnl;gross+=a.grossProfit??0;fees+=a.fees+(a.unwind?.fees??0);unwindLoss+=a.unwind?.loss??0;slippage+=a.slippage;
  entries.push({episodeId:e.id,classification:e.settlement.classification,lockupDays:e.resolutionHorizon===null?null:(e.resolutionHorizon-e.start)/86400_000,attempt:a});
 }
 const ns=entries.flatMap(x=>x.attempt.negativeKnownPnl===null?[]:[x.attempt.negativeKnownPnl/USD_SCALE]);
 const complete=entries.every(x=>x.attempt.negativeKnownPnl!==null);
 return {model,capDollars:cap,delayMs:delay,entries:entries.length,outcomes:counts(entries.map(x=>x.attempt.outcome)),terminal:counts(entries.map(x=>x.attempt.unwind?.outcome??x.attempt.outcome)),skips,
 committed:committed/USD_SCALE,peakLocked:peak/USD_SCALE,lockedAtEnd:locked/USD_SCALE,grossOrdinary:gross/USD_SCALE,fees:fees/USD_SCALE,executionSlippage:slippage/USD_SCALE,unwindLoss:unwindLoss/USD_SCALE,
 knownPnl:known/USD_SCALE,netPnl:complete?known/USD_SCALE:null,unpricedExposure:unpriced/USD_SCALE,roiCommitted:complete&&committed?known/committed:null,roiPeak:complete&&peak?known/peak:null,
 averageProfit:complete&&ns.length?ns.reduce((a,b)=>a+b,0)/ns.length:null,medianProfit:complete?median(ns):null,worstTrade:ns.length?Math.min(...ns):null,
 negativeTrades:entries.filter(x=>x.attempt.negativeKnownPnl!==null&&x.attempt.negativeKnownPnl<0),medianLockupDays:median(entries.flatMap(x=>x.lockupDays===null?[]:[x.lockupDays])),
 unknownLockups:entries.filter(x=>x.lockupDays===null).length,byClass:Object.fromEntries(['STRICT_EQUIVALENT','ORDINARY_EQUIVALENT_BASIS_RISK'].map(c=>{const es=entries.filter(x=>x.classification===c),fullyPriced=es.every(x=>x.attempt.negativeKnownPnl!==null);return [c,{entries:es.length,knownPnl:es.reduce((n,x)=>n+x.attempt.knownPnl,0)/USD_SCALE,netPnl:fullyPriced?es.reduce((n,x)=>n+x.attempt.negativeKnownPnl!,0)/USD_SCALE:null,unpricedEntries:es.filter(x=>x.attempt.negativeKnownPnl===null).length}];})),ledger:entries};
}
export function realismReport(episodes:Episode[],evidence:Map<number,Evidence>,windowMs:number){
 const continuity=conservativeOpportunityGroups(episodes),groups=continuity.groups;
 const portfolios:ReturnType<typeof realismPortfolio>[]=[];
 const survival:{model:Model;delayMs:number;eligible:number;outcomes:Record<string,number>;terminal:Record<string,number>;fullSizeClean:number;reducedFirstFills:number;retainedEdge:number;reducedEdge:number;negativeTrades:{episodeId:number;pnl:number}[]}[]=[];
 for(const model of realismPolicy.models)for(const cap of realismPolicy.caps){
  const eligible=groups.flatMap(g=>{const e=g.find(e=>e.plans.some(p=>p.capDollars===cap));return e?[e]:[];});
  for(const delay of realismPolicy.latenciesMs){
   const rows=eligible.flatMap(e=>{const ev=evidence.get(e.id);if(!ev)throw Error('INITIAL_EVIDENCE_MISSING_'+e.id);return [{e,a:realisticAttempt(e,e.plans.find(p=>p.capDollars===cap)!,ev,delay,model)}];});
   portfolios.push(realismPortfolio(rows,cap,delay,model));
   if(cap===realismPolicy.baselineCap)survival.push({model,delayMs:delay,eligible:rows.length,outcomes:counts(rows.map(x=>x.a.outcome)),terminal:counts(rows.map(x=>x.a.unwind?.outcome??x.a.outcome)),
    fullSizeClean:rows.filter(x=>x.a.outcome==='CLEAN_PAIR'&&x.a.firstFillQuantity===x.a.targetQuantity).length,
    reducedFirstFills:rows.filter(x=>x.a.firstFillQuantity>0&&x.a.firstFillQuantity<x.a.targetQuantity).length,
    retainedEdge:rows.filter(x=>x.a.edgeRetained===true).length,reducedEdge:rows.filter(x=>x.a.edgeRetained===false&&x.a.outcome==='CLEAN_PAIR').length,
    negativeTrades:rows.filter(x=>x.a.negativeKnownPnl!==null&&x.a.negativeKnownPnl<0).map(x=>({episodeId:x.e.id,pnl:x.a.negativeKnownPnl!/USD_SCALE}))});
  }
 }
 const baseline=portfolios.find(p=>p.model==='HAIRCUT_50'&&p.capDollars===10&&p.delayMs===100)!;
 const oneTick=portfolios.find(p=>p.model==='ONE_TICK'&&p.capDollars===10&&p.delayMs===100)!;
 const clean=(delay:number)=>{const s=survival.find(s=>s.model==='HAIRCUT_50'&&s.delayMs===delay)!;return s.eligible?(s.outcomes.CLEAN_PAIR??0)/s.eligible:0;};
 const compelling=baseline.netPnl!==null&&baseline.netPnl>=10&&baseline.medianLockupDays!==null&&baseline.medianLockupDays<=7&&clean(100)>=.8&&clean(250)>=.8&&oneTick.netPnl!==null&&oneTick.netPnl>0;
 const conclusion=baseline.netPnl===null?'INSUFFICIENT EVIDENCE — accepted conservative trades have unobserved hedge or residual valuation':
  baseline.entries===0?'INSUFFICIENT EVIDENCE — no conservative capital-admitted trades':
  baseline.netPnl<=0?'PAPER STRATEGY FAILS UNDER REALISTIC EXECUTION ASSUMPTIONS':
  compelling?'PAPER STRATEGY ECONOMICALLY COMPELLING — TINY LIVE PILOT MAY BE WORTH EVALUATING':
  'PAPER STRATEGY POSITIVE BUT NOT ECONOMICALLY COMPELLING — CAPITAL/LOCKUP/RISK TOO HIGH';
 return {policy:realismPolicy,observationHours:windowMs/3600_000,uniqueEpisodes:groups.length,captureSegments:episodes.length,
  classes:counts(groups.map(g=>g[0].settlement.classification)),families:counts(groups.map(g=>g[0].settlement.certificate.family??'unknown')),
  confirmedReturns:continuity.confirmedReturns,recurringRoutes:continuity.recurringRoutes,episodesPerHour:groups.length/(windowMs/3600_000),
  scope:'Bounded public-book scenarios, no actual fills. Basis P&L assumes ordinary complementary settlement. Frequency includes left-censored initial inventory. No inferred fill/basis-divergence probability.',
  survival,portfolios,baseline,conclusion};
}
