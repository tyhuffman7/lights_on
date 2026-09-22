import {appendFileSync,existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {normalizeKalshi,normalizePoly} from '../lib/arb/adapters.ts';
import type {Pair,Venue} from '../lib/arb/types.ts';
import {ksuPolicy as policy,ksuScenarios,contractDifferences,admission,newSession,reserve,modelLeg,accountLeg,recoveryPlan,recover,accounting,assumedStatus} from '../lib/arb/ksu-paper.ts';
import type {Constraints} from '../lib/arb/ksu-paper.ts';
import {quoteCandidate} from '../lib/screen/confirmation.ts';
import {assessSnapshot} from '../lib/screen/book-confirmation.ts';
import type {SnapshotReceipt} from '../lib/screen/book-confirmation.ts';
import {MarketStatusTracker,lifecycleSubscription} from '../lib/screen/market-status.ts';
import {ConfirmationFeed,confirmPolyBook,publicConfirmationGet} from './book-confirmation-adapter.ts';
import type {RecordEvidence} from './book-confirmation-adapter.ts';
import {sourceManifest} from './screen-manifest.ts';

const sha=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
const save=(dir:string,name:string,x:unknown)=>{writeFileSync(resolve(dir,name+'.tmp'),JSON.stringify(x,null,2)+'\n');renameSync(resolve(dir,name+'.tmp'),resolve(dir,name));};
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
const K='https://external-api.kalshi.com/trade-api/v2',P='https://gateway.polymarket.us/v1';
export const primaryDocuments=[
  {url:'https://assets.kalshi.com/contract_terms/NCAAFCONFCHAMPQ.pdf',hash:'146a07f48325b0ec14ca993c9f3e6ebd8bee26f143cf3cd125053f721696bf7c'},
  {url:'https://www.polymarketexchange.com/files/products/PMUS%20-%20AQC%20-%20%282026.03.26%29.pdf',hash:'5960588d6a24f1ff1b1636ccfe7d14cb6cd32fc167a0efce39c87830edbe980e'},
  {url:'https://www.polymarketexchange.com/files/legal/latest/rulebook',hash:'e7b7793e75dd61a8adaf807c588e1212cf0600100e5727d7d546ba0a0b7f35e5'},
];
export const orderDocuments=[
  {url:'https://docs.kalshi.com/api-reference/orders/create-order-v2.md',required:'fill_or_kill'},
  {url:'https://docs.polymarket.us/api-reference/orders/create-order.md',required:'TIME_IN_FORCE_FILL_OR_KILL'},
];
function manifest(root:string){return {...sourceManifest(root),'scripts/ksu-paper-launch.mjs':sha(readFileSync(resolve(root,'scripts/ksu-paper-launch.mjs'))),'docs/research/contract-shortlist/retained-markets.json':sha(readFileSync(resolve(root,'docs/research/contract-shortlist/retained-markets.json')))};}
export async function refresh(record:RecordEvidence,tracker?:MarketStatusTracker){
  if(tracker)tracker.beginBaseline(policy.kalshi);
  const urls=[`${K}/markets/${policy.kalshi}`,`${K}/series/KXNCAAFB12QUAL`,`${K}/events/KXNCAAFB12QUAL-26`,`${P}/market/slug/${policy.poly}`,`${K}/exchange/status`];
  const values=[];
  for(const url of urls){const r=await publicConfirmationGet(url,record);if(r.evidence.status!==200)throw Error('METADATA_HTTP_'+r.evidence.status);values.push(r);}
  const [k,s,e,p,x]=values,m=k.data.market,pm=p.data.market??p.data,event=e.data.event;
  if(tracker)tracker.applyBaseline(policy.kalshi,m,k.evidence);
  const a=await normalizeKalshi(m,s.data.series),b=await normalizePoly(pm);
  if(m.ticker!==policy.kalshi||pm.slug!==policy.poly||event?.event_ticker!=='KXNCAAFB12QUAL-26'||s.data.series?.ticker!=='KXNCAAFB12QUAL')throw Error('EXACT_METADATA_IDENTITY_CHANGED');
  if(pm.marketSides.some((side:any)=>side.teamId!==1143||side.team?.safeName!=='Kansas State'))throw Error('PM_TEAM_IDENTITY_CHANGED');
  if(!a.open||!b.open||pm.ep3Status!=='OPEN'||pm.status!=='MARKET_STATUS_OPEN'||Date.parse(m.close_time)<=Date.now()||x.data.trading_active!==true||x.data.exchange_active!==true)throw Error('KNOWN_CLOSURE_OR_NOT_REPORTED_ACTIVE');
  if(event.fee_type_override!=null||event.fee_multiplier_override!=null||m.fee_waiver_expiration_time)throw Error('FEE_OVERRIDE_REQUIRES_REVIEW');
  const ranges=m.price_ranges;
  if(m.price_level_structure!=='linear_cent'||ranges?.length!==1||ranges[0].start!=='0.0000'||ranges[0].end!=='1.0000'||ranges[0].step!=='0.0100'||pm.orderPriceMinTickSize!==0.01)throw Error('PRICE_GRID_CHANGED_OR_UNSUPPORTED');
  if(a.exchangeIndex!==0||a.feeRate!==700||b.feeRate!==695||a.minQty!==1||b.minQty!==0.01)throw Error('FEE_OR_QUANTITY_MODEL_CHANGED');
  const pair:Pair={id:policy.kalshi+'|'+policy.poly,a,b,inverted:false,reviewed:false,notes:'Named conditional PAPER exception; never equivalent'};
  const constraints:Constraints={kalshi:{tick:100,minimum:1},poly:{tick:100,minimum:b.minQty}};
  return {pair,constraints,at:Date.now(),http:values.map(v=>v.evidence),reportedStatus:{kalshi:m.status,poly:pm.status,exchange:x.data},administrativeTimes:{kalshiClose:m.close_time,kalshiExpected:m.expected_expiration_time,kalshiLatest:m.latest_expiration_time,polyEnd:pm.endDate},feeEvidence:{series:s.data.series.fee_type,multiplier:s.data.series.fee_multiplier,eventOverride:event.fee_type_override??null,eventMultiplierOverride:event.fee_multiplier_override??null,polyCoefficient:pm.feeCoefficient}};
}
export async function prepare(dir:string,root:string){
  mkdirSync(dir,{recursive:true});if(existsSync(resolve(dir,'preparation.json')))throw Error('Single-use preparation');
  save(dir,'preparation.json',{at:Date.now(),policy});
  const record:RecordEvidence=(kind,body)=>appendFileSync(resolve(dir,'preparation.ndjson'),JSON.stringify({kind,body})+'\n');
  const documents=[];
  for(const doc of [...primaryDocuments,...orderDocuments]){
    const r=await fetch(doc.url,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('PRIMARY_DOCUMENT_HTTP_'+r.status);
    const bytes=Buffer.from(await r.arrayBuffer()),hash=sha(bytes);
    if('hash'in doc&&hash!==doc.hash)throw Error(`MATERIAL_DOCUMENT_CHANGED ${doc.url}: ${doc.hash} -> ${hash}`);
    if('required'in doc&&!bytes.toString().includes(doc.required))throw Error('SUPPORTED_FOK_SEMANTICS_CHANGED '+doc.url);
    documents.push({url:doc.url,sha256:hash,bytes:bytes.length,retrievedAt:Date.now()});
  }
  const fresh=await refresh(record),old=JSON.parse(readFileSync(resolve(root,'docs/research/contract-shortlist/retained-markets.json'),'utf8'));
  const reviewed:Pair={...fresh.pair,a:old.kalshi.find((m:any)=>m.id===policy.kalshi),b:old.poly.find((m:any)=>m.id===policy.poly)};
  const differences=contractDifferences(reviewed,fresh.pair);if(differences.length){save(dir,'blocked.json',{differences});throw Error('REVIEWED_IDENTITY_OR_TERMS_CHANGED: '+differences.join('; '));}
  save(dir,'frozen.json',{at:Date.now(),policy,manifest:manifest(root),metadata:fresh,documents,classification:'CONDITIONAL',scenarios:ksuScenarios});
  console.log(JSON.stringify({phase:'KSU_FROZEN',ordersEnabled:false,documents:documents.length,termsUnchanged:true}));
}
export async function observe(dir:string,root:string){
  const frozen=JSON.parse(readFileSync(resolve(dir,'frozen.json'),'utf8'));
  if(existsSync(resolve(dir,'started.json')))throw Error('One observation window only; no restart');
  if(JSON.stringify(frozen.policy)!==JSON.stringify(policy)||JSON.stringify(frozen.manifest)!==JSON.stringify(manifest(root))||Date.now()-frozen.at>600000)throw Error('Freeze changed or expired');
  const startedAt=Date.now(),startMono=performance.now(),deadline=startMono+policy.durationMs;
  save(dir,'started.json',{startedAt,deadlineAt:startedAt+policy.durationMs,freezeSha256:sha(readFileSync(resolve(dir,'frozen.json'))),runtime:process.version});
  let stopped=false,reason='NO_QUALIFYING_ENTRY',bytes=0,confirmations=0,lastMetadata=frozen.metadata;
  const session=newSession(),observations:any[]=[],arrivals:any[]=[],histories:Record<Venue,SnapshotReceipt[]>={kalshi:[],poly:[]};
  const tracker=new MarketStatusTracker([policy.kalshi]);
  const stop=()=>{stopped=true;reason='EXTERNAL_OR_SUPERVISOR_STOP';};process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const record:RecordEvidence=(kind,body)=>{const line=JSON.stringify({at:Date.now(),kind,body})+'\n';bytes+=Buffer.byteLength(line);if(bytes>policy.maxEvidenceBytes){stopped=true;reason='EVIDENCE_LIMIT';return;}appendFileSync(resolve(dir,'evidence.ndjson'),line);};
  const onBook=(v:Venue)=>(r:SnapshotReceipt)=>{histories[v].push(structuredClone(r));if(histories[v].length>2048){histories[v].shift();}};
  const feeds={kalshi:new ConfirmationFeed('kalshi',[policy.kalshi],record,{extraSubscriptions:[lifecycleSubscription],onBook:onBook('kalshi'),onMessage:(m,at,mono)=>tracker.receive(m,at,mono),onInvalid:r=>tracker.invalidate(r)}),poly:new ConfirmationFeed('poly',[policy.poly],record,{onBook:onBook('poly')})};
  const status=()=>tracker.view(policy.kalshi,Date.now(),feeds.kalshi.health().connected);
  const current=(v:Venue,mono=Infinity)=>histories[v].filter(r=>r.e.processedMono<=mono&&r.e.book.receivedMono<=mono).at(-1);
  const pair=frozen.metadata.pair as Pair;
  const snapshot=()=>({scope:policy.mode,phase:stopped?'STOPPED':'RUNNING',startedAt,endedAt:stopped?Date.now():null,reason,policy,classification:'CONDITIONAL',ordersEnabled:false,liveAdmitted:false,confirmations,observations,arrivals,planned:session.plan,modeled:session.results,recovery:session.recovery,accounting:accounting(session),scenarios:ksuScenarios,
    metadataEvidence:{at:lastMetadata.at,http:lastMetadata.http,administrativeTimes:lastMetadata.administrativeTimes,feeEvidence:lastMetadata.feeEvidence,constraints:lastMetadata.constraints,documents:frozen.documents},statusAssumption:assumedStatus(status()),feedFailures:{kalshi:feeds.kalshi.failures,poly:feeds.poly.failures},rawEvidenceBytes:bytes,
    timing:'500 ms modeled transport per independent leg; requested-book round-trip is not measured order latency',settlement:'No settlement modeled; conditional ordinary-outcome surplus is unrealized; no capital recycling'});
  const persist=()=>{save(dir,'journal.json',session);save(dir,'summary.json',snapshot());};
  const heartbeat=setInterval(()=>{persist();console.log(JSON.stringify({mode:'live-data',scope:policy.mode,ordersEnabled:false,confirmations,attempts:session.attempts,elapsedMs:performance.now()-startMono}));},10000);
  const request=async()=>{
    const all=await Promise.allSettled([feeds.kalshi.confirmKalshi(policy.kalshi),confirmPolyBook(policy.poly,()=>feeds.poly.latest.get(policy.poly),()=>feeds.poly.health(),record)]);
    if(all.some(r=>r.status==='rejected'))throw Error('REQUESTED_BOOK_FAILED: '+all.filter(r=>r.status==='rejected').map(r=>String((r as PromiseRejectedResult).reason?.message)).join(','));
    return {kalshi:(all[0] as PromiseFulfilledResult<Awaited<ReturnType<ConfirmationFeed['confirmKalshi']>>>).value,poly:(all[1] as PromiseFulfilledResult<Awaited<ReturnType<typeof confirmPolyBook>>>).value};
  };
  type Proofs=Awaited<ReturnType<typeof request>>;
  const evidence=(v:Venue,proofs:Proofs,due:number)=>{
    const proof=proofs[v],wall=startedAt+(due-startMono),latest=current(v,due);
    const assessed=assessSnapshot(proof.request,proof.response,latest,feeds[v].health(),wall,due);
    const reasons=[...assessed.reasons];
    if(!latest||proof.response.e.processedMono>due)reasons.push('NO_BOOK_AVAILABLE_AT_MODELED_ARRIVAL');
    if(performance.now()-due>250)reasons.push('ARRIVAL_PROCESSING_LATE');
    if(Math.abs((Date.now()-startedAt)-(performance.now()-startMono))>1000)reasons.push('CLOCK_FAULT');
    if(v==='kalshi'&&!status().knownBlocked)reasons.push(...assumedStatus(status()).reasons);
    const selected=assessed.selected;
    const result={venue:v,modeledArrivalMono:due,processedMono:performance.now(),bookReceiptAt:selected.e.book.receivedAt,bookReceiptMono:selected.e.book.receivedMono,bookProcessedMono:selected.e.processedMono,bookExchangeAt:selected.e.book.exchangeAt,sequence:selected.e.book.sequence,transactTime:selected.transactTime??null,requestRoundTripMs:proof.response.e.book.receivedMono-proof.request.mono,reasons};
    arrivals.push(result);record('ARRIVAL_EVIDENCE',{...result,book:selected.e.book});
    return {book:selected.e.book,reasons,wall};
  };
  try{
    for(const f of Object.values(feeds))f.start();await Promise.all(Object.values(feeds).map(f=>f.ready()));
    const wait=performance.now();while(tracker.sid===null&&performance.now()-wait<5000&&!stopped)await sleep(20);
    if(tracker.sid===null)throw Error('LIFECYCLE_ACK_MISSING');
    let next=startMono;
    while(!stopped&&performance.now()<deadline&&confirmations<policy.maxConfirmations){
      if(performance.now()<next){await sleep(Math.min(250,next-performance.now()));continue;}
      if(!feeds.kalshi.health().connected||!feeds.poly.health().connected)throw Error('BROKEN_FEED');
      lastMetadata=await refresh(record,tracker);
      const diff=contractDifferences(pair,lastMetadata.pair);
      if(diff.length||JSON.stringify(lastMetadata.constraints)!==JSON.stringify(frozen.metadata.constraints)||JSON.stringify(lastMetadata.administrativeTimes)!==JSON.stringify(frozen.metadata.administrativeTimes))throw Error('MATERIAL_TERMS_OR_CONSTRAINTS_CHANGED '+diff.join('; '));
      confirmations++;next=performance.now()+policy.confirmationSpacingMs;
      let proofs:Proofs;
      try{proofs=await request();}catch(e){observations.push({at:Date.now(),reasons:[(e as Error).message]});continue;}
      const at=Date.now(),mono=performance.now();
      const ka=assessSnapshot(proofs.kalshi.request,proofs.kalshi.response,current('kalshi'),feeds.kalshi.health(),at,mono),pa=assessSnapshot(proofs.poly.request,proofs.poly.response,current('poly'),feeds.poly.health(),at,mono);
      const q=quoteCandidate(pair,ka.selected.e.book,pa.selected.e.book,'no',at),gate=admission(pair,q,status(),lastMetadata.constraints,session.state.cash);
      const reasons=[...ka.reasons,...pa.reasons,...gate.reasons];
      if(Math.abs(proofs.kalshi.response.e.book.receivedMono-proofs.poly.response.e.book.receivedMono)>2000)reasons.push('CROSS_VENUE_DELAY');
      observations.push({at,quote:q,statusAssumption:assumedStatus(status()),reasons,bookConfirmed:ka.accepted&&pa.accepted});persist();
      if(reasons.length)continue;
      if(stopped||performance.now()>=deadline)break;
      const plans=reserve(session,pair,q,status(),lastMetadata.constraints,Date.now(),performance.now());persist();record('FROZEN_SUBMISSION',plans);
      // Separate arrival callbacks; no instantaneous first fill or atomic pair.
      await Promise.all((['kalshi','poly'] as const).map(async v=>{
        await sleep(Math.max(0,plans[v].arrivalMono-performance.now()));
        const ev=evidence(v,proofs,plans[v].arrivalMono);
        const result=modelLeg(plans[v],v==='kalshi'?pair.a:pair.b,ev.book,[...ev.reasons,...(stopped?['CENSORED']:[])],v==='kalshi'&&status().knownBlocked,ev.wall,plans[v].arrivalMono);
        accountLeg(session,pair,v,result);persist();record('MODELED_LEG',{venue:v,result});
      }));
      reason='SINGLE_ATTEMPT_COMPLETE';
      const completionDeadline=Math.min(deadline+policy.graceMs,performance.now()+policy.graceMs);
      if(recoveryPlan(session,performance.now())&&!stopped){
        await sleep(policy.recoveryDelayMs);
        try{
          const freshProofs=await request();
          const rp=recoveryPlan(session,performance.now());
          if(rp&&rp.arrivalMono<completionDeadline&&!stopped){
            record('FROZEN_RECOVERY',rp);save(dir,'recovery-plan.json',rp);
            await sleep(Math.max(0,rp.arrivalMono-performance.now()));
            const ev=evidence(rp.venue,freshProofs,rp.arrivalMono);
            recover(session,rp,rp.venue==='kalshi'?pair.a:pair.b,ev.book,[...ev.reasons,...(stopped?['CENSORED']:[]),...(rp.venue==='kalshi'&&status().knownBlocked?['KNOWN_CLOSED']:[])],ev.wall,rp.arrivalMono);persist();
          }
        }catch(e){session.recovery={outcome:'INCONCLUSIVE',reasons:[(e as Error).message]};}
      }
      break;
    }
  }catch(e){reason=(e as Error).message;record('STOP_REASON',{reason});}
  finally{
    stopped=true;clearInterval(heartbeat);persist();for(const f of Object.values(feeds))f.stop();process.off('SIGINT',stop);process.off('SIGTERM',stop);
    console.log(JSON.stringify({mode:'live-data',message:'KSU_PAPER_STOPPED',reason,confirmations,accounting:accounting(session),ordersEnabled:false}));
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [mode,output,env]=process.argv.slice(2);if(!output||!['prepare','observe'].includes(mode))throw Error('Usage: ksu-paper.ts prepare|observe DIRECTORY [ENV_FILE]');
  if(env)process.loadEnvFile(env);
  if(mode==='prepare')await prepare(resolve(output),process.cwd());else await observe(resolve(output),process.cwd());
}
