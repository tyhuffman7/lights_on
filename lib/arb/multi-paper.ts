import type {Book,Pair,Venue,Side} from './types.ts';
import {admission,newSession,reserve,accounting} from './ksu-paper.ts';
import type {Candidate,Constraints,Status,Session,PaperScope} from './ksu-paper.ts';
import {quoteCandidate} from '../screen/confirmation.ts';

export const multiPolicy=Object.freeze({mode:'REVIEWED_MULTI_MARKET_CONDITIONAL_PAPER',ordersEnabled:false,liveAdmitted:false,
  capitalPerVenue:500000,maxQuantity:10,maxReservation:150000,maxCommitted:450000,maxPositions:3,maxAttempts:5,
  maxRealizedLoss:20000,durationMs:3600000,transportMs:500,recoveryDelayMs:1000,maxRecoveryAttempts:1,
  riskPerContract:200,recoveryPerContract:{kalshi:100,poly:500},maxReconnects:3,
  coalesceMs:250,requestSpacingMs:2000,maxConfirmations:120,maxEvidenceBytes:256*1024*1024,
  horizon:'REVIEWED_CONTRACT_HORIZONS_NO_GUARANTEED_CASH_RELEASE',ohioLiveEligibility:'NOT_REVALIDATED_LIVE_BLOCKED',
  repeatedLiquidity:'AT_MOST_ONE_ENTRY_ATTEMPT_PER_REVIEWED_COMPARISON',positiveAfterFeesAndRisk:true} as const);
export type ReviewRow={pairId:string;kalshiId:string;polyId:string;sides:{kalshi:Side;poly:Side};reviewDepth:string;matcherAfter:string;settlementClassification:string;rank:number};
export const authorizedIds=['KXNCAAFB12QUAL-26-KSU','KXNCAAFCUSAQUAL-26-WKU','KXDWTSRANK-226DEC31-JSTIL','KXNCAAFPAC12-26-ORST','KXMLBAL-26-CWS'] as const;
export function reviewedRows(review:{rows:ReviewRow[]}){
  const retained=review.rows.filter(r=>r.matcherAfter==='UNVERIFIED');
  const authorized=retained.filter(r=>r.reviewDepth==='DEEP'&&r.settlementClassification==='CONDITIONAL'&&authorizedIds.some(id=>id===r.kalshiId));
  if(retained.length!==34||authorized.length!==5||new Set(authorized.map(r=>r.kalshiId)).size!==5)throw Error('REVIEW_SCOPE_CHANGED');
  return {retained,authorized};
}
export function rowScope(row:ReviewRow):PaperScope{return {kalshi:row.kalshiId,poly:row.polyId,aSide:row.sides.kalshi,bSide:row.sides.poly,maxReservation:multiPolicy.maxReservation,positiveOnly:true};}
export function bookFingerprint(a:Book|undefined,b:Book|undefined){return JSON.stringify([a?.yes,a?.no,a?.open,b?.yes,b?.no,b?.open]);}
export class MultiPaper{
  cash:Record<Venue,number>={kalshi:500000,poly:500000};entries:{row:ReviewRow;session:Session}[]=[];
  busy=false;halt:string|null=null;confirmations=0;reconnects=0;
  attempted=new Set<string>();
  allowed:ReviewRow[];
  constructor(review:{rows:ReviewRow[]}){this.allowed=reviewedRows(review).authorized;}
  authorized(row:ReviewRow){return this.allowed.some(r=>JSON.stringify(r)===JSON.stringify(row));}
  commitment(){return this.entries.reduce((total,{session:s})=>total+s.held.kalshi+s.held.poly+s.state.positions.filter(p=>p.status!=='settled').reduce((n,p)=>n+p.aDebit+p.bDebit,0),0);}
  openPositions(){return this.entries.reduce((n,{session:s})=>n+s.state.positions.filter(p=>p.status==='open').length,0);}
  realizedLoss(){return this.entries.reduce((n,{session:s})=>n+Math.max(0,s.recoveryLoss??0),0);}
  stopReason(){return this.halt??(this.realizedLoss()>=multiPolicy.maxRealizedLoss?'REALIZED_LOSS_TRIGGER':this.entries.length>=multiPolicy.maxAttempts?'FIVE_ENTRY_ATTEMPTS':this.openPositions()>=multiPolicy.maxPositions?'THREE_OPEN_POSITIONS':this.commitment()>=multiPolicy.maxCommitted||Math.min(this.cash.kalshi,this.cash.poly)<=0?'CAPACITY_EXHAUSTED':null);}
  gates(row:ReviewRow,pair:Pair,q:Candidate,status:Status,c:Constraints){
    const reasons=admission(pair,q,status,c,this.cash,rowScope(row)).reasons;
    if(!this.authorized(row))reasons.push('OBSERVATION_ONLY');
    if(this.stopReason())reasons.push(this.stopReason()!);
    if(this.attempted.has(row.pairId))reasons.push('COMPARISON_ALREADY_ATTEMPTED');
    if(q.economics&&this.commitment()+q.economics.reservedCash>multiPolicy.maxCommitted)reasons.push('TOTAL_COMMITMENT_CAP');
    return [...new Set(reasons)];
  }
  select(row:ReviewRow,pair:Pair,a:Book|undefined,b:Book|undefined,status:Status,c:Constraints,at:number){
    const compared=Array.from({length:10},(_,i)=>{const quote=quoteCandidate(pair,a,b,row.sides.kalshi,at,i+1);return {quote,reasons:this.gates(row,pair,quote,status,c)};});
    const eligible=compared.filter(x=>x.reasons.length===0).sort((a,b)=>b.quote.economics!.afterRisk-a.quote.economics!.afterRisk||a.quote.quantity-b.quote.quantity);
    const best=eligible[0]??[...compared].sort((a,b)=>(b.quote.economics?.afterRisk??-Infinity)-(a.quote.economics?.afterRisk??-Infinity))[0];
    return {selected:eligible[0]?.quote??null,best:best.quote,reasons:best.reasons,compared:compared.map(x=>({quantity:x.quote.quantity,afterRisk:x.quote.economics?.afterRisk??null,reservation:x.quote.economics?.reservedCash??null,reasons:x.reasons}))};
  }
  // Same-session bridge: exact discovery quantity -> requested proof -> reservation -> both modeled legs.
  async execute(row:ReviewRow,pair:Pair,original:Candidate,confirm:()=>Promise<{quote:Candidate;status:Status;constraints:Constraints;reasons:string[]}>,submit:(s:Session)=>Promise<void>,at:()=>number,mono:()=>number,canEnter:()=>boolean){
    if(this.busy)return {attempted:false,reasons:['SEQUENCE_BUSY']};
    this.busy=true;
    try{
      if(!this.authorized(row)||this.stopReason()||this.attempted.has(row.pairId))return {attempted:false,reasons:['ENTRY_SCOPE_OR_CAPACITY']};
      const proof=await confirm();
      const reasons=[...proof.reasons,...this.gates(row,pair,proof.quote,proof.status,proof.constraints)];
      if(original.quantity!==proof.quote.quantity||original.aSide!==proof.quote.aSide||original.bSide!==proof.quote.bSide||original.pairId!==proof.quote.pairId)reasons.push('CONFIRMED_CANDIDATE_CHANGED');
      if(!canEnter())reasons.push('SESSION_PAUSED_OR_DEADLINE');
      if(reasons.length)return {attempted:false,reasons:[...new Set(reasons)]};
      const session=newSession();session.state.cash=this.cash;
      reserve(session,pair,proof.quote,proof.status,proof.constraints,at(),mono(),rowScope(row));
      this.entries.push({row,session});this.attempted.add(row.pairId);
      try{await submit(session);}catch(error){this.halt='SUBMISSION_FAILURE_UNRESOLVED';throw error;}
      const a=accounting(session);
      if(Object.keys(session.results).length!==2||a.unresolvedPossibleInventory||session.state.positions.some(p=>p.status==='unmatched'))this.halt='UNRESOLVED_EXECUTION_EXPOSURE';
      return {attempted:true,reasons:[],accounting:a};
    }finally{this.busy=false;}
  }
  reconnect(now:number,deadline:number,count=1){if(this.halt||this.busy||now>=deadline||!Number.isSafeInteger(count)||count<1||this.reconnects+count>multiPolicy.maxReconnects)return false;this.reconnects+=count;return true;}
  summary(){return {cash:{...this.cash},committed:this.commitment(),openPairedPositions:this.openPositions(),attempts:this.entries.length,realizedPaperLoss:this.realizedLoss(),realizedProfit:this.entries.reduce((n,{session})=>n+(accounting(session).realizedProfit??0),0),halt:this.halt,reconnections:this.reconnects,holdings:this.entries.map(({row,session})=>({pairId:row.pairId,sides:row.sides,...accounting(session)}))};}
}
