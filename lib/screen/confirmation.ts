import {inspectHttp} from './http-confirmation.ts';
import type {Book,Pair,Side} from '../arb/types.ts';
import type {StreamBook} from '../research/types.ts';
import {walk} from '../arb/engine.ts';
import {feeBounds,feeSchedule} from '../research/fees.ts';
import {defaults} from '../arb/types.ts';
import {category,labels} from './executable.ts';
export const confirmationPolicy=Object.freeze({version:2,durationMs:1800000,maxRoutes:60,maxContracts:10,coalesceMs:250,
 confirmationMaxAgeMs:2000,maxCrossVenueDelayMs:2000,maxProcessingDelayMs:250,maxClockDriftMs:1000,
 requestTimeoutMs:1500,maxAttempts:120,globalRequestSpacingMs:2000,perCandidateCooldownMs:35000,
 maxIntervals:2000,capital:{kalshi:500000,poly:500000},riskPerContract:200,recoveryPerContract:{kalshi:100,poly:500},ordersEnabled:false});
export type EvidenceBook={book:StreamBook;version:number;messageKind:string;processedAt:number;processedMono:number;
 lastMarketChangeAt:number|null;lastContentChangeReceiptAt:number;lastConfirmedSnapshotAt:number|null;
 lastConfirmedSnapshotMono:number|null;faults:string[]};
export type FeedHealth={connected:boolean;backlog:number;clockOkay:boolean};
export function observeBook(book:StreamBook,previous:EvidenceBook|undefined,kind:string,processedAt:number,processedMono:number):EvidenceBook{
 const faults:string[]=[];
 if(processedMono-book.receivedMono>confirmationPolicy.maxProcessingDelayMs||processedMono<book.receivedMono)faults.push('PROCESSING_BACKLOG');
 if(Math.abs((processedAt-book.receivedAt)-(processedMono-book.receivedMono))>confirmationPolicy.maxClockDriftMs)faults.push('CLOCK_DISCONTINUITY');
 if(book.exchangeAt!==null&&book.exchangeAt>book.receivedAt+1000)faults.push('EXCHANGE_CLOCK_AHEAD');
 // A delta represents a change; a snapshot's transactTime need not be its creation time.
 if(kind==='orderbook_delta'&&(book.exchangeAt===null||book.receivedAt-book.exchangeAt>2000))faults.push('DELAYED_OR_UNTIMED_DELTA');
 const snapshot=kind==='orderbook_snapshot';
 const changed=!previous||JSON.stringify([book.yesBids,book.noBids,book.open])!==JSON.stringify([previous.book.yesBids,previous.book.noBids,previous.book.open]);
 return {book,version:(previous?.version??0)+1,messageKind:kind,processedAt,processedMono,
 lastMarketChangeAt:book.exchangeAt??previous?.lastMarketChangeAt??null,
 lastContentChangeReceiptAt:changed?book.receivedAt:previous!.lastContentChangeReceiptAt,
 lastConfirmedSnapshotAt:snapshot?book.receivedAt:previous?.lastConfirmedSnapshotAt??null,
 lastConfirmedSnapshotMono:snapshot?book.receivedMono:previous?.lastConfirmedSnapshotMono??null,faults};
}
export function validity(e:EvidenceBook|undefined,h:FeedHealth,wall:number,mono:number){
 const reasons:string[]=[];
 if(!e)reasons.push('BOOK_MISSING');
 if(!h.connected)reasons.push('FEED_DISCONNECTED');
 if(h.backlog>0)reasons.push('INGRESS_BACKLOG');
 if(!h.clockOkay)reasons.push('CLOCK_UNTRUSTED');
 if(e){reasons.push(...e.faults);if(!e.book.valid||e.book.connection!=='LIVE')reasons.push('BOOK_INVALID');if(!e.book.open)reasons.push('BOOK_CLOSED');
  if(mono<e.book.receivedMono||wall<e.book.receivedAt-1000||Math.abs((wall-e.book.receivedAt)-(mono-e.book.receivedMono))>1000)reasons.push('CLOCK_DISCONTINUITY');}
 // Quiet books retain reconstruction validity, but do NOT gain confirmation from heartbeats.
 return {usableForDiscovery:reasons.length===0,reasons,confirmationRequired:!e||e.lastConfirmedSnapshotMono===null||mono-e.lastConfirmedSnapshotMono>confirmationPolicy.confirmationMaxAgeMs,
 timestamps:e?{lastMarketChangeAt:e.lastMarketChangeAt,messageReceiptAt:e.book.receivedAt,messageReceiptMono:e.book.receivedMono,processingAvailableAt:e.processedAt,processingAvailableMono:e.processedMono,lastConfirmedSnapshotAt:e.lastConfirmedSnapshotAt,exchangeTimestamp:e.book.exchangeAt}:null};
}
export function quoteCandidate(pair:Pair,a:Book|undefined,b:Book|undefined,aSide:Side,at:number,fixedQuantity?:number){
 const bSide:Side=pair.inverted?aSide:aSide==='yes'?'no':'yes';
 const minimum=Math.max(1,Math.ceil(pair.a.minQty),Math.ceil(pair.b.minQty));
 const capacity=(book:Book|undefined,side:Side)=>book?.[side].reduce((s,l)=>s+Math.floor(l.quantity),0)??0;
 const q=fixedQuantity??Math.min(confirmationPolicy.maxContracts,capacity(a,aSide),capacity(b,bSide));
 const ks=feeSchedule(pair.a),ps=feeSchedule(pair.b);let economics=null;const reasons:string[]=[];
 if(!ks||!ps)reasons.push('UNKNOWN_FEE_SCHEDULE');
 if(!Number.isSafeInteger(q)||q<minimum||q>confirmationPolicy.maxContracts)reasons.push('SIZE_OR_MINIMUM_UNAVAILABLE');
 const af=a&&ks&&reasons.length===0?walk(a[aSide],q,ks.rate,ks.rounding):null;
 const bf=b&&ps&&reasons.length===0?walk(b[bSide],q,ps.rate,ps.rounding):null;
 if(!af||!bf)reasons.push('FIXED_QUANTITY_DEPTH_UNAVAILABLE');
 const blockers:string[]=[];
 if(labels(pair,at).horizon==='OUTSIDE_BASELINE_HORIZON')blockers.push('BASELINE_30_DAY_HORIZON');
 if(af&&bf&&ks&&ps){const k=feeBounds(af.levels,ks),p=feeBounds(bf.levels,ps);const fees=k.upper+p.upper,cost=af.cost+bf.cost,risk=q*confirmationPolicy.riskPerContract;
  const surplus=q*10000-cost-fees,afterRisk=surplus-risk,recovery={kalshi:q*100,poly:q*500},reservedCash=cost+fees+risk+recovery.kalshi+recovery.poly;
  if(afterRisk<defaults.minProfit)blockers.push('BASELINE_10_CENT_PROFIT_FLOOR');
  if(afterRisk/(cost+fees+risk)*100<defaults.minRoi)blockers.push('BASELINE_1_PERCENT_ROI');
  if(reservedCash>defaults.maxTrade)blockers.push('BASELINE_10_DOLLAR_ENTRY_CAP');
  if(reservedCash>defaults.maxCommitted)blockers.push('BASELINE_40_DOLLAR_COMMITMENT_CAP');
  if(af.cost+k.upper+risk/2+recovery.kalshi>confirmationPolicy.capital.kalshi||bf.cost+p.upper+risk/2+recovery.poly>confirmationPolicy.capital.poly)blockers.push('SIMULATED_VENUE_CASH');
  economics={quantity:q,kalshi:{...af,feeBound:k.upper},poly:{...bf,feeBound:p.upper},cost,feeBound:fees,feeBoundSurplus:surplus,riskAllowance:risk,afterRisk,recoveryCash:recovery,reservedCash,
   feeProvenance:{kalshi:{...ks,scope:'CENT_PRECISION_WHOLE_CONTRACT_FRAGMENTATION_BOUND; ACCOUNT_CLASS_UNKNOWN; ARBITRARY_FRACTIONAL_FILL_ROUNDING_NOT_BOUNDED'},poly:{...ps,scope:'CUMULATIVE_ORDER_CEILING_NOT_COLLECTED_COMMISSION'}},feeUncertainty:'Neither actual fill fragmentation nor account precision is known; no favorable commission/rebate assumed.'};
 }
 return {pairId:pair.id,category:category(pair),aSide,bSide,quantity:q,at,route:'TAKER_TAKER',economics,
  positiveExchangeNet:!!economics&&economics.feeBoundSurplus>0,pricingReasons:reasons,
  additionalPolicyAdmission:{admitted:!!economics&&blockers.length===0,blockers},labels:labels(pair,at),
  tradingAuthorization:{authorized:false,reason:'ORDER_DISABLED',ohioEligibility:'NOT_REVALIDATED'},fillClaim:false};
}
export type HttpEvidence={url:string;requestAt:number;requestMono:number;responseAt:number;responseMono:number;processedAt:number;processedMono:number;status:number;headers:Record<string,string>;bodySha256:string};
export function httpConfirmationReasons(e:HttpEvidence){
 // Legacy strict HTTP-only caller. The reusable adapter uses independent requested
 // WS book proof instead; absent optional HTTP headers remain UNKNOWN, never Age=0.
 const assessment=inspectHttp(e),reasons=[...assessment.transportReasons];
 if(assessment.cacheEvidence==='CACHED')reasons.push('CACHED_RESPONSE');
 if(assessment.cacheEvidence==='UNKNOWN')reasons.push('CACHE_PROVENANCE_UNRESOLVED');
 if(assessment.dateAt===null)reasons.push('HTTP_DATE_NOT_CURRENT');
 return [...new Set(reasons)];
}
export function confirmationResult(original:ReturnType<typeof quoteCandidate>,latest:ReturnType<typeof quoteCandidate>,reasons:string[],window:{startedAt:number;endedAt:number;kalshiSnapshotMono:number;polyResponseMono:number;nowMono:number}){
 const problems=[...reasons,...latest.pricingReasons];
 if(latest.quantity!==original.quantity||latest.aSide!==original.aSide||latest.bSide!==original.bSide||latest.pairId!==original.pairId)problems.push('CANDIDATE_CHANGED');
 if(Math.abs(window.kalshiSnapshotMono-window.polyResponseMono)>confirmationPolicy.maxCrossVenueDelayMs)problems.push('CROSS_VENUE_CONFIRMATION_DELAY');
 if(window.nowMono-Math.min(window.kalshiSnapshotMono,window.polyResponseMono)>confirmationPolicy.confirmationMaxAgeMs)problems.push('CONFIRMATION_EXPIRED');
 return {status:problems.length?'FAILED':latest.positiveExchangeNet?'EDGE_SURVIVED':'EDGE_DISAPPEARED',edgeSurvived:problems.length?null:latest.positiveExchangeNet,
  reasons:[...new Set(problems)],original,repriced:latest,window,fillClaim:false};
}
// Counts transitions into economic candidacy, never repeated evaluation samples.
export class CandidateIntervals{
 active=new Map<string,{id:number;key:string;openedAt:number;lastObservedAt:number;quantity:number;original:ReturnType<typeof quoteCandidate>}>();
 completed:unknown[]=[];nextId=0;
 update(key:string,row:ReturnType<typeof quoteCandidate>,usable:boolean,at:number){
  const previous=this.active.get(key);
  if(!usable||!row.positiveExchangeNet){if(previous){this.completed.push({...previous,closedAt:at,closeReason:!usable?'DATA_INVALID_OR_CENSORED':'EDGE_NOT_POSITIVE'});this.active.delete(key);}return null;}
  if(previous){previous.lastObservedAt=at;return previous;}
  if(this.nextId>=confirmationPolicy.maxIntervals)return null;
  const next={id:++this.nextId,key,openedAt:at,lastObservedAt:at,quantity:row.quantity,original:row};this.active.set(key,next);return next;
 }
 stop(at:number){for(const [key,x]of this.active){this.completed.push({...x,closedAt:at,closeReason:'OBSERVATION_ENDED_RIGHT_CENSORED'});this.active.delete(key);}}
}
export function latestPolyBook(rest:StreamBook,current:EvidenceBook|undefined,requestMono:number){
 const reasons:string[]=[];
 if(!current)return {book:rest,reasons};
 const b=current.book;
 const timestampNewer=b.exchangeAt!==null&&rest.exchangeAt!==null&&b.exchangeAt>rest.exchangeAt;
 const receivedLater=b.receivedMono>rest.receivedMono;
 const sameStamp=b.exchangeAt===rest.exchangeAt;
 const sameBook=JSON.stringify([b.yesBids,b.noBids,b.open])===JSON.stringify([rest.yesBids,rest.noBids,rest.open]);
 if(sameStamp&&!sameBook)reasons.push('SAME_EXCHANGE_TIME_CONFLICTING_BOOKS');
 if(timestampNewer&&b.receivedMono<requestMono)reasons.push('REST_OLDER_THAN_ALREADY_OBSERVED_STREAM');
 return {book:timestampNewer||receivedLater?b:rest,reasons};
}
