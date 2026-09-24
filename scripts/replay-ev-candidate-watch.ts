import {createReadStream,readFileSync,writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyCriticalEvidence} from '../worker/segmented-evidence.ts';
import {evaluateEvArb,type SettlementStatus} from '../lib/research/ev-arb.ts';
import {emptyFunnel,observeFunnel} from '../worker/ev-learning-ledger.ts';
import type {StreamBook} from '../lib/research/types.ts';
import type {Pair,Venue} from '../lib/arb/types.ts';

type Meta={at:number;pair:Pair;family:{divergences:unknown[]};fees:Record<Venue,{rate:number}>;ticks:Record<Venue,number>};
type RecordLine={payload:{at:number;kind:string;body:any}};
async function* lines(path:string){for await(const line of createInterface({input:createReadStream(path),crlfDelay:Infinity}))if(line)yield JSON.parse(line) as RecordLine;}
export async function replayRetainedEvidence(evidenceDir:string,output?:string){
  const manifest=JSON.parse(readFileSync(resolve(evidenceDir,'manifest.json'),'utf8')) as {closed:boolean;critical:{records:number;digest:string;bytes:number};retained:{file:string;digest:string;bytes:number}[]};
  if(!manifest.closed)throw Error('SOURCE_EVIDENCE_NOT_FINAL');
  const critical=verifyCriticalEvidence(resolve(evidenceDir,'critical.ndjson'));
  if(critical.records!==manifest.critical.records||critical.digest!==manifest.critical.digest||critical.bytes!==manifest.critical.bytes)throw Error('SOURCE_CRITICAL_CHAIN_CHANGED');
  for(const segment of manifest.retained){const raw=readFileSync(resolve(evidenceDir,segment.file));
    if(raw.length!==segment.bytes||createHash('sha256').update(raw).digest('hex')!==segment.digest)throw Error('SOURCE_RAW_SEGMENT_CHANGED');}
  const metaRows:Meta[]=[];
  for await(const row of lines(resolve(evidenceDir,'critical.ndjson')))
    if(row.payload.kind==='SHARD_METADATA')metaRows.push(row.payload.body.entry as Meta);
  metaRows.sort((a,b)=>a.at-b.at);
  const files=readdirSync(evidenceDir).filter(x=>/^raw-\d+\.ndjson$/.test(x)).sort();
  if(files.length!==manifest.retained.length||files.some((x,i)=>x!==manifest.retained[i].file))throw Error('SOURCE_RETENTION_MANIFEST_MISMATCH');
  const current=new Map<string,Meta>(),byMarket=new Map<string,Set<string>>(),books=new Map<string,StreamBook>();
  const funnel=emptyFunnel(),positiveRoutes=new Map<string,{gross:number;net:number;oldStressOnly:number}>();
  const positiveEpisodes=new Set<string>(),routeSets={gross:new Set<string>(),net:new Set<string>(),stressOnly:new Set<string>()};
  let pointer=0,firstAt:number|null=null,lastAt:number|null=null,bookEvents=0,pairedEvents=0;
  const activate=(meta:Meta)=>{current.set(meta.pair.id,meta);
    for(const m of [meta.pair.a,meta.pair.b]){let ids=byMarket.get(m.id);if(!ids){ids=new Set();byMarket.set(m.id,ids);}ids.add(meta.pair.id);}};
  for(const file of files)for await(const row of lines(resolve(evidenceDir,file))){
    const {at,kind,body}=row.payload;firstAt??=at;lastAt=at;
    while(pointer<metaRows.length&&metaRows[pointer].at<=at)activate(metaRows[pointer++]);
    if(kind!=='WS_BOOK')continue;
    const b=body?.body?.receipt?.e?.book as StreamBook|undefined;
    if(!b||!b.marketId||!['kalshi','poly'].includes(b.venue))continue;
    bookEvents++;books.set(`${b.venue}:${b.marketId}`,b);
    for(const id of byMarket.get(b.marketId)??[]){
      const m=current.get(id)!;if(at-m.at>180000)continue;
      const kalshi=books.get(`kalshi:${m.pair.a.id}`),poly=books.get(`poly:${m.pair.b.id}`);
      if(!kalshi||!poly||at-kalshi.receivedAt>5000||at-poly.receivedAt>5000)continue;
      pairedEvents++;const settlementStatus:SettlementStatus=m.family.divergences.length?'BOUNDED_BASIS':'ECONOMICALLY_EQUIVALENT';
      for(const side of ['yes','no'] as const){
        const e=evaluateEvArb(m.pair,{kalshi,poly},side,1,at,settlementStatus,undefined,
          m.ticks,m.family.divergences.map((d:any)=>String(d.id??'UNNAMED_DIVERGENCE')));
        observeFunnel(funnel,e);
        if(e.grossStatus!=='GROSS_ARB')continue;
        const route=m.pair.id+'|'+side;routeSets.gross.add(route);positiveEpisodes.add(`${route}|${Math.floor(at/1000)}`);
        const r=positiveRoutes.get(route)??{gross:0,net:0,oldStressOnly:0};r.gross++;
        if(e.economicStatus==='REALISTIC_NET_POSITIVE'){r.net++;routeSets.net.add(route);}
        if(e.economicStatus==='REALISTIC_NET_POSITIVE'&&e.stress.feeBoundPass===false&&e.execution.paperEligible){r.oldStressOnly++;routeSets.stressOnly.add(route);}
        positiveRoutes.set(route,r);
      }
    }
  }
  funnel.matchedCandidates=new Set([...current.keys()]).size;
  const result={scope:'RETAINED_SEPTEMBER_23_BOOK_EVENT_REPLAY',simulation:'HISTORICAL_L2_COUNTERFACTUAL_NOT_FILLS',ordersEnabled:false,
    source:{label:'ignored September 23 bounded candidate-watch evidence',files,firstAt:firstAt?new Date(firstAt).toISOString():null,lastAt:lastAt?new Date(lastAt).toISOString():null,
      limitation:'Only eight retained raw monitoring segments; earlier 18 rotated. Event-triggered samples are not the old 250 ms sample count.'},
    bookEvents,pairedEvents,orientationsPerPairedEvent:2,funnel,
    distinct:{grossRoutes:routeSets.gross.size,netRoutes:routeSets.net.size,oldStressOnlyRoutes:routeSets.stressOnly.size,
      positiveRouteSeconds:positiveEpisodes.size},
    routes:[...positiveRoutes].map(([route,v])=>({route,...v})).sort((a,b)=>b.net-a.net||b.gross-a.gross).slice(0,25)};
  if(output)writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const dir=process.argv[2],output=process.argv[3];if(!dir)throw Error('Usage: node --experimental-strip-types scripts/replay-ev-candidate-watch.ts EVIDENCE_DIR [OUTPUT_JSON]');
  const result=await replayRetainedEvidence(resolve(dir),output&&resolve(output));
  console.log(JSON.stringify({source:result.source,bookEvents:result.bookEvents,pairedEvents:result.pairedEvents,
    funnel:result.funnel,distinct:result.distinct,routes:result.routes.slice(0,5)},null,2));
}
