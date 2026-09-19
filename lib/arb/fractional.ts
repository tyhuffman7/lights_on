const SCALE=10000;
export function quantityUnits(q:number){const n=Math.round(q*SCALE);if(!Number.isSafeInteger(n)||n<0||Math.abs(n/SCALE-q)>1e-9)throw Error('Unsupported contract precision');return n;}
const ceil=(n:bigint,d:bigint)=>Number((n+d-1n)/d);
export function fractionalCost(q:number,price:number){if(!Number.isSafeInteger(price)||price<0||price>SCALE)throw Error('Invalid price');return ceil(BigInt(quantityUnits(q))*BigInt(price),10000n);}
export function fractionalPayout(q:number,price:number){if(!Number.isSafeInteger(price)||price<0||price>SCALE)throw Error('Invalid payout');return Number(BigInt(quantityUnits(q))*BigInt(price)/10000n);}
export function fractionalFee(q:number,price:number,rate:number){if(!Number.isSafeInteger(rate)||rate<0||rate>10000)throw Error('Invalid fee');fractionalCost(q,price);return 100*ceil(BigInt(quantityUnits(q))*BigInt(price)*BigInt(10000-price)*BigInt(rate),100000000000000n);}

// Upper bound on a maker fill's debit at cent account precision, before rebates.
// Include fractional notional alignment even when the headline maker rate is zero.
export function makerFillFee(q:number,price:number,rate:number){
 const cost=fractionalCost(q,price);if(!Number.isSafeInteger(rate)||rate<0||rate>10000)throw Error('Invalid fee');
 const qty=BigInt(quantityUnits(q)),p=BigInt(price);
 const costMicros=ceil(qty*p,100n),feeMicros=ceil(qty*p*BigInt(10000-price)*BigInt(rate),10000000000n);
 return 100*ceil(BigInt(costMicros+feeMicros),10000n)-cost;
}

// PM-US total commission cannot exceed half-to-even rounding of cumulative
// exact taker fees for one order (https://docs.polymarket.us/fees). This is an
// upper bound: individual-fill adjustments can collect less. No rebates assumed.
export function polyFractionalOrderFee(levels:{quantity:number;price:number}[],rate:number){
 if(!Number.isSafeInteger(rate)||rate<0||rate>10000)throw Error('Invalid fee');
 let numerator=0n;
 for(const l of levels){fractionalCost(l.quantity,l.price);const q=BigInt(quantityUnits(l.quantity)),p=BigInt(l.price);numerator+=q*p*BigInt(10000-l.price)*BigInt(rate);}
 const denominator=100000000000000n;let cents=numerator/denominator;const remainder=numerator%denominator;
 if(remainder*2n>denominator||(remainder*2n===denominator&&cents%2n===1n))cents++;
 const units=Number(cents*100n);if(!Number.isSafeInteger(units))throw Error('Fee overflow');return units;
}
