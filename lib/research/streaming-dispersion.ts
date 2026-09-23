import type {Pair,Book,Side} from '../arb/types.ts';
import {quoteCandidate} from '../screen/confirmation.ts';

export const streamingStudyPolicy=Object.freeze({version:2,ordersEnabled:false,ledgerAccess:false,
 durationMs:90*60*1000,maxRoutes:20,maxCultureRoutes:10,maxContracts:10,maxReconnectsPerVenue:3,
 maxConfirmations:180,confirmationSpacingMs:2000,confirmationShutdownReserveMs:6000,
 healthSampleMs:250,heartbeatMs:10000,evidenceStorage:'BOUNDED_RAW_ROTATION_WITH_PROTECTED_DECISIONS',maxIntervals:4000,
 indicativeCapitalPerVenue:500000,selection:'RETAINED_ONLY_PRICE_BLIND',bookSource:'PERSISTENT_WEBSOCKET'});
export type StudyQuote=ReturnType<typeof quoteCandidate>;
export function studyQuotes(pair:Pair,a:Book|undefined,b:Book|undefined,side:Side,at:number){
 // Use the existing depth walker, whole-quantity legality and fee bounds unchanged.
 return Array.from({length:10},(_,i)=>quoteCandidate(pair,a,b,side,at,i+1)).filter(q=>q.economics!==null);
}
export const rawGap=(q:StudyQuote)=>(q.quantity*10000-q.economics!.cost)/q.quantity;
export const netGap=(q:StudyQuote)=>q.economics!.feeBoundSurplus/q.quantity;
export function bestQuote(quotes:StudyQuote[],kind:'raw'|'fee'='fee'){
 return [...quotes].sort((a,b)=>(kind==='fee'?b.economics!.feeBoundSurplus-a.economics!.feeBoundSurplus:rawGap(b)-rawGap(a))||a.quantity-b.quantity)[0]??null;
}
export function derivedQuote(q:StudyQuote|null){
 if(!q?.economics)return null;const e=q.economics;
 return {pairId:q.pairId,aSide:q.aSide,bSide:q.bSide,quantity:q.quantity,at:q.at,
  principal:e.cost,principalByVenue:{kalshi:e.kalshi.cost,poly:e.poly.cost},feeBound:e.feeBound,
  feeNetSurplus:e.feeBoundSurplus,rawGapPerContract:rawGap(q),feeNetGapPerContract:netGap(q),
  consumedDepth:{kalshi:e.kalshi.levels,poly:e.poly.levels},riskCash:e.riskAllowance,recoveryCash:e.recoveryCash,
  totalReservedCash:e.reservedCash,venueReservedCash:e.venueReservedCash,
  withinIndicativeCash:Object.values(e.venueReservedCash).every(v=>v<=streamingStudyPolicy.indicativeCapitalPerVenue),
  settlementAssumed:false,fillClaim:false};
}
export type Interval={id:number;key:string;kind:'raw'|'fee';openedAt:number;closedAt:number|null;
 leftCensored:boolean;rightCensored:boolean;knownOnset:boolean;segments:{start:number;end:number|null}[];
 observedMs:number;quantitySet:number[];best:ReturnType<typeof derivedQuote>;reason:string|null};
// Quantity changes never create new intervals. An unknown gap suspends an episode;
// a later positive segment cannot be counted as an independent opportunity until
// an observed nonpositive state separates it. Segment durations exclude the gap.
export class StreamingIntervals{
 rows:Interval[]=[];active=new Map<string,Interval>();suspended=new Map<string,Interval>();
 states=new Map<string,'positive'|'nonpositive'|'unknown'>();nextId=0;
 update(key:string,kind:'raw'|'fee',at:number,quotes:StudyQuote[]|null){
  const k=kind+'|'+key,positive=quotes?.filter(q=>kind==='raw'?rawGap(q)>0:netGap(q)>0)??[];
  const old=this.active.get(k);
  if(positive.length){let row=old??this.suspended.get(k);let created=false;
   if(!row){if(this.rows.length>=streamingStudyPolicy.maxIntervals)throw Error('INTERVAL_RESOURCE_LIMIT');
    const known=this.states.get(k)==='nonpositive';row={id:++this.nextId,key,kind,openedAt:at,closedAt:null,leftCensored:!known,rightCensored:false,knownOnset:known,segments:[],observedMs:0,quantitySet:[],best:null,reason:null};this.rows.push(row);created=true;}
   if(!old){row.segments.push({start:at,end:null});this.suspended.delete(k);this.active.set(k,row);}
   row.quantitySet=[...new Set([...row.quantitySet,...positive.map(q=>q.quantity)])].sort((a,b)=>a-b);
   const best=derivedQuote(bestQuote(positive,kind));if(best&&(!row.best||(kind==='fee'?best.feeNetSurplus>row.best.feeNetSurplus:best.rawGapPerContract>row.best.rawGapPerContract)))row.best=best;
   this.states.set(k,'positive');return {row,created};
  }
  if(old){const s=old.segments.at(-1)!;s.end=at;old.observedMs+=Math.max(0,at-s.start);this.active.delete(k);if(quotes===null)this.suspended.set(k,old);}
  const row=old??this.suspended.get(k);
  if(row&&quotes!==null){row.closedAt=at;row.reason='OBSERVED_NONPOSITIVE';this.suspended.delete(k);}
  this.states.set(k,quotes===null?'unknown':'nonpositive');return {row:null,created:false};
 }
 stop(at:number){for(const row of this.active.values()){const s=row.segments.at(-1)!;s.end=at;row.observedMs+=Math.max(0,at-s.start);row.closedAt=at;row.rightCensored=true;row.reason='STUDY_STOP';}
  for(const row of this.suspended.values()){row.closedAt=at;row.rightCensored=true;row.reason='DATA_GAP_AT_STOP';}this.active.clear();this.suspended.clear();}
}
export class WeightedValues{
 values=new Map<number,number>();maximum:number|null=null;
 observe(value:number,ms:number){if(!Number.isFinite(value)||!Number.isFinite(ms)||ms<0)throw Error('INVALID_WEIGHT');this.maximum=this.maximum===null?value:Math.max(this.maximum,value);if(ms>0)this.values.set(value,(this.values.get(value)??0)+ms);}
 summary(){const rows=[...this.values].sort((a,b)=>a[0]-b[0]),total=rows.reduce((n,r)=>n+r[1],0);let acc=0,median:number|null=null;for(const [v,w]of rows){acc+=w;if(acc>=total/2){median=v;break;}}return {median,max:this.maximum,weightedMs:total};}
}
export function confirmedIntervalStatus(status:string,originalId:number,originalSegments:number,current:Interval|undefined){
 if(status==='EDGE_SURVIVED'&&(current?.id!==originalId||current.segments.length!==originalSegments))return {status:'FAILED',reasons:['ORIGINAL_INTERVAL_INTERRUPTED_DURING_CONFIRMATION']};
 return {status,reasons:[] as string[]};
}
