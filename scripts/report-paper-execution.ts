import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {executionReport} from '../lib/research/paper-execution-report.ts';
import {USD_SCALE} from '../lib/research/ev-arb.ts';
const directory=resolve(process.argv[2]??''),output=resolve(process.argv[3]??directory);
const summary=JSON.parse(readFileSync(resolve(directory,'summary.json'),'utf8'));
if(summary.phase!=='STOPPED')throw Error('COLLECTION_MUST_BE_STOPPED');
const study=JSON.parse(readFileSync(resolve(directory,'paper-study.json'),'utf8'));
if(study.pending!==0)throw Error('PENDING_CAPTURE');
const report=executionReport(study,summary.at-summary.start);mkdirSync(output,{recursive:true});
writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const ids=new Set(report.baseline.entries.map(e=>e.episodeId));
const ledger=study.episodes.map((e:any)=>({...e,netEdges:{samples:e.netEdges.length,median:[...e.netEdges].sort((a:number,b:number)=>a-b)[Math.floor((e.netEdges.length-1)/2)],maximum:Math.max(...e.netEdges)}}));
writeFileSync(resolve(output,'episode-ledger.json'),JSON.stringify({scope:report.scope,episodes:ledger},null,2)+'\n');
const representative=study.episodes.filter((e:any)=>ids.has(e.id)).sort((a:any,b:any)=>(b.attempts.find((x:any)=>x.delayMs===100&&x.capDollars===10)?.ordinaryProfit??-Infinity)-(a.attempts.find((x:any)=>x.delayMs===100&&x.capDollars===10)?.ordinaryProfit??-Infinity)).slice(0,10);
writeFileSync(resolve(output,'representative-opportunities.json'),JSON.stringify({scope:report.scope,episodes:representative},null,2)+'\n');
const money=(n:number|null)=>n===null?'Unpriced':`$${n.toFixed(4)}`;
const b=report.baseline,l=report.latencySurvival;
let md=`# Paper economics — 2026-10-01\n\n**${report.conclusion}**\n\nFrozen source/strategy, ${report.observationMinutes.toFixed(2)} minutes. ${report.scope}\n\n`;
md+='| Metric | Result |\n|---|---:|\n';
for(const [k,v] of Object.entries({'Unique promoted episodes':report.episodes,'Strict arb episodes':report.classes.STRICT_EQUIVALENT??0,'Basis-risk episodes':report.classes.ORDINARY_EQUIVALENT_BASIS_RISK??0,
 'Baseline-cap eligible episodes':l[0].eligibleEpisodes,'Clean pairs at 25 ms':l.find(x=>x.delayMs===25)!.cleanPairs,'Clean pairs at 100 ms':l.find(x=>x.delayMs===100)!.cleanPairs,'Clean pairs at 250 ms':l.find(x=>x.delayMs===250)!.cleanPairs,
 'Edge disappearances at 100 ms':l.find(x=>x.delayMs===100)!.outcomes.EDGE_DISAPPEARED??0,'Partial / first-only at 100 ms':(l.find(x=>x.delayMs===100)!.outcomes.PARTIAL_HEDGE??0)+(l.find(x=>x.delayMs===100)!.outcomes.FIRST_LEG_ONLY??0),
 'Unobserved at 100 ms':l.find(x=>x.delayMs===100)!.outcomes.UNOBSERVED??0,'Capital-admitted baseline entries':b.acceptedEntries,'Paper capital committed':money(b.paperCommittedDollars),'Peak concurrent capital locked':money(b.peakLockedDollars),
 'Known ordinary profit subtotal':money(b.knownOrdinaryProfitSubtotalDollars),'Modeled ordinary portfolio P&L':money(b.modeledPortfolioPnlDollars),'Return on committed capital':b.returnOnCommittedCapital===null?'Unpriced':(b.returnOnCommittedCapital*100).toFixed(2)+'%',
 'Median per-contract net edge':money(report.medianPerContractNetDollars),'Median observed episode duration':report.episodeDurationMs.median===null?'N/A':(report.episodeDurationMs.median/1000).toFixed(2)+'s','Recurring route/orientations':report.recurringRoutes,'Quote content updates (not trades)':report.quoteUpdates,
 'Left / right censored episodes':`${report.leftCensored} / ${report.rightCensored}`}))md+=`| ${k} | ${v} |\n`;
md+='\n## Latency survival — $10 cap\n\n| Delay | Eligible | Observable | Clean | Partial | Edge gone | First only | Unobserved | Clean / all |\n|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for(const x of l)md+=`| ${x.delayMs} ms | ${x.eligibleEpisodes} | ${x.observed} | ${x.cleanPairs} | ${x.outcomes.PARTIAL_HEDGE??0} | ${x.outcomes.EDGE_DISAPPEARED??0} | ${x.outcomes.FIRST_LEG_ONLY??0} | ${x.outcomes.UNOBSERVED??0} | ${x.cleanFractionAllEpisodes===null?'N/A':(x.cleanFractionAllEpisodes*100).toFixed(1)+'%'} |\n`;
md+='\n## Capital sensitivity — 100 ms, $200 simulated bankroll\n\nEach row is an alternative chronological portfolio, one entry per episode with held-market overlap suppression. Never add rows together.\n\n| Entry cap | Entries | Clean | Committed | Peak locked | Known profit subtotal | Full P&L | ROI | Unpriced exposure |\n|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for(const x of report.capitalSensitivity)md+=`| $${x.capDollars} | ${x.acceptedEntries} | ${x.outcomes.CLEAN_PAIR??0} | ${money(x.paperCommittedDollars)} | ${money(x.peakLockedDollars)} | ${money(x.knownOrdinaryProfitSubtotalDollars)} | ${money(x.modeledPortfolioPnlDollars)} | ${x.returnOnCommittedCapital===null?'Unpriced':(x.returnOnCommittedCapital*100).toFixed(2)+'%'} | ${money(x.unpricedExposureDollars)} |\n`;
md+=`\nFamilies: ${JSON.stringify(report.families)}. ${report.uniqueRoutes} route/orientations; ${report.recurringRoutes} repeated; max ${report.maxEpisodesPerRoute} episodes per route. Observed rate ${report.observedEpisodeRatePerHour?.toFixed(1)??'N/A'}/hour includes left-censored initial inventory and gap-censored resumptions; it is not an extrapolated arrival rate.\n\n`;
md+=`Baseline lockup proxy: median ${b.lockupDays.median?.toFixed(1)??'unknown'} days, max ${b.lockupDays.max?.toFixed(1)??'unknown'} days, unknown horizons ${b.lockupDays.unknown}. Later native close + 24-hour assumed buffer; actual settlement/administrative extensions unproven. No settlement funds recycled.\n\n`;
md+='All counts are conditional native displayed-depth simulations. Actual both-leg fills, repeatable realized net profit and rare settlement-divergence probabilities remain unproven. Strict and basis economics are separated in the machine-readable report and episode certificates. No live-money recommendation or authorization.\n\n';
md+='[Methodology](METHODOLOGY.md), [full report](report.json), [episode ledger](episode-ledger.json), [strongest capital-admitted opportunities](representative-opportunities.json).\n';
writeFileSync(resolve(output,'RESULTS.md'),md);
console.log(JSON.stringify({conclusion:report.conclusion,episodes:report.episodes,classes:report.classes,baseline:{entries:b.acceptedEntries,pnl:b.modeledPortfolioPnlDollars,knownSubtotal:b.knownOrdinaryProfitSubtotalDollars,locked:b.peakLockedDollars},latency:l.map(x=>({ms:x.delayMs,clean:x.cleanPairs,observed:x.observed}))}));
