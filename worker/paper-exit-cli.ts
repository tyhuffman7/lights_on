// Exit-only PAPER maintenance. No order transport, credentials, or new entries.
import {appendFileSync,writeFileSync,existsSync} from 'node:fs';
import {PaperStore} from './paper-store.ts';import {lease} from './config.ts';
import {market,book} from '../lib/arb/adapters.ts';import {checkSettlements} from '../lib/arb/settlement.ts';
import {planExit,exitLeg,applyExitLeg} from '../lib/arb/paper-exit.ts';import type {Position,Book} from '../lib/arb/types.ts';import {totals} from '../lib/arb/ledger.ts';
const [path,secondsText='180']=process.argv.slice(2),seconds=Number(secondsText);
if(!path||!existsSync(path)||!Number.isInteger(seconds)||seconds<1||seconds>3600)throw Error('Usage: npm run paper:exits -- EXISTING_PAPER_DB [SECONDS 1..3600]');
const release=lease(path);let store:PaperStore|undefined,stopping=false;const started=Date.now();
process.on('SIGINT',()=>stopping=true);process.on('SIGTERM',()=>stopping=true);
const record=(body:object)=>appendFileSync(path+'.exits.jsonl',JSON.stringify({at:Date.now(),...body})+'\n');
const counts={cycles:0,candidates:0,soldLegs:0,errors:0};
async function snapshot(p:Position,key:'a'|'b'):Promise<Book>{
 const original=p.pair[key],m=await market(key==='a'?'kalshi':'poly',original.id);
 if(m.hash!==original.hash||m.feeRate!==original.feeRate||m.minQty!==original.minQty||!m.open||m.settlement!==null)throw Error('Exit metadata changed or market closed; awaiting settlement/review');
 return book(m);
}
try{
 store=new PaperStore(path);let d=store.read();
 if(d.mode!=='live-data'||d.makerOrder||d.pendingId||d.state.makerReserved)throw Error('Exit worker requires drained live-data paper ledger');
 record({kind:'EXIT_WORKER_STARTED',seconds,scope:'PAPER_ONLY_DELAYED_REST_DEPTH',halt:d.halt});
 while(!stopping&&Date.now()-started<seconds*1000){
  if(counts.cycles%6===0){d.state=await checkSettlements(d.state,market);store.save(d);}
  for(const p of d.state.positions.filter(p=>p.status!=='settled')){
   if(stopping)break;
   try{
    const books:Partial<Record<'a'|'b',Book>>={};
    const results=await Promise.all((['a','b'] as const).filter(key=>p[`${key}Payout`]===undefined).map(async key=>({key,book:await snapshot(p,key)})));
    for(const r of results)books[r.key]=r.book;
    const now=Date.now(),plan=planExit(d.state,p.id,books,now);
    record({kind:'EXIT_ASSESSMENT',id:p.id,books,plan,legs:results.map(r=>exitLeg(p,r.key,r.book,d.state,now))});
    if(!plan)continue;counts.candidates++;
    for(const leg of plan.legs){
     if(stopping)break;
     // Re-fetch after transport delay for each sequential leg, retaining limits.
     const requestAt=Date.now(),legPlan={...plan,requestedAt:requestAt};
     record({kind:'EXIT_INTENT',id:p.id,leg,requestAt,scope:'SIMULATED_FULL_SIZE_IOC'});
     await new Promise(r=>setTimeout(r,500));if(stopping)break;
     const fresh=await snapshot(p,leg.key),next=applyExitLeg(d.state,legPlan,leg.key,fresh,Date.now());
     if(next===d.state){record({kind:'EXIT_NOT_FILLED',id:p.id,key:leg.key,book:fresh});break;}
     d.state=next;const position=next.positions.find(x=>x.id===p.id)!;
     if(position.status==='unmatched')d.halt??='Paper early exit left unhedged exposure';
     store.save(d);counts.soldLegs++;record({kind:'EXIT_PAPER_FILL',id:p.id,evidence:position.paperExits?.at(-1),status:position.status,profit:position.profit??null});
    }
   }catch(e){counts.errors++;record({kind:'EXIT_UNAVAILABLE',id:p.id,error:String(e)});}
  }
  counts.cycles++;
  const status={at:Date.now(),scope:'PAPER_ONLY_DELAYED_REST_DEPTH_NOT_REAL_FILLS',counts,halt:d.halt,totals:totals(d.state),positions:d.state.positions.map(p=>({id:p.id,event:p.pair.a.title,status:p.status,closedBy:p.closedBy??null,paperExits:p.paperExits?.length??0,profit:p.profit??null,aPayout:p.aPayout??null,bPayout:p.bPayout??null}))};
  writeFileSync(path+'.exit-status.json',JSON.stringify(status,null,2));
  if(d.state.positions.every(p=>p.status==='settled'))break;
  await new Promise(r=>setTimeout(r,5000));
 }
 record({kind:'EXIT_WORKER_STOPPED',counts});console.log(JSON.stringify({stopped:true,counts,status:path+'.exit-status.json'}));
}finally{store?.close();release();}
