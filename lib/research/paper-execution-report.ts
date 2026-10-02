import {executionStudyPolicy, type Episode,type Attempt,type Outcome} from './paper-execution-study.ts';
import {USD_SCALE} from './ev-arb.ts';
const median=(a:number[])=>a.length?[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)/2)]:null;
const count=(a:string[])=>a.reduce((o,k)=>(o[k]=(o[k]??0)+1,o),{} as Record<string,number>);
const usd=(n:number)=>n/USD_SCALE;
export function paperPortfolio(episodes:Episode[],capDollars:number,delayMs:number){
 const balance={kalshi:executionStudyPolicy.bankrollPerVenueDollars*USD_SCALE,poly:executionStudyPolicy.bankrollPerVenueDollars*USD_SCALE};
 const held:{markets:string[];until:number;k:number;p:number;commitment:number}[]=[],entries:{episodeId:number;classification:string;attempt:Attempt;lockupDays:number|null}[]=[];
 const skips:Record<string,number>={};let peakLocked=0,committed=0,fullyObservedPnl=0,unpricedCost=0,unobserved=0;
 for(const e of [...episodes].sort((a,b)=>a.start-b.start||a.id-b.id)){
  const plan=e.plans.find(p=>p.capDollars===capDollars),attempt=e.attempts.find(a=>a.capDollars===capDollars&&a.delayMs===delayMs);
  const skip=(s:string)=>skips[s]=(skips[s]??0)+1;
  if(!plan||!attempt){skip('NO_CAP_PLAN');continue;}
  const markets=['kalshi:'+e.route.pair.a.id,'poly:'+e.route.pair.b.id];
  if(held.some(p=>p.markets.some(m=>markets.includes(m)))){skip('MARKET_ALREADY_HELD');continue;}
  const k=attempt.first.cost+attempt.firstFee,pReserve=capDollars*USD_SCALE-k;
  if(k>balance.kalshi||pReserve>balance.poly){skip('INSUFFICIENT_RESERVED_CASH');continue;}
  let p=attempt.second?(attempt.second.cost+attempt.secondFee!):0;
  // An unobserved hedge reserves the possible spend. It cannot be reported as
  // zero loss or released cash simply because later evidence is missing.
  if(attempt.outcome==='UNOBSERVED'){p=pReserve;unobserved++;unpricedCost+=k+p;}
  const unwind=attempt.unwind;
  let lockK=k,profit=attempt.ordinaryProfit??0,returnedCash=0;
  if(attempt.residualQuantity&&attempt.outcome!=='UNOBSERVED'){
   if(unwind?.outcome==='UNWIND'){
    profit-=unwind.loss;
    // Return only observed unwind proceeds, never the acquisition cost.
    returnedCash=unwind.proceeds-unwind.fees;
    lockK=attempt.pairedQuantity?Math.round(attempt.first.cost*attempt.pairedQuantity/attempt.first.quantity)+attempt.firstFee:0;
   }else{unpricedCost+=k-(attempt.pairedQuantity?Math.round(attempt.first.cost*attempt.pairedQuantity/attempt.first.quantity):0);unobserved++;}
  }
  committed+=attempt.committed;
  // Known partial complementary profit is a subtotal; total portfolio P&L
  // remains null whenever a residual/unknown position cannot be valued.
  fullyObservedPnl+=profit;
  balance.kalshi-=k-returnedCash;balance.poly-=p;
  const until=e.resolutionHorizon??Number.POSITIVE_INFINITY;
  // Released residual cash above is immediate; complementary pairs remain
  // locked. No settlement payouts are recycled inside this bounded window.
  if(lockK+p>0)held.push({markets,until,k:lockK,p,commitment:lockK+p});
  peakLocked=Math.max(peakLocked,held.reduce((n,p)=>n+p.commitment,0));
  entries.push({episodeId:e.id,classification:e.settlement.classification,attempt,lockupDays:e.resolutionHorizon===null?null:(e.resolutionHorizon-e.start)/86400_000});
 }
 const complete=unobserved===0;
 return {capDollars,delayMs,bankrollDollars:executionStudyPolicy.bankrollPerVenueDollars*2,acceptedEntries:entries.length,skips,
  outcomes:count(entries.map(e=>e.attempt.outcome)),terminalOutcomes:count(entries.map(e=>e.attempt.unwind?.outcome??e.attempt.outcome)),
  paperCommittedDollars:usd(committed),peakLockedDollars:usd(peakLocked),lockedDollarsAtEnd:usd(held.reduce((n,p)=>n+p.commitment,0)),
  knownOrdinaryProfitSubtotalDollars:usd(fullyObservedPnl),modeledPortfolioPnlDollars:complete?usd(fullyObservedPnl):null,
  returnOnCommittedCapital:complete&&committed>0?fullyObservedPnl/committed:null,unpricedExposureDollars:usd(unpricedCost),unpricedEntries:unobserved,
  lockupDays:{median:median(entries.flatMap(e=>e.lockupDays===null?[]:[e.lockupDays])),max:entries.length?Math.max(...entries.flatMap(e=>e.lockupDays===null?[]:[e.lockupDays])):null,unknown:entries.filter(e=>e.lockupDays===null).length},
  byClass:Object.fromEntries(['STRICT_EQUIVALENT','ORDINARY_EQUIVALENT_BASIS_RISK'].map(c=>[c,{entries:entries.filter(e=>e.classification===c).length,
   cleanPairs:entries.filter(e=>e.classification===c&&e.attempt.outcome==='CLEAN_PAIR').length,ordinaryPairProfitDollars:usd(entries.filter(e=>e.classification===c).reduce((n,e)=>n+(e.attempt.ordinaryProfit??0),0))}])),entries};
}
// Freshness gaps do not prove an economic disappearance. Merge those
// observed segments conservatively; split only after a witnessed economic end.
// This is a lower bound on observed episodes, not an inferred price history.
export function conservativeOpportunityGroups(episodes:Episode[]){
 const byRoute=new Map<string,Episode[]>();
 for(const e of [...episodes].sort((a,b)=>a.start-b.start||a.id-b.id)){const g=byRoute.get(e.key)??[];g.push(e);byRoute.set(e.key,g);}
 const groups:Episode[][]=[];let confirmedReturns=0;const recurring=new Set<string>();
 for(const [key,es] of byRoute){let current:Episode[]=[];
  for(let i=0;i<es.length;i++){const e=es[i];current.push(e);
   if(e.endReason==='ECONOMIC_DISAPPEARANCE'){groups.push(current);current=[];if(i+1<es.length){confirmedReturns++;recurring.add(key);}}
  }if(current.length)groups.push(current);
 }
 return {groups,confirmedReturns,recurringRoutes:recurring.size};
}
export function executionReport(study:{episodes:Episode[];timing:{delayMs:number;lagMs:number}[];skipped:Record<string,number>},windowMs:number){
 const episodes=study.episodes,continuity=conservativeOpportunityGroups(episodes);
 const firstEligible=continuity.groups.flatMap(g=>{const e=g.find(e=>e.plans.some(p=>p.capDollars===executionStudyPolicy.baselineCapDollars));return e?[e]:[];});
 const survival=(input:Episode[])=>executionStudyPolicy.latenciesMs.map(delayMs=>{
  const eligible=input.filter(e=>e.plans.some(p=>p.capDollars===executionStudyPolicy.baselineCapDollars));
  const a=eligible.flatMap(e=>e.attempts.filter(a=>a.capDollars===executionStudyPolicy.baselineCapDollars&&a.delayMs===delayMs));
  const lags=study.timing.filter(t=>t.delayMs===delayMs).map(t=>t.lagMs),outcomes=count(a.map(a=>a.outcome)),observed=a.filter(a=>a.outcome!=='UNOBSERVED').length;
  return {delayMs,eligibleEpisodes:eligible.length,outcomes,terminalOutcomes:count(a.map(a=>a.unwind?.outcome??a.outcome)),observed,
   cleanPairs:outcomes.CLEAN_PAIR??0,cleanFractionAllEpisodes:eligible.length?(outcomes.CLEAN_PAIR??0)/eligible.length:null,
   cleanFractionObserved:observed?(outcomes.CLEAN_PAIR??0)/observed:null,
   callbackLagMs:{median:median(lags),max:lags.length?Math.max(...lags):null},
   byClass:Object.fromEntries(['STRICT_EQUIVALENT','ORDINARY_EQUIVALENT_BASIS_RISK'].map(c=>[c,count(eligible.filter(e=>e.settlement.classification===c).flatMap(e=>e.attempts.filter(a=>a.capDollars===executionStudyPolicy.baselineCapDollars&&a.delayMs===delayMs).map(a=>a.outcome)))]))};
 });
 const perDelay=survival(firstEligible),capturePerDelay=survival(episodes);
 const representatives=continuity.groups.map(g=>g[0]);
 const keys=count(episodes.map(e=>e.key)),durations=episodes.map(e=>(e.end??e.lastEligibleAt)-e.start);
 const baseline=paperPortfolio(episodes,executionStudyPolicy.baselineCapDollars,executionStudyPolicy.baselineLatencyMs);
 const observed=perDelay.find(d=>d.delayMs===executionStudyPolicy.baselineLatencyMs)!;
 const conclusion=study.skipped.CAPTURE_LIMIT||representatives.length&&observed.observed===0?'EXECUTION STUDY BLOCKED — native future-state coverage unavailable':
  representatives.length<30?'INSUFFICIENT VALID OPPORTUNITY FREQUENCY — DETECTOR WORKS BUT EDGE IS TOO RARE':
  baseline.acceptedEntries>=10&&baseline.modeledPortfolioPnlDollars!==null&&baseline.modeledPortfolioPnlDollars>0&&observed.cleanFractionAllEpisodes!==null&&observed.cleanFractionAllEpisodes>=.8?
   'PAPER ECONOMICS PROMISING — EXECUTABLE PROMOTED OPPORTUNITIES SURVIVE REALISTIC LATENCY':
   'PAPER ECONOMICS WEAK — VALID OPPORTUNITIES EXIST BUT DO NOT SURVIVE REALISTIC EXECUTION';
 return {scope:'Conditional native displayed taker depth, no actual fills or realized profit. Ordinary settlement assumption for basis trades; no divergence probability assigned.',policy:executionStudyPolicy,
  observationMinutes:windowMs/60_000,episodes:representatives.length,episodeCountScope:'Conservative lower bound: freshness gaps merged until an observed economic disappearance; unseen recurrence unknown',captureSegments:episodes.length,classes:count(representatives.map(e=>e.settlement.classification)),families:count(representatives.map(e=>e.settlement.certificate.family??'unknown')),captureClasses:count(episodes.map(e=>e.settlement.classification)),captureFamilies:count(episodes.map(e=>e.settlement.certificate.family??'unknown')),
  uniqueRoutes:Object.keys(keys).length,recurringRoutes:continuity.recurringRoutes,confirmedReturns:continuity.confirmedReturns,freshnessResumedRoutes:Object.values(keys).filter(n=>n>1).length,maxCaptureSegmentsPerRoute:episodes.length?Math.max(...Object.values(keys)):0,
  observedEpisodeRatePerHour:windowMs>0?representatives.length/(windowMs/3600_000):null,leftCensored:episodes.filter(e=>e.leftCensored).length,rightCensored:episodes.filter(e=>e.rightCensored).length,
  episodeDurationMs:{median:median(durations),max:durations.length?Math.max(...durations):null,uncensoredMedian:median(episodes.filter(e=>!e.leftCensored&&!e.rightCensored).map(e=>e.end!-e.start))},
  medianPerContractNetDollars:median(firstEligible.map(e=>{const p=e.plans.find(p=>p.capDollars===executionStudyPolicy.baselineCapDollars)!;return usd(p.evaluation.estimatedNetProfit!)/p.evaluation.quantity;})),contentUpdateMedianPerContractNetDollars:median(episodes.flatMap(e=>e.netEdges.map(usd))),quoteUpdates:episodes.reduce((n,e)=>n+e.quoteUpdates,0),
  latencySurvival:perDelay,captureLatencySurvival:capturePerDelay,opportunityGroups:continuity.groups.map((g,i)=>({id:i+1,key:g[0].key,captureIds:g.map(e=>e.id),firstEligibleBaselineCapture:g.find(e=>e.plans.some(p=>p.capDollars===executionStudyPolicy.baselineCapDollars))?.id??null,knownEconomicEnd:g.at(-1)!.endReason==='ECONOMIC_DISAPPEARANCE'})),baseline,capitalSensitivity:executionStudyPolicy.capitalCapsDollars.map(cap=>paperPortfolio(episodes,cap,executionStudyPolicy.baselineLatencyMs)),
  latencyPortfolios:executionStudyPolicy.latenciesMs.map(delay=>paperPortfolio(episodes,executionStudyPolicy.baselineCapDollars,delay)),skipped:study.skipped,conclusion};
}
