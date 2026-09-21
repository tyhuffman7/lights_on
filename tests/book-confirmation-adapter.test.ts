import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {BookCache} from '../lib/research/books.ts';import {observeBook,httpConfirmationReasons} from '../lib/screen/confirmation.ts';
import {assessSnapshot,assessRestBook,inspectHttp,transactionVersion} from '../lib/screen/book-confirmation.ts';
import type {SnapshotRequest,SnapshotReceipt} from '../lib/screen/book-confirmation.ts';
const shapes=JSON.parse(readFileSync(new URL('./fixtures/confirmation-adapter/retained-shapes.json',import.meta.url),'utf8'));
const good=shapes[0],h=good.poly.http,healthy={connected:true,backlog:0,clockOkay:true};
const request:SnapshotRequest={venue:'poly',marketId:good.poly.bodyFields.marketSlug,kind:'new_subscription',requestId:'control-books-1',at:h.requestAt,mono:h.requestMono};
function receipt(body=good.poly.bodyFields):SnapshotReceipt{const book=new BookCache().poly({marketData:body},h.responseAt,h.responseMono)!;return {e:observeBook(book,undefined,'marketData',h.processedAt,h.processedMono),messageType:'marketData',requestId:request.requestId,transactTime:body.transactTime};}
const r=receipt();const confirm=(r1=r,latest=r,health=healthy,req=request)=>assessSnapshot(req,r1,latest,health,h.processedAt,h.processedMono);
test('captured quiet full book confirms by correlated subscription, without advancing transactTime',()=>{
 const result=confirm();assert(result.accepted);assert.equal(result.confirmedAt,h.responseAt);assert.equal(result.selected.transactTime,'2026-09-21T19:25:34.462162197Z');assert.equal(result.selected.e.lastMarketChangeAt,1790018734462);assert(result.confirmedAt!>result.selected.e.lastMarketChangeAt!);
});
test('missing optional HTTP cache headers stay unknown; independent exact WS book corroboration can pass',()=>{
 const missing={...h,headers:{date:h.headers.date}};const observed=inspectHttp(missing);assert.equal(observed.ageSeconds,null);assert.equal(observed.cacheEvidence,'UNKNOWN');assert(httpConfirmationReasons(missing).includes('CACHE_PROVENANCE_UNRESOLVED'));
 const result=assessRestBook(r,missing,confirm(),r,healthy);assert(result.accepted);assert.equal(result.proof,'EXACT_BOOK_AND_VERSION_MATCH_REQUESTED_WS');
 assert(!assessRestBook(r,missing,{...confirm(),accepted:false},r,healthy).accepted);
 // Even a matching cache HIT gains no HTTP proof; it may be corroborated independently.
 assert(assessRestBook(r,{...missing,headers:{...missing.headers,age:'15','cf-cache-status':'HIT'}},confirm(),r,healthy).accepted);
});
test('captured genuinely older REST and conflicting versions reject, never replace latest snapshot',()=>{
 const old=receipt(shapes[1].poly.bodyFields);const result=assessRestBook(old,h,confirm(),r,healthy);assert(result.reasons.includes('REST_OLDER_THAN_STREAM'));assert.equal(result.selected,r);
 const conflicting=receipt({...good.poly.bodyFields,bids:[{px:{value:'0.06',currency:'USD'},qty:'99'}]});assert(confirm(conflicting,r).reasons.includes('SAME_VERSION_CONFLICTING_BOOKS'));assert(assessRestBook(conflicting,h,confirm(),r,healthy).reasons.includes('SAME_VERSION_CONFLICTING_BOOKS'));
 const newer=receipt({...good.poly.bodyFields,transactTime:'2026-09-21T19:25:34.462162198Z'});assert(confirm(r,newer).reasons.includes('SNAPSHOT_OLDER_THAN_STREAM'));assert.equal(confirm(r,newer).selected,newer);
 assert(!assessRestBook(newer,h,confirm(),r,healthy).accepted);
});
test('timestamp-free sequenced Kalshi requested snapshot confirms; gaps and unbound snapshots fail',()=>{
 const s=good.kalshiSnapshot;const e=observeBook(s.book,undefined,'orderbook_snapshot',s.processedAt,s.processedMono);const k:SnapshotReceipt={e,messageType:'orderbook_snapshot',sid:1};
 const req:SnapshotRequest={venue:'kalshi',marketId:e.book.marketId,kind:'get_snapshot',requestId:'10001',sid:1,beforeSequence:e.book.sequence!-1,at:e.book.receivedAt-20,mono:e.book.receivedMono-20};
 const result=assessSnapshot(req,k,k,healthy,s.processedAt,s.processedMono);assert(result.accepted);assert.equal(e.book.exchangeAt,null);assert.equal(result.marketState,'NOT_PRESENT_IN_KALSHI_BOOK');
 assert(!assessSnapshot({...req,beforeSequence:e.book.sequence!},k,k,healthy,s.processedAt,s.processedMono).accepted);
 assert(!assessSnapshot(req,{...k,sid:2},k,healthy,s.processedAt,s.processedMono).accepted);
 const cache=new BookCache();cache.kalshi({type:'orderbook_snapshot',sid:1,seq:1,msg:{market_ticker:'K',yes_dollars_fp:[['.10','10']],no_dollars_fp:[['.80','10']]}},h.responseAt,h.responseMono);assert.throws(()=>cache.kalshi({type:'orderbook_delta',sid:1,seq:3,msg:{market_ticker:'K',side:'yes',price_dollars:'.10',delta_fp:'1',ts_ms:h.responseAt}},h.responseAt,h.responseMono));assert.equal(cache.get('kalshi','K')?.valid,false);
});
test('disconnected, backlog, clock, closed, malformed, delayed, unbound or stale proof fails',()=>{
 for(const health of [{...healthy,connected:false},{...healthy,backlog:1},{...healthy,clockOkay:false}])assert(!confirm(r,r,health).accepted);
 for(const field of ['open','valid'] as const){const broken=structuredClone(r);broken.e.book[field]=false;assert(!confirm(broken).accepted);}
 assert(!confirm({...r,messageType:'heartbeat'}).accepted);assert(!confirm({...r,requestId:'another-request'}).accepted);
 const slow=structuredClone(r);slow.e.faults.push('PROCESSING_BACKLOG');assert(!confirm(slow).accepted);
 assert(!confirm(r,r,healthy,{...request,mono:request.mono-2000}).accepted);
 assert(!assessSnapshot(request,r,r,healthy,h.processedAt+3000,h.processedMono+3000).accepted);
 for(const bad of [{...h,status:429},{...h,responseMono:h.requestMono-1},{...h,processedAt:h.processedAt+4000},{...h,headers:{age:'-1'}},{...h,headers:{date:'invalid'}}])assert(inspectHttp(bad).transportReasons.length);
});
test('nanosecond versions retain exact order and reject unrecognized timestamp shape',()=>{
 assert(transactionVersion('2026-09-21T19:25:34.462162198Z')!>transactionVersion('2026-09-21T19:25:34.462162197Z')!);assert.equal(transactionVersion(undefined),null);
});
test('REST comparison rechecks latest feed and never returns an older favorable book',()=>{
 const newer=receipt({...good.poly.bodyFields,transactTime:'2026-09-21T19:25:34.462162198Z'});
 const a=assessRestBook(r,h,confirm(),newer,healthy);assert(!a.accepted);assert(a.reasons.includes('WS_CONFIRMATION_SUPERSEDED'));assert.equal(a.selected,newer);
 assert(!assessRestBook(r,h,confirm(),r,{...healthy,connected:false}).accepted);assert(!assessRestBook(r,h,confirm(),undefined,healthy).accepted);
});
test('actual four control envelopes replay successful requests; both captured old REST books reject',async()=>{
 const {assessKalshiStatus}=await import('../lib/screen/http-confirmation.ts');
 const captures=JSON.parse(readFileSync(new URL('./fixtures/confirmation-adapter/live-controls.json',import.meta.url),'utf8'));
 for(const c of captures){
  const cache=new BookCache(),t=c.timing;const b=c.request.venue==='kalshi'?cache.kalshi(c.message,t.receiptAt,t.receiptMono)!:cache.poly(c.message,t.receiptAt,t.receiptMono)!;
  const rec:SnapshotReceipt={e:observeBook(b,undefined,c.request.venue==='kalshi'?'orderbook_snapshot':'marketData',t.processingAt,t.processingMono),messageType:t.messageType,requestId:c.message.requestId,sid:c.message.sid,transactTime:c.message.marketData?.transactTime};
  const result=assessSnapshot(c.request,rec,rec,healthy,t.processingAt,t.processingMono);assert(result.accepted,c.request.marketId);
  if(c.request.venue==='poly'){
   const rb=new BookCache().poly(c.restBody,c.http.responseAt,c.http.responseMono)!;const rr:SnapshotReceipt={e:observeBook(rb,undefined,'rest',c.http.processedAt,c.http.processedMono),messageType:'marketData',transactTime:c.restBody.marketData.transactTime};
   assert(assessRestBook(rr,c.http,result,rec,healthy).reasons.includes('REST_OLDER_THAN_STREAM'));
  }else{
   assert.equal(assessKalshiStatus(c.request.marketId,c.restBody.market,c.http).confirmedOpen,false);
   assert(assessKalshiStatus(c.request.marketId,{...c.restBody.market,status:'closed'},c.http).reasons.includes('KALSHI_MARKET_NOT_ACTIVE'));
  }
 }
});
