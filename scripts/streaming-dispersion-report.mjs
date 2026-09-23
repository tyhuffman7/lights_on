// Offline derivation only. Input evidence stays private; output is allowlisted.
import {readFileSync,writeFileSync,createReadStream,statSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const [input,output]=process.argv.slice(2),dir=resolve(input);
const read=name=>JSON.parse(readFileSync(resolve(dir,name),'utf8'));
const summary=read('summary.json'),freeze=read('frozen.json'),started=read('started.json');
if(summary.phase!=='STOPPED'||!summary.endedAt)throw Error('Only a completed bounded study may be reported');
const median=xs=>{const s=xs.filter(Number.isFinite).sort((a,b)=>a-b),n=s.length;return n?n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2:null;};
const maximum=xs=>{const s=xs.filter(Number.isFinite);return s.length?Math.max(...s):null;};
const extrema=new Map(),largestQuantity=new Map();
for await(const line of createInterface({input:createReadStream(resolve(dir,'evidence.ndjson')),crlfDelay:Infinity})){
 const x=JSON.parse(line);if(x.kind!=='DERIVED_CHANGE'||!x.body.usable)continue;
 for(const q of x.body.quotes){const old=extrema.get(q.pairId);if(!old||q.feeNetGapPerContract>old.feeNetGapPerContract)extrema.set(q.pairId,q);
  const size=largestQuantity.get(q.pairId);if(!size||q.quantity>size.quantity||(q.quantity===size.quantity&&q.feeNetSurplus>size.feeNetSurplus))largestQuantity.set(q.pairId,q);
 }
}
const routeFor=key=>key.slice(0,key.lastIndexOf('|'));
const intervals=summary.intervals.map(r=>({...r,routeId:routeFor(r.key),category:summary.routes.find(x=>x.pairId===routeFor(r.key))?.category??null,
 intervalDurationMs:r.observedMs,wallSpanMs:(r.closedAt??summary.endedAt)-r.openedAt,dataGapMs:(r.closedAt??summary.endedAt)-r.openedAt-r.observedMs}));
const confirmations=summary.confirmations.map(c=>({intervalId:c.intervalId,startedAt:c.startedAt,endedAt:c.endedAt,status:c.status,reasons:c.reasons,
 triggerDelayMs:c.triggerDelayMs??null,original:c.original??null,repriced:c.repriced??null,window:c.window??null,
 bookConfirmed:c.bookConfirmed===true,settlementClassification:c.settlementClassification??null,fillClaim:false}));
const confirmed=confirmations.filter(c=>c.status==='EDGE_SURVIVED'&&c.bookConfirmed&&c.repriced?.feeNetSurplus>0);
const rows=summary.routes.map(r=>{
 const e=freeze.selection.find(e=>e.pair.id===r.pairId),review=e.contractReview,ii=intervals.filter(i=>i.routeId===r.pairId),cc=confirmations.filter(c=>ii.some(i=>i.id===c.intervalId));
 const observed=r.priceableMs>0,at=Date.parse(review.indicativeEventAt),days=Number.isFinite(at)&&at>summary.startedAt?(at-summary.startedAt)/86400000:null;
 return {pairId:r.pairId,category:r.category,kalshiId:r.kalshiId,polyId:r.polyId,inverted:e.pair.inverted,settlementClassification:r.classification,
  candidateRoutesMonitored:1,validSimultaneousMs:r.validSimultaneousMs,usablePriceableMs:r.priceableMs,validButNoLegalWholeDepthMs:r.validSimultaneousMs-r.priceableMs,
  coverage:r.validSimultaneousMs===0?'UNAVAILABLE':observed?'OBSERVED_WITH_CENSORING':'STREAMED_BUT_NO_LEGAL_WHOLE_DEPTH',
  rawPositiveIntervals:observed?ii.filter(i=>i.kind==='raw').length:null,feePositiveIntervals:observed?ii.filter(i=>i.kind==='fee').length:null,
  knownFeePositiveOnsets:observed?ii.filter(i=>i.kind==='fee'&&i.knownOnset).length:null,requestedConfirmations:cc.length,
  confirmedPositiveIntervals:new Set(cc.filter(c=>confirmed.includes(c)).map(c=>c.intervalId)).size,
  rawGap:r.rawGap,feeNetGapAtPreferredQuantity:r.feeNetGap,oneContractRawGap:r.oneContractRawGap,oneContractFeeNetGap:r.oneContractFeeNetGap,
  maximumFeeNetGapInRecordedContentChanges:extrema.get(r.pairId)?.feeNetGapPerContract??null,maxFeeNetPerContractQuote:extrema.get(r.pairId)??null,
  quantitySet:r.quantitySet,largestSupportedQuantityQuote:largestQuantity.get(r.pairId)??null,bestTotalFeeNetQuote:r.best,bookContentChanges:r.bookChanges,pricedChanges:r.pricedChanges,exclusionDurationsMs:r.excludedMs,
  indicativeDaysToEvent:days,lockupBasis:review.lockupBasis,administrativeTimes:review.administrativeTimes,
  administrativeDaysFromStart:Object.fromEntries(Object.entries(review.administrativeTimes).map(([k,v])=>[k,Number.isFinite(Date.parse(v))?(Date.parse(v)-summary.startedAt)/86400000:null])),
  contradictoryKalshiExpectedAndLatest:Date.parse(review.administrativeTimes.kalshiExpected)>Date.parse(review.administrativeTimes.kalshiLatest),
  strategyApproved:false,cashReleaseDateCertain:false};
});
function group(name,rs){
 const ids=new Set(rs.map(r=>r.pairId)),ii=intervals.filter(i=>ids.has(i.routeId)),hours=rs.reduce((s,r)=>s+r.usablePriceableMs,0)/3600000;
 const fee=ii.filter(i=>i.kind==='fee'),survived=confirmed.filter(c=>ids.has(c.repriced.pairId));
 return {category:name,candidateRoutesMonitored:rs.length,routesWithUsablePricing:rs.filter(r=>r.usablePriceableMs>0).length,
  validSimultaneousRouteHours:rs.reduce((s,r)=>s+r.validSimultaneousMs,0)/3600000,usablePriceableRouteHours:hours,validButNoLegalWholeDepthRouteHours:rs.reduce((s,r)=>s+r.validButNoLegalWholeDepthMs,0)/3600000,
  rawPositiveIntervals:hours>0?ii.filter(i=>i.kind==='raw').length:null,feePositiveIntervals:hours>0?fee.length:null,
  knownFeePositiveOnsets:hours>0?fee.filter(i=>i.knownOnset).length:null,leftCensoredFeePositiveIntervals:fee.filter(i=>i.leftCensored).length,
  feePositiveIntervalsPerUsableRouteHour:hours>0?fee.length/hours:null,knownFeePositiveOnsetsPerUsableRouteHour:hours>0?fee.filter(i=>i.knownOnset).length/hours:null,
  requestedConfirmations:confirmations.filter(c=>ii.some(i=>i.id===c.intervalId)).length,confirmedPositiveIntervals:new Set(survived.map(c=>c.intervalId)).size,
  rawGapMedianOfRouteTimeMedians:median(rs.map(r=>r.rawGap.median)),maximumRawGap:maximum(rs.map(r=>r.rawGap.max)),
  feeNetGapMedianOfRouteTimeMedians:median(rs.map(r=>r.feeNetGapAtPreferredQuantity.median)),maximumFeeNetGapAtPreferredQuantity:maximum(rs.map(r=>r.feeNetGapAtPreferredQuantity.max)),maximumFeeNetGapInRecordedContentChanges:maximum(rs.map(r=>r.maximumFeeNetGapInRecordedContentChanges)),
  confirmedFeeNetGapMedian:median(survived.map(c=>c.repriced.feeNetGapPerContract)),confirmedFeeNetGapMax:maximum(survived.map(c=>c.repriced.feeNetGapPerContract)),
  supportedQuantities:[...new Set(rs.flatMap(r=>r.quantitySet))].sort((a,b)=>a-b),positiveIntervalDurationsMs:fee.map(i=>i.observedMs),
  settlementClassifications:Object.fromEntries([...new Set(rs.map(r=>r.settlementClassification))].map(s=>[s,rs.filter(r=>r.settlementClassification===s).length])),
  fullyUnpricedRoutes:rs.filter(r=>r.usablePriceableMs===0).map(r=>r.pairId),studyEndedEarly:summary.endedAt<summary.deadlineAt-1000,
  scope:'Descriptive selected-route observation; no population frequency or expected profit claim'};
}
const capitalEfficiency=confirmed.map(c=>{const q=c.repriced,r=rows.find(r=>r.pairId===q.pairId),principalAndFees=q.principal+q.feeBound,days=r.indicativeDaysToEvent;
 return {intervalId:c.intervalId,quote:q,settlementClassification:r.settlementClassification,indicativeDaysToEvent:days,lockupBasis:r.lockupBasis,
  conditionalFeeNetReturnOnPrincipalAndFees:q.feeNetSurplus/principalAndFees,
  conditionalFeeNetReturnOnAllReservedCash:q.feeNetSurplus/q.totalReservedCash,
  indicativeReturnPerDay:days&&r.category!=='company/IPO'?q.feeNetSurplus/principalAndFees/days:null,
  cashReleaseCertain:false,expectedProfitModel:false,strategyApproved:false};});
const result={scope:summary.scope,startedAt:summary.startedAt,endedAt:summary.endedAt,originalDeadlineAt:summary.deadlineAt,durationMs:summary.endedAt-summary.startedAt,
 stopReason:summary.reason,ordersEnabled:false,ledgerAccess:false,freezeSha256:started.freezeSha256,policy:summary.policy,
 evidenceSha256:createHash('sha256').update(readFileSync(resolve(dir,'evidence.ndjson'))).digest('hex'),
 measurementUnits:'Money in integer $0.0001 units; times in milliseconds unless named hours/days. No raw book/tape included.',
 definitions:{categoryMedian:'Median across route time-weighted medians at the preferred total-fee-surplus quantity; routes weighted equally. Preferred-quantity maxima include every evaluation. Separate recorded-content-change maxima search every legal quantity in valid DERIVED_CHANGE records; health-only evaluations are not included in that auxiliary metric.',
  frequency:'Distinct route/direction fee-positive episodes / sum of usable priceable route-hours. Unknown gaps do not create additional episodes; known onsets are separate.',
  zero:'Only within reported usable time. Missing depth/invalid periods and the unobserved remainder of the 90-minute window are censored.',
  confirmed:'Both request-bound book proofs accepted, exact quantity repriced positive, original interval uninterrupted. No settlement or fill guarantee.'},
 categories:[...new Set(rows.map(r=>r.category))].map(c=>group(c,rows.filter(r=>r.category===c))),
 comparison:{culture:group('culture',rows.filter(r=>r.category!=='sports'&&r.category!=='company/IPO')),companyControl:group('company/IPO',rows.filter(r=>r.category==='company/IPO')),sports:group('sports',rows.filter(r=>r.category==='sports'))},
 routes:rows,intervals,confirmations,everyDistinctConfirmedPositiveInterval:confirmed.map(c=>({interval:intervals.find(i=>i.id===c.intervalId),confirmation:c})),capitalEfficiency,
 indicativeCapitalComparisons:rows.map(r=>{const q=r.maxFeeNetPerContractQuote;return {pairId:r.pairId,category:r.category,settlementClassification:r.settlementClassification,
  quote:q,conditionalFeeNetReturnOnPrincipalAndFees:q?q.feeNetSurplus/(q.principal+q.feeBound):null,
  conditionalFeeNetReturnOnAllReservedCash:q?q.feeNetSurplus/q.totalReservedCash:null,indicativeDaysToEvent:r.indicativeDaysToEvent,
  administrativeDaysFromStart:r.administrativeDaysFromStart,lockupBasis:r.lockupBasis,
  confirmed:false,negativeReturnsNotAnnualizedOrRanked:true,cashReleaseCertain:false,expectedProfitModel:false};}),
 reconnections:summary.reconnections,feedEvents:summary.feedEvents,clockFault:summary.clockFault,privateEvidenceBytes:statSync(resolve(dir,'evidence.ndjson')).size,attemptedEvidenceBytes:summary.bytes,
 settlementPasses:rows.filter(r=>r.settlementClassification==='EQUIVALENT').map(r=>r.pairId),fillClaim:false,realizedProfitClaim:false};
writeFileSync(resolve(output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,routes:rows.length,categories:result.categories.map(c=>({category:c.category,usableRouteHours:c.usablePriceableRouteHours,feeIntervals:c.feePositiveIntervals,confirmed:c.confirmedPositiveIntervals})),stopReason:result.stopReason}));
