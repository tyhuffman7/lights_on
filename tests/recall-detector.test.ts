import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {market,book} from './research-fixture.ts';
import {recallMatches,recallSignals,currentBook,freshnessBucket,fairRoutes,type RecallRoute,type ObservedBook} from '../lib/research/recall-detector.ts';
import {delayCounterfactual,matchOffThread,currentCatalog,type PublicData} from '../worker/recall-observer.ts';
import type {Market} from '../lib/arb/types.ts';
const nativeCases=JSON.parse(readFileSync(new URL('./fixtures/recall-native-matches.json',import.meta.url),'utf8'));
for(const c of nativeCases)test('native smoke regression: '+c.label,()=>{
  assert.equal(recallMatches([c.a],[c.b]).routes.length,c.expected);
});
const now=Date.now();
function fixtures(){
  const a=market('kalshi','K') as Market,b=market('poly','P') as Market;
  a.title=b.title='Example climate threshold';a.outcome=b.outcome='Yes';
  const route:RecallRoute={pair:{id:'K::P',a,b,inverted:false,reviewed:false},matchSource:'TEXT',eventKey:'event',warnings:['SETTLEMENT_REVIEW_PENDING']};
  const make=(v:'kalshi'|'poly',id:string):ObservedBook=>({book:{...book(v,id),source:'stream' as const,receivedAt:now,exchangeAt:now}});
  const books={kalshi:make('kalshi','K'),poly:make('poly','P')};
  books.kalshi.book.yes=[{price:4000,quantity:10}];books.poly.book.no=[{price:5000,quantity:10}];
  return {route,books};
}
test('positive candidate persists across freshness, verification, tick and stress failure',()=>{
  const {route,books}=fixtures();books.poly.book.receivedAt=now-10_000;
  const signal=recallSignals(route,books,now,[1])[0];
  assert.equal(signal.candidate,true);assert.equal(signal.fresh,false);
  assert.equal(signal.verificationStatus,'verification-pending');assert.equal(signal.evaluation.stress.feeBoundPass,false);
  assert.equal(signal.executable,false);
});
test('a one-contract thin edge is preserved and sensible quantities walk available depth',()=>{
  const {route,books}=fixtures();books.kalshi.book.yes=[{price:4000,quantity:1},{price:8500,quantity:9}];
  books.poly.book.no=[{price:5500,quantity:10}];
  const signals=recallSignals(route,books,now);assert.equal(signals.length,20);
  assert.equal(signals[0].candidate,true);assert.equal(signals[1].candidate,false);
  route.pair.b.minQty=2;assert.equal(recallSignals(route,books,now,[1])[0].candidate,true);
  assert.equal(recallSignals(route,books,now,[1])[0].executable,false);
});
test('transport age, cached REST and exchange age independently prevent fresh confirmation',()=>{
  const {books}=fixtures(),b=books.poly;b.book.source='rest';
  b.transport={requestAt:now-100,responseAt:now,durationMs:100,cacheAgeSeconds:22,cacheStatus:'HIT',bodySha256:'x'};
  assert.equal(currentBook(b,now),false);b.transport.cacheAgeSeconds=0;b.transport.cacheStatus='MISS';
  assert.equal(currentBook(b,now),true);b.book.exchangeAt=now-5000;assert.equal(currentBook(b,now),false);
  b.book.exchangeAt=now;b.transport.requestAt=now-5000;assert.equal(currentBook(b,now),false);
  assert.equal(freshnessBucket(250),'<=250ms');assert.equal(freshnessBucket(501),'<=1000ms');assert.equal(freshnessBucket(null),'unknown');
});
test('identical named question is observed without settlement verification',()=>{
  const {route}=fixtures();const result=recallMatches([route.pair.a],[route.pair.b]);
  assert.equal(result.routes.length,1);assert.equal(result.routes[0].pair.reviewed,false);
  assert.equal(result.routes[0].pair.inverted,false);
  assert.ok(result.routes[0].warnings.includes('SETTLEMENT_REVIEW_PENDING'));
});
test('background matching returns routes without blocking the observer process',async()=>{
  const {route}=fixtures();const result=await matchOffThread([route.pair.a],[route.pair.b],new AbortController().signal);
  assert.equal(result.routes.length,1);assert.equal(result.routes[0].pair.reviewed,false);
});
test('catalog page batching preserves both native catalogs and avoids per-market HTTP enrichment',async()=>{
  const calls:string[]=[];
  const k=Array.from({length:500},(_,i)=>({ticker:'K-'+i,status:'active',market_type:'binary',notional_value_dollars:'1.0000',title:'Example'}));
  const p=Array.from({length:500},(_,i)=>({slug:'P-'+i,active:true,closed:false,title:'Example',minimumTradeQty:1,
    marketSides:[{long:true,tradable:true,description:'Yes'},{long:false,tradable:true,description:'No'}]}));
  const api={get:async(url:string)=>{calls.push(url);return {data:url.endsWith('/series')?{series:[]}:
    url.includes('mve_filter')?{markets:k,cursor:''}:{markets:url.includes('offset=0')?p:[]}};}} as unknown as PublicData;
  const result=await currentCatalog(api);
  assert.equal(result.complete,true);assert.equal(result.kalshi.length,500);assert.equal(result.poly.length,500);
  assert.equal(result.kalshi[499].id,'K-499');assert.equal(result.poly[499].id,'P-499');
  assert.equal(result.raw.size,1000);assert.equal(calls.length,4);
});
test('structured sports matching resolves opposite named winners and rejects known different lines',()=>{
  const {route}=fixtures();const common={sports:true,competition:'nfl',sport:'football',eventDate:'2026-10-01',
    participants:['cleveland browns','cincinnati bengals'],entities:[],numbers:[],marketType:'winner',period:'full event'};
  route.pair.a.identity={...common,outcome:'cleveland browns'};route.pair.b.identity={...common,outcome:'cincinnati bengals'};
  const match=recallMatches([route.pair.a],[route.pair.b]);assert.equal(match.routes.length,1);assert.equal(match.routes[0].pair.inverted,true);
  route.pair.a.identity.line=1;route.pair.b.identity.line=2;
  const conflict=recallMatches([route.pair.a],[route.pair.b]);assert.equal(conflict.routes.length,0);
  assert.equal(conflict.diagnostics.knownDimensionConflicts['DIMENSION_CONFLICT:line'],1);
});
test('unknown and disappeared delayed hedge outcomes never fabricate fills or realized profit',()=>{
  const {route,books}=fixtures(),signal=recallSignals(route,books,now,[1])[0];
  const clean=delayCounterfactual(route,signal,books,books,'kalshi',0,0,now);assert.equal(clean.outcome,'CLEAN_DEPTH_PAIR');
  const absent=delayCounterfactual(route,signal,books,null,'kalshi',100,130,now+130);assert.equal(absent.modeledNet,null);
  const stale=structuredClone(books);stale.poly.book.receivedAt=now-5000;
  assert.equal(delayCounterfactual(route,signal,books,stale,'kalshi',100,100,now+100).outcome,'UNOBSERVED_STALE_FUTURE');
  const future=structuredClone(books);future.poly.book.no=[];future.kalshi.book.yesBids=[];
  assert.equal(delayCounterfactual(route,signal,books,future,'kalshi',100,100,now+100).outcome,'ORPHAN_DEPTH');
});
test('fair routes include all categories and source exposes only native read-only endpoints',()=>{
  const {route}=fixtures();const routes=[route,{...route,pair:{...route.pair,id:'two',a:{...route.pair.a,category:'Sports'}}},
    {...route,pair:{...route.pair,id:'three'}}];
  assert.deepEqual(fairRoutes(routes).map(r=>r.pair.id),['K::P','two','three']);
  const source=readFileSync(new URL('../worker/recall-observer.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:submitOrder|placeOrder|cancelOrder|previewOrder)\s*\(/);
  assert.doesNotMatch(source,/method\s*:\s*['"](?:POST|PUT|DELETE)['"]/);
});
