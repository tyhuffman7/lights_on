import {createHash} from 'node:crypto';
import {openSync,closeSync,writeSync,fsyncSync,readFileSync,existsSync,mkdirSync,unlinkSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {dormantPilot,planHash} from './live-admission.ts';
import type {OrderDraft,LiveOutcome} from './live-adapter.ts';
import {validateOrderDraft} from './live-adapter.ts';

export type FrozenLivePlan={pairId:string;quantity:1;maxCommitted:number;entry:[{draft:OrderDraft;feeUpper:number},{draft:OrderDraft;feeUpper:number}];
 recovery:{draft:OrderDraft;feeUpper:number};admissionEvidenceSha256:string};
type Slot='first'|'second'|'recovery';
type Phase='UNUSED'|'RESERVED'|'PENDING'|'RECONCILE'|'FIRST_FILLED'|'RECOVERY_REQUIRED'|'PAIRED'|'STOPPED'|'UNKNOWN'|'LOSS';
type State={phase:Phase;attempts:number;slot:Slot|null;plan:FrozenLivePlan|null;planSha256:string|null;reserved:number;receipt:LiveOutcome|null;recoveryAttempts:number;loss:boolean;entryCashFlowMicros:number|null;realizedPnlMicros:number|null};
const initial=():State=>({phase:'UNUSED',attempts:0,slot:null,plan:null,planSha256:null,reserved:0,receipt:null,recoveryAttempts:0,loss:false,entryCashFlowMicros:null,realizedPnlMicros:null});
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const money=(n:number)=>Number.isSafeInteger(n)&&n>=0;
export function validateFrozenPlan(p:FrozenLivePlan){
 if(!p||!p.pairId||p.quantity!==1||!money(p.maxCommitted)||p.maxCommitted<=0||p.maxCommitted>dormantPilot.maxCommitted||! /^[a-f0-9]{64}$/.test(p.admissionEvidenceSha256)||!Array.isArray(p.entry)||p.entry.length!==2)throw Error('INVALID_FROZEN_PLAN');
 const [a,b]=p.entry,r=p.recovery;
 if(a.draft.venue===b.draft.venue||new Set([a.draft.venue,b.draft.venue]).size!==2||a.draft.venue!=='kalshi'||b.draft.venue!=='poly')throw Error('ENTRY_VENUE_ORDER');
 for(const x of [...p.entry,r]){
  validateOrderDraft(x.draft);
  if(!money(x.feeUpper)||x.feeUpper>10000||x.draft.leg.quantity!==1||!money(x.draft.leg.limitPrice)||x.draft.leg.limitPrice<=0||x.draft.leg.limitPrice>=10000)throw Error('INVALID_EXPOSURE');
 }
 if(a.draft.action!=='buy'||b.draft.action!=='buy'||r.draft.action!=='sell'||r.draft.venue!==a.draft.venue||r.draft.leg.marketId!==a.draft.leg.marketId||r.draft.leg.side!==a.draft.leg.side||new Set([...p.entry,r].map(x=>x.draft.localId)).size!==3)throw Error('INVALID_RECOVERY_PLAN');
 const reserved=a.draft.leg.limitPrice+a.feeUpper+b.draft.leg.limitPrice+b.feeUpper+r.feeUpper;
 if(reserved>p.maxCommitted)throw Error('PILOT_CAP_EXCEEDED');return reserved;
}
// Dedicated private LIVE file, never a PAPER SQLite handle. Single-writer lock and
// fsync-before-network intent survive process death. A stale lock requires manual
// reconciliation; opening a spent ledger never creates a new attempt allowance.
export class LiveLedger {
 readonly file:string;private lock:string;private fd=-1;private previous='0'.repeat(64);private sequence=0;private failed=false;private closed=false;private state:State=initial();
 constructor(directory:string){
  mkdirSync(directory,{recursive:true,mode:0o700});this.file=resolve(directory,'live-pilot-ledger.ndjson');this.lock=resolve(directory,'live-pilot.lock');
  const lock=openSync(this.lock,'wx',0o600);try{writeSync(lock,JSON.stringify({pid:process.pid,at:Date.now()}));fsyncSync(lock);}finally{closeSync(lock);}
  try{
   if(existsSync(this.file)){
    if(statSync(this.file).size>16*1024**2)throw Error('LIVE_LEDGER_LIMIT');
    const raw=readFileSync(this.file,'utf8');if(raw&&!raw.endsWith('\n'))throw Error('TORN_LIVE_LEDGER');
    for(const line of raw.trim().split('\n').filter(Boolean)){const e=JSON.parse(line);if(e.sequence!==this.sequence+1||e.previous!==this.previous||e.digest!==hash(e.previous+JSON.stringify(e.body)))throw Error('LIVE_LEDGER_CHAIN_INVALID');this.state=e.body.state;this.previous=e.digest;this.sequence=e.sequence;}
   }
   this.fd=openSync(this.file,'a',0o600);
   const parent=openSync(resolve(directory),'r');try{fsyncSync(parent);}finally{closeSync(parent);}
   if(['PENDING','RECONCILE','FIRST_FILLED','RECOVERY_REQUIRED','RESERVED'].includes(this.state.phase))this.persist('RESTART_REQUIRES_RECONCILIATION',{...this.state,phase:'UNKNOWN'});
  }catch{this.failed=true;throw Error('LIVE_LEDGER_REQUIRES_MANUAL_REVIEW');}
 }
 view():State{return structuredClone(this.state);}
 private persist(kind:string,state:State,detail:unknown=null){
  if(this.failed||this.closed)throw Error('LIVE_LEDGER_CLOSED');
  const body={at:Date.now(),kind,state,detail},digest=hash(this.previous+JSON.stringify(body)),line=Buffer.from(JSON.stringify({sequence:this.sequence+1,previous:this.previous,digest,body})+'\n');
  try{if(statSync(this.file).size+line.length>16*1024**2)throw Error();let offset=0;while(offset<line.length){const n=writeSync(this.fd,line,offset,line.length-offset);if(n<=0)throw Error();offset+=n;}fsyncSync(this.fd);this.previous=digest;this.sequence++;this.state=structuredClone(state);}
  catch{this.failed=true;throw Error('LIVE_LEDGER_DURABILITY_FAILURE');}
 }
 reserve(plan:FrozenLivePlan){
  if(this.state.phase!=='UNUSED'||this.state.attempts)throw Error('ONE_ATTEMPT_ALREADY_CONSUMED');
  const frozen=structuredClone(plan),reserved=validateFrozenPlan(frozen);
  this.persist('EXACT_PLAN_RESERVED',{...this.state,phase:'RESERVED',attempts:1,plan:frozen,planSha256:planHash(frozen),reserved});
 }
 request(slot:Slot){
  const s=this.state,p=s.plan;if(!p||s.loss||!((slot==='first'&&s.phase==='RESERVED')||(slot==='second'&&s.phase==='FIRST_FILLED')||(slot==='recovery'&&s.phase==='RECOVERY_REQUIRED'&&s.recoveryAttempts===0)))throw Error('SEQUENCE_OR_EXPOSURE_GATE');
  const draft=slot==='recovery'?p.recovery.draft:p.entry[slot==='first'?0:1].draft;
  this.persist('SUBMISSION_INTENT_BEFORE_NETWORK',{...s,phase:'PENDING',slot,receipt:null,recoveryAttempts:s.recoveryAttempts+(slot==='recovery'?1:0)},draft);
  return structuredClone(draft);
 }
 receipt(outcome:LiveOutcome){
  if(this.state.phase!=='PENDING')throw Error('NO_PENDING_SUBMISSION');
  this.persist('VENUE_REPLY',{...this.state,phase:outcome.state==='unknown'?'UNKNOWN':'RECONCILE',receipt:structuredClone(outcome)});
 }
 // Caller must supply reconciled order AND individual fill evidence, not estimates.
 // This boundary never treats submission receipts alone as known inventory.
 reconcile(e:{state:'fill'|'no-fill'|'rejected';orderId:string;quantity:number;feeMicros:number;cashFlowMicros:number;evidenceSha256:string}){
  const s=this.state,r=s.receipt,p=s.plan;
  if(s.phase!=='RECONCILE'||!r||!p||!r.orderId||r.orderId!==e.orderId||r.state!==e.state||! /^[a-f0-9]{64}$/.test(e.evidenceSha256)||!money(e.feeMicros)||!Number.isSafeInteger(e.cashFlowMicros)||e.quantity!==(e.state==='fill'?1:0)||e.quantity!==r.filled||(r.feeMicros!==null&&r.feeMicros!==e.feeMicros))throw Error('RECONCILIATION_MISMATCH');
  const leg=s.slot==='recovery'?p.recovery:p.entry[s.slot==='first'?0:1];
  const excess=e.feeMicros>leg.feeUpper*100||(s.slot!=='recovery'&&(-e.cashFlowMicros>(leg.draft.leg.limitPrice+leg.feeUpper)*100||e.cashFlowMicros>0))||(e.state!=='fill'&&(e.cashFlowMicros!==0||e.feeMicros!==0));
  if(excess){this.persist('RECONCILIATION_LIMIT_BREACH',{...s,phase:'UNKNOWN'},e);return;}
  const entryCashFlowMicros=s.slot==='first'&&e.state==='fill'?e.cashFlowMicros:s.entryCashFlowMicros;
  const realizedPnlMicros=s.slot==='recovery'&&e.state==='fill'&&entryCashFlowMicros!==null?entryCashFlowMicros+e.cashFlowMicros:s.realizedPnlMicros;
  const loss=realizedPnlMicros!==null&&realizedPnlMicros<0;
  const phase:Phase=loss?'LOSS':e.state==='fill'?(s.slot==='first'?'FIRST_FILLED':s.slot==='second'?'PAIRED':'STOPPED'):(s.slot==='second'?'RECOVERY_REQUIRED':s.slot==='recovery'?'UNKNOWN':'STOPPED');
  this.persist('ORDER_AND_FILLS_RECONCILED',{...s,phase,entryCashFlowMicros,realizedPnlMicros,loss},e);
 }
 recordRealizedLoss(lossMicros:number){if(!Number.isSafeInteger(lossMicros)||lossMicros<=0)throw Error('INVALID_LOSS');this.persist('REALIZED_LOSS_HARD_STOP',{...this.state,phase:'LOSS',loss:true},{lossMicros});}
 haltUnknown(reason:string){this.persist('UNKNOWN_EXPOSURE_HARD_STOP',{...this.state,phase:'UNKNOWN'},{reason});}
 close(){if(this.closed)return;if(this.fd>=0)closeSync(this.fd);this.closed=true;if(!this.failed)unlinkSync(this.lock);}
}
