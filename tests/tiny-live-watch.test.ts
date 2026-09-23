import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {liveAdmission,settlementDimensions,dormantPilot} from '../lib/pilot/live-admission.ts';
import {quoteCandidate} from '../lib/screen/confirmation.ts';
import {watchPolicy,watchManifest} from '../worker/tiny-live-watch.ts';
import {pair,book} from './research-fixture.ts';
function fixture(){
 const p=pair(),now=Date.now(),q=quoteCandidate(p,book('kalshi',p.a.id),book('poly',p.b.id),'yes',now,1);
 const r={pairId:p.id,classification:'LIVE_EQUIVALENT',ordinaryOnly:false,reviewedAt:now-100,expiresAt:now+10000,marketHashes:{kalshi:p.a.hash,poly:p.b.hash},dimensions:Object.fromEntries(settlementDimensions.map(d=>[d,'MATCH'])),sources:[{url:'https://example.test/k',sha256:'a'.repeat(64)},{url:'https://example.test/p',sha256:'b'.repeat(64)}],reasons:[]};
 const i={confirmed:true,confirmationAt:now,marketStatusOpen:true,expectedReleaseAt:now+86400000,ohioEligible:true,accountReady:true,accountAt:now,feesValidated:true,unresolvedInventory:false,unresolvedExecution:false,isolatedFeedsHealthy:true,persistenceHealthy:true,realizedLoss:false};return {p,q,r,i,now};
}
test('fully evidenced synthetic future candidate can pass admission while order gate remains false',()=>{const {p,q,r,i,now}=fixture();const result=liveAdmission(p,r as any,q,i,now);assert.deepEqual(result.reasons,[]);assert.equal(result.admitted,true);assert.equal(result.ordersEnabled,false);});
for(const [key,value]of Object.entries({confirmed:false,confirmationAt:0,accountAt:0,marketStatusOpen:false,expectedReleaseAt:NaN,ohioEligible:false,accountReady:false,feesValidated:false,unresolvedInventory:true,unresolvedExecution:true,isolatedFeedsHealthy:false,persistenceHealthy:false,realizedLoss:true,maxCommitted:50001}))test(`live admission fails closed for ${key}`,()=>{const {p,q,r,i,now}=fixture();assert.equal(liveAdmission(p,r as any,q,{...i,[key]:value},now).admitted,false);});
test('watch is single bounded, exact quantity, no-order and freezes every runtime source',()=>{
 assert.equal(watchPolicy.durationMs,20*60*1000);assert.equal(watchPolicy.quantity,1);assert.equal(watchPolicy.ordersEnabled,false);assert.equal(dormantPilot.ordersEnabled,false);assert.equal(watchPolicy.maxRoutes,32);
 const manifest=watchManifest(process.cwd());for(const f of ['worker/tiny-live-watch.ts','worker/segmented-evidence.ts','worker/streams.ts','worker/book-confirmation-adapter.ts','lib/pilot/live-admission.ts'])assert.match(manifest[f],/^[a-f0-9]{64}$/);
 const source=readFileSync('worker/tiny-live-watch.ts','utf8');assert(!source.includes("from '../lib/pilot/live-adapter"));assert(!source.includes('paper-store'));
});
test('every public retained route is explicitly classified; conditional evidence is not promoted',()=>{
 const review=JSON.parse(readFileSync('docs/pilot/tiny-live-settlement-review-20260923.json','utf8'));assert.equal(review.routes.length,26);assert.equal(new Set(review.routes.map((r:any)=>r.pairId)).size,26);
 for(const r of review.routes){assert(['LIVE_EQUIVALENT','LIVE_BLOCKED','UNRESOLVED'].includes(r.classification));assert.equal(r.classification==='LIVE_EQUIVALENT',false);assert(r.sources.length>=2);assert(r.reasons.length>0);}
});
