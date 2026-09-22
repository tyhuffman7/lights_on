import {test} from 'node:test';import assert from 'node:assert/strict';
import {planDiscovery,discoveryPolicy,RouteObservation,executableFingerprint} from '../lib/screen/discovery.ts';
import {quoteCandidate,CandidateIntervals} from '../lib/screen/confirmation.ts';
import type {Candidate} from '../lib/research/matching.ts';import type {Pair,Book} from '../lib/arb/types.ts';
const at=Date.parse('2026-09-22T01:00:00Z');
const route=(id:string,pm=id,cat='Economics'):Candidate=>({pair:{id,inverted:false,reviewed:false,a:{id:'K'+id,venue:'kalshi',category:cat,title:'fixture',outcome:'yes',opposite:'no',rules:'fixture',url:'',open:true,closeAt:'2026-09-29',feeRate:700,feeRounding:'ceil',minQty:1,hash:'k',settlement:null},b:{id:'P'+pm,venue:'poly',category:cat,title:'fixture',outcome:'yes',opposite:'no',rules:'fixture',url:'',open:true,closeAt:'2026-09-29',feeRate:695,feeRounding:'even',minQty:1,hash:'p',settlement:null}},reasons:[]} as Candidate);
test('full matched universe spans bounded batches, preserves shared-market routes, deduplicates subscriptions',()=>{
 const candidates=Array.from({length:140},(_,i)=>route(String(i),String(Math.floor(i/2)),i%4<2?'Economics':'Politics'));
 const plan=planDiscovery([...candidates,candidates[0]],at);assert.equal(plan.matchedUnique,140);assert.equal(plan.batches.length,3);assert.equal(plan.omitted.length,0);
 const selected=plan.batches.flatMap(b=>b.selected);assert.equal(new Set(selected.map(c=>c.pair.id)).size,140);
 for(const b of plan.batches){assert(b.selected.length<=60);assert.equal(b.subscriptions.poly.length*2,b.selected.length);assert.equal(new Set(b.subscriptions.kalshi).size,b.subscriptions.kalshi.length);assert.equal(new Set(b.selected.map(c=>c.pair.a.category)).size,2);}
 assert(plan.batchDurationMs*plan.batches.length+4000+10000<=discoveryPolicy.durationMs);
});
test('finite omissions retain every route and explicit oversize-bundle or window-cap reason',()=>{
 const tooLarge=Array.from({length:61},(_,i)=>route('large'+i,'shared'));
 const p=planDiscovery([...tooLarge,...Array.from({length:1250},(_,i)=>route(String(i)))],at);
 assert.equal(p.batches.length,20);assert.equal(p.batches.flatMap(b=>b.selected).length,1200);assert.equal(p.omitted.length,111);
 assert.equal(p.omitted.filter(o=>o.reason==='SHARED_MARKET_BUNDLE_EXCEEDS_BATCH_CAP').length,61);
});
test('coverage separates requests, received books, valid observation and unmeasured gaps',()=>{
 const pair=route('one').pair,c=new RouteObservation([pair],at);
 c.sample(pair.id,at+100,true,false,false,['PM_US_BOOK_MISSING'],false);
 c.sample(pair.id,at+200,true,true,true,[],true);c.sample(pair.id,at+450,true,true,true,[],true);
 c.sample(pair.id,at+700,true,true,false,['KALSHI_FEED_DISCONNECTED'],true);
 c.sample(pair.id,at+3000,true,true,true,[],true);c.finish(at+3250);
 const row=c.rows.get(pair.id)!;assert.equal(row.usableMs,750);assert.equal(row.unmeasuredGapMs,2300);assert.equal(row.bothBooksAt,at+200);assert.equal(row.dataReasons.PM_US_BOOK_MISSING,1);
});
test('confirmation fingerprints ignore unused depth but change with consumed depth or selected size',()=>{
 const pair=route('one').pair,book:Book={venue:'kalshi',marketId:pair.a.id,yes:[{price:4000,quantity:10},{price:9000,quantity:20}],no:[{price:6100,quantity:10}],yesBids:[],noBids:[],receivedAt:at,exchangeAt:at,open:true};
 const other={...book,venue:'poly' as const,no:[{price:5000,quantity:10}]},q=quoteCandidate(pair,book,other,'yes',at);
 const unused=quoteCandidate(pair,{...book,yes:[{price:4000,quantity:10},{price:8000,quantity:100}]},other,'yes',at+100);
 assert.equal(executableFingerprint(q),executableFingerprint(unused));
 const changed=quoteCandidate(pair,{...book,yes:[{price:4100,quantity:10}]},other,'yes',at);assert.notEqual(executableFingerprint(q),executableFingerprint(changed));
 const intervals=new CandidateIntervals();intervals.update('route',q,true,at);intervals.update('route',unused,true,at+100);assert.equal(intervals.nextId,1);assert.equal(intervals.active.get('route')!.original.at,at);assert.equal(intervals.active.get('route')!.latest.at,at+100);
 const smaller=quoteCandidate(pair,book,other,'yes',at+200,3);intervals.update('route',smaller,true,at+200);assert.equal(intervals.nextId,2);assert.equal(intervals.completed.length,1);
});
test('one discovery supervisor shares finite budgets, records sequential batches and refuses restart',async()=>{
 const {mkdtempSync,writeFileSync,readFileSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {runDiscovery}=await import('../worker/discovery-screen.ts');const {confirmationManifest}=await import('../worker/candidate-confirmation.ts');
 const dir=mkdtempSync(join(tmpdir(),'depth-discovery-')),selection=[{pair:route('one').pair}],f={at:Date.now(),mode:'DISCOVERY',policy:discoveryPolicy,manifest:confirmationManifest(process.cwd()),batchDurationMs:1000,batches:[0,1].map(index=>({index,selection,subscriptions:{kalshi:['Kone'],poly:['Pone']}}))};
 writeFileSync(join(dir,'frozen.json'),JSON.stringify(f));let calls=0;const budgets:number[]=[];
 await runDiscovery(dir,process.cwd(),async(batchDir,_root,limits)=>{
  calls++;budgets.push(limits!.maxAttempts);assert(limits!.maxEvidenceBytes<=discoveryPolicy.maxEvidenceBytes);const now=Date.now();
  writeFileSync(join(batchDir,'summary.json'),JSON.stringify({startedAt:now,endedAt:now,durationMs:0,attempts:1,logBytes:100,confirmationCounts:{EDGE_SURVIVED:0,EDGE_DISAPPEARED:0,FAILED:1},routeObservation:[],failures:[],resourceStop:null,clockFault:false}));
 });
 assert.equal(calls,2);assert.deepEqual(budgets,[60,119]);const result=JSON.parse(readFileSync(join(dir,'summary.json'),'utf8'));assert.equal(result.attempts,2);assert.equal(result.batches.length,2);assert.equal(result.logBytes,200);assert.equal(result.ordersEnabled,false);
 await assert.rejects(()=>runDiscovery(dir,process.cwd()),/no restart/);
});
