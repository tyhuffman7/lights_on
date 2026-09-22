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
test('all legal sizes use cumulative depth: three contracts profitable while maximum ten loses',()=>{
 const stepped={...book,yes:[{price:7000,quantity:7},{price:4000,quantity:3}]};
 const q=quoteCandidate(pair,stepped,cheap,'yes',now),maximum=quoteCandidate(pair,stepped,cheap,'yes',now,10);
 assert.equal(q.quantity,3);assert(q.positiveExchangeNet);assert(!maximum.positiveExchangeNet);
 assert.deepEqual(q.quantitySelection.compared.map(x=>x.quantity),[1,2,3,4,5,6,7,8,9,10]);
 assert.equal(q.economics!.cost,27000);assert.deepEqual(q.economics!.kalshi.levels,[{price:4000,quantity:3}]);
 assert(q.quantitySelection.compared.every(x=>x.feeBound!==null));
 const confirm=quoteCandidate(pair,stepped,{...cheap,no:[{price:5000,quantity:2}]},'yes',now+100,q.quantity);
 assert.equal(confirm.quantity,3);assert.equal(confirm.economics,null);assert(confirm.pricingReasons.includes('FIXED_QUANTITY_DEPTH_UNAVAILABLE'));
 assert(quoteCandidate(pair,stepped,{...cheap,no:[{price:5000,quantity:2}]},'yes',now+100).positiveExchangeNet);
 assert.equal(confirmationResult(q,confirm,[],{startedAt:now,endedAt:now+100,kalshiSnapshotMono:1100,polyResponseMono:1100,nowMono:1200}).status,'FAILED');
});
test('minimum size, missing/invalid depth and unknown fees cannot be bypassed by quantity enumeration',()=>{
 const minimum={...pair,a:{...pair.a,minQty:2.2}};
 const q=quoteCandidate(minimum,{...book,yes:[{price:4000,quantity:2.9}]},cheap,'yes',now);
 assert.equal(q.economics,null);assert.deepEqual(q.quantitySelection.compared.map(x=>x.quantity),[3,4,5,6,7,8,9,10]);
 for(const a of [undefined,{...book,yes:[{price:NaN,quantity:10},{price:4000,quantity:-1}]}])assert.equal(quoteCandidate(pair,a,cheap,'yes',now).economics,null);
 assert.equal(quoteCandidate({...pair,a:{...pair.a,feeRate:null}},book,cheap,'yes',now).economics,null);
 assert.equal(quoteCandidate({...pair,a:{...pair.a,minQty:NaN}},book,cheap,'yes',now).economics,null);
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

test('existing screen CLI dispatches confirmation preparation without a circular top-level import',async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,readFileSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join,resolve}=await import('node:path');const {spawnSync}=await import('node:child_process');
 const dir=mkdtempSync(join(tmpdir(),'confirmation-cli-')),baseline=join(dir,'baseline'),output=join(dir,'output');mkdirSync(baseline);writeFileSync(join(baseline,'frozen.json'),JSON.stringify({selection:[]}));
 const result=spawnSync(process.execPath,['--experimental-strip-types',resolve('worker/executable-screen.ts'),'confirmation-prepare',output,baseline],{encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(readFileSync(join(output,'frozen.json'),'utf8')).selection.length,0);
});
