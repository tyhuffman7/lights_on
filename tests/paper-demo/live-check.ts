// One fixed four-pair, 60-second read-only checkpoint. Uses the existing observer.
// Raw public evidence stays local; no account endpoints or order transport.
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {ResearchStore} from '../../lib/research/store.ts';
import {Observer} from '../../worker/observer.ts';
import {configSchema,lease} from '../../worker/config.ts';
import {book} from '../../lib/arb/adapters.ts';
import {fresh} from '../../lib/research/books.ts';
import {fill} from '../../lib/research/detector.ts';
import {feeSchedule} from '../../lib/research/fees.ts';
import {assess} from '../../lib/arb/engine.ts';
import {initial} from '../../lib/arb/ledger.ts';
import type {Book,Market} from '../../lib/arb/types.ts';
const ids=[
 ['KXPRESNOMD-28-GN','enwc-uspres-nom-dem-2028-gavnew'],
 ['KXPRESNOMD-28-REMA','enwc-uspres-nom-dem-2028-rahema'],
 ['KXAOCRUN-28-27JAN01','cranc-uspres28-12-31-2026-aleoca'],
 ['KX1ALBUM-26DEC-YOU','ccpc-bilbrd-1album-any2026-youaga'],
];
const output=process.argv[2];if(!output||existsSync(output))throw Error('Pass a new output directory; existing evidence is never overwritten');
mkdirSync(output,{recursive:true});
if(existsSync('.env.research'))process.loadEnvFile('.env.research');
const startedAt=Date.now(),deadline=startedAt+150000,raw:any[]=[],samples:any[]=[],confirmations:any[]=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async (input,options)=>{
 const url=String(input),at=Date.now();
 const response=await originalFetch(input,{...options,signal:AbortSignal.any([options?.signal||new AbortController().signal,AbortSignal.timeout(Math.max(1,deadline-Date.now()))])});
 if(/^https:\/\/(external-api\.kalshi\.com|gateway\.polymarket\.us)\//.test(url)){
  const text=await response.clone().text();
  raw.push({url,requestAt:at,receivedAt:Date.now(),status:response.status,body:JSON.parse(text)});
 }
 return response;
};
const path=output+'/observer.sqlite',release=lease(path),store=new ResearchStore(path);
const observer=new Observer(store,configSchema.parse({database:path,discoveryEnabled:false,
 markets:ids.map(([kalshi,poly])=>({kalshi,poly})),maxSubscribedMarketsPerVenue:4}));
const report:any={provenance:'CURRENT LIVE DATA; UNAPPROVED RESEARCH ONLY',startedAt,
 requestedStreamSeconds:60,approvedPairs:0,paperEntries:0,realOrders:0,realFills:0,realizedBotProfit:0,
 ruleBlockers:['Nomination end-date meaning unresolved (2 pairs)','AOC legal issuance/start window unresolved','YoungBoy Never Broke Again issuance, intervening chart history, artist credit and revision/delay clauses unresolved'],
 rawEvidence:'raw-public.json',normalizedEvidence:'confirmations.json',strictEvidence:'strict-samples.json',
 interpretations:['REST responses are non-atomic and are not fills.','Strict stream ages are never rewritten.','Whole-contract modeled fees are not certified live fractional-fill fee bounds.','Research one-contract model uses 25% of displayed depth and $0.01 reserve; existing challenge uses its unchanged $0.02 reserve and 30-day horizon.']};
let timer:ReturnType<typeof setInterval>|undefined;
function snapshot(){
 const wall=Date.now(),mono=performance.now();
 for(const m of observer.registry.list())for(const market of [m.pair.a,m.pair.b]){
  const b=observer.cache.get(market.venue,market.id),connection=observer.marketStreams.get(market.venue+':'+market.id);
  samples.push({wall,pairId:m.id,venue:market.venue,marketId:market.id,
   mappingStatus:m.status,streamHealthy:connection?.isHealthy()??false,
   strictFresh:fresh(b,mono,wall,2000),valid:b?.valid??false,source:b?.source??null,
   sequence:b?.sequence??null,lastBookUpdateAt:b?.receivedAt??null,
   bookAgeMs:b?mono-b.receivedMono:null,exchangeAt:b?.exchangeAt??null,
   exchangeAgeMs:b?.exchangeAt?wall-b.exchangeAt:null});
 }
}
async function confirm(){
 for(const mapping of observer.registry.list()){
  const pair=mapping.pair,books:Book[]=[],legs:any[]=[];
  for(const m of [pair.a,pair.b]){
   const before=observer.cache.get(m.venue,m.id),at=Date.now();
   try{
    const rest=await book(m),after=observer.cache.get(m.venue,m.id),now=Date.now();books.push(rest);
    const levels=(b:Book)=>JSON.stringify([b.yes,b.no].map(ls=>[...ls].sort((a,b)=>a.price-b.price)));
    legs.push({venue:m.venue,marketId:m.id,requestAt:at,receivedAt:now,rest,
     stream:after??null,raced:before!==after,equalDepth:before===after&&!!after&&levels(rest)===levels(after),
     strictFresh:fresh(after,performance.now(),now,2000),streamHealthy:observer.marketStreams.get(m.venue+':'+m.id)?.isHealthy()??false});
   }catch(e){legs.push({venue:m.venue,marketId:m.id,error:String(e)});}
  }
  const quotes:any[]=[];
  if(books.length===2){for(const side of ['yes','no'] as const){
   const other=side==='yes'?'no':'yes';
   const model=(b:Book,m:Market,s:'yes'|'no')=>{const fee=feeSchedule(m);return fee?fill(b[s].map(l=>({...l,quantity:Math.floor(l.quantity*.25)})),1,fee):null;};
   const a=model(books[0],pair.a,side),b=model(books[1],pair.b,other);
   quotes.push({side,other,quantity:1,a,b,netUSD:a&&b?(10000-a.cost-b.cost-a.feeUpper-b.feeUpper-100)/10000:null,
    reason:!a||!b?'Insufficient whole-contract depth after haircut or unknown fees':'Conditional research model only; mapping unapproved'});
  }}
  const s=initial(),q=books.length===2?assess({...pair,reviewed:false},books[0],books[1],s.settings,s.cash):null;
  confirmations.push({pairId:pair.id,at:Date.now(),metadata:{a:pair.a,b:pair.b},mappingStatus:mapping.status,
   legs,quotes,paperEligible:q?.eligible??false,paperReasons:q?.reasons??['Missing depth, fee/minimum metadata or available size']});
 }
}
try{
 await observer.initialize();observer.resume();const began=Date.now();report.streamStartedAt=began;
 timer=setInterval(snapshot,1000);
 await new Promise(r=>setTimeout(r,15000));await confirm();
 const remaining=began+45000-Date.now();if(remaining>0)await new Promise(r=>setTimeout(r,remaining));
 if(Date.now()<began+55000)await confirm();
 const tail=began+60000-Date.now();if(tail>0)await new Promise(r=>setTimeout(r,tail));
 report.beforeStop=observer.health();
}catch(e){report.error=String(e);}finally{
 if(timer)clearInterval(timer);await observer.stop();store.close();release();globalThis.fetch=originalFetch;
 report.endedAt=Date.now();report.elapsedSeconds=(report.endedAt-startedAt)/1000;
 const count=(f:(x:any)=>boolean)=>samples.filter(f).length;
 report.sampleCounts={total:samples.length,strictFresh:count(x=>x.strictFresh),healthy:count(x=>x.streamHealthy),
 validHealthyButNotStrictFresh:count(x=>x.valid&&x.streamHealthy&&!x.strictFresh),missingBook:count(x=>x.lastBookUpdateAt===null)};
 const legs=confirmations.flatMap(x=>x.legs),quotes=confirmations.flatMap(x=>x.quotes);
 report.confirmationCounts={pairSnapshots:confirmations.length,legSnapshots:legs.length,
  equalDepthWithoutRace:legs.filter(x=>x.equalDepth).length,
  equalDepthHealthyButStrictStale:legs.filter(x=>x.equalDepth&&x.streamHealthy&&!x.strictFresh).length,
  errors:legs.filter(x=>x.error).length,positiveConditionalModels:quotes.filter(x=>x.netUSD>0).length,
  nonpositiveModels:quotes.filter(x=>x.netUSD!==null&&x.netUSD<=0).length,
  insufficientDepthOrUnknownFee:quotes.filter(x=>x.netUSD===null).length};
 report.paperRejectionCounts=Object.fromEntries([...new Set(confirmations.flatMap(x=>x.paperReasons))].map(reason=>[reason,confirmations.filter(x=>x.paperReasons.includes(reason)).length]));
 for(const [name,data] of [['raw-public',raw],['strict-samples',samples],['confirmations',confirmations],['report',report]] as const)
  writeFileSync(output+'/'+name+'.json',JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({output,elapsedSeconds:report.elapsedSeconds,error:report.error,sampleCounts:report.sampleCounts,confirmationCounts:report.confirmationCounts,paperRejectionCounts:report.paperRejectionCounts},null,2));
}
