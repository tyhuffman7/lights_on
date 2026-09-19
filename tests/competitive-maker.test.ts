import {test} from 'node:test';import assert from 'node:assert/strict';
import {competitiveMakerPlan,competitiveMakerPlans,makerPlan} from '../lib/arb/maker-plan.ts';
import {assess} from '../lib/arb/engine.ts';
import {pair,book} from './research-fixture.ts';
import {initial as initialState} from '../lib/arb/ledger.ts';

for(const rate of [0,175,700])test(`Competitive maker chooses highest eligible non-crossing cent at fee rate ${rate}`,()=>{
 const now=Date.now(),p={...pair('p'),reviewed:true},a=book('kalshi','Kp'),b=book('poly','Pp');
 a.yesBids=[{price:2500,quantity:20}];a.yes=[{price:6000,quantity:100}];a.noBids=[{price:4000,quantity:100}];a.no=[{price:7500,quantity:20}];
 const s=initialState(),base=makerPlan(p,a,b,s.settings,s.cash,now,true,rate)!,plan=competitiveMakerPlan(p,a,b,s.settings,s.cash,now,rate)!;
 assert.ok(base);assert.ok(plan);assert.ok(plan.price>base.price);assert.ok(plan.quote.profit>=s.settings.minProfit);assert.ok(plan.quote.roi>=s.settings.minRoi);
 assert.ok(plan.price<a[plan.quote.aSide][0].price);
 assert.equal(plan.ahead,0);
 // Independent exhaustive oracle: no higher non-crossing cent may pass the
 // existing fee, reserve, depth, cash and ROI checks, at any allowed size.
 for(let price=plan.price+100;price<a[plan.quote.aSide][0].price;price+=100){
  const q=assess({...p,a:{...p.a,feeRate:rate}},{...a,yes:plan.quote.aSide==='yes'?[{price,quantity:1000}]:[],no:plan.quote.aSide==='no'?[{price,quantity:1000}]:[]},b,s.settings,s.cash,now);
  assert.ok(!q?.eligible,'higher price unexpectedly eligible: '+price);
 }
 assert.equal(competitiveMakerPlan(p,{...a,receivedAt:now-3000},b,s.settings,s.cash,now,rate),null);
 assert.equal(competitiveMakerPlan(p,a,b,s.settings,{kalshi:0,poly:0},now,rate),null);
});

test('Bounded candidate set retains baseline and improved eligible prices for each side',()=>{
 const p={...pair('alternatives'),reviewed:true},a=book('kalshi',p.a.id),b=book('poly',p.b.id),s=initialState();
 const plans=competitiveMakerPlans(p,a,b,s.settings,s.cash,Date.now(),0);
 assert(plans.length<=6);assert(plans.some(p=>p.price===a.yesBids[0].price&&p.quote.aSide==='yes'));
 assert(plans.some(p=>p.price>a.yesBids[0].price&&p.quote.aSide==='yes'));
 assert.equal(new Set(plans.map(p=>p.quote.aSide+':'+p.price)).size,plans.length);
 for(const plan of plans){assert(plan.price<a[plan.quote.aSide][0].price);assert(plan.quote.eligible);}
});
