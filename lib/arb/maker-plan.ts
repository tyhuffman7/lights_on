import {assess} from './engine.ts';import type {Book,Pair,Settings} from './types.ts';
// Prospective resting Kalshi bid + immediate PM-US hedge. This is a plan, not a fill.
// Charge the existing taker fee on the maker leg until its exact fee is verified.
export function makerPlan(pair:Pair,a:Book,b:Book,settings:Settings,cash:{kalshi:number;poly:number},now=Date.now(),improve=false){
 const levels=(side:'yes'|'no')=>{const bid=(side==='yes'?a.yesBids:a.noBids)[0],ask=a[side][0];if(!bid||!ask||bid.price>=ask.price)return [];const nextCent=(Math.floor(bid.price/100)+1)*100;const price=improve&&nextCent<ask.price?nextCent:bid.price;return [{price,quantity:1000}];};
 const q=assess(pair,{...a,yes:levels('yes'),no:levels('no')},b,settings,cash,now);
 if(!q?.eligible)return null;
 const price=q.aFill.levels[0].price,ahead=(q.aSide==='yes'?a.yesBids:a.noBids).filter(l=>l.price>=price).reduce((n,l)=>n+l.quantity,0);
 return {quote:q,price,ahead,scope:'RESTING_QUOTE_PLAN_ONLY' as const,feeAssumption:'Kalshi taker fee charged conservatively; no maker rebate assumed'};
}
