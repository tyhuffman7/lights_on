import {MakerRunner} from './maker-runner.ts';
import {existsSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {readConfig,lease} from './config.ts';
import {ResearchStore} from '../lib/research/store.ts';
import {Observer} from './observer.ts';
import {market} from '../lib/arb/adapters.ts';
import {validPaperApproval} from '../lib/arb/paper-approval.ts';
import {isVerified} from '../lib/research/mappings.ts';
import {totals} from '../lib/arb/ledger.ts';
import {PaperStore,type PaperDocument} from './paper-store.ts';
import {attachPaperBot} from './paper-bot.ts';
function summary(d:PaperDocument){return {mode:d.mode,executionMode:d.executionMode??'taker',realOrders:0,realFills:0,pendingHedge:d.pendingId,halt:d.halt,
 makerOrder:d.makerOrder?{id:d.makerOrder.id,event:d.makerOrder.pair.a.title,plannedQuantity:d.makerOrder.quote.quantity,filledA:d.makerOrder.filledA,filledB:d.makerOrder.filledB,reservedUSD:(d.makerOrder.reservedA+d.makerOrder.reservedB)/10000,expiresAt:d.makerOrder.expiresAt}:null,
 cashUSD:{kalshi:d.state.cash.kalshi/10000,polymarketUS:d.state.cash.poly/10000},
 committedUSD:totals(d.state).committed/10000,realizedPaperProfitUSD:totals(d.state).realized/10000,
 positions:d.state.positions.map(p=>({id:p.id,event:p.pair.a.title,status:d.pendingId===p.id?'hedging':p.status,
 quantity:p.quote.quantity,kalshiQuantity:p.aQuantity??p.quote.quantity,polyQuantity:p.bQuantity??p.quote.quantity,executionModel:p.executionModel??'taker',settlementBasis:p.pair.paperApproval?'conditional-paper-only':'verified-mapping',settlementRisks:p.pair.paperApproval?.risks??[],kalshi:{market:p.pair.a.id,side:p.quote.aSide,debitUSD:p.aDebit/10000},
 polymarketUS:{market:p.pair.b.id,side:p.quote.bSide,debitUSD:p.bDebit/10000},
 conditionalEntryProfitUSD:p.quote.profit/10000,realizedPaperProfitUSD:p.profit===undefined?null:p.profit/10000})),
 diagnostics:d.diagnostics,decisionCounts:d.counts,recentDecisions:d.lastDecisions};}
const [command,first,second,secondsText]=process.argv.slice(2);
if(command==='status'){
 if(!first||!existsSync(first))throw Error('Usage: paper status EXISTING_PAPER_DB');
 const store=new PaperStore(first,true);try{console.log(JSON.stringify(summary(store.read()),null,2));}finally{store.close();}
}else if(command==='run'||command==='maker-run'){
 if(!first||!second)throw Error('Usage: paper run|maker-run OBSERVER_CONFIG SEPARATE_PAPER_DB [SECONDS]');
 const seconds=secondsText===undefined?null:Number(secondsText);
 if(seconds!==null&&(!Number.isInteger(seconds)||seconds<1||seconds>600))throw Error('Bounded duration must be 1..600 seconds; omit for continuous operation');
 const config=readConfig(first);
 if(resolve(config.database)===resolve(second))throw Error('Paper ledger must be separate from observer database');
 if(existsSync('.env.research'))process.loadEnvFile('.env.research');
 mkdirSync(dirname(second),{recursive:true});
 let stopping=false;let resolveStop:()=>void=()=>{};
 const stopped=new Promise<void>(resolve=>{resolveStop=resolve;});
 const requestStop=()=>{stopping=true;resolveStop();};
 process.on('SIGINT',requestStop);process.on('SIGTERM',requestStop);
 let timeout:ReturnType<typeof setTimeout>|undefined;
 let releaseObserver:(()=>void)|undefined,releasePaper:(()=>void)|undefined;
 let research:ResearchStore|undefined,store:PaperStore|undefined,observer:Observer|undefined,bot:ReturnType<typeof attachPaperBot>|MakerRunner|undefined;
 const timers:ReturnType<typeof setInterval>[]=[];
 try{
  releaseObserver=lease(config.database);releasePaper=lease(second);research=new ResearchStore(config.database);store=new PaperStore(second);observer=new Observer(research,config);observer.paperTradeTape=true;
  await observer.initialize();bot=command==='maker-run'?new MakerRunner(observer,store):attachPaperBot(observer,store,'live-data');if(!stopping)observer.resume();
  const active=bot;
  const coverage=()=>({conditionalPaperApprovals:observer!.registry.list().filter(m=>m.active&&validPaperApproval(active.document.approvals?.[m.id],m.pair)).length,approvedActiveMappings:observer!.registry.list().filter(isVerified).length,
   selectedPairs:observer!.capacity?.selectedIds.length??0,
   excludedByPaperHorizon:observer!.capacity?.excludedByPaperHorizon??0,
   startupCandidatesRejected:observer!.telemetry.counters.startupCandidatesRejected??0,
   entryReadiness:observer!.registry.list().some(m=>isVerified(m)||(m.active&&validPaperApproval(active.document.approvals?.[m.id],m.pair)))?'Paper-approved mappings available; check conditionalPaperApprovals and position risk labels; current books and risk checks still required':'No approved settlement mappings: scanning only; paper entries blocked'});
  timers.push(setInterval(()=>{try{active.flush();console.log(JSON.stringify({...summary(active.document),...coverage()}));if(active.failed){observer?.pause();requestStop();}}catch(e){console.error('Paper persistence failed; stopping',String(e));observer?.pause();requestStop();}},10000));
  timers.push(setInterval(()=>void active.settle(market),60000));
  console.log(JSON.stringify({message:'Event-driven PAPER ONLY worker started. Browser not required. No real order transport.',seconds,...summary(active.document),...coverage()}));
  if(seconds!==null)timeout=setTimeout(requestStop,seconds*1000);
  await stopped;
 }finally{
  if(timeout)clearTimeout(timeout);
  for(const timer of timers)clearInterval(timer);
  const cleanupErrors:unknown[]=[];
  for(const cleanup of [()=>observer?.pause(),()=>bot?.stop(),()=>observer?.stop(),()=>store?.close(),()=>research?.close(),()=>releasePaper?.(),()=>releaseObserver?.()]){
   try{await cleanup();}catch(error){cleanupErrors.push(error);}
  }
  process.off('SIGINT',requestStop);process.off('SIGTERM',requestStop);
  if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Paper worker cleanup failed');
  if(bot?.failed)throw Error('Paper worker stopped after a persistence/execution failure; inspect logs and ledger');
 }
}else throw Error('Usage: npm run paper -- run|maker-run CONFIG PAPER_DB [SECONDS] | status PAPER_DB');
