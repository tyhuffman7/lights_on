import {test} from 'node:test';import assert from 'node:assert/strict';import {subscriptions} from '../worker/streams.ts';
test('PM trade subscriptions are explicit opt-in and preserve un-debounced book subscriptions',()=>{
 const ids=['a','b'];assert.equal(subscriptions('poly',ids,true).length,1);
 const messages=subscriptions('poly',ids,false,true);assert.equal(messages.length,2);assert.equal(messages[0].subscribe.responsesDebounced,false);assert.equal(messages[1].subscribe.subscriptionType,'SUBSCRIPTION_TYPE_TRADE');assert.deepEqual(messages[1].subscribe.marketSlugs,ids);assert.notEqual(messages[0].subscribe.requestId,messages[1].subscribe.requestId);
});
test('PM trade batches stay within100 with unique IDs; Kalshi behavior stays unchanged',()=>{
 const ids=Array.from({length:201},(_,i)=>String(i)),m=subscriptions('poly',ids,false,true);assert.equal(m.length,6);assert.equal(new Set(m.map(x=>x.subscribe.requestId)).size,6);assert.deepEqual(m.slice(3).flatMap(x=>x.subscribe.marketSlugs),ids);assert(m.every(x=>x.subscribe.marketSlugs.length<=100));assert.deepEqual(subscriptions('kalshi',['a'],true,true),subscriptions('kalshi',['a'],true));
});
