// Bounded public-data PAPER observation. This file has no order API imports.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {getJSON,normalizeKalshi,normalizePoly} from '../lib/arb/adapters.ts';
import type {Pair,Venue} from '../lib/arb/types.ts';
import type {StreamBook} from '../lib/research/types.ts';
import {practicalSettlement} from '../lib/pilot/bounded-basis.ts';
import {evaluateEvArb,evPaperDefaults,type ArbEvaluation,type SettlementStatus} from '../lib/research/ev-arb.ts';
import {simulatePaperAttempt} from '../lib/research/ev-paper.ts';
import {ConfirmationFeed} from './book-confirmation-adapter.ts';
import {lifecycleSubscription,MarketStatusTracker} from '../lib/screen/market-status.ts';
import {EvLearningLedger,emptyFunnel,observeFunnel,learningReport,empiricalEvForCandidate} from './ev-learning-ledger.ts';
import type {WatchEntry} from '../lib/pilot/candidate-watch.ts';

export const livePaperWatchPolicy=Object.freeze({...evPaperDefaults,durationMs:90*60_000,
  shardDwellMs:90_000,sampleMs:250,entryDelayMs:50,heartbeatMs:10_000,
  maxRoutesPerShard:60,maxPrimaryAttempts:50,maxReconnectsPerVenue:3,
  metadataMaxAgeMs:180_000,ordersEnabled:false as const});
const K='https://external-api.kalshi.com/trade-api/v2',P='https://gateway.polymarket.us/v1';
const pause=(ms:number)=>new Promise<void>(r=>setTimeout(r,Math.max(0,ms)));
type LiveEntry=WatchEntry&{pair:Pair;metadataAt:number;settlementStatus:SettlementStatus;ticks:Record<Venue,number>};
async function refresh(e:WatchEntry):Promise<LiveEntry>{
  const [kr,pr,sr]=await Promise.all([getJSON(`${K}/markets/${encodeURIComponent(e.pair.a.id)}`),
    getJSON(`${P}/market/slug/${encodeURIComponent(e.pair.b.id)}`),
    getJSON(`${K}/series/${encodeURIComponent(e.pair.a.series!)}`)]);
  const km=kr.market,pm=pr.market??pr,series=sr.series;
  if(km?.ticker!==e.pair.a.id||pm.slug!==e.pair.b.id||series?.ticker!==e.pair.a.series)throw Error('MARKET_IDENTITY_CHANGED');
  const [event,exchange]=await Promise.all([getJSON(`${K}/events/${encodeURIComponent(km.event_ticker)}`),getJSON(`${K}/exchange/status`)]);
  if(km.fee_waiver_expiration_time||event.event?.fee_type_override!=null||event.event?.fee_multiplier_override!=null)throw Error('UNREVIEWED_FEE_OVERRIDE');
  if(exchange.trading_active!==true||exchange.exchange_active!==true)throw Error('KALSHI_EXCHANGE_NOT_ACTIVE');
  for(const data of [km,pm,event.event])for(const [key,value] of Object.entries(data??{}))
    if(/^(is_?)?(disputed|cancelled|canceled|postponed|suspended|voided|amended)$/i.test(key)&&value===true)throw Error('EXCEPTION_INDICATED');
  const [a,b]=await Promise.all([normalizeKalshi(km,series),normalizePoly(pm)]);
  if(a.hash!==e.pair.a.hash||b.hash!==e.pair.b.hash)throw Error('PINNED_SETTLEMENT_METADATA_CHANGED');
  if(!a.open||!b.open||pm.ep3Status!=='OPEN'||pm.status!=='MARKET_STATUS_OPEN'||Date.parse(a.closeAt)<=Date.now())throw Error('MARKET_NOT_OPEN');
  if(a.feeRate===null||b.feeRate===null||a.exchangeIndex!==0)throw Error('FEE_OR_EXCHANGE_UNSUPPORTED');
  const settlement=practicalSettlement(e.family,e.proof);
  if(!settlement.ordinaryComplementary)throw Error('ORDINARY_SETTLEMENT_NOT_COMPLEMENTARY');
  const status:SettlementStatus=settlement.classification==='ECONOMICALLY_EQUIVALENT'?'ECONOMICALLY_EQUIVALENT':'BOUNDED_BASIS';
  const ranges=km.price_ranges,kalshiTick=km.price_level_structure==='linear_cent'&&ranges?.length===1&&ranges[0].step==='0.0100'?100:0;
  const polyTick=Math.round(Number(pm.orderPriceMinTickSize)*10000);
  return {...e,pair:{...e.pair,a,b},metadataAt:Date.now(),settlementStatus:status,
    ticks:{kalshi:kalshiTick,poly:Number.isSafeInteger(polyTick)&&polyTick>0?polyTick:0}};
}
function latest(feeds:Record<Venue,ConfirmationFeed>,e:LiveEntry,tracker:MarketStatusTracker):Record<Venue,StreamBook>|null{
  const k=feeds.kalshi.latest.get(e.pair.a.id)?.e.book,p=feeds.poly.latest.get(e.pair.b.id)?.e.book;
  if(!k||!p)return null;
  const healthy=(v:Venue)=>{const h=feeds[v].health();return h.connected&&h.clockOkay&&h.backlog===0;};
  const status=tracker.states.get(e.pair.a.id),kalshiOpen=!status?.knownNegative&&!status?.issues.size&&!tracker.faults.size;
  return {kalshi:{...k,open:k.open&&kalshiOpen,connection:healthy('kalshi')?'LIVE':'DISCONNECTED'},
    poly:healthy('poly')?p:{...p,connection:'DISCONNECTED'}};
}
export async function observeEvPaper(universePath:string,directory:string){
  const universeBytes=readFileSync(universePath),raw=JSON.parse(universeBytes.toString('utf8')) as {shards:WatchEntry[][];universe:number};
  if(!Array.isArray(raw.shards)||raw.shards.some(s=>s.length>livePaperWatchPolicy.maxRoutesPerShard))throw Error('INVALID_PINNED_UNIVERSE');
  if(raw.universe!==2852)throw Error('UNEXPECTED_NON_PMXT_UNIVERSE');
  mkdirSync(directory,{recursive:true,mode:0o700});
  const start=Date.now(),startMono=performance.now(),deadline=start+livePaperWatchPolicy.durationMs;
  const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
  const sourceHashes=Object.fromEntries(['worker/ev-paper-watch.ts','worker/ev-learning-ledger.ts',
    'lib/research/ev-arb.ts','lib/research/ev-paper.ts'].map(p=>[p,sha(readFileSync(resolve(new URL('..',import.meta.url).pathname,p)))]));
  writeFileSync(resolve(directory,'frozen.json'),JSON.stringify({startedAt:start,deadline,source:'PINNED_NON_PMXT_ROUTE_UNIVERSE',
    universeSha256:sha(universeBytes),sourceHashes,policy:livePaperWatchPolicy,ordersEnabled:false},null,2)+'\n',{flag:'wx',mode:0o600});
  const ledger=new EvLearningLedger(directory),funnel=emptyFunnel(),excluded:Record<string,number>={},attempted=new Set<string>();
  funnel.matchedCandidates=new Set(raw.shards.flat().map(e=>e.pair.id)).size;
  let stopped=false,reason='ORIGINAL_DEADLINE',shardIndex=0,primaryAttempts=0,active=false;
  const cash={kalshi:livePaperWatchPolicy.kalshiCapital,poly:livePaperWatchPolicy.pmUsCapital};
  const reconnects={kalshi:0,poly:0};
  const save=()=>ledger.writeFunnel(funnel,{phase:stopped?'STOPPED':'RUNNING',reason,startedAt:start,deadline,
    endedAt:stopped?Date.now():null,shardIndex,primaryAttempts,cash,exclusions:excluded,reconnects,
    report:learningReport(ledgerAttempts, funnel)});
  const ledgerAttempts:ReturnType<typeof simulatePaperAttempt>[]=[];
  const deadlineReached=()=>performance.now()-startMono>=livePaperWatchPolicy.durationMs||Date.now()>=deadline;
  const signal=()=>{stopped=true;reason='EXTERNAL_STOP';};process.once('SIGINT',signal);process.once('SIGTERM',signal);
  const timer=setInterval(()=>{if(deadlineReached()){stopped=true;reason='ORIGINAL_DEADLINE';}save();},livePaperWatchPolicy.heartbeatMs);
  try{
    while(!stopped&&!deadlineReached()){
      const shard=raw.shards[shardIndex%raw.shards.length];let cursor=0;const entries:LiveEntry[]=[];
      await Promise.all(Array.from({length:4},async()=>{while(cursor<shard.length&&!stopped){const e=shard[cursor++];
        try{entries.push(await refresh(e));}catch(error){const key=(error as Error).message;excluded[key]=(excluded[key]??0)+1;}}}));
      if(!entries.length){shardIndex++;continue;}
      const ids=(v:Venue)=>[...new Set(entries.map(e=>v==='kalshi'?e.pair.a.id:e.pair.b.id))];
      const tracker=new MarketStatusTracker(ids('kalshi'));
      const feeds:Record<Venue,ConfirmationFeed>={kalshi:new ConfirmationFeed('kalshi',ids('kalshi'),()=>{},
        {extraSubscriptions:[lifecycleSubscription],onMessage:(m,at,mono)=>tracker.receive(m,at,mono),onInvalid:r=>tracker.invalidate(r)}),
        poly:new ConfirmationFeed('poly',ids('poly'))};
      for(const f of Object.values(feeds))f.start();
      let feedFault=false;
      try{
        await Promise.all(Object.values(feeds).map(f=>f.ready(10_000).catch(()=>{})));
        const shardEnd=Math.min(deadline,Date.now()+livePaperWatchPolicy.shardDwellMs);
        while(!stopped&&Date.now()<shardEnd&&!deadlineReached()){
          if(!Object.values(feeds).every(f=>f.health().connected))break;
          const selected:{e:LiveEntry;q:ArbEvaluation;books:Record<Venue,StreamBook>}[]=[];
          for(const e of entries){
            if(Date.now()-e.metadataAt>livePaperWatchPolicy.metadataMaxAgeMs)continue;
            const books=latest(feeds,e,tracker);if(!books)continue;
            for(const side of ['yes','no'] as const){
              const q=evaluateEvArb(e.pair,books,side,1,Date.now(),e.settlementStatus,livePaperWatchPolicy,
                e.ticks,e.family.divergences.map(d=>d.id));
              const ev=['kalshi','poly'].some(v=>empiricalEvForCandidate(q,ledgerAttempts,v as Venue).status==='EXECUTION_EV_POSITIVE');
              observeFunnel(funnel,q,ev);
              const key=e.pair.id+'|'+side;
              if(q.economicStatus!=='REALISTIC_NET_POSITIVE'){attempted.delete(key);continue;}
              if(q.execution.paperEligible&&!attempted.has(key)){
                const kCost=q.kalshi!.cost+(q.estimatedFees??0),pCost=q.poly!.cost+(q.estimatedFees??0);
                if(kCost>cash.kalshi||pCost>cash.poly){excluded.BANKROLL_UNAVAILABLE=(excluded.BANKROLL_UNAVAILABLE??0)+1;continue;}
                selected.push({e,q,books});
              }
            }
          }
          if(selected.length&&!active&&primaryAttempts<livePaperWatchPolicy.maxPrimaryAttempts){
            selected.sort((a,b)=>b.q.estimatedNetProfit!-a.q.estimatedNetProfit!);
            const {e,q,books}=selected[0],key=e.pair.id+'|'+q.kalshiSide;attempted.add(key);active=true;
            try{
              let first:Venue=primaryAttempts%2===0?'kalshi':'poly';
              if(q[first]!.cost>livePaperWatchPolicy.maxOneSidedExposure)first=first==='kalshi'?'poly':'kalshi';
              const alternate:Venue=first==='kalshi'?'poly':'kalshi';
              await pause(livePaperWatchPolicy.entryDelayMs);const entry=latest(feeds,e,tracker);
    if(!entry)continue;
              const at=Date.now();await pause(livePaperWatchPolicy.hedgeDelayMs);const future=latest(feeds,e,tracker);
              if(!future)continue;
              for(const book of [books.kalshi,books.poly,entry.kalshi,entry.poly,future.kalshi,future.poly])ledger.appendBook(book);
              const delay=Date.now()-at;
              const options=[simulatePaperAttempt(e.pair,q,entry,future,first,delay,at,livePaperWatchPolicy,'PRIMARY'),
                simulatePaperAttempt(e.pair,q,entry,future,alternate,delay,at,livePaperWatchPolicy,'COUNTERFACTUAL')];
              for(const a of options){ledger.appendAttempt(a);ledgerAttempts.push(a);}
              const primary=options[0];if(!primary.finalState.startsWith('REJECTED_')){
                primaryAttempts++;
                if(primary.firstLegSimulatedFill){cash[first]-=primary.firstLegSimulatedFill.cost+primary.firstLegFee;
                  if(primary.secondLegSimulatedFill)cash[alternate]-=primary.secondLegSimulatedFill.cost+primary.secondLegFee;
                  else cash[first]+=primary.unwindProceeds-primary.unwindFee;}
              }
              const realizedLosses=ledgerAttempts.filter(a=>a.attemptRole==='PRIMARY'&&a.finalState!=='CLEAN_PAIRED_FILL')
                .reduce((n,a)=>n+Math.max(0,-a.paperPnL),0);
              if(realizedLosses>=livePaperWatchPolicy.dailyRealizedLossStop){stopped=true;reason='DAILY_SIMULATED_LOSS_STOP';}
            }finally{active=false;save();}
          }
          await pause(livePaperWatchPolicy.sampleMs);
        }
      }finally{feedFault=!Object.values(feeds).every(f=>f.health().connected);for(const f of Object.values(feeds))f.stop();}
      for(const v of ['kalshi','poly'] as const)if(feedFault&&feeds[v].failures.length){reconnects[v]++;
        if(reconnects[v]>livePaperWatchPolicy.maxReconnectsPerVenue){stopped=true;reason='FEED_RECONNECT_LIMIT';}}
      shardIndex++;
    }
    if(deadlineReached()){stopped=true;reason='ORIGINAL_DEADLINE';}
  }catch(error){stopped=true;reason='OBSERVATION_FAILURE:'+String((error as Error).message);throw error;}
  finally{clearInterval(timer);process.off('SIGINT',signal);process.off('SIGTERM',signal);stopped=true;save();ledger.close();}
  return {reason,funnel,report:learningReport(ledgerAttempts,funnel),cash};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [universe,directory,env]=process.argv.slice(2);
  if(!universe||!directory||!env)throw Error('Usage: npm run research:ev-watch -- PINNED_UNIVERSE_JSON NEW_OUTPUT_DIR READ_ONLY_ENV_FILE');
  process.loadEnvFile(resolve(env));const result=await observeEvPaper(resolve(universe),resolve(directory));
  console.log(JSON.stringify(result,null,2));
}
