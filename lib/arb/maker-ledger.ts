import type {State,Pair,Quote,Book,Fill,Settings} from './types.ts';
import {totals,log} from './ledger.ts';
import {quantityUnits,fractionalCost,fractionalFee,makerFillFee,polyFractionalOrderFee} from './fractional.ts';
import {makerAllocation} from './maker-allocation.ts';
export {fractionalCost} from './fractional.ts';
const SCALE=10000;
export function fractionalWalk(levels:Book['yes'],quantity:number,rate:number,rounding:'ceil'|'even'='ceil'):Fill|null{
 let left=quantityUnits(quantity),cost=0,fees=0;const used=[];
 for(const l of [...levels].sort((a,b)=>a.price-b.price)){
  const n=Math.min(left,quantityUnits(l.quantity));if(!n)continue;const q=n/SCALE;
  cost+=fractionalCost(q,l.price);fees+=fractionalFee(q,l.price,rate);used.push({price:l.price,quantity:q});left-=n;if(!left)break;
 }
 return left?null:{quantity,cost,fees:rounding==='even'?polyFractionalOrderFee(used,rate):fees,levels:used};
}
export type MakerOrder={recovery?:{submittedAt:number;quantity:number;ceiling:number;unwindProceeds:number|null;reason:string;done:boolean};cancelRequestedAt?:number;activationChecked?:boolean;makerFeeProfile?:import('./maker-fees.ts').MakerFeeProfile;clock?:import('./clock-window.ts').ClockWindow;id:string;pair:Pair;quote:Quote;placedAt:number;activeAt:number;expiresAt:number;price:number;
 reservedA:number;reservedB:number;filledA:number;filledB:number;aCost:number;aFees:number;bCost:number;bFees:number;hedgeDue:number|null;tradeIds:string[];initialQueueAhead?:number;bLevels:Fill['levels'];};
export function reserveMaker(state:State,pair:Pair,quote:Quote,id:string,price:number,now=Date.now()):{state:State;order:MakerOrder}{
 if(state.makerReserved||!quote.eligible||quote.aFill.levels.some(l=>l.price!==price)||state.positions.length>=500||state.positions.some(p=>p.id===id||p.status!=='settled'&&(p.pair.a.id===pair.a.id||p.pair.b.id===pair.b.id)))throw Error('Maker reservation rejected');
 const allocation=state.settings.makerRecovery?makerAllocation(quote):undefined;
 if(allocation&&JSON.stringify(allocation)!==JSON.stringify(quote.makerAllocation))throw Error('Maker allocation mismatch');
 const reservedA=allocation?.kalshi??(quote.aFill.cost+quote.aFill.fees+Math.ceil(quote.reserve/2)),reservedB=allocation?.poly??(quote.bFill.cost+quote.bFill.fees+Math.floor(quote.reserve/2));
 if(reservedA>state.cash.kalshi||reservedB>state.cash.poly||reservedA+reservedB>state.settings.maxTrade||totals(state).committed+reservedA+reservedB>state.settings.maxCommitted)throw Error('Maker bankroll limit');
 const s=structuredClone(state);s.cash.kalshi-=reservedA;s.cash.poly-=reservedB;s.makerReserved={kalshi:reservedA,poly:reservedB};
 return {state:s,order:{id,pair:structuredClone(pair),quote:structuredClone(quote),placedAt:now,activeAt:now+500,expiresAt:now+2000,price,reservedA,reservedB,filledA:0,filledB:0,aCost:0,aFees:0,bCost:0,bFees:0,hedgeDue:null,tradeIds:[],bLevels:[]}};
}
export function makerFill(order:MakerOrder,quantity:number,now:number){
 const n=quantityUnits(quantity);if(!n||quantityUnits(order.filledA)+n>quantityUnits(order.quote.quantity))throw Error('Invalid maker fill quantity');
 order.aCost+=fractionalCost(quantity,order.price);order.aFees+=makerFillFee(quantity,order.price,order.makerFeeProfile?.rate??order.pair.a.feeRate!);order.filledA=(quantityUnits(order.filledA)+n)/SCALE;order.hedgeDue??=now+500;
 // Fragmentation can consume more fees than the initial quote; the ledger records it,
 // then the worker closes/halt-checks this order rather than silently dropping exposure.
}
// Reprice all potential remaining exposure, including fills already received.
// This only requests cancellation; it cannot erase fills racing that request.
export function makerHedgeViable(order:MakerOrder,b:Book,settings:Settings){
 const remainingB=(quantityUnits(order.quote.quantity)-quantityUnits(order.filledB))/SCALE;
 if(!remainingB)return true;
 const step=quantityUnits(order.pair.b.minQty);
 if(!step||remainingB<order.pair.b.minQty||quantityUnits(remainingB)%step!==0)return false;
 const fill=fractionalWalk(b[order.quote.bSide],remainingB,order.pair.b.feeRate!,'even');if(!fill)return false;
 const remainingA=(quantityUnits(order.quote.quantity)-quantityUnits(order.filledA))/SCALE;
 const a=order.aCost+order.aFees+fractionalCost(remainingA,order.price)+makerFillFee(remainingA,order.price,order.makerFeeProfile?.rate??order.pair.a.feeRate!);
 const bDebit=order.bCost+order.bFees+fill.cost+fill.fees;
 const outlay=a+bDebit+order.quote.reserve,profit=order.quote.quantity*SCALE-outlay;
 return a+Math.ceil(order.quote.reserve/2)<=order.reservedA&&bDebit+Math.floor(order.quote.reserve/2)<=order.reservedB&&profit>=settings.minProfit&&profit/outlay*100>=settings.minRoi;
}
export type HedgeDecision={reason:string;remaining:number;fill:Fill|null};
// Same gates and precedence as execution. A false decision never mutates the order.
export function makerHedgeDecision(order:MakerOrder,b:Book,now:number,maxAge:number):HedgeDecision{
 const remaining=(quantityUnits(order.filledA)-quantityUnits(order.filledB))/SCALE;
 const reject=(reason:string):HedgeDecision=>({reason,remaining,fill:null});
 if(!remaining)return reject('NO_EXPOSURE');
 if(remaining<order.pair.b.minQty||quantityUnits(remaining)%quantityUnits(order.pair.b.minQty)!==0)return reject('QUANTITY_INVALID');
 if(order.hedgeDue===null)return reject('DUE_MISSING');
 if(now<order.hedgeDue)return reject('NOT_YET_DUE');
 if(!b.open)return reject('BOOK_CLOSED');
 if(now-b.receivedAt>maxAge)return reject('RECEIPT_STALE');
 if(b.receivedAt>now+1000)return reject('RECEIPT_FUTURE');
 if(b.exchangeAt!==null&&now-b.exchangeAt>maxAge)return reject('EXCHANGE_STALE');
 if(b.exchangeAt!==null&&b.exchangeAt>now+1000)return reject('EXCHANGE_FUTURE');
 const fill=fractionalWalk(b[order.quote.bSide],remaining,order.pair.b.feeRate!,'even');
 if(!fill)return reject('INSUFFICIENT_FULL_DEPTH');
 return {reason:order.bCost+order.bFees+fill.cost+fill.fees>order.reservedB?'RESERVATION_EXCEEDED':'SUCCESS',remaining,fill};
}
export function hedgeMaker(order:MakerOrder,b:Book,now:number,maxAge:number,record?:(decision:HedgeDecision)=>void){
 const decision=makerHedgeDecision(order,b,now,maxAge),fill=decision.fill;
 if(decision.reason!=='SUCCESS'||!fill){record?.(decision);return false;}
 order.bLevels.push(...fill.levels);order.bCost+=fill.cost;order.bFees+=fill.fees;order.filledB=order.filledA;order.hedgeDue=null;record?.(decision);return true;
}
export function closeMaker(state:State,order:MakerOrder,now=Date.now()):State{
 if(!state.makerReserved||state.makerReserved.kalshi!==order.reservedA||state.makerReserved.poly!==order.reservedB)throw Error('Maker reservation mismatch');
 const s=structuredClone(state),aDebit=order.aCost+order.aFees+fractionalCost(order.filledA,Math.ceil(s.settings.reserve/2)),bDebit=order.bCost+order.bFees+fractionalCost(order.filledB,Math.floor(s.settings.reserve/2));
 s.cash.kalshi+=order.reservedA-aDebit;s.cash.poly+=order.reservedB-bDebit;delete s.makerReserved;
 if(!order.filledA){log(s,'maker cancelled','Resting paper order expired/cancelled without a modeled fill',now);return s;}
 const q={...order.quote,quantity:order.filledA,aFill:{quantity:order.filledA,cost:order.aCost,fees:order.aFees,levels:[{price:order.price,quantity:order.filledA}]},bFill:{quantity:order.filledB,cost:order.bCost,fees:order.bFees,levels:order.bLevels},cost:order.aCost+order.bCost,fees:order.aFees+order.bFees,reserve:aDebit+bDebit-order.aCost-order.bCost-order.aFees-order.bFees,payout:Math.min(order.filledA,order.filledB)*10000,profit:Math.min(order.filledA,order.filledB)*10000-aDebit-bDebit};
 q.roi=q.profit/(aDebit+bDebit)*100;
 q.reasons=[...order.quote.reasons];
 if(q.profit<s.settings.minProfit||q.roi<s.settings.minRoi)q.reasons.push('Actual fill net edge below threshold');
 q.eligible=q.reasons.length===0;
 s.positions.unshift({id:order.id,pair:order.pair,quote:q,openedAt:order.placedAt,status:order.filledA===order.filledB?'open':'unmatched',aQuantity:order.filledA,bQuantity:order.filledB,aDebit,bDebit,...(!order.filledB?{bPayout:0}:{}),executionModel:'maker-public-tape',makerEvidence:{clock:order.clock,makerFeeProfile:order.makerFeeProfile,publicTradeIds:order.tradeIds,initialQueueAhead:order.initialQueueAhead??0,activeAt:order.activeAt,expiresAt:order.expiresAt}});
 log(s,'maker paper fill',`${order.filledA} first-leg contracts, ${order.filledB} hedged; simulated public-tape queue model`,now);return s;
}
