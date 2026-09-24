import {openSync,writeSync,fsyncSync,closeSync,readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import type {ArbEvaluation} from '../lib/research/ev-arb.ts';
import {evPaperDefaults,type EvPaperPolicy} from '../lib/research/ev-arb.ts';
import type {PaperAttempt} from '../lib/research/ev-paper.ts';
import {bookDigest,bookEvidence} from '../lib/research/ev-paper.ts';
import type {StreamBook} from '../lib/research/types.ts';

export type Funnel={matchedCandidates:number;usableTwoBookObservations:number;grossPositiveObservations:number;
  realisticNetPositiveObservations:number;evPositiveObservations:number;stressFeeFailures:number;
  oneTickFailures:number;freshnessFailures:number;settlementWarnings:number;oldStressOnlyRejections:number;
  closest:{pairId:string;orientation:string;grossProfit:number;estimatedNetProfit:number|null;at:number}|null};
export function emptyFunnel():Funnel{return {matchedCandidates:0,usableTwoBookObservations:0,grossPositiveObservations:0,
  realisticNetPositiveObservations:0,evPositiveObservations:0,stressFeeFailures:0,oneTickFailures:0,
  freshnessFailures:0,settlementWarnings:0,oldStressOnlyRejections:0,closest:null};}
export function observeFunnel(f:Funnel,e:ArbEvaluation,evPositive=false){
  if(e.grossProfit!==null&&e.stress.freshnessPass)f.usableTwoBookObservations++;
  if(e.grossStatus==='GROSS_ARB')f.grossPositiveObservations++;
  if(e.economicStatus==='REALISTIC_NET_POSITIVE')f.realisticNetPositiveObservations++;
  if(evPositive)f.evPositiveObservations++;
  if(e.grossStatus==='GROSS_ARB'&&e.stress.feeBoundPass===false)f.stressFeeFailures++;
  if(e.grossStatus==='GROSS_ARB'&&e.stress.oneTickPass===false)f.oneTickFailures++;
  if(!e.stress.freshnessPass)f.freshnessFailures++;
  if(e.settlementWarnings.length)f.settlementWarnings++;
  if(e.economicStatus==='REALISTIC_NET_POSITIVE'&&e.stress.feeBoundPass===false&&e.execution.paperEligible)f.oldStressOnlyRejections++;
  if(e.grossProfit!==null&&e.stress.freshnessPass&&(!f.closest||e.estimatedNetProfit!==null&&e.estimatedNetProfit>(f.closest.estimatedNetProfit??-Infinity)))
    f.closest={pairId:e.pairId,orientation:e.orientation,grossProfit:e.grossProfit,estimatedNetProfit:e.estimatedNetProfit,at:e.at};
}
export class EvLearningLedger{
  private fd:number;private bookFd:number;private ids=new Set<string>();private bookIds=new Set<string>();readonly directory:string;readonly policy:EvPaperPolicy;
  constructor(directory:string,policy:EvPaperPolicy=evPaperDefaults){
    this.directory=directory;this.policy=policy;
    mkdirSync(directory,{recursive:true,mode:0o700});
    const path=resolve(directory,'attempts.ndjson');
    if(existsSync(path))for(const line of readFileSync(path,'utf8').split('\n'))if(line.trim())this.ids.add((JSON.parse(line) as PaperAttempt).attemptId);
    this.fd=openSync(path,'a',0o600);
    const bookPath=resolve(directory,'books.ndjson');
    if(existsSync(bookPath))for(const line of readFileSync(bookPath,'utf8').split('\n'))if(line.trim())this.bookIds.add(JSON.parse(line).sha256);
    this.bookFd=openSync(bookPath,'a',0o600);
  }
  appendBook(book:StreamBook){
    const sha256=bookDigest(book);if(this.bookIds.has(sha256))return sha256;
    const publicBook=bookEvidence(book);
    // The book is an allowlisted public L2 shape. Recompute from the exact
    // original body so attempt references can be verified offline.
    writeSync(this.bookFd,JSON.stringify({sha256,book:publicBook})+'\n');fsyncSync(this.bookFd);this.bookIds.add(sha256);return sha256;
  }
  appendAttempt(a:PaperAttempt){
    if(a.simulation!=='PAPER_DEPTH_COUNTERFACTUAL_NOT_REAL_FILL'||a.strategy!==this.policy.version)throw Error('NON_PAPER_ATTEMPT');
    if(this.ids.has(a.attemptId))throw Error('DUPLICATE_ATTEMPT');
    const raw=JSON.stringify(a);
    if(/authorization|bearer|api[_-]?key|private[_-]?key|secret|token/i.test(raw))throw Error('SENSITIVE_LEDGER_FIELD');
    writeSync(this.fd,raw+'\n');fsyncSync(this.fd);this.ids.add(a.attemptId);
  }
  writeFunnel(f:Funnel,extra:Record<string,unknown>={}){
    const doc={version:1,simulation:'PAPER_DEPTH_COUNTERFACTUAL_NOT_REAL_FILL',ordersEnabled:false,policy:this.policy,
      updatedAt:Date.now(),funnel:f,...extra};const path=resolve(this.directory,'summary.json'),tmp=path+'.tmp';
    writeFileSync(tmp,JSON.stringify(doc,null,2)+'\n',{mode:0o600});renameSync(tmp,path);
  }
  close(){closeSync(this.fd);closeSync(this.bookFd);}
}
export function readAttempts(directory:string):PaperAttempt[]{
  const path=resolve(directory,'attempts.ndjson');if(!existsSync(path))return [];
  return readFileSync(path,'utf8').split('\n').filter(Boolean).map(x=>JSON.parse(x) as PaperAttempt);
}
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export function empiricalEvForCandidate(e:ArbEvaluation,attempts:PaperAttempt[],first: 'kalshi'|'poly',policy:EvPaperPolicy=evPaperDefaults){
  const rows=attempts.filter(a=>a.firstLegVenue===first&&!a.finalState.startsWith('REJECTED_'));
  if(rows.length<policy.minEmpiricalAttempts||e.estimatedNetProfit===null||rows.some(a=>a.residualQuantity>0))
    return {status:'INSUFFICIENT_EMPIRICAL_SAMPLE' as const,sampleSize:rows.length,expectedValue:null};
  const estimate=rows.reduce((sum,a)=>sum+(a.finalState==='CLEAN_PAIRED_FILL'
    ?e.estimatedNetProfit!+(a.paperPnL-(a.estimatedNetProfit??0)):a.paperPnL),0)/rows.length;
  return {status:estimate>0?'EXECUTION_EV_POSITIVE' as const:'EXECUTION_EV_NONPOSITIVE' as const,
    sampleSize:rows.length,expectedValue:estimate};
}
export function learningReport(attempts:PaperAttempt[],funnel:Funnel,policy:EvPaperPolicy=evPaperDefaults){
  const accepted=attempts.filter(a=>a.attemptRole==='PRIMARY'&&!a.finalState.startsWith('REJECTED_'));
  const allEligible=attempts.filter(a=>!a.finalState.startsWith('REJECTED_'));
  const paired=accepted.filter(a=>a.finalState==='CLEAN_PAIRED_FILL');
  const disappear=accepted.filter(a=>a.finalState==='DISAPPEARED_BEFORE_ENTRY');
  const unwinds=accepted.filter(a=>a.unwindRequired);
  const orphans=accepted.filter(a=>a.residualQuantity>0);
  const sums=(field:keyof PaperAttempt)=>accepted.reduce((n,a)=>n+Number(a[field]??0),0);
  const byFirst=Object.fromEntries((['kalshi','poly'] as const).map(v=>{
    const rows=allEligible.filter(a=>a.firstLegVenue===v),clean=rows.filter(a=>a.finalState==='CLEAN_PAIRED_FILL'),
      unwind=rows.filter(a=>a.unwindRequired),orphan=rows.filter(a=>a.residualQuantity>0);
    return [v,{attempts:rows.length,cleanHedgeRate:rows.length?clean.length/rows.length:null,
      preEntryDisappearanceRate:rows.length?rows.filter(a=>a.finalState==='DISAPPEARED_BEFORE_ENTRY').length/rows.length:null,
      unwindRate:rows.length?unwind.length/rows.length:null,orphanRate:rows.length?orphan.length/rows.length:null,
      meanHedgeDelayMs:mean(rows.filter(a=>a.firstLegSimulatedFill).map(a=>a.hedgeDelayMs)),
      meanCleanProfit:mean(clean.map(a=>a.paperPnL)),meanFees:mean(rows.map(a=>a.fees)),
      meanHedgeSlippage:mean(clean.map(a=>a.normalSlippage)),meanUnwindLoss:mean(unwind.map(a=>a.unwindLoss)),
      meanOrphanResidualCost:mean(orphan.map(a=>a.residualCost)),
      empiricalEv:rows.length>=policy.minEmpiricalAttempts&&!orphan.length?mean(rows.map(a=>a.paperPnL)):null,
      evStatus:rows.length>=policy.minEmpiricalAttempts&&!orphan.length?'EMPIRICAL':'INSUFFICIENT_EMPIRICAL_SAMPLE'}];
  }));
  const net=sums('paperPnL'),parts=sums('grossPaperProfit')-sums('fees')-sums('normalSlippage')-sums('unwindLoss')-sums('orphanLoss');
  if(net!==parts)throw Error('PAPER_PNL_RECONCILIATION_FAILED');
  return {simulation:'PAPER_DEPTH_COUNTERFACTUAL_NOT_REAL_FILL',ordersEnabled:false,funnel:{...funnel,paperAttempts:accepted.length,
      counterfactualEvaluations:attempts.filter(a=>a.attemptRole==='COUNTERFACTUAL').length},
    outcomes:{cleanPairedFills:paired.length,disappearedBeforeEntry:disappear.length,unwinds:unwinds.length,
      orphans:orphans.length,rejected:attempts.length-accepted.length},
    pnl:{grossPaperProfit:sums('grossPaperProfit'),fees:sums('fees'),normalSlippage:sums('normalSlippage'),
      unwindLoss:sums('unwindLoss'),orphanLoss:sums('orphanLoss'),netModeledPaperPnL:net,
      unresolvedResidualCost:sums('residualCost'),reconciled:true},byFirst,
    aggregateEv:accepted.length>=policy.minEmpiricalAttempts&&!orphans.length?net/accepted.length:null,
    aggregateEvStatus:accepted.length>=policy.minEmpiricalAttempts&&!orphans.length?'EMPIRICAL':'INSUFFICIENT_EMPIRICAL_SAMPLE'};
}
