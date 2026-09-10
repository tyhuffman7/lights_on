import {checkSettlements} from '@/lib/arb/settlement';
import {freshPair,book,market} from '@/lib/arb/adapters';import {loadState,saveState} from '@/lib/store';import {user,reply,error,sameOrigin} from '@/lib/api';import {assess} from '@/lib/arb/engine';import {totals,log} from '@/lib/arb/ledger';import {executePaper} from '@/lib/arb/execution';
export async function POST(req:Request){try{
 sameOrigin(req);const uid=await user(),body=await req.json() as Record<string,any>;let s=await loadState(uid);const now=Date.now();
 if(now-s.lastRun<30000)throw new Error('The next paper cycle is available 30 seconds after the last one.');
 if(!s.startedAt)throw new Error('Start the paper challenge first');
 s.lastRun=now;s=await saveState(uid,s,s.version);const version=s.version;
 s=await checkSettlements(s,market);
 const today=new Date().toISOString().slice(0,10),dayLoss=s.positions.filter(p=>p.closedAt&&new Date(p.closedAt).toISOString().slice(0,10)===today).reduce((n,p)=>n+(p.profit||0),0);
 if(body.settleOnly||now>=s.startedAt!+30*86400000||s.positions.some(p=>p.status==='unmatched')||dayLoss<=-50000){log(s,'paused','Settlement checks only. Challenge ended, entries paused, or exposure/loss limit reached.');return reply(await saveState(uid,s,version));}
 let entered=false;
 for(const saved of s.pairs.slice(0,8)){
  if(s.positions.some(p=>p.status!=='settled'&&(p.pair.a.id===saved.a.id||p.pair.b.id===saved.b.id)))continue;
  try{
   const p=await freshPair(saved);if(!p.reviewed){s.pairs=s.pairs.map(x=>x.id===p.id?p:x);log(s,'rules changed','Pair requires a new settlement review');continue;}
   const [a,b]=await Promise.all([book(p.a),book(p.b)]);
   const horizon=Math.min(s.settings.maxDays,Math.max(0,(s.startedAt!+30*86400000-Date.now())/86400000));
   const limits={...s.settings,maxDays:horizon,maxTrade:Math.max(0,Math.min(s.settings.maxTrade,s.settings.maxCommitted-totals(s).committed))};
   const q=assess(p,a,b,limits,s.cash);if(!q?.eligible)continue;
   // Deliberately stress the hedge with a 500ms delay. REST depth is indicative, not a real fill.
   await new Promise(r=>setTimeout(r,500));
   const refreshed=await Promise.allSettled([book(p.a),book(p.b)]);
   const empty={yes:[],no:[],yesBids:[],noBids:[],receivedAt:Date.now(),exchangeAt:null,open:false};
   s=executePaper(s,p,q,refreshed[0].status==='fulfilled'?refreshed[0].value:empty,refreshed[1].status==='fulfilled'?refreshed[1].value:empty,crypto.randomUUID());entered=true;break;
  }catch(e){log(s,'entry rejected',e instanceof Error?e.message:String(e));}
 }
 if(!entered)log(s,'cycle','No qualifying entry. Cash preserved.');
 return reply(await saveState(uid,s,version));
 }catch(e){return error(e);}}
