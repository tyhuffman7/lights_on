import {appendFileSync,existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import type {Pair,Venue} from '../lib/arb/types.ts';
import {bookFingerprint} from '../lib/arb/multi-paper.ts';
import {assumedStatus,modelLeg,accountLeg,recoveryPlan,recover} from '../lib/arb/ksu-paper.ts';
import type {Session,Candidate} from '../lib/arb/ksu-paper.ts';
import {quoteCandidate,validity} from '../lib/screen/confirmation.ts';
import {assessLaneEvidence,executionLanePolicy,feedDiagnostic,stopClassification,VenueRebuildBudget} from '../lib/arb/production-operations.ts';
import type {FeedLane,FeedTarget} from '../lib/arb/production-operations.ts';
import type {SnapshotReceipt} from '../lib/screen/book-confirmation.ts';
import {MarketStatusTracker,lifecycleSubscription} from '../lib/screen/market-status.ts';
import {ConfirmationFeed,confirmPolyBook,publicConfirmationGet} from './book-confirmation-adapter.ts';
import type {RecordEvidence} from './book-confirmation-adapter.ts';

import {prepare as prepareLegacy,refreshRow,manifest as baseManifest} from './multi-paper.ts';
import {StrategyPaper,ShadowCollector,sessionPolicy as policy,challengerSeed,economics,horizon,rankOpportunities,executionClass,arrivalMovement,shadowSignature} from '../lib/arb/production-paper.ts';
const sha=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
const save=(dir:string,name:string,x:unknown)=>{writeFileSync(resolve(dir,name+'.tmp'),JSON.stringify(x,null,2)+'\n');renameSync(resolve(dir,name+'.tmp'),resolve(dir,name));};
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,Math.max(0,ms)));
const K='https://external-api.kalshi.com/trade-api/v2';
const read=(root:string,file:string)=>JSON.parse(readFileSync(resolve(root,file),'utf8'));
export function manifest(root:string){return {...baseManifest(root),'scripts/production-paper-launch.mjs':sha(readFileSync(resolve(root,'scripts/production-paper-launch.mjs')))};}
let nextHttp=0;
async function get(url:string,record:RecordEvidence){await sleep(nextHttp-performance.now());nextHttp=performance.now()+250;const r=await publicConfirmationGet(url,record);if(r.evidence.status!==200)throw Error('METADATA_HTTP_'+r.evidence.status);return r;}
type Metadata=Awaited<ReturnType<typeof refreshRow>>;
export async function prepare(dir:string,root:string,sourceJournal:string){
  const source=readFileSync(sourceJournal),initialState=challengerSeed(JSON.parse(source.toString()));
  new StrategyPaper(read(root,'docs/research/contract-shortlist/review.json'),initialState);
  await prepareLegacy(dir,root);
  const frozen=read(dir,'frozen.json');
  save(dir,'frozen.json',{...frozen,at:Date.now(),policy,executionLanePolicy,comparison:undefined,continuation:{initialState,sourceJournal:resolve(sourceJournal),sourceJournalSha256:sha(source)},manifest:manifest(root)});
  save(dir,'preparation.json',{at:Date.now(),policy,sourceJournalSha256:sha(source),mode:'SINGLE_STRATEGY_PLUS_ISOLATED_SHADOW'});
}
export async function observe(dir:string,root:string){
  const frozen=read(dir,'frozen.json');
  if(existsSync(resolve(dir,'started.json')))throw Error('One supervised session only; no restart');
  if(JSON.stringify(frozen.executionLanePolicy)!==JSON.stringify(executionLanePolicy)||JSON.stringify(frozen.policy)!==JSON.stringify(policy)||JSON.stringify(frozen.manifest)!==JSON.stringify(manifest(root))||Date.now()-frozen.at>600000)throw Error('Freeze changed or expired');
  if(!frozen.continuation||sha(readFileSync(frozen.continuation.sourceJournal))!==frozen.continuation.sourceJournalSha256)throw Error('CHALLENGER_SEED_CHANGED');
  const startedAt=Date.now(),startMono=performance.now(),deadline=startMono+policy.durationMs;
  writeFileSync(resolve(dir,'started.json'),JSON.stringify({startedAt,deadlineAt:startedAt+policy.durationMs,freezeSha256:sha(readFileSync(resolve(dir,'frozen.json'))),runtime:process.version}),{flag:'wx'});
  const strategy=new StrategyPaper(frozen.review,frozen.continuation.initialState),shadow=new ShadowCollector(frozen.review);
  const reconnects=new VenueRebuildBudget(policy.maxReconnects,deadline);
  const targets:FeedTarget[]=(['discovery','strategy'] as const).flatMap(lane=>(['kalshi','poly'] as const).map(venue=>({lane,venue})));
  const executionRows=strategy.allowed;if(executionRows.length!==executionLanePolicy.maxMarkets)throw Error('EXECUTION_LANE_SCOPE_CHANGED');
  const metadata=frozen.metadata as Metadata[],blocked=new Map<string,string>(frozen.blocked.map((x:any)=>[x.pairId,x.reason]));
  const arrivals:any[]=[],feedEvents:any[]=[],confirmations:any[]=[],observations=new Map<string,any>(),positive={strategy:new Set<string>(),shadow:new Set<string>()},confirmationCounts=new Map<string,number>(),lastRequest=new Map<string,number>();
  const rejected:Record<string,number>={};let confirmationCycles=0,requestedConfirmations=0,recoveryBookRequests=0;
  const count=(reasons:string[])=>{for(const r of new Set(reasons))rejected[r]=(rejected[r]??0)+1;};
  const dirty=new Set<string>(),fingerprints=new Map<string,string>(),histories=new Map<string,SnapshotReceipt[]>();
  let tracker:MarketStatusTracker,executionTracker:MarketStatusTracker,feeds:Record<Venue,ConfirmationFeed>={} as Record<Venue,ConfirmationFeed>,executionFeeds:Record<Venue,ConfirmationFeed>={} as Record<Venue,ConfirmationFeed>,stopped=false,reason='ORIGINAL_DEADLINE',bytes=0,ready=false;
  let wake:()=>void=()=>{},nextRequest=0;
  const notify=()=>wake();
  const stop=()=>{stopped=true;reason='EXTERNAL_OR_SUPERVISOR_STOP';notify();};process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const record:RecordEvidence=(kind,body)=>{const line=JSON.stringify({at:Date.now(),kind,body})+'\n';bytes+=Buffer.byteLength(line);if(bytes>policy.maxEvidenceBytes){stopped=true;reason='EVIDENCE_LIMIT';notify();return;}appendFileSync(resolve(dir,'evidence.ndjson'),line);};
  const laneFeeds=(lane:FeedLane)=>lane==='strategy'?executionFeeds:feeds;
  const laneFor=(lane:'strategy'|'shadow'):FeedLane=>lane==='strategy'?'strategy':'discovery';
  const current=(v:Venue,id:string,mono=Infinity,lane:FeedLane='discovery')=>histories.get(lane+':'+v+':'+id)?.filter(r=>r.e.processedMono<=mono&&r.e.book.receivedMono<=mono).at(-1);
  const healthy=(lane:FeedLane='discovery')=>ready&&(['kalshi','poly'] as const).every(v=>{const h=laneFeeds(lane)[v]?.health();return h?.connected&&h.clockOkay&&h.backlog===0;});
  const diagnostics=()=>targets.flatMap(t=>{const f=laneFeeds(t.lane)[t.venue];if(!f)return [];const health=f.health(),lifecycleFaults=t.venue==='kalshi'?[...laneTracker(t.lane).faults]:[];return [feedDiagnostic(t,{...health,connected:health.connected&&!lifecycleFaults.length},[...new Set([...f.failures,...lifecycleFaults])],f.stream.health())];});
  let stoppedDiagnostics:unknown=null;
  const laneTracker=(lane:FeedLane)=>lane==='strategy'?executionTracker:tracker;
  const status=(m:Metadata,lane:FeedLane='discovery')=>laneTracker(lane).view(m.row.kalshiId,Date.now(),laneFeeds(lane).kalshi.health().connected);
  const strategySummary=()=>({...strategy.summary(),holdings:strategy.entries.map(({row,session:s})=>{
    const p=s.state.positions[0],m=metadata.find(m=>m.row.pairId===row.pairId),base=strategy.summary().holdings.find(h=>h.pairId===row.pairId)!;
    return {...base,openedAt:p?.openedAt??null,observedHeldMs:p?Date.now()-p.openedAt:null,feeNetConditionalSurplus:base.conditionalUnrealizedSurplus,reservedRiskCash:base.separateRiskAllowance,analyticalRiskEstimate:base.separateRiskAllowance,conditionalSurplusNetOfAnalyticalRisk:base.conditionalUnrealizedSurplus===null?null:base.conditionalUnrealizedSurplus-base.separateRiskAllowance,administrativeTimes:m?.administrativeTimes??null,cashRelease:'UNCERTAIN_NOT_GUARANTEED'};
  })});
  const persist=()=>{
    save(dir,'journal.json',{portfolio:strategy.summary(),entries:strategy.entries});
    save(dir,'summary.json',{scope:policy.mode,phase:stopped?'STOPPED':ready?'RUNNING':'REBUILDING_BOOKS',startedAt,endedAt:stopped?Date.now():null,deadlineAt:startedAt+policy.durationMs,reason,policy,ordersEnabled:false,liveAdmitted:false,retainedComparisons:34,refreshedComparisons:metadata.length,blocked:[...blocked].map(([pairId,reason])=>({pairId,reason})),sourceJournalSha256:frozen.continuation.sourceJournalSha256,strategy:strategySummary(),strategyEntryStop:strategy.stopReason(),strategyModeled:strategy.entries.slice(strategy.inheritedEntries).map(({row,session:s})=>({pairId:row.pairId,plans:s.plan,legs:s.results,executionClass:executionClass(s.results),recovery:s.recovery,recoveryLoss:s.recoveryLoss})),shadow:shadow.summary(),distinctPositiveAfterFeeRoutes:{strategy:[...positive.strategy],shadow:[...positive.shadow]},confirmationCycles,requestedConfirmations,recoveryBookRequests,confirmations,rejectionCounts:rejected,observations:[...observations.values()],arrivals,feedEvents,reconnections:{...reconnects.used},reconnectLimitPerVenue:policy.maxReconnects,executionLanePolicy,executionMarkets:executionRows.map(r=>({kalshi:r.kalshiId,poly:r.polyId})),stoppedDiagnostics,rawEvidenceBytes:bytes,settlement:'Strategy CONDITIONAL; shadow has NO settlement assumption; no realized profit inferred',synthetic:false});
  };
  const heartbeat=setInterval(()=>{persist();console.log(JSON.stringify({mode:'live-data',scope:policy.mode,phase:ready?'RUNNING':'REBUILDING_BOOKS',elapsedMs:performance.now()-startMono,strategyAttempts:strategy.newAttempts(),strategyEntryStop:strategy.stopReason(),shadowAttempts:shadow.attempts.length,confirmationCycles,observed:observations.size,committed:strategy.commitment(),ordersEnabled:false}));},10000);
  const wait=async(ms:number)=>{await new Promise<void>(r=>{const done=()=>{clearTimeout(timer);wake=()=>{};r();},timer=setTimeout(done,Math.max(0,ms));wake=done;});};
  const mark=(lane:FeedLane,r:SnapshotReceipt)=>{
    const b=r.e.book,key=lane+':'+b.venue+':'+b.marketId,h=histories.get(key)??[];h.push(structuredClone(r));if(h.length>256)h.shift();histories.set(key,h);
    for(const m of metadata)if(m.row.kalshiId===b.marketId||m.row.polyId===b.marketId){dirty.add(m.row.pairId);if(!b.open)blocked.set(m.row.pairId,'KNOWN_BOOK_CLOSURE');}
    notify();
  };
  const connect=async(affected:FeedTarget[]=targets)=>{
    ready=false;for(const key of histories.keys())if(affected.some(t=>key.startsWith(t.lane+':'+t.venue+':')))histories.delete(key);fingerprints.clear();dirty.clear();
    const lifecycleTargets=affected.filter(t=>t.venue==='kalshi');
    for(const {lane} of lifecycleTargets){const ids=lane==='strategy'?executionRows.map(r=>r.kalshiId):metadata.map(m=>m.row.kalshiId),next=new MarketStatusTracker([...new Set(ids)]);if(lane==='strategy')executionTracker=next;else tracker=next;}
    for(const {lane,venue} of affected){
      const rows=lane==='strategy'?executionRows:metadata.map(m=>m.row),ids=[...new Set(rows.map(r=>venue==='kalshi'?r.kalshiId:r.polyId))];
      const laneRecord:RecordEvidence=(kind,body)=>record(kind,{lane,venue,evidence:body});
      laneFeeds(lane)[venue]=new ConfirmationFeed(venue,ids,laneRecord,{onBook:r=>mark(lane,r),...(venue==='kalshi'?{
        extraSubscriptions:[lifecycleSubscription],onMessage:(message:Record<string,any>,at:number,mono:number)=>{
          const tracker=laneTracker(lane);tracker.receive(message,at,mono);
          for(const m of metadata){const s=tracker.states.get(m.row.kalshiId);if(s?.knownNegative||s?.issues.has('CONTRACT_METADATA_CHANGED')){blocked.set(m.row.pairId,'LIFECYCLE_CONTRADICTORY_OR_CHANGED');dirty.add(m.row.pairId);}}
          notify();
        },onInvalid:(r:string)=>{laneTracker(lane).invalidate(r);notify();}
      }:{onInvalid:notify})});
    }
    for(const t of affected)laneFeeds(t.lane)[t.venue].start();
    const initialized=await Promise.allSettled(affected.map(t=>laneFeeds(t.lane)[t.venue].ready(Math.max(0,Math.min(10000,deadline-performance.now())))));
    if(stopped||performance.now()>=deadline)throw Error('ORIGINAL_DEADLINE');
    const initializationFailures=affected.filter((_,i)=>initialized[i].status==='rejected');
    if(initializationFailures.length){
      const states=diagnostics();
      // Wait for all bounded initializations: a transport error on one feed
      // must not hide a simultaneous missing-book/nontransport error on another.
      const terminal=initializationFailures.find(t=>!states.find(s=>s.lane===t.lane&&s.venue===t.venue)?.transportRebuildable);
      if(terminal)throw Error('BOOK_READINESS_FAILED:'+terminal.lane+':'+terminal.venue);
      throw Error('CONTROL_FEED_NOT_READY');
    }
    for(const {lane} of lifecycleTargets){
      const tracker=laneTracker(lane),ack=performance.now();
      while(tracker.sid===null&&performance.now()-ack<5000&&performance.now()<deadline&&!stopped)await sleep(20);
      if(stopped||performance.now()>=deadline)throw Error('ORIGINAL_DEADLINE');
      if(tracker.sid===null)throw Error('LIFECYCLE_ACK_MISSING:'+lane);
      for(const id of tracker.states.keys()){
        if(stopped||performance.now()>=deadline)return;tracker.beginBaseline(id);
        try{const r=await get(`${K}/markets/${id}`,(kind,body)=>record(kind,{lane,evidence:body}));tracker.applyBaseline(id,r.data.market,r.evidence);
          if(tracker.view(id,Date.now(),true).knownBlocked)for(const m of metadata)if(m.row.kalshiId===id)blocked.set(m.row.pairId,'KNOWN_NONTRADING_STATE');
        }catch{tracker.baselineFailed(id);}
      }
    }
    ready=true;for(const m of metadata)dirty.add(m.row.pairId);notify();
  };
  const request=async(m:Metadata,lane:FeedLane)=>{
    const selected=laneFeeds(lane);
    const requestAt=Math.max(nextRequest,performance.now());nextRequest=requestAt+policy.requestSpacingMs;await sleep(requestAt-performance.now());if(stopped||performance.now()>=deadline)throw Error('REQUEST_DEADLINE');
    if(!healthy(lane))throw Error('ENTRY_FEEDS_UNHEALTHY:'+lane);
    const all=await Promise.allSettled([selected.kalshi.confirmKalshi(m.row.kalshiId),confirmPolyBook(m.row.polyId,()=>selected.poly.latest.get(m.row.polyId),()=>selected.poly.health(),(kind,body)=>record(kind,{lane,evidence:body}))]);
    if(all.some(r=>r.status==='rejected'))throw Error('REQUESTED_BOOK_FAILED:'+all.filter(r=>r.status==='rejected').map(r=>String((r as PromiseRejectedResult).reason?.message)).join(','));
    return {kalshi:(all[0] as PromiseFulfilledResult<Awaited<ReturnType<ConfirmationFeed['confirmKalshi']>>>).value,poly:(all[1] as PromiseFulfilledResult<Awaited<ReturnType<typeof confirmPolyBook>>>).value};
  };
  type Proofs=Awaited<ReturnType<typeof request>>;
  const arrival=(m:Metadata,v:Venue,proofs:Proofs,due:number,scenario:'strategy'|'shadow')=>{
    const lane=laneFor(scenario),id=v==='kalshi'?m.row.kalshiId:m.row.polyId;
    const wall=startedAt+due-startMono,proof=proofs[v],latest=current(v,id,due,lane);
    const assessed=assessLaneEvidence(lane,proof,latest,laneFeeds(lane)[v].health(),wall,due,lane==='strategy'?{receipt:current(v,id,due),health:feeds[v].health()}:undefined),reasons=[...assessed.reasons];
    if(!latest||proof.response.e.processedMono>due)reasons.push('NO_BOOK_AVAILABLE_AT_MODELED_ARRIVAL');
    if(performance.now()-due>250)reasons.push('ARRIVAL_PROCESSING_LATE');
    if(Math.abs((Date.now()-startedAt)-(performance.now()-startMono))>1000)reasons.push('CLOCK_FAULT');
    if(stopped||due>=deadline)reasons.push('CENSORED_OR_DEADLINE');
    if(blocked.has(m.row.pairId))reasons.push(blocked.get(m.row.pairId)!);
    if(v==='kalshi')reasons.push(...assumedStatus(status(m,lane)).reasons);
    const e=assessed.selected.e,b=e.book,result={scenario,primaryEvidenceLane:lane,discoveryCorroboration:assessed.corroboration,pairId:m.row.pairId,venue:v,modeledArrivalMono:due,processedMono:performance.now(),bookReceiptAt:b.receivedAt,bookReceiptMono:b.receivedMono,bookProcessedMono:e.processedMono,exchangeAt:b.exchangeAt,sequence:b.sequence,transactTime:assessed.selected.transactTime??null,requestRoundTripMs:proof.response.e.book.receivedMono-proof.request.mono,reasons};
    record('ARRIVAL_EVIDENCE',{...result,book:b});return {book:b,reasons,wall,receipt:result};
  };
  const simulate=async(m:Metadata,s:Session,proofs:Proofs|undefined,lane:'strategy'|'shadow',attemptId:string)=>{
    if(!proofs)throw Error('MISSING_REQUESTED_CONFIRMATION');
    persist();record('FROZEN_SUBMISSION',{lane,attemptId,pairId:m.row.pairId,plans:s.plan});
    await Promise.all((['kalshi','poly'] as const).map(async v=>{
      const plan=s.plan![v];await sleep(plan.arrivalMono-performance.now());
      const ev=arrival(m,v,proofs,plan.arrivalMono,lane),market=v==='kalshi'?m.pair.a:m.pair.b;
      const result=modelLeg(plan,market,ev.book,ev.reasons,v==='kalshi'&&status(m,laneFor(lane)).knownBlocked,ev.wall,plan.arrivalMono);
      accountLeg(s,m.pair,v,result);arrivals.push({...ev.receipt,attemptId,phase:'ENTRY',movement:arrivalMovement(plan,market,ev.book,ev.reasons)});
      record('MODELED_LEG',{lane,attemptId,pairId:m.row.pairId,venue:v,result});persist();
    }));
    if(recoveryPlan(s,performance.now())&&!stopped&&performance.now()+2500<deadline){
      await sleep(policy.recoveryDelayMs);
      try{recoveryBookRequests++;const rpProofs=await request(m,laneFor(lane)),rp=recoveryPlan(s,performance.now());if(rp&&rp.arrivalMono<deadline){
        record('FROZEN_RECOVERY',{lane,attemptId,pairId:m.row.pairId,plan:rp});await sleep(rp.arrivalMono-performance.now());
        const ev=arrival(m,rp.venue,rpProofs,rp.arrivalMono,lane);recover(s,rp,rp.venue==='kalshi'?m.pair.a:m.pair.b,ev.book,ev.reasons,ev.wall,rp.arrivalMono);arrivals.push({...ev.receipt,attemptId,phase:'RECOVERY'});
      }}catch(e){s.recovery={outcome:'INCONCLUSIVE',reasons:[(e as Error).message]};}
    }
  };
  type Opportunity={m:Metadata;quote:Candidate;times:Metadata['administrativeTimes'];lane:'strategy'|'shadow';signature:ReturnType<typeof shadowSignature>};
  const scan=()=>{
    const candidates:Opportunity[]=[];
    for(const m of metadata){
      const id=m.row.pairId,lane=strategy.authorized(m.row)?'strategy':'shadow',feedLane=laneFor(lane),selected=laneFeeds(feedLane),a=current('kalshi',m.row.kalshiId,Infinity,feedLane),b=current('poly',m.row.polyId,Infinity,feedLane);
      const dataReasons=[...m.entryReasons,...validity(a?.e,selected.kalshi.health(),Date.now(),performance.now()).reasons,...validity(b?.e,selected.poly.health(),Date.now(),performance.now()).reasons,...(blocked.has(id)?[blocked.get(id)!]:[])];
      const collector=lane==='strategy'?strategy:shadow,selection=collector.select(m.row,m.pair,a?.e.book,b?.e.book,status(m,feedLane),m.constraints,Date.now());
      const best=selection.best,q=selection.selected,fingerprint=bookFingerprint(a?.e.book,b?.e.book);
      if(fingerprints.get(id)!==fingerprint){
        fingerprints.set(id,fingerprint);const obs=observations.get(id),reasons=[...dataReasons,...collector.gates(m.row,m.pair,best,status(m,feedLane),m.constraints)];
        observations.set(id,{pairId:id,lane,at:Date.now(),sides:m.row.sides,classification:m.row.settlementClassification,quantity:best.quantity,...(lane==='strategy'?{economics:economics(best)}:{feeNetDisplayedSpread:best.economics?.feeBoundSurplus??null}),horizon:horizon(m.administrativeTimes,best,Date.now()),reasons,changes:(obs?.changes??0)+1});count(reasons);
      }
      // Distinct fee-positive routes are counted before portfolio capacity/dedup gates, but only on valid current evidence.
      if(!dataReasons.length&&!best.pricingReasons.length&&best.economics&&best.economics.feeBoundSurplus>0)positive[lane].add(id);
      if(dataReasons.length||!q||!a||!b)continue;
      if(confirmationCycles>=policy.maxConfirmations||(confirmationCounts.get(id)??0)>=policy.maxConfirmationsPerRoute||performance.now()-(lastRequest.get(id)??-Infinity)<policy.routeConfirmationCooldownMs)continue;
      const signature=shadowSignature(q,a.e.book,b.e.book);
      if(lane==='shadow'&&!shadow.canAttempt(m.row,signature))continue;
      candidates.push({m,quote:q,times:m.administrativeTimes,lane,signature});
    }
    const strategyQueue=rankOpportunities(candidates.filter(x=>x.lane==='strategy'),Date.now()),shadowQueue=rankOpportunities(candidates.filter(x=>x.lane==='shadow'),Date.now());
    return [...strategyQueue,...shadowQueue];
  };
  const execute=async(o:Opportunity)=>{
    const {m,quote:original,lane,signature}=o,id=m.row.pairId,attemptId=lane+':'+id+':'+Date.now();let proofs:Proofs|undefined;
    const confirm=async()=>{
      confirmationCycles++;confirmationCounts.set(id,(confirmationCounts.get(id)??0)+1);lastRequest.set(id,performance.now());
      let fresh:Metadata;try{fresh=await refreshRow(m.row,m.pair,record,laneTracker(laneFor(lane)));}catch(e){blocked.set(id,(e as Error).message);throw e;}
      if(JSON.stringify(fresh.constraints)!==JSON.stringify(m.constraints)||JSON.stringify(fresh.administrativeTimes)!==JSON.stringify(m.administrativeTimes)){blocked.set(id,'MATERIAL_CONSTRAINTS_OR_TIMES_CHANGED');throw Error('MATERIAL_CONSTRAINTS_OR_TIMES_CHANGED');}
      requestedConfirmations++;proofs=await request(m,laneFor(lane));
      const at=Date.now(),mono=performance.now(),feedLane=laneFor(lane),selected=laneFeeds(feedLane),ka=assessLaneEvidence(feedLane,proofs.kalshi,current('kalshi',m.row.kalshiId,mono,feedLane),selected.kalshi.health(),at,mono),pa=assessLaneEvidence(feedLane,proofs.poly,current('poly',m.row.polyId,mono,feedLane),selected.poly.health(),at,mono);
      const quote=quoteCandidate(m.pair,ka.selected.e.book,pa.selected.e.book,m.row.sides.kalshi,at,original.quantity),reasons=[...fresh.entryReasons,...ka.reasons,...pa.reasons];
      if(Math.abs(proofs.kalshi.response.e.book.receivedMono-proofs.poly.response.e.book.receivedMono)>2000)reasons.push('CROSS_VENUE_DELAY');
      confirmations.push({attemptId,lane,pairId:id,at,quantity:quote.quantity,bookConfirmed:ka.accepted&&pa.accepted,reasons,feeNetDisplayedSpread:quote.economics?.feeBoundSurplus??null,...(lane==='strategy'?{economics:economics(quote)}:{}),horizon:horizon(fresh.administrativeTimes,quote,at),statusAssumption:assumedStatus(status(m,feedLane))});
      return {quote,status:status(m,feedLane),constraints:fresh.constraints,reasons};
    };
    try{
      if(lane==='strategy'){
        strategy.confirmations++;
        const result=await strategy.execute(m.row,m.pair,original,confirm,s=>simulate(m,s,proofs,lane,attemptId),Date.now,()=>performance.now(),()=>!stopped&&healthy('strategy')&&(['kalshi','poly'] as const).every(v=>!!proofs&&assessLaneEvidence('strategy',proofs[v],current(v,v==='kalshi'?m.row.kalshiId:m.row.polyId,performance.now(),'strategy'),executionFeeds[v].health(),Date.now(),performance.now()).accepted)&&!blocked.has(id)&&performance.now()+2500<deadline);
        confirmations.push({attemptId,lane,pairId:id,at:Date.now(),phase:'FINAL_ADMISSION',...result});count(result.reasons);
      }else{
        const proof=await confirm(),reasons=[...proof.reasons,...shadow.gates(m.row,m.pair,proof.quote,proof.status,proof.constraints)];
        if(proof.quote.quantity!==original.quantity||proof.quote.aSide!==original.aSide||proof.quote.bSide!==original.bSide||proof.quote.pairId!==original.pairId)reasons.push('CONFIRMED_CANDIDATE_CHANGED');
        if(stopped||!healthy()||blocked.has(id)||performance.now()+2500>=deadline)reasons.push('SESSION_PAUSED_OR_DEADLINE');
        if(!reasons.length){const s=shadow.begin(m.row,m.pair,proof.quote,proof.status,proof.constraints,signature,Date.now(),performance.now());try{await simulate(m,s,proofs,lane,attemptId);}finally{shadow.busy=false;}}
        confirmations.push({attemptId,lane,pairId:id,at:Date.now(),phase:'FINAL_ADMISSION',attempted:!reasons.length,reasons});count(reasons);
      }
    }catch(e){const error=(e as Error).message;count([error]);confirmations.push({attemptId,lane,pairId:id,at:Date.now(),error});record('CONFIRMATION_OR_EXECUTION_ERROR',{attemptId,lane,pairId:id,error});}
    persist();
  };
  try{
    if(!metadata.length){reason='NO_VALID_RETAINED_COMPARISONS';return;}
    let connectError:string|null=null;
    try{await connect();}catch(e){connectError=(e as Error).message;}
    while(!stopped&&performance.now()<deadline){
      const snapshots=diagnostics(),failed=snapshots.filter(s=>!s.health.connected||!s.health.clockOkay);
      if(connectError||failed.length){
        const event={at:Date.now(),reason:connectError,feeds:snapshots,action:'ASSESS_REBUILD'};feedEvents.push(event);record('FEED_HEALTH_DIAGNOSTICS',event);
        if(snapshots.some(s=>!s.health.clockOkay))throw Error('CLOCK_FAULT');
        if(connectError&&connectError!=='CONTROL_FEED_NOT_READY')throw Error(connectError);
        // A parser, sequence, ingress-integrity, readiness or unknown health
        // failure cannot be laundered into a transport retry.
        if(!failed.length||failed.some(s=>!s.transportRebuildable))throw Error(connectError??'NONTRANSPORT_OR_UNESTABLISHED_FEED_FAULT');
        const affected=failed.map(({lane,venue})=>({lane,venue})),reservation=reconnects.reserve(affected,performance.now(),strategy.busy||shadow.busy);
        if(!reservation.accepted){reason=reservation.reason!;break;}
        ready=false;for(const t of affected)laneFeeds(t.lane)[t.venue].stop();
        feedEvents.push({at:Date.now(),action:'TRANSPORT_REBUILD',targets:affected,reconnections:{...reconnects.used}});
        connectError=null;try{await connect(affected);}catch(e){connectError=(e as Error).message;}continue;
      }
      // Each lane can scan/dispatch while the other's queue is backed up.
      if(!healthy()&&!healthy('strategy')){await wait(Math.min(250,deadline-performance.now()));continue;}
      if(!dirty.size){await wait(Math.min(1000,deadline-performance.now()));continue;}
      await wait(policy.coalesceMs);dirty.clear();
      const queue=scan();if(queue.length&&healthy(laneFor(queue[0].lane))&&!stopped&&performance.now()+2500<deadline){await execute(queue[0]);for(const m of metadata)dirty.add(m.row.pairId);}
    }
  }catch(e){reason=(e as Error).message;record('STOP_REASON',{reason});}
  finally{stopped=true;stoppedDiagnostics={at:Date.now(),reason,classification:stopClassification(reason),feeds:diagnostics(),reconnections:{...reconnects.used},strategyEntryStop:strategy.stopReason()};record('STOPPED_SESSION_DIAGNOSTICS',stoppedDiagnostics);ready=false;clearInterval(heartbeat);persist();for(const t of targets)laneFeeds(t.lane)[t.venue]?.stop();process.off('SIGINT',stop);process.off('SIGTERM',stop);console.log(JSON.stringify({mode:'live-data',message:'PRODUCTION_PAPER_STOPPED',reason,strategyAttempts:strategy.newAttempts(),shadowAttempts:shadow.attempts.length,ordersEnabled:false}));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [mode,output,env,sourceJournal]=process.argv.slice(2);if(!output||!['prepare','observe'].includes(mode))throw Error('Usage: production-paper.ts prepare|observe DIRECTORY ENV_FILE [CHALLENGER_SOURCE_JOURNAL]');if(env)process.loadEnvFile(env);if(mode==='prepare'){if(!sourceJournal)throw Error('Challenger source journal required');await prepare(resolve(output),process.cwd(),sourceJournal);}else await observe(resolve(output),process.cwd());}
