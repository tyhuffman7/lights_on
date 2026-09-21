import {test} from 'node:test';import assert from 'node:assert/strict';
import {BookCache} from '../lib/research/books.ts';
import {observeBook,validity,quoteCandidate,httpConfirmationReasons,confirmationResult,latestPolyBook,CandidateIntervals} from '../lib/screen/confirmation.ts';
import type {Pair} from '../lib/arb/types.ts';import type {StreamBook} from '../lib/research/types.ts';
const now=Date.parse('2026-09-21T19:00:00Z'),mono=1000;
const book:StreamBook={venue:'kalshi',marketId:'K',yes:[{price:4000,quantity:20}],no:[{price:6100,quantity:20}],yesBids:[{price:3900,quantity:20}],noBids:[{price:6000,quantity:20}],receivedAt:now,receivedMono:mono,exchangeAt:null,open:true,valid:true,connection:'LIVE',sequence:2,source:'stream'};
const pair:Pair={id:'K::P',inverted:false,reviewed:false,a:{id:'K',venue:'kalshi',title:'fixture',outcome:'yes',opposite:'no',category:'Elections',rules:'terms',closeAt:'2028-01-01',url:'',open:true,feeRate:700,feeRounding:'ceil',minQty:1,hash:'k',settlement:null},b:{id:'P',venue:'poly',title:'fixture',outcome:'yes',opposite:'no',category:'politics',rules:'terms',closeAt:'2028-01-01',url:'',open:true,feeRate:695,feeRounding:'even',minQty:1,hash:'p',settlement:null}};
const healthy={connected:true,backlog:0,clockOkay:true};
const cheap={...book,venue:'poly' as const,marketId:'P',exchangeAt:now-600000,no:[{price:5000,quantity:20}],noBids:[{price:4900,quantity:20}],yes:[{price:5100,quantity:20}]};
const http={url:'https://gateway.polymarket.us/v1/markets/P/book',requestAt:now,requestMono:1000,responseAt:now+100,responseMono:1100,processedAt:now+105,processedMono:1105,status:200,headers:{date:new Date(now).toUTCString(),'cf-cache-status':'EXPIRED','cache-control':'public, max-age=30'},bodySha256:'fixture'};
test('documented timestamp-free Kalshi snapshot remains unknown, not fabricated or rejected',()=>{
 const b=new BookCache().kalshi({type:'orderbook_snapshot',sid:1,seq:2,msg:{market_ticker:'K',yes_dollars_fp:[['0.39','20']],no_dollars_fp:[['0.60','20']]}},now,mono)!;
 const e=observeBook(b,undefined,'orderbook_snapshot',now+10,mono+10);assert.equal(e.lastMarketChangeAt,null);assert.equal(e.book.exchangeAt,null);assert.equal(e.lastConfirmedSnapshotAt,now);assert(validity(e,healthy,now+20,mono+20).usableForDiscovery);
});
test('quiet unchanged books remain discoverable, heartbeat cannot advance price or confirmation',()=>{
 const e=observeBook(book,undefined,'orderbook_snapshot',now+10,mono+10),before=structuredClone(e);
 const v=validity(e,healthy,now+60000,mono+60000);assert(v.usableForDiscovery);assert(v.confirmationRequired);assert.deepEqual(e,before);
 const pm=observeBook(cheap,undefined,'marketData',now+10,mono+10);assert(validity(pm,healthy,now+100,mono+100).usableForDiscovery);assert.equal(pm.lastMarketChangeAt,now-600000);assert.equal(pm.lastConfirmedSnapshotAt,null);
});
test('genuine delayed deltas, processing backlog, invalid/closed books, disconnect and clock faults fail',()=>{
 const old=observeBook({...book,exchangeAt:now-3000},undefined,'orderbook_delta',now+10,mono+10);assert(!validity(old,healthy,now+20,mono+20).usableForDiscovery);
 const delayed=observeBook(book,undefined,'orderbook_snapshot',now+500,mono+500);assert(!validity(delayed,healthy,now+600,mono+600).usableForDiscovery);
 const good=observeBook(book,undefined,'orderbook_snapshot',now,mono);
 for(const h of [{...healthy,connected:false},{...healthy,backlog:1},{...healthy,clockOkay:false}])assert(!validity(good,h,now,mono).usableForDiscovery);
 for(const b of [{...book,valid:false},{...book,open:false}])assert(!validity(observeBook(b,undefined,'orderbook_snapshot',now,mono),healthy,now,mono).usableForDiscovery);
 assert(!validity(good,healthy,now+5000,mono+1).usableForDiscovery);
});
test('sequence gap still invalidates BookCache; snapshots do not bypass reconstruction safety',()=>{
 const c=new BookCache();c.kalshi({type:'orderbook_snapshot',sid:1,seq:2,msg:{market_ticker:'K',yes_dollars_fp:[['0.39','20']],no_dollars_fp:[['0.60','20']]}},now,mono);
 assert.throws(()=>c.kalshi({type:'orderbook_delta',sid:1,seq:4,msg:{market_ticker:'K',side:'yes',price_dollars:'0.39',delta_fp:'1',ts_ms:now}},now,mono));assert.equal(c.get('kalshi','K')?.valid,false);
});
test('positive fee-net economics survives disabled authorization, cash-cap and horizon policy failures',()=>{
 const q=quoteCandidate(pair,book,cheap,'yes',now);assert(q.positiveExchangeNet);assert.equal(q.tradingAuthorization.authorized,false);assert.equal(q.quantity,10);assert(q.additionalPolicyAdmission.blockers.includes('BASELINE_30_DAY_HORIZON'));assert(q.additionalPolicyAdmission.blockers.includes('BASELINE_10_DOLLAR_ENTRY_CAP'));
 assert.equal(q.economics!.afterRisk,q.economics!.feeBoundSurplus-q.economics!.riskAllowance);
});
test('cached/failed/slow/undated confirmation cannot establish survival; expired origin response allowed with evidence',()=>{
 assert.deepEqual(httpConfirmationReasons(http),[]);
 for(const h of [{...http,status:503},{...http,headers:{...http.headers,'cf-cache-status':'HIT'}},{...http,headers:{...http.headers,age:'5'}},{...http,headers:{}},{...http,responseMono:3000},{...http,processedMono:2000}])assert(httpConfirmationReasons(h).length>0);
 const q=quoteCandidate(pair,book,cheap,'yes',now);const w={startedAt:now,endedAt:now+100,kalshiSnapshotMono:1100,polyResponseMono:1100,nowMono:1200};
 assert.equal(confirmationResult(q,q,['HTTP_503'],w).edgeSurvived,null);assert.equal(confirmationResult(q,q,[],w).status,'EDGE_SURVIVED');assert.equal(confirmationResult(q,q,[],{...w,kalshiSnapshotMono:-2000}).status,'FAILED');
 const worse=quoteCandidate(pair,book,{...cheap,no:[{price:7000,quantity:20}]},'yes',now+100,q.quantity);assert.equal(confirmationResult(q,worse,[],w).status,'EDGE_DISAPPEARED');
 const shallow=quoteCandidate(pair,book,{...cheap,no:[{price:5000,quantity:1}]},'yes',now+100,q.quantity);assert.equal(shallow.quantity,10);assert.equal(confirmationResult(q,shallow,[],w).status,'FAILED');
});
test('latest adverse PM update replaces favorable confirmation response; equal-time conflict fails',()=>{
 const rest={...cheap,receivedMono:1100,exchangeAt:now};
 const newer=observeBook({...cheap,no:[{price:8000,quantity:20}],noBids:[{price:7900,quantity:20}],receivedMono:1150,receivedAt:now+150,exchangeAt:now+150},undefined,'marketData',now+151,1151);
 assert.equal(latestPolyBook(rest,newer,1000).book.no[0].price,8000);
 newer.book.exchangeAt=now;assert(latestPolyBook(rest,newer,1000).reasons.includes('SAME_EXCHANGE_TIME_CONFLICTING_BOOKS'));
});
test('coalesced repeated positive observations remain one interval, re-entry and censoring explicit',()=>{
 const intervals=new CandidateIntervals(),q=quoteCandidate(pair,book,cheap,'yes',now);
 for(let i=0;i<20;i++)intervals.update('key',q,true,now+i);assert.equal(intervals.nextId,1);
 intervals.update('key',q,false,now+30);assert.equal(intervals.completed.length,1);
 intervals.update('key',q,true,now+40);assert.equal(intervals.nextId,2);intervals.stop(now+50);assert.equal(intervals.active.size,0);assert.equal(intervals.completed.length,2);
});
