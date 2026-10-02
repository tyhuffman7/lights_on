import {readFileSync,writeFileSync,mkdirSync,createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {realismReport,realismPolicy,type Evidence} from '../lib/research/execution-realism.ts';
const directory=resolve(process.argv[2]??''),output=resolve(process.argv[3]??directory);
const summary=JSON.parse(readFileSync(resolve(directory,'summary.json'),'utf8'));
if(summary.phase!=='STOPPED')throw Error('COLLECTION_MUST_BE_STOPPED');
const study=JSON.parse(readFileSync(resolve(directory,'paper-study.json'),'utf8'));
if(study.pending!==0)throw Error('PENDING_CAPTURE');
const evidence=new Map<number,Evidence>(),hash=createHash('sha256');let bytes=0,rows=0;
for await(const line of createInterface({input:createReadStream(resolve(directory,'evidence.ndjson')),crlfDelay:Infinity})){
 hash.update(line+'\n');bytes+=Buffer.byteLength(line+'\n');rows++;
 const {kind,body}=JSON.parse(line);
 if(kind==='PAPER_EPISODE_START')evidence.set(body.episode.id,{initial:body.books,future:new Map(),unwind:new Map()});
 if(kind==='PAPER_LATENCY_STATE')evidence.get(body.id)!.future.set(body.delayMs,body.book);
 if(kind==='PAPER_UNWIND_BOOK')evidence.get(body.id)!.unwind.set(body.delayMs,body.book);
}
const report=realismReport(study.episodes,evidence,summary.at-summary.start);
mkdirSync(output,{recursive:true});
writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
writeFileSync(resolve(output,'evidence-receipt.json'),JSON.stringify({rows,bytes,sha256:hash.digest('hex'),episodesWithInitialEvidence:evidence.size,collectorPhase:summary.phase,pending:study.pending,reasons:summary.reasons},null,2)+'\n');
const money=(n:number|null)=>n===null?'UNOBSERVED':`$${n.toFixed(4)}`;
let md=`# Execution realism checkpoint\n\n${report.observationHours.toFixed(3)} hours; ${report.uniqueEpisodes} conservative unique economic episodes (${report.captureSegments} freshness capture segments), ${report.episodesPerHour.toFixed(2)} episodes/hour including initial inventory. ${report.confirmedReturns} witnessed returns on ${report.recurringRoutes} recurring routes.\n\n${report.scope}\n\nClasses: ${JSON.stringify(report.classes)}. Families: ${JSON.stringify(report.families)}.\n\n`;
md+='## Execution survival — first eligible $10-cap sample per economic episode\n\n| Model | Delay ms | Eligible | Clean | Partial | Failed hedge | Unwind | Orphan | Unobserved hedge | Unobserved unwind | Reduced first fill | Retained edge | Reduced edge |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for(const s of report.survival.filter(s=>['DISPLAYED','HAIRCUT_50'].includes(s.model)))md+=`| ${s.model} | ${s.delayMs} | ${s.eligible} | ${s.outcomes.CLEAN_PAIR??0} | ${s.outcomes.PARTIAL_HEDGE??0} | ${(s.outcomes.EDGE_DISAPPEARED??0)+(s.outcomes.FIRST_LEG_ONLY??0)} | ${s.terminal.UNWIND??0} | ${s.terminal.ORPHAN??0} | ${s.outcomes.UNOBSERVED??0} | ${(s.terminal.UNOBSERVED??0)-(s.outcomes.UNOBSERVED??0)} | ${s.reducedFirstFills} | ${s.retainedEdge} | ${s.reducedEdge} |\n`;
md+='\n## Alternative $200 portfolios — 100 ms\n\n$100 simulated cash per venue, no settlement recycling, chronological entries, held-market overlap suppression, observed unwind proceeds returned. Caps are alternative portfolios, never summed.\n\n| Model | Paired cap | Entries | Committed | Peak locked | Ordinary gross | Fees | Slippage diagnostic | Unwind loss | Known net subtotal | Full modeled net | ROI committed | ROI peak | Mean / median entry | Worst | Median lockup days |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
const pct=(n:number|null)=>n===null?'UNOBSERVED':(n*100).toFixed(2)+'%';
for(const p of report.portfolios.filter(p=>p.delayMs===100))md+=`| ${p.model} | $${p.capDollars} | ${p.entries} | ${money(p.committed)} | ${money(p.peakLocked)} | ${money(p.grossOrdinary)} | ${money(p.fees)} | ${money(p.executionSlippage)} | ${money(p.unwindLoss)} | ${money(p.knownPnl)} | ${money(p.netPnl)} | ${pct(p.roiCommitted)} | ${pct(p.roiPeak)} | ${money(p.averageProfit)} / ${money(p.medianProfit)} | ${money(p.worstTrade)} | ${p.medianLockupDays?.toFixed(1)??'Unknown'} |\n`;
md+='\nGross already includes actual consumed depth and observed price movement; slippage and unwind columns explain modeled P&L and must not be subtracted twice. Unobserved hedge/residual valuation makes full net and ROI null. Unknown settlement horizons remain locked indefinitely; finite horizons are later native close + 24h proxies, not observed settlement.\n\n';
md+='## Negative modeled trades\n\nAll negative fully priced execution outcomes, including trades rejected by portfolio capital, appear in report survival rows. Each accepted negative trade is listed below; incomplete exposure is separately unpriced.\n\n';
for(const p of report.portfolios.filter(p=>p.delayMs===100))for(const t of p.negativeTrades)md+=`- ${p.model}, $${p.capDollars} cap, episode ${t.episodeId}: ${money(t.attempt.negativeKnownPnl===null?null:t.attempt.negativeKnownPnl/100_000_000)}, ${t.attempt.outcome} / ${t.attempt.unwind?.outcome}.\n`;
md+='\n## Representative trades and basis clauses\n\n';
const baseline=report.baseline,sorted=[...baseline.ledger].filter(e=>e.attempt.negativeKnownPnl!==null).sort((a,b)=>b.attempt.negativeKnownPnl!-a.attempt.negativeKnownPnl!);
for(const t of [sorted[0],sorted.at(-1)]){
 if(!t||t.attempt.negativeKnownPnl===null)continue;
 const e=study.episodes.find((e:any)=>e.id===t.episodeId);
 md+=`- Episode ${t.episodeId}: ${e.route.pair.a.title}; ${e.side}, paired ${t.attempt.pairedQuantity}/${t.attempt.targetQuantity} target contracts, modeled net ${money(t.attempt.negativeKnownPnl/100_000_000)}, ${t.lockupDays?.toFixed(1)??'unknown'} days lockup proxy. Native IDs: ${e.route.pair.a.id} × ${e.route.pair.b.id}.\n`;
}
writeFileSync(resolve(output,'basis-clauses.json'),JSON.stringify({scope:'No divergence probabilities assigned',episodes:study.episodes.map((e:any)=>({id:e.id,classification:e.settlement.classification,certificate:e.settlement.certificate,divergenceBranches:e.settlement.divergenceBranches,blockers:e.settlement.blockers,kalshiRules:e.route.pair.a.rules,polyRules:e.route.pair.b.rules}))},null,2)+'\n');
md+='\nExceptional divergence branches across admitted families: '+JSON.stringify([...new Set(study.episodes.flatMap((e:any)=>e.settlement.divergenceBranches))])+'. No probability assigned.\n';
md+='\nPublic books cannot identify competing takers, hidden order fragmentation or our fill priority. The deterministic depth haircut is a bounded sensitivity, not a probability. Basis exceptional clauses and native rules are retained in [basis clauses](basis-clauses.json). Fee evidence and assumptions are in [methodology](METHODOLOGY.md). No real fill, realized profit or live authorization.\n\n';
md+='[Machine-readable outcomes and every portfolio entry](report.json), [raw evidence receipt](evidence-receipt.json).\n\n';
md+=report.conclusion+'\n';
writeFileSync(resolve(output,'RESULTS.md'),md);
console.log(JSON.stringify({hours:report.observationHours,episodes:report.uniqueEpisodes,classes:report.classes,baseline:{entries:baseline.entries,pnl:baseline.netPnl,knownPnl:baseline.knownPnl,locked:baseline.peakLocked},conclusion:report.conclusion}));
