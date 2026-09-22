import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ksuPolicy,ksuScenarios,scopeReasons,assumedStatus,contractDifferences,admission,newSession,reserve,modelLeg,accountLeg,recoveryPlan,recover,accounting,conditionalPayout} from '../lib/arb/ksu-paper.ts';
import {quoteCandidate} from '../lib/screen/confirmation.ts';
import type {Book,Pair} from '../lib/arb/types.ts';
const retained=JSON.parse(readFileSync(new URL('../docs/research/contract-shortlist/retained-markets.json',import.meta.url),'utf8'));
const pair:Pair={id:'synthetic-KSU-scenario',a:retained.kalshi.find((m:any)=>m.id===ksuPolicy.kalshi),b:retained.poly.find((m:any)=>m.id===ksuPolicy.poly),inverted:false,reviewed:false};
const at=Date.parse('2026-09-22T12:00:00Z');
const constraints={kalshi:{tick:100,minimum:1},poly:{tick:100,minimum:0.01}};
const status={knownBlocked:false,reportedStatus:'active',reasons:['STATUS_CACHE_CURRENTNESS_UNPROVEN','NON_ATOMIC_INITIAL_STATE']};
// Synthetic economics, deliberately not a replay or a current market/fill claim.
const book=(price:number,side:'yes'|'no',quantity=10):Book=>({yes:[],no:[],yesBids:[{price:700,quantity:10}],noBids:[{price:7700,quantity:10}],[side]:[{price,quantity}],receivedAt:at,exchangeAt:at,open:true});
const a=()=>book(8000,'no'),b=()=>book(1000,'yes');
const quote=()=>quoteCandidate(pair,a(),b(),'no',at);
const setup=()=>{const s=newSession();reserve(s,pair,quote(),status,constraints,at,100);return s;};
test('scope never includes Kansas, reverse orientation, other conditional pairs or live admission',()=>{
  assert.deepEqual(scopeReasons(pair),[]);
  assert.ok(scopeReasons({...pair,b:{...pair.b,id:pair.b.id.replace('kanst','kan')}}).length);
  assert.ok(scopeReasons({...pair,inverted:true}).length);
  assert.equal(admission(pair,quote(),status,constraints,{kalshi:500000,poly:500000}).liveAdmitted,false);
  assert.equal(ksuPolicy.ordersEnabled,false);assert.equal(pair.reviewed,false);
  assert.equal(quote().additionalPolicyAdmission.admitted,false); // legacy long-horizon gate remains
  assert.ok(quote().additionalPolicyAdmission.blockers.includes('BASELINE_30_DAY_HORIZON'));
});
test('only explicit unresolved provenance may use the active assumption',()=>{
  assert.equal(assumedStatus(status).admitted,true);
  for(const s of [{...status,knownBlocked:true},{...status,reportedStatus:'closed'},...['BASELINE_LIFECYCLE_CONTRADICTION','LIFECYCLE_DISCONNECTED','STATUS_BASELINE_CACHED','CONTRACT_METADATA_CHANGED','LIFECYCLE_SEQUENCE_GAP_OR_REORDER'].map(r=>({...status,reasons:[r]}))])assert.equal(assumedStatus(s).admitted,false);
});
test('terms, identity, fees, quantity and horizon changes stop rather than extend approval',()=>{
  for(const field of ['title','rules','hash','closeAt','feeRate','minQty','identity'] as const){const changed=structuredClone(pair);(changed.b as any)[field]='changed';assert.match(contractDifferences(pair,changed).join(','),new RegExp('b.'+field));}
  assert.deepEqual(contractDifferences(pair,structuredClone(pair)),[]);
});
test('fresh quantity comparison chooses from legal whole depth without substituting after freeze',()=>{
  const q=quoteCandidate(pair,a(),book(1000,'yes',6),'no',at);assert.equal(q.quantity,6);
  const gone=quoteCandidate(pair,a(),book(1000,'yes',5),'no',at,6);assert.equal(gone.economics,null);
  assert.equal(admission(pair,q,status,{...constraints,poly:{tick:100,minimum:4}},{kalshi:500000,poly:500000}).admitted,false);
});
test('cash, risk and recovery are reserved before either independent submission',()=>{
  const s=setup(),e=quote().economics!;
  assert.deepEqual(s.held,e.venueReservedCash);assert.equal(s.state.positions.length,0);
  for(const v of ['kalshi','poly'] as const){assert.equal(s.state.cash[v]+s.held[v],500000);assert.ok(s.plan![v].recoveryBudget>0);assert.equal(s.plan![v].arrivalMono,600);}
  assert.throws(()=>reserve(s,pair,quote(),status,constraints,at,100));
  assert.equal(admission(pair,quote(),status,constraints,{kalshi:1,poly:500000}).admitted,false);
  const q=quote();q.economics!.reservedCash=120001;assert.equal(admission(pair,q,status,constraints,{kalshi:500000,poly:500000}).admitted,false);
});
test('positive exchange net alone cannot pass the separate risk, profit and ROI gates',()=>{
  const q=quoteCandidate(pair,book(8800,'no'),b(),'no',at);
  assert.equal(admission(pair,q,status,constraints,{kalshi:500000,poly:500000}).admitted,false);
});
test('neither leg fills instantaneously; absent arrival evidence stays inconclusive',()=>{
  const s=setup(),p=s.plan!.kalshi;
  assert.equal(modelLeg(p,pair.a,a(),[],false,at+499,599).outcome,'INCONCLUSIVE');
  const r=modelLeg(p,pair.a,undefined,['FEED_DISCONNECTED'],false,at+500,600);accountLeg(s,pair,'kalshi',r);
  assert.equal(accounting(s).unresolvedPossibleInventory,true);assert.equal(s.held.kalshi,p.reserved);
  assert.equal(recoveryPlan(s,1000),null);
});
test('adverse movement, insufficient depth and known closure do not fabricate FOK fills',()=>{
  const s=setup(),p=s.plan!.kalshi;
  for(const x of [book(8100,'no'),book(8000,'no',9)])assert.equal(modelLeg(p,pair.a,x,[],false,at+500,600).outcome,'NO_FILL');
  assert.equal(modelLeg(p,pair.a,a(),[],true,at+500,600).outcome,'NO_FILL');
});
test('one-leg failure retains inventory and independent debit; failed delayed recovery preserves it',()=>{
  const s=setup();accountLeg(s,pair,'kalshi',modelLeg(s.plan!.kalshi,pair.a,a(),[],false,at+500,600));
  accountLeg(s,pair,'poly',modelLeg(s.plan!.poly,pair.b,book(1100,'yes'),[],false,at+500,600));
  assert.equal(s.state.cash.poly,500000);assert.equal(s.state.positions[0].status,'unmatched');
  assert.equal(accounting(s).residualInventory.kalshi,10);
  const rp=recoveryPlan(s,1600)!;assert.equal(rp.arrivalMono,2100);
  recover(s,rp,pair.a,a(),['MISSING_ARRIVAL_BOOK'],at+2000,2100);
  assert.equal(accounting(s).residualInventory.kalshi,10);assert.equal(s.recoveryLoss,null);
  assert.throws(()=>recover(s,rp,pair.a,a(),[],at+2000,2100));
});
test('bounded delayed recovery records sell fees and realized loss separately',()=>{
  const s=newSession(),entryA=book(8600,'no'),entryB=book(400,'yes');
  reserve(s,pair,quoteCandidate(pair,entryA,entryB,'no',at),status,constraints,at,100);
  accountLeg(s,pair,'kalshi',modelLeg(s.plan!.kalshi,pair.a,entryA,[],false,at+500,600));
  accountLeg(s,pair,'poly',modelLeg(s.plan!.poly,pair.b,book(1100,'yes'),[],false,at+500,600));
  const rp=recoveryPlan(s,1600)!;const bk=a();bk.noBids=[{price:8500,quantity:10}];
  recover(s,rp,pair.a,bk,[],at+2000,2100);
  assert.ok(s.recoveryLoss!>0);assert.equal(accounting(s).residualInventory.kalshi,0);
  assert.equal(s.state.cash.kalshi+s.state.cash.poly,1000000-s.recoveryLoss!);
});
test('paired holding is conditional and unrealized; risk cash is not a fee or expense',()=>{
  const s=setup();for(const v of ['kalshi','poly'] as const)accountLeg(s,pair,v,modelLeg(s.plan![v],v==='kalshi'?pair.a:pair.b,v==='kalshi'?a():b(),[],false,at+500,600));
  const report=accounting(s);assert.equal(report.positions,1);assert.equal(report.realizedProfit,null);assert.ok(report.conditionalUnrealizedSurplus!>0);
  assert.equal(report.separateRiskAllowance,2000);assert.equal(s.state.expenses,0);
  const spent=s.state.positions[0].aDebit+s.state.positions[0].bDebit;
  assert.equal(s.state.cash.kalshi+s.state.cash.poly+s.held.kalshi+s.held.poly+spent,1000000);
  assert.equal(recoveryPlan(s,1600),null);assert.throws(()=>accountLeg(s,pair,'poly',s.results.poly!));
});
test('documented divergent payouts and lockups are separate synthetic scenarios',()=>{
  assert.equal(conditionalPayout(10,1,1),100000);assert.equal(conditionalPayout(10,0,0),100000);
  assert.equal(conditionalPayout(10,0.5,0.2),70000); // cancellation
  assert.equal(conditionalPayout(10,0,0.3),130000); // withdrawal/fair-price difference is directional
  assert.equal(conditionalPayout(10,1,0),0); // differing correction cutoff
  assert.equal(ksuScenarios.length,5);assert.match(JSON.stringify(ksuScenarios),/reinstatement|re-entry/i);
  assert.match(JSON.stringify(ksuScenarios),/not a guaranteed release/);
});
