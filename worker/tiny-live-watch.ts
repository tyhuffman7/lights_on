// Single bounded read-only watch. No execution-adapter or PAPER-store imports.
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {Pair,Venue,Side} from '../lib/arb/types.ts';
import {quoteCandidate,validity} from '../lib/screen/confirmation.ts';
import {derivedQuote} from '../lib/research/streaming-dispersion.ts';
import {liveAdmission,liveSettlementReasons,dormantPilot} from '../lib/pilot/live-admission.ts';
import type {LiveReview,LivePrerequisites} from '../lib/pilot/live-admission.ts';
import {VenueRebuildBudget,feedDiagnostic} from '../lib/arb/production-operations.ts';
import {MarketStatusTracker,lifecycleSubscription,bootstrapStatus} from '../lib/screen/market-status.ts';
import {ConfirmationFeed,publicConfirmationGet} from './book-confirmation-adapter.ts';
import type {RecordEvidence} from './book-confirmation-adapter.ts';
import {confirmScreenCandidate} from './candidate-confirmation.ts';
import {SegmentedEvidence,evidencePolicy} from './segmented-evidence.ts';
import {authHeaders} from './streams.ts';
import {sourceManifest} from './screen-manifest.ts';

export const watchPolicy=Object.freeze({version:1,ordersEnabled:false,durationMs:20*60*1000,maxRoutes:32,
 quantity:1,maxConfirmations:30,confirmationSpacingMs:5000,confirmationReserveMs:15000,maxReconnectsPerVenue:3,
 heartbeatMs:10000,healthSampleMs:250,discoveryOnly:true,evidence:evidencePolicy});
const hash=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
const read=(f:string)=>JSON.parse(readFileSync(f,'utf8'));
const save=(dir:string,file:string,x:unknown)=>{writeFileSync(resolve(dir,file+'.tmp'),JSON.stringify(x,null,2)+'\n',{mode:0o600});renameSync(resolve(dir,file+'.tmp'),resolve(dir,file));};
export function watchManifest(root:string){const files=['worker/tiny-live-watch.ts','worker/segmented-evidence.ts','lib/pilot/live-admission.ts','scripts/tiny-live-launch.mjs','docs/pilot/tiny-live-settlement-review-20260923.json'];return {...sourceManifest(root),...Object.fromEntries(files.map(f=>[f,hash(readFileSync(resolve(root,f)))]))};}
type Entry={pair:Pair;review:LiveReview;metadataAt:number;feeOverridesReviewed:boolean};
type Readiness=Omit<LivePrerequisites,'isolatedFeedsHealthy'|'persistenceHealthy'>&{expectedReleaseAt:number};
const unverifiedReadiness:Readiness={expectedReleaseAt:NaN,ohioEligible:false,accountReady:false,accountAt:0,feesValidated:false,unresolvedInventory:true,unresolvedExecution:true,realizedLoss:false};
export function assessWatchAdmission(pair:Pair,review:LiveReview,original:ReturnType<typeof quoteCandidate>,result:any,
 context:{stopped:boolean;uninterrupted:boolean;isolatedFeedsHealthy:boolean;persistenceHealthy:boolean},now:number,readiness:Readiness=unverifiedReadiness){
 return liveAdmission(pair,review,result.repriced??original,{...readiness,
  confirmed:!context.stopped&&context.uninterrupted&&result.status==='EDGE_SURVIVED'&&result.bookConfirmation?.accepted===true,
  // Successful confirmationResult stores timestamps in window; failures can carry
  // top-level endedAt. Neither a missing time nor an acknowledgement is fresh proof.
  confirmationAt:result.window?.endedAt??result.endedAt??0,
  marketStatusOpen:result.marketStatus?.kalshi?.admitted===true&&result.marketStatus?.poly?.admitted===true,
  isolatedFeedsHealthy:context.isolatedFeedsHealthy,persistenceHealthy:context.persistenceHealthy},now);
}
export function freezeWatch(dir:string,metadataPath:string,root:string){
 mkdirSync(dir,{recursive:true});if(existsSync(resolve(dir,'frozen.json')))throw Error('SINGLE_FREEZE_ONLY');
 const metadata=read(metadataPath),reviews=read(resolve(root,'docs/pilot/tiny-live-settlement-review-20260923.json')).routes as LiveReview[];
 if(!Array.isArray(metadata)||!metadata.length||metadata.length>watchPolicy.maxRoutes)throw Error('ROUTE_COUNT');
 const selection:Entry[]=metadata.filter((m:any)=>m.pair.a.open&&m.pair.b.open).map((m:any)=>{
  const review=reviews.find(r=>r.pairId===m.pair.id);if(!review||review.marketHashes.kalshi!==m.pair.a.hash||review.marketHashes.poly!==m.pair.b.hash||Date.now()-m.at>600000||m.at>Date.now())throw Error('REVIEW_OR_METADATA_CHANGED');
  if(m.native.event.fee_type_override!=null||m.native.event.fee_multiplier_override!=null||m.native.kalshi.fee_waiver_expiration_time)throw Error('UNREVIEWED_FEE_OVERRIDE');
  return {pair:m.pair,review,metadataAt:m.at,feeOverridesReviewed:m.native.event.fee_type_override==null&&m.native.event.fee_multiplier_override==null&&!m.native.kalshi.fee_waiver_expiration_time};
 });
 if(!selection.length||new Set(selection.map(e=>e.pair.id)).size!==selection.length)throw Error('EMPTY_OR_DUPLICATE_UNIVERSE');
 selection.sort((a,b)=>Number(b.review.classification==='LIVE_EQUIVALENT')-Number(a.review.classification==='LIVE_EQUIVALENT')||a.pair.id.localeCompare(b.pair.id));
 save(dir,'frozen.json',{at:Date.now(),ordersEnabled:false,policy:watchPolicy,pilot:dormantPilot,selection,manifest:watchManifest(root),metadataSha256:hash(readFileSync(metadataPath))});
 console.log(JSON.stringify({phase:'FROZEN',routes:selection.length,ordersEnabled:false}));
}
export async function runWatch(dir:string,root:string,deadline:number){
 const f=read(resolve(dir,'frozen.json')),start=Date.now(),mono=performance.now();
 if(existsSync(resolve(dir,'started.json'))||JSON.stringify(f.policy)!==JSON.stringify(watchPolicy)||JSON.stringify(f.manifest)!==JSON.stringify(watchManifest(root))||start-f.at>600000||f.at>start||!Number.isFinite(deadline)||deadline<=start||deadline>start+watchPolicy.durationMs)throw Error('WATCH_FREEZE_OR_DEADLINE_INVALID');
 for(const v of ['kalshi','poly'] as Venue[])authHeaders(v);
 writeFileSync(resolve(dir,'started.json'),JSON.stringify({at:start,deadline,freezeSha256:hash(readFileSync(resolve(dir,'frozen.json'))),ordersEnabled:false}),{flag:'wx',mode:0o600});
 const entries=f.selection as Entry[],writer=new SegmentedEvidence(resolve(dir,'evidence'));
 const feeds={} as Record<Venue,ConfirmationFeed>,ids={kalshi:entries.map(e=>e.pair.a.id),poly:entries.map(e=>e.pair.b.id)};
 const budget=new VenueRebuildBudget(watchPolicy.maxReconnectsPerVenue,mono+deadline-start);
 let tracker=new MarketStatusTracker(ids.kalshi),stopped=false,reason='ORIGINAL_DEADLINE',endedAt:number|null=null,busy=false,rebuilding=true,clockFault=false;
 let attempts=0,lastRequest=-Infinity,evaluations=0;const confirmations:any[]=[],events:any[]=[],active=new Map<string,{requested:boolean;id:number}>();let episode=0;
 const rows=new Map(entries.map(e=>[e.pair.id,{pairId:e.pair.id,classification:e.review.classification,priceableSamples:0,unpriceableSamples:0,feePositiveEpisodes:0,best: null as ReturnType<typeof derivedQuote>} ]));
 const clockOkay=()=>{if(Math.abs((Date.now()-start)-(performance.now()-mono))>1000)clockFault=true;return !clockFault;};
 const health=(v:Venue)=>{const h=feeds[v]?.health()??{connected:false,clockOkay:true,backlog:0};return {...h,clockOkay:h.clockOkay&&clockOkay()};};
 const state=(e:Entry)=>{const a=feeds.kalshi?.latest.get(e.pair.a.id)?.e,b=feeds.poly?.latest.get(e.pair.b.id)?.e,at=Date.now(),m=performance.now();return {a,b,at,usable:validity(a,health('kalshi'),at,m).usableForDiscovery&&validity(b,health('poly'),at,m).usableForDiscovery};};
 const record:RecordEvidence=(kind,body)=>{if(stopped&&!['CONFIRMATION_RESULT','CONFIRMATION_ERROR','CANDIDATE_FROZEN'].includes(kind))return;try{writer.append(kind,body,busy||kind!=='WS_BOOK');}catch{stop('EVIDENCE_RESOURCE_OR_WRITE_FAILURE');throw Error('EVIDENCE_RESOURCE_OR_WRITE_FAILURE');}};
 const evaluate=(e:Entry)=>{if(stopped)return;const s=state(e),row=rows.get(e.pair.id)!;evaluations++;
  for(const side of ['yes','no'] as Side[]){const key=e.pair.id+'|'+side;
   if(!s.usable){continue;} // A data gap does not create a second economic episode.
   const q=quoteCandidate(e.pair,s.a?.book,s.b?.book,side,s.at,1),d=derivedQuote(q);
   if(d){row.priceableSamples++;if(!row.best||d.feeNetSurplus>row.best.feeNetSurplus)row.best=d;}else row.unpriceableSamples++;
   if(!q.positiveExchangeNet){active.delete(key);continue;}
   if(!active.has(key)){active.set(key,{requested:false,id:++episode});row.feePositiveEpisodes++;}
  }
 };
 const connect=async(venues:Venue[])=>{
  for(const v of venues){feeds[v]?.stop();if(v==='kalshi')tracker=new MarketStatusTracker(ids.kalshi);
   const recordFeed:RecordEvidence=(kind,body)=>{record(kind,{venue:v,evidence:body});if(v==='kalshi'&&kind==='WS_SUBSCRIPTION_REQUEST'&&(body as any).message?.params?.channels?.includes('market_lifecycle_v2'))tracker.requested((body as any).at);};
   feeds[v]=new ConfirmationFeed(v,ids[v],recordFeed,{onBook:r=>{for(const e of entries)if((v==='kalshi'?e.pair.a.id:e.pair.b.id)===r.e.book.marketId)evaluate(e);},onInvalid:r=>{if(v==='kalshi')tracker.invalidate(r);},...(v==='kalshi'?{extraSubscriptions:[lifecycleSubscription],onMessage:(m:any,at:number,receiptMono:number)=>tracker.receive(m,at,receiptMono)}:{})});
   feeds[v].start();
  }
  await Promise.allSettled(venues.map(v=>feeds[v].ready(10000)));if(stopped)return;
  if(venues.includes('kalshi')&&tracker.sid!==null){const t=tracker;void bootstrapStatus(t,ids.kalshi,async id=>{if(stopped||t!==tracker)throw Error('STOPPED');return publicConfirmationGet('https://external-api.kalshi.com/trade-api/v2/markets/'+encodeURIComponent(id),record);},500,()=>stopped||t!==tracker).catch(()=>{});}
 };
 const summary=()=>({scope:'TINY_LIVE_READINESS_READ_ONLY_WATCH',ordersEnabled:false,ledgerAccess:false,phase:stopped?'STOPPED':'RUNNING',startedAt:start,deadlineAt:deadline,endedAt,reason,policy:watchPolicy,evaluations,attempts,clockFault,
  reconnections:budget.used,events,rows:[...rows.values()],confirmations,evidenceStorage:writer.snapshot(),liveEquivalentRoutes:entries.filter(e=>liveSettlementReasons(e.pair,e.review,Date.now()).length===0).length,
  qualifyingCandidate:confirmations.find(c=>c.admission?.admitted)??null,feeds:Object.fromEntries((['kalshi','poly'] as Venue[]).map(v=>[v,{received:feeds[v]?.latest.size??0,expected:ids[v].length,health:health(v)}])),fillClaim:false});
 let heartbeat:ReturnType<typeof setInterval>,timer:ReturnType<typeof setInterval>,deadlineTimer:ReturnType<typeof setTimeout>,complete!:()=>void;
 const completion=new Promise<void>(r=>complete=r);
 const stop=(why:string)=>{if(stopped)return;stopped=true;reason=why;endedAt=Date.now();clearInterval(heartbeat);clearInterval(timer);clearTimeout(deadlineTimer);for(const feed of Object.values(feeds))feed.stop();save(dir,'summary.json',summary());complete();};
 const tick=async()=>{
  if(stopped||rebuilding||busy)return;if(!clockOkay()){stop('CLOCK_FAULT');return;}if(Date.now()>=deadline){stop('ORIGINAL_DEADLINE');return;}
  const failed=(['kalshi','poly'] as Venue[]).filter(v=>!health(v).connected);
  if(failed.length){const d=failed.map(venue=>feedDiagnostic({venue,lane:'discovery'},health(venue),feeds[venue].failures,feeds[venue].stream.health()));if(d.some(x=>!x.transportRebuildable)){events.push({at:Date.now(),diagnostics:d});stop('NONTRANSPORT_FEED_FAILURE');return;}
   const r=budget.reserve(failed.map(venue=>({venue,lane:'discovery'})),performance.now());if(!r.accepted){stop(r.reason!);return;}rebuilding=true;events.push({at:Date.now(),rebuild:failed});await connect(failed);rebuilding=false;return;}
  if(attempts>=watchPolicy.maxConfirmations||performance.now()-lastRequest<watchPolicy.confirmationSpacingMs||Date.now()+watchPolicy.confirmationReserveMs>=deadline)return;
  for(const e of entries)for(const side of ['yes','no'] as Side[]){const key=e.pair.id+'|'+side,ep=active.get(key);if(!ep||ep.requested)continue;
   const s=state(e),q=quoteCandidate(e.pair,s.a?.book,s.b?.book,side,s.at,1);if(!s.usable||!q.positiveExchangeNet||!q.economics||q.economics.reservedCash>50000)continue;
   ep.requested=true;busy=true;attempts++;lastRequest=performance.now();let isolated:Record<Venue,ConfirmationFeed>|null=null;
   try{
    record('CONFIRMATION_START',{episode:ep.id,pair:e.pair,review:e.review,original:q,books:{kalshi:s.a,poly:s.b},health:{kalshi:health('kalshi'),poly:health('poly')}});
    // Only potentially live-equivalent routes use a separate exact-market lane.
    // Diagnostic confirmations never become evidence of isolated execution health.
    const equivalent=liveSettlementReasons(e.pair,e.review,Date.now()).length===0;
    if(equivalent){isolated={kalshi:new ConfirmationFeed('kalshi',[e.pair.a.id],record),poly:new ConfirmationFeed('poly',[e.pair.b.id],record)};for(const feed of Object.values(isolated))feed.start();await Promise.all(Object.values(isolated).map(feed=>feed.ready(5000)));}
    const lane=isolated??feeds,result:any=await confirmScreenCandidate(e.pair,q,lane,()=>tracker.view(e.pair.a.id,Date.now(),health('kalshi').connected),e.review,record);
    const current=state(e),latest=quoteCandidate(e.pair,current.a?.book,current.b?.book,side,Date.now(),1);
    const uninterrupted=active.get(key)?.id===ep.id&&current.usable&&latest.positiveExchangeNet;
    const admission=assessWatchAdmission(e.pair,e.review,q,result,{stopped,uninterrupted,
     isolatedFeedsHealthy:!!isolated&&Object.values(isolated).every(feed=>feed.health().connected&&feed.health().clockOkay&&feed.health().backlog===0),persistenceHealthy:writer.snapshot().fault===null},Date.now());
    const row={episode:ep.id,pairId:e.pair.id,settlement:e.review.classification,startedAt:s.at,endedAt:Date.now(),status:stopped?'CENSORED':result.status,
     original:derivedQuote(q),repriced:derivedQuote(result.repriced??null),bookConfirmed:!stopped&&uninterrupted&&result.bookConfirmation?.accepted===true,admission,fillClaim:false};
    confirmations.push(row);record('CONFIRMATION_RESULT',{summary:row,completeRequestedProof:result});
    if(admission.admitted){record('CANDIDATE_FROZEN',{row,pair:e.pair,review:e.review});save(dir,'candidate.json',row);stop('QUALIFYING_CANDIDATE_FROZEN');}
   }catch{const row={episode:ep.id,pairId:e.pair.id,status:'FAILED',reason:'CONFIRMATION_FAILED',fillClaim:false};confirmations.push(row);record('CONFIRMATION_ERROR',row);}
   finally{if(isolated)for(const feed of Object.values(isolated))feed.stop();busy=false;}return;
  }
 };
 const interrupt=()=>stop('EXTERNAL_OR_SUPERVISOR_STOP');process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 heartbeat=setInterval(()=>{try{writer.checkpoint();save(dir,'summary.json',summary());console.log(JSON.stringify({mode:'live-data',phase:'RUNNING',elapsedMs:Date.now()-start,attempts,positiveEpisodes:episode,rawBytesWritten:writer.totalBytes,rotatedSegments:writer.snapshot().evictedMonitoring.segments,received:[feeds.kalshi?.latest.size??0,feeds.poly?.latest.size??0],ordersEnabled:false}));}catch{stop('RESOURCE_OR_PERSISTENCE_FAILURE');}},watchPolicy.heartbeatMs);
 deadlineTimer=setTimeout(()=>stop('ORIGINAL_DEADLINE'),deadline-Date.now());timer=setInterval(()=>{void tick().catch(()=>stop('PROCESSING_FAILURE'));},watchPolicy.healthSampleMs);
 try{await connect(['kalshi','poly']);rebuilding=false;await completion;while(busy)await new Promise(r=>setTimeout(r,20));writer.close();save(dir,'summary.json',summary());}
 finally{if(!stopped)stop('SETUP_FAILURE');process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);}
 console.log(JSON.stringify({mode:'live-data',phase:'STOPPED',reason,attempts,ordersEnabled:false}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [command,dir,arg,deadline]=process.argv.slice(2),root=resolve(new URL('..',import.meta.url).pathname);if(command==='freeze')freezeWatch(resolve(dir),resolve(arg),root);else if(command==='observe'){process.loadEnvFile(resolve(arg));await runWatch(resolve(dir),root,Number(deadline));}else throw Error('freeze DIR METADATA | observe DIR ENV DEADLINE');}
