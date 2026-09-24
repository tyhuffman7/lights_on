import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {learningReport,readAttempts,emptyFunnel,type Funnel} from './ev-learning-ledger.ts';
import {USD_SCALE} from '../lib/research/ev-arb.ts';
const money=(n:number|null)=>n===null?'UNAVAILABLE':`${n<0?'-':'+'}$${(Math.abs(n)/USD_SCALE).toFixed(4)}`;
const pct=(n:number|null)=>n===null?'INSUFFICIENT_EMPIRICAL_SAMPLE':`${(n*100).toFixed(1)}%`;
export function formatLearningReport(directory:string){
  const snapshot=JSON.parse(readFileSync(resolve(directory,'summary.json'),'utf8')) as {funnel:Funnel;phase:string;reason:string;cash?:{kalshi:number;poly:number}};
  const report=learningReport(readAttempts(directory),snapshot.funnel??emptyFunnel());
  const f=report.funnel,o=report.outcomes,p=report.pnl;
  const first=(v:'kalshi'|'poly')=>{const x=report.byFirst[v];return `${v==='kalshi'?'Kalshi':'PM-US'} first: ${x.attempts} evaluated; clean ${pct(x.cleanHedgeRate)}; unwind ${pct(x.unwindRate)}; orphan ${pct(x.orphanRate)}; mean hedge slip ${money(x.meanHedgeSlippage)}; mean unwind loss ${money(x.meanUnwindLoss)}; EV ${x.evStatus}${x.empiricalEv===null?'':` ${money(x.empiricalEv)}`}`;};
  return ['EV ARB PAPER LEARNING — simulated depth, never real fills',
    `Run: ${snapshot.phase} (${snapshot.reason})`,
    '', 'FUNNEL',`Matched candidates: ${f.matchedCandidates}`,`Fresh two-book depth observations: ${f.usableTwoBookObservations}`,
    `Gross arbs: ${f.grossPositiveObservations}`,`Realistic-net-positive arbs: ${f.realisticNetPositiveObservations}`,
    `EV-positive arbs: ${f.evPositiveObservations}`,`Primary paper attempts: ${f.paperAttempts}`,
    `Counterfactual first-leg evaluations: ${f.counterfactualEvaluations}`,
    '', 'PAPER OUTCOMES',`Clean paired fills: ${o.cleanPairedFills}`,`Disappeared before entry: ${o.disappearedBeforeEntry}`,
    `Unwinds: ${o.unwinds}`,`Orphans: ${o.orphans}`,
    '', 'P&L — projected ordinary settlement for clean pairs, realized simulated exits for unwinds',
    `Gross arb profit: ${money(p.grossPaperProfit)}`,`Fees: ${money(-p.fees)}`,`Normal slippage: ${money(-p.normalSlippage)}`,
    `Unwind losses: ${money(-p.unwindLoss)}`,`Orphan losses resolved: ${money(-p.orphanLoss)}`,
    `NET modeled paper P&L: ${money(p.netModeledPaperPnL)}`,`Unresolved residual cost: ${money(p.unresolvedResidualCost)}`,
    '', 'EXECUTION',first('kalshi'),first('poly'),`Aggregate EV status: ${report.aggregateEvStatus}`,
    '', 'STRESS DIAGNOSTICS',`Extreme-fee-bound failures on gross arbs: ${f.stressFeeFailures}`,
    `One-tick failures on gross arbs: ${f.oneTickFailures}`,`Freshness failures: ${f.freshnessFailures}`,
    `Settlement-risk warnings: ${f.settlementWarnings}`,`Realistic-net observations that old stress fee alone blocked: ${f.oldStressOnlyRejections}`,
    `Closest fresh observation: ${f.closest?`${f.closest.pairId} ${f.closest.orientation} gross ${money(f.closest.grossProfit)} net ${money(f.closest.estimatedNetProfit)}`:'NONE'}`,
    `Available simulated cash: Kalshi ${money(snapshot.cash?.kalshi??null)}, PM-US ${money(snapshot.cash?.poly??null)}`].join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(!process.argv[2])throw Error('Usage: npm run research:ev-report -- SESSION_DIR');
  console.log(formatLearningReport(resolve(process.argv[2])));
}
