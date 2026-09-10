import type {Level,Pair,Side,Fill} from '../arb/types.ts';
import {feeSchedule,feeBounds,integer} from './fees.ts';
import type {FeeSchedule} from './fees.ts';
import {fresh} from './books.ts';
import type {StreamBook,ResearchConfig,SizeQuote,Evaluation} from './types.ts';
export function fill(levels:Level[],q:number,schedule:FeeSchedule,sell=false): (Fill & {feeUpper:number})|null{
 integer(q,1,1000000);let left=q,cost=0;const used:Level[]=[];
 for(const l of [...levels].sort((a,b)=>sell?b.price-a.price:a.price-b.price)){
  integer(l.price,1,9999);if(!Number.isFinite(l.quantity)||l.quantity<0)throw new Error('Invalid depth');
  const n=Math.min(left,Math.floor(l.quantity));if(!n)continue;used.push({price:l.price,quantity:n});cost+=n*l.price;left-=n;if(!left)break;
 }
 if(left)return null;const fees=feeBounds(used,schedule);return {quantity:q,cost,fees:fees.estimated,feeUpper:fees.upper,levels:used};
}
export function evaluate(pair:Pair,a:StreamBook,b:StreamBook,c:ResearchConfig,mono:number,wall:number,verified:boolean):Evaluation[]{
 const common:string[]=[];
 if(!verified)common.push('MAPPING_UNVERIFIED');
 if(!a.open||!b.open||!pair.a.open||!pair.b.open||[pair.a,pair.b].some(m=>!Number.isFinite(Date.parse(m.closeAt))||Date.parse(m.closeAt)<=wall))common.push('MARKET_CLOSED');
 if(!fresh(a,mono,wall,c.maxAgeMs)||!fresh(b,mono,wall,c.maxAgeMs))common.push('BOOK_STALE');
 if([pair.a,pair.b].some(m=>!m.category||/sport|unknown/i.test(m.category)))common.push('CATEGORY_EXCLUDED');
 const afee=feeSchedule(pair.a),bfee=feeSchedule(pair.b);if(!afee||!bfee)common.push('UNKNOWN_FEES');
 return (['yes','no'] as Side[]).map(aSide=>{
  const bSide:Side=pair.inverted?aSide:aSide==='yes'?'no':'yes';
  const quantity=(ls:Level[])=>ls.reduce((n,l)=>n+Math.floor(l.quantity),0);
  const maxQuantity=Math.min(quantity(a[aSide]),quantity(b[bSide]));
  const reasons=[...common],curve:SizeQuote[]=[];
  // Explicit numerical support limit; never silently truncate and call it full depth.
  if(maxQuantity>1000000)reasons.push('UNSUPPORTED_QUANTITY');
  if(afee&&bfee&&maxQuantity<=1000000){
   for(let q=Math.max(1,Math.ceil(pair.a.minQty),Math.ceil(pair.b.minQty));q<=maxQuantity;q++){
    const af=fill(a[aSide],q,afee),bf=fill(b[bSide],q,bfee);if(!af||!bf)break;
    const cost=af.cost+bf.cost,fees=af.fees+bf.fees,feeUpper=af.feeUpper+bf.feeUpper,reserve=q*c.reserve,payout=q*10000,outlay=cost+feeUpper+reserve;
    curve.push({quantity:q,aFill:af,bFill:bf,aVwap:af.cost/q,bVwap:bf.cost/q,cost,fees,feeUpper,reserve,payout,grossProfit:payout-cost,feeProfit:payout-cost-fees,profit:payout-outlay,roi:(payout-outlay)/outlay*100,outlay});
   }
  }
  const best=curve.reduce<SizeQuote|null>((x,y)=>!x||y.profit>x.profit?y:x,null);
  const bestGross=curve.reduce<SizeQuote|null>((x,y)=>!x||y.grossProfit>x.grossProfit?y:x,null);
  if(!best)reasons.push('DEPTH_GONE');else if(best.profit<c.minProfit||best.roi<c.minRoi)reasons.push('EDGE_BELOW_THRESHOLD');
  const bankroll:Record<string,SizeQuote|null>={};
  for(const dollars of c.bankrolls)bankroll[dollars]=curve.filter(x=>x.outlay<=dollars&&x.aFill.cost+(x.aFill as Fill&{feeUpper:number}).feeUpper+Math.ceil(x.reserve/2)<=dollars/2&&x.bFill.cost+(x.bFill as Fill&{feeUpper:number}).feeUpper+Math.floor(x.reserve/2)<=dollars/2).reduce<SizeQuote|null>((x,y)=>!x||y.profit>x.profit?y:x,null);
  return {pairId:pair.id,aSide,bSide,orientation:`kalshi_${aSide}+pm_us_${bSide}`,verified,reasons,curve,best,bestGross,maxQuantity,bankroll};
 });
}
