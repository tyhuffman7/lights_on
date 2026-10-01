import {test} from 'node:test';
import assert from 'node:assert/strict';
import {market,book} from './research-fixture.ts';
import {LatestCandidates,paperSettlement,differentQuestion,selectConfirmationBooks} from '../lib/research/hot-confirmation.ts';
import {recallSignals,type RecallRoute,type ObservedBook} from '../lib/research/recall-detector.ts';
import {ConfirmationFeed} from '../worker/book-confirmation-adapter.ts';
function fixture(){const now=Date.now();const route:RecallRoute={pair:{id:'K::P',a:market('kalshi','K') as any,b:market('poly','P') as any,inverted:false,reviewed:false},matchSource:'TEXT',eventKey:'x',warnings:[]};
 const books={kalshi:{book:{...book('kalshi','K'),source:'stream'}} as ObservedBook,poly:{book:{...book('poly','P'),source:'stream'}} as ObservedBook};
 return {now,route,books};}
test('latest state coalesces per orientation and removes disappearing economics',()=>{
 const {route,books,now}=fixture(),q=new LatestCandidates();q.update(route,recallSignals(route,books,now),now);
 assert.equal(q.pending.size,1);books.poly.book.no=[{price:3900,quantity:2}];q.update(route,recallSignals(route,books,now+10),now+10);
 assert.equal(q.pending.size,1);assert.equal(q.superseded,1);assert.equal(q.next()?.queuedAt,now+10);assert.equal(q.next()?.firstQueuedAt,now);
 books.poly.book.no=[{price:8000,quantity:2}];q.update(route,recallSignals(route,books,now+20),now+20);
 assert.equal(q.pending.size,0);assert.equal(q.disappeared,1);
});
test('fresh live books need zero fallback calls, independent stale side falls back',()=>{
 const {route,books,now}=fixture();assert.deepEqual(selectConfirmationBooks(route,books,now),[]);
 books.poly.book.receivedAt=now-3000;assert.deepEqual(selectConfirmationBooks(route,books,now),['poly']);
});
test('local House race cannot consume national House control confirmation',()=>{
 const {route}=fixture();route.pair.a.title='Will Democrats win the Alaska House race?';route.pair.b.title='Will Democrats control the House?';
 assert.ok(differentQuestion(route).length);assert.equal(paperSettlement(route).classification,'DIFFERENT_QUESTION');
});
test('ordinary season and IPO basis categories retain explicit divergence branches',()=>{
 const {route}=fixture();route.matchSource='CANONICAL';route.pair.a.series='KXNCAAFWINS';
 assert.equal(paperSettlement(route).classification,'ORDINARY_EQUIVALENT_BASIS_RISK');assert.ok(paperSettlement(route).divergenceBranches.length>=4);
 route.pair.a.series='KXIPO';assert.equal(paperSettlement(route).classification,'ORDINARY_EQUIVALENT_BASIS_RISK');assert.equal(paperSettlement(route).strictEquivalent,false);
 route.matchSource='TEXT';assert.equal(paperSettlement(route).classification,'UNRESOLVED');
});
test('Kalshi sequence, backlog, clock and PM conflicting versions fail closed',()=>{
 const {books,now}=fixture();const f=new ConfirmationFeed('kalshi',['K']);f.health=()=>({connected:true,backlog:0,clockOkay:true});
 f.latest.set('K',{e:{book:books.kalshi.book,faults:[]} as any,sid:1,messageType:'orderbook_snapshot'});f.cache.subscriptions.set('K',1);f.cache.sequences.set(1,2);
 assert.equal(f.liveBook('K')?.book.valid,true);f.cache.sequences.clear();assert.equal(f.liveBook('K')?.book.valid,false);
 const p=new ConfirmationFeed('poly',['P']);p.health=()=>({connected:true,backlog:0,clockOkay:true});
 p.latest.set('P',{e:{book:books.poly.book,faults:[]} as any,messageType:'marketData',transactTime:new Date(now).toISOString()});assert.equal(p.liveBook('P')?.book.valid,true);
 p.health=()=>({connected:true,backlog:1,clockOkay:true});assert.equal(p.liveBook('P')?.book.valid,false);
 p.health=()=>({connected:true,backlog:0,clockOkay:true});p.latest.get('P')!.e.faults.push('SAME_VERSION_CONFLICTING_BOOKS');assert.equal(p.liveBook('P')?.book.valid,false);
});
const nativeClassifications=JSON.parse((await import('node:fs')).readFileSync(new URL('./fixtures/hot-native-classifications.json',import.meta.url),'utf8'));
for(const c of nativeClassifications)test('native hot-question classification: '+c.label,()=>{
 assert.equal(paperSettlement(c.route).classification,c.expected);
});
test('equivalent nanosecond timestamp encodings cannot hide conflicting full books',()=>{
 const f=new ConfirmationFeed('poly',['P']);const at=Date.now(),mono=performance.now();
 const message=(transactTime:string,qty:string)=>({marketData:{marketSlug:'P',transactTime,state:'MARKET_STATE_OPEN',
  bids:[{px:{value:'0.40',currency:'USD'},qty}],offers:[{px:{value:'0.60',currency:'USD'},qty:'3'}]}});
 f.stream.options.onMessage(message('2026-10-01T05:00:00.100Z','2'),at,mono);
 f.stream.options.onMessage(message('2026-10-01T05:00:00.100000000Z','4'),at+1,mono+1);
 assert.ok(f.failures.includes('SAME_VERSION_CONFLICTING_BOOKS'));assert.equal(f.latest.get('P')?.e.book.valid,false);
});
test('matching full-event winner and same playoff stage retain broad hypotheses',()=>{
 const {route}=fixture();route.pair.a.title='Will Example qualify for the College Football Playoff Final?';route.pair.b.title='Example · College Football Playoff Final Qualifiers';
 route.pair.a.rules='If Example advances to the College Football Playoff National Championship, then the market resolves to Yes.';
 route.pair.b.rules='This market will settle to Yes if Example advances to the College Football Playoff National Championship.';
 assert.deepEqual(differentQuestion(route),[]);
});
