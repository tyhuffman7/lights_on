import type {State,Pair,Quote,Book,Fill} from './types.ts';
import {totals,log} from './ledger.ts';
import {quantityUnits,fractionalCost,fractionalFee} from './fractional.ts';
export {fractionalCost} from './fractional.ts';
const SCALE=10000;
export function fractionalWalk(levels:Book['yes'],quantity:number,rate:number):Fill|null{
 let left=quantityUnits(quantity),cost=0,fees=0;const used=[];
 for(const l of [...levels].sort((a,b)=>a.price-b.price)){
  const n=Math.min(left,quantityUnits(l.quantity));if(!n)continue;const q=n/SCALE;
  cost+=fractionalCost(q,l.price);fees+=fractionalFee(q,l.price,rate);used.push({price:l.price,quantity:q});left-=n;if(!left)break;
 }
 return left?null:{quantity,cost,fees,levels:used};
}
export type MakerOrder={id:string;pair:Pair;quote:Quote;placedAt:number;activeAt:number;expiresAt:number;price:number;
 reservedA:number;reservedB:number;filledA:number;filledB:number;aCost:number;aFees:number;bCost:number;bFees:number;hedgeDue:number|null;tradeIds:string[];initialQueueAhead?:number;bLevels:Fill['levels'];};
export function reserveMaker(state:State,pair:Pair,quote:Quote,id:string,price:number,now=Date.now()):{state:State;order:MakerOrder}{
 if(state.makerReserved||!quote.eligible||quote.aFill.levels.some(l=>l.price!==price)||state.positions.length>=500||state.positions.some(p=>p.id===id||p.status!=='settled'&&(p.pair.a.id===pair.a.id||p.pair.b.id===pair.b.id)))throw Error('Maker reservation rejected');
 const reservedA=quote.aFill.cost+quote.aFill.fees+Math.ceil(quote.reserve/2),reservedB=quote.bFill.cost+quote.bFill.fees+Math.floor(quote.reserve/2);
 if(reservedA>state.cash.kalshi||reservedB>state.cash.poly||reservedA+reservedB>state.settings.maxTrade||totals(state).committed+reservedA+reservedB>state.settings.maxCommitted)throw Error('Maker bankroll limit');
 const s=structuredClone(state);s.cash.kalshi-=reservedA;s.cash.poly-=reservedB;s.makerReserved={kalshi:reservedA,poly:reservedB};
 return {state:s,order:{id,pair:structuredClone(pair),quote:structuredClone(quote),placedAt:now,activeAt:now+500,expiresAt:now+2000,price,reservedA,reservedB,filledA:0,filledB:0,aCost:0,aFees:0,bCost:0,bFees:0,hedgeDue:null,tradeIds:[],bLevels:[]}};
}
export function makerFill(order:MakerOrder,quantity:number,now:number){
 const n=quantityUnits(quantity);if(!n||quantityUnits(order.filledA)+n>quantityUnits(order.quote.quantity))throw Error('Invalid maker fill quantity');
 order.aCost+=fractionalCost(quantity,order.price);order.aFees+=fractionalFee(quantity,order.price,order.pair.a.feeRate!);order.filledA=(quantityUnits(order.filledA)+n)/SCALE;order.hedgeDue??=now+500;
 // Fragmentation can consume more fees than the initial quote; the ledger records it,
 // then the worker closes/halt-checks this order rather than silently dropping exposure.
}
export function hedgeMaker(order:MakerOrder,b:Book,now:number,maxAge:number){
 const remaining=(quantityUnits(order.filledA)-quantityUnits(order.filledB))/SCALE;
 if(!remaining||remaining<order.pair.b.minQty||order.hedgeDue===null||now<order.hedgeDue||!b.open||now-b.receivedAt>maxAge||b.receivedAt>now+1000||(b.exchangeAt!==null&&(now-b.exchangeAt>maxAge||b.exchangeAt>now+1000)))return false;
 const fill=fractionalWalk(b[order.quote.bSide],remaining,order.pair.b.feeRate!);if(!fill||order.bCost+order.bFees+fill.cost+fill.fees>order.reservedB)return false;
 order.bLevels.push(...fill.levels);order.bCost+=fill.cost;order.bFees+=fill.fees;order.filledB=order.filledA;order.hedgeDue=null;return true;
}
export function closeMaker(state:State,order:MakerOrder,now=Date.now()):State{
 if(!state.makerReserved||state.makerReserved.kalshi!==order.reservedA||state.makerReserved.poly!==order.reservedB)throw Error('Maker reservation mismatch');
 const s=structuredClone(state),aDebit=order.aCost+order.aFees+fractionalCost(order.filledA,Math.ceil(s.settings.reserve/2)),bDebit=order.bCost+order.bFees+fractionalCost(order.filledB,Math.floor(s.settings.reserve/2));
 s.cash.kalshi+=order.reservedA-aDebit;s.cash.poly+=order.reservedB-bDebit;delete s.makerReserved;
 if(!order.filledA){log(s,'maker cancelled','Resting paper order expired/cancelled without a modeled fill',now);return s;}
 const q={...order.quote,quantity:order.filledA,aFill:{quantity:order.filledA,cost:order.aCost,fees:order.aFees,levels:[{price:order.price,quantity:order.filledA}]},bFill:{quantity:order.filledB,cost:order.bCost,fees:order.bFees,levels:order.bLevels},cost:order.aCost+order.bCost,fees:order.aFees+order.bFees,reserve:aDebit+bDebit-order.aCost-order.bCost-order.aFees-order.bFees,payout:Math.min(order.filledA,order.filledB)*10000,profit:Math.min(order.filledA,order.filledB)*10000-aDebit-bDebit};
 s.positions.unshift({id:order.id,pair:order.pair,quote:q,openedAt:order.placedAt,status:order.filledA===order.filledB?'open':'unmatched',aQuantity:order.filledA,bQuantity:order.filledB,aDebit,bDebit,...(!order.filledB?{bPayout:0}:{}),executionModel:'maker-public-tape',makerEvidence:{publicTradeIds:order.tradeIds,initialQueueAhead:order.initialQueueAhead??0,activeAt:order.activeAt,expiresAt:order.expiresAt}});
 log(s,'maker paper fill',`${order.filledA} first-leg contracts, ${order.filledB} hedged; simulated public-tape queue model`,now);return s;
}
