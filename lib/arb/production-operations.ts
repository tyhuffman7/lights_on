import type {Venue} from './types.ts';
import type {FeedHealth} from '../screen/confirmation.ts';
import {validity} from '../screen/confirmation.ts';
import {assessSnapshot,transactionVersion,content} from '../screen/book-confirmation.ts';
import type {SnapshotRequest,SnapshotReceipt} from '../screen/book-confirmation.ts';

export type FeedLane='discovery'|'strategy';
export type FeedTarget={venue:Venue;lane:FeedLane};
export const executionLanePolicy=Object.freeze({maxMarkets:5,maxPersistentFeeds:4,arrivalEvidence:'DEDICATED_STRATEGY_REQUEST_CONFIRMED',discoveryEvidence:'CORROBORATION_ONLY',reconnectAccounting:'EACH_REBUILT_TRANSPORT_PER_VENUE'});

// A physical transport in either lane spends from the same venue budget. Batch
// reservations are atomic: a refused rebuild never partly spends an allowance.
export class VenueRebuildBudget{
  used:Record<Venue,number>={kalshi:0,poly:0};
  readonly limit:number;readonly deadline:number;
  constructor(limit:number,deadline:number){if(!Number.isSafeInteger(limit)||limit<0)throw Error('INVALID_REBUILD_LIMIT');this.limit=limit;this.deadline=deadline;}
  reserve(targets:FeedTarget[],now:number,busy=false){
    if(now>=this.deadline)return {accepted:false,reason:'ORIGINAL_DEADLINE'};
    if(busy)return {accepted:false,reason:'EXECUTION_IN_FLIGHT'};
    if(!targets.length||new Set(targets.map(t=>t.lane+':'+t.venue)).size!==targets.length)return {accepted:false,reason:'INVALID_REBUILD_TARGETS'};
    const counts={kalshi:0,poly:0};for(const t of targets)counts[t.venue]++;
    if((['kalshi','poly'] as const).some(v=>this.used[v]+counts[v]>this.limit))return {accepted:false,reason:'PER_VENUE_RECONNECTION_LIMIT'};
    for(const v of ['kalshi','poly'] as const)this.used[v]+=counts[v];
    return {accepted:true,reason:null};
  }
}

export type TransportState={connected:boolean;heartbeatAgeMs:number;ingressDepth?:number;ingressMaximumDepth?:number;lastDisconnect?:Record<string,unknown>|null};
export function feedDiagnostic(target:FeedTarget,health:FeedHealth,failures:string[],transport:TransportState){
  const categories:string[]=[];
  if(failures.includes('DISCONNECTED'))categories.push('TRANSPORT_DISCONNECT');
  if(failures.includes('HEARTBEAT_TIMEOUT')||(transport.connected&&transport.heartbeatAgeMs>=15000))categories.push('HEARTBEAT_TIMEOUT');
  if(health.backlog>0||failures.some(r=>/INGRESS|BACKLOG/.test(r)))categories.push('INGRESS_HEALTH');
  if(failures.some(r=>/PARSER|SEQUENCE|VERSION|CONFLICTING|TRANSPORT_ARRIVAL|TRANSPORT_RECEIVER|TRANSPORT_CLOCK/.test(r)))categories.push('PARSER_SEQUENCE_OR_ARRIVAL_INTEGRITY');
  if(!health.clockOkay||failures.some(r=>/CLOCK/.test(r)))categories.push('CLOCK_FAILURE');
  if(!health.connected&&!categories.length)categories.push('HEALTH_CHECK_FAILED_CAUSE_UNESTABLISHED');
  if(failures.some(r=>!['DISCONNECTED','HEARTBEAT_TIMEOUT'].includes(r))&&!categories.some(c=>c==='PARSER_SEQUENCE_OR_ARRIVAL_INTEGRITY'||c==='INGRESS_HEALTH'||c==='CLOCK_FAILURE'))categories.push('OTHER_NONTRANSPORT_FAILURE');
  const transportOnly=health.clockOkay&&health.backlog===0&&failures.every(r=>['DISCONNECTED','HEARTBEAT_TIMEOUT'].includes(r))&&categories.some(c=>c==='TRANSPORT_DISCONNECT'||c==='HEARTBEAT_TIMEOUT');
  const d=transport.lastDisconnect;
  return {...target,health:{...health},failures:[...failures],categories,transportRebuildable:transportOnly,
    transport:{socketOpen:transport.connected,heartbeatAgeMs:transport.heartbeatAgeMs,ingressDepth:transport.ingressDepth??health.backlog,ingressMaximumDepth:transport.ingressMaximumDepth??null,
      // Do not persist peer-provided close strings or arbitrary context fields.
      lastDisconnect:d?{closeCode:d.closeCode,initiator:d.initiator,recoveryReason:d.recoveryReason}:null}};
}
export function stopClassification(reason:string){
  if(reason==='ORIGINAL_DEADLINE'||reason==='REQUEST_DEADLINE')return 'DEADLINE_STOP';
  if(reason==='EXTERNAL_OR_SUPERVISOR_STOP')return 'SUPERVISOR_STOP';
  if(/CLOCK/.test(reason))return 'CLOCK_FAILURE';
  if(/RECONNECTION_LIMIT/.test(reason))return 'RECONNECTION_BUDGET_STOP';
  if(/INGRESS|BACKLOG/.test(reason))return 'INGRESS_HEALTH';
  if(/PARSER|SEQUENCE/.test(reason))return 'PARSER_SEQUENCE_FAILURE';
  return 'SESSION_GUARD_OR_FAILURE';
}

export type RequestedProof={request:SnapshotRequest;response:SnapshotReceipt};
// The persistent exact-market execution book must have caught up with its
// requested proof. A disconnected/missing/lagging isolated lane never falls
// back to the discovery book, even when discovery has a favorable price.
export function assessLaneEvidence(lane:FeedLane,proof:RequestedProof,latest:SnapshotReceipt|undefined,health:FeedHealth,wall:number,mono:number,discovery?:{receipt?:SnapshotReceipt;health:FeedHealth}){
  const assessed=assessSnapshot(proof.request,proof.response,latest,health,wall,mono),reasons=[...assessed.reasons];
  if(proof.response.e.processedMono>mono)reasons.push('REQUESTED_PROOF_NOT_AVAILABLE');
  if(lane==='strategy'){
    if(!latest)reasons.push('EXECUTION_MARKET_NOT_SYNCHRONIZED');
    else if(latest.e.processedMono>mono||latest.e.book.receivedMono>mono)reasons.push('EXECUTION_BOOK_NOT_AVAILABLE');
    else if(proof.request.venue==='poly'){
      const current=transactionVersion(latest.transactTime),confirmed=transactionVersion(proof.response.transactTime);
      if(current===null||confirmed===null||current<confirmed)reasons.push('EXECUTION_MARKET_NOT_SYNCHRONIZED');
    }else if(latest.sid!==proof.response.sid||latest.e.book.sequence===null||proof.response.e.book.sequence===null||latest.e.book.sequence<proof.response.e.book.sequence)reasons.push('EXECUTION_MARKET_NOT_SYNCHRONIZED');
  }
  // Discovery diagnostics are deliberately outside the primary reasons. Across
  // Kalshi sockets sequence numbers/sids cannot be compared as market versions.
  const selected=lane==='strategy'&&latest?latest:assessed.selected;
  const corroboration=discovery?{role:'CORROBORATION_ONLY',reasons:validity(discovery.receipt?.e,discovery.health,wall,mono).reasons,contentMatches:discovery.receipt?content(discovery.receipt.e.book)===content(selected.e.book):null}:null;
  return {...assessed,selected,reasons:[...new Set(reasons)],accepted:reasons.length===0,primaryLane:lane,corroboration};
}
