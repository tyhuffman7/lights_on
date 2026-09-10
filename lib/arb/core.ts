// All money is integer ten-thousandths of USD. Fees use exact rational arithmetic.
export const USD = 10000;
export function integer(n: number, min = 0, max = 1000000000) {
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error('Invalid numeric input');
  return n;
}
export function fee(q: number, p: number, rate: number, rounding: 'ceil' | 'even') {
  integer(q,1,1000000); integer(p,1,9999); integer(rate,0,10000);
  const n=BigInt(q)*BigInt(p)*BigInt(10000-p)*BigInt(rate), d=10000000000n;
  let cents=n/d; const r=n%d;
  if (rounding==='ceil' ? r>0n : r*2n>d || (r*2n===d && cents%2n!==0n)) cents++;
  return Number(cents)*100;
}
export function calculate(a: number, b: number, q: number, reserve = 100) {
  integer(reserve,0,10000);
  const fees=fee(q,a,700,'ceil')+fee(q,b,600,'even');
  const cost=(a+b)*q, payout=q*USD, buffer=reserve*q, profit=payout-cost-fees-buffer;
  return {cost,fees,reserve:buffer,payout,profit,roi:profit/(cost+fees+buffer)*100};
}
export const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n/USD);
