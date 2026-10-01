import {test} from 'node:test';
import assert from 'node:assert/strict';
import {market,book} from './research-fixture.ts';
import {recallSignals,type RecallRoute,type ObservedBook} from '../lib/research/recall-detector.ts';
import {screenNativeSignals} from '../worker/recall-observer.ts';
function fixture(){const now=Date.now(),route:RecallRoute={pair:{id:'K::P',a:market('kalshi','K') as any,b:market('poly','P') as any,inverted:false,reviewed:false},matchSource:'TEXT',eventKey:'x',warnings:[]};
 const books={kalshi:{book:{...book('kalshi','K',performance.now(),now),source:'stream'}} as ObservedBook,poly:{book:{...book('poly','P',performance.now(),now),source:'stream'}} as ObservedBook};return {route,books,now};}
for(const level of [{price:10000,quantity:2},{price:4000,quantity:0},{price:4000,quantity:0.00001},{price:4000.5,quantity:2}])test('unusable native level cannot kill collection or produce economics: '+JSON.stringify(level),()=>{
 const {route,books,now}=fixture();books.kalshi.book.yes=[level];const original=structuredClone(books),errors:string[]=[];
 assert.throws(()=>recallSignals(route,books,now,[1]),/INVALID_EXECUTABLE_LEVEL/);
 assert.deepEqual(screenNativeSignals(route,books,now,[1],e=>errors.push(e)),[]);
 assert.deepEqual(errors,['INVALID_EXECUTABLE_LEVEL']);assert.deepEqual(books,original);
});
test('valid native books produce identical results through observation boundary',()=>{const {route,books,now}=fixture();assert.deepEqual(screenNativeSignals(route,books,now,[1],()=>assert.fail()),recallSignals(route,books,now,[1]));});
test('unrelated evaluation failures still terminate instead of being hidden',()=>{const {route,books,now}=fixture();route.pair.a.venue='poly';assert.throws(()=>screenNativeSignals(route,books,now,[1],()=>assert.fail()),/INVALID_PAIR_OR_QUANTITY/);});
