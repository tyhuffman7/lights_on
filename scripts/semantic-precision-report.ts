// Reduce completed native evidence only. Never accesses a venue or recomputes prices.
import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rankedSemanticLists} from '../lib/research/semantic-lists.ts';
const directory=resolve(process.argv[2]),output=resolve(process.argv[3]);
const baseline=process.argv[4]?await import(pathToFileURL(resolve(process.argv[4])).href):null;
const summary=JSON.parse(readFileSync(resolve(directory,'summary.json'),'utf8'));
if(summary.phase!=='STOPPED')throw Error('COLLECTION_MUST_BE_STOPPED');
const classes:Record<string,number>={},freshClasses:Record<string,number>={},broadClasses:Record<string,number>={};
const routes=new Map<string,any>(),broadRoutes=new Map<string,any>(),rejectedRoutes=new Map<string,any>(),wsLatency:number[]=[],freshLatency:number[]=[],allLatency:number[]=[];
const oldCache=new Map<string,boolean>();let hotFalseReadings=0,broadFalseReadings=0,oldWouldPassVeto=0,confirmations=0;
const count=(o:Record<string,number>,k:string)=>o[k]=(o[k]??0)+1;
const q=(xs:number[])=>{xs.sort((a,b)=>a-b);return {n:xs.length,median:xs[Math.floor((xs.length-1)*.5)]??null,p95:xs[Math.floor((xs.length-1)*.95)]??null,max:xs.at(-1)??null};};
for await(const line of createInterface({input:createReadStream(resolve(directory,'evidence.ndjson')),crlfDelay:Infinity})){
 const x=JSON.parse(line),b=x.body;
 if(x.kind==='ECONOMIC_SIGNAL'){
  const c=b.settlement?.classification??'UNRESOLVED';count(broadClasses,c);
  if(c==='DIFFERENT_QUESTION'){
   const orientationKey=b.route.pair.id+':'+b.signal.evaluation.kalshiSide;
   if((rejectedRoutes.get(orientationKey)?.signal.evaluation.estimatedNetProfit??-Infinity)<b.signal.evaluation.estimatedNetProfit)rejectedRoutes.set(orientationKey,b);
   broadFalseReadings++;const key=b.route.pair.id+':'+b.route.pair.a.hash+':'+b.route.pair.b.hash;
   let passed=oldCache.get(key);if(passed===undefined){passed=baseline?!baseline.differentQuestion(b.route).length:false;oldCache.set(key,passed!);}
   if(passed)oldWouldPassVeto++;
  }
  if(b.signal?.fresh&&b.signal?.executable&&b.signal?.candidate){
   const key=b.route.pair.id+':'+b.signal.evaluation.kalshiSide;
   if((broadRoutes.get(key)?.signal.evaluation.estimatedNetProfit??-Infinity)<b.signal.evaluation.estimatedNetProfit)broadRoutes.set(key,b);
  }
 }
 if(x.kind!=='CONFIRMATION')continue;
 confirmations++;const c=b.settlement?.classification??'UNRESOLVED';count(classes,c);allLatency.push(b.quoteToConfirmationMs);
 if(c==='DIFFERENT_QUESTION')hotFalseReadings++;
 if(b.source==='VALID_NATIVE_WS')wsLatency.push(b.quoteToConfirmationMs);
 if(!b.signal.candidate||!b.signal.executable)continue;
 count(freshClasses,c);freshLatency.push(b.quoteToConfirmationMs);const key=b.route.pair.id+':'+b.signal.evaluation.kalshiSide;
 if((routes.get(key)?.signal.evaluation.estimatedNetProfit??-Infinity)<b.signal.evaluation.estimatedNetProfit)routes.set(key,b);
}
const lists=rankedSemanticLists([...routes.values()],b=>b.settlement.classification,b=>b.signal.evaluation.estimatedNetProfit);
const strongest=lists.promotedOpportunities;
const research=lists.unresolvedResearch;
const rejected=rankedSemanticLists([...rejectedRoutes.values()],b=>b.settlement.classification,b=>b.signal.evaluation.estimatedNetProfit).rejectedDifferentQuestions;
const top20=strongest.map((quote,i)=>({rank:i+1,observedClassification:quote.settlement.classification,
 reviewClassification:null,reviewReason:null,quote}));
const result={scope:'PAPER / READ-ONLY. Native repeated quote readings, no fills or realized profit.',
 start:summary.start,deadline:summary.deadline,stopped:summary.phase==='STOPPED',durationObservedMs:summary.durationObservedMs,
 frozen:summary.frozen,discoveredRoutes:summary.matchedRoutes,visitedRoutes:summary.visitedRoutes,twoBookRoutes:summary.twoBookRoutes,
 freshRoutes:summary.freshRoutes,catalog:summary.catalog,semanticRouteCounts:summary.semanticRouteCounts,
 completedConfirmations:confirmations,freshExecutableSurvivors:Object.values(freshClasses).reduce((a,b)=>a+b,0),
 classes,freshClasses,broadEconomicClasses:broadClasses,distinctConfirmedRouteOrientations:routes.size,distinctBroadFreshRouteOrientations:broadRoutes.size,
 hotFalseMatchConfirmations:hotFalseReadings,broadDifferentQuestionEconomicSignals:broadFalseReadings,
 differentQuestionSignalsPriorClassifierWouldPass:baseline?oldWouldPassVeto:null,
 wsOnlySignalLatencyMs:q(wsLatency),freshSurvivorSignalLatencyMs:q(freshLatency),allSignalLatencyMs:q(allLatency),
 summaryLatencyMs:summary.latencyMs,counts:summary.counts,reasons:summary.reasons,
 feedHealth:{total:summary.lastActiveFeedHealth.length,healthy:summary.lastActiveFeedHealth.filter((f:any)=>f.connected).length},
 requests:summary.endpointRequests,requestFailures:summary.requestFailures,
 candidatesForManualReview:top20.length,strictProofs:0,guaranteedArbitrage:false};
mkdirSync(output,{recursive:true});
writeFileSync(resolve(output,'live-receipt.json'),JSON.stringify(result,null,2)+'\n');
writeFileSync(resolve(output,'strongest-review.json'),JSON.stringify({scope:result.scope,candidates:top20},null,2)+'\n');
for(const [name,rows] of [['promoted-opportunities',strongest],['unresolved-research',research],['rejected-different-questions',rejected]] as const)
 writeFileSync(resolve(output,name+'.json'),JSON.stringify({scope:result.scope,candidates:rows.map((quote,i)=>({rank:i+1,observedClassification:quote.settlement.classification,reviewClassification:null,reviewReason:null,quote}))},null,2)+'\n');
writeFileSync(resolve(output,'broad-fresh-routes.json'),JSON.stringify({scope:result.scope,routes:[...broadRoutes.values()].map(b=>({route:b.route,signal:b.signal,settlement:b.settlement}))},null,2)+'\n');
console.log(JSON.stringify(result,null,2));
