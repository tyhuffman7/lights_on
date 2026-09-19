import {test} from 'node:test';import assert from 'node:assert/strict';
import {TransportArrival,receiverIdle} from '../worker/transport-arrival.ts';
test('Buffered and fragmented input retains earliest arrival until receiver idle',()=>{
 const a=new TransportArrival();a.observe(10,true,1000,10);a.observe(20,false,1500,510);assert.deepEqual(a.receipt(1900,910),{wall:1000,mono:10});a.observe(10,true,2000,1010);assert.deepEqual(a.receipt(2050,1060),{wall:2000,mono:1010});
});
test('Delayed callback and clock jumps cannot freshen buffered input',()=>{
 const a=new TransportArrival();assert.throws(()=>a.receipt(100,100),/MISSING/);a.observe(1,true,1000,10);assert.throws(()=>a.receipt(3001,2011),/STALE/);assert.throws(()=>a.receipt(2000,510),/CLOCK_CHANGED/);
});
test('Receiver batch byte cap remains bounded across chunks',()=>{
 const a=new TransportArrival();a.observe(8*1024*1024,true,1000,10);assert.throws(()=>a.observe(1,false,1000,10),/CAPACITY/);assert.throws(()=>a.observe(-1,true,1000,10),/INVALID/);
});
test('Only a fully drained supported receiver can reset arrival',()=>{
 const idle={_state:0,_bufferedBytes:0,_fragmented:0,writableLength:0};assert(receiverIdle(idle));for(const field of Object.keys(idle))assert(!receiverIdle({...idle,[field]:1}));assert.throws(()=>receiverIdle({}),/UNSUPPORTED/);assert.throws(()=>receiverIdle({...idle,_state:NaN}),/UNSUPPORTED/);
});
