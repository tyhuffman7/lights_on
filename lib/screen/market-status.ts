import type {HttpEvidence} from './confirmation.ts';
import {inspectHttp} from './http-confirmation.ts';
export const lifecycleSubscription={id:9000,cmd:'subscribe',params:{channels:['market_lifecycle_v2']}};
type Event={seq:number;receivedAt:number;receivedMono:number;eventType:string;closeAt:number|null;openAt:number|null};
type State={baseline?:{status:string;openAt:number|null;closeAt:number|null;http:HttpEvidence;beginSerial:number};events:Event[];issues:Set<string>;knownNegative:boolean;pendingSerial?:number};
const negative=new Set(['inactive','closed','determined','disputed','amended','finalized']);
export class MarketStatusTracker{
 sid:number|null=null;ackAt:number|null=null;ackMono:number|null=null;requestedAt:number|null=null;sequence:number|null=null;serial=0;
 faults=new Set<string>();states=new Map<string,State>();eventCount=0;ignored=0;eventLimit=2048;perMarketLimit=32;
 constructor(ids:string[]){for(const id of ids)this.states.set(id,{events:[],issues:new Set(),knownNegative:false});}
 requested(at:number){this.requestedAt=at;}
 invalidate(reason:string){this.faults.add(reason);}
 receive(message:Record<string,any>,at:number,mono:number){
  if(message.type==='subscribed'&&message.msg?.channel==='market_lifecycle_v2'){
   if(message.id!==9000||!Number.isSafeInteger(message.msg.sid)||this.sid!==null){this.invalidate('LIFECYCLE_ACK_CONFLICT');return;}
   this.sid=message.msg.sid;this.ackAt=at;this.ackMono=mono;return;
  }
  if(message.sid!==this.sid)return;
  if(!Number.isSafeInteger(message.seq)){this.invalidate('LIFECYCLE_SEQUENCE_MISSING');return;}
  if(this.sequence!==null&&message.seq!==this.sequence+1)this.invalidate('LIFECYCLE_SEQUENCE_GAP_OR_REORDER');
  this.sequence=message.seq;this.serial++;
  const m=message.msg??{},state=this.states.get(m.market_ticker);
  // All messages on this sid advance chronology, including unrelated markets/events.
  if(message.type!=='market_lifecycle_v2'||!state){this.ignored++;return;}
  if(++this.eventCount>this.eventLimit||state.events.length>=this.perMarketLimit){this.invalidate('LIFECYCLE_BUFFER_LIMIT');return;}
  const event:Event={seq:message.seq,receivedAt:at,receivedMono:mono,eventType:String(m.event_type),closeAt:Number.isFinite(m.close_ts)?m.close_ts*1000:null,openAt:Number.isFinite(m.open_ts)?m.open_ts*1000:null};state.events.push(event);
  if(['deactivated','determined','settled'].includes(event.eventType))state.knownNegative=true;
  if(!['created','activated','deactivated','close_date_updated','determined','settled','metadata_updated','price_level_structure_updated'].includes(event.eventType))state.issues.add('UNKNOWN_LIFECYCLE_EVENT');
  if(['metadata_updated','price_level_structure_updated'].includes(event.eventType))state.issues.add('CONTRACT_METADATA_CHANGED');
  if(state.pendingSerial!==undefined)state.issues.add('BASELINE_EVENT_ORDER_UNRESOLVED');
  if(event.eventType==='activated'&&state.knownNegative)state.issues.add('REACTIVATION_REQUIRES_RECONCILIATION');
 }
 beginBaseline(id:string){if(this.sid===null||this.ackMono===null)throw Error('LIFECYCLE_ACK_REQUIRED_BEFORE_BASELINE');const state=this.states.get(id);if(!state)throw Error('UNSELECTED_STATUS_MARKET');state.pendingSerial=this.serial;return this.serial;}
 applyBaseline(id:string,market:Record<string,any>|undefined,http:HttpEvidence){
  const s=this.states.get(id)!;if(s.pendingSerial===undefined||this.ackMono===null||http.requestMono<this.ackMono){s.issues.add('BASELINE_BEFORE_SUBSCRIPTION_ACK');return;}
  const beginSerial=s.pendingSerial;delete s.pendingSerial;
  if(market?.ticker!==id){s.issues.add('STATUS_MARKET_ID_MISMATCH');return;}
  const openAt=Date.parse(market.open_time),closeAt=Date.parse(market.close_time);const status=String(market.status??'unknown');
  if(negative.has(status))s.knownNegative=true;
  if(s.knownNegative&&status==='active')s.issues.add('BASELINE_LIFECYCLE_CONTRADICTION');
  if(s.events.some(e=>e.eventType==='activated')&&negative.has(status))s.issues.add('BASELINE_LIFECYCLE_CONTRADICTION');
  s.baseline={status,openAt:Number.isFinite(openAt)?openAt:null,closeAt:Number.isFinite(closeAt)?closeAt:null,http,beginSerial};
 }
 baselineFailed(id:string){const s=this.states.get(id)!;delete s.pendingSerial;s.issues.add('STATUS_BASELINE_FAILED');}
 view(id:string,at:number,connected:boolean){
  const s=this.states.get(id);const issues=[...this.faults,...(s?.issues??[])];
  if(!connected)issues.push('LIFECYCLE_DISCONNECTED');if(this.sid===null)issues.push('LIFECYCLE_NOT_ACKNOWLEDGED');
  const baseline=s?.baseline,cache=baseline?inspectHttp(baseline.http):null;
  if(!baseline)issues.push('STATUS_BASELINE_MISSING');else issues.push(...cache!.transportReasons);
  if(cache?.cacheEvidence==='UNKNOWN'||cache?.dateAt===null)issues.push('STATUS_CACHE_CURRENTNESS_UNPROVEN');
  if(cache?.cacheEvidence==='CACHED')issues.push('STATUS_BASELINE_CACHED');
  // Event arrival order cannot locate a cached REST representation atomically in the stream.
  issues.push('NON_ATOMIC_INITIAL_STATE');
  const lastClose=s?.events.filter(e=>e.closeAt!==null).at(-1)?.closeAt??baseline?.closeAt??null;
  const closedByTime=lastClose!==null&&at>=lastClose;if(closedByTime)issues.push('CLOSE_TIME_PASSED');
  if(lastClose===null)issues.push('CLOSE_TIME_UNKNOWN');
  const knownBlocked=!!s?.knownNegative||closedByTime||!!(baseline&&negative.has(baseline.status));
  if(knownBlocked)issues.push('KNOWN_NONTRADING_STATE');
  if(baseline&&baseline.status!=='active'&&!negative.has(baseline.status))issues.push('NOT_REPORTED_ACTIVE');
  return {classification:knownBlocked?'KNOWN_BLOCKED':'UNRESOLVED',admitted:false,knownBlocked,reportedStatus:baseline?.status??null,
   latestLifecycleEvent:s?.events.at(-1)??null,closeAt:lastClose,reasons:[...new Set(issues)],initializationGuarantee:'NOT_DOCUMENTED',
   baseline:baseline?{...baseline,http:baseline.http}:null,subscription:{requestedAt:this.requestedAt,ackAt:this.ackAt,ackMono:this.ackMono,sid:this.sid,lastSequence:this.sequence},events:s?.events??[]};
 }
 summary(){return {subscription:{requestedAt:this.requestedAt,ackAt:this.ackAt,sid:this.sid,lastSequence:this.sequence},faults:[...this.faults],relevantEvents:this.eventCount,ignoredEvents:this.ignored,limits:{total:this.eventLimit,perMarket:this.perMarketLimit}};}
}
export async function bootstrapStatus(tracker:MarketStatusTracker,ids:string[],get:(id:string)=>Promise<{data:any;evidence:HttpEvidence}>,spacing=250){
 // Callers wait for the server subscription acknowledgement, not merely socket open.
 for(const id of ids){tracker.beginBaseline(id);try{const r=await get(id);tracker.applyBaseline(id,r.data.market,r.evidence);if(r.evidence.status===429){tracker.invalidate('STATUS_RATE_LIMITED');break;}}catch{tracker.baselineFailed(id);}if(spacing)await new Promise(r=>setTimeout(r,spacing));}
}
