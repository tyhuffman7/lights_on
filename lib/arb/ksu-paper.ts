import type {Book, Fill, Pair, State, Venue} from './types.ts';
import {initial, log} from './ledger.ts';
import {walk} from './engine.ts';
import {feeBounds, feeSchedule} from '../research/fees.ts';
import {quoteCandidate} from '../screen/confirmation.ts';

// Deliberately separate from every legacy/live admission path. Money: 1/10,000 USD.
export const ksuPolicy = Object.freeze({version:1, mode:'KSU_CONDITIONAL_PAPER_ONLY',
  kalshi:'KXNCAAFB12QUAL-26-KSU', poly:'aqc-cfb-big12-2026-12-04-champq-kanst',
  classification:'CONDITIONAL', ordersEnabled:false, liveAdmitted:false,
  capitalPerVenue:500000, maxReservation:120000, maxQuantity:10, maxAttempts:1,
  durationMs:1800000, graceMs:15000, transportMs:500, recoveryDelayMs:1000,
  maxRecoveryAttempts:1, recoveryPriceLossPerContract:500,
  confirmationSpacingMs:30000, maxConfirmations:60, riskPerContract:200,
  recoveryPerContract:Object.freeze({kalshi:100,poly:500}),
  minProfit:1000, minRoi:1, tif:'FOK', maxEvidenceBytes:64*1024*1024,
  ohioLiveEligibility:'NOT_REVALIDATED_LIVE_BLOCKED',
  horizon:'NAMED_2026_QUALIFICATION_ONLY_NO_CASH_RELEASE_DEADLINE',
  feeUncertainty:'Whole-contract fragmentation/cent-precision Kalshi bound; account class and fractional fragmentation unknown. PM cumulative order estimate is not collected commission.',
} as const);
export const ksuScenarios = [
  {name:'ordinary qualification or elimination',formula:'1-k+p = 1 only when k=p',cashRelease:'Venue-specific; not necessarily simultaneous'},
  {name:'cancellation',formula:'1-r+f; below 1 if PM fair payout f < Kalshi allocation r',cashRelease:'Kalshi postponement can extend up to two years; PM may extend or use fair value'},
  {name:'withdrawal / reinstatement',formula:'Kalshi withdrawal or settled elimination stays No; PM fair payout/reversal can differ',cashRelease:'Re-entry does not reopen an already settled Kalshi elimination'},
  {name:'correction / divergent cutoffs',formula:'k=1,p=0 gives zero for purchased NO+YES',cashRelease:'Different expiry/correction decisions can destroy complementarity'},
  {name:'settlement timing / review',formula:'Even equal final payouts do not make cash available together',cashRelease:'December 4 game date is not a guaranteed release date; no forced settlement'},
] as const;
export function conditionalPayout(q:number,k:number,p:number){
  if(!Number.isSafeInteger(q)||q<1||q>10||![k,p].every(x=>Number.isFinite(x)&&x>=0&&x<=1))throw Error('Invalid scenario');
  return q*10000*(1-k+p);
}
export function scopeReasons(pair:Pair){return pair.a.id===ksuPolicy.kalshi&&pair.b.id===ksuPolicy.poly&&pair.a.venue==='kalshi'&&pair.b.venue==='poly'&&!pair.inverted?[]:['OUTSIDE_NAMED_PAIR_SCOPE'];}
export type Status = {knownBlocked:boolean;reportedStatus:string|null;reasons:string[]};
export function assumedStatus(s:Status){
  const tolerated=new Set(['STATUS_CACHE_CURRENTNESS_UNPROVEN','NON_ATOMIC_INITIAL_STATE']);
  const reasons=s.reasons.filter(r=>!tolerated.has(r));
  if(s.knownBlocked)reasons.push('KNOWN_NONTRADING_STATE');
  if(s.reportedStatus!=='active')reasons.push('NOT_REPORTED_ACTIVE');
  return {admitted:reasons.length===0,reasons:[...new Set(reasons)],classification:'ACTIVE_STATUS_ASSUMPTION_NOT_PROVEN',provenance:s,liveAdmitted:false};
}
export type Constraints = Record<Venue,{tick:number;minimum:number}>;
export function contractDifferences(old:Pair,fresh:Pair){
  const differences:string[]=[];
  for(const key of ['a','b'] as const)for(const field of ['id','venue','title','outcome','opposite','rules','hash','closeAt','feeRate','feeRounding','minQty','exchangeIndex','identity'] as const)
    if(JSON.stringify(old[key][field])!==JSON.stringify(fresh[key][field]))differences.push(`${key}.${field}: ${JSON.stringify(old[key][field])} -> ${JSON.stringify(fresh[key][field])}`);
  return differences;
}
export type Candidate = ReturnType<typeof quoteCandidate>;
export type PaperScope={kalshi:string;poly:string;aSide:'yes'|'no';bSide:'yes'|'no';maxReservation:number;positiveOnly:boolean;admissionMarginPerContract?:number};
export function admission(pair:Pair,q:Candidate,status:Status,constraints:Constraints,cash:Record<Venue,number>,scope?:PaperScope){
  const scoped=scope?(pair.a.id===scope.kalshi&&pair.b.id===scope.poly&&pair.a.venue==='kalshi'&&pair.b.venue==='poly'&&!pair.inverted?[]:['OUTSIDE_NAMED_PAIR_SCOPE']):scopeReasons(pair);
  const reasons=[...scoped,...q.pricingReasons,...assumedStatus(status).reasons];
  if(q.pairId!==pair.id||q.aSide!==(scope?.aSide??'no')||q.bSide!==(scope?.bSide??'yes')||!q.positiveExchangeNet)reasons.push('WRONG_OR_NONPOSITIVE_ROUTE');
  if(!pair.a.open||!pair.b.open)reasons.push('METADATA_NOT_REPORTED_OPEN');
  const e=q.economics;
  if(!e)reasons.push('NO_EXECUTABLE_QUANTITY');
  else {
    if(scope?.positiveOnly){
      const margin=scope.admissionMarginPerContract??ksuPolicy.riskPerContract;
      if(!Number.isSafeInteger(margin)||margin<0)reasons.push('INVALID_ADMISSION_MARGIN');
      if(e.feeBoundSurplus-q.quantity*margin<=0)reasons.push(margin===ksuPolicy.riskPerContract?'NONPOSITIVE_AFTER_RISK':'NONPOSITIVE_AFTER_ADMISSION_MARGIN');
    }
    if(!scope?.positiveOnly&&e.afterRisk<ksuPolicy.minProfit)reasons.push('BELOW_10_CENT_AFTER_RISK_FLOOR');
    if(!scope?.positiveOnly&&e.afterRisk/(e.cost+e.feeBound+e.riskAllowance)*100<ksuPolicy.minRoi)reasons.push('BELOW_1_PERCENT_ROI');
    if(e.reservedCash>(scope?.maxReservation??ksuPolicy.maxReservation))reasons.push(scope?'ENTRY_RESERVATION_CAP':'TWELVE_DOLLAR_RESERVATION_CAP');
    for(const v of ['kalshi','poly'] as const){
      const c=constraints[v],fill=e[v];
      if(!Number.isSafeInteger(c.tick)||c.tick<=0||!Number.isFinite(c.minimum)||c.minimum<=0||q.quantity<c.minimum||!Number.isSafeInteger(q.quantity)||q.quantity>10||Math.abs(q.quantity/c.minimum-Math.round(q.quantity/c.minimum))>1e-7)reasons.push(v+'_QUANTITY_CONSTRAINT');
      if(fill.levels.some(l=>l.price%c.tick!==0))reasons.push(v+'_PRICE_GRID');
      if(!Number.isSafeInteger(cash[v])||cash[v]<e.venueReservedCash[v])reasons.push(v+'_CASH');
    }
  }
  return {admitted:reasons.length===0,reasons,classification:'CONDITIONAL',liveAdmitted:false};
}
export type LegPlan={venue:Venue;marketId:string;side:'no'|'yes';quantity:number;ceiling:number;entryBudget:number;recoveryBudget:number;riskCash:number;reserved:number;planned:Fill;tick:number;tif:'FOK';submittedAt:number;submittedMono:number;arrivalMono:number};
export type LegResult={outcome:'FILLED'|'NO_FILL'|'INCONCLUSIVE';reasons:string[];fill:Fill|null;at:number};
export type Session={state:State;attempts:number;plan:Record<Venue,LegPlan>|null;results:Partial<Record<Venue,LegResult>>;held:Record<Venue,number>;recovery:unknown;recoveryLoss:number|null};
export function newSession():Session{return {state:initial(),attempts:0,plan:null,results:{},held:{kalshi:0,poly:0},recovery:null,recoveryLoss:null};}
export function reserve(s:Session,pair:Pair,q:Candidate,status:Status,c:Constraints,at:number,mono:number,scope?:PaperScope){
  if(s.attempts||s.state.positions.length||!admission(pair,q,status,c,s.state.cash,scope).admitted)throw Error('Scoped entry rejected');
  const e=q.economics!;const plans={} as Record<Venue,LegPlan>;
  for(const v of ['kalshi','poly'] as const){const f=e[v];plans[v]={venue:v,marketId:v==='kalshi'?pair.a.id:pair.b.id,side:v==='kalshi'?q.aSide:q.bSide,quantity:q.quantity,ceiling:Math.max(...f.levels.map(l=>l.price)),entryBudget:f.cost+f.feeBound,recoveryBudget:e.recoveryCash[v],riskCash:e.riskAllowance/2,reserved:e.venueReservedCash[v],planned:{...f,fees:f.feeBound},tick:c[v].tick,tif:'FOK',submittedAt:at,submittedMono:mono,arrivalMono:mono+ksuPolicy.transportMs};}
  // Reserve both legs, risk and recovery BEFORE either modeled submission.
  s.attempts=1;s.plan=structuredClone(plans);
  for(const v of ['kalshi','poly'] as const){s.state.cash[v]-=plans[v].reserved;s.held[v]=plans[v].reserved;}
  log(s.state,'conditional paper reservation',scope?'Named conditional attempt; no real orders':'One KSU attempt; no real orders',at);
  return plans;
}
export function modelLeg(p:LegPlan,market:Pair['a'],book:Book|undefined,evidenceReasons:string[],knownClosed:boolean,at:number,mono:number):LegResult{
  const unknown=(reasons:string[]):LegResult=>({outcome:'INCONCLUSIVE',reasons,fill:null,at});
  if(mono<p.arrivalMono)return unknown(['TRANSPORT_NOT_ELAPSED']);
  if(evidenceReasons.length||!book)return unknown(evidenceReasons.length?evidenceReasons:['MISSING_ARRIVAL_BOOK']);
  if(knownClosed||!book.open)return {outcome:'NO_FILL',reasons:['KNOWN_CLOSED_AT_ARRIVAL'],fill:null,at};
  const schedule=feeSchedule(market);if(!schedule)return unknown(['FEE_MODEL_MISSING']);
  const f=walk(book[p.side].filter(l=>l.price<=p.ceiling&&l.price%p.tick===0),p.quantity,schedule.rate,schedule.rounding);
  if(!f)return {outcome:'NO_FILL',reasons:['FOK_INSUFFICIENT_DEPTH_WITHIN_FROZEN_LIMIT'],fill:null,at};
  f.fees=feeBounds(f.levels,schedule).upper;
  if(f.cost+f.fees>p.entryBudget)return {outcome:'NO_FILL',reasons:['FROZEN_ENTRY_BUDGET_EXCEEDED'],fill:null,at};
  return {outcome:'FILLED',reasons:['DELAYED_DISPLAYED_DEPTH_MODEL_NOT_REAL_FILL'],fill:f,at};
}
export function accountLeg(s:Session,pair:Pair,v:Venue,r:LegResult){
  if(!s.plan||s.results[v])throw Error('Missing plan or duplicate leg result');
  s.results[v]=structuredClone(r);const plan=s.plan[v];
  if(r.outcome==='INCONCLUSIVE')return; // Unknown is neither no-fill nor refundable.
  const debit=r.fill?r.fill.cost+r.fill.fees:0;
  if(debit>plan.entryBudget)throw Error('Debit exceeds frozen budget');
  const hold=r.fill?plan.riskCash+plan.recoveryBudget:0;
  s.state.cash[v]+=s.held[v]-debit-hold;s.held[v]=hold;
  if(r.fill){
    let pos=s.state.positions[0];
    if(!pos){const z:Fill={quantity:0,cost:0,fees:0,levels:[]};pos={id:pair.id+'@'+plan.submittedAt,pair:structuredClone(pair),openedAt:plan.submittedAt,status:'unmatched',aQuantity:0,bQuantity:0,aDebit:0,bDebit:0,quote:{pairId:pair.id,quantity:plan.quantity,aSide:s.plan.kalshi.side,bSide:s.plan.poly.side,aFill:z,bFill:z,cost:0,fees:0,reserve:plan.quantity*200,payout:0,profit:0,roi:0,reasons:['CONDITIONAL_UNREALIZED'],eligible:false,receivedAt:plan.submittedAt}};s.state.positions.push(pos);}
    const key=v==='kalshi'?'a':'b';pos[key==='a'?'aQuantity':'bQuantity']=r.fill.quantity;pos[`${key}Debit`]=debit;pos.quote[key==='a'?'aFill':'bFill']=r.fill;
    pos.quote.cost=pos.quote.aFill.cost+pos.quote.bFill.cost;pos.quote.fees=pos.quote.aFill.fees+pos.quote.bFill.fees;
    pos.status=pos.aQuantity===pos.bQuantity?'open':'unmatched';
  }
}
export type RecoveryPlan={venue:Venue;quantity:number;floor:number;feeBudget:number;submittedMono:number;arrivalMono:number;tif:'FOK'};
export function recoveryPlan(s:Session,mono:number):RecoveryPlan|null{
  if(!s.plan||s.recovery||Object.keys(s.results).length!==2||Object.values(s.results).some(r=>r.outcome==='INCONCLUSIVE'))return null;
  const v=(['kalshi','poly'] as const).find(v=>s.results[v]?.outcome==='FILLED'&&s.results[v==='kalshi'?'poly':'kalshi']?.outcome==='NO_FILL');if(!v)return null;
  const p=s.plan[v],f=s.results[v]!.fill!;
  return {venue:v,quantity:f.quantity,floor:Math.max(p.tick,Math.ceil((f.cost/f.quantity-ksuPolicy.recoveryPriceLossPerContract)/p.tick)*p.tick),feeBudget:p.recoveryBudget,submittedMono:mono,arrivalMono:mono+500,tif:'FOK'};
}
export function recover(s:Session,p:RecoveryPlan,market:Pair['a'],book:Book|undefined,reasons:string[],at:number,mono:number){
  if(s.recovery)throw Error('Recovery already attempted');
  s.recovery={plan:p,outcome:'INCONCLUSIVE',reasons};
  if(mono<p.arrivalMono||reasons.length||!book)return;
  const schedule=feeSchedule(market);if(!schedule)return;
  const side=s.plan![p.venue].side,bids=book[side==='no'?'noBids':'yesBids'];
  const f=book.open?walk(bids.filter(l=>l.price>=p.floor&&l.price%s.plan![p.venue].tick===0).map(l=>({...l,price:10000-l.price})),p.quantity,schedule.rate,schedule.rounding):null;
  if(!f){s.recovery={plan:p,outcome:'NO_FILL',reasons:['FOK_RECOVERY_DEPTH_OR_LIMIT']};return;}
  f.fees=feeBounds(f.levels,schedule).upper;
  if(f.fees>p.feeBudget){s.recovery={plan:p,outcome:'NO_FILL',reasons:['RECOVERY_FEE_RESERVATION']};return;}
  const proceeds=p.quantity*10000-f.cost-f.fees,pos=s.state.positions[0],key=p.venue==='kalshi'?'a':'b';
  s.state.cash[p.venue]+=proceeds+s.held[p.venue];s.held[p.venue]=0;
  pos[`${key}Payout`]=proceeds;pos[key==='a'?'bPayout':'aPayout']=0;pos.status='settled';pos.closedBy='early-exit';pos.closedAt=at;pos.profit=proceeds-pos.aDebit-pos.bDebit;pos.unwindLoss=-pos.profit;
  s.recoveryLoss=-pos.profit;s.recovery={plan:p,outcome:'FILLED',proceeds,fees:f.fees,levels:f.levels.map(l=>({...l,price:10000-l.price})),at};
}
export function accounting(s:Session){
  const p=s.state.positions[0],unknown=!!s.plan&&(Object.keys(s.results).length<2||Object.values(s.results).some(r=>r.outcome==='INCONCLUSIVE'));
  const paired=p?.status==='open'&&p.aQuantity===p.bQuantity;
  return {cash:s.state.cash,reserved:s.held,entryAttempts:s.attempts,positions:s.state.positions.length,
    residualInventory:{kalshi:p&&p.aPayout===undefined?p.aQuantity??0:0,poly:p&&p.bPayout===undefined?p.bQuantity??0:0},
    unresolvedPossibleInventory:unknown,conditionalUnrealizedSurplus:paired?(p.aQuantity??0)*10000-p.aDebit-p.bDebit:null,
    separateRiskAllowance:s.plan?s.plan.kalshi.riskCash+s.plan.poly.riskCash:0,recoveryLoss:s.recoveryLoss,
    realizedProfit:p?.closedBy==='early-exit'?p.profit:null,classification:'CONDITIONAL',liveAdmitted:false};
}
