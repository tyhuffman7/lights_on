import {appendFileSync,existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {catalog} from './coverage.ts';
import {discoverCandidates} from '../lib/research/matching.ts';
import {BookCache} from '../lib/research/books.ts';
import {StreamConnection,authHeaders} from './streams.ts';
import {screenPolicy,selectRoutes,screenPair,review,category,labels} from '../lib/screen/executable.ts';
import type {Pair,Venue} from '../lib/arb/types.ts';
const digest=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
const save=(dir:string,name:string,value:unknown)=>{writeFileSync(resolve(dir,name+'.tmp'),JSON.stringify(value,null,2)+'\n');renameSync(resolve(dir,name+'.tmp'),resolve(dir,name));};
export function sourceManifest(root:string){
 const result:Record<string,string>={};
 const visit=(folder:string)=>{for(const e of readdirSync(folder,{withFileTypes:true})){const p=resolve(folder,e.name);if(e.isDirectory())visit(p);else if(/\.(ts|mjs)$/.test(p))result[relative(root,p)]=digest(readFileSync(p));}};
 for(const d of ['lib','worker'])visit(resolve(root,d));
 for(const p of ['scripts/screen-supervisor.mjs','scripts/executable-screen-launch.mjs'])result[p]=digest(readFileSync(resolve(root,p)));
 return result;
}
export async function prepare(dir:string,root:string){
 mkdirSync(dir,{recursive:true});
 if(existsSync(resolve(dir,'frozen.json')))throw Error('Frozen screen already exists; use a new directory only with a newly authorized checkpoint');
 const data=await catalog(undefined,undefined,p=>console.log(JSON.stringify({phase:'CATALOG',...p})));
 const matched=discoverCandidates(data.kalshi,data.poly),at=Date.now();
 const selection=selectRoutes(matched.candidates,at);
 const counts:Record<string,{matched:number,selected:number}>={};
 for(const c of matched.candidates){const k=category(c.pair);counts[k]??={matched:0,selected:0};counts[k].matched++;}
 for(const c of selection.selected)counts[category(c.pair)].selected++;
 const manifest=sourceManifest(root);
 const frozen={at,policy:screenPolicy,manifest,selection:selection.selected.map(c=>({pair:c.pair,assessment:review(c.pair),matchingReasons:c.reasons,labels:labels(c.pair,at)})),subscriptions:selection.subscriptions};
 save(dir,'frozen.json',frozen);
 save(dir,'coverage.json',{at,catalogAt:data.at,catalogComplete:data.complete,catalogErrors:data.errors,
   counts,listing:{kalshi:data.kalshi.length,poly:data.poly.length},matchingDiagnostics:matched.diagnostics,
   matched:matched.candidates.length,selected:selection.selected.length,subscriptions:selection.subscriptions,
   omitted:selection.omitted,capReason:'60 routes bounds 1 Hz evaluation and at most 60 markets/venue (one <=100-market subscription per venue). Category round-robin; whole PM bundles retained; no prices used in selection. Same-day is a rank, not a filter. No catalog refresh during this fixed 30-minute observation.',
   reviewCounts:Object.fromEntries(['REVIEWED_PAIR','CONDITIONAL_PAIR','UNVERIFIED_PRICE_COMPARISON'].map(k=>[k,frozen.selection.filter(c=>c.assessment.classification===k).length]))});
 console.log(JSON.stringify({phase:'PREPARED',catalogComplete:data.complete,matched:matched.candidates.length,selected:selection.selected.length,counts}));
}
export async function observe(dir:string,root:string){
 const frozenPath=resolve(dir,'frozen.json'),frozen=JSON.parse(readFileSync(frozenPath,'utf8'));
 if(existsSync(resolve(dir,'started.json')))throw Error('Single-use capture; automatic restart forbidden');
 if(JSON.stringify(frozen.policy)!==JSON.stringify(screenPolicy))throw Error('Frozen policy mismatch');
 if(JSON.stringify(frozen.manifest)!==JSON.stringify(sourceManifest(root)))throw Error('Executed source differs from frozen manifest');
 if(Date.now()-frozen.at>600000)throw Error('Preparation older than ten minutes');
 if(!frozen.selection.length)throw Error('NO_MATCHED_ROUTES: collection cannot represent empty data as no opportunity');
 // Validate before starting: no private account/ledger APIs are imported or called.
 for(const venue of ['kalshi','poly'] as Venue[])authHeaders(venue);
 const startedAt=Date.now(),mono=performance.now();
 save(dir,'started.json',{startedAt,deadlineAt:startedAt+screenPolicy.durationMs,freezeSha256:digest(readFileSync(frozenPath)),orderDisabled:true});
 const caches={kalshi:new BookCache(),poly:new BookCache()};
 const connections:StreamConnection[]=[];
 const seen=new Set<string>(),failures:Record<string,number>={};
 const best=new Map<string,any>(),bestFresh=new Map<string,any>();
 const missing:Record<string,number>={},rejections:Record<string,number>={};
 let samples=0,rows=0,withEconomics=0,executable=0,stopped=false;
 const record=(kind:string,body:unknown)=>appendFileSync(resolve(dir,'evidence.ndjson'),JSON.stringify({kind,at:Date.now(),body})+'\n');
 const evaluate=()=>{
  const at=Date.now();samples++;
  for(const entry of frozen.selection as {pair:Pair;assessment:ReturnType<typeof review>}[]){
   const a=caches.kalshi.get('kalshi',entry.pair.a.id),b=caches.poly.get('poly',entry.pair.b.id);
   for(const row of screenPair(entry.pair,a,b,at,entry.assessment)){
    rows++;if(row.economics)withEconomics++;if(row.displayedDepthExecutable)executable++;
    for(const r of row.dataReasons)missing[r]=(missing[r]??0)+1;
    for(const r of row.policyReasons)rejections[r]=(rejections[r]??0)+1;
    const key=[row.category,row.route,row.pairId,row.aSide].join('|');
    const consider=(map:Map<string,any>,prefix:string)=>{
     if(row.economics&&(!map.has(key)||row.economics.exchangeNetUnderFeeBound>map.get(key).economics.exchangeNetUnderFeeBound)){
      const books={kalshi:a,poly:b},sha=digest(JSON.stringify(books));
      record('CANDIDATE_BOOK_EVIDENCE',{sha256:sha,books});
      map.set(key,{...row,evidence:{file:'evidence.ndjson',bookSha256:sha},title:entry.pair.a.title,kalshiId:entry.pair.a.id,polyId:entry.pair.b.id});
      record(prefix,map.get(key));
     }
    };
    consider(best,'BEST_DISPLAYED');if(row.dataReasons.length===0)consider(bestFresh,'BEST_FRESH');
   }
  }
 };
 const summary=(endedAt?:number)=>({scope:screenPolicy.scope,startedAt,endedAt:endedAt??null,
   durationMs:endedAt?endedAt-startedAt:Date.now()-startedAt,phase:endedAt?'STOPPED':'RUNNING',samples,rows,withEconomics,executable,
   routes:frozen.selection.length,uniqueBooksSeen:seen.size,expectedUniqueBooks:frozen.subscriptions.kalshi.length+frozen.subscriptions.poly.length,
   neverReceived:{kalshi:frozen.subscriptions.kalshi.filter((id:string)=>!seen.has('kalshi:'+id)),poly:frozen.subscriptions.poly.filter((id:string)=>!seen.has('poly:'+id))},
   failures,dataRejections:missing,policyRejections:rejections,
   bestDisplayed:[...best.values()],bestFresh:[...bestFresh.values()],
   note:'Displayed economics may be stale; bestFresh has all timestamp/data gates clear. Neither is an actual fill, paired atomic execution, or settlement proof. Missing books are a coverage failure, never zero opportunity.'});
 let interval:ReturnType<typeof setInterval>,heartbeat:ReturnType<typeof setInterval>,deadline:ReturnType<typeof setTimeout>;
 const stop=()=>{if(stopped)return;stopped=true;clearInterval(interval);clearInterval(heartbeat);clearTimeout(deadline);for(const c of connections)c.stop();save(dir,'summary.json',summary(Date.now()));console.log(JSON.stringify({mode:'live-data',message:'SCREEN_STOPPED',samples,rows,withEconomics,executable}));};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 for(const venue of ['kalshi','poly'] as Venue[]){
  const ids=frozen.subscriptions[venue];
  if(!ids.length)continue;
  const stream=new StreamConnection({venue,ids,headers:()=>authHeaders(venue),
   onInvalid:reason=>{caches[venue].invalidate(venue);failures[venue+':'+reason]=(failures[venue+':'+reason]??0)+1;record('FEED_INVALID',{venue,reason});
    // Stop this failed connection, with no automatic restart/reconnect.
    // Deferring covers StreamConnection's auth-error timer assignment too.
    queueMicrotask(()=>stream.stop());},
   onDiagnostic:(kind,body)=>{if(!['DISCONNECT_DETAIL'].includes(kind))record(kind,body);},
   onMessage:(message,wall,receivedMono)=>{const b=venue==='kalshi'?caches[venue].kalshi(message,wall,receivedMono):caches[venue].poly(message,wall,receivedMono);if(b){if(!ids.includes(b.marketId))throw Error('Unsubscribed market');seen.add(venue+':'+b.marketId);}}
  });connections.push(stream);stream.start();
 }
 interval=setInterval(evaluate,screenPolicy.sampleMs);
 heartbeat=setInterval(()=>{save(dir,'summary.json',summary());console.log(JSON.stringify({mode:'live-data',orderDisabled:true,samples,rows,withEconomics,executable,uniqueBooksSeen:seen.size,failures,elapsedMs:performance.now()-mono}));},10000);
 deadline=setTimeout(stop,screenPolicy.durationMs);
 console.log(JSON.stringify({mode:'live-data',orderDisabled:true,startedAt,routes:frozen.selection.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [command,path,envFile]=process.argv.slice(2);if(!path||!['prepare','observe'].includes(command))throw Error('Usage: executable-screen.ts prepare|observe OUTPUT_DIRECTORY [ENV_FILE]');
 if(envFile)process.loadEnvFile(envFile);
 const root=resolve(new URL('..',import.meta.url).pathname);
 if(command==='prepare')await prepare(resolve(path),root);else await observe(resolve(path),root);
}
