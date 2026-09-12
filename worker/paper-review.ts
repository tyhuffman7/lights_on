import {readConfig} from './config.ts';
import {ResearchStore} from '../lib/research/store.ts';
import {PaperStore} from './paper-store.ts';
import {assessSettlement} from '../lib/research/settlement-validation.ts';
import {assess} from '../lib/arb/engine.ts';
import {fresh} from '../lib/research/books.ts';
import {totals} from '../lib/arb/ledger.ts';
import type {Mapping,StreamBook} from '../lib/research/types.ts';
const [configPath,paperPath,requestedSession]=process.argv.slice(2);
if(!configPath||!paperPath)throw Error('Usage: npm run paper:review -- CONFIG EXISTING_PAPER_DB [SESSION_ID]');
const research=new ResearchStore(readConfig(configPath).database,true),paper=new PaperStore(paperPath,true);
try{
 const d=paper.read(),now=Date.now(),mappings=research.rows('mappings').map(r=>JSON.parse(r.body) as Mapping);
 const reviews=mappings.filter(m=>m.active).map(m=>({id:m.id,title:m.pair.a.title,ruleHashes:{kalshi:m.pair.a.hash,poly:m.pair.b.hash},daysToLatestClose:Math.ceil((Math.max(Date.parse(m.pair.a.closeAt),Date.parse(m.pair.b.closeAt))-now)/86400000),...assessSettlement(m.pair)}));
 const session= requestedSession?research.db.prepare('SELECT * FROM sessions WHERE id=?').get(requestedSession):research.db.prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT 1').get();
 if(!session)throw Error('No recorded session found');
 const states=research.db.prepare(`SELECT o.pair_id,s.at,s.mono,s.a_book_id,s.b_book_id,s.body FROM opportunity_states s JOIN opportunities o ON o.id=s.opportunity_id WHERE o.session_id=? AND json_extract(s.body,'$.best.profit')>0`).all(String(session.id));
 const economics=states.map(row=>{
  const at=Number(row.at),e=JSON.parse(String(row.body));
  const historical=research.db.prepare('SELECT body FROM mapping_history WHERE pair_id=? AND at<=? ORDER BY at DESC,id DESC LIMIT 1').get(String(row.pair_id),at);
  if(!historical)return {id:row.pair_id,at,status:'MISSING_HISTORICAL_MAPPING'};
  const m=JSON.parse(String(historical.body)) as Mapping;
  const load=(id:unknown)=>{const r=research.db.prepare('SELECT body FROM book_updates WHERE id=?').get(Number(id));return r?JSON.parse(String(r.body)) as StreamBook:null;};
  const a=load(row.a_book_id),b=load(row.b_book_id);
  if(!a||!b)return {id:m.id,at,status:'MISSING_RECORDED_BOOK'};
  // Counterfactual quote only: no approval is written and no paper position is entered.
  // Current ledger cash/settings are explicit inputs; this is not historical fill replay.
  const settings={...d.state.settings,maxTrade:Math.max(0,Math.min(d.state.settings.maxTrade,d.state.settings.maxCommitted-totals(d.state).committed)),maxDays:Math.min(d.state.settings.maxDays,Math.max(0,((d.state.startedAt??0)+30*86400000-at)/86400000))};
  const q=assess({...m.pair,reviewed:true},a,b,settings,d.state.cash,at);
  const streamFresh=fresh(a,Number(row.mono),at,settings.maxAge)&&fresh(b,Number(row.mono),at,settings.maxAge)&&a.source==='stream'&&b.source==='stream';
  return {id:m.id,title:m.pair.a.title,at,status:'COUNTERFACTUAL_QUOTE_ONLY',researchProfitUSD:e.best.profit/10000,
   paperProfitUSD:q?q.profit/10000:null,paperQuantity:q?.quantity??null,streamFresh,
   paperReasons:q?.reasons??['No size within paper cash/depth/fee limits'],wouldPassQuoteChecksIfReviewed:!!q?.eligible&&streamFresh,
   settlement:assessSettlement(m.pair)};
 });
 const counts:Record<string,number>={};for(const r of reviews)counts[r.status]=(counts[r.status]??0)+1;
 console.log(JSON.stringify({at:now,readOnly:true,session:session.id,scope:'Settlement diagnostics and counterfactual paper quotes; no approvals, fills or cash changes',inputs:{cash:d.state.cash,settings:d.state.settings,challengeStartedAt:d.state.startedAt},summary:{activeMappings:reviews.length,statusCounts:counts,positiveResearchStates:economics.length,counterfactualPaperQuotesPassing:economics.filter(r=>r.wouldPassQuoteChecksIfReviewed).length},economics,reviews},null,2));
}finally{paper.close();research.close();}
