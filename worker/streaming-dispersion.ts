// Public market data only. No account, order, strategy, ledger or database calls.
import {readFileSync,writeFileSync,appendFileSync,existsSync,renameSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import type {Pair,Venue,Side} from '../lib/arb/types.ts';
import {validity} from '../lib/screen/confirmation.ts';
import {content} from '../lib/screen/book-confirmation.ts';
import {streamingStudyPolicy as policy,studyQuotes,bestQuote,derivedQuote,rawGap,netGap,StreamingIntervals,WeightedValues,confirmedIntervalStatus} from '../lib/research/streaming-dispersion.ts';
import type {StudyQuote} from '../lib/research/streaming-dispersion.ts';
import {VenueRebuildBudget,feedDiagnostic} from '../lib/arb/production-operations.ts';
import {ConfirmationFeed,publicConfirmationGet} from './book-confirmation-adapter.ts';
import type {RecordEvidence} from './book-confirmation-adapter.ts';
import {confirmScreenCandidate} from './candidate-confirmation.ts';
import {MarketStatusTracker,lifecycleSubscription,bootstrapStatus} from '../lib/screen/market-status.ts';
import {sourceManifest} from './screen-manifest.ts';
import {authHeaders} from './streams.ts';

const sha=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
const save=(dir:string,file:string,x:unknown)=>{writeFileSync(resolve(dir,file+'.tmp'),JSON.stringify(x,null,2)+'\n');renameSync(resolve(dir,file+'.tmp'),resolve(dir,file));};
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
export function studyManifest(root:string){return {...sourceManifest(root),'scripts/streaming-dispersion-launch.mjs':sha(readFileSync(resolve(root,'scripts/streaming-dispersion-launch.mjs'))),'docs/research/streaming-culture-review-20260923.json':sha(readFileSync(resolve(root,'docs/research/streaming-culture-review-20260923.json')))};}
export function freezeStudy(dir:string,metadataPath:string,root:string){
 mkdirSync(dir,{recursive:true});if(existsSync(resolve(dir,'frozen.json')))throw Error('ONE_FREEZE_ONLY');
 const metadata=read(metadataPath),review=read(resolve(root,'docs/research/streaming-culture-review-20260923.json'));
 if(!Array.isArray(metadata)||metadata.length<1||metadata.length>policy.maxRoutes)throw Error('INVALID_ROUTE_COUNT');
 const selection=metadata.map((m:any)=>{const r=review.routes.find((r:any)=>r.pairId===m.pair.id);if(!r||r.marketHashes.kalshi!==m.pair.a.hash||r.marketHashes.poly!==m.pair.b.hash)throw Error('REVIEW_HASH_MISMATCH');
  if(!m.pair.a.open||!m.pair.b.open||Date.now()-m.at>2*3600000)throw Error('METADATA_CLOSED_OR_EXPIRED');
  if(m.native.event.fee_type_override!=null||m.native.event.fee_multiplier_override!=null||m.native.kalshi.fee_waiver_expiration_time)throw Error('UNREVIEWED_FEE_OVERRIDE');
  return {pair:m.pair,category:r.category,contractReview:r,metadataAt:m.at};});
 if(selection.filter((e:any)=>e.category!=='sports').length>policy.maxCultureRoutes||new Set(selection.map((e:any)=>e.pair.id)).size!==selection.length)throw Error('ROUTE_SCOPE');
 save(dir,'frozen.json',{at:Date.now(),policy,selection,manifest:studyManifest(root),metadataSha256:sha(readFileSync(metadataPath)),ordersEnabled:false});
 console.log(JSON.stringify({phase:'FROZEN',routes:selection.length,ordersEnabled:false}));
}
export async function runStudy(dir:string,root:string,originalDeadline:number){
 const frozen=read(resolve(dir,'frozen.json'));
 if(existsSync(resolve(dir,'started.json')))throw Error('ONE_STUDY_ONLY_NO_RESTART');
 if(JSON.stringify(frozen.policy)!==JSON.stringify(policy)||JSON.stringify(frozen.manifest)!==JSON.stringify(studyManifest(root))||Date.now()-frozen.at>600000)throw Error('FREEZE_CHANGED_OR_EXPIRED');
 if(!Number.isFinite(originalDeadline)||originalDeadline<=Date.now()||originalDeadline>Date.now()+policy.durationMs)throw Error('INVALID_ORIGINAL_DEADLINE');
 for(const v of ['kalshi','poly'] as Venue[])authHeaders(v);
 const start=Date.now(),startMono=performance.now(),deadlineMono=startMono+originalDeadline-start;
 writeFileSync(resolve(dir,'started.json'),JSON.stringify({startedAt:start,deadlineAt:originalDeadline,freezeSha256:sha(readFileSync(resolve(dir,'frozen.json'))),runtime:process.version,ordersEnabled:false}),{flag:'wx'});
 const entries=frozen.selection as {pair:Pair;category:string;contractReview:any}[];
 const intervals=new StreamingIntervals(),rebuild=new VenueRebuildBudget(policy.maxReconnectsPerVenue,deadlineMono);
 const feeds={} as Record<Venue,ConfirmationFeed>,ids={kalshi:[...new Set(entries.map(e=>e.pair.a.id))],poly:[...new Set(entries.map(e=>e.pair.b.id))]};
 const rows=new Map(entries.map(e=>[e.pair.id,{pairId:e.pair.id,category:e.category,kalshiId:e.pair.a.id,polyId:e.pair.b.id,classification:e.contractReview.status,
  validSimultaneousMs:0,priceableMs:0,excludedMs:{} as Record<string,number>,bookChanges:0,pricedChanges:0,quantitySet:[] as number[],best:null as ReturnType<typeof derivedQuote>,
  raw:new WeightedValues(),net:new WeightedValues(),q1raw:new WeightedValues(),q1net:new WeightedValues(),
  previousAt:startMono,previousUsable:false,previousReasons:['INITIALIZING'],previousQuotes:[] as StudyQuote[],stateSignature:''}]));
 let tracker=new MarketStatusTracker(ids.kalshi),stopped=false,stoppedAt:number|null=null,reason='ORIGINAL_DEADLINE',clockFault=false,bytes=0,evaluations=0,busy=false,attempts=0,lastRequest=-Infinity;
 const events:any[]=[],confirmations:any[]=[],requested=new Set<number>(),pending=new Map<number,{entry:typeof entries[number];quote:StudyQuote;queuedAt:number}>();
 const signatures=new Map<string,string>();
 const clockOkay=()=>{if(Math.abs((Date.now()-start)-(performance.now()-startMono))>1000)clockFault=true;return !clockFault;};
 const record:RecordEvidence=(kind,body)=>{if(stopped)return;const line=JSON.stringify({at:Date.now(),kind,body})+'\n';bytes+=Buffer.byteLength(line);if(bytes>policy.maxEvidenceBytes){stop('EVIDENCE_LIMIT');return;}appendFileSync(resolve(dir,'evidence.ndjson'),line);};
 const health=(v:Venue)=>{const h=feeds[v]?.health()??{connected:false,clockOkay:true,backlog:0};return {...h,clockOkay:h.clockOkay&&clockOkay()};};
 const status=(id:string)=>tracker.view(id,Date.now(),feeds.kalshi?.stream.isHealthy()??false);
 const state=(e:typeof entries[number])=>{const a=feeds.kalshi?.latest.get(e.pair.a.id)?.e,b=feeds.poly?.latest.get(e.pair.b.id)?.e,at=Date.now(),mono=performance.now();
  const av=validity(a,health('kalshi'),at,mono),bv=validity(b,health('poly'),at,mono),s=status(e.pair.a.id);
  const reasons=[...av.reasons.map(r=>'KALSHI_'+r),...bv.reasons.map(r=>'PM_US_'+r),...(s.knownBlocked?s.reasons.map(r=>'STATUS_'+r):[])];
  return {a,b,at,mono,usable:reasons.length===0,reasons};};
 const accrue=(row:ReturnType<typeof rows.get>,mono:number,currentUsable:boolean)=>{if(!row)return;const ms=Math.max(0,mono-row.previousAt);
  // Conservative at fault boundaries: exclude the final health-sampling slice
  // instead of extending the last good state through an unknown disconnect.
  if(row.previousUsable&&currentUsable){row.validSimultaneousMs+=ms;if(row.previousQuotes.length){row.priceableMs+=ms;const q=bestQuote(row.previousQuotes)!,raw=bestQuote(row.previousQuotes,'raw')!;row.raw.observe(rawGap(raw),ms);row.net.observe(netGap(q),ms);const one=bestQuote(row.previousQuotes.filter(q=>q.quantity===1));if(one){row.q1raw.observe(rawGap(one),ms);row.q1net.observe(netGap(one),ms);}}}
  else {const reasons=row.previousUsable?['FAULT_BOUNDARY_CENSORED']:row.previousReasons;for(const r of reasons)row.excludedMs[r]=(row.excludedMs[r]??0)+ms;}
  row.previousAt=mono;
 };
 const evaluate=(e:typeof entries[number],changed=false)=>{if(stopped)return;const s=state(e),row=rows.get(e.pair.id)!;accrue(row,s.mono,s.usable);evaluations++;
  row.previousUsable=s.usable;row.previousReasons=s.reasons;row.previousQuotes=[];row.stateSignature=JSON.stringify([s.usable,s.reasons]);if(changed)row.bookChanges++;
  for(const side of ['yes','no'] as Side[]){const qs=s.usable?studyQuotes(e.pair,s.a?.book,s.b?.book,side,s.at):[];
   row.previousQuotes.push(...qs);const evidence=s.usable&&qs.length?qs:null;
   intervals.update(e.pair.id+'|'+side,'raw',s.at,evidence);const fee=intervals.update(e.pair.id+'|'+side,'fee',s.at,evidence);
   if(fee.row&&!requested.has(fee.row.id)&&!pending.has(fee.row.id))pending.set(fee.row.id,{entry:e,quote:bestQuote(qs)!,queuedAt:s.at});
  }
  if(row.previousQuotes.length){if(changed)row.pricedChanges++;row.quantitySet=[...new Set([...row.quantitySet,...row.previousQuotes.map(q=>q.quantity)])].sort((a,b)=>a-b);const q=derivedQuote(bestQuote(row.previousQuotes));if(q&&(!row.best||q.feeNetSurplus>row.best.feeNetSurplus))row.best=q;
   row.raw.observe(rawGap(bestQuote(row.previousQuotes,'raw')!),0);row.net.observe(netGap(bestQuote(row.previousQuotes)!),0);const one=bestQuote(row.previousQuotes.filter(q=>q.quantity===1));if(one){row.q1raw.observe(rawGap(one),0);row.q1net.observe(netGap(one),0);}}
  if(changed)record('DERIVED_CHANGE',{pairId:e.pair.id,at:s.at,usable:s.usable,reasons:s.reasons,quotes:row.previousQuotes.map(derivedQuote)});
 };
 const mark=(v:Venue)=>(r:any)=>{if(stopped)return;const key=v+':'+r.e.book.marketId,sig=content(r.e.book),changed=signatures.get(key)!==sig;signatures.set(key,sig);
  if(changed)for(const e of entries)if((v==='kalshi'?e.pair.a.id:e.pair.b.id)===r.e.book.marketId)evaluate(e,true);};
 const connect=async(venues:Venue[])=>{
  if(stopped||Date.now()>=originalDeadline)return;
  for(const v of venues){feeds[v]?.stop();for(const key of signatures.keys())if(key.startsWith(v+':'))signatures.delete(key);if(v==='kalshi')tracker=new MarketStatusTracker(ids.kalshi);
   const streamRecord:RecordEvidence=(kind,body)=>{record(kind,{venue:v,evidence:body});if(v==='kalshi'&&kind==='WS_SUBSCRIPTION_REQUEST'&&(body as any).message?.params?.channels?.includes('market_lifecycle_v2'))tracker.requested((body as any).at);};
   feeds[v]=new ConfirmationFeed(v,ids[v],streamRecord,{onBook:mark(v),onInvalid:r=>{events.push({at:Date.now(),venue:v,reason:r});if(v==='kalshi')tracker.invalidate(r);for(const e of entries)evaluate(e);},...(v==='kalshi'?{extraSubscriptions:[lifecycleSubscription],onMessage:(m:any,at:number,mono:number)=>{tracker.receive(m,at,mono);}}:{})});
  }
  for(const v of venues)feeds[v].start();
  // Readiness failures are retained per venue; never hide integrity failures
  // behind a simultaneous transport error, and never rebuild the healthy peer.
  await Promise.allSettled(venues.map(v=>feeds[v].ready(Math.max(0,Math.min(10000,deadlineMono-performance.now())))));
  if(stopped)return;
  // Status is separate from price confirmation. Do not hold an initial positive
  // quote behind 17 paced metadata GETs; unknown status cannot admit a trade.
  if(venues.includes('kalshi')&&tracker.sid!==null){const currentTracker=tracker;
   void bootstrapStatus(currentTracker,ids.kalshi,async id=>{if(stopped||tracker!==currentTracker)throw Error('STUDY_STOPPED_OR_TRACKER_REBUILT');return publicConfirmationGet('https://external-api.kalshi.com/trade-api/v2/markets/'+encodeURIComponent(id),record);},500,()=>stopped||tracker!==currentTracker).then(()=>{if(!stopped)for(const e of entries)evaluate(e);}).catch(()=>record('STATUS_BOOTSTRAP_INCOMPLETE',{at:Date.now()}));
  }
  for(const e of entries)evaluate(e);
 };
 let healthTimer:ReturnType<typeof setInterval>,heartbeat:ReturnType<typeof setInterval>,deadlineTimer:ReturnType<typeof setTimeout>;
 let finish!:()=>void;const completion=new Promise<void>(r=>{finish=r;});
 const summary=()=>({scope:'ORDER_DISABLED_READ_ONLY_STREAMING_DISPERSION',phase:stopped?'STOPPED':'RUNNING',startedAt:start,deadlineAt:originalDeadline,endedAt:stoppedAt,reason,ordersEnabled:false,ledgerAccess:false,policy,
  evaluations,attempts,clockFault,bytes,reconnections:rebuild.used,feedEvents:events,feeds:Object.fromEntries((['kalshi','poly'] as Venue[]).map(v=>[v,feeds[v]?{health:health(v),transport:feeds[v].stream.health(),failures:feeds[v].failures,receivedMarkets:feeds[v].latest.size,expectedMarkets:ids[v].length}:null])),
  routes:[...rows.values()].map(({previousQuotes,previousAt,previousUsable,previousReasons,stateSignature,raw,net,q1raw,q1net,...r})=>({...r,rawGap:raw.summary(),feeNetGap:net.summary(),oneContractRawGap:q1raw.summary(),oneContractFeeNetGap:q1net.summary(),settlement:entries.find(e=>e.pair.id===r.pairId)!.contractReview})),
  intervals:intervals.rows,confirmations,pendingConfirmations:[...pending.keys()],fillClaim:false});
 const stop=(why:string)=>{if(stopped)return;reason=why;stoppedAt=Date.now();for(const e of entries){const s=state(e);accrue(rows.get(e.pair.id),Math.min(s.mono,deadlineMono),s.usable);}intervals.stop(Math.min(Date.now(),originalDeadline));stopped=true;
  clearInterval(healthTimer);clearInterval(heartbeat);clearTimeout(deadlineTimer);for(const f of Object.values(feeds))f.stop();save(dir,'summary.json',summary());finish();console.log(JSON.stringify({mode:'live-data',phase:'STOPPED',reason,attempts,intervals:intervals.rows.length,ordersEnabled:false}));};
 const interrupt=()=>stop('EXTERNAL_OR_SUPERVISOR_STOP');process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 deadlineTimer=setTimeout(()=>stop('ORIGINAL_DEADLINE'),Math.max(0,originalDeadline-Date.now()));
 heartbeat=setInterval(()=>{save(dir,'summary.json',summary());console.log(JSON.stringify({mode:'live-data',phase:'RUNNING',elapsedMs:Date.now()-start,attempts,intervals:intervals.rows.length,reconnections:rebuild.used,received:[feeds.kalshi?.latest.size??0,feeds.poly?.latest.size??0],ordersEnabled:false}));},policy.heartbeatMs);
 let rebuilding=true;
 const tick=async()=>{if(stopped)return;if(!clockOkay()){stop('CLOCK_FAULT');return;}if(Date.now()>=originalDeadline){stop('ORIGINAL_DEADLINE');return;}
  for(const e of entries){const s=state(e),row=rows.get(e.pair.id)!;if(row.stateSignature!==JSON.stringify([s.usable,s.reasons]))evaluate(e);else accrue(row,s.mono,s.usable);}
  if(rebuilding||busy)return;
  const failed=(['kalshi','poly'] as Venue[]).filter(v=>!health(v).connected);
  if(failed.length){const diagnostics=failed.map(venue=>feedDiagnostic({venue,lane:'discovery'},health(venue),feeds[venue].failures,feeds[venue].stream.health()));
   if(diagnostics.some(d=>!d.transportRebuildable)){events.push({at:Date.now(),diagnostics});stop('NONTRANSPORT_FEED_FAILURE');return;}
   const reservation=rebuild.reserve(failed.map(venue=>({venue,lane:'discovery'})),performance.now());if(!reservation.accepted){stop(reservation.reason!);return;}
   rebuilding=true;events.push({at:Date.now(),action:'REBUILD',venues:failed,budget:{...rebuild.used}});await connect(failed);rebuilding=false;return;
  }
  if(attempts>=policy.maxConfirmations||performance.now()-lastRequest<policy.confirmationSpacingMs||performance.now()+policy.confirmationShutdownReserveMs>=deadlineMono)return;
  for(const [id,p]of pending){const interval=intervals.rows.find(r=>r.id===id)!;if(!intervals.active.has('fee|'+interval.key))continue;
   const s=state(p.entry);if(!s.usable)continue;const q=bestQuote(studyQuotes(p.entry.pair,s.a?.book,s.b?.book,p.quote.aSide,s.at));if(!q?.positiveExchangeNet)continue;
   pending.delete(id);requested.add(id);busy=true;attempts++;lastRequest=performance.now();const began=Date.now(),segmentsAtStart=interval.segments.length;
   record('CONFIRMATION_START',{intervalId:id,original:derivedQuote(q)});
   try{const result:any=await confirmScreenCandidate(p.entry.pair,q,feeds,()=>status(p.entry.pair.a.id),p.entry.contractReview,record);
    const continuity=confirmedIntervalStatus(result.status,id,segmentsAtStart,intervals.active.get('fee|'+interval.key));
    const row={intervalId:id,startedAt:began,endedAt:Date.now(),triggerDelayMs:began-p.queuedAt,status:stopped?'UNKNOWN_AT_DEADLINE':continuity.status,reasons:stopped?['DEADLINE_CENSORED']:[...result.reasons,...continuity.reasons],
     original:derivedQuote(q),repriced:derivedQuote(result.repriced??null),window:result.window??null,settlementClassification:p.entry.contractReview.status,
     bookConfirmed:!stopped&&continuity.reasons.length===0&&result.bookConfirmation?.accepted===true,marketStatus:result.marketStatus,tradability:{admitted:false,reasons:['ORDER_DISABLED_STUDY_ONLY']},fillClaim:false};
    confirmations.push(row);record('CONFIRMATION_RESULT',row);
   }catch{confirmations.push({intervalId:id,startedAt:began,endedAt:Date.now(),status:'FAILED',reasons:['CONFIRMATION_ERROR'],original:derivedQuote(q),bookConfirmed:false,fillClaim:false});}
   finally{busy=false;}break;
  }
 };
 healthTimer=setInterval(()=>{void tick().catch(()=>stop('STUDY_PROCESSING_FAILURE'));},policy.healthSampleMs);
 try{await connect(['kalshi','poly']);rebuilding=false;await completion;while(busy)await sleep(20);save(dir,'summary.json',summary());}
 finally{if(!stopped)stop('STUDY_SETUP_FAILURE');process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [command,dir,arg,deadline]=process.argv.slice(2),root=resolve(new URL('..',import.meta.url).pathname);
 if(command==='freeze')freezeStudy(resolve(dir),resolve(arg),root);
 else if(command==='observe'){process.loadEnvFile(resolve(arg));await runStudy(resolve(dir),root,Number(deadline));}
 else throw Error('Usage: streaming-dispersion.ts freeze DIR METADATA | observe DIR ENV_FILE ORIGINAL_DEADLINE_MS');
}
