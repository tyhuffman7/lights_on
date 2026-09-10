// All money is integer ten-thousandths of USD. Fees use exact rational arithmetic.
export const USD = 10000;
import {fee, integer, GENERAL_KALSHI_RATE, PM_US_JULY_2026_RATE} from '../research/fees.ts';
export {fee, integer} from '../research/fees.ts';
export function calculate(a: number, b: number, q: number, reserve = 100) {
  integer(reserve,0,10000);
  const fees=fee(q,a,GENERAL_KALSHI_RATE,'ceil')+fee(q,b,PM_US_JULY_2026_RATE,'even');
  const cost=(a+b)*q, payout=q*USD, buffer=reserve*q, profit=payout-cost-fees-buffer;
  return {cost,fees,reserve:buffer,payout,profit,roi:profit/(cost+fees+buffer)*100};
}
export const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n/USD);
