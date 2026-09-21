import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MakerQueue,kalshiSellPrint} from '../lib/arb/maker-evidence.ts';
import {makerFillFee,polyFractionalOrderFee} from '../lib/arb/fractional.ts';

test('independent price-priority counterexample and per-order fee references remain distinct from conservative production bounds',()=>{
// SYNTHETIC only: no hidden/replenished orders, cancels, latency ambiguity, or
// missing trades. The inserted order would improve the last execution's price.
const visible=[{id:'better',price:4200,left:10},{id:'same',price:4000,left:10},{id:'ours',price:4000,left:1},{id:'worse',price:3900,left:10}];
const q=new MakerQueue('FIXTURE','yes',4000,1,20,1000,3000);
const events=[{id:'a',price:4200,quantity:10,at:1100},{id:'b',price:4000,quantity:10,at:1200},{id:'c',price:3900,quantity:1,at:1300}];
let oracleFilled=0;
const queue=[];
for(const t of events){
  let left=t.quantity;
  for(const level of visible){
    if(level.price<t.price||left<=0)continue;
    const n=Math.min(level.left,left);level.left-=n;left-=n;
    if(level.id==='ours')oracleFilled+=n;
  }
  const printed=kalshiSellPrint({type:'trade',msg:{trade_id:t.id,market_ticker:'FIXTURE',taker_side:'no',taker_outcome_side:'no',taker_book_side:'ask',yes_price_dollars:(t.price/10000).toFixed(4),count_fp:String(t.quantity),ts_ms:t.at}});
  assert(printed);q.consume(printed,t.at+5);
  queue.push({print:t,modelAhead:q.ahead,modelFilled:q.filled,explicitPriceTimeFilled:oracleFilled});
}
assert.equal(oracleFilled,1);assert.equal(q.filled,0);assert.equal(q.ahead,9);

// Independent official-rule cent-precision fee accounting. Four 1-contract
// fills at $0.50 on ONE order, fee coefficient 0.0088 (synthetic input).
// Exact revenue -$0.50 and model fee $0.0022 are integers in microdollars.
function feesWithAccumulator(precisionMicros:number){
 let accumulated=0;
 return Array.from({length:4},()=>{
   const tradeFee=2200,notional=500000;
   const debit=Math.ceil((notional+tradeFee)/precisionMicros)*precisionMicros;
   const rounding=debit-notional-tradeFee;
   accumulated+=rounding;
   const rebate=Math.min(Math.floor(accumulated/precisionMicros)*precisionMicros,Math.floor((tradeFee+rounding)/precisionMicros)*precisionMicros);
   accumulated-=rebate;
   return {tradeFee,rounding,rebate,accumulated,netFee:tradeFee+rounding-rebate};
 });
}
const feeBound=Array.from({length:4},()=>makerFillFee(1,5000,88)*100);
const nonDirect=feesWithAccumulator(10000),direct=feesWithAccumulator(100);
assert.equal(feeBound.reduce((a,b)=>a+b,0),40000);
assert.equal(nonDirect.reduce((a,b)=>a+b.netFee,0),10000);
assert.equal(direct.reduce((a,b)=>a+b.netFee,0),8800);
// Polymarket published fill-level rounding vs cumulative upper bound.
// Each quarter-contract at 25c has exact fee .0032578125, rounded to zero.
const independentHalfEven=(x:number)=>{const n=Math.floor(x);return x-n>0.5||(x-n===0.5&&n%2===1)?n+1:n;};
let exactCumulative=0, collected=0;
for(let i=0;i<4;i++){
 const exact=.0695*.25*.25*.75*100;
 exactCumulative+=exact;
 collected+=Math.max(0,Math.min(independentHalfEven(exact),independentHalfEven(exactCumulative)-collected));
}
assert.equal(collected,0);
assert.equal(independentHalfEven(exactCumulative),1);
const pmUpperUnits=polyFractionalOrderFee(Array.from({length:4},()=>({price:2500,quantity:.25})),695);
assert.equal(pmUpperUnits,100);

assert.deepEqual(nonDirect.map(f=>f.netFee),[10000,0,0,0]);
assert.deepEqual(direct.map(f=>f.netFee),[2200,2200,2200,2200]);
// Four separate PM orders each round to zero; one unfragmented order rounds to one cent.
assert.equal(polyFractionalOrderFee([{price:2500,quantity:1}],695),100);
assert.equal(Array.from({length:4},()=>polyFractionalOrderFee([{price:2500,quantity:.25}],695)).reduce((a,b)=>a+b,0),0);
});
