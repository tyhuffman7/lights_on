import {test} from 'node:test';import assert from 'node:assert/strict';import {makerQuoteDiagnostics,makerPlan} from '../lib/arb/maker-plan.ts';import {pair,book} from './research-fixture.ts';import {initial} from '../lib/arb/ledger.ts';
function setup(){const now=Date.now(),p={...pair('p'),reviewed:true},a=book('kalshi','Kp'),b=book('poly','Pp'),s=initial();p.a.feeRate=0;p.b.feeRate=0;a.yesBids=[{price:4000,quantity:10}];a.yes=[{price:5000,quantity:10}];a.noBids=[];b.no=[{price:5900,quantity:10}];return {now,p,a,b,s};}
test('Diagnostics distinguish fee-adjusted edge, reserve and return policy without admitting rejected plans',()=>{
 const {now,p,a,b,s}=setup();const settings={...s.settings,maxTrade:100000,minProfit:1000,minRoi:1,reserve:200};
 let d=makerQuoteDiagnostics(p,a,b,settings,s.cash,now)[0];assert(d.quote);assert(d.afterFees!>0);assert.equal(d.classification,'RESERVE_ERASES_EDGE');assert.equal(makerPlan(p,a,b,settings,s.cash,now),null);
 d=makerQuoteDiagnostics(p,a,b,{...settings,reserve:0,minProfit:2000},s.cash,now)[0];assert.equal(d.classification,'POSITIVE_BUT_POLICY_REJECTED');assert.equal(d.belowMinimumProfit,true);
 b.no=[{price:6100,quantity:10}];d=makerQuoteDiagnostics(p,a,b,settings,s.cash,now)[0];assert.equal(d.classification,'NONPOSITIVE_AFTER_FEES');
});
test('Other rejection reasons and unsized quotes are retained without invented fee diagnoses',()=>{
 const {now,p,a,b,s}=setup();p.reviewed=false;const d=makerQuoteDiagnostics(p,a,b,{...s.settings,reserve:0,minProfit:0,minRoi:0},s.cash,now)[0];assert(d.quote?.reasons.includes('Settlement rules need review'));assert.equal(d.classification,'POSITIVE_BUT_POLICY_REJECTED');
 const empty=makerQuoteDiagnostics(p,a,b,s.settings,{kalshi:0,poly:0},now);assert(empty.every(x=>x.classification==='NO_SIZED_QUOTE'));
});
