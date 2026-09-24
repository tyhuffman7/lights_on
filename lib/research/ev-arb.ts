import type {Level, Pair, Side, Venue} from '../arb/types.ts';
import type {StreamBook} from './types.ts';
import {conservativeFee, type FeeEvidence} from '../pilot/bounded-basis.ts';

// Money is stored as integer 1e-8 dollars. A 0.0001-contract fill at a
// 0.0001-dollar price is exactly one unit; no floating point P&L is persisted.
export const USD_SCALE = 100_000_000;
export const evPaperDefaults = Object.freeze({version:'ev-arb-paper-v1',ordersEnabled:false,
  kalshiCapital:50*USD_SCALE,pmUsCapital:50*USD_SCALE,maxPairedCommitment:5*USD_SCALE,
  maxOneSidedExposure:2*USD_SCALE,maxActiveAttempts:1,dailyRealizedLossStop:5*USD_SCALE,
  hedgeDelayMs:250,maxBookAgeMs:2000,minEmpiricalAttempts:30,maxHedgeSlippage:5_000_000});
export type EvPaperPolicy = typeof evPaperDefaults;
export type SettlementStatus = 'ECONOMICALLY_EQUIVALENT'|'BOUNDED_BASIS'|'UNVERIFIED'|'INCOMPATIBLE';
export type Taken = {levels:Level[];quantity:number;cost:number;lastPrice:number};
export type ArbEvaluation = {
  strategy:'ev-arb-paper-v1';pairId:string;markets:{kalshi:string;poly:string};
  orientation:string;kalshiSide:Side;polySide:Side;quantity:number;at:number;
  sourceBooks:{kalshi:{at:number;exchangeAt:number|null;source:string;capture?:StreamBook['capture']};poly:{at:number;exchangeAt:number|null;source:string;capture?:StreamBook['capture']}};
  settlementStatus:SettlementStatus;settlementWarnings:string[];
  grossStatus:'GROSS_ARB'|'NO_GROSS_ARB'|'NO_EXECUTABLE_DEPTH';grossProfit:number|null;
  acquisitionCost:number|null;estimatedFees:number|null;estimatedNetProfit:number|null;
  economicStatus:'REALISTIC_NET_POSITIVE'|'REALISTIC_NET_NONPOSITIVE'|'FEE_MODEL_UNAVAILABLE'|'NO_GROSS_ARB';
  feeConfidence:'UNCONFIRMED_ACCOUNT_PRECISION'|'FEE_MODEL_UNAVAILABLE';
  kalshi:Taken|null;poly:Taken|null;
  stress:{feeBound:number|null;feeBoundPass:boolean|null;oneTickProfit:number|null;oneTickPass:boolean|null;freshnessPass:boolean;failed:string[]};
  execution:{paperEligible:boolean;reasons:string[]};
};
const validPrice=(n:number)=>Number.isSafeInteger(n)&&n>0&&n<10000;
const tenThousandths=(n:number)=>{const v=Math.round(n*10000);return Number.isSafeInteger(v)&&v>0&&Math.abs(n*10000-v)<1e-5?v:null;};
function roundedCents(raw:bigint,rounding:'ceil'|'even'){
  const den=100_000_000_000_000n,base=raw/den,remainder=raw%den;
  return Number(base+(rounding==='ceil'?(remainder>0n?1n:0n):(remainder*2n>den||remainder*2n===den&&base%2n===1n?1n:0n)))*1_000_000;
}
export function takeDepth(levels:Level[],quantity:number,sell=false):Taken|null{
  if(!Number.isSafeInteger(quantity)||quantity<=0)return null;
  let left=quantity*10000,cost=0;const used:Level[]=[];
  for(const l of [...levels].sort((a,b)=>sell?b.price-a.price:a.price-b.price)){
    const available=tenThousandths(l.quantity);
    if(!validPrice(l.price)||available===null)throw Error('INVALID_EXECUTABLE_LEVEL');
    const amount=Math.min(left,available);if(!amount)continue;
    used.push({price:l.price,quantity:amount/10000});cost+=l.price*amount;left-=amount;
    if(!left)break;
  }
  return left?null:{levels:used,quantity,cost,lastPrice:used.at(-1)!.price};
}
export function partialBidDepth(levels:Level[],maximum:number):Taken|null{
  const total=Math.min(maximum*10000,levels.reduce((n,l)=>n+(tenThousandths(l.quantity)??0),0));
  const quantity=Math.floor(total/10000);return quantity?takeDepth(levels,quantity,true):null;
}
export function normalFee(levels:Level[],rate:number,venue:Venue):number|null{
  if(!Number.isSafeInteger(rate)||rate<0||rate>10000)return null;
  const parts=levels.map(l=>{
    const q=tenThousandths(l.quantity);if(q===null||!validPrice(l.price))throw Error('INVALID_FEE_LEVEL');
    return BigInt(q)*BigInt(l.price)*BigInt(10000-l.price)*BigInt(rate);
  });
  return venue==='kalshi'?parts.reduce((n,x)=>n+roundedCents(x,'ceil'),0):roundedCents(parts.reduce((n,x)=>n+x,0n),'even');
}
function stressEvidence(pair:Pair,venue:Venue):FeeEvidence{
  const m=venue==='kalshi'?pair.a:pair.b;
  return {marketId:m.id,marketHash:m.hash,checkedAt:0,expiresAt:0,source:{url:'https://invalid.local',sha256:''},
    rate:m.feeRate!,model:venue==='kalshi'?'KALSHI_FRAGMENT_BOUND':'PM_CUMULATIVE',
    ...(venue==='kalshi'?{balancePrecisionMicros:10000 as const,minFillHundredths:1}:{})};
}
const source=(b:StreamBook)=>({at:b.receivedAt,exchangeAt:b.exchangeAt,source:b.source,...(b.capture?{capture:b.capture}:{})});
export function evaluateEvArb(pair:Pair,books:Record<Venue,StreamBook>,side:Side,quantity=1,
    now=Date.now(),settlementStatus:SettlementStatus='UNVERIFIED',
    policy:EvPaperPolicy=evPaperDefaults,ticks:Record<Venue,number>={kalshi:100,poly:100},
    settlementWarnings:string[]=[]):ArbEvaluation{
  if(pair.a.venue!=='kalshi'||pair.b.venue!=='poly'||!['yes','no'].includes(side)||!Number.isSafeInteger(quantity)||quantity<=0)throw Error('INVALID_PAIR_OR_QUANTITY');
  const bSide:Side=pair.inverted?side:side==='yes'?'no':'yes';
  const reasons:string[]=[];
  if(books.kalshi.marketId!==pair.a.id||books.poly.marketId!==pair.b.id||!books.kalshi.valid||!books.poly.valid)reasons.push('BOOK_IDENTITY_OR_VALIDITY');
  const usableBooks=!reasons.length;
  const k=usableBooks?takeDepth(books.kalshi[side],quantity):null,p=usableBooks?takeDepth(books.poly[bSide],quantity):null;
  if(!k||!p)reasons.push('INSUFFICIENT_EXECUTABLE_DEPTH');
  const acquisitionCost=k&&p?k.cost+p.cost:null,grossProfit=acquisitionCost===null?null:quantity*USD_SCALE-acquisitionCost;
  const grossStatus=grossProfit===null?'NO_EXECUTABLE_DEPTH':grossProfit>0?'GROSS_ARB':'NO_GROSS_ARB';
  const kFee=k?normalFee(k.levels,pair.a.feeRate??NaN,'kalshi'):null;
  // The current PM-US combo curve changes at 11:59 PM ET on September 24.
  // A simple quadratic coefficient cannot price it after that instant.
  const comboCurveUnsupported=now>=Date.parse('2026-09-25T03:59:00Z')&&
    /combo/i.test(`${pair.b.category} ${pair.b.title} ${pair.b.id}`);
  const pFee=p&&!comboCurveUnsupported?normalFee(p.levels,pair.b.feeRate??NaN,'poly'):null;
  const estimatedFees=kFee===null||pFee===null?null:kFee+pFee;
  const estimatedNetProfit=grossProfit===null||estimatedFees===null?null:grossProfit-estimatedFees;
  const economicStatus=grossStatus!=='GROSS_ARB'?'NO_GROSS_ARB':estimatedNetProfit===null?'FEE_MODEL_UNAVAILABLE':estimatedNetProfit>0?'REALISTIC_NET_POSITIVE':'REALISTIC_NET_NONPOSITIVE';
  const stressGranularity=k?.levels.every(l=>Math.abs(l.quantity*100-Math.round(l.quantity*100))<1e-7);
  const feeBound=k&&p&&kFee!==null&&pFee!==null&&stressGranularity?conservativeFee(k.levels,stressEvidence(pair,'kalshi'))*10000+pFee:null;
  const feeBoundPass=feeBound===null||grossProfit===null?null:grossProfit>feeBound;
  const ticked=(v:Venue,t:Taken|null)=>t&&Number.isSafeInteger(ticks[v])&&ticks[v]>0&&t.levels.every(l=>l.price+ticks[v]<10000)?
    t.levels.map(l=>({...l,price:l.price+ticks[v]})):null;
  const tk=ticked('kalshi',k),tp=ticked('poly',p),tkFee=tk?normalFee(tk,pair.a.feeRate??NaN,'kalshi'):null,tpFee=tp?normalFee(tp,pair.b.feeRate??NaN,'poly'):null;
  const oneTickProfit=tk&&tp&&tkFee!==null&&tpFee!==null?quantity*USD_SCALE-
    tk.reduce((n,l)=>n+l.price*Math.round(l.quantity*10000),0)-tp.reduce((n,l)=>n+l.price*Math.round(l.quantity*10000),0)-tkFee-tpFee:null;
  const age=(b:StreamBook)=>now-b.receivedAt>=0&&now-b.receivedAt<=policy.maxBookAgeMs&&
    (b.exchangeAt===null||now-b.exchangeAt>=-1000&&now-b.exchangeAt<=policy.maxBookAgeMs);
  const freshnessPass=age(books.kalshi)&&age(books.poly)&&books.kalshi.source==='stream'&&books.poly.source==='stream'&&
    books.kalshi.connection==='LIVE'&&books.poly.connection==='LIVE';
  if(!freshnessPass)reasons.push('BOOK_STALE_OR_NOT_STREAM_CONFIRMED');
  if(!pair.a.open||!pair.b.open||!books.kalshi.open||!books.poly.open)reasons.push('MARKET_CLOSED');
  if(settlementStatus==='INCOMPATIBLE')reasons.push('SETTLEMENT_INCOMPATIBLE');
  if(economicStatus!=='REALISTIC_NET_POSITIVE')reasons.push(economicStatus);
  if(comboCurveUnsupported)reasons.push('PM_US_COMBO_FEE_CURVE_UNSUPPORTED');
  if(acquisitionCost!==null&&acquisitionCost+estimatedFees!>policy.maxPairedCommitment)reasons.push('PAIRED_COMMITMENT_CAP');
  if(k&&k.cost+(kFee??0)>policy.maxOneSidedExposure&&p&&p.cost+(pFee??0)>policy.maxOneSidedExposure)reasons.push('FIRST_LEG_EXPOSURE_CAP');
  const failed:string[]=[];if(feeBoundPass===false)failed.push('EXTREME_FRAGMENTATION_FEE');
  if(k&&feeBound===null)failed.push('STRESS_BOUND_UNAVAILABLE_FRACTIONAL_LEVELS');
  if(k&&p&&oneTickProfit===null)failed.push('NATIVE_PRICE_GRID_UNPROVEN');
  if(oneTickProfit!==null&&oneTickProfit<=0)failed.push('ONE_NATIVE_TICK_EACH_LEG');
  if(!freshnessPass)failed.push('BOOK_FRESHNESS');
  if(settlementStatus!=='ECONOMICALLY_EQUIVALENT')failed.push('SETTLEMENT_RISK');
  return {strategy:'ev-arb-paper-v1',pairId:pair.id,markets:{kalshi:pair.a.id,poly:pair.b.id},orientation:`kalshi_${side}+pm_us_${bSide}`,
    kalshiSide:side,polySide:bSide,quantity,at:now,sourceBooks:{kalshi:source(books.kalshi),poly:source(books.poly)},
    settlementStatus,settlementWarnings:settlementStatus==='ECONOMICALLY_EQUIVALENT'?settlementWarnings:[settlementStatus,...settlementWarnings],
    grossStatus,grossProfit,acquisitionCost,estimatedFees,estimatedNetProfit,economicStatus,
    feeConfidence:estimatedFees===null?'FEE_MODEL_UNAVAILABLE':'UNCONFIRMED_ACCOUNT_PRECISION',kalshi:k,poly:p,
    stress:{feeBound,feeBoundPass,oneTickProfit,oneTickPass:oneTickProfit===null?null:oneTickProfit>0,freshnessPass,failed},
    execution:{paperEligible:reasons.length===0,reasons}};
}
