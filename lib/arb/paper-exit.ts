import type {Book,Position,State,Venue,Side} from './types.ts';
import {fractionalWalk} from './maker-ledger.ts';
import {quantityUnits} from './fractional.ts';
import {log} from './ledger.ts';
export type ExitLeg={key:'a'|'b';venue:Venue;side:Side;quantity:number;proceeds:number;fees:number;reserve:number;limit:number;book:Book};
export type ExitPlan={reason?:'profit-taking'|'unhedged-recovery';positionId:string;requestedAt:number;legs:ExitLeg[];profit:number};
// Full-size paper IOC sell against bids. Conservative fees + execution reserve.
export function exitLeg(p:Position,key:'a'|'b',book:Book,s:State,now:number):ExitLeg|null{
 const m=p.pair[key],side=key==='a'?p.quote.aSide:p.quote.bSide,q=p[key==='a'?'aQuantity':'bQuantity']??p.quote.quantity;
 if(p[`${key}Payout`]!==undefined||!q||!m.open||m.feeRate===null||!book.open||now-book.receivedAt>s.settings.maxAge||book.receivedAt>now||book.exchangeAt!==null&&(now-book.exchangeAt>s.settings.maxAge||book.exchangeAt>now))return null;
 const step=quantityUnits(m.minQty);if(!step||quantityUnits(q)%step!==0)return null;
 const bids=side==='yes'?book.yesBids:book.noBids;
 const fill=fractionalWalk(bids.map(l=>({price:10000-l.price,quantity:l.quantity})),q,m.feeRate,m.venue==='poly'?'even':'ceil');if(!fill)return null;
 const reserve=Math.ceil(q*s.settings.reserve/2),proceeds=Math.round(q*10000)-fill.cost-fill.fees-reserve;if(proceeds<0)return null;
 return {key,venue:key==='a'?'kalshi':'poly',side,quantity:q,proceeds,fees:fill.fees,reserve,limit:Math.min(...fill.levels.map(l=>10000-l.price)),book:structuredClone(book)};
}
export function planExit(s:State,id:string,books:Partial<Record<'a'|'b',Book>>,now=Date.now()):ExitPlan|null{
 const p=s.positions.find(p=>p.id===id);if(!p||p.status==='settled'||s.makerReserved)return null;
 const legs:ExitLeg[]=[];
 for(const key of ['a','b'] as const){if(p[`${key}Payout`]!==undefined)continue;const b=books[key],leg=b&&exitLeg(p,key,b,s,now);if(!leg)return null;legs.push(leg);}
 if(!legs.length)return null;
 const profit=(p.aPayout??0)+(p.bPayout??0)+legs.reduce((n,l)=>n+l.proceeds,0)-p.aDebit-p.bDebit;
 // One outstanding leg has no remaining paired hedge. Recover positive net
 // proceeds even at a loss; never increase exposure or spend additional cash.
 const recovery=p.status==='unmatched'&&legs.length===1&&legs[0].proceeds>0;
 return recovery||profit>=s.settings.minProfit?{reason:recovery?'unhedged-recovery':'profit-taking',positionId:id,requestedAt:now,legs,profit}:null;
}
// Each leg is persisted separately. No atomic cross-venue fill assumption.
export function applyExitLeg(state:State,plan:ExitPlan,key:'a'|'b',book:Book,now=Date.now(),scope:'DELAYED_REST_DEPTH_PAPER_NOT_REAL_FILL'|'DELAYED_STREAM_DEPTH_PAPER_NOT_REAL_FILL'='DELAYED_REST_DEPTH_PAPER_NOT_REAL_FILL'):State{
 if(now<plan.requestedAt+500)throw Error('Paper exit transport delay not elapsed');
 const p=state.positions.find(p=>p.id===plan.positionId),wanted=plan.legs.find(l=>l.key===key);
 if(!p||!wanted||p.status==='settled'||p[`${key}Payout`]!==undefined||state.makerReserved)throw Error('No outstanding exit holding');
 const actual=exitLeg(p,key,book,state,now);
 if(!actual||actual.quantity!==wanted.quantity||actual.side!==wanted.side||actual.limit<wanted.limit||actual.proceeds<wanted.proceeds)return state;
 const s=structuredClone(state),next=s.positions.find(p=>p.id===plan.positionId)!;
 next[`${key}Payout`]=actual.proceeds;s.cash[actual.venue]+=actual.proceeds;
 (next.paperExits??=[]).push({...actual,reason:plan.reason??'profit-taking',requestedAt:plan.requestedAt,filledAt:now,scope});
 if(next.aPayout!==undefined&&next.bPayout!==undefined){next.status='settled';next.closedBy='early-exit';next.closedAt=now;next.profit=next.aPayout+next.bPayout-next.aDebit-next.bDebit;}
 else next.status='unmatched';
 log(s,'paper exit',`${actual.quantity} ${actual.venue} ${actual.side} sold in delayed depth model; ${next.status==='settled'?'position closed':'remaining leg retained as exposure'}`,now);
 return s;
}
