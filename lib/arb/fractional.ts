const SCALE=10000;
export function quantityUnits(q:number){const n=Math.round(q*SCALE);if(!Number.isSafeInteger(n)||n<0||Math.abs(n/SCALE-q)>1e-9)throw Error('Unsupported contract precision');return n;}
const ceil=(n:bigint,d:bigint)=>Number((n+d-1n)/d);
export function fractionalCost(q:number,price:number){if(!Number.isSafeInteger(price)||price<0||price>SCALE)throw Error('Invalid price');return ceil(BigInt(quantityUnits(q))*BigInt(price),10000n);}
export function fractionalPayout(q:number,price:number){if(!Number.isSafeInteger(price)||price<0||price>SCALE)throw Error('Invalid payout');return Number(BigInt(quantityUnits(q))*BigInt(price)/10000n);}
export function fractionalFee(q:number,price:number,rate:number){if(!Number.isSafeInteger(rate)||rate<0||rate>10000)throw Error('Invalid fee');fractionalCost(q,price);return 100*ceil(BigInt(quantityUnits(q))*BigInt(price)*BigInt(10000-price)*BigInt(rate),100000000000000n);}
