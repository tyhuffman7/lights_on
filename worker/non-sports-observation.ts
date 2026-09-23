// A public GET-only observation worker. No strategy, account, order, database,
// settlement or ledger interface is imported or opened.
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {normalizeBook} from '../lib/arb/adapters.ts';
import {nonSportsFamily} from '../lib/research/non-sports.ts';
import {canonicalTemplate} from '../lib/research/canonical-template.ts';
import {EntityRegistry} from '../lib/research/entities.ts';
import {dispersionPolicy as policy,dispersionQuote,DispersionIntervals} from '../lib/research/dispersion.ts';
import type {Candidate} from '../lib/research/matching.ts';
import type {Market,Side} from '../lib/arb/types.ts';
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const pause=(ms:number)=>new Promise(r=>setTimeout(r,Math.max(0,ms)));
const family=(c:Candidate)=>nonSportsFamily(c.pair.a)??'sports';
const template=(c:Candidate)=>canonicalTemplate(c.pair.a,new EntityRegistry());
const subfamily=(c:Candidate)=>{const t=template(c);return t?[t.domain,t.family,t.metric,t.geography].join(':'):c.pair.a.series??'legacy';};
export function selectDispersionRoutes(candidates:Candidate[]){
 const groups=new Map<string,Candidate[]>();
 for(const c of candidates){let f=nonSportsFamily(c.pair.a);let group:string|undefined=f;
  if(!f&&c.pair.a.identity?.sports){const type=template(c)?.family??c.pair.a.identity.marketType;const s=c.pair.a.identity.competition+':'+type;if(policy.sportsStrata.includes(s))group='sports:'+s;}
  if(group)groups.set(group,[...(groups.get(group)??[]),c]);
 }
 const chosen:Candidate[]=[];
 for(const [group,rows] of [...groups].sort(([a],[b])=>a.localeCompare(b))){const strata=new Map<string,Candidate[]>();
  for(const c of rows)strata.set(subfamily(c),[...(strata.get(subfamily(c))??[]),c]);
  for(const rows of strata.values())rows.sort((a,b)=>sha(a.pair.id).localeCompare(sha(b.pair.id)));
  const seen=new Set<string>(),selected:Candidate[]=[],cap=group.startsWith('sports:')?policy.sportsPerStratum:policy.perFamily;
  while(selected.length<cap&&[...strata.values()].some(a=>a.length))for(const [,rows] of [...strata].sort(([a],[b])=>a.localeCompare(b))){const c=rows.shift();if(c&&!seen.has(c.pair.b.id)&&selected.length<cap){selected.push(c);seen.add(c.pair.b.id);}}
  chosen.push(...selected);
 }
 return chosen;
}
export function freezeStudy(candidatesPath:string,dir:string){
 if(existsSync(resolve(dir,'freeze.json')))throw Error('Existing freeze; do not overwrite');
 const raw=readFileSync(candidatesPath),candidates=JSON.parse(raw.toString()) as Candidate[];
 const selected=selectDispersionRoutes(candidates),codeFiles=['worker/non-sports-observation.ts','lib/research/dispersion.ts','lib/research/non-sports.ts','lib/research/canonical-template.ts','lib/research/matching.ts','lib/research/fees.ts','lib/arb/adapters.ts'];
 const codeHashes=Object.fromEntries(codeFiles.map(p=>[p,sha(readFileSync(p))]));
 const freeze={at:Date.now(),policy,candidateSha256:sha(raw),codeHashes,selected};mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'freeze.json'),JSON.stringify(freeze,null,2)+'\n');
 console.log(JSON.stringify({frozen:selected.length,families:selected.reduce((o,c)=>(o[family(c)]=(o[family(c)]??0)+1,o),{} as Record<string,number>),policy}));return freeze;
}
export async function observeStudy(dir:string){
 const freezeRaw=readFileSync(resolve(dir,'freeze.json')),freeze=JSON.parse(freezeRaw.toString()) as ReturnType<typeof freezeStudy>;
 if(JSON.stringify(freeze.policy)!==JSON.stringify(policy))throw Error('Policy differs from frozen policy');
 for(const [p,h] of Object.entries(freeze.codeHashes))if(sha(readFileSync(p))!==h)throw Error('Frozen code changed: '+p);
 const start=resolve(dir,'started.json');if(existsSync(start))throw Error('One study only; prior start receipt exists');
 const startedAt=Date.now(),startedMono=performance.now(),deadline=startedMono+policy.durationMs,intervals=new DispersionIntervals();let requests=0,confirmations=0,rounds=0,lastRequestMono=-Infinity;
 writeFileSync(start,JSON.stringify({startedAt,freezeSha256:sha(freezeRaw),ordersEnabled:false,ledgerAccess:false})+'\n');
 const record=(type:string,body:unknown)=>appendFileSync(resolve(dir,'observations.jsonl'),JSON.stringify({type,body})+'\n');
 const request=async(m:Market)=>{
  if(++requests>policy.maxRequests||performance.now()>=deadline)throw Error('STUDY_BOUND');
  const url=m.venue==='kalshi'?`https://external-api.kalshi.com/trade-api/v2/markets/${encodeURIComponent(m.id)}/orderbook?depth=25`:`https://gateway.polymarket.us/v1/markets/${encodeURIComponent(m.id)}/book`;
  const requestAt=Date.now(),requestMono=performance.now();
  const response=await fetch(url,{method:'GET',headers:{accept:'application/json','cache-control':'no-cache, no-store',pragma:'no-cache'},cache:'no-store',signal:AbortSignal.timeout(Math.floor(Math.min(policy.requestTimeoutMs,Math.max(1,deadline-performance.now()))))});
  const raw=await response.text(),responseAt=Date.now(),responseMono=performance.now();
  const headers=Object.fromEntries([...response.headers].filter(([k])=>['date','age','cache-control','cf-cache-status','x-cache'].includes(k)));
  record('PUBLIC_RESPONSE',{venue:m.venue,marketId:m.id,requestAt,requestMono,responseAt,responseMono,status:response.status,headers,bodySha256:sha(raw),body:raw});
  if(!response.ok)throw Error('HTTP_'+response.status);
  const book=normalizeBook(m.venue,JSON.parse(raw),responseAt);return {book,headers,requestAt,requestMono,responseAt,responseMono};
 };
 const sample=async(c:Candidate,kind:string)=>{
  await pause(lastRequestMono+policy.requestSpacingMs-performance.now());lastRequestMono=performance.now();
  const results=await Promise.allSettled([request(c.pair.a),request(c.pair.b)]),at=Date.now(),mono=performance.now();
  const a=results[0].status==='fulfilled'?results[0].value:null,b=results[1].status==='fulfilled'?results[1].value:null;
  const reasons:string[]=results.flatMap(r=>r.status==='rejected'?[String(r.reason?.message??'REQUEST_FAILED')]:[]);
  if(Math.abs((at-startedAt)-(mono-startedMono))>1000)reasons.push('CLOCK_DISCONTINUITY');
  if(a&&b){if(!a.book.open||!b.book.open)reasons.push('BOOK_CLOSED');if(Math.abs(a.responseMono-b.responseMono)>policy.maxReceiptSkewMs)reasons.push('RESPONSE_SKEW');if(mono-Math.min(a.requestMono,b.requestMono)>policy.maxReceiptAgeMs)reasons.push('REQUEST_WINDOW_EXPIRED');
   for(const e of [a,b]){if(e.book.exchangeAt!==null&&e.book.exchangeAt>at+1000)reasons.push('EXCHANGE_CLOCK_AHEAD');if(Number(e.headers.age)>0||/\bHIT\b/i.test((e.headers['cf-cache-status']??'')+' '+(e.headers['x-cache']??'')))reasons.push('CACHED_RESPONSE');}}
  const simultaneous=a&&b&&reasons.length===0;
  const quotes=simultaneous?(['yes','no'] as Side[]).flatMap(side=>Array.from({length:policy.maxContracts},(_,i)=>dispersionQuote(c.pair,a.book,b.book,side,i+1)).filter(q=>q!==null)):[];
  const strictReasons=[...reasons,'REST_HAS_NO_SEQUENCED_REQUESTED_WS_PROOF'];
  if(a?.book.exchangeAt===null)strictReasons.push('KALSHI_EXCHANGE_TIME_UNKNOWN');if(b?.book.exchangeAt===null)strictReasons.push('PM_EXCHANGE_TIME_UNKNOWN');
  for(const [v,e] of [['KALSHI',a],['PM',b]] as const)if(e?.book.exchangeAt!==null&&e?.book.exchangeAt!==undefined&&at-e.book.exchangeAt>policy.maxReceiptAgeMs)strictReasons.push(v+'_EXCHANGE_TIME_OLD');
  const row={kind,round:rounds,pairId:c.pair.id,family:family(c),subfamily:subfamily(c),at,simultaneousResponse:!!simultaneous,usableDepth:quotes.length>0,strictExecutionEligible:false,strictReasons,reasons,quotes,
   timestamps:a&&b?{kalshiRequestAt:a.requestAt,kalshiResponseAt:a.responseAt,polyRequestAt:b.requestAt,polyResponseAt:b.responseAt,polyExchangeAt:b.book.exchangeAt}:null};record('SAMPLE',row);return row;
 };
 let stopReason='ROUND_LIMIT';
 try{for(rounds=1;rounds<=policy.maxRounds;rounds++){
   if(performance.now()>=deadline){stopReason='DEADLINE';break;}const roundStarted=performance.now();let usable=0,positive=0;
   for(const c of freeze.selected){if(performance.now()>=deadline||requests+2>policy.maxRequests){stopReason='FINITE_LIMIT';break;}
    const row=await sample(c,'scheduled');usable+=Number(row.usableDepth);positive+=Number(row.quotes.some(q=>q.feeNetSurplus>0));
    for(const side of ['yes','no'] as const){const qs=row.quotes.filter(q=>q.aSide===side),key=c.pair.id+':'+side;const opened=intervals.sample(key,row.at,row.simultaneousResponse?qs:null);
     if(opened&&confirmations<policy.maxConfirmations&&performance.now()+policy.confirmationDelayMs+policy.requestTimeoutMs<deadline){
      confirmations++;const original=qs.filter(q=>q.feeNetSurplus>0).sort((a,b)=>a.quantity-b.quantity)[0];await pause(policy.confirmationDelayMs);const confirm=await sample(c,'requested-rest-confirmation');
      const repriced=confirm.quotes.find(q=>q.aSide===side&&q.quantity===original.quantity);record('CONFIRMATION',{pairId:c.pair.id,family:family(c),at:confirm.at,originalQuantity:original.quantity,aSide:side,status:!confirm.simultaneousResponse||!repriced?'INCONCLUSIVE':repriced.feeNetSurplus>0?'DISPLAYED_EDGE_SURVIVED':'DISPLAYED_EDGE_DISAPPEARED',strictExecutionConfirmed:false});
      intervals.sample(key,confirm.at,confirm.simultaneousResponse?confirm.quotes.filter(q=>q.aSide===side):null);
     }
    }
   }
   console.log(JSON.stringify({phase:'ORDER_DISABLED_OBSERVATION',round:rounds,requests,usableRoutes:usable,positiveDisplayedRoutes:positive,confirmations,elapsedMs:Date.now()-startedAt}));
   if(stopReason!=='ROUND_LIMIT')break;if(rounds<policy.maxRounds)await pause(Math.min(roundStarted+policy.minRoundMs,deadline)-performance.now());
  }}finally{intervals.stop(Date.now());writeFileSync(resolve(dir,'intervals.json'),JSON.stringify(intervals.completed,null,2)+'\n');writeFileSync(resolve(dir,'receipt.json'),JSON.stringify({startedAt,endedAt:Date.now(),rounds:Math.min(rounds,policy.maxRounds),requests,confirmations,stopReason,ordersEnabled:false,ledgerAccess:false,freezeSha256:sha(freezeRaw)},null,2)+'\n');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [mode,a,b]=process.argv.slice(2);if(mode==='freeze'&&a&&b)freezeStudy(a,b);else if(mode==='observe'&&a)await observeStudy(a);else throw Error('Usage: non-sports-observation.ts freeze CANDIDATES DIR | observe DIR');}
