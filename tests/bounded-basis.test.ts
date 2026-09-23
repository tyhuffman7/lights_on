import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pair,book} from './research-fixture.ts';
import {routeDimensions} from '../lib/research/family-settlement.ts';
import {proveRoute} from '../lib/research/family-route.ts';
import {catalogEntities} from '../lib/research/entities.ts';
import {boundedPolicy,practicalSettlement,quoteBounded,admitBounded,freezeCandidate,conservativeFee,prerequisiteReasons,reviewReasons,rankQuotes} from '../lib/pilot/bounded-basis.ts';
import {requireWatchPrerequisites,confirmBoundedCandidate} from '../worker/bounded-basis-confirmation.ts';
import {practicalAudit} from '../worker/practical-settlement-audit.ts';
import {observeBook} from '../lib/screen/confirmation.ts';
const ev={url:'https://example.test/official',sha256:'a'.repeat(64)};
function fixture(){
 const now=Date.now(),p=pair();
 const route={dimensions:Object.fromEntries(routeDimensions.map(k=>[k,{kalshi:k,poly:k,evidence:'Independent canonical predicates with reviewed rule evidence'}])),missingEvidence:[],conflicts:[]};
 const family={id:'test',documents:['K','P'],sourceBindings:{K:ev.sha256,P:ev.sha256},missingEvidence:[],ordinaryConflicts:[],divergences:[{id:'emergency',evidence:'Independent emergency refund versus fair-value settlement.'}],stateProofs:[]};
 const review={pairId:p.id,hashes:[p.a.hash,p.b.hash],productClasses:{kalshi:'economics',poly:'economics'},family,route,sources:{K:ev,P:ev},reviewedAt:now-1000,expiresAt:now+100000,expectedReleaseAt:now+3600000,lockupEvidence:ev,ordinaryState:{status:'NORMAL',checkedAt:now,evidence:ev},exceptions:[{id:'emergency',status:'CLEAR',checkedAt:now,evidence:ev}]};
 const accounts=Object.fromEntries(['kalshi','poly'].map(v=>[v,{accountBinding:v,observedAt:now,complete:true,reconciled:true,available:50000,openOrders:0,occupiedMarkets:[],unknownExposure:false,
  permission:{accountBinding:v,jurisdiction:'OH',productClasses:['economics'],tradingPermitted:true,writeCapability:true,checkedAt:now,expiresAt:now+100000,evidence:[ev]}}]));
 const input={accounts,lifetimeAttempts:0,pairedPositions:0,executionSequences:0,recoveryAttempts:0,realizedLoss:false,reusedProceeds:false,ledgerReconciled:true,ledgerEvidence:{url:'private://fixture-ledger',sha256:ev.sha256}};
 const fees={kalshi:{marketId:p.a.id,marketHash:p.a.hash,checkedAt:now,expiresAt:now+100000,source:ev,rate:700,model:'KALSHI_FRAGMENT_BOUND',balancePrecisionMicros:100,minFillHundredths:1},
 poly:{marketId:p.b.id,marketHash:p.b.hash,checkedAt:now,expiresAt:now+100000,source:ev,rate:695,model:'PM_CUMULATIVE'}};
 const books={kalshi:book('kalshi',p.a.id),poly:book('poly',p.b.id)};
 const quotes=quoteBounded(p as any,books as any,'yes',fees as any,review.expectedReleaseAt,now),q=quotes[0];
 const c={pairId:p.id,quantity:q.quantity,aSide:q.aSide,bSide:q.bSide,hashes:q.hashes,accepted:true,requestedAt:now-100,confirmedAt:now,evidenceSha256:ev.sha256,isolatedFeedsHealthy:true,marketStatusOpen:true,persistenceHealthy:true};
 return {p,review,input,fees,books,q,quotes,c,now};
}
const admit=(f:ReturnType<typeof fixture>)=>admitBounded(f.p as any,f.review as any,f.q,f.input as any,f.c,f.now);
test('practical taxonomy admits semantic equivalence and keeps every residual exceptional branch',()=>{
 const f=fixture();assert.equal(practicalSettlement(f.review.family,f.review.route as any).classification,'BOUNDED_BASIS');
 f.review.family.divergences=[];assert.equal(practicalSettlement(f.review.family,f.review.route as any).classification,'ECONOMICALLY_EQUIVALENT');
 for(const d of routeDimensions){const r=structuredClone(f.review.route);r.dimensions[d].poly='Different normal result';assert.equal(practicalSettlement(f.review.family,r as any).classification,'INCOMPATIBLE');}
 const r=structuredClone(f.review.route);delete r.dimensions.source;assert.equal(practicalSettlement(f.review.family,r as any).classification,'UNRESOLVED');
});
test('different ordinary prose for BLS month and threshold is semantic equivalence, not text identity',()=>{
 const {p,review}=fixture();p.a.id='KXU3-26SEP';p.b.id='urc-fixture';
 p.a.rules='If the seasonally adjusted unemployment rate (U-3) reported by the Bureau of Labor Statistics in the Employment Situation Report is above 3.7% in September 2026, then the market resolves to Yes.\nhttps://assets.kalshi.com/contract_terms/U3.pdf';
 p.b.rules='This market will settle to Yes if the U.S. seasonally adjusted unemployment rate (U-3) reported by the Bureau of Labor Statistics (BLS) in the Employment Situation Report for September 2026 is above 3.7%.';
 review.family.divergences=[];assert.equal(practicalSettlement(review.family,proveRoute(p as any,catalogEntities([]))).classification,'ECONOMICALLY_EQUIVALENT');
 p.b.rules=p.b.rules.replace('3.7','3.8');assert.equal(practicalSettlement(review.family,proveRoute(p as any,catalogEntities([]))).classification,'INCOMPATIBLE');
});
test('only ordinary proof and explicit clear exceptions admit; execution is always disabled',()=>{
 const f=fixture();assert.deepEqual(admit(f),{candidate:true,reasons:[],ordersEnabled:false});
 const frozen=freezeCandidate(f.p as any,f.review as any,f.q,f.input as any,f.c,f.now);assert.equal(frozen.approvalRequired,true);assert.equal(frozen.ordersEnabled,false);assert.equal(frozen.fillClaim,false);assert.deepEqual(frozen.residualSettlementMismatches,f.review.family.divergences);
 assert.equal('accounts' in frozen,false);assert.ok(frozen.quote.maxCommitted<=50000);
});
test('all affordable supported quantities, no legacy one-contract or ten-contract ceiling',()=>{
 const f=fixture();f.books.kalshi.yes=[{price:100,quantity:1000}];f.books.poly.no=[{price:100,quantity:1000}];
 const q=quoteBounded(f.p as any,f.books as any,'yes',f.fees as any,f.review.expectedReleaseAt,f.now);assert.ok(q.length>10);assert.ok(q.every(x=>x.maxCommitted<=50000));
 const quantities=q.map(x=>x.quantity).sort((a,b)=>a-b);assert.deepEqual(quantities,Array.from({length:quantities.at(-1)!},(_,i)=>i+1));
 const over=quoteBounded(f.p as any,f.books as any,'yes',f.fees as any,f.review.expectedReleaseAt,f.now,quantities.at(-1)!+1);assert.equal(over.length,0);
});
test('strictly positive surplus below old two-cent cushion remains eligible',()=>{
 const f=fixture();f.books.kalshi.yes=[{price:4700,quantity:1}];f.books.poly.no=[{price:4800,quantity:1}];
 f.q=quoteBounded(f.p as any,f.books as any,'yes',f.fees as any,f.review.expectedReleaseAt,f.now,1)[0];f.c.quantity=1;
 assert.ok(f.q.feeNetProfit>0&&f.q.feeNetProfit<200);assert.equal(admit(f).candidate,true);
 assert.equal(f.q.feeNetProfit,10000-f.q.entryDebit);assert.equal(f.q.maxCommitted,f.q.entryDebit+f.q.recoveryCash);
});
test('swept depth reserves last-level limit price and maximum fee, not favorable VWAP',()=>{
 const f=fixture();f.books.kalshi.yes=[{price:1000,quantity:1},{price:6000,quantity:1}];f.books.poly.no=[{price:2000,quantity:2}];
 const q=quoteBounded(f.p as any,f.books as any,'yes',f.fees as any,f.review.expectedReleaseAt,f.now,2)[0];
 assert.equal(q.kalshi.cost,7000);assert.ok(q.kalshi.maxDebit>=12000);assert.ok(q.kalshi.maximumFeeUpper>=q.kalshi.feeUpper);
});
test('unknown Kalshi precision uses cent upper bound and never silently inherits direct-member rates',()=>{
 const f=fixture(),levels=[{price:5000,quantity:1}];const direct=conservativeFee(levels,f.fees.kalshi as any);
 const unknown=conservativeFee(levels,{...f.fees.kalshi,balancePrecisionMicros:10000} as any);assert.ok(unknown>direct);assert.ok(unknown>=10000);
 delete (f.fees.kalshi as any).balancePrecisionMicros;assert.deepEqual(quoteBounded(f.p as any,f.books as any,'yes',f.fees as any,f.review.expectedReleaseAt,f.now),[]);
});
test('fee upper covers adversarial fractional fills even with zero rebates',()=>{
 const f=fixture();for(const precision of [100,10000])for(const price of [100,3333,5000,9999]){
  const spec={...f.fees.kalshi,balancePrecisionMicros:precision};const upper=conservativeFee([{price,quantity:3}],spec as any)*100;
  let exact=0;for(let i=0;i<300;i++){const model=Math.ceil(price*(10000-price)*700/100000000);const revenue=price;const charge=Math.ceil((revenue+model)/precision)*precision-revenue;exact+=charge;}assert.ok(upper>=exact,`${precision}/${price}`);
 }
});
test('expired, unknown, incorrectly bound or indicated exceptional evidence blocks',()=>{
 for(const change of [(f:any)=>f.review.exceptions[0].status='INDICATED',(f:any)=>f.review.exceptions[0].status='UNKNOWN',
  (f:any)=>f.review.exceptions=[],(f:any)=>f.review.exceptions.push({...f.review.exceptions[0]}),(f:any)=>f.review.exceptions[0].checkedAt-=60001,
  (f:any)=>f.review.ordinaryState.status='UNKNOWN',(f:any)=>f.review.hashes[0]='changed',(f:any)=>f.review.sources.K.sha256='b'.repeat(64),(f:any)=>f.review.expiresAt=f.now,
  (f:any)=>f.review.route.dimensions.threshold.poly='gt:46.6']){const f=fixture();f.review.sources=structuredClone(f.review.sources);change(f);assert.equal(admit(f).candidate,false);}
});
test('all pre-pilot gates fail closed without requiring a previous successful live fill',()=>{
 const changes=[(f:any)=>f.input.accounts.poly.permission.tradingPermitted=false,(f:any)=>f.input.accounts.poly.permission.writeCapability=false,
  (f:any)=>f.input.accounts.kalshi.permission.productClasses=['sports'],(f:any)=>f.input.accounts.kalshi.permission.jurisdiction='NV',
  (f:any)=>f.input.accounts.kalshi.permission.accountBinding='other',(f:any)=>f.input.accounts.kalshi.permission.expiresAt=f.now,
  (f:any)=>f.input.accounts.kalshi.observedAt=f.now-5001,(f:any)=>f.input.accounts.poly.complete=false,
  (f:any)=>f.input.accounts.kalshi.unknownExposure=true,(f:any)=>f.input.accounts.kalshi.openOrders=1,
  (f:any)=>f.input.accounts.poly.occupiedMarkets=[f.p.b.id],(f:any)=>f.input.accounts.poly.available=0,
  (f:any)=>f.input.lifetimeAttempts=1,(f:any)=>f.input.pairedPositions=1,(f:any)=>f.input.recoveryAttempts=1,
  (f:any)=>f.input.realizedLoss=true,(f:any)=>f.input.reusedProceeds=true,(f:any)=>f.input.ledgerReconciled=false];
 for(const change of changes){const f=fixture();change(f);assert.equal(admit(f).candidate,false);}
 assert.equal(admit(fixture()).candidate,true);
});
test('requested proof, quantity, quote integrity, feeds and market status cannot be substituted',()=>{
 for(const change of [(f:any)=>f.c.accepted=false,(f:any)=>f.c.quantity--,(f:any)=>f.c.confirmedAt-=2001,
  (f:any)=>f.c.aSide='no',(f:any)=>f.c.evidenceSha256='',(f:any)=>f.c.isolatedFeedsHealthy=false,
  (f:any)=>f.c.marketStatusOpen=false,(f:any)=>f.c.persistenceHealthy=false,(f:any)=>f.q.feeNetProfit++,
  (f:any)=>f.q.maxCommitted=50001,(f:any)=>f.q.kalshi.feeUpper=-100]){const f=fixture();change(f);assert.equal(admit(f).candidate,false);}
});
test('watch prerequisites reject unresolved permission before network setup',()=>{
 const f=fixture();requireWatchPrerequisites([{pair:f.p as any,review:f.review as any}],f.input as any,f.now);
 f.input.accounts.poly.permission.tradingPermitted=false;assert.throws(()=>requireWatchPrerequisites([{pair:f.p as any,review:f.review as any}],f.input as any,f.now),/CURRENT_OHIO_PRODUCT_TRADING_PERMISSION_REQUIRED/);
});
test('ranking is dollar fee-net profit then efficiency then shorter lockup',()=>{
 const {q}=fixture();const values=[{...q,pairId:'later',feeNetProfit:100,returnOnCommitted:0.1,expectedReleaseAt:20},
 {...q,pairId:'sooner',feeNetProfit:100,returnOnCommitted:0.1,expectedReleaseAt:10},{...q,pairId:'dollars',feeNetProfit:200,returnOnCommitted:0.01}];
 assert.deepEqual(values.sort(rankQuotes).map(x=>x.pairId),['dollars','sooner','later']);
});
test('historical route evidence is pinned; recounting cannot add a route or erase a conflict',()=>{
 const {review}=fixture(),rows=[{family:'test',proof:review.route}],old={candidateRoutes:1,routeAuditSha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
 assert.equal(practicalAudit(rows as any,old,{records:[review.family]}).totals.BOUNDED_BASIS,1);
 assert.throws(()=>practicalAudit([...rows,...rows] as any,old,{records:[review.family]}),/CHANGED/);
});
test('new policy and adapter have no submission path; old build gate remains disabled',()=>{
 const cfg=JSON.parse(readFileSync(new URL('../config/tiny-live-bounded-basis.disabled.json',import.meta.url),'utf8'));
 for(const key of ['ordersEnabled','checkpointAllowsOrders','authorization','maxCommitted','maxPositions','maxEntryAttempts','maxRecoveryAttempts','reuseProceeds','stopOnUnknown','stopOnRealizedLoss','admissionCushion'])assert.equal(cfg[key],(boundedPolicy as any)[key]);
 for(const file of ['../lib/pilot/bounded-basis.ts','../worker/bounded-basis-confirmation.ts'])assert.doesNotMatch(readFileSync(new URL(file,import.meta.url),'utf8'),/from ['"].*(live-adapter|live-ledger|paper-store)/);
});
function confirmationFixture(f:ReturnType<typeof fixture>){
 const at=Date.now(),mono=performance.now();
 const receipt=(venue:'kalshi'|'poly')=>{const b={...f.books[venue],receivedAt:at,receivedMono:mono,sequence:2};
  const e=observeBook(b as any,undefined,'orderbook_snapshot',at,mono);
  return {e,messageType:venue==='kalshi'?'orderbook_snapshot':'marketData',sid:1,requestId:'requested',transactTime:new Date(at).toISOString()};};
 const k=receipt('kalshi'),p=receipt('poly'),health=()=>({connected:true,clockOkay:true,backlog:0});
 const proof=(venue:'kalshi'|'poly',response:any)=>({request:{venue,marketId:response.e.book.marketId,at:at-5,mono:mono-5,kind:venue==='kalshi'?'get_snapshot':'new_subscription',requestId:'requested',sid:1,beforeSequence:1},response,reasons:[]});
 const feeds={kalshi:{latest:new Map([[f.p.a.id,k]]),health,confirmKalshi:async()=>proof('kalshi',k)},poly:{latest:new Map([[f.p.b.id,p]]),health}};
 const requestPoly=async()=>proof('poly',p);return {feeds,requestPoly,k,p};
}
test('requested confirmation uses isolated feeds and freezes the original quantity',async()=>{
 const f=fixture(),x=confirmationFixture(f),records:any[]=[];
 const result=await confirmBoundedCandidate(f.p as any,f.q,f.review as any,f.fees as any,x.feeds as any,()=>({admitted:true}),async()=>f.input as any,(kind,body)=>records.push({kind,body}),{isolated:true,persistenceHealthy:()=>true,stopped:()=>false},x.requestPoly as any);
 assert.equal(result.status,'EDGE_SURVIVED');assert.ok(result.candidate);assert.equal(result.candidate.quote.quantity,f.q.quantity);assert.equal(result.candidate.ordersEnabled,false);assert.equal(records[0].kind,'BOUNDED_REQUESTED_BOOK_PROOF');
});
test('requested confirmation cannot downsize to a profitable remainder or reuse changed fee evidence',async()=>{
 for(const change of ['depth','fees','status','stop','nonisolated']){
  const f=fixture();if(change==='depth')f.books.poly.no[0].quantity=f.q.quantity-1;if(change==='fees')f.fees.poly.rate++;
  const x=confirmationFixture(f);const result=await confirmBoundedCandidate(f.p as any,f.q,f.review as any,f.fees as any,x.feeds as any,()=>({admitted:change!=='status'}),async()=>f.input as any,()=>{},
   {isolated:change!=='nonisolated',persistenceHealthy:()=>true,stopped:()=>change==='stop'},x.requestPoly as any);
  assert.equal(result.candidate,null,change);
 }
});
test('confirmed economics that turn zero or negative are not a surviving candidate',async()=>{
 const f=fixture();f.books.poly.no[0].price=6200;const x=confirmationFixture(f);
 const result=await confirmBoundedCandidate(f.p as any,f.q,f.review as any,f.fees as any,x.feeds as any,()=>({admitted:true}),async()=>f.input as any,()=>{},
 {isolated:true,persistenceHealthy:()=>true,stopped:()=>false},x.requestPoly as any);
 assert.equal(result.candidate,null);
});

test('fractional visible levels combine into a legal whole paired order without truncating depth',()=>{
 const f=fixture();f.books.kalshi.yes=[{price:4000,quantity:0.6},{price:4100,quantity:0.4}];f.books.poly.no=[{price:4000,quantity:1}];
 const q=quoteBounded(f.p as any,f.books as any,'yes',f.fees as any,f.review.expectedReleaseAt,f.now,1)[0];assert.ok(q);assert.equal(q.quantity,1);assert.deepEqual(q.kalshi.levels,f.books.kalshi.yes);assert.equal(q.kalshi.cost,4040);assert.ok(q.feeNetProfit>0);
 f.books.kalshi.yes[1].quantity=0.39;assert.equal(quoteBounded(f.p as any,f.books as any,'yes',f.fees as any,f.review.expectedReleaseAt,f.now,1).length,0);
});
