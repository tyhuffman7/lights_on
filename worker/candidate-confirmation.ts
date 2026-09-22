import {readFileSync,writeFileSync,mkdirSync,existsSync,appendFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {market} from '../lib/arb/adapters.ts';
import {matchCandidates} from '../lib/research/matching.ts';
import {authHeaders} from './streams.ts';
import {ConfirmationFeed,confirmPolyBook,publicConfirmationGet} from './book-confirmation-adapter.ts';
import {assessSnapshot,content} from '../lib/screen/book-confirmation.ts';
import {MarketStatusTracker,bootstrapStatus,lifecycleSubscription} from '../lib/screen/market-status.ts';
import {sourceManifest} from './screen-manifest.ts';
import {category,review} from '../lib/screen/executable.ts';
import {confirmationPolicy as baselinePolicy,validity,quoteCandidate,confirmationResult,CandidateIntervals} from '../lib/screen/confirmation.ts';
import type {EvidenceBook,HttpEvidence} from '../lib/screen/confirmation.ts';
import type {Pair,Venue,Side} from '../lib/arb/types.ts';
import type {RecordEvidence} from './book-confirmation-adapter.ts';
const sha=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
const save=(dir:string,name:string,x:unknown)=>{writeFileSync(resolve(dir,name+'.tmp'),JSON.stringify(x,null,2)+'\n');renameSync(resolve(dir,name+'.tmp'),resolve(dir,name));};
function manifest(root:string){return {...sourceManifest(root),'scripts/confirmation-launch.mjs':sha(readFileSync(resolve(root,'scripts/confirmation-launch.mjs'))),'docs/research/aoc-contract-review-20260921.json':sha(readFileSync(resolve(root,'docs/research/aoc-contract-review-20260921.json')))};}
export const integratedPolicy=Object.freeze({...baselinePolicy,version:3,maxEvidenceBytes:256*1024*1024,statusSpacingMs:250,lifecycleEventLimit:2048,lifecyclePerMarketLimit:32});
export const policyFor=(control=false)=>control?{...integratedPolicy,durationMs:30000,maxAttempts:2,maxRoutes:2}:integratedPolicy;
export async function prepareConfirmation(dir:string,baseline:string,root:string,control=false){
 const policy=policyFor(control);
 mkdirSync(dir,{recursive:true});if(existsSync(resolve(dir,'frozen.json')))throw Error('Preparation already frozen');
 const old=JSON.parse(readFileSync(resolve(baseline,'frozen.json'),'utf8'));
 const markets=new Map<string,any>(),errors:unknown[]=[],pairs:Pair[]=[];
 for(const entry of old.selection.filter((e:any)=>!control||['KXMLBGAME-26SEP211835TORBAL-TOR','KXU3-26SEP-T3.7'].includes(e.pair.a.id))){
  for(const m of [entry.pair.a,entry.pair.b]){const key=m.venue+':'+m.id;if(markets.has(key))continue;try{markets.set(key,await market(m.venue,m.id));}catch{markets.set(key,null);errors.push({key,reason:'METADATA_REFRESH_FAILED'});}console.log(JSON.stringify({phase:'PREPARING_CONFIRMATION',markets:markets.size}));}
  const a=markets.get('kalshi:'+entry.pair.a.id),b=markets.get('poly:'+entry.pair.b.id);
  if(!a||!b||!a.open||!b.open){errors.push({pairId:entry.pair.id,reason:'METADATA_MISSING_OR_MARKET_CLOSED'});continue;}
  if(!matchCandidates([a],[b]).some(c=>c.pair.inverted===entry.pair.inverted)){errors.push({pairId:entry.pair.id,reason:'CURRENT_MATCH_OR_ORIENTATION_REJECTED'});continue;}
  pairs.push({...entry.pair,a,b});
 }
 const boundedReview=JSON.parse(readFileSync(resolve(root,'docs/research/aoc-contract-review-20260921.json'),'utf8'));
 const at=Date.now(),selection=pairs.map(pair=>({pair,existingAssessment:review(pair),contractReview:pair.id===boundedReview.pairId&&pair.a.hash===boundedReview.marketHashes.kalshi&&pair.b.hash===boundedReview.marketHashes.poly?boundedReview:{status:'UNRESOLVED',reviewCompleted:false,reason:pair.id===boundedReview.pairId?'REVIEWED_TERMS_CHANGED':'NOT_IN_BOUNDED_CONTRACT_REVIEW'}}));
 const subscriptions={kalshi:[...new Set(pairs.map(p=>p.a.id))],poly:[...new Set(pairs.map(p=>p.b.id))]};
 save(dir,'frozen.json',{at,mode:control?'CONTROL':'EXPERIMENT',policy,manifest:manifest(root),selection,subscriptions,baselineFreezeSha256:sha(readFileSync(resolve(baseline,'frozen.json'))),baseline:'September 21 17:13–17:43 UTC completed screen; 2.63% was strict freshness pass rate, not uptime'});
 save(dir,'coverage.json',{at,selectionMode:'REFRESH_EXISTING_CATEGORY_NEUTRAL_60_ROUTE_SET; NO_PRICE_SELECTION_OR_REPLACEMENT_SEARCH',baselineRoutes:old.selection.length,mode:control?'CONTROL':'EXPERIMENT',selected:pairs.length,errors,subscriptions,categories:Object.fromEntries([...new Set(pairs.map(category))].sort().map(c=>[c,pairs.filter(p=>category(p)===c).length]))});
 console.log(JSON.stringify({phase:'FROZEN',at,selected:pairs.length,errors:errors.length}));
}
// This is the actual opportunity-screen path, also used by the brief control mode.
export async function confirmScreenCandidate(pair:Pair,original:ReturnType<typeof quoteCandidate>,feeds:{kalshi:Pick<ConfirmationFeed,'confirmKalshi'|'latest'|'health'>;poly:Pick<ConfirmationFeed,'latest'|'health'>},status:()=>unknown,contractReview:any,record:RecordEvidence=()=>{},requestPoly:typeof confirmPolyBook=confirmPolyBook){
 const began=Date.now();
 const results=await Promise.allSettled([feeds.kalshi.confirmKalshi(pair.a.id),requestPoly(pair.b.id,()=>feeds.poly.latest.get(pair.b.id),()=>feeds.poly.health(),record)]);
 const errors=results.filter(r=>r.status==='rejected').map(r=>String((r as PromiseRejectedResult).reason?.message??'SNAPSHOT_FAILED'));
 if(errors.length)return {status:'FAILED',edgeSurvived:null,reasons:errors,bookConfirmation:{accepted:false,reasons:errors},marketStatus:{kalshi:status()},settlementEquivalence:contractReview,additionalPolicyAdmission:original.additionalPolicyAdmission,tradingAuthorization:original.tradingAuthorization,original,startedAt:began,endedAt:Date.now(),tradability:{admitted:false,reasons:['BOOK_CONFIRMATION_FAILED']},fillClaim:false};
 const k=(results[0] as PromiseFulfilledResult<Awaited<ReturnType<ConfirmationFeed['confirmKalshi']>>>).value,p=(results[1] as PromiseFulfilledResult<Awaited<ReturnType<typeof confirmPolyBook>>>).value;
 const at=Date.now(),mono=performance.now();
 // Reassess against the latest stream state after BOTH requests finish. Never reprice old favorable depth.
 const ka=assessSnapshot(k.request,k.response,feeds.kalshi.latest.get(pair.a.id),feeds.kalshi.health(),at,mono),pa=assessSnapshot(p.request,p.response,feeds.poly.latest.get(pair.b.id),feeds.poly.health(),at,mono);
 const reasons=[...new Set([...k.reasons,...p.reasons,...ka.reasons,...pa.reasons])];
 const repriced=quoteCandidate(pair,ka.selected.e.book,pa.selected.e.book,original.aSide,at,original.quantity);
 const result=confirmationResult(original,repriced,reasons,{startedAt:began,endedAt:at,kalshiSnapshotMono:k.response.e.book.receivedMono,polyResponseMono:p.response.e.book.receivedMono,nowMono:mono});
 const marketStatus={kalshi:status() as any,poly:{classification:pa.accepted&&pa.selected.e.book.open?'OPEN_IN_CONFIRMED_BOOK':'UNRESOLVED_OR_CLOSED',admitted:pa.accepted&&pa.selected.e.book.open}};
 const blockers=[...(!marketStatus.kalshi.admitted?marketStatus.kalshi.reasons:[]),...(!marketStatus.poly.admitted?['PM_STATUS_UNCONFIRMED_OR_CLOSED']:[]),...(String(contractReview.status).toUpperCase()!=='EQUIVALENT'?['SETTLEMENT_NOT_EQUIVALENT']:[]),...repriced.additionalPolicyAdmission.blockers];
 return {...result,bookConfirmation:{accepted:reasons.length===0,reasons,kalshi:{...k,...ka},poly:{...p,...pa}},marketStatus,settlementEquivalence:contractReview,
  priceEconomics:{positiveExchangeNet:repriced.positiveExchangeNet,feeBoundSurplus:repriced.economics?.feeBoundSurplus??null,confirmed:result.status!=='FAILED'},
  additionalPolicyAdmission:repriced.additionalPolicyAdmission,tradingAuthorization:repriced.tradingAuthorization,
  tradability:{admitted:result.status==='EDGE_SURVIVED'&&blockers.length===0,reasons:blockers},fillClaim:false,noAtomicExecutionGuarantee:true};
}
export async function runConfirmation(dir:string,root:string){
 const frozen=JSON.parse(readFileSync(resolve(dir,'frozen.json'),'utf8')),control=frozen.mode==='CONTROL',policy=policyFor(control);
 if(existsSync(resolve(dir,'started.json')))throw Error('Single-use capture; no restart');
 if(JSON.stringify(frozen.policy)!==JSON.stringify(policy)||JSON.stringify(frozen.manifest)!==JSON.stringify(manifest(root)))throw Error('Frozen source or policy changed');
 if(Date.now()-frozen.at>600000||!frozen.selection.length)throw Error('Preparation expired or empty');
 for(const venue of ['kalshi','poly'] as Venue[])authHeaders(venue);
 const startWall=Date.now(),startMono=performance.now();let stopped=false,busy=false,attempts=0,evaluations=0,coalesced=0,clockFault=false,logBytes=0,resourceStop:string|null=null,lastRequestMono=-Infinity;
 save(dir,'started.json',{startedAt:startWall,deadlineAt:startWall+policy.durationMs,mode:frozen.mode,freezeSha256:sha(readFileSync(resolve(dir,'frozen.json'))),runtime:process.version,ordersEnabled:false});
 const record:RecordEvidence=(kind,body)=>{if(stopped)return;const line=JSON.stringify({at:Date.now(),kind,body})+'\n';logBytes+=Buffer.byteLength(line);if(logBytes>policy.maxEvidenceBytes){resourceStop='EVIDENCE_BYTE_LIMIT';return;}appendFileSync(resolve(dir,'evidence.ndjson'),line);};
 const entries=new Map<string,any>(frozen.selection.map((e:any)=>[e.pair.id,e])),dependents=new Map<string,string[]>();
 for(const {pair}of frozen.selection)for(const m of [pair.a,pair.b])dependents.set(m.venue+':'+m.id,[...(dependents.get(m.venue+':'+m.id)??[]),pair.id]);
 const statusTracker=new MarketStatusTracker(frozen.subscriptions.kalshi),intervals=new CandidateIntervals(),dirty=new Set<string>(),seen=new Set<string>(),confirmations:any[]=[],failures:any[]=[];
 const best=new Map<string,any>(),latest=new Map<string,any>(),lastAttempt=new Map<string,{at:number;fingerprint:string}>();
 const clockOkay=()=>{if(Math.abs((Date.now()-startWall)-(performance.now()-startMono))>policy.maxClockDriftMs)clockFault=true;return !clockFault;};
 const onBook=(venue:Venue)=>(r:any)=>{const key=venue+':'+r.e.book.marketId;seen.add(key);for(const id of dependents.get(key)??[]){if(dirty.has(id))coalesced++;dirty.add(id);}};
 const streamRecord:RecordEvidence=(kind,body)=>{if(kind!=='WS_BOOK')record(kind,body);if(kind==='WS_SUBSCRIPTION_REQUEST'&&(body as any).message?.params?.channels?.includes('market_lifecycle_v2'))statusTracker.requested((body as any).at);};
 const feeds={kalshi:new ConfirmationFeed('kalshi',frozen.subscriptions.kalshi,streamRecord,{onBook:onBook('kalshi'),extraSubscriptions:[lifecycleSubscription],onInvalid:r=>{statusTracker.invalidate(r);failures.push({venue:'kalshi',reason:r,at:Date.now()});},
  onMessage:(m,at,mono)=>{const n=statusTracker.eventCount;statusTracker.receive(m,at,mono);if(m.type==='subscribed'&&m.msg?.channel==='market_lifecycle_v2')record('LIFECYCLE_ACK',{message:m,at,mono});if(statusTracker.eventCount>n&&statusTracker.eventCount<=statusTracker.eventLimit){const s=statusTracker.view(m.msg.market_ticker,at,true);if(s.latestLifecycleEvent?.seq===m.seq)record('LIFECYCLE_RELEVANT_EVENT',{marketId:m.msg.market_ticker,event:s.latestLifecycleEvent,reasons:s.reasons});}}}),
  poly:new ConfirmationFeed('poly',frozen.subscriptions.poly,streamRecord,{onBook:onBook('poly'),onInvalid:r=>failures.push({venue:'poly',reason:r,at:Date.now()})})};
 const health=(v:Venue)=>({...feeds[v].health(),clockOkay:clockOkay()&&feeds[v].health().clockOkay});
 let kalshiConnectedAtStop:boolean|null=null;
 const status=(id:string)=>statusTracker.view(id,Date.now(),kalshiConnectedAtStop??feeds.kalshi.stream.isHealthy());
 const fingerprint=(pair:Pair)=>sha(JSON.stringify([feeds.kalshi.latest.get(pair.a.id)?.e.book&&content(feeds.kalshi.latest.get(pair.a.id)!.e.book),feeds.poly.latest.get(pair.b.id)?.e.book&&content(feeds.poly.latest.get(pair.b.id)!.e.book)]));
 const evaluate=(id:string)=>{const entry=entries.get(id),pair:Pair=entry.pair,a=feeds.kalshi.latest.get(pair.a.id)?.e,b=feeds.poly.latest.get(pair.b.id)?.e,at=Date.now(),mono=performance.now();
  const av=validity(a,health('kalshi'),at,mono),bv=validity(b,health('poly'),at,mono);
  for(const side of ['yes','no'] as Side[]){const key=pair.id+'|'+side,old=intervals.active.get(key),q=quoteCandidate(pair,a?.book,b?.book,side,at,old?.quantity);evaluations++;
   const row={...q,dataValidity:{kalshi:av,poly:bv,usableForDiscovery:av.usableForDiscovery&&bv.usableForDiscovery},marketStatus:{kalshi:status(pair.a.id),poly:{reportedOpen:b?.book.open??null}},settlementEquivalence:entry.contractReview,bookConfirmation:{status:'NOT_YET_CONFIRMED'}};
   latest.set(key,row);const interval=intervals.update(key,q,row.dataValidity.usableForDiscovery,at);
   if(interval&&!old)record('CANDIDATE_INTERVAL_OPEN',{...interval,row});if(old&&!interval)record('CANDIDATE_INTERVAL_CLOSE',intervals.completed.at(-1));
   if(q.economics&&(!best.has(key)||q.economics.feeBoundSurplus>best.get(key).economics.feeBoundSurplus))best.set(key,row);
  }
 };
 let activeConfirmation:any=null;
 const confirm=async(pair:Pair,original:ReturnType<typeof quoteCandidate>,intervalId:number|null,key:string)=>{
  busy=true;activeConfirmation={intervalId,original,controlOnly:control};attempts++;lastRequestMono=performance.now();lastAttempt.set(key,{at:lastRequestMono,fingerprint:fingerprint(pair)});
  record('CONFIRMATION_START',{intervalId,original,controlOnly:control});
  try{const result=await confirmScreenCandidate(pair,original,feeds,()=>status(pair.a.id),entries.get(pair.id).contractReview,record);if(stopped)return;
   const row={intervalId,controlOnly:control,...result};confirmations.push(row);record('CONFIRMATION_RESULT',row);
  }catch{if(!stopped){const row={intervalId,status:'FAILED',edgeSurvived:null,reasons:['SCREEN_CONFIRMATION_ERROR'],original,fillClaim:false};confirmations.push(row);record('CONFIRMATION_RESULT',row);}}
  finally{busy=false;activeConfirmation=null;}
 };
 const summary=(endedAt?:number)=>({scope:'ORDER_DISABLED_INTEGRATED_CONFIRMATION',mode:frozen.mode,phase:endedAt?'STOPPED':'RUNNING',startedAt:startWall,endedAt:endedAt??null,durationMs:(endedAt??Date.now())-startWall,
  evaluations,coalesced,attempts,intervalCount:intervals.nextId,intervalLimitReached:intervals.nextId>=policy.maxIntervals,completedIntervals:intervals.completed,activeIntervals:[...intervals.active.values()],confirmations,
  confirmationCounts:Object.fromEntries(['EDGE_SURVIVED','EDGE_DISAPPEARED','FAILED'].map(k=>[k,confirmations.filter(r=>r.status===k).length])),
  bestDisplayed:[...best.values()],latestClassification:[...latest.values()],seenBooks:seen.size,expectedBooks:frozen.subscriptions.kalshi.length+frozen.subscriptions.poly.length,
  missingBooks:[...dependents.keys()].filter(k=>!seen.has(k)),failures,clockFault,ordersEnabled:false,resourceStop,logBytes,lifecycle:statusTracker.summary(),marketStatus:Object.fromEntries(frozen.subscriptions.kalshi.map((id:string)=>[id,status(id)])),
  notes:'Book-confirmed economics are not executable arbitrage, status admission, settlement equivalence or fills. Unknown survival is never a disappeared edge.'});
 let work:ReturnType<typeof setInterval>|undefined,heartbeat:ReturnType<typeof setInterval>|undefined,deadline:ReturnType<typeof setTimeout>|undefined;
 const stop=()=>{if(stopped)return;kalshiConnectedAtStop=feeds.kalshi.stream.isHealthy();stopped=true;clearInterval(work);clearInterval(heartbeat);clearTimeout(deadline);for(const f of Object.values(feeds))f.stop();
  if(busy)confirmations.push({...activeConfirmation,status:'FAILED',edgeSurvived:null,reasons:['CENSORED_AT_STOP'],fillClaim:false});intervals.stop(Date.now());save(dir,'summary.json',summary(Date.now()));console.log(JSON.stringify({mode:'live-data',message:'CONFIRMATION_SCREEN_STOPPED',attempts,intervals:intervals.nextId,resourceStop}));};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);deadline=setTimeout(stop,policy.durationMs);
 heartbeat=setInterval(()=>{save(dir,'summary.json',summary());console.log(JSON.stringify({mode:'live-data',ordersEnabled:false,attempts,intervals:intervals.nextId,seenBooks:seen.size,clockFault,lifecycle:statusTracker.summary()}));},10000);
 for(const f of Object.values(feeds))f.start();
 // Lifecycle acknowledgement precedes every baseline GET; intervening relevant events remain retained.
 const waitStart=performance.now();while(statusTracker.sid===null&&!stopped&&performance.now()-waitStart<5000)await new Promise(r=>setTimeout(r,20));
 if(statusTracker.sid===null){statusTracker.invalidate('LIFECYCLE_ACK_TIMEOUT');record('STATUS_BOOTSTRAP_UNRESOLVED',statusTracker.summary());}
 else await bootstrapStatus(statusTracker,frozen.subscriptions.kalshi,async id=>{if(stopped)throw Error('STOPPED');return publicConfirmationGet('https://external-api.kalshi.com/trade-api/v2/markets/'+encodeURIComponent(id),record);},policy.statusSpacingMs);
 if(stopped)return;
 record('STATUS_BOOTSTRAP_COMPLETE',{lifecycle:statusTracker.summary(),markets:Object.fromEntries(frozen.subscriptions.kalshi.map((id:string)=>[id,status(id)]))});
 const controlQueue=control?frozen.selection.map((e:any)=>e.pair.id):[];
 work=setInterval(()=>{if(stopped)return;if(resourceStop){stop();return;}clockOkay();
  if(!health('kalshi').connected||!health('poly').connected||clockFault){for(const id of entries.keys())dirty.add(id);}
  for(const id of [...dirty]){dirty.delete(id);evaluate(id);}
  if(busy||attempts>=policy.maxAttempts||performance.now()-lastRequestMono<policy.globalRequestSpacingMs)return;
  if(control){const id=controlQueue[0];if(!id)return;const pair:Pair=entries.get(id).pair;if(!feeds.kalshi.latest.has(pair.a.id)||!feeds.poly.latest.has(pair.b.id))return;controlQueue.shift();
   const q=quoteCandidate(pair,feeds.kalshi.latest.get(pair.a.id)!.e.book,feeds.poly.latest.get(pair.b.id)!.e.book,'no',Date.now());void confirm(pair,q,null,pair.id+'|control');return;
  }
  const candidates=[...intervals.active.values()].filter(x=>{const last=lastAttempt.get(x.key),pair:Pair=entries.get(x.original.pairId).pair;return !status(pair.a.id).knownBlocked&&(!last||(performance.now()-last.at>=policy.perCandidateCooldownMs&&last.fingerprint!==fingerprint(pair)));}).sort((a,b)=>(lastAttempt.get(a.key)?.at??-Infinity)-(lastAttempt.get(b.key)?.at??-Infinity)||a.id-b.id);
  const next=candidates[0];if(next)void confirm(entries.get(next.original.pairId).pair,next.original,next.id,next.key);
 },policy.coalesceMs);
 console.log(JSON.stringify({mode:'live-data',ordersEnabled:false,startedAt:startWall,routes:frozen.selection.length,integratedAdapter:true,control}));
}
