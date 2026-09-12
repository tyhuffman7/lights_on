import type {State,Pair,Quote,Book} from './types.ts';
import {enter,log} from './ledger.ts';import {walk} from './engine.ts';import {USD} from './core.ts';
export function executePaper(state:State,pair:Pair,q:Quote,a:Book,b:Book,id:string,now=Date.now()):State{
 return completePaperHedge(enter(state,pair,q,id,now),id,a,b,now);
}
// Complete an already reserved paper entry. Allows the worker to persist before its hedge delay.
export function completePaperHedge(state:State,id:string,a:Book,b:Book,now=Date.now()):State{
 const s=structuredClone(state),p=s.positions.find(x=>x.id===id);
 if(!p||p.status!=='open')throw new Error('No pending paper entry');
 const pair=p.pair,q=p.quote;
 const bf=b.open&&now-b.receivedAt<=s.settings.maxAge&&b.receivedAt<=now+1000&&(b.exchangeAt===null||now-b.exchangeAt<=s.settings.maxAge)?walk(b[q.bSide],q.quantity,pair.b.feeRate!,pair.b.feeRounding):null;
 const limit=Math.max(...q.bFill.levels.map(x=>x.price));
 if(bf&&bf.levels.every(l=>l.price<=limit)&&bf.cost+bf.fees<=q.bFill.cost+q.bFill.fees){
  const improvement=q.bFill.cost+q.bFill.fees-bf.cost-bf.fees;s.cash.poly+=improvement;p.bDebit-=improvement;p.quote={...q,bFill:bf,cost:q.aFill.cost+bf.cost,fees:q.aFill.fees+bf.fees,profit:q.profit+improvement};return s;
 }
 // The first simulated leg filled, but the second did not. Refund only the absent leg.
 s.cash.poly+=p.bDebit;p.bDebit=0;p.bPayout=0;p.status='unmatched';
 const bids=q.aSide==='yes'?a.yesBids:a.noBids;
 const unwind=a.open&&now-a.receivedAt<=s.settings.maxAge?walk(bids.map(x=>({...x,price:USD-x.price})),q.quantity,pair.a.feeRate!,pair.a.feeRounding):null;
 if(unwind){const proceeds=q.quantity*USD-unwind.cost-unwind.fees;p.aPayout=proceeds;s.cash.kalshi+=proceeds;p.status='settled';p.closedAt=now;p.profit=proceeds-p.aDebit;p.unwindLoss=-p.profit;log(s,'failed hedge','Second leg disappeared; first leg unwound against refreshed bids. New entries paused for this run.',now);}
 else log(s,'unmatched','Second leg disappeared and unwind depth was unavailable. First leg remains exposed; entries blocked.',now);
 return s;
}
