import type {Book,Pair,Venue} from './types.ts';
import {MultiPaper,multiPolicy,reviewedRows,rowScope} from './multi-paper.ts';
import type {ReviewRow,InitialJournal} from './multi-paper.ts';
import {admission,newSession,reserve} from './ksu-paper.ts';
import type {Candidate,Constraints,Status,Session,LegPlan,LegResult} from './ksu-paper.ts';
import {quoteCandidate} from '../screen/confirmation.ts';
import {walk} from './engine.ts';
import {feeBounds,feeSchedule} from '../research/fees.ts';

export const sessionPolicy=Object.freeze({...multiPolicy,mode:'PRODUCTION_LIKE_PAPER_SESSION',durationMs:7200000,
  admissionMarginPerContract:0,additionalAdmissionMarginPerContract:0,maxShadowAttempts:20,maxConfirmations:120,maxConfirmationsPerRoute:4,
  routeConfirmationCooldownMs:60000,shadowMaterialPrice:100,shadowMaterialDepthFraction:0.25,
  shadowMaterialMinimumQuantity:1,rankingComparableFraction:0.10,
  ranking:'FEE_NET_DOLLARS_THEN_CAPITAL_EFFICIENCY; SHORTER_HORIZON_WITHIN_10_PERCENT',
  horizon:'CURRENT_EXPECTED_OR_ADMINISTRATIVE_TIMES_INDICATIVE_ONLY_CASH_RELEASE_UNCERTAIN'} as const);
export const workingScenario=Object.freeze({label:'STRATEGY_ZERO_MARGIN',admissionMarginPerContract:0});
export function challengerSeed(journal:any):InitialJournal{
  const scenarios=journal.scenarios?.filter((s:any)=>s.scenario?.label==='CHALLENGER_0C');
  if(!journal.alternativeScenariosNeverAdditive||scenarios?.length!==1)throw Error('EXACT_CHALLENGER_SEED_REQUIRED');
  const s=scenarios[0];
  if(s.entries?.length!==2||!['KXDWTSRANK-226DEC31-JSTIL','KXNCAAFPAC12-26-ORST'].every(id=>s.entries.some((e:any)=>e.row.kalshiId===id)))throw Error('JULIA_OREGON_HOLDINGS_REQUIRED');
  return structuredClone({portfolio:s.portfolio,entries:s.entries});
}
export class StrategyPaper extends MultiPaper{
  constructor(review:{rows:ReviewRow[]},seed:InitialJournal){super(review,workingScenario,seed);}
  override select(...args:Parameters<MultiPaper['select']>){
    // Inherited selection uses fee-net dollars in zero-margin mode; ties prefer capital efficiency.
    const [row,pair,a,b,status,c,at]=args;
    const base=super.select(...args),eligible=Array.from({length:10},(_,i)=>quoteCandidate(pair,a,b,row.sides.kalshi,at,i+1)).filter(q=>!this.gates(row,pair,q,status,c).length);
    eligible.sort(compareEconomics);return {...base,selected:eligible[0]??null};
  }
}
export function economics(q:Candidate){const e=q.economics;return {feeNetSurplus:e?.feeBoundSurplus??null,reservedRiskCash:e?.riskAllowance??null,analyticalRiskEstimate:e?.riskAllowance??null,conditionalSurplusNetOfAnalyticalRisk:e?e.feeBoundSurplus-e.riskAllowance:null,reservation:e?.reservedCash??null,capitalEfficiency:e?e.feeBoundSurplus/e.reservedCash:null};}
export function compareEconomics(a:Candidate,b:Candidate){return (b.economics?.feeBoundSurplus??-Infinity)-(a.economics?.feeBoundSurplus??-Infinity)||((b.economics?.feeBoundSurplus??0)/(b.economics?.reservedCash??1)-(a.economics?.feeBoundSurplus??0)/(a.economics?.reservedCash??1))||a.quantity-b.quantity;}
export type Times={kalshiClose?:string;kalshiExpected?:string;kalshiLatest?:string;polyEnd?:string};
export function horizon(times:Times,q:Candidate,at:number){
  const valid=(s:string|undefined)=>s&&Number.isFinite(Date.parse(s))&&Date.parse(s)>at?Date.parse(s):null;
  const k=valid(times.kalshiExpected)??valid(times.kalshiClose),p=valid(times.polyEnd),indicativeAt=k&&p?Math.max(k,p):null,days=indicativeAt?(indicativeAt-at)/86400000:null;
  return {sourceTimes:times,indicativeAt,indicativeDays:days,cashRelease:'UNCERTAIN_NOT_GUARANTEED',basis:'MAX_KALSHI_EXPECTED_OR_CLOSE_AND_POLY_ADMINISTRATIVE_END',feeNetSurplusPerReservedDollarDay:days&&q.economics?q.economics.feeBoundSurplus/q.economics.reservedCash/days:null};
}
export function rankOpportunities<T extends {quote:Candidate;times:Times}>(items:T[],at:number){
  const sorted=[...items].sort((a,b)=>compareEconomics(a.quote,b.quote));if(!sorted.length)return sorted;
  const best=sorted[0].quote.economics!.feeBoundSurplus,comparable=sorted.filter(x=>x.quote.economics!.feeBoundSurplus>=best*(1-sessionPolicy.rankingComparableFraction));
  // A bounded scheduling preference stops a long horizon from monopolizing comparable economics.
  comparable.sort((a,b)=>(horizon(a.times,a.quote,at).indicativeDays??Infinity)-(horizon(b.times,b.quote,at).indicativeDays??Infinity)||compareEconomics(a.quote,b.quote));
  const first=comparable[0];return [first,...sorted.filter(x=>x!==first)];
}
export function executionClass(results:Partial<Record<Venue,LegResult>>){const r=Object.values(results);return r.length!==2||r.some(x=>x.outcome==='INCONCLUSIVE')?'INCONCLUSIVE':r.every(x=>x.outcome==='FILLED')?'PAIRED_MODELED_FILLS':r.every(x=>x.outcome==='NO_FILL')?'NO_FILLS':'ONE_LEG_FAILURE';}
export function arrivalMovement(plan:LegPlan,market:Pair['a'],book:Book|undefined,reasons:string[]){
  const schedule=feeSchedule(market),levels=book?.[plan.side]??[],f=schedule&&book?walk(levels,plan.quantity,schedule.rate,schedule.rounding):null;
  if(f&&schedule)f.fees=feeBounds(f.levels,schedule).upper;
  return {evidenceUsable:!reasons.length&&!!book,quantity:plan.quantity,confirmationAveragePrice:plan.planned.cost/plan.quantity,arrivalAveragePrice:f?f.cost/plan.quantity:null,
    priceMovementPerContract:f?(f.cost-plan.planned.cost)/plan.quantity:null,entryDebitMovement:f?f.cost+f.fees-plan.entryBudget:null,
    depthWithinFrozenLimit:levels.filter(l=>l.price<=plan.ceiling&&l.price%plan.tick===0).reduce((n,l)=>n+l.quantity,0),arrivalLevels:levels.slice(0,20),depthEvidenceTruncated:levels.length>20};
}
export type ShadowSignature={quantity:number;kalshiPrice:number;polyPrice:number;kalshiDepth:number;polyDepth:number};
export function shadowSignature(q:Candidate,a:Book,b:Book):ShadowSignature{return {quantity:q.quantity,kalshiPrice:q.economics!.kalshi.cost/q.quantity,polyPrice:q.economics!.poly.cost/q.quantity,kalshiDepth:a[q.aSide].filter(l=>l.price<=Math.max(...q.economics!.kalshi.levels.map(x=>x.price))).reduce((n,l)=>n+l.quantity,0),polyDepth:b[q.bSide].filter(l=>l.price<=Math.max(...q.economics!.poly.levels.map(x=>x.price))).reduce((n,l)=>n+l.quantity,0)};}
export function materiallyChanged(a:ShadowSignature,b:ShadowSignature){return Math.abs(a.kalshiPrice-b.kalshiPrice)>=sessionPolicy.shadowMaterialPrice||Math.abs(a.polyPrice-b.polyPrice)>=sessionPolicy.shadowMaterialPrice||Math.abs(a.quantity-b.quantity)>=sessionPolicy.shadowMaterialMinimumQuantity||(['kalshiDepth','polyDepth'] as const).some(k=>Math.abs(a[k]-b[k])>=Math.max(1,a[k]*sessionPolicy.shadowMaterialDepthFraction));}
export class ShadowCollector{
  readonly allowed:ReviewRow[]; attempts:{row:ReviewRow;signature:ShadowSignature;session:Session}[]=[];busy=false;
  constructor(review:{rows:ReviewRow[]}){const r=reviewedRows(review);this.allowed=r.retained.filter(x=>!r.authorized.some(y=>y.pairId===x.pairId));}
  authorized(row:ReviewRow){return this.allowed.some(r=>JSON.stringify(r)===JSON.stringify(row));}
  gates(row:ReviewRow,pair:Pair,q:Candidate,status:Status,c:Constraints){return [...admission(pair,q,status,c,{kalshi:500000,poly:500000},rowScope(row,0)).reasons,...(!this.authorized(row)?['NOT_EXECUTION_ONLY_SHADOW']:[]),...(this.attempts.length>=sessionPolicy.maxShadowAttempts?['SHADOW_ATTEMPT_LIMIT']:[])];}
  select(row:ReviewRow,pair:Pair,a:Book|undefined,b:Book|undefined,status:Status,c:Constraints,at:number){
    const all=Array.from({length:10},(_,i)=>quoteCandidate(pair,a,b,row.sides.kalshi,at,i+1)).sort(compareEconomics);
    const selected=all.find(q=>!this.gates(row,pair,q,status,c).length)??null;return {selected,best:selected??all[0]};
  }
  canAttempt(row:ReviewRow,signature:ShadowSignature){const previous=this.attempts.filter(x=>x.row.pairId===row.pairId);return this.authorized(row)&&this.attempts.length<sessionPolicy.maxShadowAttempts&&previous.every(x=>materiallyChanged(x.signature,signature));}
  begin(row:ReviewRow,pair:Pair,q:Candidate,status:Status,c:Constraints,signature:ShadowSignature,at:number,mono:number){
    if(this.busy||!this.canAttempt(row,signature)||this.gates(row,pair,q,status,c).length)throw Error('SHADOW_NOT_ADMITTED');
    // Disposable execution sandbox. No reference to the strategy cash or positions; no payout/settlement calculation.
    const session=newSession();session.state.cash={kalshi:500000,poly:500000};reserve(session,pair,q,status,c,at,mono,rowScope(row,0));
    this.attempts.push({row,signature,session});this.busy=true;return session;
  }
  summary(){return {mode:'EXECUTION_ONLY_SHADOW',strategyCashDelta:0,strategyInventoryDelta:0,settlementAssumption:'NONE',attempts:this.attempts.map(({row,session:s})=>({pairId:row.pairId,route:row.sides,quantity:s.plan?.kalshi.quantity,feeNetDisplayedSpread:s.plan?s.plan.kalshi.quantity*10000-s.plan.kalshi.entryBudget-s.plan.poly.entryBudget:null,plans:s.plan,legs:s.results,executionClass:executionClass(s.results),failedLegExposure:executionClass(s.results)==='ONE_LEG_FAILURE'?Object.entries(s.results).filter(([,r])=>r.outcome==='FILLED').map(([venue,r])=>({venue,quantity:r.fill!.quantity,debit:r.fill!.cost+r.fill!.fees})):[],hypotheticalRecovery:s.recovery,hypotheticalRecoveryLoss:s.recoveryLoss}))};}
}
