// Read-only reduction of retained native evidence; never regenerates market data.
import {readFileSync,createReadStream,writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
const directory=resolve(process.argv[2]),out=process.argv[3];
const summary=JSON.parse(readFileSync(resolve(directory,'summary.json'),'utf8'));
const quantile=(ns:number[])=>{const a=ns.sort((a,b)=>a-b);return {n:a.length,median:a.length?a[Math.floor((a.length-1)*.5)]:null,p95:a.length?a[Math.floor((a.length-1)*.95)]:null,max:a.at(-1)??null};};
const queue:number[]=[],work:number[]=[],signal:number[]=[],freshSignal:number[]=[],freshQueue:number[]=[],freshWork:number[]=[];
const classes:Record<string,number>={},freshClasses:Record<string,number>={},sources:Record<string,number>={};
let confirmations=0,survivors=0,fresh=0;const retained=new Map<string,any>();const failures:Record<string,number>={};
for await(const line of createInterface({input:createReadStream(resolve(directory,'evidence.ndjson')),crlfDelay:Infinity})){
 const x=JSON.parse(line),b=x.body;
 if(x.kind==='HTTP_PUBLIC_FAILURE'){const k=b.host+':'+b.path+':'+b.reason;failures[k]=(failures[k]??0)+1;}
 if(x.kind!=='CONFIRMATION')continue;confirmations++;queue.push(b.queueWaitMs);work.push(b.confirmationWorkMs);signal.push(b.quoteToConfirmationMs);
 const c=b.settlement?.classification??'UNRESOLVED';classes[c]=(classes[c]??0)+1;sources[b.source??'LEGACY_REST']=(sources[b.source??'LEGACY_REST']??0)+1;
 if(!b.signal.candidate)continue;survivors++;
 if(b.signal.executable){fresh++;freshSignal.push(b.quoteToConfirmationMs);freshQueue.push(b.queueWaitMs);freshWork.push(b.confirmationWorkMs);
  freshClasses[c]=(freshClasses[c]??0)+1;const key=b.route.pair.id+':'+b.signal.evaluation.kalshiSide;
  if((retained.get(key)?.signal.evaluation.estimatedNetProfit??-Infinity)<b.signal.evaluation.estimatedNetProfit)retained.set(key,b);}
}
const report={scope:'PAPER / READ-ONLY; repeated readings, no orders, fills or realized profit',start:summary.start,deadline:summary.deadline,
 stopped:summary.phase==='STOPPED',durationObservedMs:summary.durationObservedMs,frozen:summary.frozen,
 freshExecutablePositives:summary.counts.freshExecutablePositive??0,confirmationDispatches:summary.counts.confirmationRequests??0,
 completedConfirmations:confirmations,economicSurvivors:survivors,freshExecutableSurvivors:fresh,
 queueAtStop:summary.pendingConfirmations,peakQueue:summary.peakPendingConfirmations,
 queueWaitMs:quantile(queue),confirmationWorkMs:quantile(work),signalToConfirmationMs:quantile(signal),
 freshSurvivorLatency:{signalMs:quantile(freshSignal),queueMs:quantile(freshQueue),workMs:quantile(freshWork)},
 restPmUsBookCalls:summary.endpointRequests?.['gateway.polymarket.us:book']??null,
 pmUs429s:summary.requestFailures?.['gateway.polymarket.us:HTTP_429']??0,
 confirmationsEntirelyValidWs:summary.counts.confirmationsEntirelyValidWs??0,candidatesSuperseded:summary.candidatesSuperseded,
 candidatesDisappearedBeforeDispatch:summary.candidatesDisappearedBeforeDispatch,candidatesExpiredBeforeDispatch:summary.counts.candidatesExpiredBeforeDispatch??0,
 disappearedAtConfirmation:summary.counts.confirmationDisappeared??0,falseMatchRoutes:summary.falseMatchRoutes,
 falseMatchPositiveReadings:summary.counts.falseMatchPositiveReadings??0,classes,freshClasses,sources,
 confirmationsPerSecond:confirmations/(summary.durationObservedMs/1000),failures,requests:summary.endpointRequests,
 hot:{promotions:summary.counts.hotPromotions,demotions:summary.counts.hotDemotions,peak:summary.peakHotRoutes,atStop:summary.hotRoutes},
 catalog:summary.catalog,catalogCycles:summary.catalogCycles,feedHealth:summary.lastActiveFeedHealth,
 strongestSurvivors:[...retained.values()].sort((a,b)=>b.signal.evaluation.estimatedNetProfit-a.signal.evaluation.estimatedNetProfit).slice(0,20)};
if(out)writeFileSync(resolve(out),JSON.stringify(report,null,2)+'\n');else console.log(JSON.stringify({...report,strongestSurvivors:report.strongestSurvivors.map(b=>({id:b.route.pair.id,net:b.signal.evaluation.estimatedNetProfit,quantity:b.signal.evaluation.quantity,classification:b.settlement?.classification})),feedHealth:{total:report.feedHealth.length,healthy:report.feedHealth.filter((f:any)=>f.connected).length}},null,2));
