import type {Level} from './types.ts';
import {fractionalCost,makerFillFee,quantityUnits} from './fractional.ts';
import {fractionalWalk} from './maker-ledger.ts';
// Pre-entry stress scenarios, not predicted fills. Each observed print size is
// evaluated independently as one maker fill and one immediate hedge. Queue
// residuals, future sizes, fragmentation and moving hedge prices can be worse.
export function observedSizeAdmission(input:{price:number;quantity:number;hedgeLevels:Level[];hedgeStep:number;makerRate:number;hedgeRate:number;reserve:number;sizes:number[]}){
 const units=quantityUnits(input.quantity),step=quantityUnits(input.hedgeStep);
 const sizes=[...new Set(input.sizes.map(q=>Math.min(quantityUnits(q),units)))];
 const result=(eligible:boolean,reason:string,minimumProfit:number|null)=>({eligible,reason,minimumProfit,distinctSizes:sizes.length,scope:'OBSERVED_SIZE_STRESS_NOT_FILL_PREDICTION' as const});
 if(!sizes.length)return result(false,'NO_RECENT_SIZES',null);
 // Bound additional selection work; do not silently discard adverse sizes.
 if(sizes.length>32)return result(false,'TOO_MANY_DISTINCT_SIZES',null);
 let minimum=Infinity;
 for(const n of sizes){
  if(!n||!step||n%step)return result(false,'UNHEDGEABLE_OBSERVED_SIZE',null);
  const q=n/10000,hedge=fractionalWalk(input.hedgeLevels,q,input.hedgeRate,'even');
  if(!hedge)return result(false,'INSUFFICIENT_HEDGE_DEPTH',null);
  const debit=fractionalCost(q,input.price)+makerFillFee(q,input.price,input.makerRate)+hedge.cost+hedge.fees+
   fractionalCost(q,Math.ceil(input.reserve/2))+fractionalCost(q,Math.floor(input.reserve/2));
  minimum=Math.min(minimum,n-debit);
 }
 return result(minimum>0,minimum>0?'PASS':'NONPOSITIVE_OBSERVED_SIZE',minimum);
}
