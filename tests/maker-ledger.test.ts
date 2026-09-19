import {test} from 'node:test';import assert from 'node:assert/strict';import {initial,totals,settle} from '../lib/arb/ledger.ts';import {makerPlan} from '../lib/arb/maker-plan.ts';import {reserveMaker,makerFill,hedgeMaker,closeMaker,fractionalCost,makerHedgeViable} from '../lib/arb/maker-ledger.ts';import {pair,book} from './research-fixture.ts';
function setup(){const s=initial(),p={...pair('p'),reviewed:true},a=book('kalshi','Kp'),b=book('poly','Pp'),plan=makerPlan(p,a,b,s.settings,s.cash)!;return {...reserveMaker(s,p,plan.quote,'o',plan.price,1000),b};}
test('Maker reservation conserves equity and unfilled cancellation refunds both venues',()=>{const {state,order}=setup();assert.equal(totals(state).equity,1000000);assert.ok(totals(state).committed>0);const s=closeMaker(state,order);assert.deepEqual(s.cash,initial().cash);assert.equal(s.positions.length,0);assert.equal(totals(s).committed,0);assert.throws(()=>closeMaker(s,order));});
test('Fractional unhedged maker fill remains exposure and settles only its actual quantity',()=>{const {state,order}=setup();makerFill(order,.25,1600);const s=closeMaker(state,order);assert.equal(s.positions[0].status,'unmatched');assert.equal(s.positions[0].aQuantity,.25);assert.equal(s.positions[0].bQuantity,0);assert.equal(s.cash.poly,500000);const paid=settle(s,'o',order.quote.aSide==='yes'?10000:0,null);assert.equal(paid.positions[0].aPayout,2500);assert.equal(paid.positions[0].status,'settled');assert.deepEqual(settle(paid,'o',10000,10000).cash,paid.cash);});
test('Maker partial fills aggregate and hedge actual quantity after delay, respecting minimum size',()=>{const {state,order,b}=setup();makerFill(order,.25,1600);assert.equal(hedgeMaker(order,b,2100,2000),false);makerFill(order,.75,1700);const current={...b,receivedAt:2100,exchangeAt:2100};assert.equal(hedgeMaker(order,current,2000,2000),false);assert.equal(hedgeMaker(order,current,2100,2000),true);const s=closeMaker(state,order,2200);assert.equal(s.positions[0].status,'open');assert.equal(s.positions[0].bQuantity,1);assert.equal(totals(s).equity,1000000);});
test('Fractional money uses conservative integer rounding',()=>{assert.equal(fractionalCost(.0001,1),1);assert.throws(()=>fractionalCost(.00001,5000));});
for(const [increment,first,second] of [[1,1.25,.75],[.01,.015,.005]])test(`Maker hedge requires quantity increment ${increment}, preserving off-increment exposure`,()=>{
 const {state,order,b}=setup();order.pair.b.minQty=increment;makerFill(order,first,1600);
 const current={...b,receivedAt:2200,exchangeAt:2200};
 assert.equal(hedgeMaker(order,current,2200,2000),false);
 assert.equal(order.filledB,0);assert.equal(order.bCost,0);assert.equal(order.hedgeDue,2100);
 const unmatched=closeMaker(state,order,2200).positions[0];assert.equal(unmatched.status,'unmatched');assert.equal(unmatched.aQuantity,first);assert.equal(unmatched.bQuantity,0);
 makerFill(order,second,2250);assert.equal(hedgeMaker(order,current,2300,2000),true);
 assert.equal(order.filledB,first+second);assert.equal(closeMaker(state,order,2400).positions[0].status,'open');
});

test('Hedge viability requires depth for the whole outstanding order, not only a profitable smaller size',()=>{
 const {order,b,state}=setup();const short={...b,[order.quote.bSide]:[{price:100,quantity:order.quote.quantity-1}]};
 assert.equal(makerHedgeViable(order,short,state.settings),false);
 const ample={...b,[order.quote.bSide]:[{price:100,quantity:order.quote.quantity}]};assert.equal(makerHedgeViable(order,ample,state.settings),true);
});

test('Maker planning reserves the same conservative hedge fees as delayed execution',()=>{
 const s=initial(),p={...pair('fee-consistency'),reviewed:true};p.b.feeRate=600;p.b.feeRounding='even';
 const a={...book('kalshi',p.a.id),yes:[{price:7700,quantity:5}],no:[],yesBids:[{price:6600,quantity:5}],noBids:[]};
 const b={...book('poly',p.b.id),yes:[],no:[{price:2800,quantity:5.5}]};
 const plan=makerPlan(p,a,b,s.settings,s.cash,Date.now(),false,175)!;assert.ok(plan);
 assert.equal(plan.quote.bFill.fees,600);assert.equal(plan.quote.profit,1200);
 const {order}=reserveMaker(s,p,plan.quote,'fees',plan.price);order.makerFeeProfile={rate:175} as any;
 assert.equal(makerHedgeViable(order,b,s.settings),true,'unchanged book must retain a viable hedge with its reserve intact');
});

test('Partial paired fill recomputes actual ROI and eligibility instead of retaining planned profitability',()=>{
 const {state,order,b}=setup();order.pair.b.minQty=.01;makerFill(order,.01,1600);assert.ok(hedgeMaker(order,{...b,receivedAt:2200,exchangeAt:2200},2200,2000));
 const p=closeMaker(state,order,2300).positions[0],total=p.aDebit+p.bDebit;assert.ok(p.quote.profit<0);assert.equal(p.quote.roi,p.quote.profit/total*100);assert.equal(p.quote.eligible,false);assert.ok(p.quote.reasons.includes('Actual fill net edge below threshold'));assert.equal(p.aQuantity,.01);assert.equal(p.bQuantity,.01);
});

test('Risk-reducing hedge proceeds within reservation even when current entry economics fail',()=>{
 const {state,order,b}=setup();makerFill(order,1,1600);
 const worse={...b,receivedAt:2200,exchangeAt:2200,[order.quote.bSide]:[{price:9000,quantity:100}]};
 assert.equal(makerHedgeViable(order,worse,state.settings),false);
 assert.equal(hedgeMaker(order,worse,2200,2000),true,'existing exposure uses reserved loss bound, not entry profit');
 assert.equal(order.filledB,1);assert(order.bCost+order.bFees<=order.reservedB);
});
