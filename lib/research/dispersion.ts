import type {Book,Pair,Side,Level} from '../arb/types.ts';
import {feeSchedule,feeBounds} from './fees.ts';

export const dispersionPolicy=Object.freeze({version:1,ordersEnabled:false,ledgerAccess:false,
 durationMs:12*60*1000,maxRounds:10,minRoundMs:60000,perFamily:12,sportsPerStratum:6,
 sportsStrata:['nfl:winner','nfl:game-total','cfb:game-spread','mlb:game-total'],
 maxContracts:10,indicativeCapitalPerVenue:500000,requestSpacingMs:350,requestTimeoutMs:1500,
 maxReceiptSkewMs:500,maxReceiptAgeMs:2000,maxRequests:4000,maxConfirmations:24,confirmationDelayMs:2000,
 selection:'SHA256(pair ID), subfamily round-robin, one pair per PM market; price blind',
 scope:'SIMULTANEOUS_REQUESTED_REST_DISPERSION; STRICT_EXECUTABILITY_REPORTED_SEPARATELY; NO_FILLS'});
function fill(levels:Level[],q:number){
 let left=q,cost=0;const used:Level[]=[];
 for(const l of [...levels].sort((a,b)=>a.price-b.price)){
  if(!Number.isInteger(l.price)||l.price<=0||l.price>=10000||!Number.isFinite(l.quantity)||l.quantity<0)throw Error('Invalid public depth');
  const n=Math.min(left,Math.floor(l.quantity));if(n>0){used.push({price:l.price,quantity:n});left-=n;cost+=n*l.price;}if(left===0)break;
 }
 return left===0?{cost,levels:used}:null;
}
export function dispersionQuote(pair:Pair,a:Book,b:Book,aSide:Side,q:number){
 const bSide:Side=pair.inverted?aSide:aSide==='yes'?'no':'yes';
 if(![pair.a.minQty,pair.b.minQty].every(n=>Number.isFinite(n)&&n>0)||!Number.isInteger(q)||q<Math.max(1,pair.a.minQty,pair.b.minQty)||q>dispersionPolicy.maxContracts)return null;
 const ks=feeSchedule(pair.a),ps=feeSchedule(pair.b);if(!ks||!ps||!a.open||!b.open)return null;
 const af=fill(a[aSide],q),bf=fill(b[bSide],q);if(!af||!bf)return null;
 const ka=feeBounds(af.levels,ks),pb=feeBounds(bf.levels,ps);
 const raw=q*10000-af.cost-bf.cost,net=raw-ka.upper-pb.upper;
 return {aSide,bSide,quantity:q,rawGap:raw/q,feeNetGap:net/q,rawSurplus:raw,feeNetSurplus:net,
  estimatedFeeNetSurplus:raw-ka.estimated-pb.estimated,feeUpper:ka.upper+pb.upper,
  kalshiCost:af.cost+ka.upper,polyCost:bf.cost+pb.upper,kalshiLevels:af.levels,polyLevels:bf.levels,
  smallCapital:af.cost+ka.upper<=dispersionPolicy.indicativeCapitalPerVenue&&bf.cost+pb.upper<=dispersionPolicy.indicativeCapitalPerVenue};
}
export type DispersionQuote=NonNullable<ReturnType<typeof dispersionQuote>>;
// One interval per direction, across quantity changes and repeated samples.
// Missing evidence censors it; reopening after missing data is not a confirmed
// independent opportunity. Durations are sampled spans, never continuous proof.
export class DispersionIntervals {
 active=new Map<string,{key:string;firstAt:number;lastAt:number;samples:number;quantities:number[];leftCensored:boolean}>();
 completed:(ReturnType<DispersionIntervals['end']>)[]=[];
 lastState=new Map<string,'positive'|'nonpositive'|'unknown'>();
 end(key:string,at:number,reason:string){const row=this.active.get(key)!;this.active.delete(key);return {...row,endAt:at,spanMs:row.lastAt-row.firstAt,reason};}
 sample(key:string,at:number,quotes:DispersionQuote[]|null){
  const positive=quotes?.filter(q=>q.feeNetSurplus>0&&q.smallCapital)??[], previous=this.lastState.get(key);
  if(positive.length){let row=this.active.get(key);if(!row){row={key,firstAt:at,lastAt:at,samples:0,quantities:[],leftCensored:previous!=='nonpositive'};this.active.set(key,row);}row.lastAt=at;row.samples++;row.quantities=[...new Set([...row.quantities,...positive.map(q=>q.quantity)])].sort((a,b)=>a-b);this.lastState.set(key,'positive');return row.samples===1;}
  if(this.active.has(key))this.completed.push(this.end(key,at,quotes===null?'DATA_GAP_CENSORED':'NONPOSITIVE'));
  this.lastState.set(key,quotes===null?'unknown':'nonpositive');return false;
 }
 stop(at:number){for(const key of [...this.active.keys()])this.completed.push(this.end(key,at,'END_RIGHT_CENSORED'));}
}
