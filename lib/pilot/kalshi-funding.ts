// Funding evidence only: no trading/settlement coverage, cash credit, or subaccount
// attribution. The source endpoint is account-wide; transfers need separate proof.
export function assessKalshiFunding(deposits:unknown[],withdrawals:unknown[],observedAt:number){
 if(!Array.isArray(deposits)||!Array.isArray(withdrawals)||!Number.isSafeInteger(observedAt)||observedAt<=0)throw Error('Complete funding history and observation time required');
 const records=new Map<string,{id:string;expectedDepositMicros:number;earliestAppliedAt:number;latestAppliedAt:number;timeBasis:'FINALIZED_TIMESTAMP'|'OBSERVED_APPLIED_BOUND'}>(),unresolved:string[]=[];
 for(const raw of deposits){
  try{
   const r=raw as any;
   if(!r||typeof r!=='object'||typeof r.id!=='string'||!r.id||r.status!=='applied')throw Error('DEPOSIT_NOT_PROVEN_APPLIED');
   if(!Number.isSafeInteger(r.amount_cents)||r.amount_cents<=0||!Number.isSafeInteger(r.amount_cents*10000)||r.fee_cents!==0)throw Error('DEPOSIT_AMOUNT_OR_FEE_UNSUPPORTED');
   if(!Number.isSafeInteger(r.created_ts)||r.created_ts<=0||!Number.isSafeInteger(r.created_ts*1000)||r.created_ts*1000>observedAt)throw Error('DEPOSIT_CREATION_TIME_INVALID');
   let latest=observedAt,basis:'FINALIZED_TIMESTAMP'|'OBSERVED_APPLIED_BOUND'='OBSERVED_APPLIED_BOUND';
   if(Object.hasOwn(r,'finalized_ts')){
    if(!Number.isSafeInteger(r.finalized_ts)||r.finalized_ts<r.created_ts||!Number.isSafeInteger(r.finalized_ts*1000)||r.finalized_ts*1000>observedAt)throw Error('DEPOSIT_FINAL_TIME_INVALID');
    latest=r.finalized_ts*1000;basis='FINALIZED_TIMESTAMP';
   }
   const item={id:r.id,expectedDepositMicros:r.amount_cents*10000,earliestAppliedAt:r.created_ts*1000,latestAppliedAt:latest,timeBasis:basis};
   const old=records.get(r.id);if(old&&JSON.stringify(old)!==JSON.stringify(item))throw Error('CONFLICTING_DEPOSIT');records.set(r.id,item);
  }catch(e){unresolved.push(e instanceof Error?e.message:'UNKNOWN_DEPOSIT');}
 }
 // No actual withdrawal sample or fee semantics validated yet. Never infer zero
 // movement for an unsupported or pending withdrawal.
 if(withdrawals.length)unresolved.push('WITHDRAWAL_SEMANTICS_UNVALIDATED');
 return {records:[...records.values()],unresolved,complete:unresolved.length===0,coverage:'FUNDING_ONLY' as const,subaccountAttributionVerified:false as const,creditAuthorized:false as const};
}
