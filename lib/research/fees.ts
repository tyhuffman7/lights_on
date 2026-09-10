import type {Level, Market} from '../arb/types.ts';
export const GENERAL_KALSHI_RATE = 700;
export const PM_US_JULY_2026_RATE = 600;
export type FeeSchedule = {rate:number;rounding:'ceil'|'even';aggregation:'level'|'order';source:string};
export function integer(n:number,min=0,max=1000000000){
 if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error('Invalid numeric input');return n;
}
const denominator=10000000000n;
function numerator(q:number,p:number,rate:number){
 integer(q,1,1000000);integer(p,1,9999);integer(rate,0,10000);
 return BigInt(q)*BigInt(p)*BigInt(10000-p)*BigInt(rate);
}
function rounded(n:bigint,rounding:'ceil'|'even'){
 let cents=n/denominator;const r=n%denominator;
 if(rounding==='ceil'?r>0n:r*2n>denominator||(r*2n===denominator&&cents%2n!==0n))cents++;
 return Number(cents)*100;
}
export function fee(q:number,p:number,rate:number,rounding:'ceil'|'even'){
 return rounded(numerator(q,p,rate),rounding);
}
export function feeSchedule(m:Market):FeeSchedule|null{
 if(m.feeRate===null||!Number.isSafeInteger(m.feeRate)||m.feeRate<0||m.feeRate>10000)return null;
 if(m.venue==='kalshi'&&m.feeRounding==='ceil')return {rate:m.feeRate,rounding:'ceil',aggregation:'level',source:'supported Kalshi series quadratic metadata; per displayed level estimate'};
 if(m.venue==='poly'&&m.feeRounding==='even')return {rate:m.feeRate,rounding:'even',aggregation:'order',source:'PM-US market coefficient; rounded cumulative taker fee upper bound'};
 return null;
}
export function feesForLevels(levels:Level[],schedule:FeeSchedule|null):number{
 if(!schedule)throw new Error('Unknown fee schedule');
 if(schedule.aggregation==='order')return rounded(levels.reduce((n,l)=>n+numerator(l.quantity,l.price,schedule.rate),0n),schedule.rounding);
 return levels.reduce((n,l)=>n+fee(l.quantity,l.price,schedule.rate,schedule.rounding),0);
}
// Visible L2 does not disclose resting-order fill fragmentation. Keep fee bounds
// with every research quote; do not claim these are exact collected commissions.
export function feeBounds(levels:Level[],schedule:FeeSchedule){
 const estimated=feesForLevels(levels,schedule);
 const upper=schedule.aggregation==='order'?estimated:levels.reduce((n,l)=>n+l.quantity*fee(1,l.price,schedule.rate,schedule.rounding),0);
 return {estimated,upper,source:schedule.source};
}
