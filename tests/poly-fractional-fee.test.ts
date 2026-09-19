import {test} from 'node:test';import assert from 'node:assert/strict';
import {fractionalWalk} from '../lib/arb/maker-ledger.ts';
import {observedSizeAdmission} from '../lib/arb/maker-size-admission.ts';
test('PM fractional hedge fee can be zero, unlike conservative cent ceiling',()=>{
 for(const quantity of [.21,.20,.01])assert.equal(fractionalWalk([{price:2200,quantity}],quantity,600,'even')!.fees,0);
 assert.equal(fractionalWalk([{price:2200,quantity:.01}],.01,600)!.fees,100);
});
test('PM cumulative upper fee spans levels and uses half-to-even',()=>{
 assert.equal(fractionalWalk([{price:5000,quantity:.2},{price:5000,quantity:.2}],.4,600,'even')!.fees,100);
 assert.equal(fractionalWalk([{price:5000,quantity:1}],1,200,'even')!.fees,0);
 assert.equal(fractionalWalk([{price:5000,quantity:3}],3,200,'even')!.fees,200);
 assert.equal(fractionalWalk([{price:5000,quantity:1}],1,695,'even')!.fees,200);
});
test('Correct PM rounding does not admit an isolated tiny fill under cent-aligned maker accounting',()=>{
 const r=observedSizeAdmission({price:4000,quantity:10,hedgeLevels:[{price:5500,quantity:10}],hedgeStep:.01,makerRate:0,hedgeRate:600,reserve:200,sizes:[.01]});
 assert.equal(r.minimumProfit,-57);assert.equal(r.eligible,false);
});

import {walk} from '../lib/arb/engine.ts';
test('September quarter-dollar example agrees across whole and fractional order models',()=>{
 const levels=[{price:2500,quantity:1}];assert.equal(walk(levels,1,695,'even')!.fees,100);assert.equal(fractionalWalk(levels,1,695,'even')!.fees,100);
});
test('Fragmented levels within one PM order retain cumulative half-even fee bound',()=>{
 const fragments=Array.from({length:4},()=>({price:2500,quantity:.25}));
 assert.equal(fractionalWalk(fragments,1,695,'even')!.fees,100);
 // Four separately submitted hedge orders each have their own rounding boundary.
 assert.equal(fragments.reduce((n,l)=>n+fractionalWalk([l],.25,695,'even')!.fees,0),0);
});
