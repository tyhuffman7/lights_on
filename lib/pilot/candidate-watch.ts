import type {Pair, Venue, Side} from '../arb/types.ts';
import type {StreamBook} from '../research/types.ts';
import type {FamilyProof, RouteProof} from '../research/family-settlement.ts';
import {practicalSettlement,quoteBounded,conservativeFee,type Quote,type FeeEvidence} from './bounded-basis.ts';

// Observation authorization is independent of every account/submission gate.
export const candidateWatchPolicy=Object.freeze({version:1,ordersEnabled:false,liveSubmission:'LIVE_SUBMISSION_BLOCKED',
 durationMs:7200000,concurrentRoutes:60,shardDwellMs:90000,metadataMaxAgeMs:180000,
 heartbeatMs:10000,sampleMs:250,maxConfirmations:240,confirmationSpacingMs:5000,
 maxReconnectsPerVenue:3,httpSpacingMs:300,admissionCushion:0,
 selectionNoise:'ONE_ADVERSE_NATIVE_TICK_ON_EACH_LEG; REPRICE_SAME_QUANTITY; NOT_A_SETTLEMENT_PENALTY'});
export type WatchEntry={pair:Pair;family:FamilyProof;proof:RouteProof};
export function watchUniverse(entries:WatchEntry[]){
 if(new Set(entries.map(e=>e.pair.id)).size!==entries.length)throw Error('DUPLICATE_ROUTE');
 return entries.filter(e=>practicalSettlement(e.family,e.proof).ordinaryComplementary);
}
export function scheduleShards(entries:WatchEntry[],now:number){
 const time=(e:WatchEntry)=>Math.max(Date.parse(e.pair.a.closeAt)||Infinity,Date.parse(e.pair.b.closeAt)||Infinity);
 const sorted=[...entries].sort((a,b)=>Number(time(a)<=now)-Number(time(b)<=now)||time(a)-time(b)||a.pair.id.localeCompare(b.pair.id));
 const sports=sorted.filter(e=>e.pair.a.identity?.sports||e.pair.b.identity?.sports),other=sorted.filter(e=>!sports.includes(e)),shards:WatchEntry[][]=[];
 while(sports.length||other.length){const s=[...sports.splice(0,30),...other.splice(0,30)];s.push(...sports.splice(0,60-s.length));s.push(...other.splice(0,60-s.length));shards.push(s);}return shards;
}
export function rankWatchQuotes(a:{quote:Quote;depth:number},b:{quote:Quote;depth:number}){
 return b.quote.feeNetProfit-a.quote.feeNetProfit||b.quote.returnOnCommitted-a.quote.returnOnCommitted||a.quote.expectedReleaseAt-b.quote.expectedReleaseAt||b.depth-a.depth||a.quote.pairId.localeCompare(b.quote.pairId);
}
export function noiseResilience(q:Quote,fees:Record<Venue,FeeEvidence>,ticks:Record<Venue,number>){
 if(Object.values(ticks).some(t=>!Number.isSafeInteger(t)||t<=0))return {worthwhile:false,reason:'NATIVE_PRICE_GRID_UNPROVEN',stressedProfit:null};
 let debit=0;for(const v of ['kalshi','poly'] as const){const price=q[v].levels.at(-1)!.price+ticks[v];if(price>=10000)return {worthwhile:false,reason:'NO_ADVERSE_TICK_INSIDE_PRICE_GRID',stressedProfit:null};debit+=price*q.quantity+conservativeFee([{price:Math.min(5000,price),quantity:q.quantity}],fees[v]);}
 const profit=q.ordinaryPayout-debit;return {worthwhile:profit>0&&debit+q.recoveryCash<=50000,reason:profit>0?'NATIVE_TICK_STRESS_POSITIVE':'EDGE_SMALLER_THAN_NATIVE_TICK_NOISE',stressedProfit:profit};
}
export function routeEconomics(pair:Pair,books:Record<Venue,StreamBook>,side:Side,fees:Record<Venue,FeeEvidence>,releaseAt:number,now:number){
 const bSide=pair.inverted?side:side==='yes'?'no':'yes';
 const a=books.kalshi[side],b=books.poly[bSide],minimum=Math.max(1,Math.ceil(pair.a.minQty),Math.ceil(pair.b.minQty));
 const take=(levels:typeof a)=>{let left=minimum,cost=0;for(const l of [...levels].sort((x,y)=>x.price-y.price)){const q=Math.min(left,l.quantity);cost+=q*l.price;left-=q;if(left<=1e-8)break;}return left<=1e-8?cost:null;};
 const ac=take(a),bc=take(b),depthAvailable=ac!==null&&bc!==null;
 const rawProfit=depthAvailable?minimum*10000-ac!-bc!:null;
 const quotes=quoteBounded(pair,books,side,fees,releaseAt,now);
 return {quotes,depthAvailable,rawPositive:rawProfit!==null&&rawProfit>0,rawProfit,
  depth:Math.min(a.reduce((n,l)=>n+l.quantity,0),b.reduce((n,l)=>n+l.quantity,0)),
  diagnosis:!depthAvailable?'INSUFFICIENT_DEPTH':rawProfit!<=0?'NO_RAW_SPREAD':quotes.some(q=>q.feeNetProfit>0)?'FEE_NET_POSITIVE':'FEES_OR_COMMITMENT_ERASE_SPREAD'};
}
export class RouteCoverage{
 rows=new Map<string,{usableMs:number;seen:boolean;samples:number}>();lastMono:number|null=null;
 sample(ids:string[],mono:number){const elapsed=this.lastMono===null?0:Math.max(0,Math.min(1000,mono-this.lastMono));this.lastMono=mono;
  const current=new Set(ids);for(const [id,row]of this.rows){if(row.seen&&current.has(id))row.usableMs+=elapsed;row.seen=false;}
  for(const id of current){const r=this.rows.get(id)??{usableMs:0,seen:false,samples:0};r.seen=true;r.samples++;this.rows.set(id,r);}}
 summary(){return {monitorableRoutes:this.rows.size,usableRouteHours:[...this.rows.values()].reduce((n,r)=>n+r.usableMs,0)/3600000};}
}
