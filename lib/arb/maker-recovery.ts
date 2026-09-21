import type {Book,State,Position} from './types.ts';
import {exitLeg} from './paper-exit.ts';
import {makerHedgeDecision,type MakerOrder,type HedgeDecision} from './maker-ledger.ts';
import {fractionalCost} from './fractional.ts';
import {recoveryPolicy} from './maker-allocation.ts';
// Called once, after cancellation is effective and all accepted tape is processed.
// Price comparison is a submission-time estimate, not a promised delayed sale.
export function submitMakerRecovery(o:MakerOrder,s:State,a:Book|null,now:number){
 if(o.recovery||!o.quote.makerAllocation||now<o.expiresAt||o.filledB||o.filledA<=0)throw Error('Invalid recovery submission');
 const position:Position={id:o.id,pair:o.pair,quote:o.quote,openedAt:o.placedAt,status:'unmatched',aQuantity:o.filledA,bQuantity:0,aDebit:0,bDebit:0,bPayout:0};
 const unwind=a?exitLeg(position,'a',a,s,now):null;
 const ceiling=unwind?Math.max(0,Math.min(o.reservedB,o.filledA*10000-unwind.proceeds)):0;
 o.recovery={submittedAt:now,quantity:o.filledA,ceiling,unwindProceeds:unwind?.proceeds??null,reason:unwind?'FIXED_BUDGET_HEDGE':'UNWIND_QUOTE_UNAVAILABLE',done:false};
 o.hedgeDue=now+recoveryPolicy.transportMs;
 return o.recovery;
}
// One full-size attempt. Never use an earlier cheap book or relax the ceiling.
export function executeMakerRecovery(o:MakerOrder,s:State,b:Book|null,valid:boolean,now:number):HedgeDecision{
 const intent=o.recovery;
 const reject=(reason:string):HedgeDecision=>({reason,remaining:o.filledA-o.filledB,fill:null});
 if(!intent)return reject('RECOVERY_NOT_SUBMITTED');
 if(intent.done)return reject('RECOVERY_ALREADY_ATTEMPTED');
 if(now<intent.submittedAt+recoveryPolicy.transportMs)return reject('NOT_YET_DUE');
 intent.done=true;
 if(!valid)return reject('OUTER_STATE_INVALID');
 if(intent.unwindProceeds===null)return reject('UNWIND_QUOTE_UNAVAILABLE');
 if(!b)return reject('BOOK_UNUSABLE');
 if(o.filledA!==intent.quantity||o.filledB)return reject('RECOVERY_QUANTITY_CHANGED');
 const decision=makerHedgeDecision(o,b,now,s.settings.maxAge),fill=decision.fill;
 if(decision.reason!=='SUCCESS'||!fill)return decision;
 const debit=fill.cost+fill.fees+fractionalCost(intent.quantity,Math.floor(s.settings.reserve/2));
 if(debit>intent.ceiling)return {...decision,reason:'RECOVERY_CEILING_EXCEEDED'};
 if(o.aCost+o.aFees+fractionalCost(o.filledA,Math.ceil(s.settings.reserve/2))>o.reservedA)return {...decision,reason:'MAKER_RESERVATION_EXCEEDED'};
 o.bLevels.push(...fill.levels);o.bCost+=fill.cost;o.bFees+=fill.fees;o.filledB=o.filledA;o.hedgeDue=null;
 return decision;
}
