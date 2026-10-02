// PAPER only: public GET metadata and market-data WS subscriptions. No order API.
import {writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {readConfig,sha} from './config.ts';
import {tick,balances,type Metadata} from './engine.ts';
import {loadMetadata} from './markets.ts';
import {openStore} from './store.ts';
import {BookCache} from '../lib/research/books.ts';
import {StreamConnection,authHeaders} from '../worker/streams.ts';

const arg=(name:string,fallback:string)=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const env=arg('env','');if(env)process.loadEnvFile(resolve(env));
const config=readConfig(arg('pairs','config/approved-pairs.json'));
const seconds=Number(arg('seconds','300'));
if(!Number.isInteger(seconds)||seconds<1||seconds>86400)throw Error('--seconds must be 1..86400 (default 300)');
for(const venue of ['kalshi','poly'] as const)authHeaders(venue); // validate credentials before acquiring storage
const directory=resolve(arg('data','research-data/simple-paper'));
const store=openStore(directory,sha(JSON.stringify(config))),cache=new BookCache(),metas=new Map<string,Metadata>();
const abort=new AbortController(),streams:StreamConnection[]=[];
const counts={books:{kalshi:0,poly:0},entries:0,earlyExits:0,settlements:0,metadataFailures:0};
const startedAt=new Date().toISOString();let stopped=false;
let lastActiveStreams:ReturnType<StreamConnection['health']>[]=[];
const stop=()=>{if(stopped)return;lastActiveStreams=streams.map(s=>s.health());stopped=true;abort.abort();for(const s of streams)s.stop();};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
const evaluate=()=>{
  for(const pair of config.pairs){
    const change=tick(pair,cache.get('kalshi',pair.kalshi),cache.get('poly',pair.poly),metas.get(pair.id),config,store.state);
    if(!change)continue;
    if(change.status==='open')counts.entries++;else if(change.status==='early-exit')counts.earlyExits++;else counts.settlements++;
    store.save();console.log(JSON.stringify({event:change.status,paper:true,position:change}));
  }
};
const summary=()=>({paper:true,startedAt,at:new Date().toISOString(),approvedPairs:config.pairs.length,
  metadataApproved:[...metas.values()].filter(m=>m.approved).length,counts,...balances(store.state,config),
  streams:streams.map(s=>s.health()),lastActiveStreams,
  assumption:'Displayed simultaneous execution; ordinary $1 pair payout is conditional. Ohio live eligibility unvalidated; live orders unavailable.'});
let timer:ReturnType<typeof setTimeout>|undefined,heartbeat:ReturnType<typeof setInterval>|undefined;
let refreshJob:Promise<void>|null=null;
let failure:unknown;
try{
  console.log(JSON.stringify({event:'START',paper:true,pairs:config.pairs.length,config,seconds,directory}));
  const refresh=async()=>{
    for(const pair of config.pairs){
      if(stopped)break;
      try{const m=await loadMetadata(pair,abort.signal);metas.set(pair.id,m);
        if(!m.approved)console.log(JSON.stringify({event:'PAIR_BLOCKED',pair:pair.id,reason:'Rules changed or unsupported metadata'}));
      }catch{metas.delete(pair.id);if(!stopped){counts.metadataFailures++;console.log(JSON.stringify({event:'METADATA_UNAVAILABLE',pair:pair.id}));}}
      if(stopped)break;evaluate();
      if(!stopped)await new Promise(r=>setTimeout(r,100));
    }
  };
  await refresh();
  if(!stopped){
    for(const venue of ['kalshi','poly'] as const){
      const ids=config.pairs.map(p=>venue==='kalshi'?p.kalshi:p.poly);
      const s=new StreamConnection({venue,ids,headers:()=>authHeaders(venue),
        onInvalid:()=>cache.reset(venue),
        onDiagnostic:(event)=>console.log(JSON.stringify({event,venue})),
        onMessage:(message,wall,mono)=>{
          const b=venue==='kalshi'?cache.kalshi(message,wall,mono):cache.poly(message,wall,mono);
          if(!b)return;if(!ids.includes(b.marketId))throw Error('Unsubscribed market');
          counts.books[venue]++;
        }});
      streams.push(s);s.start();
    }
    const streamStarted=performance.now();timer=setTimeout(stop,seconds*1000);
    let lastRefresh=Date.now();
    heartbeat=setInterval(()=>{console.log(JSON.stringify({event:'STATUS',...summary()}));},30000);
    while(!stopped){
      await new Promise(r=>setTimeout(r,250));
      if(stopped)break;evaluate();
      if(!refreshJob&&Date.now()-lastRefresh>=60000){lastRefresh=Date.now();refreshJob=refresh().catch(error=>{failure=error;stop();}).finally(()=>{refreshJob=null;});}
    }
    console.log(JSON.stringify({event:'SMOKE_DURATION',elapsedSeconds:(performance.now()-streamStarted)/1000}));
    if(failure)throw failure;
  }
}finally{
  stop();if(timer)clearTimeout(timer);if(heartbeat)clearInterval(heartbeat);
  if(refreshJob)await refreshJob;
  process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
  try{store.save();writeFileSync(join(directory,'summary.json'),JSON.stringify(summary(),null,2)+'\n');
    console.log(JSON.stringify({event:'STOPPED',...summary()}));}finally{store.release();}
}
