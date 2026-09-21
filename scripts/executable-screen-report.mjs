// Read-only derivation from an explicitly provided screen snapshot. No polling.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const [input,jsonOutput,markdownOutput]=process.argv.slice(2);
if(!input||!jsonOutput||!markdownOutput)throw Error('Usage: executable-screen-report.mjs INPUT_DIR SUMMARY_JSON REPORT_MD');
const load=name=>JSON.parse(readFileSync(resolve(input,name),'utf8'));
const coverage=load('coverage.json'),frozen=load('frozen.json'),s=load('summary.json'),status=load('status.json');
const completed=s.phase==='STOPPED'&&status.phase==='STOPPED'&&status.exitCode===0&&s.durationMs>=frozen.policy.durationMs-1000;
const categories=Object.keys(coverage.counts).sort(),routes=['TAKER_TAKER','MAKER_TAKER_HYPOTHETICAL'];
const rows=[];
for(const category of categories)for(const route of routes){
 const best=list=>list.filter(r=>r.category===category&&r.route===route).sort((a,b)=>b.economics.exchangeNetUnderFeeBound-a.economics.exchangeNetUnderFeeBound||a.at-b.at)[0]??null;
 rows.push({category,route,strongestFresh:best(s.bestFresh),strongestDisplayed:best(s.bestDisplayed)});
}
const report={version:1,scope:s.scope,completion:completed?'COMPLETED_BOUNDED_SCREEN':s.phase==='RUNNING'?'PENDING_COLLECTION':'STOPPED_INCOMPLETE',
 startedAt:s.startedAt,observedThrough:s.endedAt??s.startedAt+s.durationMs,deadlineAt:status.deadlineAt,
 durationMs:s.durationMs,policy:frozen.policy,freezeSha256:createHash('sha256').update(readFileSync(resolve(input,'frozen.json'))).digest('hex'),
 coverage:{catalogComplete:coverage.catalogComplete,catalogErrors:coverage.catalogErrors,listing:coverage.listing,matchingDiagnostics:coverage.matchingDiagnostics,matched:coverage.matched,selected:coverage.selected,counts:coverage.counts,reviewCounts:coverage.reviewCounts,capReason:coverage.capReason,omittedCount:coverage.omitted.length,
   subscriptions:{kalshi:coverage.subscriptions.kalshi.length,poly:coverage.subscriptions.poly.length},
   selected:frozen.selection.map(x=>({pairId:x.pair.id,kalshiId:x.pair.a.id,polyId:x.pair.b.id,inverted:x.pair.inverted,classification:x.assessment.classification,labels:x.labels,matchingReasons:x.matchingReasons}))},
 observations:{samples:s.samples,rows:s.rows,withEconomics:s.withEconomics,freshTakerTakerObservations:s.executable,uniqueBooksSeen:s.uniqueBooksSeen,expectedUniqueBooks:s.expectedUniqueBooks,neverReceived:s.neverReceived,failures:s.failures,dataRejections:s.dataRejections,policyRejections:s.policyRejections},rows,
 qualification:'No row authorizes orders. No reviewed settlement pairs, unknown account precision/fragmentation and Ohio live eligibility not revalidated. Fresh taker rows describe displayed depth only; maker rows propose a bid, not an available fill.',
 evidence:'Local evidence.ndjson bookSha256 references preserve the exact candidate books. Public summary includes only public identifiers, derived levels/economics, timestamps and hashes; no account or ledger data.'};
writeFileSync(jsonOutput,JSON.stringify(report,null,2)+'\n');
const usd=x=>(x/10000).toFixed(4),iso=x=>new Date(x).toISOString(),escape=s=>String(s).replaceAll('|','/');
const text=[`# Executable-price screen — ${completed?'completed bounded observation':'PENDING: interim observation'}`,'',
`Observed ${iso(report.startedAt)} through ${iso(report.observedThrough)}. Scheduled hard stop: ${iso(report.deadlineAt)}. Completion: **${report.completion}**. This is a new September 21 screen; the September 20 maker audit is historical.`,
'',`Matched ${coverage.matched} routes; selected ${coverage.selected} across ${categories.length} categories. Books received: ${s.uniqueBooksSeen}/${s.expectedUniqueBooks}. Catalog complete: ${coverage.catalogComplete}. Feed failures: ${JSON.stringify(s.failures)}. ${coverage.omitted.length} routes omitted by the declared finite cap.`,
'',`Review classes: ${JSON.stringify(coverage.reviewCounts)}. Samples: ${s.samples}; route/side observations: ${s.rows}; observations with economics: ${s.withEconomics}; fresh taker/taker depth observations: ${s.executable} (not unique opportunities or fills).`,
'','The table prefers the strongest fresh row in each category/route; when none exists it explicitly shows a stale/unknown-time comparison. The JSON separately retains the strongest displayed row even when a weaker fresh row exists. All values are USD for the shown quantity, under the labeled fee bounds. Recovery is reserved cash, not an expense.',
'','| Category / route | UTC observation | Qty | Exchange net | Risk charge | Recovery cash K / PM | After risk | Freshness; exact policy rejections | Evidence |',
'|---|---|---:|---:|---:|---:|---:|---|---|'];
for(let i=0;i<rows.length;i++){
 const x=rows[i],r=x.strongestFresh??x.strongestDisplayed;
 if(!r){text.push(`| ${escape(x.category)} / ${x.route} | — | — | — | — | — | — | NO_PRICED_ROW; see data-rejection and missing-book counts | row ${i} |`);continue;}
 const e=r.economics;
 text.push(`| ${escape(x.category)} / ${x.route==='TAKER_TAKER'?'T/T':'M/T proposed bid'} | ${iso(r.at).slice(11,23)} | ${e.quantity} | ${usd(e.exchangeNetUnderFeeBound)} | ${usd(e.riskAllowance)} | ${usd(e.recoveryReservation.kalshi)} / ${usd(e.recoveryReservation.poly)} | ${usd(e.afterRisk)} | ${x.strongestFresh?'FRESH':r.dataReasons.join(', ')}; ${r.policyReasons.join(', ')} | JSON row ${i}; ${r.evidence.bookSha256.slice(0,12)} |`);
}
text.push('','All rows additionally remain ORDER_DISABLED, ACCOUNT_FEE_CLASS_AND_FRAGMENTATION_UNVERIFIED and OHIO_LIVE_ELIGIBILITY_NOT_REVALIDATED. M/T rows additionally fail RESTING_BID_IS_NOT_AVAILABLE_FILL. Settlement profile blockers, pair identities, precise sides, used prices/depth, receipt/exchange timestamps and fee provenance are in each JSON row. No realized fills or profit were measured.',
'',`Data-rejection counts: ${JSON.stringify(s.dataRejections)}. These distinguish stale or missing data from absent economic edge. An unchanged book can exceed the strict freshness window even while its connection remains healthy.`,
'','Independent mechanics: 0 production versus 1 counterfactual synthetic queue fill; Kalshi four-fill fee bound $0.04 versus documented one-order $0.01 cent-class / $0.0088 direct-class scenarios; PM known four-fragment fee $0 versus $0.01 cumulative ceiling. Historical capture unchanged. See independent-mechanics-screen-20260921.json and EXECUTABLE-SCREEN.md.',
'','Publication excludes raw books/tape, private account information, credentials and databases. The snapshot above is final only if marked COMPLETED_BOUNDED_SCREEN; otherwise completion remains pending, with no automatic restart.');
writeFileSync(markdownOutput,text.join('\n')+'\n');
console.log(JSON.stringify({completion:report.completion,observedThrough:iso(report.observedThrough),rows:rows.length,books:s.uniqueBooksSeen,expected:s.expectedUniqueBooks}));
