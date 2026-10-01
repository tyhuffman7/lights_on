// PAPER/public market data only. No account, order, preview or wallet adapters.
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,appendFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import {normalizeBook,normalizeKalshi,normalizePoly} from '../lib/arb/adapters.ts';
import type {Market,Venue} from '../lib/arb/types.ts';
import {assessSettlement} from '../lib/research/settlement-validation.ts';
import {takeDepth,normalFee,USD_SCALE} from '../lib/research/ev-arb.ts';
import {recallPolicy,recallMatches,recallSignals,fairRoutes,currentBook,bookAges,freshnessBucket,
  type RecallRoute,type ObservedBook} from '../lib/research/recall-detector.ts';
import {LatestCandidates,candidateKey,priority,paperSettlement,differentQuestion,selectConfirmationBooks} from '../lib/research/hot-confirmation.ts';
import {ConfirmationFeed} from './book-confirmation-adapter.ts';
import {reconcileGroups} from './coverage.ts';

const K='https://external-api.kalshi.com/trade-api/v2',P='https://gateway.polymarket.us/v1';
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,Math.max(0,ms)));
const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
export function matchOffThread(kalshi:Market[],poly:Market[],signal:AbortSignal):Promise<ReturnType<typeof recallMatches>>{
  return new Promise((done,reject)=>{const w=new Worker(new URL('./recall-matching-thread.ts',import.meta.url),{workerData:{kalshi,poly}});
    const abort=()=>{void w.terminate();reject(Error('MATCHING_ABORTED'));};signal.addEventListener('abort',abort,{once:true});
    w.once('message',result=>{signal.removeEventListener('abort',abort);done(result);});
    w.once('error',error=>{signal.removeEventListener('abort',abort);reject(error);});
    w.once('exit',code=>{signal.removeEventListener('abort',abort);if(code)reject(Error('MATCHING_WORKER_EXIT_'+code));});
  });
}
export class PublicData {
  endpointCounts:Record<string,number>={};durations:Record<string,number[]>={};slots=new Map<string,number>();cooldowns=new Map<string,number>();counts:Record<string,number>={};failures:Record<string,number>={};
  signal:AbortSignal;record:(kind:string,body:unknown)=>void;
  constructor(signal:AbortSignal,record:(kind:string,body:unknown)=>void=()=>{}){this.signal=signal;this.record=record;}
  async get(url:string,uncached=false){
    const target=new URL(url);if(![new URL(K).hostname,new URL(P).hostname].includes(target.hostname))throw Error('NON_NATIVE_HOST');
    for(let attempt=0;attempt<recallPolicy.maxPublicHttpAttempts;attempt++){
      const u=new URL(target),slot=Math.max(Date.now(),this.slots.get(u.hostname)??0);
      this.slots.set(u.hostname,slot+recallPolicy.restSpacingMs);
      if(slot>Date.now())await sleep(slot-Date.now());this.signal.throwIfAborted();
      // Requests already waiting for a reserved slot also honor a newer 429.
      while((this.cooldowns.get(u.hostname)??0)>Date.now()){
        await sleep(Math.min(1000,this.cooldowns.get(u.hostname)!-Date.now()));this.signal.throwIfAborted();}
      if(uncached)u.searchParams.set('lights_on',randomUUID());
      const endpoint=u.hostname+(u.pathname.endsWith('/book')?':book':u.pathname==='/v1/markets'?':catalog':':metadata');
      this.endpointCounts[endpoint]=(this.endpointCounts[endpoint]??0)+1;
      const requestAt=Date.now(),mono=performance.now();this.counts[u.hostname]=(this.counts[u.hostname]??0)+1;
      try{
        const response=await fetch(u,{headers:{accept:'application/json','cache-control':'no-cache, no-store',pragma:'no-cache'},
          cache:'no-store',signal:AbortSignal.any([this.signal,AbortSignal.timeout(12_000)])});
        const raw=await response.text(),responseAt=Date.now(),cacheAge=response.headers.get('age');
        const transport={requestAt,responseAt,durationMs:performance.now()-mono,
          cacheAgeSeconds:cacheAge===null?null:Number(cacheAge),cacheStatus:response.headers.get('cf-cache-status'),bodySha256:sha(raw)};
        if(!response.ok){if(response.status===429){const seconds=Number(response.headers.get('retry-after')??0);
          this.cooldowns.set(u.hostname,Date.now()+Math.min(30_000,Math.max(2000*2**attempt,(Number.isFinite(seconds)?seconds:0)*1000)));}
          throw Error('HTTP_'+response.status);}
        (this.durations[endpoint]??=[]).push(transport.durationMs);const data=JSON.parse(raw);this.record('HTTP_PUBLIC',{url:u.toString(),transport,data});return {data,transport};
      }catch(error){const key=u.hostname+':'+(error as Error).message;this.failures[key]=(this.failures[key]??0)+1;
        this.record('HTTP_PUBLIC_FAILURE',{host:u.hostname,path:u.pathname,attempt:attempt+1,reason:(error as Error).message});
        if((error as Error).message==='HTTP_429'&&attempt+1<recallPolicy.maxPublicHttpAttempts)continue;throw error;}
    }
    throw Error('PUBLIC_HTTP_RETRY_BUDGET');
  }
  async book(m:Market):Promise<ObservedBook>{
    const {data,transport}=await this.get(m.venue==='kalshi'?`${K}/markets/${encodeURIComponent(m.id)}/orderbook?depth=100`:
      `${P}/markets/${encodeURIComponent(m.id)}/book`,true);
    if(m.venue==='poly'&&data.marketData?.marketSlug!==m.id)throw Error('BOOK_IDENTITY_MISMATCH');
    const book=normalizeBook(m.venue,data,transport.responseAt);
    return {book:{...book,venue:m.venue,marketId:m.id,receivedMono:performance.now(),sequence:null,
      connection:'LIVE',valid:true,source:'rest'},transport};
  }
}

export async function currentCatalog(api:PublicData,progress:(x:unknown)=>void=()=>{}){
  const at=Date.now(),kalshi:Market[]=[],poly:Market[]=[],errors:string[]=[],raw=new Map<string,any>();
  const counts={kalshiPages:0,polyPages:0};
  const r=await Promise.allSettled([
    (async()=>{const seriesResponse=await api.get(`${K}/series`,true),series=new Map<string,any>(seriesResponse.data.series.map((s:any)=>[s.ticker,s]));
      let cursor='';const seen=new Set<string>();
      do {const {data}=await api.get(`${K}/markets?status=open&mve_filter=exclude&limit=1000${cursor?'&cursor='+encodeURIComponent(cursor):''}`,true);
        if(!Array.isArray(data.markets))throw Error('KALSHI_CATALOG_SCHEMA');
        for(const m of data.markets)raw.set('kalshi:'+m.ticker,m);
        // Bound hashing/normalization concurrency by the native page size. A
        // serial await per market incurs a live-ingress scheduling delay for
        // every hash and can turn a catalog refresh into most of the window.
        kalshi.push(...await Promise.all(data.markets.map((m:any)=>normalizeKalshi(m,series.get(m.ticker.split('-')[0])))));
        counts.kalshiPages++;if(counts.kalshiPages%20===0)progress({phase:'CATALOG',...counts,kalshi:kalshi.length,poly:poly.length});
        cursor=String(data.cursor??'');if(cursor&&seen.has(cursor))throw Error('REPEATED_KALSHI_CURSOR');seen.add(cursor);
      }while(cursor);})(),
    (async()=>{const seen=new Set<string>();for(let offset=0;;offset+=500){
      const {data}=await api.get(`${P}/markets?active=true&closed=false&limit=500&offset=${offset}`,true);
      if(!Array.isArray(data.markets))throw Error('PM_US_CATALOG_SCHEMA');
      const ids=data.markets.map((m:any)=>m.slug),fingerprint=JSON.stringify(ids);
      if(ids.length&&seen.has(fingerprint))throw Error('REPEATED_PM_US_PAGE');seen.add(fingerprint);
      // No serial per-market settlement/event HTTP review in the discovery path.
      for(const m of data.markets)raw.set('poly:'+m.slug,m);
      poly.push(...await Promise.all(data.markets.map((m:any)=>normalizePoly(m))));
      counts.polyPages++;if(counts.polyPages%20===0)progress({phase:'CATALOG',...counts,kalshi:kalshi.length,poly:poly.length});
      if(ids.length<500)break;
    }})()
  ]);
  r.forEach((v,i)=>{if(v.status==='rejected')errors.push((i?'PM_US:':'KALSHI:')+(v.reason as Error).message);});
  const unique=(ms:Market[])=>[...new Map(ms.filter(m=>m.open).map(m=>[m.id,m])).values()];
  return {at,endedAt:Date.now(),kalshi:unique(kalshi),poly:unique(poly),raw,complete:!errors.length,errors,counts};
}

function attachTicks(routes:RecallRoute[],raw:Map<string,any>){for(const r of routes){
  const k=raw.get('kalshi:'+r.pair.a.id),p=raw.get('poly:'+r.pair.b.id);
  const kt=k?.price_ranges?.length===1?Math.round(Number(k.price_ranges[0].step)*10000):0,pt=Math.round(Number(p?.orderPriceMinTickSize)*10000);
  r.ticks={kalshi:Number.isSafeInteger(kt)&&kt>0?kt:0,poly:Number.isSafeInteger(pt)&&pt>0?pt:0};
}}

async function refreshCandidateMetadata(api:PublicData,route:RecallRoute){
  const [kr,pr,sr]=await Promise.all([api.get(`${K}/markets/${encodeURIComponent(route.pair.a.id)}`,true),
    api.get(`${P}/market/slug/${encodeURIComponent(route.pair.b.id)}`,true),api.get(`${K}/series/${encodeURIComponent(route.pair.a.series!)}`,true)]);
  const km=kr.data.market,pm=pr.data.market??pr.data,series=sr.data.series;
  if(km?.ticker!==route.pair.a.id||pm.slug!==route.pair.b.id||series?.ticker!==route.pair.a.series)throw Error('METADATA_IDENTITY_MISMATCH');
  const er=await api.get(`${K}/events/${encodeURIComponent(km.event_ticker)}`,true),event=er.data.event;
  const effective={...series,fee_type:event?.fee_type_override??series.fee_type,fee_multiplier:event?.fee_multiplier_override??series.fee_multiplier};
  const [a,b]=await Promise.all([normalizeKalshi(km,effective),normalizePoly(pm)]);
  if(km.fee_waiver_expiration_time&&Date.parse(km.fee_waiver_expiration_time)>Date.now())a.feeRate=0;
  b.open=b.open&&pm.ep3Status==='OPEN'&&pm.status==='MARKET_STATUS_OPEN';
  const warnings=[...route.warnings];
  if(a.hash!==route.pair.a.hash||b.hash!==route.pair.b.hash)warnings.push('METADATA_CHANGED_SINCE_DISCOVERY');
  const fresh={...route,pair:{...route.pair,a,b},warnings};attachTicks([fresh],new Map([['kalshi:'+a.id,km],['poly:'+b.id,pm]]));
  return {route:fresh,metadata:{at:Date.now(),kalshi:km,poly:pm,series:effective,event,
    responseHashes:[kr.transport.bodySha256,pr.transport.bodySha256,sr.transport.bodySha256,er.transport.bodySha256]}};
}

type Signal=ReturnType<typeof recallSignals>[number];
export function nextConfirmation<T extends {route:RecallRoute;signal:Signal;queuedAt:number}>(pending:T[],fair:boolean){
  return [...pending].sort((a,b)=>fair?a.queuedAt-b.queuedAt:priority({...a,key:'',firstQueuedAt:a.queuedAt},{...b,key:'',firstQueuedAt:b.queuedAt}))[0];
}
export function delayCounterfactual(route:RecallRoute,signal:Signal,entry:Record<Venue,ObservedBook>,
  future:Record<Venue,ObservedBook>|null,first:Venue,requestedDelayMs:number,actualDelayMs:number,at:number){
  const e=signal.evaluation,second:Venue=first==='kalshi'?'poly':'kalshi',side=(v:Venue)=>v==='kalshi'?e.kalshiSide:e.polySide;
  const base={simulation:'PUBLIC_L2_COUNTERFACTUAL_NOT_FILLS',first,requestedDelayMs,actualDelayMs,at,
    quantity:e.quantity,entryBooks:entry,futureBooks:future,verificationStatus:signal.verificationStatus};
  if(!signal.executable||!signal.withinCapital)return {...base,outcome:'UNOBSERVED_OR_INELIGIBLE',modeledNet:null};
  const firstTake=takeDepth(entry[first].book[side(first)],e.quantity);
  if(!firstTake)return {...base,outcome:'DISAPPEARED',modeledNet:0};
  if(!future||!currentBook(future[second],at)||!currentBook(future[first],at))return {...base,outcome:'UNOBSERVED_STALE_FUTURE',modeledNet:null};
  const m=(v:Venue)=>v==='kalshi'?route.pair.a:route.pair.b;
  const fee=normalFee(firstTake.levels,m(first).feeRate??NaN,first);
  const hedge=takeDepth(future[second].book[side(second)],e.quantity),hedgeFee=hedge?normalFee(hedge.levels,m(second).feeRate??NaN,second):null;
  if(fee===null||hedge&&hedgeFee===null)return {...base,outcome:'FEE_UNKNOWN',modeledNet:null};
  if(hedge)return {...base,outcome:'CLEAN_DEPTH_PAIR',modeledNet:e.quantity*USD_SCALE-firstTake.cost-hedge.cost-fee-hedgeFee!,
    firstTake,hedge,fees:fee+hedgeFee!};
  const bids=side(first)==='yes'?future[first].book.yesBids:future[first].book.noBids;
  const available=Math.min(e.quantity,bids.reduce((n,l)=>n+l.quantity,0));
  const unwind=available>=e.quantity?takeDepth(bids,e.quantity,true):null;
  const unwindFee=unwind?normalFee(unwind.levels,m(first).feeRate??NaN,first):null;
  return {...base,outcome:unwind?'UNWIND_DEPTH':'ORPHAN_DEPTH',firstTake,unwind,residualQuantity:unwind?0:e.quantity,
    modeledNet:unwind&&unwindFee!==null?unwind.cost-firstTake.cost-fee-unwindFee:null};
}

export async function observeRecall(directory:string,durationMs=recallPolicy.durationMs,env?:string,catalogPath?:string){
  if(!Number.isSafeInteger(durationMs)||durationMs<1000||durationMs>90*60_000)throw Error('BOUNDED_DURATION_REQUIRED');
  if(env)process.loadEnvFile(resolve(env));mkdirSync(directory,{recursive:true,mode:0o700});
  const sourceHashes=Object.fromEntries(['worker/recall-observer.ts','worker/recall-matching-thread.ts','lib/research/recall-detector.ts','lib/research/ev-arb.ts',
    'lib/arb/adapters.ts','worker/streams.ts','lib/research/hot-confirmation.ts','worker/book-confirmation-adapter.ts'].map(p=>[p,sha(readFileSync(resolve(p),'utf8'))]));
  const frozen={policy:{...recallPolicy,durationMs},sourceHashes,ordersEnabled:false,preparedAt:Date.now()};
  writeFileSync(resolve(directory,'frozen.json'),JSON.stringify(frozen,null,2)+'\n',{flag:'wx',mode:0o600});
  const control=new AbortController(),preparation=setTimeout(()=>control.abort(),20*60_000);
  let evidenceBytes=0;const counts:Record<string,number>={},reasons:Record<string,number>={};
  const count=(k:string,n=1)=>counts[k]=(counts[k]??0)+n;
  const record=(kind:string,body:unknown)=>{const row=JSON.stringify({at:Date.now(),kind,body})+'\n';
    if(evidenceBytes+Buffer.byteLength(row)>recallPolicy.maxEvidenceBytes){reasons.EVIDENCE_LIMIT=(reasons.EVIDENCE_LIMIT??0)+1;control.abort();return;}
    appendFileSync(resolve(directory,'evidence.ndjson'),row,{mode:0o600});evidenceBytes+=Buffer.byteLength(row);};
  // Catalog bodies are saved once separately, not repeated in the L2 event log.
  const api=new PublicData(control.signal,(kind,body)=>{if(kind==='HTTP_PUBLIC_FAILURE')record(kind,body);});
  let data=catalogPath?JSON.parse(readFileSync(resolve(catalogPath),'utf8')):await currentCatalog(api,x=>console.log(JSON.stringify(x)));
  if(catalogPath){if(Date.now()-data.endedAt>30*60_000||!data.complete)throw Error('BOOTSTRAP_CATALOG_EXPIRED_OR_INCOMPLETE');data.raw=new Map(data.raw);}
  if(!data.kalshi.length||!data.poly.length)throw Error('NO_NATIVE_CATALOG');
  let matched=await matchOffThread(data.kalshi,data.poly,control.signal),routes=fairRoutes(matched.routes),cycles=1;
  let start=0,mono=performance.now(),deadline=0,deadlineTimer:ReturnType<typeof setTimeout>|null=null;
  attachTicks(routes,data.raw);
  const catalogSave=()=>writeFileSync(resolve(directory,`catalog-${cycles}.json`),JSON.stringify({at:data.at,endedAt:data.endedAt,
    complete:data.complete,errors:data.errors,counts:data.counts,kalshi:data.kalshi,poly:data.poly,raw:routes.flatMap(r=>[['kalshi:'+r.pair.a.id,data.raw.get('kalshi:'+r.pair.a.id)],['poly:'+r.pair.b.id,data.raw.get('poly:'+r.pair.b.id)]])})+'\n',{mode:0o600});catalogSave();
  const allRoutes=new Map(routes.map(r=>[r.pair.id,r])),visited=new Set<string>(),twoBook=new Set<string>(),freshRoutes=new Set<string>();
  const buckets={kalshi:{receipt:{} as Record<string,number>,exchange:{} as Record<string,number>},poly:{receipt:{} as Record<string,number>,exchange:{} as Record<string,number>}};
  const observed=new Map<string,ObservedBook>(),feeds=new Map<string,ConfirmationFeed>(),marketFeeds=new Map<string,ConfirmationFeed>(),dirty=new Set<string>();
  let byMarket=new Map<string,string[]>(),restCursor=0,restActive=false,refreshing:Promise<void>|null=null;
  const jobs=new Set<Promise<void>>(),cooldown=new Map<string,number>(),candidateFingerprints=new Set<string>();
  const queue=new LatestCandidates(),pendingCandidates=queue.pending,inFlight=new Set<string>(),hot=new Map<string,number>();
  const metadata=new Map<string,Awaited<ReturnType<typeof refreshCandidateMetadata>>>(),metadataJobs=new Set<Promise<void>>();
  const latency={queue:[] as number[],work:[] as number[],signal:[] as number[],firstSignal:[] as number[]};
  let lastAudit=0,peakHot=0,peakQueue=0,lastMetadata=0;
  const classifications=new Map<string,ReturnType<typeof paperSettlement>>(),falseMatches=new Set<string>();
  const classify=(r:RecallRoute)=>{const key=r.pair.id+':'+r.pair.a.hash+':'+r.pair.b.hash;let c=classifications.get(key);if(!c){c=paperSettlement(r);classifications.set(key,c);}return c;};
  let strongestConfirmed:{route:RecallRoute;signal:Signal;entry:Record<Venue,ObservedBook>;settlement:ReturnType<typeof paperSettlement>;at:number}[]=[];
  const percentiles=(xs:number[])=>{const a=[...xs].sort((a,b)=>a-b);return {n:a.length,median:a.length?a[Math.floor((a.length-1)*.5)]:null,p95:a.length?a[Math.floor((a.length-1)*.95)]:null,max:a.length?a.at(-1):null};};
  const feedRestarts=new Map<string,number>(),feedStarted=new Map<string,number>();let lastHealthCheck=start;
  let best:{route:RecallRoute;signal:Signal}[]=[],stopped=false,lastDiscovery=0;
  let highestGross:typeof best=[],nearPositive:typeof best=[],canonicalChecks:typeof best=[];
  const retain=(list:typeof best,route:RecallRoute,signal:Signal,value:(s:Signal)=>number)=>{
    const next=list.filter(x=>x.route.pair.id!==route.pair.id);next.push({route,signal});
    return next.sort((a,b)=>value(b.signal)-value(a.signal)).slice(0,10);};
  let lastActiveFeedHealth:unknown[]=[];
  const delayOutcomes:Record<string,number>={};
  const save=()=>writeFileSync(resolve(directory,'summary.json'),JSON.stringify({ordersEnabled:false,simulation:'PUBLIC_L2_COUNTERFACTUAL_NOT_FILLS',
    phase:stopped?'STOPPED':'RUNNING',start,deadline,at:Date.now(),durationObservedMs:performance.now()-mono,catalogCycles:cycles,
    catalog:{kalshi:data.kalshi.length,poly:data.poly.length,complete:data.complete,errors:data.errors,
      startedAt:data.at,endedAt:data.endedAt,fetchAndNormalizationMs:data.endedAt-data.at},
    candidateEventMatches:matched.eventMatches,matchedRoutes:routes.length,sportsRoutes:routes.filter(r=>r.pair.a.identity?.sports).length,
    allSeenRoutes:allRoutes.size,visitedRoutes:visited.size,twoBookRoutes:twoBook.size,freshRoutes:freshRoutes.size,
    unvisitedRoutes:[...allRoutes.keys()].filter(id=>!visited.has(id)).length,matchingDiagnostics:matched.diagnostics,
    counts,reasons,buckets,delayOutcomes,requests:api.counts,requestFailures:api.failures,evidenceBytes,
    contractVerifiedOpportunities:0,confirmedPaperArbs:0,
    strongestConfirmed,falseMatchRoutes:falseMatches.size,pendingConfirmations:pendingCandidates.size,peakPendingConfirmations:peakQueue,hotRoutes:hot.size,peakHotRoutes:peakHot,
    candidatesSuperseded:queue.superseded,candidatesDisappearedBeforeDispatch:queue.disappeared,
    latencyMs:Object.fromEntries(Object.entries(latency).map(([k,v])=>[k,percentiles(v)])),
    confirmationsPerSecond:(counts.confirmationRequests??0)/Math.max(1,(Date.now()-start)/1000),
    endpointRequests:api.endpointCounts,httpLatencyMs:Object.fromEntries(Object.entries(api.durations).map(([k,v])=>[k,percentiles(v)])),
    lastActiveFeedHealth,
    feedHealth:[...feeds].map(([key,f])=>({key,ids:f.stream.options.ids.length,...f.health(),failures:f.failures,reconnects:f.stream.reconnectCount})),
    best:best.map(({route,signal})=>({event:route.pair.a.title,route,signal})),
    independentCheckRoutes:{highestGross,nearPositive,canonicalChecks},frozen},null,2)+'\n',{mode:0o600});
  const bookKey=(v:Venue,id:string)=>v+':'+id;
  const reconcile=async()=>{
    byMarket=new Map();for(const r of routes)for(const m of [r.pair.a,r.pair.b]){const key=bookKey(m.venue,m.id),ids=byMarket.get(key)??[];ids.push(r.pair.id);byMarket.set(key,ids);}
    const desired=new Map<string,{venue:Venue;ids:string[]}>();
    for(const venue of ['kalshi','poly'] as Venue[]){const ids=[...new Set(routes.map(r=>venue==='kalshi'?r.pair.a.id:r.pair.b.id))].sort();
      const previous=[...feeds.values()].filter(f=>f.stream.options.venue===venue).map(f=>f.stream.options.ids);
      for(const group of reconcileGroups(previous,ids,recallPolicy.streamGroupSize))desired.set(venue+':'+sha(JSON.stringify(group)),{venue,ids:group});}
    for(const [key,f] of feeds)if(!desired.has(key)){f.stop();feeds.delete(key);for(const id of f.stream.options.ids){observed.delete(bookKey(f.stream.options.venue,id));marketFeeds.delete(bookKey(f.stream.options.venue,id));}}
    for(const [key,g] of desired)if(!feeds.has(key)){
      try{const f=new ConfirmationFeed(g.venue,g.ids,(kind,body)=>{if(kind!=='WS_BOOK')record(kind,body);}, {onBook:r=>{const key=bookKey(g.venue,r.e.book.marketId);
        observed.set(key,{book:r.e.book});for(const id of byMarket.get(key)??[])dirty.add(id);count('streamBookEvents');}});
        feeds.set(key,f);feedStarted.set(key,Date.now());for(const id of g.ids)marketFeeds.set(bookKey(g.venue,id),f);f.start();await sleep(100);
      }catch(error){const reason='STREAM_START:'+(error as Error).message;reasons[reason]=(reasons[reason]??0)+1;}
    }
    for(const r of routes)dirty.add(r.pair.id);
  };
  const pairBooks=(r:RecallRoute):Record<Venue,ObservedBook>|null=>{
    const k=observed.get(bookKey('kalshi',r.pair.a.id)),p=observed.get(bookKey('poly',r.pair.b.id));if(!k||!p)return null;
    const current=(v:Venue,b:ObservedBook)=>{const ws=marketFeeds.get(bookKey(v,b.book.marketId))?.liveBook(b.book.marketId);
      // A newer stream snapshot always supersedes fallback state; REST never relabels stream health.
      if(ws&&ws.book.receivedAt>=b.book.receivedAt)return ws;
      return b.book.source==='rest'?b:ws??{book:{...b.book,valid:false,connection:'DISCONNECTED' as const}};};
    return {kalshi:current('kalshi',k),poly:current('poly',p)};
  };
  const metadataRefresh=(route:RecallRoute)=>{
    const cached=metadata.get(route.pair.id);if(cached&&Date.now()-cached.metadata.at<recallPolicy.metadataTtlMs)return;
    if(Date.now()-data.endedAt<recallPolicy.metadataTtlMs||metadataJobs.size||Date.now()-lastMetadata<3000)return;lastMetadata=Date.now();
    const job=refreshCandidateMetadata(api,route).then(r=>{metadata.set(route.pair.id,r);allRoutes.set(route.pair.id,r.route);dirty.add(route.pair.id);
      count('metadataRefreshes');record('METADATA_REFRESH',{pairId:route.pair.id,...r});}).catch(error=>{count('metadataRefreshFailures');record('METADATA_FAILURE',{pairId:route.pair.id,reason:(error as Error).message});});
    metadataJobs.add(job);void job.finally(()=>metadataJobs.delete(job));
  };
  async function confirm(item:ReturnType<LatestCandidates['next']>){
    if(!item)return;let {route,signal,queuedAt,firstQueuedAt}=item;const startedAt=Date.now();
    count('confirmationRequests');
    try{
      const cached=metadata.get(route.pair.id);if(cached)route=cached.route;
      let entry=pairBooks(route);const missing=selectConfirmationBooks(route,entry,Date.now());
      if(missing.length){count('restFallbackConfirmations');
        await Promise.all(missing.map(async v=>{const m=v==='kalshi'?route.pair.a:route.pair.b;
          // Kalshi correlated snapshot is preferred to REST when its sequence-valid stream is connected.
          const feed=marketFeeds.get(bookKey(v,m.id));
          if(v==='kalshi'&&feed?.health().connected){try{await feed.confirmKalshi(m.id);count('kalshiWsSnapshotFallbacks');return;}catch{count('kalshiWsSnapshotFallbackFailures');}}
          const b=await api.book(m);const old=observed.get(bookKey(v,m.id));if(!old||old.book.receivedAt<=b.book.receivedAt)observed.set(bookKey(v,m.id),b);
        }));entry=pairBooks(route);
      }
      if(!entry)throw Error('NO_PAIR_AFTER_FALLBACK');
      const at=Date.now(),q=recallSignals(route,entry,at,[signal.evaluation.quantity]).find(s=>s.evaluation.kalshiSide===signal.evaluation.kalshiSide)!;
      const wsOnly=missing.length===0&&entry.kalshi.book.source==='stream'&&entry.poly.book.source==='stream'&&q.fresh;
      if(wsOnly)count('confirmationsEntirelyValidWs');
      count(q.candidate?'confirmationEconomicSurvivors':'confirmationDisappeared');
      if(q.candidate&&q.executable)count('confirmedExecutableCandidates');
      const settlement=classify(route);count('settlement:'+settlement.classification);
      if(q.candidate&&q.executable){count('freshSurvivor:'+settlement.classification);
        strongestConfirmed=[...strongestConfirmed.filter(x=>x.route.pair.id!==route.pair.id),{route,signal:q,entry,settlement,at}]
          .sort((a,b)=>(b.signal.evaluation.estimatedNetProfit??-Infinity)-(a.signal.evaluation.estimatedNetProfit??-Infinity)).slice(0,20);}
      latency.queue.push(startedAt-queuedAt);latency.work.push(at-startedAt);latency.signal.push(at-signal.evaluation.at);latency.firstSignal.push(at-firstQueuedAt);
      record('CONFIRMATION',{route,initial:signal,queueWaitMs:startedAt-queuedAt,firstSignalToConfirmationMs:at-firstQueuedAt,
        confirmationWorkMs:at-startedAt,quoteToConfirmationMs:at-signal.evaluation.at,signal:q,entry,
        source:wsOnly?'VALID_NATIVE_WS':missing.length?'NATIVE_FALLBACK':'CURRENT_NATIVE_STATE',
        metadata:cached?.metadata??{at:data.endedAt,source:'NATIVE_CATALOG',reviewPending:true},settlement,
        status:!q.candidate?'disappeared':q.executable?'fresh-executable-paper-candidate':'economic-positive-freshness-pending'});
      // Metadata and independent audits run outside confirmation; no delayed-fill experiments occupy this lane.
      if(q.candidate&&q.executable)metadataRefresh(route);
    }catch(error){const key='CONFIRMATION:'+(error as Error).message;reasons[key]=(reasons[key]??0)+1;record('CONFIRMATION_FAILURE',{pairId:route.pair.id,reason:key});}
    finally{inFlight.delete(item.key);}
  }

  const signalStop=()=>control.abort();process.once('SIGINT',signalStop);process.once('SIGTERM',signalStop);
  const heartbeat=setInterval(()=>{if(!start)return;save();console.log(JSON.stringify({phase:'OBSERVE',elapsedSeconds:Math.round((performance.now()-mono)/1000),
    routes:routes.length,visited:visited.size,twoBook:twoBook.size,freshRoutes:freshRoutes.size,counts,requests:api.counts}));},30_000);
  try{
    console.log(JSON.stringify({phase:'DISCOVERED',kalshi:data.kalshi.length,poly:data.poly.length,routes:routes.length,diagnostics:matched.diagnostics}));
    await reconcile();
    clearTimeout(preparation);start=Date.now();mono=performance.now();deadline=start+durationMs;lastDiscovery=start;lastHealthCheck=start;
    deadlineTimer=setTimeout(()=>control.abort(),durationMs);record('OBSERVATION_STARTED',{start,deadline});
    while(!control.signal.aborted&&performance.now()-mono<durationMs){
      const routeIndex=allRoutes;
      for(const id of [...dirty]){dirty.delete(id);const r=routeIndex.get(id);if(!r)continue;visited.add(id);const books=pairBooks(r);
        if(!books){count('missingTwoBooks');continue;}twoBook.add(id);count('twoBookObservations');
        const now=Date.now();for(const v of ['kalshi','poly'] as Venue[]){const a=bookAges(books[v],now);
          for(const kind of ['receipt','exchange'] as const){const key=freshnessBucket(kind==='receipt'?a.receiptMs:a.exchangeMs);
            buckets[v][kind][key]=(buckets[v][kind][key]??0)+1;}}
        const one=recallSignals(r,books,now,[1]);
        const qs=one.some(q=>q.evaluation.grossStatus==='GROSS_ARB')?recallSignals(r,books,now):one;
        const fresh=one.some(q=>q.fresh);if(fresh){freshRoutes.add(id);count('freshTwoBookObservations');}else count('staleTwoBookObservations');
        for(const q of one){count('orientationObservations');const e=q.evaluation;
          if(e.grossStatus==='NO_EXECUTABLE_DEPTH')count('noQuantityOneDepth');
          if(e.grossStatus==='GROSS_ARB')count('grossPositive');else if(e.grossStatus==='NO_GROSS_ARB')count('grossNonpositive');
          if(q.candidate){count('normalFeePositive');if(q.fresh)count('freshNormalFeePositive');
            if(q.minimumQuantityPass)count('quantityExecutablePositive');else count(q.minimumsKnown?'belowVenueMinimum':'quantityMetadataUnknown');
            if(q.executable)count('freshExecutablePositive');if(q.withinCapital)count('smallCapitalPositive');}
          if(e.economicStatus==='REALISTIC_NET_NONPOSITIVE')count('normalFeesEraseGross');
          if(e.economicStatus==='FEE_MODEL_UNAVAILABLE')count('feeModelUnavailable');
          if(e.stress.feeBoundPass===false)count('extremeStressFailures');if(e.stress.oneTickPass===false)count('oneTickFailures');}
        const bestQ=[...qs].sort((a,b)=>(b.evaluation.estimatedNetProfit??-Infinity)-(a.evaluation.estimatedNetProfit??-Infinity))[0];
        const gross=one.filter(q=>q.evaluation.grossProfit!==null).sort((a,b)=>b.evaluation.grossProfit!-a.evaluation.grossProfit!)[0];
        const net=one.filter(q=>q.evaluation.estimatedNetProfit!==null).sort((a,b)=>b.evaluation.estimatedNetProfit!-a.evaluation.estimatedNetProfit!)[0];
        if(gross)highestGross=retain(highestGross,r,gross,s=>s.evaluation.grossProfit!);
        if(!differentQuestion(r).length&&net&&net.evaluation.estimatedNetProfit!<=0)nearPositive=retain(nearPositive,r,net,s=>s.evaluation.estimatedNetProfit!);
        if(net&&r.matchSource==='CANONICAL')canonicalChecks=retain(canonicalChecks,r,net,s=>s.evaluation.estimatedNetProfit!);
        if(bestQ.evaluation.grossProfit!==null){best=best.filter(x=>x.route.pair.id!==id);best.push({route:r,signal:bestQ});
          best.sort((a,b)=>(b.signal.evaluation.estimatedNetProfit??-Infinity)-(a.signal.evaluation.estimatedNetProfit??-Infinity));best=best.slice(0,20);}
        const q=qs.filter(x=>x.candidate&&x.withinCapital).sort((a,b)=>b.evaluation.estimatedNetProfit!-a.evaluation.estimatedNetProfit!)[0]??qs.find(x=>x.candidate);
        if(!differentQuestion(r).length&&net&&net.evaluation.estimatedNetProfit!>=-recallPolicy.hotNearNet){if(!hot.has(id))count('hotPromotions');hot.set(id,now);peakHot=Math.max(peakHot,hot.size);}
        const falseMatch=differentQuestion(r);
        if(q){const fingerprint=JSON.stringify([id,q.evaluation.orientation,q.evaluation.quantity,q.evaluation.kalshi?.levels,q.evaluation.poly?.levels]);
          if(!candidateFingerprints.has(fingerprint)){candidateFingerprints.add(fingerprint);count('distinctEconomicCandidates');record('ECONOMIC_SIGNAL',{route:r,signal:q,books,settlement:classify(r)});}
        }
        if(falseMatch.length){falseMatches.add(id);if(q)count('falseMatchPositiveReadings');queue.update(r,[],now);}
        else {const eligible=qs.filter(q=>!inFlight.has(candidateKey(r,q))&&now-(cooldown.get(candidateKey(r,q))??0)>=recallPolicy.confirmationCooldownMs);
          queue.update(r,eligible,now);}
      }
      for(const [id,at] of hot)if(Date.now()-at>recallPolicy.hotHoldMs){hot.delete(id);count('hotDemotions');}
      peakQueue=Math.max(peakQueue,pendingCandidates.size);
      let dispatched=0;
      while(pendingCandidates.size&&dispatched++<100){
        const item=queue.next()!;const current=pairBooks(item.route);
        if(!current||Date.now()-item.queuedAt>recallPolicy.maxPendingAgeMs){pendingCandidates.delete(item.key);count('candidatesExpiredBeforeDispatch');continue;}
        // Reprice both orientations and available quantities before dispatch. Replace historical economics with current state.
        const qs=recallSignals(item.route,current,Date.now());const latest=qs.filter(s=>s.evaluation.kalshiSide===item.signal.evaluation.kalshiSide&&s.candidate)
          .sort((a,b)=>Number(b.withinCapital)-Number(a.withinCapital)||(b.evaluation.estimatedNetProfit??-Infinity)-(a.evaluation.estimatedNetProfit??-Infinity))[0];
        if(!latest){pendingCandidates.delete(item.key);queue.disappeared++;continue;}item.signal=latest;
        const fallback=selectConfirmationBooks(item.route,current,Date.now()).length>0;
        if(fallback&&jobs.size>=2){
          // Slow fallback work cannot block any ready WS candidate further down the priority list.
          const ready=[...pendingCandidates.values()].filter(x=>!selectConfirmationBooks(x.route,pairBooks(x.route),Date.now()).length).sort(priority)[0];
          if(!ready)break;pendingCandidates.delete(ready.key);inFlight.add(ready.key);cooldown.set(ready.key,Date.now());count('hotConfirmationDispatches');void confirm(ready);continue;
        }
        pendingCandidates.delete(item.key);inFlight.add(item.key);cooldown.set(item.key,Date.now());count('hotConfirmationDispatches');
        const job=confirm(item);if(fallback){jobs.add(job);void job.finally(()=>jobs.delete(job));}
      }
      if(Date.now()-lastHealthCheck>=5000){lastHealthCheck=Date.now();let restarted=false;
        for(const [key,f] of feeds)if(!f.health().connected&&Date.now()-(feedStarted.get(key)??0)>10_000&&
          (feedRestarts.get(key)??0)<recallPolicy.maxStreamRestarts){
          f.stop();feeds.delete(key);for(const id of f.stream.options.ids){observed.delete(bookKey(f.stream.options.venue,id));marketFeeds.delete(bookKey(f.stream.options.venue,id));}
          feedRestarts.set(key,(feedRestarts.get(key)??0)+1);count('streamRestarts');restarted=true;
        }
        if(restarted)await reconcile();
      }
      // At most one independent audit per 30 seconds; otherwise refresh only stale/absent hot books.
      if(!restActive&&Date.now()-lastAudit>=recallPolicy.auditMs&&routes.length){lastAudit=Date.now();
        const candidates=[...hot.keys()].map(id=>allRoutes.get(id)!).filter(Boolean);
        const r=candidates[restCursor++%Math.max(1,candidates.length)]??routes[restCursor%routes.length];restActive=true;
        const job=(async()=>{try{const before=pairBooks(r),poly=await api.book(r.pair.b);count('independentRestAudits');
          const stream=marketFeeds.get(bookKey('poly',r.pair.b.id))?.liveBook(r.pair.b.id);
          const conflict=stream&&stream.book.exchangeAt===poly.book.exchangeAt&&JSON.stringify([stream.book.yesBids,stream.book.noBids,stream.book.open])!==JSON.stringify([poly.book.yesBids,poly.book.noBids,poly.book.open]);
          if(conflict){count('independentAuditVersionConflicts');marketFeeds.get(bookKey('poly',r.pair.b.id))?.cache.quarantine(r.pair.b.id,'poly');}
          record('REST_AUDIT',{pairId:r.pair.id,before,poly,stream,conflict:!!conflict});
          const old=observed.get(bookKey('poly',r.pair.b.id));if(!stream?.book.valid&&(!old||old.book.receivedAt<=poly.book.receivedAt))observed.set(bookKey('poly',r.pair.b.id),poly);
          dirty.add(r.pair.id);
        }catch(error){count('independentAuditFailures');record('AUDIT_FAILURE',{reason:(error as Error).message});}finally{restActive=false;}})();
        metadataJobs.add(job);void job.finally(()=>metadataJobs.delete(job));}
      if(Date.now()-lastDiscovery>=recallPolicy.discoveryMs&&!refreshing){lastDiscovery=Date.now();
        refreshing=(async()=>{const fresh=await currentCatalog(api,x=>record('DISCOVERY_PROGRESS',x));if(control.signal.aborted)return;
          if(!fresh.complete){count('incompleteDiscoveryRefresh');record('DISCOVERY_INCOMPLETE',{at:fresh.at,endedAt:fresh.endedAt,errors:fresh.errors,counts:fresh.counts});return;}
          const matchingAt=Date.now(),next=await matchOffThread(fresh.kalshi,fresh.poly,control.signal);
          record('DISCOVERY_REFRESH',{at:fresh.at,endedAt:fresh.endedAt,fetchAndNormalizationMs:fresh.endedAt-fresh.at,
            matchingMs:Date.now()-matchingAt,kalshi:fresh.kalshi.length,poly:fresh.poly.length,routes:next.routes.length});
          data=fresh;matched=next;routes=fairRoutes(next.routes);attachTicks(routes,data.raw);cycles++;for(const r of routes)allRoutes.set(r.pair.id,r);catalogSave();
          await reconcile();count('discoveryRefreshes');})().catch(error=>{const key='DISCOVERY_REFRESH:'+(error as Error).message;
            reasons[key]=(reasons[key]??0)+1;}).finally(()=>{refreshing=null;});}
      await sleep(recallPolicy.sampleMs);
    }
  }finally{
    control.abort();if(deadlineTimer)clearTimeout(deadlineTimer);clearTimeout(preparation);clearInterval(heartbeat);process.off('SIGINT',signalStop);process.off('SIGTERM',signalStop);
    lastActiveFeedHealth=[...feeds].map(([key,f])=>({key,ids:f.stream.options.ids.length,...f.health(),failures:f.failures,restarts:feedRestarts.get(key)??0}));
    for(const f of feeds.values())f.stop();await Promise.allSettled([...jobs,...metadataJobs,...(refreshing?[refreshing]:[])]);stopped=true;save();
  }
  return JSON.parse(readFileSync(resolve(directory,'summary.json'),'utf8'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const directory=process.argv[2],duration=Number(process.argv.find(s=>s.startsWith('--duration-seconds='))?.split('=')[1]??1200)*1000;
  const env=process.argv.find(s=>s.startsWith('--env='))?.slice(6);if(!directory)throw Error('Usage: npm run research:recall -- NEW_DIRECTORY [--duration-seconds=1200] [--env=READ_STREAM_ENV]');
  const result=await observeRecall(resolve(directory),duration,env,process.argv.find(s=>s.startsWith('--catalog='))?.slice(10));console.log(JSON.stringify({phase:'STOPPED',counts:result.counts,reasons:result.reasons}));
}
