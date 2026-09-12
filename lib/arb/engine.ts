import {integer,USD} from './core.ts';
import {feesForLevels} from '../research/fees.ts';
import type {Level,Fill,Book,Pair,Settings,Quote,Side} from './types.ts';
export function walk(levels:Level[],q:number,rate:number,rounding:'ceil'|'even'):Fill|null {
 integer(q,1,1000000);let left=q,cost=0,fees=0;const used:Level[]=[];
 for(const l of [...levels].sort((a,b)=>a.price-b.price)){
  if(!Number.isSafeInteger(l.price)||l.price<=0||l.price>=USD||!Number.isFinite(l.quantity)||l.quantity<=0)continue;
  const n=Math.min(left,Math.floor(l.quantity));if(!n)continue;
  cost+=n*l.price;used.push({price:l.price,quantity:n});left-=n;if(!left)break;
 }
 fees=feesForLevels(used,{rate,rounding,aggregation:rounding==='even'?'order':'level',source:'venue metadata'});
 return left ? null : {quantity:q,cost,fees,levels:used};
}
export function assess(pair:Pair,a:Book,b:Book,s:Settings,cash:{kalshi:number;poly:number},now=Date.now()):Quote|null {
 if([pair.a,pair.b].some(m=>!Number.isFinite(m.minQty)||m.minQty<=0))return null;
 const reasons:string[]=[];
 if(!pair.reviewed)reasons.push('Settlement rules need review');
 if([pair.a,pair.b].some(m=>/unknown/i.test(m.category)||!m.category))reasons.push('Unknown or missing market category');
 if(!pair.a.open||!pair.b.open||!a.open||!b.open)reasons.push('Market is not open');
 if([a,b].some(x=>now-x.receivedAt>s.maxAge||x.receivedAt>now+1000)||Math.abs(a.receivedAt-b.receivedAt)>s.maxAge)reasons.push('Stale or unsynchronized order books');
 if([a,b].some(x=>x.exchangeAt!==null && (now-x.exchangeAt>s.maxAge || x.exchangeAt>now+1000)))reasons.push('Exchange timestamp is stale');
 if([pair.a,pair.b].some(m=>m.feeRate===null))reasons.push('Unknown fee schedule');
 if([pair.a,pair.b].some(m=>!Number.isFinite(Date.parse(m.closeAt))||Date.parse(m.closeAt)<=now||Date.parse(m.closeAt)>now+s.maxDays*86400000))reasons.push('Outside settlement horizon');
 if(pair.a.feeRate===null||pair.b.feeRate===null)return null;
 let best:Quote|null=null;
 for(const aSide of ['yes','no'] as Side[]){
  const bSide:Side=pair.inverted?aSide:(aSide==='yes'?'no':'yes');
  const limit=Math.min(1000,...[a[aSide],b[bSide]].map(ls=>Math.floor(ls.reduce((n,l)=>n+l.quantity,0))));
  for(let q=Math.max(1,Math.ceil(pair.a.minQty),Math.ceil(pair.b.minQty));q<=limit;q++){
   const af=walk(a[aSide],q,pair.a.feeRate,pair.a.feeRounding),bf=walk(b[bSide],q,pair.b.feeRate,pair.b.feeRounding);if(!af||!bf)break;
   const cost=af.cost+bf.cost,fees=af.fees+bf.fees,reserve=q*s.reserve,total=cost+fees+reserve;
   if(total>s.maxTrade||af.cost+af.fees+Math.ceil(reserve/2)>cash.kalshi||bf.cost+bf.fees+Math.floor(reserve/2)>cash.poly)break;
   const profit=q*USD-total,roi=profit/total*100,why=[...reasons];
   if(profit<s.minProfit||roi<s.minRoi)why.push('Net edge below threshold');
   const x:Quote={pairId:pair.id,quantity:q,aSide,bSide,aFill:af,bFill:bf,cost,fees,reserve,payout:q*USD,profit,roi,reasons:why,eligible:why.length===0,receivedAt:Math.min(a.receivedAt,b.receivedAt)};
   if(!best||(x.eligible&&!best.eligible)||(x.eligible===best.eligible&&x.profit>best.profit))best=x;
  }
 }
 return best;
}
