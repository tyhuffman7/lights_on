import {mkdirSync,writeFileSync,appendFileSync,existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {ConfirmationFeed,confirmPolyBook,publicConfirmationGet} from './book-confirmation-adapter.ts';
import {assessRestBook,content} from '../lib/screen/book-confirmation.ts';import {assessKalshiStatus} from '../lib/screen/http-confirmation.ts';
import {BookCache} from '../lib/research/books.ts';import {observeBook} from '../lib/screen/confirmation.ts';import type {SnapshotReceipt} from '../lib/screen/book-confirmation.ts';

export const controlPlan=Object.freeze({version:1,maxAttempts:20,plannedAttempts:12,warmupMs:60000,spacingMs:2000,hardDeadlineMs:120000,ordersEnabled:false,
 markets:[{venue:'kalshi',role:'active',id:'KXMLBGAME-26SEP211835TORBAL-TOR'},{venue:'kalshi',role:'quiet',id:'KXU3-26SEP-T3.7'},{venue:'poly',role:'active',id:'aec-mlb-tor-bal-2026-09-21'},{venue:'poly',role:'quiet',id:'urc-usunemp-sa-september-2026-10-02-gt3pt7pct'}] as const});
const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
function compact(r:SnapshotReceipt){const b=r.e.book;return {messageType:r.messageType,requestId:r.requestId??null,sid:r.sid??null,transactTime:r.transactTime??null,marketId:b.marketId,
 sequence:b.sequence,exchangeAt:b.exchangeAt,receiptAt:b.receivedAt,receiptMono:b.receivedMono,processingAt:r.e.processedAt,processingMono:r.e.processedMono,
 lastMarketChangeAt:r.e.lastMarketChangeAt,lastContentChangeReceiptAt:r.e.lastContentChangeReceiptAt,lastConfirmedSnapshotAt:r.e.lastConfirmedSnapshotAt,
 contentSha256:sha(content(b)),topYesBid:b.yesBids[0]??null,topNoBid:b.noBids[0]??null,open:b.open,valid:b.valid,faults:r.e.faults};}
export async function runControls(dir:string){
 mkdirSync(dir,{recursive:true});const startedFile=resolve(dir,'started.json');if(existsSync(startedFile))throw Error('Single-use control checkpoint; no automatic restart');
 const startedAt=Date.now(),attempts:any[]=[],results:any[]=[],rawFile=resolve(dir,'evidence.ndjson');
 const record=(kind:string,body:unknown)=>appendFileSync(rawFile,JSON.stringify({kind,at:Date.now(),body})+'\n');
 const sourceFiles=['lib/screen/confirmation.ts','lib/screen/book-confirmation.ts','lib/screen/http-confirmation.ts','worker/book-confirmation-adapter.ts','worker/confirmation-controls.ts','worker/streams.ts','lib/research/books.ts'];
 const source=Object.fromEntries(sourceFiles.map(p=>[p,sha(readFileSync(resolve(p),'utf8'))]));writeFileSync(startedFile,JSON.stringify({startedAt,plan:controlPlan,source,runtime:process.version},null,2));
 const consume=(venue:string,id:string,method:string)=>{if(attempts.length>=controlPlan.maxAttempts)throw Error('TARGETED_ATTEMPT_LIMIT');const a={number:attempts.length+1,venue,id,method,at:Date.now()};attempts.push(a);record('ATTEMPT',a);};
 const feeds={kalshi:new ConfirmationFeed('kalshi',controlPlan.markets.filter(x=>x.venue==='kalshi').map(x=>x.id),record),poly:new ConfirmationFeed('poly',controlPlan.markets.filter(x=>x.venue==='poly').map(x=>x.id),record)};
 let deadlineHit=false;const stop=()=>{for(const f of Object.values(feeds))f.stop();};const deadline=setTimeout(()=>{deadlineHit=true;stop();},controlPlan.hardDeadlineMs);
 process.once('SIGTERM',stop);process.once('SIGINT',stop);
 try{
  for(const c of controlPlan.markets)consume(c.venue,c.id,'INITIAL_STREAM_SUBSCRIPTION');
  for(const f of Object.values(feeds))f.start();await Promise.all(Object.values(feeds).map(f=>f.ready()));
  console.log(JSON.stringify({phase:'CONTROL_WARMUP',startedAt,markets:4,ordersEnabled:false}));await sleep(controlPlan.warmupMs);
  const activity=controlPlan.markets.map(c=>({...c,messages:feeds[c.venue].messages.get(c.id)??0,depthChanges:feeds[c.venue].changes.get(c.id)??0,baseline:feeds[c.venue].latest.get(c.id)?compact(feeds[c.venue].latest.get(c.id)!):null}));
  writeFileSync(resolve(dir,'activity.json'),JSON.stringify(activity,null,2));
  for(const c of controlPlan.markets){
   if(deadlineHit)throw Error('CONTROL_DEADLINE');await sleep(controlPlan.spacingMs);
   const feed=feeds[c.venue],before=feed.latest.get(c.id);consume(c.venue,c.id,c.venue==='kalshi'?'REQUESTED_WS_SNAPSHOT':'NEW_CORRELATED_WS_SUBSCRIPTION');
   let confirmation;
   try{confirmation=c.venue==='kalshi'?await feed.confirmKalshi(c.id):await confirmPolyBook(c.id,()=>feed.latest.get(c.id),()=>feed.health(),record);}
   catch{results.push({...c,bookConfirmed:false,reasons:['REQUEST_FAILED_OR_TIMED_OUT'],feedFailures:feed.failures});continue;}
   const summary:any={...c,request:confirmation.request,bookConfirmed:confirmation.accepted,reasons:confirmation.reasons,proof:confirmation.proof,
    response:compact(confirmation.response),selected:compact(confirmation.selected),confirmedAt:confirmation.confirmedAt,confirmedMono:confirmation.confirmedMono,
    before:before?compact(before):null,unchanged:before?content(before.e.book)===content(confirmation.response.e.book):null,
    health:feed.health(),marketState:confirmation.marketState,activity:activity.find(x=>x.id===c.id),tradingAuthorized:false,fillClaim:false};
   consume(c.venue,c.id,c.venue==='kalshi'?'PUBLIC_REST_MARKET_STATUS':'PUBLIC_REST_BOOK_COMPARISON');
   try{
    const url=c.venue==='kalshi'?'https://external-api.kalshi.com/trade-api/v2/markets/'+c.id:'https://gateway.polymarket.us/v1/markets/'+c.id+'/book';
    const http=await publicConfirmationGet(url,record);summary.http=http.evidence;
    if(c.venue==='kalshi'){summary.statusAssessment=assessKalshiStatus(c.id,http.data.market,http.evidence);
     if(http.data.market?.ticker!==c.id||http.data.market?.status!=='active'||Date.parse(http.data.market?.close_time)<=Date.now()){summary.bookConfirmed=false;summary.reasons.push('MARKET_CLOSED_OR_ID_MISMATCH');}
    }else{
     const b=new BookCache().poly(http.data,http.evidence.responseAt,http.evidence.responseMono);if(!b)throw Error('MISSING_REST_BOOK');
     const rest:SnapshotReceipt={e:observeBook({...b,source:'rest'},undefined,'rest',http.evidence.processedAt,http.evidence.processedMono),messageType:'marketData',transactTime:http.data.marketData.transactTime};
     const assessed=assessRestBook(rest,http.evidence,confirmation,feed.latest.get(c.id),feed.health());summary.rest={accepted:assessed.accepted,reasons:assessed.reasons,proof:assessed.proof,cache:assessed.http,receipt:compact(rest)};
    }
    if(http.evidence.status===429){summary.rateLimited=true;results.push(summary);break;}
   }catch{summary.restFailure='HTTP_OR_SCHEMA_FAILURE_NO_RETRY';}
   results.push(summary);record('CONTROL_RESULT',summary);console.log(JSON.stringify({phase:'CONTROL_RESULT',venue:c.venue,role:c.role,bookConfirmed:summary.bookConfirmed,reasons:summary.reasons}));
  }
 }catch{results.push({checkpointFailure:'CONTROL_SETUP_OR_DEADLINE_FAILURE',deadlineHit,feedFailures:Object.fromEntries(Object.entries(feeds).map(([v,f])=>[v,f.failures]))});}
 finally{clearTimeout(deadline);stop();process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);
  const endedAt=Date.now();const summary={scope:'FOUR_MARKET_ADAPTER_CONTROLS_NO_ECONOMICS',startedAt,endedAt,plan:controlPlan,source,attempts,attemptCount:attempts.length,results,ordersEnabled:false,fillClaim:false,rawEvidenceSha256:sha(readFileSync(rawFile,'utf8')),remainingLimit:controlPlan.maxAttempts-attempts.length};
  writeFileSync(resolve(dir,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({phase:'CONTROLS_STOPPED',attempts:attempts.length,results:results.length}));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(!process.argv[2]||!process.argv[3])throw Error('Usage: confirmation-controls.ts OUTPUT ENV_FILE');process.loadEnvFile(process.argv[3]);await runControls(resolve(process.argv[2]));}
