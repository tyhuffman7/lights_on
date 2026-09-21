import type {Book, Pair, Side, Level} from '../arb/types.ts';
import {defaults} from '../arb/types.ts';
import {USD} from '../arb/core.ts';
import {walk} from '../arb/engine.ts';
import {feeBounds, feeSchedule} from '../research/fees.ts';
import {assessSettlement} from '../research/settlement-validation.ts';
import type {Candidate} from '../research/matching.ts';

// Frozen observation policy, not trading authorization. No optimizer or ledger.
export const screenPolicy = Object.freeze({version:1, durationMs:1800000, maxRoutes:60,
  sampleMs:1000, maxContracts:10, capital:{kalshi:500000,poly:500000},
  recoveryPerContract:{kalshi:100,poly:500}, settings:{...defaults},
  sizing:'Largest whole quantity <=10 affordable at the WORST displayed price for the first 10 contracts; no price or parameter search',
  scope:'ORDER_DISABLED_PUBLIC_PRICE_COMPARISON_NO_FILL_OR_PROFIT_CLAIM'});
export function category(pair:Pair){return pair.a.identity?.sports ? `Sports/${pair.a.identity.competition??pair.a.identity.sport??'unknown'}` : pair.a.category || 'Unknown';}
export function labels(pair:Pair,at:number){
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(at);
  const event=pair.a.identity?.eventDate;
  const eventAt=Date.parse(pair.a.identity?.eventAt??'');
  return {sameDay:event ? event===day?'SAME_DAY':'NOT_SAME_DAY':'EVENT_DAY_UNKNOWN',
    horizon:[pair.a,pair.b].some(m=>!Number.isFinite(Date.parse(m.closeAt))||Date.parse(m.closeAt)<=at||Date.parse(m.closeAt)>at+defaults.maxDays*86400000)?'OUTSIDE_BASELINE_HORIZON':'WITHIN_BASELINE_HORIZON',
    strategy:!pair.a.identity?.sports?'NONSPORTS_OUTSIDE_PRIOR_MAKER_RUN':Number.isFinite(eventAt)&&(eventAt<at-6*3600000||eventAt>at+4*3600000)?'OUTSIDE_PRIOR_EVENT_WINDOW':'PRIOR_EVENT_WINDOW_OR_UNKNOWN'};
}
// Bundle by shared PM market; retain EVERY distinct Kalshi mapping in an admitted
// bundle. Round-robin categories prevents one sports family consuming the cap.
export function selectRoutes(candidates:Candidate[],at:number,cap=screenPolicy.maxRoutes){
  const unique=[...new Map(candidates.map(c=>[c.pair.id,c])).values()];
  const bundles=new Map<string,Candidate[]>();
  for(const c of unique){const k=category(c.pair)+'::'+c.pair.b.id;bundles.set(k,[...(bundles.get(k)??[]),c]);}
  const groups=new Map<string,Candidate[][]>();
  for(const b of bundles.values()){const k=category(b[0].pair);groups.set(k,[...(groups.get(k)??[]),b]);}
  for(const g of groups.values())g.sort((a,b)=>Number(labels(b[0].pair,at).sameDay==='SAME_DAY')-Number(labels(a[0].pair,at).sameDay==='SAME_DAY')||a[0].pair.id.localeCompare(b[0].pair.id));
  const selected:Candidate[]=[];
  while([...groups.values()].some(g=>g.length))for(const k of [...groups.keys()].sort()){
    const b=groups.get(k)!.shift();if(b&&selected.length+b.length<=cap)selected.push(...b);
  }
  const ids=new Set(selected.map(c=>c.pair.id));
  return {selected,omitted:unique.filter(c=>!ids.has(c.pair.id)).map(c=>({id:c.pair.id,category:category(c.pair),labels:labels(c.pair,at),reason:'FINITE_ROUTE_CAP_ATOMIC_SHARED_MARKET_BUNDLE'})),
    subscriptions:{kalshi:[...new Set(selected.map(c=>c.pair.a.id))],poly:[...new Set(selected.map(c=>c.pair.b.id))]}};
}
export function review(pair:Pair){const settlement=assessSettlement(pair);return {classification:pair.reviewed?'REVIEWED_PAIR':settlement.status==='CONDITIONAL'?'CONDITIONAL_PAIR':'UNVERIFIED_PRICE_COMPARISON',settlement};}
const sorted=(ls:Level[])=>ls.filter(l=>Number.isSafeInteger(l.price)&&l.price>0&&l.price<USD&&Number.isFinite(l.quantity)&&l.quantity>0).sort((a,b)=>a.price-b.price);
function capacity(ls:Level[]){return sorted(ls).reduce((n,l)=>n+Math.floor(l.quantity),0);}
function worst(ls:Level[]){let n=0,p=0;for(const l of sorted(ls)){n+=Math.floor(l.quantity);p=l.price;if(n>=screenPolicy.maxContracts)break;}return p;}
export function screenPair(pair:Pair,a:Book|undefined,b:Book|undefined,at:number,assessment=review(pair)){
 return (['yes','no'] as Side[]).flatMap(aSide=>(['TAKER_TAKER','MAKER_TAKER_HYPOTHETICAL'] as const).map(route=>{
  const bSide:Side=pair.inverted?aSide:aSide==='yes'?'no':'yes';
  const dataReasons:string[]=[];
  for(const [name,book] of [['KALSHI',a],['PM_US',b]] as const){
    if(!book){dataReasons.push(name+'_BOOK_MISSING');continue;}
    if(!book.open)dataReasons.push(name+'_BOOK_CLOSED');
    if((book as any).valid===false)dataReasons.push(name+'_BOOK_INVALID');
    if(at-book.receivedAt>defaults.maxAge||book.receivedAt>at+1000)dataReasons.push(name+'_RECEIPT_STALE');
    if(book.exchangeAt===null)dataReasons.push(name+'_EXCHANGE_TIME_UNKNOWN');
    else if(at-book.exchangeAt>defaults.maxAge||book.exchangeAt>at+1000)dataReasons.push(name+'_EXCHANGE_TIME_STALE');
  }
  if(a&&b&&Math.abs(a.receivedAt-b.receivedAt)>defaults.maxAge)dataReasons.push('BOOKS_UNSYNCHRONIZED');
  const policyReasons:string[]=[];
  if(!pair.reviewed)policyReasons.push('SETTLEMENT_RULES_NEED_REVIEW');
  if(!pair.a.open||!pair.b.open)policyReasons.push('MARKET_NOT_OPEN');
  if([pair.a,pair.b].some(m=>!m.category||/unknown/i.test(m.category)))policyReasons.push('UNKNOWN_CATEGORY');
  if(labels(pair,at).horizon==='OUTSIDE_BASELINE_HORIZON')policyReasons.push('OUTSIDE_SETTLEMENT_HORIZON');
  const bid=a?Math.max(0,...(aSide==='yes'?a.yesBids:a.noBids).map(l=>l.price)):0;
  const ask=a?sorted(a[aSide])[0]?.price:undefined;
  const hypothetical=route==='MAKER_TAKER_HYPOTHETICAL';
  const al=hypothetical ? bid>0&&ask!==undefined&&bid<ask?[{price:bid,quantity:screenPolicy.maxContracts}]:[] : a?.[aSide]??[];
  const bl=b?.[bSide]??[];
  if(!al.length||!bl.length)dataReasons.push(hypothetical?'NO_NONCROSSING_BID_OR_HEDGE_DEPTH':'ASK_DEPTH_MISSING');
  const minimum=Math.max(1,Math.ceil(pair.a.minQty),Math.ceil(pair.b.minQty));
  const ks=feeSchedule(pair.a),ps=feeSchedule(pair.b);
  if(!ks||!ps)policyReasons.push('UNKNOWN_FEE_SCHEDULE');
  // Two cents per leg bounds a whole-contract quadratic fee at supported rates;
  // higher coefficients use ceil(rate/4) with an additional cent for rounding.
  const kFee=ks?Math.ceil(ks.rate/4/100)*100:USD;
  const pFee=ps?Math.ceil(ps.rate/4/100)*100:USD;
  const unitK=worst(al)+kFee+screenPolicy.recoveryPerContract.kalshi+Math.ceil(defaults.reserve/2);
  const unitP=worst(bl)+pFee+screenPolicy.recoveryPerContract.poly+Math.floor(defaults.reserve/2);
  const q=Math.max(0,Math.min(screenPolicy.maxContracts,capacity(al),capacity(bl),Math.floor(defaults.maxTrade/(unitK+unitP)),Math.floor(screenPolicy.capital.kalshi/unitK),Math.floor(screenPolicy.capital.poly/unitP)));
  if(!Number.isFinite(minimum)||q<minimum)policyReasons.push('NO_SIZE_WITHIN_DEPTH_MINIMUM_AND_SMALL_CAPITAL');
  const af=ks&&q>=minimum?walk(al,q,ks.rate,ks.rounding):null,bf=ps&&q>=minimum?walk(bl,q,ps.rate,ps.rounding):null;
  let economics=null;
  if(af&&bf&&ks&&ps){
    const ka=feeBounds(af.levels,ks),pb=feeBounds(bf.levels,ps);
    const cost=af.cost+bf.cost,fees=ka.upper+pb.upper,payout=q*USD;
    const riskAllowance=q*defaults.reserve;
    const recoveryReservation={kalshi:q*screenPolicy.recoveryPerContract.kalshi,poly:q*screenPolicy.recoveryPerContract.poly};
    const exchangeNet=payout-cost-fees,afterRisk=exchangeNet-riskAllowance;
    const reservedCash=cost+fees+riskAllowance+recoveryReservation.kalshi+recoveryReservation.poly;
    const roi=afterRisk/(cost+fees+riskAllowance)*100;
    if(afterRisk<defaults.minProfit)policyReasons.push('BELOW_10_CENT_PROFIT_FLOOR');
    if(roi<defaults.minRoi)policyReasons.push('BELOW_1_PERCENT_ROI');
    if(reservedCash>defaults.maxTrade)policyReasons.push('ENTRY_RESERVATION_EXCEEDS_10_DOLLARS');
    if(reservedCash>defaults.maxCommitted)policyReasons.push('BASELINE_COMMITMENT_CAP');
    economics={quantity:q,kalshi:{...af,feeBound:ka.upper},poly:{...bf,feeBound:pb.upper},cost,feeBound:fees,payout,
      exchangeNetUnderFeeBound:exchangeNet,riskAllowance,afterRisk,roi,recoveryReservation,reservedCash,
      recoveryIsExpense:false,feeProvenance:{kalshi:{...ks,scope:hypothetical?'TAKER_COEFFICIENT_FALLBACK_FOR_PROPOSED_MAKER; NO_REBATES':'WHOLE_CONTRACT_FRAGMENTATION_CENT_BOUND'},poly:{...ps,scope:'CUMULATIVE_ORDER_CEILING_NOT_COLLECTED_COMMISSION'},
      uncertainty:'Kalshi member classification and actual fill fragmentation unknown; whole-contract bound does not bound arbitrary fractional balance rounding. PM ceiling may exceed collected fees.'}};
  }
  return {pairId:pair.id,category:category(pair),at,route,aSide,bSide,inverted:pair.inverted,
    classification:assessment.classification,labels:labels(pair,at),settlementBlockers:assessment.settlement.blockers,
    dataReasons,policyReasons,economics,
    displayedDepthExecutable:!hypothetical&&dataReasons.length===0&&!!economics,
    qualifies:false,qualificationReasons:[...dataReasons,...policyReasons,'ORDER_DISABLED','ACCOUNT_FEE_CLASS_AND_FRAGMENTATION_UNVERIFIED','OHIO_LIVE_ELIGIBILITY_NOT_REVALIDATED',...(hypothetical?['RESTING_BID_IS_NOT_AVAILABLE_FILL']:[])],
    proposedBid:hypothetical?bid:null,queueAhead:hypothetical&&a?(aSide==='yes'?a.yesBids:a.noBids).filter(l=>l.price>=bid).reduce((s,l)=>s+l.quantity,0):null,
    timestamps:{kalshi:a?{receivedAt:a.receivedAt,exchangeAt:a.exchangeAt}:null,poly:b?{receivedAt:b.receivedAt,exchangeAt:b.exchangeAt}:null},
    feeSources:['https://docs.kalshi.com/getting_started/fee_rounding','https://kalshi.com/docs/kalshi-fee-schedule.pdf','https://docs.polymarket.us/fees']};
 }));
}
