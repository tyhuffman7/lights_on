import type {Book,Pair,Quote} from '../lib/arb/types.ts';
export type DiagnosticInput={pair:Pair;approved:boolean;usable:boolean;a?:Book;b?:Book;quote:Quote|null;reasons:string[];at:number};
export function newDiagnostics(){return {startedAt:Date.now(),evaluations:0,approved:0,usableApproved:0,sizedApproved:0,eligible:0,
 makerPlans:{scope:'PROSPECTIVE_QUOTES_NOT_FILLS',feeAssumption:'Existing taker fee charged on both legs; no maker rebate',evaluated:0,eligible:0,best:[] as {pairId:string;title:string;at:number;quantity:number;bidUSD:number;ahead:number;netUSD:number}[]},
 blockers:{} as Record<string,number>,indicativeTopBook:{fresh:0,unusable:0},
 closest:[] as {pairId:string;title:string;at:number;quantity:number;grossUSD:number;afterFeesUSD:number;afterReserveUSD:number;reasons:string[]}[]};}
export type PaperDiagnostics=ReturnType<typeof newDiagnostics>;
// Observations only. Never manufactures a quote, refreshes timestamps, or approves entry.
export function recordDiagnostic(d:PaperDiagnostics,x:DiagnosticInput){
 d.evaluations++;if(x.approved)d.approved++;
 if(x.approved&&x.usable)d.usableApproved++;
 const q=x.quote;
 if(x.approved&&x.usable&&q){
  d.sizedApproved++;if(q.eligible&&!x.reasons.length)d.eligible++;
  const sample={pairId:x.pair.id,title:x.pair.a.title,at:x.at,quantity:q.quantity,grossUSD:(q.payout-q.cost)/10000,
   afterFeesUSD:(q.payout-q.cost-q.fees)/10000,afterReserveUSD:q.profit/10000,reasons:[...x.reasons]};
  // Best observed quote per pair, bounded across the run. These are not fills.
  const old=d.closest.find(s=>s.pairId===sample.pairId);
  if(!old||sample.afterReserveUSD>old.afterReserveUSD){d.closest=d.closest.filter(s=>s.pairId!==sample.pairId);d.closest.push(sample);d.closest.sort((a,b)=>b.afterReserveUSD-a.afterReserveUSD);d.closest=d.closest.slice(0,20);}
 }
 if(x.approved&&x.a&&x.b){
  const positive=(['yes','no'] as const).some(side=>{const other=x.pair.inverted?side:side==='yes'?'no':'yes';const a=x.a![side][0],b=x.b![other][0];return a&&b&&a.quantity>0&&b.quantity>0&&a.price+b.price<10000;});
  if(positive)d.indicativeTopBook[x.usable?'fresh':'unusable']++;
 }
 const other=x.reasons.filter(r=>r!=='Net edge below threshold');
 const stage=!x.approved?'unapproved':!x.usable?'data_unusable':!q?'no_affordable_quote':other.length?'other_risk_gate':
  q.payout<=q.cost?'prices':q.payout<=q.cost+q.fees?'fees':q.profit<=0?'reserve':!q.eligible?'minimum_return':'eligible';
 d.blockers[stage]=(d.blockers[stage]??0)+1;
}
