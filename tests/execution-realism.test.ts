import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {orderFee} from '../lib/research/study-fees.ts';
import {PaperExecutionStudy,studyPlans,type StudyBook} from '../lib/research/paper-execution-study.ts';
import {realisticAttempt,realismPortfolio,realismReport,type Evidence} from '../lib/research/execution-realism.ts';
import {paperSettlement} from '../lib/research/hot-confirmation.ts';
import type {RecallRoute} from '../lib/research/recall-detector.ts';
function fixture(){
 const r=structuredClone(JSON.parse(readFileSync(new URL('./fixtures/semantic-difference-retained.json',import.meta.url),'utf8')).find((r:any)=>r.reference==='ORDINARY_EQUIVALENT_BASIS_RISK').route) as RecallRoute;
 r.pair.a.minQty=r.pair.b.minQty=1;r.pair.a.feeRate=r.pair.b.feeRate=0;r.pair.inverted=false;r.warnings=[];r.ticks={kalshi:100,poly:100};
 const at=Date.now();r.pair.a.closeAt=r.pair.b.closeAt=new Date(at+86400_000).toISOString();
 const initial=Object.fromEntries(['kalshi','poly'].map(v=>[v,{proof:{sequence:1},book:{venue:v,marketId:v==='kalshi'?r.pair.a.id:r.pair.b.id,
  yes:[{price:4000,quantity:100}],no:[{price:4000,quantity:100}],yesBids:[{price:3500,quantity:100}],noBids:[{price:3500,quantity:100}],
  receivedAt:at,receivedMono:100,exchangeAt:at,sequence:1,connection:'LIVE',valid:true,source:'stream',open:true}}])) as Record<'kalshi'|'poly',StudyBook>;
 const s=new PaperExecutionStudy(()=>initial,()=>{},true);s.observe(r,initial,paperSettlement(r),at,100);
 const e=s.episodes[0],p=e.plans.find(p=>p.capDollars===10)!;
 const ev:Evidence={initial,future:new Map([[100,initial.poly]]),unwind:new Map([[100,initial.kalshi]])};
 return {r,at,e,p,ev,s};
}
test('current official fee examples and Kalshi cent balance alignment',()=>{
 assert.equal(orderFee([{price:5500,quantity:.1}],147,'kalshi'),500000); // published revenue .055, model fee .00363825
 assert.equal(orderFee([{price:1000,quantity:1000}],695,'poly'),626000000);
 assert.equal(orderFee([{price:6500,quantity:1000}],695,'poly'),1581000000);
 assert.equal(orderFee([{price:5000,quantity:1000}],695,'poly'),1738000000);
 // Two levels each raw .0175. Accumulator removes the extra cent.
 assert.equal(orderFee([{price:5000,quantity:1},{price:5000,quantity:1}],700,'kalshi'),4000000);
 assert.equal(orderFee([{price:4000,quantity:1},{price:4000,quantity:1},{price:4000,quantity:1}],700,'kalshi'),6000000);
 assert.equal(orderFee([{price:4000,quantity:1},{price:4000,quantity:1},{price:4000,quantity:1}],700,'kalshi',false,true),6000000);
 assert.equal(orderFee([{price:5000,quantity:1}],NaN,'poly'),null);
});
test('buy and sell cent alignment includes fractional acquisition/proceeds',()=>{
 assert.equal(orderFee([{price:5550,quantity:1}],0,'kalshi'),500000);
 assert.equal(orderFee([{price:5550,quantity:1}],0,'kalshi',true),500000);
 assert.equal(orderFee([{price:5500,quantity:1},{price:500,quantity:1}],0,'kalshi'),0);
});
test('haircut walks actual levels, allows partial first and second fill, prices observed unwind',()=>{
 const {e,p,ev}=fixture();ev.initial.kalshi.book.yes=[{price:4000,quantity:12},{price:4100,quantity:4}];
 ev.future.get(100)!.book.no=[{price:4000,quantity:6}];
 const a=realisticAttempt(e,p,ev,100,'HAIRCUT_50');
 assert.equal(a.firstFillQuantity,8);assert.equal(a.first.levels.length,2);assert.equal(a.pairedQuantity,3);assert.equal(a.residualQuantity,5);
 assert.equal(a.unwind!.outcome,'UNWIND');assert.equal(a.negativeKnownPnl,33000000);
 const portfolio=realismPortfolio([{e,a}],10,100,'HAIRCUT_50');assert.equal(portfolio.netPnl,.33);assert.equal(portfolio.grossOrdinary-portfolio.fees,portfolio.netPnl);
});
test('known vanished hedge records loss; orphan and missing future never get fabricated P&L',()=>{
 const {e,p,ev}=fixture();ev.future.get(100)!.book.no=[];
 const a=realisticAttempt(e,p,ev,100,'DISPLAYED');assert.equal(a.unwind!.outcome,'UNWIND');assert.equal(a.negativeKnownPnl,-60000000);
 assert.equal(realismPortfolio([{e,a}],10,100,'DISPLAYED').worstTrade,-.6);
 ev.unwind.get(100)!.book.yesBids=[{price:3500,quantity:2}];const orphan=realisticAttempt(e,p,ev,100,'DISPLAYED');
 assert.equal(orphan.unwind!.outcome,'ORPHAN');assert.equal(realismPortfolio([{e,a:orphan}],10,100,'DISPLAYED').netPnl,null);
 ev.future.set(100,null);assert.equal(realisticAttempt(e,p,ev,100,'DISPLAYED').outcome,'UNOBSERVED');
});
test('conservative economic grouping prevents reharvesting after freshness gaps/full unwinds',()=>{
 const {e,ev}=fixture();e.endReason='OBSERVATION_GAP';const next=structuredClone(e);next.id=3;next.start+=3000;
 const report=realismReport([e,next],new Map([[e.id,ev],[next.id,ev]]),3600000);
 assert.equal(report.uniqueEpisodes,1);assert.equal(report.baseline.entries,1);
});
test('native tick stress does not invent a supported grid; realistic caps preserve baseline',()=>{
 const {r,e,p,ev}=fixture();assert.deepEqual(studyPlans(r,ev.initial,'yes',Date.now(),true).map(p=>p.capDollars),[5,10,25,50]);
 e.route.ticks={kalshi:0,poly:100};assert.equal(realisticAttempt(e,p,ev,100,'ONE_TICK').outcome,'UNOBSERVED');
});
test('all requested latency unwind books retained even when displayed pairs clean',()=>{
 const {s,at}=fixture();const rows:any[]=[];s.record=(kind,body)=>rows.push({kind,body});
 s.pulse(at+100,200);s.pulse(at+350,450);s.pulse(at+500,600);s.pulse(at+1000,1100);s.pulse(at+1250,1350);
 assert.ok(rows.some(x=>x.kind==='PAPER_UNWIND_BOOK'&&x.body.delayMs===100));
 assert.equal(s.captures.length,0);
});
