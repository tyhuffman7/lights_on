import {test} from 'node:test';import assert from 'node:assert/strict';
import {newDiagnostics,recordDiagnostic} from '../worker/paper-diagnostics.ts';
import {pair,book} from './research-fixture.ts';import {assess} from '../lib/arb/engine.ts';import {initial} from '../lib/arb/ledger.ts';
test('Diagnostics distinguish unusable apparent spreads from approved executable quotes without mutating inputs',()=>{
 const d=newDiagnostics(),p={...pair('p'),reviewed:true},a=book('kalshi','Kp'),b=book('poly','Pp'),s=initial();
 const q=assess(p,a,b,s.settings,s.cash)!;assert.ok(q?.eligible);
 const x={pair:p,approved:true,usable:true,a,b,quote:q,reasons:[],at:Date.now()};const before=JSON.stringify(x);
 recordDiagnostic(d,x);recordDiagnostic(d,{...x,usable:false,quote:null});recordDiagnostic(d,{...x,approved:false});
 assert.equal(d.evaluations,3);assert.equal(d.approved,2);assert.equal(d.usableApproved,1);assert.equal(d.eligible,1);
 assert.deepEqual(d.blockers,{eligible:1,data_unusable:1,unapproved:1});assert.deepEqual(d.indicativeTopBook,{fresh:1,unusable:1});assert.equal(d.closest.length,1);assert.equal(JSON.stringify(x),before);
});
test('Diagnostics attribute one blocker per observation and separate price, fee, reserve and minimum-return failures',()=>{
 const d=newDiagnostics(),p=pair('p'),a=book('kalshi','Kp'),b=book('poly','Pp'),s=initial(),q=assess({...p,reviewed:true},a,b,s.settings,s.cash)!;
 for(const [cost,fees,profit] of [[10000,0,-200],[9900,200,-300],[9700,200,-100],[9500,200,100]])recordDiagnostic(d,{pair:p,approved:true,usable:true,quote:{...q,payout:10000,cost,fees,profit,eligible:false},reasons:['Net edge below threshold'],at:1});
 assert.deepEqual(d.blockers,{prices:1,fees:1,reserve:1,minimum_return:1});assert.equal(d.closest[0].afterReserveUSD,.01);
});
