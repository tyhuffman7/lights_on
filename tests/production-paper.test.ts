import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MultiPaper,reviewedRows,marginScenarios} from '../lib/arb/multi-paper.ts';
import type {ReviewRow,InitialJournal} from '../lib/arb/multi-paper.ts';
import {StrategyPaper,ShadowCollector,challengerSeed,economics,rankOpportunities,horizon,sessionPolicy,shadowSignature,materiallyChanged,executionClass,arrivalMovement} from '../lib/arb/production-paper.ts';
import {quoteCandidate} from '../lib/screen/confirmation.ts';
import {modelLeg,accountLeg,recoveryPlan,recover} from '../lib/arb/ksu-paper.ts';
import type {Book,Pair,Venue} from '../lib/arb/types.ts';
const read=(p:string)=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const review=read('../docs/research/contract-shortlist/review.json'),markets=read('../docs/research/contract-shortlist/retained-markets.json'),rows=reviewedRows(review),at=Date.parse('2026-09-22T17:00:00Z');
const status={knownBlocked:false,reportedStatus:'active',reasons:[]},c={kalshi:{tick:100,minimum:1},poly:{tick:10,minimum:1}};
const pair=(r:ReviewRow):Pair=>({id:r.pairId,a:markets.kalshi.find((m:any)=>m.id===r.kalshiId),b:markets.poly.find((m:any)=>m.id===r.polyId),inverted:false,reviewed:false});
// Every book here is SYNTHETIC, never collection evidence.
const book=(side:'yes'|'no',price:number,n=10):Book=>({yes:[],no:[],yesBids:[{price:price-100,quantity:n}],noBids:[{price:price-100,quantity:n}],[side]:[{price,quantity:n}],receivedAt:at,exchangeAt:at,open:true});
const books=(r:ReviewRow,k=1100,p=8600,n=10)=>({kalshi:book(r.sides.kalshi,k,n),poly:book(r.sides.poly,p,n)});
const quote=(r:ReviewRow,b:Record<Venue,Book>,n=10)=>quoteCandidate(pair(r),b.kalshi,b.poly,r.sides.kalshi,at,n);
async function enter(p:MultiPaper,r:ReviewRow,b:Record<Venue,Book>,q=quote(r,b)){return p.execute(r,pair(r),q,async()=>({quote:q,status,constraints:c,reasons:[]}),async s=>{for(const v of ['kalshi','poly'] as const)accountLeg(s,pair(r),v,modelLeg(s.plan![v],v==='kalshi'?pair(r).a:pair(r).b,b[v],[],false,at+500,600));},()=>at,()=>100,()=>true);}
async function seed():Promise<InitialJournal>{const p=new MultiPaper(review,marginScenarios[1]);for(const [id,k,b,n] of [['KXDWTSRANK-226DEC31-JSTIL',800,8700,7],['KXNCAAFPAC12-26-ORST',1100,8600,10]] as const){const r=rows.authorized.find(r=>r.kalshiId===id)!,bs=books(r,k,b,n);await enter(p,r,bs,quote(r,bs,n));}return structuredClone({portfolio:p.summary(),entries:p.entries});}
test('zero-margin strategy inherits Julia and Oregon exactly, without another debit or capital reset',async()=>{
 const initial=await seed(),before=structuredClone(initial),p=new StrategyPaper(review,initial);
 assert.deepEqual(p.cash,{kalshi:478300,poly:341500});assert.equal(p.commitment(),180200);assert.equal(p.openPositions(),2);assert.equal(p.newAttempts(),0);
 assert.deepEqual(p.entries,initial.entries);assert.deepEqual(p.summary().holdings.map(h=>h.conditionalUnrealizedSurplus),[2200,1200]);
 const selected=challengerSeed({alternativeScenariosNeverAdditive:true,scenarios:[{scenario:marginScenarios[1],...initial}]});assert.deepEqual(selected,initial);
 assert.throws(()=>challengerSeed({scenarios:[initial]}),/SEED/);assert.deepEqual(initial,before);
});
test('strict fee-positive admission retains all risk/recovery cash; zero and negative fee-net values fail',async()=>{
 const p=new StrategyPaper(review,await seed()),r=rows.authorized.find(r=>r.kalshiId.includes('CWS'))!,b=books(r,100,9700,1),q=quote(r,b,1),e=economics(q);
 assert.equal(e.feeNetSurplus,100);assert.equal(e.reservedRiskCash,200);assert.equal(e.conditionalSurplusNetOfAnalyticalRisk,-100);
 assert.equal(p.gates(r,pair(r),q,status,c).length,0);await enter(p,r,b,q);
 const s=p.entries.at(-1)!.session;assert.deepEqual(s.held,{kalshi:200,poly:600});assert.equal(p.openPositions(),3);assert.equal(p.stopReason(),'THREE_OPEN_POSITIONS');
 for(const price of [9800,9900]){const other=new StrategyPaper(review,await seed());assert.ok(other.gates(r,pair(r),quote(r,books(r,100,price,1),1),status,c).length);}
 assert.equal(p.cash.kalshi+p.cash.poly+p.commitment(),1000000);
});
test('cash, total commitment, exact quantity and confirmation gates still constrain zero-margin mode',async()=>{
 const p=new StrategyPaper(review,await seed()),r=rows.authorized[0],b=books(r),q=quote(r,b);
 p.cash.poly=q.economics!.poly.cost+q.economics!.poly.feeBound;assert.ok(p.gates(r,pair(r),q,status,c).includes('poly_CASH'));
 p.cash.poly=500000;p.commitment=()=>445000;assert.equal(p.select(r,pair(r),b.kalshi,b.poly,status,c,at).selected,null);
 const p2=new StrategyPaper(review,await seed());const result=await p2.execute(r,pair(r),q,async()=>({quote:quote(r,b,1),status,constraints:c,reasons:[]}),async()=>assert.fail('must not submit'),()=>at,()=>100,()=>true);
 assert.ok(result.reasons.includes('CONFIRMED_CANDIDATE_CHANGED'));assert.equal(p2.newAttempts(),0);
 p2.entries[0].session.recoveryLoss=20000;assert.equal(p2.stopReason(),'REALIZED_LOSS_TRIGGER');
});
test('shadow fills and hypothetical recovery cannot mutate strategy holdings or cash and never report profit',async()=>{
 const p=new StrategyPaper(review,await seed()),before=JSON.stringify({summary:p.summary(),entries:p.entries}),shadow=new ShadowCollector(review),r=shadow.allowed[0],b=books(r,8600,400),q=quote(r,b),sig=shadowSignature(q,b.kalshi,b.poly);
 const s=shadow.begin(r,pair(r),q,status,c,sig,at,100);
 accountLeg(s,pair(r),'kalshi',modelLeg(s.plan!.kalshi,pair(r).a,b.kalshi,[],false,at+500,600));
 accountLeg(s,pair(r),'poly',modelLeg(s.plan!.poly,pair(r).b,books(r,8600,500).poly,[],false,at+500,600));
 assert.equal(executionClass(s.results),'ONE_LEG_FAILURE');const rp=recoveryPlan(s,1600)!;recover(s,rp,pair(r).a,b.kalshi,[],at+2100,2100);shadow.busy=false;
 const summary=shadow.summary();assert.equal(summary.attempts[0].hypotheticalRecoveryLoss!>0,true);assert.equal(summary.strategyCashDelta,0);assert.equal(summary.strategyInventoryDelta,0);assert.equal(summary.settlementAssumption,'NONE');
 assert.equal(JSON.stringify({summary:p.summary(),entries:p.entries}),before);assert.equal('profit' in summary.attempts[0],false);assert.equal('conditionalUnrealizedSurplus' in summary.attempts[0],false);
 assert.equal(shadow.authorized(rows.authorized[0]),false);assert.equal(p.authorized(r),false);
});
test('shadow route dedup permits only material price, depth or quantity changes, with a hard twenty-attempt limit',()=>{
 const shadow=new ShadowCollector(review),r=shadow.allowed[0],b=books(r),q=quote(r,b),sig=shadowSignature(q,b.kalshi,b.poly);
 shadow.begin(r,pair(r),q,status,c,sig,at,100);shadow.busy=false;assert.equal(shadow.canAttempt(r,sig),false);
 assert.equal(materiallyChanged(sig,{...sig,kalshiPrice:sig.kalshiPrice+99}),false);assert.equal(materiallyChanged(sig,{...sig,kalshiPrice:sig.kalshiPrice+100}),true);
 assert.equal(materiallyChanged(sig,{...sig,kalshiDepth:sig.kalshiDepth*1.25}),true);
 while(shadow.attempts.length<20)shadow.attempts.push(shadow.attempts[0]);assert.equal(shadow.canAttempt(r,{...sig,quantity:1}),false);assert.equal(sessionPolicy.maxShadowAttempts,20);
});
test('ranking uses current dollar surplus then capital efficiency and gives comparable shorter horizons a turn',()=>{
 const r=rows.authorized[0],base=quote(r,books(r)),withE=(surplus:number,cash:number)=>({...base,economics:{...base.economics!,feeBoundSurplus:surplus,reservedCash:cash}}),short={kalshiExpected:'2026-10-01',polyEnd:'2026-10-02'},long={kalshiExpected:'2027-01-01',polyEnd:'2027-01-02'};
 const large={id:'large',quote:withE(1000,100000),times:long},near={id:'near',quote:withE(950,100000),times:short},small={id:'small',quote:withE(800,10000),times:short};
 assert.deepEqual(rankOpportunities([small,large,near],at).map(x=>x.id),['near','large','small']);
 assert.deepEqual(rankOpportunities([{...large,id:'inefficient'},{...large,id:'efficient',quote:withE(1000,90000)}],at).map(x=>x.id),['efficient','inefficient']);
 assert.equal(horizon({},base,at).indicativeDays,null);assert.equal(horizon({},base,at).cashRelease,'UNCERTAIN_NOT_GUARANTEED');
 assert.equal(rankOpportunities([{...large,times:{}},small],at)[0].id,'large');
});
test('movement keeps adverse arrival prices even when frozen FOK does not fill; missing evidence stays unusable',()=>{
 const shadow=new ShadowCollector(review),r=shadow.allowed[0],b=books(r),q=quote(r,b),s=shadow.begin(r,pair(r),q,status,c,shadowSignature(q,b.kalshi,b.poly),at,100),plan=s.plan!.kalshi;
 const moved=arrivalMovement(plan,pair(r).a,books(r,1200).kalshi,[]);assert.equal(moved.priceMovementPerContract,100);assert.equal(moved.depthWithinFrozenLimit,0);
 assert.equal(modelLeg(plan,pair(r).a,books(r,1200).kalshi,[],false,at+500,600).outcome,'NO_FILL');assert.equal(arrivalMovement(plan,pair(r).a,undefined,['MISSING']).evidenceUsable,false);
 assert.equal(executionClass({kalshi:{outcome:'FILLED',reasons:[],fill:null,at}}),'INCONCLUSIVE');
});
test('two-hour limits are frozen, with original fee, reserve, transport and recovery budgets',()=>{
 assert.equal(sessionPolicy.durationMs,7200000);assert.equal(sessionPolicy.admissionMarginPerContract,0);assert.equal(sessionPolicy.additionalAdmissionMarginPerContract,0);assert.equal(sessionPolicy.riskPerContract,200);
 assert.deepEqual(sessionPolicy.recoveryPerContract,{kalshi:100,poly:500});assert.equal(sessionPolicy.maxReservation,150000);assert.equal(sessionPolicy.maxCommitted,450000);assert.equal(sessionPolicy.maxAttempts,5);assert.equal(sessionPolicy.maxPositions,3);assert.equal(sessionPolicy.transportMs,500);assert.equal(sessionPolicy.ordersEnabled,false);
});
