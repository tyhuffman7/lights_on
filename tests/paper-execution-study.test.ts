import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PaperExecutionStudy,studyPlans,studyEligible,secondLegAttempt,residualUnwind,executionStudyPolicy,type StudyBook,type Episode} from '../lib/research/paper-execution-study.ts';
import {paperPortfolio,executionReport} from '../lib/research/paper-execution-report.ts';
import {paperSettlement} from '../lib/research/hot-confirmation.ts';
import type {RecallRoute} from '../lib/research/recall-detector.ts';
const route=()=>{
 const r=structuredClone(JSON.parse(readFileSync(new URL('./fixtures/semantic-difference-retained.json',import.meta.url),'utf8')).find((r:any)=>r.reference==='ORDINARY_EQUIVALENT_BASIS_RISK').route) as RecallRoute;
 r.pair.a.minQty=r.pair.b.minQty=1;r.pair.a.feeRate=r.pair.b.feeRate=0;r.pair.inverted=false;r.warnings=[];
 r.pair.a.closeAt=r.pair.b.closeAt=new Date(Date.now()+86400_000).toISOString();return r;
};
function books(r:RecallRoute,at=Date.now(),mono=100):Record<'kalshi'|'poly',StudyBook>{
 return Object.fromEntries(['kalshi','poly'].map(v=>[v,{proof:{source:'NATIVE_WS',sequence:1},book:{venue:v,marketId:v==='kalshi'?r.pair.a.id:r.pair.b.id,
  yes:[{price:4000,quantity:1000}],no:[{price:4000,quantity:1000}],yesBids:[{price:3500,quantity:1000}],noBids:[{price:3500,quantity:1000}],
  receivedAt:at,receivedMono:mono,exchangeAt:at,sequence:1,connection:'LIVE',valid:true,source:'stream',open:true}}])) as any;
}
test('depth and all five caps use actual levels; diagnostic stress does not veto',()=>{
 const r=route(),b=books(r),ps=studyPlans(r,b,'yes',Date.now());
 assert.deepEqual(ps.map(p=>p.capDollars),[5,10,25,50,100]);assert.deepEqual(ps.map(p=>p.evaluation.quantity),[6,12,31,62,125]);
 for(const p of ps)assert.ok(p.commitment<=p.capDollars*100_000_000);
 b.poly.book.no=[{price:4000,quantity:3}];assert.ok(studyPlans(r,b,'yes',Date.now()).every(p=>p.evaluation.quantity===3));
});
test('only promoted fresh native identity/orientation and known minimums enter',()=>{
 const r=route(),b=books(r),c=paperSettlement(r),at=Date.now();assert.equal(studyEligible(r,b,at,c),true);
 for(const bad of [ {...c,classification:'UNRESOLVED'}, {...c,classification:'DIFFERENT_QUESTION'} ] as any[])assert.equal(studyEligible(r,b,at,bad),false);
 b.poly.book.source='rest';assert.equal(studyEligible(r,b,at,c),false);b.poly.book.source='stream';b.poly.book.receivedAt=at-2001;assert.equal(studyEligible(r,b,at,c),false);
 b.poly.book.receivedAt=at;b.poly.book.marketId='wrong';assert.equal(studyEligible(r,b,at,c),false);
});
test('later depth supports clean, partial, vanished, first-only and unobserved distinctly',()=>{
 const r=route(),b=books(r),at=Date.now(),p=studyPlans(r,b,'yes',at).find(p=>p.capDollars===10)!;
 assert.equal(secondLegAttempt(r,p,b.poly,at,25).outcome,'CLEAN_PAIR');
 b.poly.book.no=[{price:4000,quantity:3}];const partial=secondLegAttempt(r,p,b.poly,at,25);assert.equal(partial.outcome,'PARTIAL_HEDGE');assert.equal(partial.pairedQuantity,3);assert.equal(partial.residualQuantity,9);
 b.poly.book.no=[{price:7000,quantity:100}];assert.equal(secondLegAttempt(r,p,b.poly,at,25).outcome,'EDGE_DISAPPEARED');
 b.poly.book.no=[];assert.equal(secondLegAttempt(r,p,b.poly,at,25).outcome,'FIRST_LEG_ONLY');
 b.poly.book.valid=false;assert.equal(secondLegAttempt(r,p,b.poly,at,25).outcome,'UNOBSERVED');
});
test('actual residual bids determine unwind loss and orphan; missing quotes are unknown',()=>{
 const r=route(),b=books(r),at=Date.now(),p=studyPlans(r,b,'yes',at)[1];b.poly.book.no=[];
 const a=secondLegAttempt(r,p,b.poly,at,100),u=residualUnwind(r,'yes',a,b.kalshi,at);assert.equal(u.unwind?.outcome,'UNWIND');assert.equal(u.unwind?.loss,60_000_000);
 b.kalshi.book.yesBids=[{price:3500,quantity:2}];assert.equal(residualUnwind(r,'yes',a,b.kalshi,at).unwind?.outcome,'ORPHAN');
 assert.equal(residualUnwind(r,'yes',a,null,at).unwind?.outcome,'UNOBSERVED');
});
test('repeated quote readings create one episode, disappearance/return needs meaningful gap',()=>{
 const r=route(),at=Date.now(),b=books(r,at,100),c=paperSettlement(r),s=new PaperExecutionStudy(()=>b,()=>{});
 s.observe(r,b,c,at,100);s.observe(r,b,c,at+100,200);assert.equal(s.episodes.length,2); // two different orientations
 assert.ok(s.episodes.every(e=>e.quoteUpdates===1));
 b.poly.book.no=[{price:7000,quantity:1000}];b.poly.book.yes=[{price:7000,quantity:1000}];s.observe(r,b,c,at+200,300);
 s.observe(r,b,c,at+1300,1400);assert.equal(s.active.size,0);
 b.poly.book.no=[{price:4000,quantity:1000}];b.poly.book.yes=[{price:4000,quantity:1000}];s.observe(r,b,c,at+1400,1500);assert.equal(s.episodes.length,4);
 s.stop(at+1500);assert.equal(s.captures.length,0);assert.ok(s.episodes[2].rightCensored);
});
test('as-of latency never uses future quotes; late processing/backlog gaps stay unobserved',()=>{
 const r=route(),at=Date.now(),b=books(r,at,100),s=new PaperExecutionStudy(()=>b,()=>{});s.observe(r,b,paperSettlement(r),at,100);
 const later=structuredClone(b.poly);later.book.no=[{price:7000,quantity:1000}];later.book.receivedAt=at+20;later.book.receivedMono=120;
 s.book('poly',r.pair.b.id,later,at+20,120);s.pulse(at+25,125);
 const attempts=s.episodes[0].attempts;assert.equal(attempts.find(a=>a.capDollars===10&&a.delayMs===10)?.outcome,'CLEAN_PAIR');assert.equal(attempts.find(a=>a.capDollars===10&&a.delayMs===25)?.outcome,'EDGE_DISAPPEARED');
 const s2=new PaperExecutionStudy(()=>b,()=>{});s2.observe(r,b,paperSettlement(r),at,100);later.book.receivedMono=105;s2.book('poly',r.pair.b.id,later,at+20,120);s2.pulse(at+25,125);
 assert.equal(s2.episodes[0].attempts.find(a=>a.capDollars===10&&a.delayMs===10)?.outcome,'UNOBSERVED');
});
test('portfolio never sums ticks, reuses held market depth or silently prices unknown residuals',()=>{
 const r=route(),at=Date.now(),b=books(r,at,100),s=new PaperExecutionStudy(()=>b,()=>{});s.observe(r,b,paperSettlement(r),at,100);s.pulse(at+100,200);s.stop(at+200);
 const e=s.episodes[0],duplicate={...structuredClone(e),id:99,start:at+10};
 const p=paperPortfolio([e,duplicate],10,100);assert.equal(p.acceptedEntries,1);assert.equal(p.skips.MARKET_ALREADY_HELD,1);assert.equal(p.modeledPortfolioPnlDollars,2.4);
 const unknown=structuredClone(e);unknown.attempts.find(a=>a.capDollars===10&&a.delayMs===100)!.outcome='UNOBSERVED';
 assert.equal(paperPortfolio([unknown],10,100).modeledPortfolioPnlDollars,null);
 assert.equal(executionReport(s.summary(),60_000).episodes,2);assert.equal(executionStudyPolicy.ordersEnabled,false);
});
test('frequency reporting merges freshness gaps and counts only witnessed economic returns',()=>{
 const r=route(),at=Date.now(),b=books(r,at,100),s=new PaperExecutionStudy(()=>b,()=>{});s.observe(r,b,paperSettlement(r),at,100);s.pulse(at+100,200);s.stop(at+200);
 const first=structuredClone(s.episodes[0]);first.endReason='OBSERVATION_GAP';first.rightCensored=true;
 const resumed={...structuredClone(first),id:99,start:at+1000};resumed.endReason='ECONOMIC_DISAPPEARANCE';resumed.rightCensored=false;
 const returned={...structuredClone(first),id:100,start:at+2000};resumed.netEdges=Array(1000).fill(1);
 const result=executionReport({episodes:[first,resumed,returned],timing:[],skipped:{}},60_000);
 assert.equal(result.captureSegments,3);assert.equal(result.episodes,2);assert.equal(result.confirmedReturns,1);assert.equal(result.recurringRoutes,1);
 assert.equal(result.latencySurvival.find(d=>d.delayMs===100)!.eligibleEpisodes,2);
 assert.equal(result.captureLatencySurvival.find(d=>d.delayMs===100)!.eligibleEpisodes,3);
 assert.equal(result.baseline.acceptedEntries,1);assert.equal(result.baseline.modeledPortfolioPnlDollars,2.4);
 assert.ok(Math.abs(result.medianPerContractNetDollars!-.2)<1e-12);assert.equal(result.contentUpdateMedianPerContractNetDollars,1e-8);
});
