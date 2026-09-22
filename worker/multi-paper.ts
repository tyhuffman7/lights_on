import {appendFileSync,existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import type {Pair,Venue} from '../lib/arb/types.ts';
import {normalizeKalshi,normalizePoly} from '../lib/arb/adapters.ts';
import {MultiPaper,multiPolicy as policy,reviewedRows,bookFingerprint,marginScenarios} from '../lib/arb/multi-paper.ts';
import type {ReviewRow} from '../lib/arb/multi-paper.ts';
import {contractDifferences,assumedStatus,modelLeg,accountLeg,recoveryPlan,recover} from '../lib/arb/ksu-paper.ts';
import type {Constraints} from '../lib/arb/ksu-paper.ts';
import {quoteCandidate,validity} from '../lib/screen/confirmation.ts';
import {assessSnapshot} from '../lib/screen/book-confirmation.ts';
import type {SnapshotReceipt} from '../lib/screen/book-confirmation.ts';
import {MarketStatusTracker,lifecycleSubscription} from '../lib/screen/market-status.ts';
import {ConfirmationFeed,confirmPolyBook,publicConfirmationGet} from './book-confirmation-adapter.ts';
import type {RecordEvidence} from './book-confirmation-adapter.ts';
import {sourceManifest} from './screen-manifest.ts';
import {orderDocuments} from './ksu-paper.ts';

const sha=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
const save=(dir:string,name:string,x:unknown)=>{writeFileSync(resolve(dir,name+'.tmp'),JSON.stringify(x,null,2)+'\n');renameSync(resolve(dir,name+'.tmp'),resolve(dir,name));};
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,Math.max(0,ms)));
const K='https://external-api.kalshi.com/trade-api/v2',P='https://gateway.polymarket.us/v1';
const read=(root:string,file:string)=>JSON.parse(readFileSync(resolve(root,file),'utf8'));
export function manifest(root:string){const m=sourceManifest(root);for(const file of ['scripts/multi-paper-launch.mjs','docs/research/contract-shortlist/review.json','docs/research/contract-shortlist/REVIEW.md','docs/research/contract-shortlist/retained-markets.json','docs/research/contract-shortlist/sources.json'])m[file]=sha(readFileSync(resolve(root,file)));return m;}
let nextHttp=0;
async function get(url:string,record:RecordEvidence){await sleep(nextHttp-performance.now());nextHttp=performance.now()+250;const r=await publicConfirmationGet(url,record);if(r.evidence.status!==200)throw Error('METADATA_HTTP_'+r.evidence.status);return r;}
export function reconnectPortfolios(portfolios:MultiPaper[],now:number,deadline:number,count:number){
  if(!Number.isSafeInteger(count)||count<1||portfolios.some(p=>p.halt||p.busy||p.reconnects+count>policy.maxReconnects)||now>=deadline)return false;
  for(const p of portfolios)p.reconnects+=count;return true;
}
export function entryConstraints(m:any,pm:any,a:Pair['a'],b:Pair['b']){
  const ranges=m.price_ranges,pt=pm.orderPriceMinTickSize*10000,entryReasons:string[]=[];
  const linear=m.price_level_structure==='linear_cent'&&ranges?.length===1&&ranges[0].start==='0.0000'&&ranges[0].end==='1.0000'&&ranges[0].step==='0.0100';
  const polyGrid=Number.isSafeInteger(pt)&&pt>0&&10000%pt===0;
  if(!linear||!polyGrid)entryReasons.push('UNSUPPORTED_ENTRY_PRICE_GRID');
  if(a.exchangeIndex!==0||a.feeRate!==700||b.feeRate!==695||![a.minQty,b.minQty].every(q=>Number.isFinite(q)&&q>0&&q<=10))entryReasons.push('UNSUPPORTED_ENTRY_FEE_OR_QUANTITY_MODEL');
  // A zero tick explicitly marks unsupported entry. Observation still retains its actual streamed depth.
  const constraints:Constraints={kalshi:{tick:linear?100:0,minimum:a.minQty},poly:{tick:polyGrid?pt:0,minimum:b.minQty}};
  return {constraints,entryReasons};
}
export async function refreshRow(row:ReviewRow,old:Pair,record:RecordEvidence,tracker?:MarketStatusTracker,getPublic=get){
  tracker?.beginBaseline(row.kalshiId);
  const k=await getPublic(`${K}/markets/${row.kalshiId}`,record),m=k.data.market;
  tracker?.applyBaseline(row.kalshiId,m,k.evidence);
  if(m?.ticker!==row.kalshiId||m.event_ticker?.split('-')[0]!==old.a.series)throw Error('EXACT_MARKET_IDENTITY_CHANGED');
  const s=await getPublic(`${K}/series/${old.a.series}`,record),e=await getPublic(`${K}/events/${m.event_ticker}`,record),p=await getPublic(`${P}/market/slug/${row.polyId}`,record),x=await getPublic(`${K}/exchange/status`,record);
  const pm=p.data.market??p.data,event=e.data.event;
  if(pm.slug!==row.polyId||s.data.series?.ticker!==old.a.series||event?.event_ticker!==m.event_ticker)throw Error('EXACT_METADATA_IDENTITY_CHANGED');
  const a=await normalizeKalshi(m,s.data.series),b=await normalizePoly(pm);
  const pair:Pair={id:row.pairId,a,b,inverted:false,reviewed:false,notes:'CONDITIONAL paper only when deeply reviewed; observation otherwise'};
  const differences=contractDifferences(old,pair);if(differences.length)throw Error('MATERIAL_TERMS_CHANGED:'+differences.join(';'));
  if(!a.open||!b.open||pm.ep3Status!=='OPEN'||pm.status!=='MARKET_STATUS_OPEN'||Date.parse(m.close_time)<=Date.now()||x.data.trading_active!==true||x.data.exchange_active!==true)throw Error('KNOWN_CLOSURE_OR_NOT_REPORTED_ACTIVE');
  if(event.fee_type_override!=null||event.fee_multiplier_override!=null||m.fee_waiver_expiration_time)throw Error('FEE_OVERRIDE_REQUIRES_REVIEW');
  const {constraints,entryReasons}=entryConstraints(m,pm,a,b);
  return {row,pair,constraints,entryReasons,at:Date.now(),http:[k,s,e,p,x].map(v=>v.evidence),administrativeTimes:{kalshiClose:m.close_time,kalshiExpected:m.expected_expiration_time,kalshiLatest:m.latest_expiration_time,polyEnd:pm.endDate},reportedStatus:{kalshi:m.status,poly:pm.status},classification:row.settlementClassification};
}
type Metadata=Awaited<ReturnType<typeof refreshRow>>;
export async function prepare(dir:string,root:string,initialJournal?:string){
  mkdirSync(dir,{recursive:true});if(existsSync(resolve(dir,'preparation.json')))throw Error('Single-use preparation');
  const initialState=initialJournal?JSON.parse(readFileSync(initialJournal,'utf8')):null;
  const comparison=initialJournal?{scenarios:marginScenarios,initialState,sourceJournalSha256:sha(readFileSync(initialJournal)),sourceJournal:resolve(initialJournal)}:null;
  if(comparison)for(const scenario of marginScenarios)new MultiPaper(read(root,'docs/research/contract-shortlist/review.json'),scenario,initialState);
  save(dir,'preparation.json',{at:Date.now(),policy,comparison});
  const record:RecordEvidence=(kind,body)=>appendFileSync(resolve(dir,'preparation.ndjson'),JSON.stringify({kind,body})+'\n');
  const review=read(root,'docs/research/contract-shortlist/review.json'),rows=reviewedRows(review).retained,old=read(root,'docs/research/contract-shortlist/retained-markets.json');
  const documents=[];
  for(const doc of [...read(root,'docs/research/contract-shortlist/sources.json').documents.filter((x:any)=>x.file.endsWith('.pdf')),...orderDocuments]){
    const r=await fetch(doc.url,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('PRIMARY_DOCUMENT_HTTP_'+r.status);
    const bytes=Buffer.from(await r.arrayBuffer()),hash=sha(bytes);
    if(doc.sha256&&hash!==doc.sha256)throw Error('MATERIAL_DOCUMENT_CHANGED '+doc.url);
    if(doc.required&&!bytes.toString().includes(doc.required))throw Error('SUPPORTED_FOK_SEMANTICS_CHANGED');
    documents.push({url:doc.url,sha256:hash,retrievedAt:Date.now()});
  }
  const metadata:Metadata[]=[],blocked:{pairId:string;reason:string}[]=[];
  for(const row of rows){
    const pair:Pair={id:row.pairId,a:old.kalshi.find((m:any)=>m.id===row.kalshiId),b:old.poly.find((m:any)=>m.id===row.polyId),inverted:false,reviewed:false};
    try{metadata.push(await refreshRow(row,pair,record));}catch(e){blocked.push({pairId:row.pairId,reason:(e as Error).message});}
    console.log(JSON.stringify({phase:'MULTI_PREPARING',refreshed:metadata.length,blocked:blocked.length,ordersEnabled:false}));
  }
  save(dir,'frozen.json',{at:Date.now(),policy,comparison,manifest:manifest(root),metadata,blocked,documents,review,settlementRiskSource:'docs/research/contract-shortlist/REVIEW.md sections Q/R/T; no equivalence or cash-release guarantee'});
}

export async function observe(dir:string,root:string){
  const frozen=read(dir,'frozen.json');
  if(existsSync(resolve(dir,'started.json')))throw Error('One supervised session only; no restart');
  if(JSON.stringify(frozen.policy)!==JSON.stringify(policy)||JSON.stringify(frozen.manifest)!==JSON.stringify(manifest(root))||Date.now()-frozen.at>600000)throw Error('Freeze changed or expired');
  const startedAt=Date.now(),startMono=performance.now(),deadline=startMono+policy.durationMs;
  writeFileSync(resolve(dir,'started.json'),JSON.stringify({startedAt,deadlineAt:startedAt+policy.durationMs,freezeSha256:sha(readFileSync(resolve(dir,'frozen.json'))),runtime:process.version}),{flag:'wx'});
  if(frozen.comparison&&(JSON.stringify(frozen.comparison.scenarios)!==JSON.stringify(marginScenarios)||sha(readFileSync(frozen.comparison.sourceJournal))!==frozen.comparison.sourceJournalSha256))throw Error('COMPARISON_SEED_CHANGED');
  const runs=(frozen.comparison?marginScenarios:[undefined]).map(scenario=>({portfolio:new MultiPaper(frozen.review,scenario,frozen.comparison?.initialState),qualifying:new Set<string>(),automatic:new Set<string>(),observations:new Map<string,any>(),rejections:{} as Record<string,number>,confirmations:[] as any[]}));
  const sharedStop=()=>runs.length===1?runs[0].portfolio.stopReason():runs.find(r=>r.portfolio.halt||r.portfolio.realizedLoss()>=policy.maxRealizedLoss)?.portfolio.stopReason()??(runs.every(r=>r.portfolio.stopReason())?'ALL_SCENARIOS_AT_LIMIT':null);
  const reconnect=(count:number)=>!sharedStop()&&reconnectPortfolios(runs.map(r=>r.portfolio),performance.now(),deadline,count);
  const metadata=frozen.metadata as Metadata[],blocked=new Map<string,string>(frozen.blocked.map((x:any)=>[x.pairId,x.reason]));
  const arrivals:any[]=[],feedEvents:any[]=[],policyDifferences:any[]=[];let sharedConfirmations=0;
  const dirty=new Set<string>(),fingerprints=new Map<string,string>(),histories=new Map<string,SnapshotReceipt[]>();
  let tracker:MarketStatusTracker,feeds:Record<Venue,ConfirmationFeed>={} as Record<Venue,ConfirmationFeed>,stopped=false,reason='ORIGINAL_DEADLINE',bytes=0,ready=false;
  let wake:()=>void=()=>{},nextRequest=0;
  const notify=()=>wake();
  const stop=()=>{stopped=true;reason='EXTERNAL_OR_SUPERVISOR_STOP';notify();};process.once('SIGINT',stop);process.once('SIGTERM',stop);

  const record:RecordEvidence=(kind,body)=>{const line=JSON.stringify({at:Date.now(),kind,body})+'\n';bytes+=Buffer.byteLength(line);if(bytes>policy.maxEvidenceBytes){stopped=true;reason='EVIDENCE_LIMIT';notify();return;}appendFileSync(resolve(dir,'evidence.ndjson'),line);};
  const current=(v:Venue,id:string,mono=Infinity)=>histories.get(v+':'+id)?.filter(r=>r.e.processedMono<=mono&&r.e.book.receivedMono<=mono).at(-1);
  const healthy=()=>ready&&Object.values(feeds).every(f=>{const h=f.health();return h.connected&&h.clockOkay&&h.backlog===0;});
  const status=(m:Metadata)=>tracker.view(m.row.kalshiId,Date.now(),feeds.kalshi.health().connected);
  const runSummary=(r:typeof runs[number])=>({scenario:r.portfolio.scenario,observations:[...r.observations.values()],rejectionCounts:r.rejections,qualifyingCandidates:[...r.qualifying],automaticCandidates:[...r.automatic],confirmationRequests:r.portfolio.confirmations,confirmations:r.confirmations,accounting:r.portfolio.summary(),modeled:r.portfolio.entries.slice(r.portfolio.inheritedEntries).map(({row,session:s})=>({pairId:row.pairId,plans:s.plan,legs:s.results,recovery:s.recovery}))});
  const persist=()=>{
    const journals=runs.map(r=>({scenario:r.portfolio.scenario,portfolio:r.portfolio.summary(),entries:r.portfolio.entries}));
    save(dir,'journal.json',frozen.comparison?{alternativeScenariosNeverAdditive:true,scenarios:journals}:journals[0]);
    save(dir,'summary.json',{scope:frozen.comparison?'ENTRY_MARGIN_COMPARISON_PAPER':policy.mode,phase:stopped?'STOPPED':ready?'RUNNING':'REBUILDING_BOOKS',startedAt,endedAt:stopped?Date.now():null,deadlineAt:startedAt+policy.durationMs,reason,policy,ordersEnabled:false,liveAdmitted:false,retainedComparisons:34,refreshedComparisons:metadata.length,blocked:[...blocked].map(([pairId,reason])=>({pairId,reason})),...(frozen.comparison?{alternativeScenariosNeverAdditive:true,sourceJournalSha256:frozen.comparison.sourceJournalSha256,scenarios:runs.map(runSummary),policyDifferences}:runSummary(runs[0])),sharedConfirmationRequests:sharedConfirmations,arrivals,feedEvents,rawEvidenceBytes:bytes,settlement:'CONDITIONAL; no settlement modeled or guaranteed cash-release date; unrealized surplus is not profit',synthetic:false});
  };
  const heartbeat=setInterval(()=>{persist();console.log(JSON.stringify({mode:'live-data',scope:policy.mode,phase:ready?'RUNNING':'REBUILDING_BOOKS',elapsedMs:performance.now()-startMono,scenarios:runs.map(r=>({label:r.portfolio.scenario.label,newAttempts:r.portfolio.newAttempts(),confirmations:r.confirmations.length,observed:r.observations.size})),ordersEnabled:false}));},10000);
  const wait=async(ms:number)=>{await new Promise<void>(r=>{const done=()=>{clearTimeout(timer);wake=()=>{};r();},timer=setTimeout(done,Math.max(0,ms));wake=done;});};
  const mark=(r:SnapshotReceipt)=>{
    const b=r.e.book,key=b.venue+':'+b.marketId,h=histories.get(key)??[];h.push(structuredClone(r));if(h.length>256)h.shift();histories.set(key,h);
    for(const m of metadata)if(m.row.kalshiId===b.marketId||m.row.polyId===b.marketId){dirty.add(m.row.pairId);if(!b.open)blocked.set(m.row.pairId,'KNOWN_BOOK_CLOSURE');}
    notify();
  };
  const connect=async(affected:Venue[]=['kalshi','poly'])=>{
    ready=false;for(const key of histories.keys())if(affected.some(v=>key.startsWith(v+':')))histories.delete(key);fingerprints.clear();dirty.clear();
    const ks=[...new Set(metadata.map(m=>m.row.kalshiId))],ps=[...new Set(metadata.map(m=>m.row.polyId))];if(affected.includes('kalshi'))tracker=new MarketStatusTracker(ks);
    feeds??={} as Record<Venue,ConfirmationFeed>;
    if(affected.includes('kalshi'))feeds.kalshi=new ConfirmationFeed('kalshi',ks,record,{extraSubscriptions:[lifecycleSubscription],onBook:mark,onMessage:(message,at,mono)=>{
      tracker.receive(message,at,mono);
      for(const m of metadata){const s=tracker.states.get(m.row.kalshiId);if(s?.knownNegative||s?.issues.size){blocked.set(m.row.pairId,'LIFECYCLE_CONTRADICTORY_OR_CHANGED');dirty.add(m.row.pairId);}}
      notify();
    },onInvalid:r=>{tracker.invalidate(r);notify();}});
    if(affected.includes('poly'))feeds.poly=new ConfirmationFeed('poly',ps,record,{onBook:mark,onInvalid:notify});
    for(const v of affected)feeds[v].start();await Promise.all(affected.map(v=>feeds[v].ready(10000)));
    const ack=performance.now();while(tracker.sid===null&&performance.now()-ack<5000&&!stopped)await sleep(20);
    if(tracker.sid===null)throw Error('LIFECYCLE_ACK_MISSING');
    for(const m of (affected.includes('kalshi')?metadata:[])){if(stopped||performance.now()>=deadline)return;tracker.beginBaseline(m.row.kalshiId);try{const r=await get(`${K}/markets/${m.row.kalshiId}`,record);tracker.applyBaseline(m.row.kalshiId,r.data.market,r.evidence);
      if(tracker.view(m.row.kalshiId,Date.now(),true).knownBlocked)blocked.set(m.row.pairId,'KNOWN_NONTRADING_STATE');
    }catch{tracker.baselineFailed(m.row.kalshiId);}}
    ready=true;for(const m of metadata)dirty.add(m.row.pairId);notify();
  };
  const request=async(m:Metadata)=>{
    const requestAt=Math.max(nextRequest,performance.now());nextRequest=requestAt+policy.requestSpacingMs;await sleep(requestAt-performance.now());if(stopped||performance.now()>=deadline)throw Error('REQUEST_DEADLINE');
    if(!healthy())throw Error('ENTRY_FEEDS_UNHEALTHY');
    const all=await Promise.allSettled([feeds.kalshi.confirmKalshi(m.row.kalshiId),confirmPolyBook(m.row.polyId,()=>feeds.poly.latest.get(m.row.polyId),()=>feeds.poly.health(),record)]);
    if(all.some(r=>r.status==='rejected'))throw Error('REQUESTED_BOOK_FAILED:'+all.filter(r=>r.status==='rejected').map(r=>String((r as PromiseRejectedResult).reason?.message)).join(','));
    return {kalshi:(all[0] as PromiseFulfilledResult<Awaited<ReturnType<ConfirmationFeed['confirmKalshi']>>>).value,poly:(all[1] as PromiseFulfilledResult<Awaited<ReturnType<typeof confirmPolyBook>>>).value};
  };
  type Proofs=Awaited<ReturnType<typeof request>>;
  const arrival=(m:Metadata,v:Venue,proofs:Proofs,due:number,scenario:string)=>{
    const wall=startedAt+due-startMono,proof=proofs[v],latest=current(v,v==='kalshi'?m.row.kalshiId:m.row.polyId,due);
    const assessed=assessSnapshot(proof.request,proof.response,latest,feeds[v].health(),wall,due),reasons=[...assessed.reasons];
    if(!latest||proof.response.e.processedMono>due)reasons.push('NO_BOOK_AVAILABLE_AT_MODELED_ARRIVAL');
    if(performance.now()-due>250)reasons.push('ARRIVAL_PROCESSING_LATE');
    if(Math.abs((Date.now()-startedAt)-(performance.now()-startMono))>1000)reasons.push('CLOCK_FAULT');
    if(stopped||due>=deadline)reasons.push('CENSORED_OR_DEADLINE');
    if(blocked.has(m.row.pairId))reasons.push(blocked.get(m.row.pairId)!);
    if(v==='kalshi')reasons.push(...assumedStatus(status(m)).reasons);
    const e=assessed.selected.e,b=e.book,result={scenario,pairId:m.row.pairId,venue:v,modeledArrivalMono:due,processedMono:performance.now(),bookReceiptAt:b.receivedAt,bookReceiptMono:b.receivedMono,bookProcessedMono:e.processedMono,exchangeAt:b.exchangeAt,sequence:b.sequence,transactTime:assessed.selected.transactTime??null,requestRoundTripMs:proof.response.e.book.receivedMono-proof.request.mono,reasons};
    arrivals.push(result);record('ARRIVAL_EVIDENCE',{...result,book:b});return {book:b,reasons,wall};
  };
  try{
    if(metadata.length===0){reason='NO_VALID_RETAINED_COMPARISONS';return;}
    while(!stopped&&performance.now()<deadline){
      try{await connect();break;}catch(e){feedEvents.push({at:Date.now(),reason:(e as Error).message});for(const f of Object.values(feeds!))f.stop();if(!reconnect(2))throw e;await sleep(1000);}
    }
    while(!stopped&&performance.now()<deadline){
      if(sharedStop()){reason=sharedStop()!;break;}
      if(!healthy()){
        if(!Object.values(feeds!).every(f=>f.health().clockOkay))throw Error('CLOCK_FAULT');
        const affected=(['kalshi','poly'] as const).filter(v=>!feeds[v].health().connected);
        if(!affected.length&&ready){await wait(250);continue;}
        ready=false;const failures=affected.flatMap(v=>feeds[v].failures);feedEvents.push({at:Date.now(),venues:affected,failures,action:'PAUSE_AND_REBUILD'});for(const v of affected)feeds[v].stop();
        if(failures.some(r=>!['DISCONNECTED','HEARTBEAT_TIMEOUT'].includes(r)))throw Error('NONTRANSPORT_FEED_FAULT');
        if(!reconnect(affected.length)){reason='RECONNECTION_LIMIT_OR_DEADLINE';break;}
        try{await connect(affected);}catch(e){feedEvents.push({at:Date.now(),reason:(e as Error).message});}continue;
      }
      if(!dirty.size){await wait(Math.min(1000,deadline-performance.now()));continue;}
      await wait(policy.coalesceMs);
      const ids=[...dirty];dirty.clear();
      for(const id of ids){
        if(stopped||performance.now()>=deadline||sharedStop()||!healthy())break;
        const m=metadata.find(m=>m.row.pairId===id)!,a=current('kalshi',m.row.kalshiId),b=current('poly',m.row.polyId),fingerprint=bookFingerprint(a?.e.book,b?.e.book);
        if(fingerprints.get(id)===fingerprint)continue;fingerprints.set(id,fingerprint);
        const dataReasons=[...m.entryReasons,...validity(a?.e,feeds!.kalshi.health(),Date.now(),performance.now()).reasons,...validity(b?.e,feeds!.poly.health(),Date.now(),performance.now()).reasons,...(blocked.has(id)?[blocked.get(id)!]:[])];
        // Both policies select from the same received books, before either counterfactual submits.
        const selections=runs.map(r=>({run:r,comparison:r.portfolio.select(m.row,m.pair,a?.e.book,b?.e.book,status(m),m.constraints,Date.now())}));
        if(frozen.comparison&&!dataReasons.length&&selections[1].comparison.selected&&!selections[0].comparison.selected&&selections[0].comparison.reasons.length===1&&selections[0].comparison.reasons[0]==='NONPOSITIVE_AFTER_RISK'&&!policyDifferences.some(d=>d.pairId===id))policyDifferences.push({pairId:id,at:Date.now(),baselineReasons:selections[0].comparison.reasons,challengerQuantity:selections[1].comparison.selected.quantity,challengerQuote:selections[1].comparison.selected,kind:'DISTINCT_SHARED_FEED_SELECTION_DIFFERENCE_NOT_A_FILL'});
        let sharedProof:Promise<{fresh:Metadata;proofs:Proofs}>|undefined;
        const obtainProof=()=>sharedProof??=(async()=>{
          sharedConfirmations++;
          let fresh:Metadata;try{fresh=await refreshRow(m.row,m.pair,record,tracker);}catch(e){blocked.set(id,(e as Error).message);throw e;}
          if(JSON.stringify(fresh.constraints)!==JSON.stringify(m.constraints)||JSON.stringify(fresh.administrativeTimes)!==JSON.stringify(m.administrativeTimes)){blocked.set(id,'MATERIAL_CONSTRAINTS_OR_TIMES_CHANGED');throw Error('MATERIAL_CONSTRAINTS_OR_TIMES_CHANGED');}
          return {fresh,proofs:await request(m)};
        })();
        await Promise.all(selections.map(async({run,comparison})=>{
        const {portfolio,qualifying,automatic,observations,rejections,confirmations}=run,scenario=portfolio.scenario.label;
        const count=(reasons:string[])=>{for(const r of new Set(reasons))rejections[r]=(rejections[r]??0)+1;};
        const obs={pairId:id,at:Date.now(),sides:m.row.sides,authorized:portfolio.authorized(m.row),classification:m.row.settlementClassification,quote:comparison.best,quantityComparison:comparison.compared,reasons:[...new Set([...dataReasons,...comparison.reasons])],changes:(observations.get(id)?.changes??0)+1};observations.set(id,obs);count(obs.reasons);
        if(!dataReasons.length&&comparison.selected)qualifying.add(id);
        if(sharedConfirmations>=policy.maxConfirmations&&!sharedProof){count(['CONFIRMATION_REQUEST_CAP']);return;}
        if(dataReasons.length||!comparison.selected)return;
        let proofs:Proofs;
        const original=comparison.selected;
        try{
          const result=await portfolio.execute(m.row,m.pair,original,async()=>{
            portfolio.confirmations++;
            const shared=await obtainProof(),fresh=shared.fresh;proofs=shared.proofs;
            const at=Date.now(),mono=performance.now(),ka=assessSnapshot(proofs.kalshi.request,proofs.kalshi.response,current('kalshi',m.row.kalshiId),feeds!.kalshi.health(),at,mono),pa=assessSnapshot(proofs.poly.request,proofs.poly.response,current('poly',m.row.polyId),feeds!.poly.health(),at,mono);
            const q=quoteCandidate(m.pair,ka.selected.e.book,pa.selected.e.book,m.row.sides.kalshi,at,original.quantity),reasons=[...fresh.entryReasons,...ka.reasons,...pa.reasons];
            if(Math.abs(proofs.kalshi.response.e.book.receivedMono-proofs.poly.response.e.book.receivedMono)>2000)reasons.push('CROSS_VENUE_DELAY');
            confirmations.push({pairId:id,at,original,quote:q,bookConfirmed:ka.accepted&&pa.accepted,reasons,statusAssumption:assumedStatus(status(m))});
            return {quote:q,status:status(m),constraints:fresh.constraints,reasons};
          },async s=>{
            persist();record('FROZEN_SUBMISSION',{scenario,pairId:id,plans:s.plan});
            await Promise.all((['kalshi','poly'] as const).map(async v=>{const plan=s.plan![v];await sleep(plan.arrivalMono-performance.now());const ev=arrival(m,v,proofs,plan.arrivalMono,scenario),result=modelLeg(plan,v==='kalshi'?m.pair.a:m.pair.b,ev.book,ev.reasons,v==='kalshi'&&status(m).knownBlocked,ev.wall,plan.arrivalMono);accountLeg(s,m.pair,v,result);record('MODELED_LEG',{scenario,pairId:id,venue:v,result});persist();}));
            if(recoveryPlan(s,performance.now())&&!stopped&&performance.now()+2500<deadline){
              await sleep(policy.recoveryDelayMs);
              try{const rpProofs=await request(m),rp=recoveryPlan(s,performance.now());if(rp&&rp.arrivalMono<deadline){record('FROZEN_RECOVERY',{scenario,pairId:id,plan:rp});await sleep(rp.arrivalMono-performance.now());const ev=arrival(m,rp.venue,rpProofs,rp.arrivalMono,scenario);recover(s,rp,rp.venue==='kalshi'?m.pair.a:m.pair.b,ev.book,ev.reasons,ev.wall,rp.arrivalMono);}}
              catch(e){s.recovery={outcome:'INCONCLUSIVE',reasons:[(e as Error).message]};}
            }
          },Date.now,()=>performance.now(),()=>!stopped&&healthy()&&!blocked.has(id)&&performance.now()+policy.transportMs<deadline);
          if(result.attempted)automatic.add(id);confirmations.push({pairId:id,at:Date.now(),phase:'FINAL_ADMISSION',...result});count(result.reasons);record('AUTOMATIC_ENTRY_DECISION',{scenario,pairId:id,result});persist();
        }catch(e){const error=(e as Error).message;count([error]);confirmations.push({pairId:id,at:Date.now(),error});record('CONFIRMATION_OR_EXECUTION_ERROR',{scenario,pairId:id,error});}
        }));
      }
    }
    reason=sharedStop()??reason;
  }catch(e){reason=(e as Error).message;record('STOP_REASON',{reason});}
  finally{
    stopped=true;ready=false;clearInterval(heartbeat);persist();for(const f of Object.values(feeds!??{}))f.stop();process.off('SIGINT',stop);process.off('SIGTERM',stop);
    console.log(JSON.stringify({mode:'live-data',message:'MULTI_PAPER_STOPPED',reason,scenarios:runs.map(r=>r.portfolio.summary()),ordersEnabled:false}));
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [mode,output,env,initialJournal]=process.argv.slice(2);if(!output||!['prepare','prepare-comparison','observe'].includes(mode))throw Error('Usage: multi-paper.ts prepare|observe DIRECTORY [ENV_FILE]');if(env)process.loadEnvFile(env);if(mode==='prepare-comparison'&&!initialJournal)throw Error('Initial reconciled journal required');if(mode!=='observe')await prepare(resolve(output),process.cwd(),initialJournal);else await observe(resolve(output),process.cwd());}
