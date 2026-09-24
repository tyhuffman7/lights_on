// Read-only scoped watch. No order, preview, cancel, execution ledger or PAPER imports.
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import type {Pair,Venue,Side} from '../lib/arb/types.ts';
import {normalizeKalshi,normalizePoly} from '../lib/arb/adapters.ts';
import {quoteBounded,type FeeEvidence,type Quote} from '../lib/pilot/bounded-basis.ts';
import {candidateWatchPolicy as policy,watchUniverse,scheduleShards,routeEconomics,rankWatchQuotes,noiseResilience,RouteCoverage,type WatchEntry} from '../lib/pilot/candidate-watch.ts';
import {ConfirmationFeed,confirmPolyBook,publicConfirmationGet,type RecordEvidence} from './book-confirmation-adapter.ts';
import {validity} from '../lib/screen/confirmation.ts';
import {assessSnapshot} from '../lib/screen/book-confirmation.ts';
import {lifecycleSubscription,MarketStatusTracker} from '../lib/screen/market-status.ts';
import {SegmentedEvidence,verifyCriticalEvidence} from './segmented-evidence.ts';
import {sourceManifest} from './screen-manifest.ts';
const sha=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const save=(dir:string,name:string,x:unknown)=>{writeFileSync(resolve(dir,name+'.tmp'),JSON.stringify(x,null,2)+'\n',{mode:0o600});renameSync(resolve(dir,name+'.tmp'),resolve(dir,name));};
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,Math.max(0,ms)));
const K='https://external-api.kalshi.com/trade-api/v2',P='https://gateway.polymarket.us/v1';
function manifest(root:string){return {...sourceManifest(root),'scripts/bounded-candidate-launch.mjs':sha(readFileSync(resolve(root,'scripts/bounded-candidate-launch.mjs')))};}
export function freeze(dir:string,candidates:string,audit:string,root:string){
 mkdirSync(dir,{recursive:true,mode:0o700});if(existsSync(resolve(dir,'frozen.json')))throw Error('SINGLE_FREEZE');
 const rows=read(audit),aggregate=read(resolve(root,'docs/research/settlement-families/aggregate.json'));
 if(sha(JSON.stringify(rows))!==aggregate.routeAuditSha256)throw Error('PINNED_AUDIT_CHANGED');
 const pairs=new Map<string,Pair>(read(candidates).map((x:any)=>[x.pair.id,x.pair]));
 const families=new Map<string,any>(read(resolve(root,'docs/research/settlement-families/matrix.json')).records.map((x:any)=>[x.id,x]));
 const entries:WatchEntry[]=rows.map((r:any)=>{const pair=pairs.get(r.routeId),family=families.get(r.family);if(!pair||!family||pair.a.hash!==r.metadataHashes[0]||pair.b.hash!==r.metadataHashes[1])throw Error('UNBOUND_ROUTE');return {pair,family,proof:r.proof};});
 const selected=watchUniverse(entries);if(selected.length!==2852)throw Error('EXPECTED_2852_BOUND_ROUTES');
 save(dir,'frozen.json',{at:Date.now(),policy,manifest:manifest(root),auditSha256:aggregate.routeAuditSha256,shards:scheduleShards(selected,Date.now()),universe:2852,ordersEnabled:false});
 console.log(JSON.stringify({phase:'FROZEN',routes:selected.length,shards:Math.ceil(selected.length/60),ordersEnabled:false}));
}
type Meta=WatchEntry&{at:number;fees:Record<Venue,FeeEvidence>;releaseAt:number;ticks:Record<Venue,number>;closeAt:number;exceptions:string[];native:any;http:any[]};
export async function observe(dir:string,root:string,deadline:number){
 const f=read(resolve(dir,'frozen.json')),started=Date.now(),startMono=performance.now();
 if(existsSync(resolve(dir,'started.json'))||JSON.stringify(f.policy)!==JSON.stringify(policy)||JSON.stringify(f.manifest)!==JSON.stringify(manifest(root))||started-f.at>600000||deadline>started+policy.durationMs||deadline<=started)throw Error('INVALID_FROZEN_SESSION');
 writeFileSync(resolve(dir,'started.json'),JSON.stringify({started,deadline,ordersEnabled:false}),{flag:'wx',mode:0o600});
 const writer=new SegmentedEvidence(resolve(dir,'evidence')),coverage=new RouteCoverage();
 let stopped=false,reason='ORIGINAL_DEADLINE',endedAt:number|null=null,shardIndex=-1,busy=false,lastConfirm=-Infinity;
 let feeds:Partial<Record<Venue,ConfirmationFeed>>={},active:Meta[]=[],tracker=new MarketStatusTracker([]);
 const reconnects={kalshi:0,poly:0},visited=new Set<string>(),eligible=new Set<string>(),excluded=new Map<string,string>(),diagnostics:Record<string,number>={},counts={evaluations:0,positiveEpisodes:0,requestedConfirmations:0,confirmedPositives:0};
 const episodes=new Map<string,{id:number;requested:boolean}>(),confirmations:any[]=[],events:any[]=[];
 let candidate:any=null,best:any=null,maxRss=process.memoryUsage().rss;
 const record:RecordEvidence=(kind,body)=>writer.append(kind,body,kind!=='WS_BOOK'&&kind!=='HTTP_REQUEST'&&kind!=='HTTP_RESPONSE');
 const aggregate=()=>({scope:'BOUNDED_BASIS_CANDIDATE_WATCH_READ_ONLY',ordersEnabled:false,liveSubmission:'LIVE_SUBMISSION_BLOCKED',phase:stopped?'STOPPED':'RUNNING',startedAt:started,deadlineAt:deadline,endedAt,reason,
  universe:2852,visitedRoutes:visited.size,metadataEligibleRoutes:eligible.size,...coverage.summary(),...counts,shardIndex,totalShards:f.shards.length,policy,reconnections:reconnects,
  exclusions:Object.fromEntries([...new Set(excluded.values())].map(k=>[k,[...excluded.values()].filter(x=>x===k).length])),diagnostics,confirmations,strongestConfirmed:best,candidate,
  storage:writer.snapshot(),maxRss,events,fillClaim:false,lockupBasis:'Later venue expected/end date; indicative, not guaranteed cash release',
  feeBasis:'Current metadata coefficients; existing Kalshi cent-precision 0.01-fill no-rebate upper bound; PM cumulative cent ceiling; no account fee-tier assumption'});
 const stop=(why:string)=>{if(stopped)return;coverage.sample([],performance.now());stopped=true;endedAt=Date.now();reason=why;for(const feed of Object.values(feeds))feed.stop();};
 const clockOkay=()=>Math.abs((Date.now()-started)-(performance.now()-startMono))<=1000;
 const pulse=setInterval(()=>{try{maxRss=Math.max(maxRss,process.memoryUsage().rss);if(!clockOkay())stop('CLOCK_FAULT');if(Date.now()>=deadline)stop('ORIGINAL_DEADLINE');writer.checkpoint();save(dir,'summary.json',aggregate());console.log(JSON.stringify({mode:'live-data',phase:stopped?'STOPPED':'RUNNING',elapsedMs:Date.now()-started,visited:visited.size,...coverage.summary(),...counts,shardIndex,ordersEnabled:false}));}catch{stop('RESOURCE_OR_PERSISTENCE_FAILURE');}},policy.heartbeatMs);
 const deadlineTimer=setTimeout(()=>stop('ORIGINAL_DEADLINE'),deadline-started);
 const interrupt=()=>stop('EXTERNAL_OR_SUPERVISOR_STOP');process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 const slots=new Map<string,number>();let cache=new Map<string,Promise<any>>();
 const get=async(url:string,cached=false):Promise<any>=>{
  if(stopped)throw Error('WATCH_STOPPED');if(cached&&cache.has(url))return cache.get(url);
  const task=(async()=>{const host=new URL(url).host,at=Math.max(performance.now(),slots.get(host)??0);slots.set(host,at+policy.httpSpacingMs);await sleep(at-performance.now());if(stopped)throw Error('WATCH_STOPPED');
   const r=await publicConfirmationGet(url,record);if(r.evidence.status!==200)throw Error('METADATA_HTTP_'+r.evidence.status);return r;})();if(cached)cache.set(url,task);return task;
 };
 const refresh=async(entry:WatchEntry,confirmation=false):Promise<Meta>=>{
  const old=entry.pair;const [k,p,s]=await Promise.all([get(K+'/markets/'+encodeURIComponent(old.a.id)),get(P+'/market/slug/'+encodeURIComponent(old.b.id)),get(K+'/series/'+encodeURIComponent(old.a.series!),!confirmation)]);
  const m=k.data.market,pm=p.data.market??p.data;
  if(m?.ticker!==old.a.id||pm.slug!==old.b.id||s.data.series?.ticker!==old.a.series)throw Error('METADATA_IDENTITY_CHANGED');
  const [e,x]=await Promise.all([get(K+'/events/'+encodeURIComponent(m.event_ticker),!confirmation),get(K+'/exchange/status',!confirmation)]),event=e.data.event;
  const [a,b]=await Promise.all([normalizeKalshi(m,s.data.series),normalizePoly(pm)]);
  if(a.hash!==old.a.hash||b.hash!==old.b.hash)throw Error('PINNED_METADATA_CHANGED');
  if(!a.open||!b.open||pm.ep3Status!=='OPEN'||pm.status!=='MARKET_STATUS_OPEN'||Date.parse(m.close_time)<=Date.now()||x.data.trading_active!==true||x.data.exchange_active!==true)throw Error('MARKET_NOT_OPEN');
  if(event?.fee_type_override!=null||event?.fee_multiplier_override!=null||m.fee_waiver_expiration_time)throw Error('UNREVIEWED_FEE_OVERRIDE');
  if(a.feeRate===null||b.feeRate===null||a.exchangeIndex!==0)throw Error('FEE_OR_EXCHANGE_UNSUPPORTED');
  const exceptions:string[]=[];
  // Current indicators only. Absence of a venue flag is not a proof that an off-venue exception cannot exist.
  for(const data of [m,pm,event])for(const [key,value]of Object.entries(data??{}))if(/^(is_?)?(disputed|cancelled|canceled|postponed|suspended|voided|amended)$/i.test(key)&&value===true)exceptions.push(key);
  if(exceptions.length)throw Error('EXCEPTION_INDICATED');
  const at=Date.now(),pair={...old,a,b},releaseAt=Math.max(Date.parse(a.closeAt),Date.parse(b.closeAt));
  if(!Number.isFinite(releaseAt)||releaseAt<=at)throw Error('INDICATIVE_LOCKUP_UNAVAILABLE');
  const make=(v:Venue,market:typeof a,r:any):FeeEvidence=>({marketId:market.id,marketHash:market.hash,checkedAt:at,expiresAt:at+policy.metadataMaxAgeMs,source:{url:r.evidence.url,sha256:r.evidence.bodySha256},rate:market.feeRate!,model:v==='kalshi'?'KALSHI_FRAGMENT_BOUND':'PM_CUMULATIVE',...(v==='kalshi'?{balancePrecisionMicros:10000 as const,minFillHundredths:1}:{})});
  const ranges=m.price_ranges,kt=m.price_level_structure==='linear_cent'&&ranges?.length===1&&ranges[0].step==='0.0100'?100:0,pt=Math.round(pm.orderPriceMinTickSize*10000);
  return {...entry,pair,at,fees:{kalshi:make('kalshi',a,s),poly:make('poly',b,p)},releaseAt,ticks:{kalshi:kt,poly:pt},closeAt:Date.parse(m.close_time),exceptions,native:{kalshi:m,poly:pm,event},http:[k,p,s,e,x].map(r=>r.evidence)};
 };
 const healthy=(venue:Venue)=>feeds[venue]?.health()??{connected:false,clockOkay:true,backlog:0};
 const state=(e:Meta)=>{
  const at=Date.now(),mono=performance.now(),k=feeds.kalshi?.latest.get(e.pair.a.id),p=feeds.poly?.latest.get(e.pair.b.id),s=tracker.states.get(e.pair.a.id);
  const usable=at-e.at<=policy.metadataMaxAgeMs&&at<e.closeAt&&!s?.knownNegative&&!s?.issues.size&&!tracker.faults.size&&
   validity(k?.e,healthy('kalshi'),at,mono).usableForDiscovery&&validity(p?.e,healthy('poly'),at,mono).usableForDiscovery;
  return {at,mono,usable,books:k&&p?{kalshi:k.e.book,poly:p.e.book}:null};
 };
 const connect=async(venue:Venue)=>{
  feeds[venue]?.stop();const ids=[...new Set(active.map(e=>venue==='kalshi'?e.pair.a.id:e.pair.b.id))];
  if(venue==='kalshi')tracker=new MarketStatusTracker(ids);
  const hook:RecordEvidence=(kind,body)=>record(kind,{venue,body});
  feeds[venue]=new ConfirmationFeed(venue,ids,hook,venue==='kalshi'?{extraSubscriptions:[lifecycleSubscription],onMessage:(m,at,mono)=>tracker.receive(m,at,mono),onInvalid:r=>tracker.invalidate(r)}:{});
  feeds[venue]!.start();await feeds[venue]!.ready(10000).catch(()=>{});
 };
 const confirm=async(e:Meta,original:Quote,episode:number)=>{
  counts.requestedConfirmations++;lastConfirm=performance.now();busy=true;let isolated:Record<Venue,ConfirmationFeed>|null=null;
  try{
   const fresh=await refresh(e,true);if(stopped)return;
   isolated={kalshi:new ConfirmationFeed('kalshi',[e.pair.a.id],record),poly:new ConfirmationFeed('poly',[e.pair.b.id],record)};
   for(const feed of Object.values(isolated))feed.start();await Promise.all(Object.values(isolated).map(feed=>feed.ready(5000)));
   const requestedAt=Date.now();record('EXACT_QUANTITY_FROZEN',{episode,original,metadata:fresh});
   const [k,p]=await Promise.all([isolated.kalshi.confirmKalshi(e.pair.a.id),confirmPolyBook(e.pair.b.id,()=>isolated!.poly.latest.get(e.pair.b.id),()=>isolated!.poly.health(),record)]);
   const at=Date.now(),mono=performance.now(),ka=assessSnapshot(k.request,k.response,isolated.kalshi.latest.get(e.pair.a.id),isolated.kalshi.health(),at,mono),pa=assessSnapshot(p.request,p.response,isolated.poly.latest.get(e.pair.b.id),isolated.poly.health(),at,mono);
   const reasons=[...k.reasons,...p.reasons,...ka.reasons,...pa.reasons];
   if(Math.abs(k.response.e.book.receivedMono-p.response.e.book.receivedMono)>2000)reasons.push('CROSS_VENUE_CONFIRMATION_DELAY');
   if(stopped||Date.now()>=deadline)reasons.push('WATCH_STOPPED');
   if(!Object.values(isolated).every(f=>{const h=f.health();return h.connected&&h.clockOkay&&h.backlog===0;}))reasons.push('ISOLATED_FEED_UNHEALTHY');
   if(!state(e).usable)reasons.push('DISCOVERY_OR_STATUS_INVALID');
   const q=quoteBounded(fresh.pair,{kalshi:ka.selected.e.book,poly:pa.selected.e.book},original.aSide,fresh.fees,fresh.releaseAt,at,original.quantity)[0];
   if(!q||q.quantity!==original.quantity||q.bSide!==original.bSide)reasons.push('EXACT_QUANTITY_UNAVAILABLE');
   if(fresh.fees.kalshi.rate!==e.fees.kalshi.rate||fresh.fees.poly.rate!==e.fees.poly.rate)reasons.push('FEE_COEFFICIENT_CHANGED');
   const survived=!reasons.length&&!!q&&q.feeNetProfit>0;
   const proof={requestedAt,at,ka,pa,reasons,q};record('REQUESTED_BOOK_PROOF',proof);writer.checkpoint();
   const row={episode,pairId:e.pair.id,at,status:reasons.length?'FAILED':survived?'EDGE_SURVIVED':'EDGE_DISAPPEARED',reasons:[...new Set(reasons)],quote:q??null,evidenceSha256:sha(JSON.stringify(proof)),noise:q?noiseResilience(q,fresh.fees,fresh.ticks):null};confirmations.push(row);
   if(survived){counts.confirmedPositives++;if(!best||rankWatchQuotes({quote:q!,depth:original.quantity},{quote:best.quote,depth:best.quote.quantity})<0)best=row;
    if(row.noise?.worthwhile){candidate={...row,status:'PILOT_CANDIDATE',markets:{kalshi:{id:e.pair.a.id,side:q!.aSide,price:q!.kalshi.levels.at(-1)!.price},poly:{id:e.pair.b.id,side:q!.bSide,price:q!.poly.levels.at(-1)!.price}},residualSettlementRisks:e.family.divergences,
     indicativeLockupMs:q!.expectedReleaseAt-at,exceptionEvidenceScope:'Current venue metadata and market-status flags; no known active flag',nonEligibilityPrerequisitesComplete:false,
     remainingNonEligibilityChecks:['Independent current event/exception review','Fresh account and lifetime-ledger reconciliation; sufficient venue cash; no unknown exposure'],liveSubmission:'LIVE_SUBMISSION_BLOCKED',ordersEnabled:false,fillClaim:false};
     record('CANDIDATE_FROZEN',candidate);save(dir,'candidate.json',candidate);stop('STRONG_CONFIRMED_CANDIDATE_FROZEN');}}
  }catch(error){confirmations.push({episode,pairId:e.pair.id,status:'FAILED',reason:(error as Error).message});}
  finally{if(isolated)for(const feed of Object.values(isolated))feed.stop();busy=false;}
 };
 try{
  for(shardIndex=0;!stopped;shardIndex=(shardIndex+1)%f.shards.length){
   active=[];cache=new Map();coverage.sample([],performance.now());
   const shard=f.shards[shardIndex] as WatchEntry[];let cursor=0;
   await Promise.all(Array.from({length:4},async()=>{while(cursor<shard.length&&!stopped){const e=shard[cursor++];visited.add(e.pair.id);try{const m=await refresh(e);active.push(m);eligible.add(e.pair.id);excluded.delete(e.pair.id);}catch(error){excluded.set(e.pair.id,(error as Error).message);}}}));
   if(stopped)break;if(!active.length)continue;
   for(const entry of active)record('SHARD_METADATA',{shardIndex,entry});await Promise.all((['kalshi','poly'] as Venue[]).map(connect));
   const shardEnd=Math.min(deadline,Date.now()+policy.shardDwellMs);
   while(!stopped&&Date.now()<shardEnd){
    if(!clockOkay()){stop('CLOCK_FAULT');break;}const selected:{entry:Meta;quote:Quote;depth:number;episode:number}[]=[],usableIds:string[]=[];
    for(const e of active){const s=state(e);if(!s.usable||!s.books)continue;usableIds.push(e.pair.id);
     for(const side of ['yes','no'] as Side[]){const key=e.pair.id+'|'+side,r=routeEconomics(e.pair,s.books,side,e.fees,e.releaseAt,s.at);counts.evaluations++;diagnostics[r.diagnosis]=(diagnostics[r.diagnosis]??0)+1;
      const q=r.quotes.find(x=>x.feeNetProfit>0);if(!q){episodes.delete(key);continue;}let ep=episodes.get(key);if(!ep){ep={id:++counts.positiveEpisodes,requested:false};episodes.set(key,ep);record('POSITIVE_EPISODE',{episode:ep.id,quote:q});}
      if(!ep.requested)selected.push({entry:e,quote:q,depth:r.depth,episode:ep.id});
     }}
    coverage.sample(usableIds,performance.now());
    if(selected.length&&counts.requestedConfirmations<policy.maxConfirmations&&performance.now()-lastConfirm>=policy.confirmationSpacingMs&&Date.now()+15000<deadline){selected.sort(rankWatchQuotes);const row=selected[0];episodes.get(row.entry.pair.id+'|'+row.quote.aSide)!.requested=true;await confirm(row.entry,row.quote,row.episode);}
    for(const venue of ['kalshi','poly'] as Venue[]){if(stopped)break;if(!healthy(venue).connected){if(reconnects[venue]>=policy.maxReconnectsPerVenue){stop('PER_VENUE_RECONNECT_BUDGET_EXHAUSTED');break;}reconnects[venue]++;events.push({at:Date.now(),venue,reconnect:reconnects[venue],failures:feeds[venue]?.failures});await connect(venue);}}
    await sleep(policy.sampleMs);
   }
   coverage.sample([],performance.now());for(const feed of Object.values(feeds))feed.stop();feeds={};
  }
 }catch(error){events.push({at:Date.now(),failure:(error as Error).message});stop('WATCH_PROCESSING_FAILURE');}
 finally{if(!stopped)stop('WATCH_FINISHED');clearInterval(pulse);clearTimeout(deadlineTimer);process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);writer.close();save(dir,'summary.json',aggregate());save(dir,'coverage-private.json',{rows:[...coverage.rows],excluded:[...excluded],visited:[...visited],eligible:[...eligible]});save(dir,'integrity.json',verifyCriticalEvidence(resolve(dir,'evidence/critical.ndjson')));}
 console.log(JSON.stringify({mode:'live-data',phase:'STOPPED',reason,...coverage.summary(),...counts,ordersEnabled:false,busy}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [command,dir,a,b]=process.argv.slice(2),root=resolve(new URL('..',import.meta.url).pathname);if(command==='freeze')freeze(resolve(dir),resolve(a),resolve(b),root);else if(command==='observe'){process.loadEnvFile(resolve(a));await observe(resolve(dir),root,Number(b));}else throw Error('freeze DIR CANDIDATES AUDIT | observe DIR ENV DEADLINE');}
