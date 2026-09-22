import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {MarketStatusTracker,bootstrapStatus,lifecycleSubscription} from '../lib/screen/market-status.ts';
import {confirmScreenCandidate,policyFor} from '../worker/candidate-confirmation.ts';
import {BookCache} from '../lib/research/books.ts';import {observeBook,quoteCandidate} from '../lib/screen/confirmation.ts';
import {assessSnapshot} from '../lib/screen/book-confirmation.ts';import type {SnapshotReceipt,SnapshotRequest} from '../lib/screen/book-confirmation.ts';import type {Pair} from '../lib/arb/types.ts';
const wall=Date.now(),mono=performance.now(),healthy={connected:true,backlog:0,clockOkay:true};
const http={url:'https://external-api.kalshi.com/trade-api/v2/markets/K',requestAt:wall,requestMono:mono,responseAt:wall+10,responseMono:mono+10,processedAt:wall+11,processedMono:mono+11,status:200,headers:{date:new Date(wall).toUTCString()},bodySha256:'fixture'};
const metadata={ticker:'K',status:'active',open_time:new Date(wall-100000).toISOString(),close_time:new Date(wall+86400000).toISOString()};
const ack=(t:MarketStatusTracker)=>{t.requested(wall-20);t.receive({id:9000,type:'subscribed',msg:{channel:'market_lifecycle_v2',sid:7}},wall-10,mono-10);};
const evt=(t:MarketStatusTracker,seq:number,type:string,extra={})=>t.receive({type:'market_lifecycle_v2',sid:7,seq,msg:{market_ticker:'K',event_type:type,...extra}},wall+5,mono+5);
test('one shared lifecycle subscription has no unsupported market filter; baseline cannot precede ack',async()=>{
 assert.deepEqual(lifecycleSubscription.params,{channels:['market_lifecycle_v2']});const t=new MarketStatusTracker(['K']);let calls=0;
 await assert.rejects(()=>bootstrapStatus(t,['K'],async()=>{calls++;return {data:{market:metadata},evidence:http};},0),/ACK_REQUIRED/);assert.equal(calls,0);
 ack(t);await bootstrapStatus(t,['K'],async()=>{calls++;assert(t.ackMono!<=http.requestMono);return {data:{market:metadata},evidence:http};},0);
 assert.equal(calls,1);assert.equal(t.view('K',wall+12,true).reportedStatus,'active');assert.equal(t.view('K',wall+12,true).admitted,false);assert(t.view('K',wall+12,true).reasons.includes('NON_ATOMIC_INITIAL_STATE'));
});
test('intervening deactivation cannot be overwritten by active baseline; conflict and initialization preserved',async()=>{
 const t=new MarketStatusTracker(['K']);ack(t);await bootstrapStatus(t,['K'],async()=>{evt(t,10,'deactivated');return {data:{market:metadata},evidence:http};},0);
 const v=t.view('K',wall+12,true);assert(v.knownBlocked);assert(v.reasons.includes('BASELINE_EVENT_ORDER_UNRESOLVED'));assert(v.reasons.includes('BASELINE_LIFECYCLE_CONTRADICTION'));assert.equal(v.events.length,1);
 evt(t,11,'activated');assert(t.view('K',wall+15,true).reasons.includes('REACTIVATION_REQUIRES_RECONCILIATION'));assert.equal(t.view('K',wall+15,true).admitted,false);
});
test('status bootstrap stops new GETs at the bounded batch deadline',async()=>{
 const t=new MarketStatusTracker(['K','K2']);ack(t);let calls=0,stopped=false;
 await bootstrapStatus(t,['K','K2'],async()=>{calls++;stopped=true;return {data:{market:metadata},evidence:http};},0,()=>stopped);
 assert.equal(calls,1);assert.equal(t.view('K2',wall,true).reportedStatus,null);
});
test('implicit closure, unrelated sequence events, gaps, disconnect and bounded buffers stay blocked',async()=>{
 const t=new MarketStatusTracker(['K']);ack(t);await bootstrapStatus(t,['K'],async()=>({data:{market:metadata},evidence:http}),0);
 t.receive({sid:7,seq:10,type:'event_lifecycle',msg:{event_ticker:'OTHER'}},wall,mono);evt(t,11,'close_date_updated',{close_ts:Math.floor(wall/1000)-1});assert(t.view('K',wall,true).knownBlocked);
 evt(t,13,'activated');assert(t.view('K',wall,true).reasons.includes('LIFECYCLE_SEQUENCE_GAP_OR_REORDER'));assert(t.view('K',wall,false).reasons.includes('LIFECYCLE_DISCONNECTED'));
 const bounded=new MarketStatusTracker(['K']);ack(bounded);bounded.perMarketLimit=1;evt(bounded,1,'created');evt(bounded,2,'deactivated');assert.equal(bounded.states.get('K')!.events.length,1);assert(bounded.view('K',wall,true).reasons.includes('LIFECYCLE_BUFFER_LIMIT'));
});
function fixture(){
 const now=Date.now(),at=performance.now(),c=new BookCache();const kb=c.kalshi({type:'orderbook_snapshot',sid:1,seq:2,msg:{market_ticker:'K',yes_dollars_fp:[['0.60','20']],no_dollars_fp:[['0.30','20']]}},now,at)!;
 const message={marketSlug:'P',bids:[{px:{value:'0.1',currency:'USD'},qty:'20'}],offers:[{px:{value:'0.5',currency:'USD'},qty:'20'}],state:'MARKET_STATE_OPEN',transactTime:new Date(now-60000).toISOString()};
 const pb=c.poly({marketData:message},now,at)!;
 const kr:SnapshotReceipt={e:observeBook(kb,undefined,'orderbook_snapshot',now,at),messageType:'orderbook_snapshot',sid:1};
 const pr:SnapshotReceipt={e:observeBook(pb,undefined,'marketData',now,at),messageType:'marketData',requestId:'quiet-1',transactTime:message.transactTime};
 const kq:SnapshotRequest={venue:'kalshi',marketId:'K',kind:'get_snapshot',requestId:'10001',sid:1,beforeSequence:1,at:now-5,mono:at-5},pq:SnapshotRequest={venue:'poly',marketId:'P',kind:'new_subscription',requestId:'quiet-1',at:now-5,mono:at-5};
 const pair:Pair={id:'K::P',inverted:false,reviewed:false,a:{id:'K',venue:'kalshi',title:'fixture',outcome:'yes',opposite:'no',category:'Economics',rules:'terms',closeAt:'2028-01-01',url:'',open:true,feeRate:700,feeRounding:'ceil',minQty:1,hash:'k',settlement:null},b:{id:'P',venue:'poly',title:'fixture',outcome:'yes',opposite:'no',category:'economics',rules:'terms',closeAt:'2028-01-01',url:'',open:true,feeRate:695,feeRounding:'even',minQty:1,hash:'p',settlement:null}};
 const k={request:kq,response:kr,...assessSnapshot(kq,kr,kr,healthy,now,at)},p={request:pq,response:pr,...assessSnapshot(pq,pr,pr,healthy,now,at)};
 const feeds={kalshi:{confirmKalshi:async()=>k,latest:new Map([['K',kr]]),health:()=>healthy},poly:{latest:new Map([['P',pr]]),health:()=>healthy}};
 return {feeds,pair,k,p,pr,original:quoteCandidate(pair,kb,pb,'no',now),unknown:()=>({admitted:false,classification:'UNRESOLVED',reasons:['NON_ATOMIC_INITIAL_STATE']})};
}
test('actual screen confirmation path calls WS adapter; quiet positive economics survives unknown status and settlement',async()=>{
 const f=fixture();let called=0;
 const r=await confirmScreenCandidate(f.pair,f.original,f.feeds,f.unknown,{status:'UNRESOLVED'},()=>{},async(id,current,health)=>{called++;assert.equal(id,'P');assert.equal(current(),f.pr);assert(health().connected);return f.p;});
 assert.equal(called,1);assert(r.bookConfirmation.accepted);assert.equal(r.status,'EDGE_SURVIVED');assert.equal(r.edgeSurvived,true);assert.equal(r.marketStatus.kalshi.classification,'UNRESOLVED');assert.equal(r.tradability.admitted,false);assert.equal(r.tradingAuthorization.authorized,false);
 assert.equal(r.repriced?.quantity,f.original.quantity);assert.equal(r.bookConfirmation.poly.response.transactTime,f.pr.transactTime);
});
test('newer adverse data supersedes earlier snapshot and unknown survival is not disappeared',async()=>{
 const f=fixture();const newer=structuredClone(f.pr);newer.transactTime=new Date(Date.now()).toISOString();newer.e.book.exchangeAt=Date.parse(newer.transactTime);newer.e.book.yes=[{price:9000,quantity:20}];newer.e.book.noBids=[{price:1000,quantity:20}];
 const r=await confirmScreenCandidate(f.pair,f.original,f.feeds,f.unknown,{status:'UNRESOLVED'},()=>{},async()=>{f.feeds.poly.latest.set('P',newer);return f.p;});
 assert.equal(r.status,'FAILED');assert.equal(r.edgeSurvived,null);assert.equal(r.repriced?.economics?.poly.cost,90000);assert(r.reasons.includes('SNAPSHOT_OLDER_THAN_STREAM'));
});
test('integrated requested-book confirmation fails exact selected quantity after depth loss',async()=>{
 const f=fixture(),kb=f.k.response.e.book,pb=f.p.response.e.book;
 kb.no=[{price:4000,quantity:3},{price:7000,quantity:7}];
 const original=quoteCandidate(f.pair,kb,pb,'no',Date.now());assert.equal(original.quantity,3);assert(original.positiveExchangeNet);
 // Both response and latest now agree on a fresh but insufficient two-contract book.
 pb.yes=[{price:5000,quantity:2}];pb.noBids=[{price:5000,quantity:2}];
 const r=await confirmScreenCandidate(f.pair,original,f.feeds,f.unknown,{status:'UNRESOLVED'},()=>{},async()=>f.p);
 assert.equal(r.repriced?.quantity,3);assert.equal(r.status,'FAILED');assert.equal(r.edgeSurvived,null);assert(r.reasons.includes('FIXED_QUANTITY_DEPTH_UNAVAILABLE'));
});
test('broken book feeds fail but status deactivation independently retains valid confirmation result',async()=>{
 const f=fixture();f.feeds.poly.health=()=>({...healthy,connected:false});let r=await confirmScreenCandidate(f.pair,f.original,f.feeds,f.unknown,{status:'UNRESOLVED'},()=>{},async()=>f.p);assert.equal(r.status,'FAILED');assert.equal(r.edgeSurvived,null);
 f.feeds.poly.health=()=>healthy;r=await confirmScreenCandidate(f.pair,f.original,f.feeds,()=>({admitted:false,classification:'KNOWN_BLOCKED',reasons:['KNOWN_NONTRADING_STATE','BASELINE_LIFECYCLE_CONTRADICTION']}),{status:'UNRESOLVED'},()=>{},async()=>f.p);
 assert.equal(r.status,'EDGE_SURVIVED');assert(r.bookConfirmation.accepted);assert.equal(r.tradability.admitted,false);assert(r.tradability.reasons.includes('KNOWN_NONTRADING_STATE'));
});
test('brief control and experiment share the actual screen path with frozen finite durations',()=>{
 assert.equal(policyFor().durationMs,1800000);assert.equal(policyFor(true).durationMs,30000);assert.equal(policyFor(true).maxAttempts,2);
 const source=readFileSync(new URL('../worker/candidate-confirmation.ts',import.meta.url),'utf8');assert(!source.includes('gateway.polymarket.us'));assert(source.includes('await confirmScreenCandidate(pair,original,feeds'));
});
