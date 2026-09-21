import {readFileSync,writeFileSync,mkdirSync,existsSync,appendFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {market} from '../lib/arb/adapters.ts';
import {matchCandidates} from '../lib/research/matching.ts';
import {BookCache} from '../lib/research/books.ts';
import {StreamConnection,authHeaders} from './streams.ts';
import {sourceManifest} from './executable-screen.ts';
import {category,review} from '../lib/screen/executable.ts';
import {confirmationPolicy as policy,observeBook,validity,quoteCandidate,httpConfirmationReasons,confirmationResult,latestPolyBook,CandidateIntervals} from '../lib/screen/confirmation.ts';
import type {EvidenceBook,HttpEvidence} from '../lib/screen/confirmation.ts';
import type {Pair,Venue,Side} from '../lib/arb/types.ts';
import type {StreamBook} from '../lib/research/types.ts';
const sha=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
const save=(dir:string,name:string,x:unknown)=>{writeFileSync(resolve(dir,name+'.tmp'),JSON.stringify(x,null,2)+'\n');renameSync(resolve(dir,name+'.tmp'),resolve(dir,name));};
function manifest(root:string){return {...sourceManifest(root),'scripts/confirmation-launch.mjs':sha(readFileSync(resolve(root,'scripts/confirmation-launch.mjs'))),'docs/research/aoc-contract-review-20260921.json':sha(readFileSync(resolve(root,'docs/research/aoc-contract-review-20260921.json')))};}
export async function prepareConfirmation(dir:string,baseline:string,root:string){
 mkdirSync(dir,{recursive:true});if(existsSync(resolve(dir,'frozen.json')))throw Error('Preparation already frozen');
 const old=JSON.parse(readFileSync(resolve(baseline,'frozen.json'),'utf8'));
 const markets=new Map<string,any>(),errors:unknown[]=[],pairs:Pair[]=[];
 for(const entry of old.selection){
  for(const m of [entry.pair.a,entry.pair.b]){const key=m.venue+':'+m.id;if(markets.has(key))continue;try{markets.set(key,await market(m.venue,m.id));}catch{markets.set(key,null);errors.push({key,reason:'METADATA_REFRESH_FAILED'});}console.log(JSON.stringify({phase:'PREPARING_CONFIRMATION',markets:markets.size}));}
  const a=markets.get('kalshi:'+entry.pair.a.id),b=markets.get('poly:'+entry.pair.b.id);
  if(!a||!b||!a.open||!b.open){errors.push({pairId:entry.pair.id,reason:'METADATA_MISSING_OR_MARKET_CLOSED'});continue;}
  if(!matchCandidates([a],[b]).some(c=>c.pair.inverted===entry.pair.inverted)){errors.push({pairId:entry.pair.id,reason:'CURRENT_MATCH_OR_ORIENTATION_REJECTED'});continue;}
  pairs.push({...entry.pair,a,b});
 }
 const boundedReview=JSON.parse(readFileSync(resolve(root,'docs/research/aoc-contract-review-20260921.json'),'utf8'));
 const at=Date.now(),selection=pairs.map(pair=>({pair,existingAssessment:review(pair),contractReview:pair.id===boundedReview.pairId&&pair.a.hash===boundedReview.marketHashes.kalshi&&pair.b.hash===boundedReview.marketHashes.poly?boundedReview:{status:'UNRESOLVED',reviewCompleted:false,reason:pair.id===boundedReview.pairId?'REVIEWED_TERMS_CHANGED':'NOT_IN_BOUNDED_CONTRACT_REVIEW'}}));
 const subscriptions={kalshi:[...new Set(pairs.map(p=>p.a.id))],poly:[...new Set(pairs.map(p=>p.b.id))]};
 save(dir,'frozen.json',{at,policy,manifest:manifest(root),selection,subscriptions,baselineFreezeSha256:sha(readFileSync(resolve(baseline,'frozen.json'))),baseline:'September 21 17:13–17:43 UTC completed screen; 2.63% was strict freshness pass rate, not uptime'});
 save(dir,'coverage.json',{at,selectionMode:'REFRESH_EXISTING_CATEGORY_NEUTRAL_60_ROUTE_SET; NO_PRICE_SELECTION_OR_REPLACEMENT_SEARCH',baselineRoutes:old.selection.length,selected:pairs.length,errors,subscriptions,categories:Object.fromEntries([...new Set(pairs.map(category))].sort().map(c=>[c,pairs.filter(p=>category(p)===c).length]))});
 console.log(JSON.stringify({phase:'FROZEN',at,selected:pairs.length,errors:errors.length}));
}
export async function runConfirmation(dir:string,root:string){
 const frozen=JSON.parse(readFileSync(resolve(dir,'frozen.json'),'utf8'));
 if(existsSync(resolve(dir,'started.json')))throw Error('Single-use capture; no restart');
 if(JSON.stringify(frozen.policy)!==JSON.stringify(policy)||JSON.stringify(frozen.manifest)!==JSON.stringify(manifest(root)))throw Error('Frozen source or policy changed');
 if(Date.now()-frozen.at>600000||!frozen.selection.length)throw Error('Preparation expired or empty');
 for(const venue of ['kalshi','poly'] as Venue[])authHeaders(venue);
 const startWall=Date.now(),startMono=performance.now(),abort=new AbortController();
 save(dir,'started.json',{startedAt:startWall,deadlineAt:startWall+policy.durationMs,freezeSha256:sha(readFileSync(resolve(dir,'frozen.json'))),runtime:process.version,ordersEnabled:false});
 const record=(kind:string,body:unknown)=>appendFileSync(resolve(dir,'evidence.ndjson'),JSON.stringify({at:Date.now(),kind,body})+'\n');
 const cache={kalshi:new BookCache(),poly:new BookCache()},books=new Map<string,EvidenceBook>(),streams=new Map<Venue,StreamConnection>();
 const intervals=new CandidateIntervals(),dirty=new Set<string>(),seen=new Set<string>(),confirmations:any[]=[],failures:any[]=[];
 const entries=new Map<string,any>(frozen.selection.map((e:any)=>[e.pair.id,e]));
 const dependents=new Map<string,string[]>();for(const {pair}of frozen.selection)for(const m of [pair.a,pair.b])dependents.set(m.venue+':'+m.id,[...(dependents.get(m.venue+':'+m.id)??[]),pair.id]);
 const best=new Map<string,any>(),latest=new Map<string,any>(),lastAttempt=new Map<string,number>();
 const pendingSnapshots=new Map<string,{startMono:number;beforeSequence:number;resolve:(x:EvidenceBook)=>void;reject:(e:Error)=>void}>();
 let stopped=false,busy=false,attempts=0,lastRequestMono=-Infinity,evaluations=0,clockFault=false,coalesced=0,rateLimitedUntilMono=0;
 const clockOkay=()=>{if(Math.abs((Date.now()-startWall)-(performance.now()-startMono))>policy.maxClockDriftMs)clockFault=true;return !clockFault;};
 const health=(venue:Venue)=>({connected:streams.get(venue)?.isHealthy()??false,backlog:streams.get(venue)?.ingress?.depth??0,clockOkay:clockOkay()});
 const state=(pair:Pair)=>({a:books.get('kalshi:'+pair.a.id),b:books.get('poly:'+pair.b.id)});
 const bookEvidence=(a:EvidenceBook|undefined,b:EvidenceBook|undefined)=>{const body={kalshi:a,poly:b},hash=sha(JSON.stringify(body));record('CANDIDATE_BOOKS',{sha256:hash,...body});return hash;};
 const evaluate=(id:string)=>{const entry=entries.get(id),pair:Pair=entry.pair;const {a,b}=state(pair),at=Date.now(),mono=performance.now();
  const av=validity(a,health('kalshi'),at,mono),bv=validity(b,health('poly'),at,mono);
  for(const side of ['yes','no'] as Side[]){const key=pair.id+'|'+side,active=intervals.active.get(key),q=quoteCandidate(pair,a?.book,b?.book,side,at,active?.quantity);evaluations++;
   const row={...q,dataValidity:{kalshi:av,poly:bv,usableForDiscovery:av.usableForDiscovery&&bv.usableForDiscovery},settlementEquivalence:entry.contractReview,confirmationStatus:'NOT_YET_CONFIRMED'};
   latest.set(key,row);const old=intervals.active.get(key);const interval=intervals.update(key,q,row.dataValidity.usableForDiscovery,at);
   if(interval&&!old)record('CANDIDATE_INTERVAL_OPEN',{...interval,row,booksSha256:bookEvidence(a,b)});
   if(old&&!interval)record('CANDIDATE_INTERVAL_CLOSE',intervals.completed.at(-1));
   if(q.economics&&(!best.has(key)||q.economics.feeBoundSurplus>best.get(key).economics.feeBoundSurplus))best.set(key,{...row,booksSha256:bookEvidence(a,b)});
  }
 };
 const http=async(url:string)=>{
  const requestAt=Date.now(),requestMono=performance.now();record('HTTP_CONFIRMATION_REQUEST',{url,requestAt,requestMono,headers:{'cache-control':'no-cache, no-store',pragma:'no-cache'}});const response=await fetch(url,{method:'GET',cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache, no-store',pragma:'no-cache'},signal:AbortSignal.any([abort.signal,AbortSignal.timeout(policy.requestTimeoutMs)])});
  const raw=await response.text(),responseAt=Date.now(),responseMono=performance.now();let data:any;try{data=JSON.parse(raw);}catch{}const processedAt=Date.now(),processedMono=performance.now();
  const headers=Object.fromEntries([...response.headers].filter(([k])=>['date','age','cache-control','cf-cache-status','x-cache','etag','last-modified','via','retry-after'].includes(k)));
  const evidence:HttpEvidence={url,requestAt,requestMono,responseAt,responseMono,processedAt,processedMono,status:response.status,headers,bodySha256:sha(raw)};
  record('HTTP_CONFIRMATION',{evidence,body:raw});if(response.status===429){const h=headers['retry-after'];const seconds=Number(h);const waitMs=h&&Number.isFinite(seconds)?seconds*1000:h?Math.max(0,Date.parse(h)-Date.now()):35000;rateLimitedUntilMono=Math.max(rateLimitedUntilMono,performance.now()+Math.max(35000,Number.isFinite(waitMs)?waitMs:35000));}if(!response.ok)throw Error('HTTP_'+response.status);
  if(data===undefined)throw Error('CONFIRMATION_JSON_INVALID');return {data,evidence};
 };
 const snapshot=(id:string)=>new Promise<EvidenceBook>((resolveSnapshot,reject)=>{
  const stream=streams.get('kalshi')!,before=books.get('kalshi:'+id);const requestMono=performance.now();
  if(!before||before.book.sequence===null){reject(Error('NO_SEQUENCED_BOOK'));return;}
  const timer=setTimeout(()=>{pendingSnapshots.delete(id);reject(Error('KALSHI_SNAPSHOT_TIMEOUT'));},policy.requestTimeoutMs);
  pendingSnapshots.set(id,{startMono:requestMono,beforeSequence:before.book.sequence,resolve:x=>{clearTimeout(timer);pendingSnapshots.delete(id);resolveSnapshot(x);},reject:e=>{clearTimeout(timer);pendingSnapshots.delete(id);reject(e);}});
  record('KALSHI_SNAPSHOT_REQUEST',{marketId:id,requestAt:Date.now(),requestMono,beforeSequence:before.book.sequence,sid:cache.kalshi.subscriptions.get(id)});
  if(!stream.requestSnapshot(id,cache.kalshi.subscriptions.get(id))){clearTimeout(timer);pendingSnapshots.delete(id);reject(Error('KALSHI_SNAPSHOT_REQUEST_FAILED'));}
 });
 const confirm=async(interval:NonNullable<ReturnType<CandidateIntervals['update']>>)=>{
  const entry=entries.get(interval.original.pairId),pair:Pair=entry.pair;const began=Date.now();
  attempts++;lastRequestMono=performance.now();lastAttempt.set(interval.key,lastRequestMono);busy=true;
  const original=latest.get(interval.key);record('CONFIRMATION_START',{intervalId:interval.id,original,startedAt:began});
  try{
   // A sequenced requested Kalshi snapshot plus current PM REST book; status GET prevents closed Kalshi books masquerading as open.
   const results=await Promise.allSettled([snapshot(pair.a.id),http('https://gateway.polymarket.us/v1/markets/'+encodeURIComponent(pair.b.id)+'/book'),http('https://external-api.kalshi.com/trade-api/v2/markets/'+encodeURIComponent(pair.a.id))]);
   const failed=results.filter(r=>r.status==='rejected');if(failed.length)throw Error(failed.map(r=>(r as PromiseRejectedResult).reason?.message??'CONFIRMATION_FAILED').join(';'));
   if(stopped)return;
   const snap=(results[0] as PromiseFulfilledResult<EvidenceBook>).value;
   const pm=(results[1] as PromiseFulfilledResult<Awaited<ReturnType<typeof http>>>).value,km=(results[2] as PromiseFulfilledResult<Awaited<ReturnType<typeof http>>>).value;
   const parsed=new BookCache().poly(pm.data,pm.evidence.responseAt,pm.evidence.responseMono);if(!parsed)throw Error('PM_CONFIRMATION_SCHEMA');const rest:StreamBook={...parsed,source:'rest'};
   if(pm.data.marketData?.marketSlug!==pair.b.id)throw Error('PM_MARKET_ID_MISMATCH');
   const {a,b}=state(pair),chosen=latestPolyBook(rest,b,pm.evidence.requestMono),at=Date.now(),mono=performance.now();
   const problems=[...httpConfirmationReasons(pm.evidence),...httpConfirmationReasons(km.evidence),...chosen.reasons];
   if(km.data.market?.ticker!==pair.a.id||km.data.market?.status!=='active')problems.push('KALSHI_MARKET_NOT_ACTIVE');
   if(km.data.market?.rules_primary!==pair.a.rules.split('\n\n')[0])problems.push('KALSHI_PRIMARY_TERMS_CHANGED');
   if(!rest.open)problems.push('PM_BOOK_CLOSED');
   for(const [venue,e]of [['kalshi',a],['poly',b]] as const)problems.push(...validity(e,health(venue),at,mono).reasons.map(r=>venue+':'+r));
   if(!a||a.book.sequence!<snap.book.sequence!)problems.push('LATEST_KALSHI_SEQUENCE_UNAVAILABLE');
   if(!intervals.active.has(interval.key)||intervals.active.get(interval.key)?.id!==interval.id)problems.push('ORIGINAL_INTERVAL_ENDED');
   const repriced=quoteCandidate(pair,a?.book,chosen.book,original.aSide,at,interval.quantity);
   const result={intervalId:interval.id,...confirmationResult(original,repriced,problems,{startedAt:began,endedAt:at,kalshiSnapshotMono:snap.book.receivedMono,polyResponseMono:pm.evidence.responseMono,nowMono:mono}),
    contractReview:entry.contractReview,requestEvidence:{poly:pm.evidence,kalshiMarket:km.evidence},kalshiSnapshot:snap,
    latestBooksEvidence:{kalshi:a,poly:chosen.book},noAtomicExecutionGuarantee:true};
   confirmations.push(result);record('CONFIRMATION_RESULT',result);
   // Use the newer REST book for subsequent screening, never roll back a newer streamed representation.
   if(chosen.book===rest&&chosen.reasons.length===0&&httpConfirmationReasons(pm.evidence).length===0){
    const applied=observeBook(rest,b,'rest_confirmation',pm.evidence.processedAt,pm.evidence.processedMono);applied.lastConfirmedSnapshotAt=pm.evidence.responseAt;applied.lastConfirmedSnapshotMono=pm.evidence.responseMono;
    books.set('poly:'+pair.b.id,applied);for(const id of dependents.get('poly:'+pair.b.id)??[])dirty.add(id);
   }
  }catch(error){if(!stopped){const result={intervalId:interval.id,startedAt:began,endedAt:Date.now(),status:'FAILED',edgeSurvived:null,reasons:[String((error as Error).message)],original,fillClaim:false};confirmations.push(result);record('CONFIRMATION_RESULT',result);}}
  finally{busy=false;}
 };
 const summary=(endedAt?:number)=>({scope:'ORDER_DISABLED_CANDIDATE_CONFIRMATION',phase:endedAt?'STOPPED':'RUNNING',startedAt:startWall,endedAt:endedAt??null,durationMs:(endedAt??Date.now())-startWall,
  evaluations,coalesced,attempts,intervalCount:intervals.nextId,intervalLimitReached:intervals.nextId>=policy.maxIntervals,completedIntervals:intervals.completed,activeIntervals:[...intervals.active.values()],confirmations,
  confirmationCounts:Object.fromEntries(['EDGE_SURVIVED','EDGE_DISAPPEARED','FAILED'].map(k=>[k,confirmations.filter(r=>r.status===k).length])),
  bestDisplayed:[...best.values()],latestClassification:[...latest.values()],seenBooks:seen.size,expectedBooks:frozen.subscriptions.kalshi.length+frozen.subscriptions.poly.length,
  missingBooks:[...dependents.keys()].filter(k=>!seen.has(k)),failures,clockFault,ordersEnabled:false,
  notes:'Intervals describe observed positive fee-bound prices, not guaranteed continuous availability or fills. Quiet books remain unconfirmed until a bounded snapshot/book check. Heartbeats never refresh prices. Baseline 2.63% was strict freshness-pass rate, not uptime.'});
 let work:ReturnType<typeof setInterval>,heartbeat:ReturnType<typeof setInterval>,deadline:ReturnType<typeof setTimeout>;
 const stop=()=>{if(stopped)return;stopped=true;abort.abort();clearInterval(work);clearInterval(heartbeat);clearTimeout(deadline);
  for(const s of streams.values())s.stop();for(const p of pendingSnapshots.values())p.reject(Error('SCREEN_STOPPED'));
  if(busy){record('CONFIRMATION_CENSORED_AT_STOP',{at:Date.now()});confirmations.push({status:'FAILED',edgeSurvived:null,reasons:['CENSORED_AT_STOP'],fillClaim:false});}
  intervals.stop(Date.now());save(dir,'summary.json',summary(Date.now()));console.log(JSON.stringify({mode:'live-data',message:'CONFIRMATION_SCREEN_STOPPED',attempts,intervals:intervals.nextId}));};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 for(const venue of ['kalshi','poly'] as Venue[]){const ids=frozen.subscriptions[venue];if(!ids.length)continue;
  const stream=new StreamConnection({venue,ids,headers:()=>authHeaders(venue),
   onInvalid:reason=>{cache[venue].invalidate(venue);for(const id of ids){const e=books.get(venue+':'+id);if(e)e.book.valid=false;for(const pairId of dependents.get(venue+':'+id)??[])dirty.add(pairId);}failures.push({venue,reason,at:Date.now()});record('FEED_INVALID',{venue,reason});queueMicrotask(()=>stream.stop());},
   onDiagnostic:(kind,body)=>{if(kind!=='DISCONNECT_DETAIL')record(kind,body);},
   onMessage:(message,wall,mono)=>{const b=venue==='kalshi'?cache.kalshi.kalshi(message,wall,mono):cache.poly.poly(message,wall,mono);if(!b)return;if(!ids.includes(b.marketId))throw Error('Unsubscribed market');
    const key=venue+':'+b.marketId,previous=books.get(key);
    // BookCache's stream chronology also needs to respect any later REST observation.
    if(venue==='poly'&&previous?.book.exchangeAt!==null&&previous?.book.exchangeAt!==undefined&&b.exchangeAt!==null&&b.exchangeAt<previous.book.exchangeAt){record('OLDER_PM_STREAM_IGNORED',{marketId:b.marketId,exchangeAt:b.exchangeAt,retainedAt:previous.book.exchangeAt});return;}
    const e=observeBook(b,previous,venue==='kalshi'?message.type:'marketData',Date.now(),performance.now());books.set(key,e);seen.add(key);
    const p=pendingSnapshots.get(b.marketId);if(venue==='kalshi'&&message.type==='orderbook_snapshot'&&p&&b.receivedMono>=p.startMono&&b.sequence!>p.beforeSequence){record('KALSHI_REQUESTED_SNAPSHOT',e);p.resolve(e);}
    for(const id of dependents.get(key)??[]){if(dirty.has(id))coalesced++;dirty.add(id);}
   }});streams.set(venue,stream);stream.start();
 }
 let lastHealthCheck=0;
 work=setInterval(()=>{if(stopped)return;const now=performance.now();
  if(now-lastHealthCheck>1000){lastHealthCheck=now;for(const entry of frozen.selection)if(!health('kalshi').connected||!health('poly').connected||!clockOkay())dirty.add(entry.pair.id);}
  for(const id of [...dirty]){dirty.delete(id);evaluate(id);}
  if(!busy&&now>=rateLimitedUntilMono&&attempts<policy.maxAttempts&&now-lastRequestMono>=policy.globalRequestSpacingMs){
   // Oldest attempt first, stable interval identity; no profit-based parameter search.
   const candidates=[...intervals.active.values()].filter(x=>now-(lastAttempt.get(x.key)??-Infinity)>=policy.perCandidateCooldownMs).sort((a,b)=>(lastAttempt.get(a.key)??-Infinity)-(lastAttempt.get(b.key)??-Infinity)||a.id-b.id);
   const next=candidates[0];if(next)void confirm(next);
  }
 },policy.coalesceMs);
 heartbeat=setInterval(()=>{save(dir,'summary.json',summary());console.log(JSON.stringify({mode:'live-data',ordersEnabled:false,attempts,intervals:intervals.nextId,seenBooks:seen.size,clockFault}));},10000);
 deadline=setTimeout(stop,policy.durationMs);console.log(JSON.stringify({mode:'live-data',ordersEnabled:false,startedAt:startWall,routes:frozen.selection.length}));
}
