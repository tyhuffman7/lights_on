import {appendFileSync,existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {catalog} from './coverage.ts';
import {getJSON} from '../lib/arb/adapters.ts';
import {discoverCandidates} from '../lib/research/matching.ts';
import {category,review} from '../lib/screen/executable.ts';
import {discoveryPolicy,planDiscovery} from '../lib/screen/discovery.ts';
import {confirmationManifest,integratedPolicy,runConfirmation} from './candidate-confirmation.ts';
const save=(dir:string,name:string,value:unknown)=>{writeFileSync(resolve(dir,name+'.tmp'),JSON.stringify(value,null,2)+'\n');renameSync(resolve(dir,name+'.tmp'),resolve(dir,name));};
const sha=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');

export async function prepareDiscovery(dir:string,root:string){
 mkdirSync(dir,{recursive:true});if(existsSync(resolve(dir,'preparation-started.json')))throw Error('Single-use preparation directory');
 const began=Date.now(),signal=AbortSignal.timeout(discoveryPolicy.preparationTimeoutMs);let requests=0;
 save(dir,'preparation-started.json',{at:began,policy:discoveryPolicy,source:confirmationManifest(root)});
 const data=await catalog(async url=>{if(signal.aborted||++requests>discoveryPolicy.maxCatalogRequests)throw Error('BOUNDED_CATALOG_LIMIT');return getJSON(url);},signal,p=>console.log(JSON.stringify({phase:'DISCOVERY_CATALOG',...p,requests})));
 const matched=discoverCandidates(data.kalshi,data.poly),at=Date.now(),plan=planDiscovery(matched.candidates,at);
 // Public normalized terms stay local. The publication report explicitly allowlists derived fields.
 save(dir,'catalog.json',data);
 const reference=JSON.parse(readFileSync(resolve(root,'docs/research/aoc-contract-review-20260921.json'),'utf8'));
 const batches=plan.batches.map((b,index)=>({index,subscriptions:b.subscriptions,selection:b.selected.map(c=>({pair:c.pair,matchingReasons:c.reasons,existingAssessment:review(c.pair),contractReview:{status:'UNRESOLVED',reviewCompleted:false,referenceCase:c.pair.id===reference.pairId,reason:c.pair.id===reference.pairId?'AOC_REFERENCE_NO_REVIEW_EXPANSION':'NOT_YET_TRIAGED_PRIMARY_TERMS'}}))}));
 const selection=batches.flatMap(b=>b.selection);
 save(dir,'coverage.json',{at,catalogStartedAt:data.at,catalogEndedAt:at,catalogComplete:data.complete,catalogErrors:data.errors,requests,
  listing:{kalshi:data.kalshi.length,poly:data.poly.length},matchingDiagnostics:matched.diagnostics,matched:plan.matchedUnique,selected:selection.length,omitted:plan.omitted,
  categories:Object.fromEntries([...new Set(matched.candidates.map(c=>category(c.pair)))].sort().map(k=>[k,{matched:matched.candidates.filter(c=>category(c.pair)===k).length,selected:selection.filter(c=>category(c.pair)===k).length}])),
  selectionMode:'FULL_SUPPORTED_CATALOG_REFRESH_EXISTING_MATCHER_CATEGORY_ROUND_ROBIN_ATOMIC_BUNDLES',note:'Matcher output is a price-comparison route, never settlement-equivalence proof. Missing listings and omitted routes are not negative economics.'});
 save(dir,'frozen.json',{at,mode:'DISCOVERY',policy:discoveryPolicy,manifest:confirmationManifest(root),batchDurationMs:plan.batchDurationMs,batches,selection,
  plan:'One bounded sequential pass. No market observation outside its recorded batch; no simultaneous-universe or absence claim. No batch retry, extension or restart.'});
 console.log(JSON.stringify({phase:'DISCOVERY_FROZEN',catalogComplete:data.complete,matched:plan.matchedUnique,selected:selection.length,omitted:plan.omitted.length,batches:batches.length,batchDurationMs:plan.batchDurationMs}));
}

export async function runDiscovery(dir:string,root:string,runBatch:typeof runConfirmation=runConfirmation){
 const frozenPath=resolve(dir,'frozen.json'),f=JSON.parse(readFileSync(frozenPath,'utf8'));
 if(existsSync(resolve(dir,'started.json')))throw Error('Single discovery window; no restart');
 if(f.mode!=='DISCOVERY'||JSON.stringify(f.policy)!==JSON.stringify(discoveryPolicy)||JSON.stringify(f.manifest)!==JSON.stringify(confirmationManifest(root)))throw Error('Frozen discovery source or policy changed');
 if(Date.now()-f.at>600000||!f.batches.length||f.batches.length>discoveryPolicy.maxBatches)throw Error('Expired or empty discovery preparation');
 const start=Date.now(),mono=performance.now(),deadlineMono=mono+discoveryPolicy.durationMs;
 save(dir,'started.json',{startedAt:start,deadlineAt:start+discoveryPolicy.durationMs,freezeSha256:sha(readFileSync(frozenPath)),ordersEnabled:false});
 let stopped=false,reason='COMPLETED_PLANNED_BATCHES',attempts=0,logBytes=0;
 const summaries:any[]=[];const stop=()=>{stopped=true;reason='SUPERVISOR_OR_EXTERNAL_STOP';};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 const heartbeat=setInterval(()=>console.log(JSON.stringify({mode:'live-data',scope:'DEPTH_AWARE_DISCOVERY',ordersEnabled:false,batchesCompleted:summaries.length,attempts,elapsedMs:performance.now()-mono})),10000);
 const snapshot=()=>({scope:'ORDER_DISABLED_DEPTH_AWARE_DISCOVERY',startedAt:start,endedAt:stopped||summaries.length===f.batches.length?Date.now():null,deadlineAt:start+discoveryPolicy.durationMs,reason,attempts,logBytes,ordersEnabled:false,batches:summaries,
  pendingBatches:f.batches.slice(summaries.length).map((b:any)=>b.index)});
 try{
  for(const b of f.batches){
   const remaining=Math.floor(deadlineMono-performance.now()-discoveryPolicy.shutdownReserveMs);
   if(stopped||remaining<1000||logBytes>=discoveryPolicy.maxEvidenceBytes){reason=stopped?reason:logBytes>=discoveryPolicy.maxEvidenceBytes?'EVIDENCE_BYTE_LIMIT':'WINDOW_DEADLINE';break;}
   const batchDir=resolve(dir,'batch-'+String(b.index+1).padStart(2,'0'));mkdirSync(batchDir);
   // Share the fixed total attempt/evidence budget across all batches. Unused
   // attempts roll forward, while every remaining batch receives an equal share.
   const limits={durationMs:Math.min(f.batchDurationMs,remaining),maxAttempts:Math.floor((discoveryPolicy.maxAttempts-attempts)/(f.batches.length-b.index)),maxEvidenceBytes:discoveryPolicy.maxEvidenceBytes-logBytes,preparedAt:f.at};
   save(batchDir,'frozen.json',{at:f.at,mode:'DISCOVERY_BATCH',policy:{...integratedPolicy,durationMs:limits.durationMs,maxAttempts:limits.maxAttempts,maxEvidenceBytes:limits.maxEvidenceBytes},manifest:f.manifest,selection:b.selection,subscriptions:b.subscriptions,parentFreezeSha256:sha(readFileSync(frozenPath))});
   appendFileSync(resolve(dir,'batch-events.ndjson'),JSON.stringify({kind:'BATCH_START',index:b.index,at:Date.now(),limits,routes:b.selection.length})+'\n');
   await runBatch(batchDir,root,limits);
   const s=JSON.parse(readFileSync(resolve(batchDir,'summary.json'),'utf8'));attempts+=s.attempts;logBytes+=s.logBytes;
   summaries.push({index:b.index,path:'batch-'+String(b.index+1).padStart(2,'0'),startedAt:s.startedAt,endedAt:s.endedAt,durationMs:s.durationMs,routes:b.selection.length,attempts:s.attempts,confirmationCounts:s.confirmationCounts,routeObservation:s.routeObservation,failures:s.failures,resourceStop:s.resourceStop,clockFault:s.clockFault});
   save(dir,'summary.json',snapshot());
   if(s.resourceStop||s.clockFault){reason=s.resourceStop??'CLOCK_FAULT';break;}
   // A failed feed is retained as unavailable, never reconnected or retried.
   if(b.index<f.batches.length-1&&!stopped)await new Promise(r=>setTimeout(r,discoveryPolicy.batchGapMs));
  }
 }finally{stopped=true;clearInterval(heartbeat);process.off('SIGINT',stop);process.off('SIGTERM',stop);save(dir,'summary.json',snapshot());}
 console.log(JSON.stringify({mode:'live-data',message:'DISCOVERY_STOPPED',reason,batches:summaries.length,attempts,ordersEnabled:false}));
}
