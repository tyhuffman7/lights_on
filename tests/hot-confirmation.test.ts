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
