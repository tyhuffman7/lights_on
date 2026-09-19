import {test} from 'node:test';import assert from 'node:assert/strict';
import {readAccountHistory} from '../lib/pilot/account-history.ts';
import {readHistoryPage} from '../lib/pilot/account-read.ts';
const env={POLYMARKET_KEY_ID:'synthetic',POLYMARKET_SECRET_KEY:Buffer.alloc(32,1).toString('base64')};
function options(pages:unknown[]){const urls:string[]=[];return {urls,options:{env,fetch:(async(url,init)=>{urls.push(String(url));assert.equal(init?.method,'GET');assert.equal(init?.redirect,'error');return new Response(JSON.stringify(pages.shift()),{status:200});}) as typeof fetch}};}
test('Complete multi-page fill history retains earlier and later records with fixed signed GET destination',async()=>{
 const x=options([{activities:[{id:1}],nextCursor:'https://evil.invalid/?x=y&z=1',eof:false},{activities:[{id:2}],nextCursor:'',eof:true}]);const r=await readAccountHistory('poly','fills',x.options);assert.equal(r.pages,2);assert.equal(r.records,2);assert.deepEqual(r.body.activities,[{id:1},{id:2}]);const u=new URL(x.urls[1]);assert.equal(u.origin,'https://api.polymarket.us');assert.equal(u.pathname,'/v1/portfolio/activities');assert.equal(u.searchParams.get('cursor'),'https://evil.invalid/?x=y&z=1');assert.equal(u.searchParams.get('types'),'ACTIVITY_TYPE_TRADE');
});
test('Settlement history uses resolution filter and zero rows is only an empty history, not a payout',async()=>{
 const x=options([{activities:[],nextCursor:'',eof:true}]);const r=await readAccountHistory('poly','settlements',x.options);assert.equal(r.records,0);assert.equal(new URL(x.urls[0]).searchParams.get('types'),'ACTIVITY_TYPE_POSITION_RESOLUTION');assert.equal('payout' in r,false);
});
test('Loop, page limit, inconsistent EOF and oversized page fail without returning partial evidence',async()=>{
 for(const [pages,bound] of [[[{activities:[],nextCursor:'x',eof:false},{activities:[],nextCursor:'x',eof:false}],20],[[{activities:[],nextCursor:'x',eof:false}],1],[[{activities:[],nextCursor:'x',eof:true}],20],[[{activities:Array(101).fill({}),nextCursor:'',eof:true}],20]] as [unknown[],number][]){const x=options(pages);await assert.rejects(readAccountHistory('poly','fills',x.options,bound));}
});
test('Later page transport failure never supplies the first page as complete',async()=>{
 let calls=0;await assert.rejects(readAccountHistory('poly','fills',{env,fetch:(async()=>{if(calls++)return new Response('',{status:503});return new Response(JSON.stringify({activities:[{}],nextCursor:'x',eof:false}));}) as typeof fetch}),/unavailable/);
});
test('Unknown destination, excessive cursor and invalid bounds are rejected before any HTTP request',async()=>{
 const x=options([]);await assert.rejects(readHistoryPage('poly','orders' as any,'',x.options));await assert.rejects(readHistoryPage('poly','fills','x'.repeat(4097),x.options));await assert.rejects(readAccountHistory('poly','fills',x.options,21));assert.equal(x.urls.length,0);
});

import {generateKeyPairSync} from 'node:crypto';
test('Kalshi settlement history is scoped to primary subaccount and walks its own cursor format',async()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const urls:string[]=[];const pages=[{settlements:[{ticker:'one'}],cursor:'next'},{settlements:[{ticker:'two'}],cursor:''}];
 const r=await readAccountHistory('kalshi','settlements',{env:{KALSHI_KEY_ID:'synthetic',KALSHI_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}).toString()},fetch:(async(url,init)=>{urls.push(String(url));assert.equal(init?.method,'GET');return new Response(JSON.stringify(pages.shift()));}) as typeof fetch});assert.equal(r.records,2);assert.deepEqual(r.body.settlements,[{ticker:'one'},{ticker:'two'}]);for(const raw of urls){const url=new URL(raw);assert.equal(url.origin,'https://external-api.kalshi.com');assert.equal(url.pathname,'/trade-api/v2/portfolio/settlements');assert.equal(url.searchParams.get('subaccount'),'0');}assert.equal(new URL(urls[1]).searchParams.get('cursor'),'next');
});

test('Unfiltered activities retain deposits and no trade-only filter; unsupported Kalshi operation stays blocked',async()=>{const x=options([{activities:[{type:'ACTIVITY_TYPE_ACCOUNT_DEPOSIT'}],nextCursor:'',eof:true}]);assert.equal((await readAccountHistory('poly','activities',x.options)).records,1);assert.equal(new URL(x.urls[0]).searchParams.has('types'),false);await assert.rejects(readHistoryPage('kalshi','activities','',x.options));});

test('Funding pages permit omitted terminal cursor only below limit and retain exact GET paths',async()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const env={KALSHI_KEY_ID:'synthetic',KALSHI_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}).toString()};
 for(const operation of ['deposits','withdrawals'] as const){let count=1;const options={env,fetch:(async(url,init)=>{assert.equal(new URL(String(url)).pathname,'/trade-api/v2/portfolio/'+operation);assert.equal(init?.method,'GET');return new Response(JSON.stringify({[operation]:Array(count).fill({})}));}) as typeof fetch};assert.equal((await readAccountHistory('kalshi',operation,options)).records,1);count=100;await assert.rejects(readAccountHistory('kalshi',operation,options),/pagination/);}
 const p=options([]);await assert.rejects(readHistoryPage('poly','deposits','',p.options));assert.equal(p.urls.length,0);
});

test('Both transfer history operations are fixed GETs; short omitted cursors work and wrong venue is rejected',async()=>{const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const env={KALSHI_KEY_ID:'synthetic',KALSHI_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}).toString()};for(const [operation,path] of [['subaccountTransfers','subaccounts/transfers'],['intraAccountTransfers','intra_exchange_instance_transfers']] as const){const r=await readAccountHistory('kalshi',operation,{env,fetch:(async(url,init)=>{assert.equal(new URL(String(url)).pathname,'/trade-api/v2/portfolio/'+path);assert.equal(init?.method,'GET');return new Response(JSON.stringify({transfers:[]}));}) as typeof fetch});assert.equal(r.records,0);await assert.rejects(readHistoryPage('poly',operation,'',{env}));}});
