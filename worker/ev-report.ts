import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {learningReport,readAttempts,emptyFunnel,type Funnel} from './ev-learning-ledger.ts';
import {USD_SCALE} from '../lib/research/ev-arb.ts';
import {bookDigest} from '../lib/research/ev-paper.ts';
import type {StreamBook} from '../lib/research/types.ts';
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
    `Unwinds: ${o.unwinds}`,`Orphans: ${o.orphans}`,`Rejected before attempt: ${o.rejected}`,
    `Counterfactual outcomes: ${report.counterfactualOutcomes.cleanPairedFills} clean, ${report.counterfactualOutcomes.unwinds} unwind, ${report.counterfactualOutcomes.orphans} orphan; modeled P&L ${money(report.counterfactualOutcomes.modeledPnL)} (excluded from primary NET)`,
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
export function verifiedLearningReceipt(directory:string){
  const frozen=JSON.parse(readFileSync(resolve(directory,'frozen.json'),'utf8')) as {startedAt:number;deadline:number;
    universeSha256:string;sourceHashes:Record<string,string>;ordersEnabled:boolean;policy:Record<string,unknown>};
  const snapshot=JSON.parse(readFileSync(resolve(directory,'summary.json'),'utf8')) as {funnel:Funnel;phase:string;reason:string;
    startedAt:number;endedAt:number;shardIndex:number;cash:{kalshi:number;poly:number};exclusions:Record<string,number>;reconnects:Record<string,number>};
  if(snapshot.phase!=='STOPPED'||snapshot.startedAt!==frozen.startedAt||frozen.ordersEnabled!==false)throw Error('INCOMPLETE_OR_UNFROZEN_PAPER_RUN');
  const attempts=readAttempts(directory),bookRows=readFileSync(resolve(directory,'books.ndjson'),'utf8').split('\n').filter(Boolean)
    .map(x=>JSON.parse(x) as {sha256:string;book:StreamBook});
  const hashes=new Set<string>();for(const row of bookRows){if(bookDigest(row.book)!==row.sha256)throw Error('PAPER_BOOK_HASH_MISMATCH');hashes.add(row.sha256);}
  for(const a of attempts){for(const ref of [...Object.values(a.entryBookReferences),...Object.values(a.futureBookReferences)])
    if(!hashes.has(ref.sha256))throw Error('PAPER_BOOK_REFERENCE_MISSING');
    if(a.paperPnL!==a.grossPaperProfit-a.fees-a.normalSlippage-a.unwindLoss-a.orphanLoss)throw Error('PAPER_PNL_NOT_RECONCILED');}
  const report=learningReport(attempts,snapshot.funnel);
  return {version:1,scope:'BOUNDED_DIRECT_KALSHI_PM_US_EV_PAPER',simulation:report.simulation,
    ordersEnabled:false,sourceCodeHashes:frozen.sourceHashes,universeSha256:frozen.universeSha256,
    startedAt:new Date(snapshot.startedAt).toISOString(),endedAt:new Date(snapshot.endedAt).toISOString(),
    deadlineAt:new Date(frozen.deadline).toISOString(),durationMs:snapshot.endedAt-snapshot.startedAt,
    stopReason:snapshot.reason,shardsReached:snapshot.shardIndex,policy:frozen.policy,
    exclusions:snapshot.exclusions,reconnects:snapshot.reconnects,simulatedCashRemaining:snapshot.cash,
    publicBookHashesVerified:hashes.size,attemptReferencesVerified:attempts.length,
    report,attempts:attempts.map(a=>({attemptId:a.attemptId,role:a.attemptRole,pairId:a.pairId,
      marketIds:a.marketIds,orientation:a.orientation,quantity:a.quantity,detectedAt:new Date(a.detectedAt).toISOString(),
      firstLegVenue:a.firstLegVenue,hedgeDelayMs:a.hedgeDelayMs,finalState:a.finalState,
      grossProfit:a.grossProfit,estimatedFees:a.estimatedFees,estimatedNetProfit:a.estimatedNetProfit,
      stressFeeBound:a.stressFeeBound,settlementStatus:a.settlementStatus,settlementWarnings:a.settlementWarnings,
      fees:a.fees,normalSlippage:a.normalSlippage,unwindLoss:a.unwindLoss,orphanLoss:a.orphanLoss,
      residualQuantity:a.residualQuantity,paperPnL:a.paperPnL,
      entryBookReferences:a.entryBookReferences,futureBookReferences:a.futureBookReferences}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(!process.argv[2])throw Error('Usage: npm run research:ev-report -- SESSION_DIR');
  console.log(process.argv.includes('--json')?JSON.stringify(verifiedLearningReceipt(resolve(process.argv[2])),null,2):
    formatLearningReport(resolve(process.argv[2])));
}
