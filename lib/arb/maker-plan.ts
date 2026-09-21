import {fractionalWalk} from './maker-ledger.ts';import {makerFillFee} from './fractional.ts';
import {assess as assessBase} from './engine.ts';import type {Book,Pair,Settings} from './types.ts';
import {makerAllocation} from './maker-allocation.ts';
function assess(...args:Parameters<typeof assessBase>){
 const [pair,a,b,settings,cash,now,fillModel,selection={}]=args;
 return assessBase(pair,a,b,settings,cash,now,fillModel,{...selection,...(settings.makerRecovery?{admit:(quote:import('./types.ts').Quote)=>{
  const allocation=makerAllocation(quote);quote.makerAllocation=allocation;
  return allocation.kalshi<=cash.kalshi&&allocation.poly<=cash.poly&&allocation.kalshi+allocation.poly<=settings.maxTrade;
 }}:{})});
}
// Use the execution model's conservative per-level fees when reserving cash.
// These are modeled upper charges, not a replacement for venue fee metadata.
const makerFillModel:NonNullable<Parameters<typeof assess>[6]>=(levels,q,rate,_rounding,venue)=>{
 const fill=fractionalWalk(levels,q,rate,venue==='poly'?'even':'ceil');if(!fill)return null;
 if(venue==='kalshi')fill.fees=fill.levels.reduce((sum,l)=>sum+makerFillFee(l.quantity,l.price,rate),0);
 return fill;
};
// Prospective resting Kalshi bid + immediate PM-US hedge. This is a plan, not a fill.
// Prefer price improvement; otherwise join the existing bid with its real queue.
// Charge the existing taker fee unless a verified maker coefficient is supplied.
export function makerPlan(pair:Pair,a:Book,b:Book,settings:Settings,cash:{kalshi:number;poly:number},now=Date.now(),improve=false,makerFeeRate?:number):{quote:import('./types.ts').Quote;price:number;ahead:number;scope:'RESTING_QUOTE_PLAN_ONLY';feeAssumption:string}|null{
 const q=assessMakerQuote(pair,a,b,settings,cash,now,improve,makerFeeRate);
 if(!q?.eligible)return improve?makerPlan(pair,a,b,settings,cash,now,false,makerFeeRate):null;
 const price=q.aFill.levels[0].price,ahead=(q.aSide==='yes'?a.yesBids:a.noBids).filter(l=>l.price>=price).reduce((n,l)=>n+l.quantity,0);
 return {quote:q,price,ahead,scope:'RESTING_QUOTE_PLAN_ONLY' as const,feeAssumption:makerFeeRate===undefined?'Kalshi taker fee charged conservatively; no maker rebate assumed':'Published Kalshi maker coefficient; cent rounding bound; no rebates assumed'};
}

// Bid competitively inside a wide spread, retaining every original eligibility
// gate. Increasing an integer-cent bid cannot improve cost/ROI at fixed size,
// so binary search finds the highest eligible cent without scanning every tick.
export function competitiveMakerPlan(pair:Pair,a:Book,b:Book,settings:Settings,cash:{kalshi:number;poly:number},now=Date.now(),makerFeeRate?:number):ReturnType<typeof makerPlan>{
 let best=makerPlan(pair,a,b,settings,cash,now,true,makerFeeRate);if(!best)return null;
 const side=best.quote.aSide,ask=a[side][0];
 let lo=Math.floor(best.price/100)+1,hi=Math.ceil(ask.price/100)-1;
 const pricedPair=makerFeeRate===undefined?pair:{...pair,a:{...pair.a,feeRate:makerFeeRate}};
 while(lo<=hi){
  const mid=Math.floor((lo+hi)/2),price=mid*100;
  const q=assess(pricedPair,{...a,yes:side==='yes'?[{price,quantity:1000}]:[],no:side==='no'?[{price,quantity:1000}]:[]},b,settings,cash,now,makerFillModel);
  if(q?.eligible){best={...best,quote:q,price,ahead:(side==='yes'?a.yesBids:a.noBids).filter(l=>l.price>=price).reduce((n,l)=>n+l.quantity,0)};lo=mid+1;}else hi=mid-1;
 }
 return best;
}

// Preserve both economically eligible orientations for activity-aware selection.
export function competitiveMakerPlans(pair:Pair,a:Book,b:Book,settings:Settings,cash:{kalshi:number;poly:number},now=Date.now(),makerFeeRate?:number,score?:(plan:NonNullable<ReturnType<typeof makerPlan>>)=>number){
 return (['yes','no'] as const).flatMap(side=>{
  const scoped={...a,yesBids:side==='yes'?a.yesBids:[],noBids:side==='no'?a.noBids:[]};
  // Keep the join bid even when a more aggressive quote qualifies: activity
  // and queue rank price alternatives, not merely the richest direction.
  const candidates=[makerPlan(pair,scoped,b,settings,cash,now,false,makerFeeRate),makerPlan(pair,scoped,b,settings,cash,now,true,makerFeeRate),competitiveMakerPlan(pair,scoped,b,settings,cash,now,makerFeeRate)];
  const seen=new Set<number>();
  const prices=candidates.filter((plan):plan is NonNullable<typeof plan>=>{if(!plan||seen.has(plan.price))return false;seen.add(plan.price);return true;});
  // At most six prices, each using the existing <=1000-size enumeration.
  // Only the best scored eligible size at each price needs to survive.
  return score?prices.flatMap(plan=>{const ranked=refreshMakerPlan(pair,a,b,settings,cash,plan,now,makerFeeRate,score);return ranked?[ranked]:[];}):prices;
 });
}


// Same sizing and fee path as makerPlan; preserves rejected quotes for research.
export function assessMakerQuote(pair:Pair,a:Book,b:Book,settings:Settings,cash:{kalshi:number;poly:number},now=Date.now(),improve=false,makerFeeRate?:number){
 const levels=(side:'yes'|'no')=>{const bid=(side==='yes'?a.yesBids:a.noBids)[0],ask=a[side][0];if(!bid||!ask||bid.price>=ask.price)return [];const nextCent=(Math.floor(bid.price/100)+1)*100;const price=improve&&nextCent<ask.price?nextCent:bid.price;return [{price,quantity:1000}];};
 if(makerFeeRate!==undefined&&(!Number.isSafeInteger(makerFeeRate)||makerFeeRate<0||makerFeeRate>10000))throw Error('Invalid maker fee');
 const pricedPair=makerFeeRate===undefined?pair:{...pair,a:{...pair.a,feeRate:makerFeeRate}};
 return assess(pricedPair,{...a,yes:levels('yes'),no:levels('no')},b,settings,cash,now,makerFillModel);
}
// At the existing bid, the cheapest quote the current competitive policy tries.
// A null sized quote is deliberately not mislabeled as a fee failure.
export function makerQuoteDiagnostics(pair:Pair,a:Book,b:Book,settings:Settings,cash:{kalshi:number;poly:number},now=Date.now(),makerFeeRate?:number){
 return (['yes','no'] as const).map(side=>{
  const scoped={...a,yesBids:side==='yes'?a.yesBids:[],noBids:side==='no'?a.noBids:[]};
  const quote=assessMakerQuote(pair,scoped,b,settings,cash,now,false,makerFeeRate);
  if(!quote)return {side,quote:null,classification:'NO_SIZED_QUOTE' as const};
  const gross=quote.payout-quote.cost,afterFees=gross-quote.fees;
  return {side,quote,gross,afterFees,afterReserve:quote.profit,classification:quote.eligible?'ELIGIBLE':afterFees<=0?'NONPOSITIVE_AFTER_FEES':quote.profit<=0?'RESERVE_ERASES_EDGE':'POSITIVE_BUT_POLICY_REJECTED',belowMinimumProfit:quote.profit<settings.minProfit,belowMinimumRoi:quote.roi<settings.minRoi};
 });
}

// Revalidate a fixed side/price/quantity; never silently substitute a new size.
// During initial ranking, score all eligible sizes at that same side and price.
export function refreshMakerPlan(pair:Pair,a:Book,b:Book,settings:Settings,cash:{kalshi:number;poly:number},selected:NonNullable<ReturnType<typeof makerPlan>>,now=Date.now(),makerFeeRate?:number,score?:(plan:NonNullable<ReturnType<typeof makerPlan>>)=>number):ReturnType<typeof makerPlan>{
 const side=selected.quote.aSide,price=selected.price,ask=a[side][0];
 if(!ask||price>=ask.price)return null;
 if(makerFeeRate!==undefined&&(!Number.isSafeInteger(makerFeeRate)||makerFeeRate<0||makerFeeRate>10000))throw Error('Invalid maker fee');
 const ahead=(side==='yes'?a.yesBids:a.noBids).filter(l=>l.price>=price).reduce((n,l)=>n+l.quantity,0);
 const pricedPair=makerFeeRate===undefined?pair:{...pair,a:{...pair.a,feeRate:makerFeeRate}};
 const quote=assess(pricedPair,{...a,yes:side==='yes'?[{price,quantity:1000}]:[],no:side==='no'?[{price,quantity:1000}]:[]},b,settings,cash,now,makerFillModel,score?{score:quote=>score({...selected,quote,ahead})}:{quantity:selected.quote.quantity});
 return quote?.eligible?{...selected,quote,ahead}:null;
}
