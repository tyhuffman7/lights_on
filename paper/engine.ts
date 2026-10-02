import {randomUUID} from 'node:crypto';
import type {Level,Side,Venue} from '../lib/arb/types.ts';
import type {StreamBook} from '../lib/research/types.ts';
import {fresh} from '../lib/research/books.ts';
import {fee,feesForLevels,type FeeSchedule} from '../lib/research/fees.ts';
import type {ApprovedPair,Config} from './config.ts';

// Money is integer 1/10,000 USD; quantities are whole contracts.
export const USD = 10000;
export type Metadata = {at:number;approved:boolean;open:boolean;minQty:number;
  fees:Record<Venue,FeeSchedule>;yesPayout:Record<Venue,number|null>};
export type Leg = {side:Side;levels:Level[];notional:number;fees:number};
export type Position = {id:string;pair:ApprovedPair;quantity:number;timestamp:string;
  kalshi:Leg;poly:Leg;totalCost:number;lockedSettlementProfit:number;
  feeSchedules:Record<Venue,FeeSchedule>;bookReceipts:Record<Venue,number>;
  status:'open'|'early-exit'|'settled';closedAt?:string;exit?:Record<Venue,Leg>;
  proceeds?:number;pnl?:number;settlementPayouts?:Record<Venue,number>};
export type State = {version:1;configHash:string;positions:Position[]};

export function take(levels:Level[],quantity:number,bid=false):Level[]|null {
  const out:Level[]=[];let remaining=quantity;
  for(const level of [...levels].sort((a,b)=>bid?b.price-a.price:a.price-b.price)){
    if(!Number.isInteger(level.price)||level.price<=0||level.price>=USD||!Number.isFinite(level.quantity)||level.quantity<0)
      throw Error('Invalid executable depth');
    const q=Math.min(remaining,Math.floor(level.quantity));
    if(q>0){out.push({price:level.price,quantity:q});remaining-=q;}
    if(!remaining)return out;
  }
  return null;
}
export function quote(levels:Level[],quantity:number,side:Side,schedule:FeeSchedule,venue:Venue,bid=false):Leg|null {
  const consumed=take(levels,quantity,bid);if(!consumed)return null;
  const fees=venue==='kalshi'
    ? consumed.reduce((n,l)=>n+l.quantity*fee(1,l.price,schedule.rate,'ceil'),0)
    : feesForLevels(consumed,schedule);
  return {side,levels:consumed,notional:consumed.reduce((n,l)=>n+l.price*l.quantity,0),fees};
}
export function balances(state:State,config:Config){
  const cash={kalshi:Math.round(config.perVenueUsd*USD),poly:Math.round(config.perVenueUsd*USD)};
  let locked=0,pnl=0,settlementPnl=0,earlyExitPnl=0,conditionalProfit=0;
  for(const p of state.positions){
    for(const v of ['kalshi','poly'] as const){
      cash[v]-=p[v].notional+p[v].fees;
      if(p.status==='early-exit')cash[v]+=p.exit![v].notional-p.exit![v].fees;
      if(p.status==='settled')cash[v]+=p.settlementPayouts![v]*p.quantity;
    }
    if(p.status==='open'){locked+=p.totalCost;conditionalProfit+=p.lockedSettlementProfit;}
    else {pnl+=p.pnl!;if(p.status==='settled')settlementPnl+=p.pnl!;else earlyExitPnl+=p.pnl!;}
  }
  return {cash,capitalLocked:locked,cumulativePaperPnl:pnl,modeledSettlementPnl:settlementPnl,earlyExitPnl,
    conditionalOpenSettlementProfit:conditionalProfit,openPositions:state.positions.filter(p=>p.status==='open').length};
}
export function sizeEntry(k:StreamBook,p:StreamBook,meta:Metadata,config:Config,state:State){
  const b=balances(state,config),room=Math.round(config.capitalUsd*USD)-b.capitalLocked;
  let best:{quantity:number;kalshi:Leg;poly:Leg;totalCost:number}|null=null;
  for(const [ks,ps] of [['yes','no'],['no','yes']] as const){
    // Costs are increasing, so cap iteration by displayed whole depth and cash.
    const bound=Math.min(1000000,Math.floor(room/Math.max(1,(k[ks][0]?.price??USD)+(p[ps][0]?.price??USD))),
      k[ks].reduce((n,l)=>n+Math.floor(l.quantity),0),p[ps].reduce((n,l)=>n+Math.floor(l.quantity),0));
    for(let q=Math.max(1,Math.ceil(meta.minQty));q<=bound;q++){
      const a=quote(k[ks],q,ks,meta.fees.kalshi,'kalshi'),z=quote(p[ps],q,ps,meta.fees.poly,'poly');
      if(!a||!z)break;
      const kc=a.notional+a.fees,pc=z.notional+z.fees,totalCost=kc+pc;
      if(totalCost>room||kc>b.cash.kalshi||pc>b.cash.poly)break;
      if(totalCost<q*USD&&(!best||q>best.quantity||q===best.quantity&&totalCost<best.totalCost))
        best={quantity:q,kalshi:a,poly:z,totalCost};
    }
  }
  return best;
}
export function settle(position:Position,meta:Metadata,at:number){
  if(meta.yesPayout.kalshi===null||meta.yesPayout.poly===null)return false;
  const payouts={kalshi:position.kalshi.side==='yes'?meta.yesPayout.kalshi:USD-meta.yesPayout.kalshi,
    poly:position.poly.side==='yes'?meta.yesPayout.poly:USD-meta.yesPayout.poly};
  if(Object.values(payouts).some(p=>!Number.isInteger(p)||p<0||p>USD))throw Error('Invalid settlement payout');
  position.status='settled';position.closedAt=new Date(at).toISOString();position.settlementPayouts=payouts;
  position.proceeds=(payouts.kalshi+payouts.poly)*position.quantity;position.pnl=position.proceeds-position.totalCost;
  return true;
}
export function tick(pair:ApprovedPair,k:StreamBook|undefined,p:StreamBook|undefined,meta:Metadata|undefined,
  config:Config,state:State,at=Date.now(),mono=performance.now()):Position|null {
  if(!meta||at<meta.at||at-meta.at>config.metadataMaxAgeMs)return null;
  const open=state.positions.find(x=>x.pair.id===pair.id&&x.status==='open');
  if(open&&settle(open,meta,at))return open;
  if(!meta.approved||!meta.open||!k?.open||!p?.open||!fresh(k,mono,at,config.maxBookAgeMs)||!fresh(p,mono,at,config.maxBookAgeMs)
    ||Math.abs(k.receivedAt-p.receivedAt)>config.maxBookSkewMs)return null;
  if(open){
    const a=quote(k[open.kalshi.side+'Bids' as 'yesBids'|'noBids'],open.quantity,open.kalshi.side,meta.fees.kalshi,'kalshi',true),
      z=quote(p[open.poly.side+'Bids' as 'yesBids'|'noBids'],open.quantity,open.poly.side,meta.fees.poly,'poly',true);
    if(!a||!z)return null;
    const proceeds=a.notional+z.notional-a.fees-z.fees;
    if(proceeds<=open.totalCost)return null;
    open.status='early-exit';open.closedAt=new Date(at).toISOString();open.exit={kalshi:a,poly:z};
    open.proceeds=proceeds;open.pnl=proceeds-open.totalCost;return open;
  }
  const last=state.positions.filter(x=>x.pair.id===pair.id).at(-1);
  const lastAt=last?Date.parse(last.closedAt??last.timestamp):0;
  if(last&&(at-lastAt<30000||k.receivedAt<=lastAt||p.receivedAt<=lastAt))return null;
  const entry=sizeEntry(k,p,meta,config,state);if(!entry)return null;
  const position:Position={...entry,id:randomUUID(),pair:structuredClone(pair),timestamp:new Date(at).toISOString(),
    lockedSettlementProfit:entry.quantity*USD-entry.totalCost,status:'open',feeSchedules:structuredClone(meta.fees),
    bookReceipts:{kalshi:k.receivedAt,poly:p.receivedAt}};
  state.positions.push(position);return position;
}
