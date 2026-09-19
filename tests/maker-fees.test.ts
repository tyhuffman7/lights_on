import {test} from 'node:test';import assert from 'node:assert/strict';import {makerFeeProfile,usableMakerFee} from '../lib/arb/maker-fees.ts';import {makerFillFee,fractionalCost} from '../lib/arb/fractional.ts';import {makerPlan} from '../lib/arb/maker-plan.ts';import {pair,book} from './research-fixture.ts';import {initial} from '../lib/arb/ledger.ts';
test('Published maker profiles require exact series/type/multiplier and expire before an order could outlive evidence',()=>{
 const p=makerFeeProfile('K',{ticker:'K',fee_type:'quadratic_with_maker_fees',fee_multiplier:1},1000);assert.equal(p.rate,175);assert.equal(usableMakerFee(p,'K',700,2000),true);assert.equal(usableMakerFee(p,'K',700,120000),false);assert.equal(usableMakerFee(p,'other',700,2000),false);assert.equal(usableMakerFee(p,'K',1400,2000),false);
 assert.equal(makerFeeProfile('K',{ticker:'K',fee_type:'quadratic',fee_multiplier:1},1000).rate,0);for(const data of [{ticker:'K',fee_type:'flat',fee_multiplier:1},{ticker:'K',fee_type:'quadratic',fee_multiplier:2},{ticker:'X',fee_type:'quadratic',fee_multiplier:1}])assert.throws(()=>makerFeeProfile('K',data,1000));
});
test('Zero headline maker fee still reserves cent-alignment cost for fractional fills, without assuming rebates',()=>{
 assert.equal(makerFillFee(.01,5000,0),50);assert.equal(fractionalCost(.01,5000)+makerFillFee(.01,5000,0),100);assert.equal(makerFillFee(1,5000,0),0);assert.equal(makerFillFee(1,5000,175),100);assert.equal(makerFillFee(1,5000,700),200);
});
test('Maker fee override changes quote economics without changing approval-bound market metadata',()=>{
 const p={...pair('p'),reviewed:true},s=initial(),a=book('kalshi','Kp'),b=book('poly','Pp'),before=JSON.stringify(p);
 const conservative=makerPlan(p,a,b,s.settings,s.cash,Date.now(),true)!,maker=makerPlan(p,a,b,s.settings,s.cash,Date.now(),true,0)!;assert.equal(maker.quote.aFill.fees,0);assert.ok(maker.quote.profit>conservative.quote.profit);assert.equal(JSON.stringify(p),before);assert.equal(p.a.feeRate,700);
});

test('Joining a bid remains available when one-cent improvement fails the unchanged profit limits',()=>{
 const p={...pair('fallback'),reviewed:true},s=initial();
 const a={...book('kalshi',p.a.id),yes:[{price:5200,quantity:100}],no:[{price:5000,quantity:100}],yesBids:[{price:5000,quantity:125}],noBids:[{price:4800,quantity:100}]};
 const b={...book('poly',p.b.id),yes:[{price:9000,quantity:100}],no:[{price:4550,quantity:100}]};
 const joined=makerPlan(p,a,b,s.settings,s.cash,Date.now(),true,0);
 assert.ok(joined);assert.equal(joined.price,5000);assert.equal(joined.ahead,125);assert.ok(joined.quote.profit>=s.settings.minProfit);assert.ok(joined.quote.roi>=s.settings.minRoi);
 const blocked=makerPlan(p,a,{...b,no:[{price:4800,quantity:100}]},s.settings,s.cash,Date.now(),true,0);assert.equal(blocked,null,'fallback never bypasses net-profit gates');
});

test('Half-rate published maker schedule is conservative and bound to matching taker metadata',()=>{
 const p=makerFeeProfile('KXMLBGAME',{ticker:'KXMLBGAME',fee_type:'quadratic_with_maker_fees',fee_multiplier:0.5},1000);
 assert.equal(p.rate,88);assert.equal(p.multiplier,.5);assert(usableMakerFee(p,'KXMLBGAME',350,2000));
 assert.equal(usableMakerFee(p,'KXMLBGAME',700,2000),false);
 assert.equal(usableMakerFee({...p,rate:87},'KXMLBGAME',350,2000),false);
 assert.equal(usableMakerFee({...p,multiplier:2},'KXMLBGAME',1400,2000),false);
 assert.equal(usableMakerFee(p,'KXMLBGAME',350,120000),false);
 assert.equal(makerFillFee(10,5000,p.rate),300);assert.equal(makerFillFee(10,5000,350),900);
 for(const m of [0,-1,.3,NaN,Infinity,'0.5'])assert.throws(()=>makerFeeProfile('K',{ticker:'K',fee_type:'quadratic_with_maker_fees',fee_multiplier:m},1000));
});
