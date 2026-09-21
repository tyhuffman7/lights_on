import type {StreamBook} from '../research/types.ts';
import type {EvidenceBook,FeedHealth,HttpEvidence} from './confirmation.ts';
import {validity} from './confirmation.ts';
import {inspectHttp} from './http-confirmation.ts';
export {inspectHttp} from './http-confirmation.ts';

export const adapterLimits=Object.freeze({responseMs:1500,processingMs:250,proofAgeMs:2000,clockMs:1000});
export const content=(b:StreamBook)=>JSON.stringify([b.yesBids,b.noBids,b.open]);
export type SnapshotRequest={venue:'kalshi'|'poly';marketId:string;at:number;mono:number;kind:'get_snapshot'|'new_subscription';requestId:string;sid?:number;beforeSequence?:number};
export type SnapshotReceipt={e:EvidenceBook;messageType:string;requestId?:string;sid?:number;transactTime?:string};
// Preserve the supplied sub-millisecond version. Never replace a price timestamp with receipt time.
export function transactionVersion(s:string|undefined):bigint|null{
 const m=s?.match(/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/);if(!m)return null;
 const seconds=Date.parse(m[1]+'Z');return Number.isFinite(seconds)?BigInt(seconds)*1000000n+BigInt((m[2]??'').padEnd(9,'0')):null;
}
export function assessSnapshot(request:SnapshotRequest,response:SnapshotReceipt,latest:SnapshotReceipt|undefined,health:FeedHealth,at:number,mono:number){
 const e=response.e,b=e.book,problems=[...validity(e,health,at,mono).reasons];
 if(b.venue!==request.venue||b.marketId!==request.marketId)problems.push('SNAPSHOT_MARKET_MISMATCH');
 const elapsed=b.receivedMono-request.mono;
 if(elapsed<0||elapsed>adapterLimits.responseMs)problems.push('SNAPSHOT_REQUEST_WINDOW');
 if(Math.abs((b.receivedAt-request.at)-elapsed)>adapterLimits.clockMs)problems.push('SNAPSHOT_CLOCK_DISCONTINUITY');
 if(mono-b.receivedMono>adapterLimits.proofAgeMs)problems.push('SNAPSHOT_CONFIRMATION_EXPIRED');
 if(request.venue==='kalshi'){
  if(request.kind!=='get_snapshot'||response.messageType!=='orderbook_snapshot'||response.sid!==request.sid||b.sequence===null||request.beforeSequence===undefined||b.sequence<=request.beforeSequence)problems.push('UNBOUND_KALSHI_SNAPSHOT');
 }else{
  if(request.kind!=='new_subscription'||response.messageType!=='marketData'||response.requestId!==request.requestId)problems.push('UNBOUND_PM_SUBSCRIPTION');
  if(transactionVersion(response.transactTime)===null)problems.push('PM_VERSION_UNAVAILABLE');
 }
 let selected=response;
 if(latest){
  if(latest.e.book.venue!==b.venue||latest.e.book.marketId!==b.marketId)problems.push('LATEST_MARKET_MISMATCH');
  problems.push(...validity(latest.e,health,at,mono).reasons.map(r=>'LATEST_'+r));
  if(request.venue==='poly'){
   const rv=transactionVersion(response.transactTime),lv=transactionVersion(latest.transactTime);
   if(rv===null||lv===null)problems.push('PM_VERSION_UNAVAILABLE');
   else if(lv>rv){selected=latest;problems.push('SNAPSHOT_OLDER_THAN_STREAM');}
   else if(lv===rv&&content(latest.e.book)!==content(b))problems.push('SAME_VERSION_CONFLICTING_BOOKS');
  }else if(latest.e.book.sequence!==null&&b.sequence!==null){
   if(latest.sid!==response.sid)problems.push('KALSHI_SUBSCRIPTION_CHANGED');
   else if(latest.e.book.sequence>b.sequence)selected=latest;
   else if(latest.e.book.sequence===b.sequence&&content(latest.e.book)!==content(b))problems.push('SAME_VERSION_CONFLICTING_BOOKS');
  }
 }
 const reasons=[...new Set(problems)],accepted=reasons.length===0;
 return {accepted,reasons,selected,proof:accepted?'REQUEST_BOUND_WS_BOOK':null,
  confirmedAt:accepted?b.receivedAt:null,confirmedMono:accepted?b.receivedMono:null,
  marketState:request.venue==='poly'?(b.open?'OPEN_IN_REQUESTED_BOOK':'CLOSED_IN_REQUESTED_BOOK'):'NOT_PRESENT_IN_KALSHI_BOOK',
  cacheAgeUncertainty:'HTTP_NOT_USED_FOR_BOOK_PROOF',fillClaim:false};
}
// Transport integrity, HTTP cache evidence and book-version evidence are separate decisions.
export function assessRestBook(rest:SnapshotReceipt,http:HttpEvidence,confirmed:ReturnType<typeof assessSnapshot>,latest:SnapshotReceipt|undefined,health:FeedHealth){
 const transport=inspectHttp(http),reasons=[...transport.transportReasons];
 if(!confirmed.accepted)reasons.push('NO_VALID_WS_CORROBORATION');
 let expected=confirmed.selected;
 if(!latest)reasons.push('CURRENT_STREAM_MISSING');
 else {
  reasons.push(...validity(latest.e,health,http.processedAt,http.processedMono).reasons.map(r=>'LATEST_'+r));
  const cv=transactionVersion(latest.transactTime),pv=transactionVersion(expected.transactTime);
  if(cv===null||pv===null)reasons.push('CURRENT_STREAM_VERSION_UNAVAILABLE');
  else if(cv>pv){expected=latest;reasons.push('WS_CONFIRMATION_SUPERSEDED');}
  else if(cv===pv&&content(latest.e.book)!==content(expected.e.book))reasons.push('SAME_VERSION_CONFLICTING_BOOKS');
 }
 if(rest.e.book.marketId!==expected.e.book.marketId||rest.e.book.venue!=='poly')reasons.push('REST_MARKET_MISMATCH');
 if(!rest.e.book.valid||!rest.e.book.open)reasons.push('REST_BOOK_INVALID_OR_CLOSED');
 const rv=transactionVersion(rest.transactTime),sv=transactionVersion(expected.transactTime);
 if(rv===null||sv===null)reasons.push('REST_VERSION_UNAVAILABLE');
 else if(rv<sv)reasons.push('REST_OLDER_THAN_STREAM');
 else if(rv>sv)reasons.push('REST_NEWER_UNCORROBORATED');
 else if(content(rest.e.book)!==content(expected.e.book))reasons.push('SAME_VERSION_CONFLICTING_BOOKS');
 if(confirmed.confirmedMono===null||Math.abs(http.responseMono-confirmed.confirmedMono)>adapterLimits.proofAgeMs||http.processedMono-confirmed.confirmedMono>adapterLimits.proofAgeMs)reasons.push('CORROBORATION_WINDOW_EXPIRED');
 return {accepted:reasons.length===0,reasons:[...new Set(reasons)],http:transport,
  proof:reasons.length?null:'EXACT_BOOK_AND_VERSION_MATCH_REQUESTED_WS',selected:expected,
  // A cache hit can equal a freshly requested quiet book. Acceptance comes from that book proof, not the hit's Date.
  cacheAgeUncertainty:transport.ageSeconds===null?'NOT_REPORTED':null,fillClaim:false};
}
