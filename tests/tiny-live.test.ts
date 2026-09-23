import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify,constants,createHash} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {constructLiveOrder,signOrderDraft,interpretLiveReply,DisabledLiveAdapter,validateOrderDraft,collectLiveReply} from '../lib/pilot/live-adapter.ts';
import {LiveLedger,validateFrozenPlan} from '../lib/pilot/live-ledger.ts';
import {liveAdmission,liveSettlementReasons,dormantPilot,settlementDimensions} from '../lib/pilot/live-admission.ts';
import {pair,book} from './research-fixture.ts';
import {quoteCandidate} from '../lib/screen/confirmation.ts';
const draft=(venue:'kalshi'|'poly',side:'yes'|'no'='yes',action:'buy'|'sell'='buy')=>constructLiveOrder({venue,marketId:venue==='kalshi'?'K-fixture':'p-fixture',side,quantity:1,limitPrice:4100},{marketId:venue==='kalshi'?'K-fixture':'p-fixture',tick:100,minimumQuantity:1,exchangeIndex:0},`${venue}-${side}-${action}`,action);
const plan=()=>({pairId:'fixture',quantity:1 as const,maxCommitted:50000,admissionEvidenceSha256:'a'.repeat(64),entry:[{draft:draft('kalshi'),feeUpper:300},{draft:draft('poly','no'),feeUpper:100}] as [{draft:ReturnType<typeof draft>;feeUpper:number},{draft:ReturnType<typeof draft>;feeUpper:number}],recovery:{draft:draft('kalshi','yes','sell'),feeUpper:300}});
for(const venue of ['kalshi','poly'] as const)for(const side of ['yes','no'] as const)for(const action of ['buy','sell'] as const)test(`exact ${venue} ${side} ${action} outbound FOK payload`,()=>{
 const d=draft(venue,side,action),price=side==='yes'?'0.4100':'0.5900';
 assert.equal(d.method,'POST');
 assert.deepEqual(d.body,venue==='kalshi'?{ticker:'K-fixture',client_order_id:`${venue}-${side}-${action}`,side:(side==='yes')===(action==='buy')?'bid':'ask',count:'1.00',price,time_in_force:'fill_or_kill',self_trade_prevention_type:'taker_at_cross',post_only:false,cancel_order_on_pause:true,reduce_only:action==='sell',subaccount:0,exchange_index:0}:{marketSlug:'p-fixture',type:'ORDER_TYPE_LIMIT',price:{value:price,currency:'USD'},quantity:1,tif:'TIME_IN_FORCE_FILL_OR_KILL',intent:`ORDER_INTENT_${action.toUpperCase()}_${side==='yes'?'LONG':'SHORT'}`,participateDontInitiate:false,manualOrderIndicator:'MANUAL_ORDER_INDICATOR_AUTOMATIC',synchronousExecution:true,maxBlockTime:'2'});
 assert.equal(d.url,venue==='kalshi'?'https://external-api.kalshi.com/trade-api/v2/portfolio/events/orders':'https://api.polymarket.us/v1/orders');
});
test('tick, minimum/increment, exact quantity and PM absolute bounds cannot be rounded into an order',()=>{
 const d=draft('poly');for(const mutate of [(x:any)=>x.leg.quantity=2,(x:any)=>x.leg.limitPrice=4101,(x:any)=>x.metadata.minimumQuantity=.3,(x:any)=>{x.leg.limitPrice=50;x.metadata.tick=50;}]){const x=structuredClone(d);mutate(x);assert.throws(()=>constructLiveOrder(x.leg,x.metadata,x.localId));}
 const x=draft('kalshi');(x.body as any).count='100.00';assert.throws(()=>validateOrderDraft(x),/CHANGED/);
});
test('current RSA-PSS and Ed25519 signatures cover timestamp + POST + exact path using generated keys only',()=>{
 const k=generateKeyPairSync('rsa',{modulusLength:2048}),p=generateKeyPairSync('ed25519'),at=1790150000000;
 for(const venue of ['kalshi','poly'] as const){const d=draft(venue),key=venue==='kalshi'?k:p;
  const secret=venue==='kalshi'?k.privateKey.export({type:'pkcs8',format:'pem'}).toString():p.privateKey.export({type:'pkcs8',format:'der'}).subarray(-32).toString('base64');
  const h=signOrderDraft(d,{keyId:'synthetic-key',secret},at),signature=Buffer.from(h[venue==='kalshi'?'KALSHI-ACCESS-SIGNATURE':'X-PM-Signature']!,'base64');
  assert(verify(venue==='kalshi'?'sha256':null,Buffer.from(at+'POST'+d.path),venue==='kalshi'?{key:key.publicKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}:key.publicKey,signature));
  assert(!verify(venue==='kalshi'?'sha256':null,Buffer.from(at+'GET'+d.path),venue==='kalshi'?{key:key.publicKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}:key.publicKey,signature));
 }
});
const kReply={order_id:'k-fixture-id',fill_count:'1.00',remaining_count:'0.00',average_fill_price:'0.4100',average_fee_paid:'0.012345',ts_ms:1790150000000};
function pReply(state='ORDER_STATE_FILLED',filled=1){return {id:'p-fixture-id',executions:[{id:'execution-1',transactTime:'2026-09-23T10:00:00Z',order:{id:'p-fixture-id',marketSlug:'p-fixture',intent:'ORDER_INTENT_BUY_SHORT',quantity:1,cumQuantity:filled,leavesQuantity:0,state,commissionNotionalTotalCollected:{value:filled?'0.001234':'0',currency:'USD'},avgPx:{value:'0.5900',currency:'USD'}}}]};}
test('actual returned fee precision and both venue terminal states remain distinct from acknowledgements',()=>{
 const k=interpretLiveReply(draft('kalshi'),201,kReply);assert.equal(k.state,'fill');assert.equal(k.feeMicros,12345);
 assert.equal(interpretLiveReply(draft('kalshi'),201,{order_id:'k-fixture-id',fill_count:'0.00',remaining_count:'0.00',ts_ms:1790150000000}).state,'no-fill');
 const p=interpretLiveReply(draft('poly','no'),200,pReply());assert.equal(p.state,'fill');assert.equal(p.feeMicros,1234);
 assert.equal(interpretLiveReply(draft('poly','no'),200,pReply('ORDER_STATE_REJECTED',0)).state,'rejected');
 assert.equal(interpretLiveReply(draft('poly','no'),200,pReply('ORDER_STATE_CANCELED',0)).state,'no-fill');
 assert.equal(interpretLiveReply(draft('poly','no'),200,{id:'ack-only'}).state,'unknown');
});
test('timeouts, 4xx/5xx, partial FOK, off-limit fills and contradictory order identities all remain unknown',()=>{
 for(const raw of [{...kReply,fill_count:'0.50'},{...kReply,remaining_count:'1.00'},{...kReply,average_fill_price:'0.42'},{...kReply,client_order_id:'wrong'},{}])assert.equal(interpretLiveReply(draft('kalshi'),201,raw).state,'unknown');
 for(const status of [400,409,429,500])assert.equal(interpretLiveReply(draft('kalshi'),status,kReply).state,'unknown');
 const bad=pReply();bad.executions[0].order.marketSlug='another';assert.equal(interpretLiveReply(draft('poly','no'),200,bad).state,'unknown');
 assert.equal(interpretLiveReply(draft('poly','no'),200,pReply('ORDER_STATE_PARTIALLY_FILLED',.5)).state,'unknown');
});
const temporary=()=>mkdtempSync(join(tmpdir(),'tiny-live-'));
const retainedProof={orderAndFillEvidence:{synthetic:true,order:'fixture',fills:[]},evidenceSha256:createHash('sha256').update(JSON.stringify({synthetic:true,order:'fixture',fills:[]})).digest('hex')};
test('malformed and oversized replies retain their received evidence and timings while failing closed',async()=>{
 const malformed=await collectLiveReply(draft('poly'),new Response('not-json',{status:503}),Date.now(),performance.now());assert.equal(malformed.state,'unknown');assert.equal((malformed.raw as any).responseText,'not-json');assert.equal((malformed.raw as any).transport.status,503);
 const large=await collectLiveReply(draft('kalshi'),new Response('x'.repeat(1024*1024+1)),Date.now(),performance.now());assert.equal(large.state,'unknown');assert.equal((large.raw as any).truncated,true);assert.equal((large.raw as any).responseText.length,1024*1024);
});
test('hard disabled adapter rejects forged arming before credentials, revalidation, network or ledger access',async()=>{
 let called=0;const adapter=new DisabledLiveAdapter(),original=globalThis.fetch;globalThis.fetch=async()=>{called++;throw Error('MUST_NOT_SEND');};
 try{await assert.rejects(adapter.submit('first',null as any,{ordersEnabled:true,planSha256:'a',authorization:{userAuthorizedAt:1,expiresAt:Date.now()+10000,planSha256:'a',reference:'forged'}},()=>{called++;throw Error();},async()=>{called++;return true;}),/HARD_DISABLED/);assert.equal(called,0);assert.equal(adapter.ordersEnabled,false);assert.equal(dormantPilot.ordersEnabled,false);}finally{globalThis.fetch=original;}
});
function filled(l:LiveLedger,slot:'first'|'second'|'recovery',state:'fill'|'no-fill'='fill'){
 const d=l.request(slot),id=d.venue+'-id';l.receipt({state,orderId:id,filled:state==='fill'?1:0,feeMicros:0,raw:{synthetic:true},reason:'fixture'});
 l.reconcile({state,orderId:id,quantity:state==='fill'?1:0,feeMicros:0,cashFlowMicros:state==='fill'?(slot==='recovery'?400000:-410000):0,...retainedProof});
}
test('one paired attempt is durable, cannot overlap or reuse proceeds, and remains spent after reopening',()=>{
 const dir=temporary();let l=new LiveLedger(dir);try{
  l.reserve(plan());assert.throws(()=>new LiveLedger(dir));assert.throws(()=>l.request('second'));filled(l,'first');filled(l,'second');assert.equal(l.view().phase,'PAIRED');assert.throws(()=>l.reserve(plan()));l.close();l=new LiveLedger(dir);assert.equal(l.view().attempts,1);assert.throws(()=>l.reserve(plan()));
 }finally{l.close();rmSync(dir,{recursive:true,force:true});}
});
test('one-sided known fill permits only one reducing recovery; unknown or loss stops everything',()=>{
 const dir=temporary();const l=new LiveLedger(dir);try{l.reserve(plan());filled(l,'first');filled(l,'second','no-fill');assert.equal(l.view().phase,'RECOVERY_REQUIRED');filled(l,'recovery');assert.equal(l.view().recoveryAttempts,1);assert.throws(()=>l.request('recovery'));assert.equal(l.view().phase,'LOSS');assert.equal(l.view().realizedPnlMicros,-10000);assert.throws(()=>l.request('first'));}finally{l.close();rmSync(dir,{recursive:true,force:true});}
});
test('process death after intent, missing receipt, and unknown response never authorize a duplicate order',()=>{
 const dir=temporary();let l=new LiveLedger(dir);try{l.reserve(plan());l.request('first');l.close();l=new LiveLedger(dir);assert.equal(l.view().phase,'UNKNOWN');assert.throws(()=>l.request('first'));assert.throws(()=>l.request('recovery'));}finally{l.close();rmSync(dir,{recursive:true,force:true});}
});
test('oversize caps, changed wire quantity and excess actual debit fail closed',()=>{
 const p=plan();p.maxCommitted=50001;assert.throws(()=>validateFrozenPlan(p));p.maxCommitted=5000;assert.throws(()=>validateFrozenPlan(p));p.maxCommitted=50000;p.entry[0].draft.body.count='100.00';assert.throws(()=>validateFrozenPlan(p));
 const dir=temporary(),l=new LiveLedger(dir);try{l.reserve(plan());l.request('first');l.receipt({state:'fill',orderId:'k',filled:1,feeMicros:0,raw:{},reason:'fixture'});l.reconcile({state:'fill',orderId:'k',quantity:1,feeMicros:0,cashFlowMicros:-500000,...retainedProof});assert.equal(l.view().phase,'UNKNOWN');}finally{l.close();rmSync(dir,{recursive:true,force:true});}
});
test('live settlement cannot promote conditional terms, stale reviews or changed metadata',()=>{
 const p=pair(),now=Date.now(),review={pairId:p.id,classification:'LIVE_EQUIVALENT' as const,ordinaryOnly:false,reviewedAt:now-1000,expiresAt:now+1000,marketHashes:{kalshi:p.a.hash,poly:p.b.hash},dimensions:Object.fromEntries(settlementDimensions.map(k=>[k,'MATCH'])) as any,reasons:[],sources:[{url:'https://example.test/k',sha256:'a'.repeat(64)},{url:'https://example.test/p',sha256:'b'.repeat(64)}]};
 assert.deepEqual(liveSettlementReasons(p,review,now),[]);assert(liveSettlementReasons(p,{...review,ordinaryOnly:true},now).length);assert(liveSettlementReasons(p,{...review,expiresAt:now},now).length);assert(liveSettlementReasons(p,{...review,dimensions:{...review.dimensions,void:'UNKNOWN'}},now).length);assert(liveSettlementReasons(p,{...review,classification:'LIVE_BLOCKED'},now).length);
 const q=quoteCandidate(p,book('kalshi',p.a.id,now),book('poly',p.b.id,now), 'yes',now,1);
 const r=liveAdmission(p,review,q,{confirmed:true,confirmationAt:now,marketStatusOpen:true,expectedReleaseAt:now+10000,ohioEligible:false,accountReady:false,accountAt:0,feesValidated:false,unresolvedInventory:true,unresolvedExecution:true,isolatedFeedsHealthy:false,persistenceHealthy:true,realizedLoss:false},now);
 assert.equal(r.admitted,false);assert(r.reasons.includes('OHIO_ELIGIBILITY_NOT_REVALIDATED'));assert(r.reasons.includes('UNRESOLVED_EXPOSURE'));assert(r.reasons.includes('ISOLATED_EXECUTION_FEEDS_UNHEALTHY'));
});
