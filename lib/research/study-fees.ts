import type {Level,Venue} from '../arb/types.ts';
import {normalFee} from './ev-arb.ts';

// USD units = 1e-8. One retained price level is one hypothetical fill.
// Hidden fragmentation is unknown; Kalshi's accumulator is retained per order.
export function orderFee(levels:Level[],rate:number,venue:Venue,sell=false,diagnostic=false):number|null{
 if(!Number.isSafeInteger(rate)||rate<0||rate>10000)return null;
 if(venue==='poly')return normalFee(levels,rate,venue); // published cumulative commission ceiling
 let accumulator=0n,total=0n;
 const precision=1_000_000n; // non-direct member cents; no account precision asserted
 for(const l of levels){
  const q=Math.round(l.quantity*10000);
  if(!Number.isSafeInteger(q)||q<=0||Math.abs(q-l.quantity*10000)>1e-5||!Number.isSafeInteger(l.price)||l.price<=0||l.price>=10000)throw Error('INVALID_FEE_LEVEL');
  const raw=BigInt(q)*BigInt(l.price)*BigInt(10000-l.price)*BigInt(rate);
  const trade=((raw+9_999_999_999n)/10_000_000_000n)*100n;
  const revenue=BigInt(q)*BigInt(l.price)*(sell?1n:-1n),change=revenue-trade;
  const rounding=((change%precision)+precision)%precision;
  if(diagnostic){total+=trade+rounding;continue;}
  accumulator+=rounding;
  const pre=trade+rounding;
  const rebate=(accumulator/precision<pre/precision?accumulator/precision:pre/precision)*precision;
  accumulator-=rebate;total+=pre-rebate;
 }
 return Number(total);
}
