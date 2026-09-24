import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pair as fixturePair} from './research-fixture.ts';
import {evaluateEvArb,normalFee,takeDepth,evPaperDefaults,USD_SCALE} from '../lib/research/ev-arb.ts';
import {simulatePaperAttempt} from '../lib/research/ev-paper.ts';
import {EvLearningLedger,emptyFunnel,observeFunnel,learningReport,readAttempts,empiricalEvForCandidate} from '../worker/ev-learning-ledger.ts';
import {formatPairAudit} from '../worker/ev-pair-audit.ts';
import type {StreamBook} from '../lib/research/types.ts';

const now=Date.now();
const pair=()=>fixturePair() as any;
function books(at=now){const p=pair();const make=(venue:'kalshi'|'poly',id:string):StreamBook=>({
  venue,marketId:id,yes:[],no:[],yesBids:[{price:3000,quantity:10}],noBids:[{price:3000,quantity:10}],
  receivedAt:at,receivedMono:100,exchangeAt:at,sequence:1,connection:'LIVE',valid:true,open:true,source:'stream'});
  const kalshi=make('kalshi',p.a.id),poly=make('poly',p.b.id);
  kalshi.yes=[{price:4000,quantity:.4},{price:4200,quantity:.6}];kalshi.no=[{price:8000,quantity:2}];
  poly.no=[{price:5000,quantity:1}];poly.yes=[{price:2500,quantity:2}];
  return {p,books:{kalshi,poly}};
}
test('gross L2 spread, equal quantity, realistic fees and fragmentation stress are independent',()=>{
  const {p,books:b}=books();const e=evaluateEvArb(p,b,'yes',1,now);
  assert.equal(e.grossStatus,'GROSS_ARB');assert.equal(e.kalshi?.quantity,e.poly?.quantity);
  assert.deepEqual(e.kalshi?.levels,[{price:4000,quantity:.4},{price:4200,quantity:.6}]);
  assert.equal(e.acquisitionCost,4000*4000+4200*6000+5000*10000);
  assert.equal(e.grossProfit,USD_SCALE-e.acquisitionCost!);
  assert.equal(e.estimatedFees,normalFee(e.kalshi!.levels,700,'kalshi')!+normalFee(e.poly!.levels,600,'poly')!);
  assert.equal(e.estimatedNetProfit,e.grossProfit!-e.estimatedFees!);
  assert.equal(e.economicStatus,'REALISTIC_NET_POSITIVE');
  assert.equal(e.stress.feeBoundPass,false);assert.ok(e.stress.feeBound!>e.estimatedFees!);
  assert.equal(e.feeConfidence,'UNCONFIRMED_ACCOUNT_PRECISION');
  assert.equal(e.stress.oneTickProfit,e.grossProfit!-2_000_000-
    (normalFee(e.kalshi!.levels.map(l=>({...l,price:l.price+100})),700,'kalshi')!+
      normalFee(e.poly!.levels.map(l=>({...l,price:l.price+100})),600,'poly')!));
});
test('both complementary orientations are evaluated and depth is walked at exact quantity',()=>{
  const {p,books:b}=books();const a=evaluateEvArb(p,b,'yes',1,now),other=evaluateEvArb(p,b,'no',1,now);
  assert.equal(a.orientation,'kalshi_yes+pm_us_no');assert.equal(other.orientation,'kalshi_no+pm_us_yes');
  assert.equal(other.grossStatus,'NO_GROSS_ARB');
  assert.equal(takeDepth([{price:4000,quantity:.4},{price:4200,quantity:.6}],2),null);
  b.poly.no=[{price:5000,quantity:.5}];assert.equal(evaluateEvArb(p,b,'yes',1,now).grossStatus,'NO_EXECUTABLE_DEPTH');
});
test('four-decimal L2 quantities preserve gross economics without fabricating a stress bound',()=>{
  const {p,books:b}=books();b.kalshi.yes=[{price:4000,quantity:.0001},{price:4200,quantity:.9999}];
  const e=evaluateEvArb(p,b,'yes',1,now);
  assert.equal(e.grossStatus,'GROSS_ARB');
  assert.equal(e.kalshi?.cost,4000+4200*9999);
  assert.equal(e.stress.feeBound,null);
  assert.ok(e.stress.failed.includes('STRESS_BOUND_UNAVAILABLE_FRACTIONAL_LEVELS'));
});
test('stale executable spread remains detected but cannot enter paper simulation',()=>{
  const {p,books:b}=books(now-4800);const e=evaluateEvArb(p,b,'yes',1,now);
  assert.equal(e.grossStatus,'GROSS_ARB');assert.equal(e.stress.freshnessPass,false);
  assert.ok(e.execution.reasons.includes('BOOK_STALE_OR_NOT_STREAM_CONFIRMED'));
  const f=emptyFunnel();observeFunnel(f,e);assert.equal(f.grossPositiveObservations,1);assert.equal(f.freshnessFailures,1);
});
test('pre-entry disappearance records zero trading loss; failed hedge unwinds first fill',()=>{
  const {p,books:b}=books();const e=evaluateEvArb(p,b,'yes',1,now);
  const entry=structuredClone(b),future=structuredClone(b);
  entry.kalshi.yes=[];
  const gone=simulatePaperAttempt(p,e,entry,future,'kalshi',250,now);
  assert.equal(gone.finalState,'DISAPPEARED_BEFORE_ENTRY');assert.equal(gone.paperPnL,0);assert.equal(gone.firstLegSimulatedFill,null);
  entry.kalshi.yes=b.kalshi.yes;
  future.poly.receivedAt=now+250;future.poly.exchangeAt=now+250;future.poly.no=[];
  future.kalshi.receivedAt=now+250;future.kalshi.exchangeAt=now+250;
  const unwound=simulatePaperAttempt(p,e,entry,future,'kalshi',250,now);
  assert.equal(unwound.finalState,'FIRST_LEG_FILLED_HEDGE_FAILED_UNWOUND');
  assert.equal(unwound.unwindRequired,true);assert.equal(unwound.residualQuantity,0);
  assert.equal(unwound.paperPnL,-unwound.fees-unwound.unwindLoss);
});
test('partial unwind and orphan exposure remain explicit and never claim settled profit',()=>{
  const {p,books:b}=books();b.kalshi.yes=[{price:4000,quantity:2}];b.poly.no=[{price:5000,quantity:2}];
  const e=evaluateEvArb(p,b,'yes',2,now),future=structuredClone(b);
  future.poly.no=[];future.poly.receivedAt=now+250;future.poly.exchangeAt=now+250;
  future.kalshi.yesBids=[{price:3000,quantity:.75}];future.kalshi.receivedAt=now+250;future.kalshi.exchangeAt=now+250;
  const partial=simulatePaperAttempt(p,e,b,future,'kalshi',250,now);
  assert.equal(partial.finalState,'PARTIAL_UNWIND');assert.equal(partial.residualQuantity,1.25);
  assert.equal(partial.eventualModeledOutcome,null);assert.equal(partial.orphanLoss,0);
  future.kalshi.yesBids=[];
  const orphan=simulatePaperAttempt(p,e,b,future,'kalshi',250,now);
  assert.equal(orphan.finalState,'ORPHAN_EXPOSURE');assert.equal(orphan.residualQuantity,2);
  assert.equal(orphan.paperPnL,-orphan.fees);
});
test('ledger is durable, rejects secrets and reports P&L and venue rates separately',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ev-arb-test-'));
  try{const {p,books:b}=books();const e=evaluateEvArb(p,b,'yes',1,now),future=structuredClone(b);
    future.kalshi.receivedAt=now+250;future.kalshi.exchangeAt=now+250;
    future.poly.receivedAt=now+250;future.poly.exchangeAt=now+250;
    const k=simulatePaperAttempt(p,e,b,future,'kalshi',250,now),pm=simulatePaperAttempt(p,e,b,future,'poly',250,now,evPaperDefaults,'COUNTERFACTUAL');
    assert.equal(k.finalState,'CLEAN_PAIRED_FILL');assert.equal(pm.finalState,'CLEAN_PAIRED_FILL');
    const ledger=new EvLearningLedger(dir);ledger.appendBook({...b.kalshi,token:'SECRET'} as any);
    ledger.appendAttempt(k);ledger.appendAttempt(pm);
    assert.throws(()=>ledger.appendAttempt({...k,attemptId:'different',apiKey:'secret'} as any),/SENSITIVE/);
    assert.throws(()=>ledger.appendAttempt({...k,attemptId:'other',accessToken:'secret'} as any),/SENSITIVE/);
    const f=emptyFunnel();observeFunnel(f,e);ledger.writeFunnel(f);ledger.close();
    const rows=readAttempts(dir),report=learningReport(rows,f);
    assert.equal(rows.length,2);assert.equal(report.funnel.paperAttempts,1);assert.equal(report.funnel.counterfactualEvaluations,1);
    assert.equal(report.pnl.netModeledPaperPnL,
      report.pnl.grossPaperProfit-report.pnl.fees-report.pnl.normalSlippage-report.pnl.unwindLoss-report.pnl.orphanLoss);
    assert.equal(report.byFirst.kalshi.attempts,1);assert.equal(report.byFirst.poly.attempts,1);
    assert.equal(report.aggregateEvStatus,'INSUFFICIENT_EMPIRICAL_SAMPLE');
    assert.equal(readFileSync(join(dir,'attempts.ndjson'),'utf8').includes('secret'),false);
    assert.equal(readFileSync(join(dir,'books.ndjson'),'utf8').includes('SECRET'),false);
    assert.equal(empiricalEvForCandidate(e,rows,'kalshi').status,'INSUFFICIENT_EMPIRICAL_SAMPLE');
    assert.equal(empiricalEvForCandidate(e,Array.from({length:30},(_,i)=>({...k,attemptId:String(i)})),'kalshi').status,'EXECUTION_EV_POSITIVE');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('direct audit names the exact gross, net, stress, freshness and settlement stages',()=>{
  const {p,books:b}=books();b.kalshi.source='rest';b.poly.source='rest';
  const output=formatPairAudit(p,b,now,'UNVERIFIED_ORIENTATION');
  assert.match(output,/GROSS_ARB/);assert.match(output,/REALISTIC_NET_POSITIVE/);
  assert.match(output,/Stress fee bound/);assert.match(output,/BOOK_STALE_OR_NOT_STREAM_CONFIRMED/);
  assert.match(output,/Settlement warnings/);assert.match(output,/Current paper attempt: NO/);
  assert.equal(evPaperDefaults.ordersEnabled,false);
});
test('the bounded watcher exposes no venue order-write adapter',()=>{
  const source=readFileSync(new URL('../worker/ev-paper-watch.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/from ['"][^'"]*(?:live-adapter|order-wire|paper-approve|pilot-order)[^'"]*['"]/);
  assert.doesNotMatch(source,/\b(?:submitOrder|placeOrder|cancelOrder|previewOrder)\s*\(/);
  assert.doesNotMatch(source,/method\s*:\s*['"](?:POST|PUT|DELETE)['"]/);
  assert.equal(evPaperDefaults.ordersEnabled,false);
});
