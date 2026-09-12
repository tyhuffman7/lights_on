import {fractionalPayout} from './fractional.ts';
import type {State,Pair,Quote} from './types.ts';
import {defaults} from './types.ts';
import {integer,USD} from './core.ts';
export function initial():State{return {startedAt:null,settings:{...defaults},cash:{kalshi:500000,poly:500000},positions:[],pairs:[],logs:[],expenses:0,lastRun:0,version:0};}
export function totals(s:State){const cash=s.cash.kalshi+s.cash.poly;const committed=(s.makerReserved? s.makerReserved.kalshi+s.makerReserved.poly:0)+s.positions.reduce((n,p)=>n+(p.aPayout===undefined?p.aDebit:0)+(p.bPayout===undefined?p.bDebit:0),0);const realized=s.positions.reduce((n,p)=>n+(p.profit||0),0)-s.expenses;return {cash,committed,realized,equity:cash+committed};}
export function log(s:State,kind:string,message:string,now=Date.now()){s.logs=[{id:crypto.randomUUID(),at:now,kind,message},...s.logs].slice(0,200);}
export function enter(state:State,pair:Pair,q:Quote,id:string,now=Date.now()):State{
 if(!q.eligible)throw new Error('Quote did not pass all entry checks');
 if(state.positions.some(p=>p.id===id||p.status!=='settled'&&(p.pair.a.id===pair.a.id||p.pair.b.id===pair.b.id)))throw new Error('Duplicate or open pair');
 if(state.positions.length>=500)throw new Error('Journal limit reached; export your records');
 const aDebit=q.aFill.cost+q.aFill.fees+Math.ceil(q.reserve/2),bDebit=q.bFill.cost+q.bFill.fees+Math.floor(q.reserve/2);
 integer(aDebit,1);integer(bDebit,1);
 if(aDebit>state.cash.kalshi||bDebit>state.cash.poly||aDebit+bDebit>state.settings.maxTrade||totals(state).committed+aDebit+bDebit>state.settings.maxCommitted)throw new Error('Bankroll limit exceeded');
 const s=structuredClone(state);s.cash.kalshi-=aDebit;s.cash.poly-=bDebit;s.positions.unshift({id,pair,quote:q,openedAt:now,status:'open',aDebit,bDebit});log(s,'paper entry',`${q.quantity} paired contracts · ${pair.a.title}`,now);return s;
}
export function settle(state:State,id:string,a:number|null,b:number|null,now=Date.now()):State{
 const s=structuredClone(state),p=s.positions.find(p=>p.id===id);if(!p||p.status==='settled')return state;
 for(const [key,value,venue,side] of [['a',a,'kalshi',p.quote.aSide],['b',b,'poly',p.quote.bSide]] as const){
  if(value===null||p[`${key}Payout`]!==undefined)continue;integer(value,0,USD);
  const payout=fractionalPayout(p[key==='a'?'aQuantity':'bQuantity']??p.quote.quantity,side==='yes'?value:USD-value);p[`${key}Payout`]=payout;s.cash[venue]+=payout;
 }
 if(p.aPayout!==undefined&&p.bPayout!==undefined){p.status='settled';p.closedAt=now;p.profit=p.aPayout+p.bPayout-p.aDebit-p.bDebit;log(s,'settlement',`Both venues settled · ${p.pair.a.title}`,now);}
 return s;
}
