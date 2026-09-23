// Offline reduction of the frozen observation. Publishes derived statistics only.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {nonSportsFamilies,nonSportsFamily} from '../lib/research/non-sports.ts';
const median=(xs:number[])=>{const a=xs.filter(Number.isFinite).sort((a,b)=>a-b),n=a.length;return n?n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2:null;};
const maximum=(xs:number[])=>xs.length?Math.max(...xs):null;
const count=(xs:string[])=>xs.reduce((o,k)=>(o[k]=(o[k]??0)+1,o),{} as Record<string,number>);
export function summarizeNonSports(dir:string,output:string){
 const freeze=JSON.parse(readFileSync(resolve(dir,'freeze.json'),'utf8')),receipt=JSON.parse(readFileSync(resolve(dir,'receipt.json'),'utf8'));
 const tape=readFileSync(resolve(dir,'observations.jsonl'),'utf8');
 const rows=tape.trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
 const samples=rows.filter(r=>r.type==='SAMPLE').map(r=>r.body),confirmations=rows.filter(r=>r.type==='CONFIRMATION').map(r=>r.body),intervals=JSON.parse(readFileSync(resolve(dir,'intervals.json'),'utf8'));
 const perRoute=freeze.selected.map((c:any)=>{
  const pair=c.pair,rs=samples.filter(r=>r.pairId===pair.id&&r.kind==='scheduled'),f=nonSportsFamily(pair.a)??'sports';
  const bestOne=rs.flatMap(r=>{const qs=r.quotes.filter((q:any)=>q.quantity===1);return qs.length?[qs.sort((a:any,b:any)=>b.feeNetGap-a.feeNetGap)[0]]:[];});
  const all=rs.flatMap(r=>r.quotes),positive=all.filter(q=>q.feeNetSurplus>0&&q.smallCapital),episodes=intervals.filter((r:any)=>r.key.startsWith(pair.id+':'));
  const conf=confirmations.filter(c=>c.pairId===pair.id),best=[...all].sort((a,b)=>b.feeNetGap-a.feeNetGap||a.quantity-b.quantity)[0];
  const days=[pair.a.closeAt,pair.b.closeAt].map(d=>(Date.parse(d)-receipt.startedAt)/86400000).filter(Number.isFinite);
  const diagnostics=[];
  if(pair.a.series==='KXCPI')diagnostics.push('Known CPI missing-release/shutdown fallback incompatibility; not arbitrage');
  if(pair.a.series==='KXRANKLIST1SONG')diagnostics.push('Legacy monthly-ever #1 versus particular weekly #1 candidate; incompatible observation window');
  if(/ELIMINATION/.test(pair.a.series??''))diagnostics.push('Elimination deadline ET/PT and before/by need review; same broadcast date is insufficient');
  if(c.reasons.some((r:string)=>r.includes('subjects remain distinct')))diagnostics.push('Work-to-artist review link; not exact subject identity');
  if(pair.a.series?.startsWith('KXIPO'))diagnostics.push('Calendar deadline only; time boundary and regulatory jurisdiction unverified');
  return {pairId:pair.id,family:f,subfamily:rs[0]?.subfamily??null,kalshiId:pair.a.id,polyId:pair.b.id,kalshiTitle:pair.a.title,polyTitle:pair.b.title,
   kalshiUrl:pair.a.url,polyUrl:pair.b.url,status:'UNVERIFIED',diagnostics,
   scheduledSamples:rs.length,simultaneousResponses:rs.filter(r=>r.simultaneousResponse).length,usableDepthSamples:rs.filter(r=>r.usableDepth).length,strictExecutionSamples:0,
   q1:{samples:bestOne.length,medianRawGap:median(bestOne.map(q=>q.rawGap)),maxRawGap:maximum(bestOne.map(q=>q.rawGap)),medianFeeNetGap:median(bestOne.map(q=>q.feeNetGap)),maxFeeNetGap:maximum(bestOne.map(q=>q.feeNetGap))},
   bestObservedAnyQuantity:best?{quantity:best.quantity,aSide:best.aSide,bSide:best.bSide,rawGap:best.rawGap,feeNetGap:best.feeNetGap,kalshiCost:best.kalshiCost,polyCost:best.polyCost,smallCapital:best.smallCapital}:null,
   positiveQuantities:[...new Set(positive.map(q=>q.quantity))].sort((a:any,b:any)=>a-b),positiveSpells:episodes.length,observedNonpositiveToPositiveTransitions:episodes.filter((r:any)=>!r.leftCensored).length,
   spanMs:episodes.map((r:any)=>r.spanMs),censoredSpells:episodes.filter((r:any)=>r.leftCensored||r.reason!=='NONPOSITIVE').length,
   confirmations:count(conf.map(c=>c.status)),dataReasons:count(rs.flatMap(r=>r.reasons)),strictReasons:count(rs.flatMap(r=>r.strictReasons)),
   indicativeAdministrativeCloseDays:{earliest:days.length?Math.min(...days):null,latest:maximum(days)},
   feeRates:{kalshi:pair.a.feeRate,poly:pair.b.feeRate},minQuantity:{kalshi:pair.a.minQty,poly:pair.b.minQty}};
 });
 const families=[...nonSportsFamilies,'sports'].map(f=>{const rs=perRoute.filter((r:any)=>r.family===f),positive=rs.filter((r:any)=>r.positiveSpells),ds=rs.flatMap((r:any)=>r.spanMs);return {family:f,
  selectedRoutes:rs.length,observedRoutes:rs.filter((r:any)=>r.scheduledSamples>0).length,simultaneousResponseRoutes:rs.filter((r:any)=>r.simultaneousResponses>0).length,usableDepthRoutes:rs.filter((r:any)=>r.usableDepthSamples>0).length,strictExecutionUsableRoutes:0,
  scheduledSamples:rs.reduce((n:number,r:any)=>n+r.scheduledSamples,0),usableDepthSamples:rs.reduce((n:number,r:any)=>n+r.usableDepthSamples,0),q1Routes:rs.filter((r:any)=>r.q1.samples>0).length,
  medianRouteMedianRawGap:median(rs.flatMap((r:any)=>r.q1.medianRawGap===null?[]:[r.q1.medianRawGap])),maxRawGap:maximum(rs.flatMap((r:any)=>r.q1.maxRawGap===null?[]:[r.q1.maxRawGap])),
  medianRouteMedianFeeNetGap:median(rs.flatMap((r:any)=>r.q1.medianFeeNetGap===null?[]:[r.q1.medianFeeNetGap])),maxFeeNetGap:maximum(rs.flatMap((r:any)=>r.q1.maxFeeNetGap===null?[]:[r.q1.maxFeeNetGap])),
  positiveRoutes:positive.length,positiveSpells:rs.reduce((n:number,r:any)=>n+r.positiveSpells,0),observedOnsets:rs.reduce((n:number,r:any)=>n+r.observedNonpositiveToPositiveTransitions,0),
  maxPositiveQuantity:maximum(rs.flatMap((r:any)=>r.positiveQuantities)),medianSampledSpanMs:median(ds),maxSampledSpanMs:maximum(ds),
  confirmations:count(confirmations.filter(c=>c.family===f).map(c=>c.status)),medianAdministrativeCloseDays:median(rs.flatMap((r:any)=>r.indicativeAdministrativeCloseDays.latest===null?[]:[r.indicativeAdministrativeCloseDays.latest])),
  dataReasons:count(samples.filter(r=>r.family===f&&r.kind==='scheduled').flatMap(r=>r.reasons))};});
 const result={scope:freeze.policy.scope,receipt,policy:freeze.policy,freezeCodeHashes:freeze.codeHashes,privateTapeSha256:createHash('sha256').update(tape).digest('hex'),
  units:'price gaps and costs in $0.0001 units; divide gaps by 100 for cents per matched contract',
  aggregation:'At quantity 1 choose the better complementary direction per scheduled observation, then per-route median, then equal-weight family median. No weighting by update count. All-quantity positives are one spell per route/direction; gaps censor spells. An onset requires a preceding observed nonpositive sample.',
  limitations:['No route has settlement verification or strict sequenced/requested-stream execution proof. REST reception alone is not execution freshness.','Cached responses, throttles, closed books, excessive response skew and missing depth are excluded; absence of usable quotes is not zero dispersion.','Fee upper bounds are unchanged; Kalshi bound assumes whole-contract fragmentation/cent precision and does not bound arbitrary fractional-fill rounding.','At most 10 matched contracts and $50 indicative cash per venue; no balance, debit, reserve, fill or profit was recorded.','Administrative expiration dates are only lockup proxies. Different close dates are not a settlement equivalence claim.','A short, purposive, highly incomplete sample cannot support a stable culture-versus-sports ranking.'],
  families,ranking:families.filter(f=>f.q1Routes>0).sort((a,b)=>(b.medianRouteMedianFeeNetGap??-Infinity)-(a.medianRouteMedianFeeNetGap??-Infinity)).map(f=>f.family),routes:perRoute};
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({receipt,families}));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [dir,output]=process.argv.slice(2);if(!dir||!output)throw Error('Usage: non-sports-results.ts STUDY_DIR OUTPUT_JSON');summarizeNonSports(dir,output);}
