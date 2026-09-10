import {test} from 'node:test';import assert from 'node:assert/strict';
import {executePaper} from '../lib/arb/execution.ts';import {initial,totals} from '../lib/arb/ledger.ts';import {assess} from '../lib/arb/engine.ts';
const now=1800000000000,m=(venue)=>({id:venue,venue,title:'Fixture',outcome:'Yes',opposite:'No',category:'Economics',rules:'r',url:'https://example.com',closeAt:new Date(now+86400000).toISOString(),open:true,feeRate:venue==='kalshi'?700:600,feeRounding:venue==='kalshi'?'ceil':'even',minQty:1,hash:'r',settlement:null});
const p={id:'pair',a:m('kalshi'),b:m('poly'),inverted:false,reviewed:true};
const b=(yes,no)=>({yes:[{price:yes,quantity:100}],no:[{price:no,quantity:100}],yesBids:[{price:3800,quantity:100}],noBids:[],receivedAt:now,exchangeAt:now,open:true});
const a=b(4000,7000),poly=b(7000,5000),s=initial(),q=assess(p,a,poly,s.settings,s.cash,now);
test('Successful second leg produces a pending position, not realized winnings',()=>{const x=executePaper(s,p,q,a,poly,'trade',now);assert.equal(x.positions[0]?.status,'open');assert.equal(totals(x).realized,0)});
test('Missing second leg is unwound with a real modeled loss',()=>{const x=executePaper(s,p,q,a,{...poly,no:[]},'trade',now);assert.equal(x.positions[0]?.status,'settled');assert.ok(totals(x).realized<0);assert.equal(totals(x).committed,0);assert.equal(x.cash.poly,500000)});
test('Missing unwind depth leaves unmatched exposure',()=>{const x=executePaper(s,p,q,{...a,yesBids:[]},{...poly,no:[]},'trade',now);assert.equal(x.positions[0]?.status,'unmatched');assert.equal(x.cash.poly,500000);assert.ok(totals(x).committed>0)});
