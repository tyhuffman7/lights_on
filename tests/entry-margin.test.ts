import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MultiPaper,marginScenarios,reviewedRows} from '../lib/arb/multi-paper.ts';
import type {ReviewRow,InitialJournal} from '../lib/arb/multi-paper.ts';
import {reconnectPortfolios} from '../worker/multi-paper.ts';
import {quoteCandidate} from '../lib/screen/confirmation.ts';
import {admission,accountLeg,modelLeg,recoveryPlan} from '../lib/arb/ksu-paper.ts';
import type {Book,Pair,Venue} from '../lib/arb/types.ts';
const read=(p:string)=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const review=read('../docs/research/contract-shortlist/review.json'),markets=read('../docs/research/contract-shortlist/retained-markets.json'),rows=reviewedRows(review).authorized;
const at=Date.parse('2026-09-22T17:00:00Z'),status={knownBlocked:false,reportedStatus:'active',reasons:[]},constraints={kalshi:{tick:100,minimum:1},poly:{tick:10,minimum:1}};
const pair=(r:ReviewRow):Pair=>({id:r.pairId,a:markets.kalshi.find((m:any)=>m.id===r.kalshiId),b:markets.poly.find((m:any)=>m.id===r.polyId),inverted:false,reviewed:false});
// Entirely synthetic displayed depth; no test outcome is market evidence.
const book=(side:'yes'|'no',price:number,quantity=10):Book=>({yes:[],no:[],yesBids:[],noBids:[],[side]:[{price,quantity}],receivedAt:at,exchangeAt:at,open:true});
const books=(r:ReviewRow,k=100,p=9700,n=10)=>({kalshi:book(r.sides.kalshi,k,n),poly:book(r.sides.poly,p,n)});
const quote=(r:ReviewRow,b:Record<Venue,Book>,n=1)=>quoteCandidate(pair(r),b.kalshi,b.poly,r.sides.kalshi,at,n);
async function enter(p:MultiPaper,r:ReviewRow,b:Record<Venue,Book>,q=quote(r,b),proof=q){return p.execute(r,pair(r),q,async()=>({quote:proof,status,constraints,reasons:[]}),async s=>{for(const v of ['kalshi','poly'] as const)accountLeg(s,pair(r),v,modelLeg(s.plan![v],v==='kalshi'?pair(r).a:pair(r).b,b[v],[],false,at+500,600));},()=>at,()=>100,()=>true);}
async function seed():Promise<InitialJournal>{const p=new MultiPaper(review),r=rows.find(r=>r.kalshiId.includes('DWTS'))!,b=books(r,800,8700,7);await enter(p,r,b,quote(r,b,7));return structuredClone({portfolio:p.summary(),entries:p.entries});}
test('margin reaches quantity ranking, final admission and reservation; all other economics remain identical',async()=>{
 const r=rows.find(r=>r.kalshiId.includes('ORST'))!,b=books(r),baseline=new MultiPaper(review,marginScenarios[0]),challenger=new MultiPaper(review,marginScenarios[1]);
 const original=quote(r,b),frozen=structuredClone(original);
 assert.equal(original.economics!.feeBoundSurplus,100);assert.equal(original.economics!.afterRisk,-100);
 assert.equal(baseline.select(r,pair(r),b.kalshi,b.poly,status,constraints,at).selected,null);
 const selected=challenger.select(r,pair(r),b.kalshi,b.poly,status,constraints,at).selected!;assert.equal(selected.quantity,10);
 assert.equal((await enter(baseline,r,b,selected)).attempted,false);
 assert.equal((await enter(challenger,r,b,selected)).attempted,true);
 assert.deepEqual(original,frozen);const s=challenger.entries[0].session,e=selected.economics!;
 for(const v of ['kalshi','poly'] as const){const p=s.plan![v];assert.equal(p.riskCash,selected.quantity*100);assert.equal(p.recoveryBudget,e.recoveryCash[v]);assert.equal(p.entryBudget,e[v].cost+e[v].feeBound);assert.equal(p.ceiling,Math.max(...e[v].levels.map(l=>l.price)));assert.equal(p.arrivalMono-p.submittedMono,500);assert.equal(s.results[v]!.fill!.fees,e[v].feeBound);assert.equal(s.held[v],p.riskCash+p.recoveryBudget);}
 assert.equal(challenger.cash.kalshi+challenger.cash.poly+challenger.commitment(),1000000);
});
test('a candidate selected earlier still fails final admission when confirmation loses its positive fee-net edge',async()=>{
 const r=rows[0],b=books(r),p=new MultiPaper(review,marginScenarios[1]),original=quote(r,b);
 for(const price of [9800,9900]){const proof=quote(r,books(r,100,price));assert.ok(proof.economics!.feeBoundSurplus<=0);assert.equal((await enter(p,r,b,original,proof)).attempted,false);assert.equal(p.select(r,pair(r),book(r.sides.kalshi,100,1),book(r.sides.poly,price,1),status,constraints,at).selected,null);}
 assert.equal(p.newAttempts(),0);assert.deepEqual(p.cash,{kalshi:500000,poly:500000});
});
test('baseline is identical to default mode across boundary prices, quantities and final admission; legacy KSU floors persist',()=>{
 const r=rows[0],baseline=new MultiPaper(review,marginScenarios[0]),legacy=new MultiPaper(review);
 for(const k of [100,800,4000,9900])for(const p of [100,5000,8700,9700,9800,9900]){const b=books(r,k,p);assert.deepEqual(baseline.select(r,pair(r),b.kalshi,b.poly,status,constraints,at),legacy.select(r,pair(r),b.kalshi,b.poly,status,constraints,at));for(const n of [1,7,10])assert.deepEqual(baseline.gates(r,pair(r),quote(r,b,n),status,constraints),legacy.gates(r,pair(r),quote(r,b,n),status,constraints));}
 const q=quote(r,books(r));assert.ok(admission(pair(r),q,status,constraints,legacy.cash).reasons.includes('BELOW_10_CENT_AFTER_RISK_FLOOR'));
});
test('policies produce identical modeled fill plans, fees and recovery budgets for the same admitted quantity',async()=>{
 const r=rows[0],b=books(r,800,8700,7),ps=marginScenarios.map(s=>new MultiPaper(review,s));
 for(const p of ps)await enter(p,r,b,quote(r,b,7));
 assert.deepEqual(ps[0].entries[0].session.plan,ps[1].entries[0].session.plan);assert.deepEqual(ps[0].entries[0].session.results,ps[1].entries[0].session.results);assert.deepEqual(ps[0].cash,ps[1].cash);
 for(const p of ps){p.entries[0].session.results.poly={outcome:'NO_FILL',reasons:[],fill:null,at};}assert.deepEqual(recoveryPlan(ps[0].entries[0].session,1000),recoveryPlan(ps[1].entries[0].session,1000));
});
test('independent reconciled ledgers retain Julia, locked funds and position cap without replaying the entry',async()=>{
 const initial=await seed(),before=structuredClone(initial),[a,b]=marginScenarios.map(s=>new MultiPaper(review,s,initial)),j=rows.find(r=>r.kalshiId.includes('DWTS'))!;
 for(const p of [a,b]){assert.deepEqual(p.cash,{kalshi:492300,poly:434300});assert.equal(p.commitment(),73400);assert.equal(p.openPositions(),1);assert.equal(p.newAttempts(),0);assert.equal(p.summary().holdings[0].conditionalUnrealizedSurplus,2200);assert.equal((await enter(p,j,books(j,800,8700,7),quote(j,books(j,800,8700,7),7))).attempted,false);}
 for(const r of rows.filter(r=>r!==j).slice(0,2))await enter(b,r,books(r,4000,4000));
 assert.equal(b.openPositions(),3);assert.equal(b.newAttempts(),2);assert.equal(b.stopReason(),'THREE_OPEN_POSITIONS');assert.equal(a.openPositions(),1);assert.equal(a.commitment(),73400);assert.deepEqual(a.cash,{kalshi:492300,poly:434300});assert.deepEqual(initial,before);
 assert.ok(b.entries.every(e=>e.session.state.cash===b.cash));assert.notEqual(a.cash,b.cash);assert.notEqual(a.entries[0].session.state.positions[0],b.entries[0].session.state.positions[0]);
});
test('unreconciled seeds fail closed and risk/recovery reservations still constrain zero-margin selection',async()=>{
 const initial=await seed();for(const alter of [(s:InitialJournal)=>s.portfolio.cash.kalshi++, (s:InitialJournal)=>s.entries[0].session.held.poly--,(s:InitialJournal)=>s.entries.push(structuredClone(s.entries[0])),(s:InitialJournal)=>s.entries[0].session.results.poly!.outcome='INCONCLUSIVE']){const bad=structuredClone(initial);alter(bad);assert.throws(()=>new MultiPaper(review,marginScenarios[1],bad),/INITIAL/);}
 const p=new MultiPaper(review,marginScenarios[1]),r=rows[0],b=books(r,100,9700,1),q=quote(r,b);p.cash.poly=q.economics!.poly.cost+q.economics!.poly.feeBound;assert.ok(p.gates(r,pair(r),q,status,constraints).includes('poly_CASH'));assert.equal(p.select(r,pair(r),b.kalshi,b.poly,status,constraints,at).selected,null);
});

test('shared reconnect preserves invalid-count, deadline, halt, busy and atomic budget guards',()=>{
 const ps=marginScenarios.map(s=>new MultiPaper(review,s));
 for(const count of [0,-1,1.5,NaN]){assert.equal(reconnectPortfolios(ps,100,1000,count),false);assert.deepEqual(ps.map(p=>p.reconnects),[0,0]);}
 assert.equal(reconnectPortfolios(ps,1000,1000,1),false);
 ps[1].busy=true;assert.equal(reconnectPortfolios(ps,100,1000,1),false);ps[1].busy=false;
 ps[1].halt='UNRESOLVED_EXECUTION_EXPOSURE';assert.equal(reconnectPortfolios(ps,100,1000,1),false);ps[1].halt=null;
 ps[1].reconnects=3;assert.equal(reconnectPortfolios(ps,100,1000,1),false);assert.deepEqual(ps.map(p=>p.reconnects),[0,3]);ps[1].reconnects=0;
 for(let i=1;i<=3;i++){assert.equal(reconnectPortfolios(ps,100,1000,1),true);assert.deepEqual(ps.map(p=>p.reconnects),[i,i]);}
 assert.equal(reconnectPortfolios(ps,100,1000,1),false);
});
