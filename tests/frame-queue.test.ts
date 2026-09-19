import {test} from 'node:test';import assert from 'node:assert/strict';import {FrameQueue,IngressCapacityError} from '../worker/frame-queue.ts';
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('Ingress preserves frame order and receipt evidence while yielding between bounded batches',async()=>{
 const seen:{id:number;at:number}[]=[];const q=new FrameQueue<{id:number;at:number}>(v=>seen.push(v),()=>assert.fail('unexpected queue error'));
 for(let i=0;i<30;i++)q.push({id:i,at:1000+i},10);assert.equal(seen.length,0);await turn();assert.ok(seen.length>0&&seen.length<=8);while(q.depth)await turn();assert.deepEqual(seen,Array.from({length:30},(_,i)=>({id:i,at:1000+i})));assert.equal(q.bytes,0);q.close();
});
test('Ingress overflow fails closed and stop discards queued frames',async()=>{
 let consumed=0,errors=0;const q=new FrameQueue(()=>consumed++,()=>errors++,2,100);q.push(1,1);q.push(2,1);q.push(3,1);await turn();assert.equal(consumed,0);assert.equal(errors,1);assert.equal(q.depth,0);
 const stopped=new FrameQueue(()=>consumed++,()=>errors++);stopped.push(1,1);stopped.close();await turn();assert.equal(consumed,0);
});

test('Shutdown flush accounts for already received frames before closing input',()=>{const seen:number[]=[];const q=new FrameQueue<number>(x=>seen.push(x),()=>assert.fail('unexpected'));for(let i=0;i<20;i++)q.push(i,1);q.flush();q.close();assert.deepEqual(seen,Array.from({length:20},(_,i)=>i));assert.equal(q.depth,0);});


test('Ingress overflow retains pre-clear frame pressure without retaining payloads',()=>{
 let failure:unknown;const q=new FrameQueue(()=>assert.fail('not drained'),e=>{failure=e;assert.equal(q.depth,0);},2,100);
 q.push('secret frame',10);q.push('another frame',20);q.push('rejected frame',30);
 assert(failure instanceof IngressCapacityError);assert.equal(failure.details.reason,'FRAME_LIMIT');assert.equal(failure.details.depth,2);assert.equal(failure.details.bytes,30);assert.equal(failure.details.incomingBytes,30);assert.equal(failure.details.processedFrames,0);assert(failure.details.oldestQueuedMs>=0);assert(!JSON.stringify(failure.details).includes('frame'));assert(q.closed);
});
test('Ingress distinguishes byte pressure and malformed size from frame count',()=>{
 for(const incoming of [91,-1]){let failure:unknown;const q=new FrameQueue(()=>{},e=>failure=e,512,100);q.push(1,10);q.push(2,incoming);assert(failure instanceof IngressCapacityError);assert.equal(failure.details.reason,incoming<0?'INVALID_FRAME_SIZE':'BYTE_LIMIT');assert.equal(failure.details.depth,1);assert.equal(failure.details.bytes,10);assert.equal(q.bytes,0);}
});
test('Ingress tracks completed work and preserves consumer error identity',()=>{
 let failure:unknown;const q=new FrameQueue(()=>{},e=>failure=e,1,100);q.push(1,1);q.flush();q.push(2,1);q.push(3,1);assert(failure instanceof IngressCapacityError);assert.equal(failure.details.processedFrames,1);
 const original=Error('consumer failed');const c=new FrameQueue(()=>{throw original;},e=>failure=e);c.push(1,1);c.flush();assert.equal(failure,original);assert(c.closed);
});
