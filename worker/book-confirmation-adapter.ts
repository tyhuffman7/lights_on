import {randomUUID,createHash} from 'node:crypto';
import {BookCache} from '../lib/research/books.ts';
import {observeBook} from '../lib/screen/confirmation.ts';
import {adapterLimits,assessSnapshot,transactionVersion} from '../lib/screen/book-confirmation.ts';
import type {SnapshotRequest,SnapshotReceipt} from '../lib/screen/book-confirmation.ts';
import type {FeedHealth,HttpEvidence} from '../lib/screen/confirmation.ts';
import {StreamConnection,authHeaders} from './streams.ts';
import type {Venue} from '../lib/arb/types.ts';

export type RecordEvidence=(kind:string,body:unknown)=>void;
const noop:RecordEvidence=()=>{};
// Reuses the existing transport arrival queue, parser and sequence protections.
// No economics, order, account, ledger, retry or discovery interfaces are exposed here.
export class ConfirmationFeed{
 stream:StreamConnection;cache=new BookCache();latest=new Map<string,SnapshotReceipt>();
 failures:string[]=[];messages=new Map<string,number>();changes=new Map<string,number>();
 requests=new Map<string,SnapshotRequest>();pending=new Map<string,(receipt:SnapshotReceipt)=>void>();
 wall=Date.now();mono=performance.now();clockFault=false;record:RecordEvidence;
 constructor(venue:Venue,ids:string[],record:RecordEvidence=noop,hooks:{onBook?:(r:SnapshotReceipt)=>void;onMessage?:(m:Record<string,any>,at:number,mono:number)=>void;onInvalid?:(reason:string)=>void;extraSubscriptions?:Record<string,any>[]}={}){
  this.record=record;
  this.stream=new StreamConnection({venue,ids,extraSubscriptions:hooks.extraSubscriptions,headers:()=>authHeaders(venue),subscriptionPrefix:randomUUID()+':',
   onSubscription:(message,at,mono)=>{const requestId=message.subscribe?.requestId??String(message.id);for(const id of (message.params?.channels?.includes('market_lifecycle_v2')?[]:ids))this.requests.set(id,{venue,marketId:id,at,mono,kind:'new_subscription',requestId});record('WS_SUBSCRIPTION_REQUEST',{message,at,mono});},
   onInvalid:reason=>{hooks.onInvalid?.(reason);this.failures.push(reason);this.cache.invalidate(venue);for(const r of this.latest.values())r.e.book.valid=false;record('FEED_INVALID',{venue,reason,at:Date.now()});queueMicrotask(()=>this.stream.stop());},
   onDiagnostic:(kind,body)=>{if(kind!=='DISCONNECT_DETAIL')record(kind,body);},
   onMessage:(message,wall,mono)=>{
    hooks.onMessage?.(message,wall,mono);
    const b=venue==='kalshi'?this.cache.kalshi(message,wall,mono):this.cache.poly(message,wall,mono);if(!b)return;
    if(!ids.includes(b.marketId))throw Error('Unsubscribed market');const previous=this.latest.get(b.marketId);
    const e=observeBook(b,previous?.e,venue==='kalshi'?message.type:'marketData',Date.now(),performance.now());
    const receipt:SnapshotReceipt={e,messageType:venue==='kalshi'?message.type:'marketData',requestId:message.requestId,sid:message.sid,transactTime:message.marketData?.transactTime};
    // Equal timestamps with conflicting full books are quarantined, including within the persistent stream.
    if(venue==='poly'&&previous?.transactTime===receipt.transactTime&&JSON.stringify([previous?.e.book.yesBids,previous?.e.book.noBids,previous?.e.book.open])!==JSON.stringify([b.yesBids,b.noBids,b.open])){e.faults.push('SAME_VERSION_CONFLICTING_BOOKS');this.failures.push('SAME_VERSION_CONFLICTING_BOOKS');}
    if(venue==='poly'&&previous){const oldVersion=transactionVersion(previous.transactTime),newVersion=transactionVersion(receipt.transactTime);
     if(oldVersion===null||newVersion===null||newVersion<oldVersion){this.failures.push('PM_VERSION_BACKWARDS_OR_UNKNOWN');previous.e.book.valid=false;record('FEED_INVALID',{venue,reason:'PM_VERSION_BACKWARDS_OR_UNKNOWN'});queueMicrotask(()=>this.stream.stop());return;}
    }
    this.latest.set(b.marketId,receipt);this.messages.set(b.marketId,(this.messages.get(b.marketId)??0)+1);
    if(previous&&e.lastContentChangeReceiptAt!==previous.e.lastContentChangeReceiptAt)this.changes.set(b.marketId,(this.changes.get(b.marketId)??0)+1);
    // Only public book envelopes, never authentication headers or account channels.
    record('WS_BOOK',{message,receipt});hooks.onBook?.(receipt);this.pending.get(b.marketId)?.(receipt);
   }});
 }
 health():FeedHealth{if(Math.abs((Date.now()-this.wall)-(performance.now()-this.mono))>1000)this.clockFault=true;return {connected:this.failures.length===0&&this.stream.isHealthy(),backlog:this.stream.ingress?.depth??0,clockOkay:!this.clockFault};}
 start(){this.stream.start();}
 stop(){this.stream.stop();}
 async ready(ms=5000){const started=performance.now();while(this.latest.size<this.stream.options.ids.length){if(this.failures.length||performance.now()-started>ms)throw Error('CONTROL_FEED_NOT_READY');await new Promise(r=>setTimeout(r,20));}}
 async confirmKalshi(id:string){
  if(this.stream.options.venue!=='kalshi'||this.pending.has(id))throw Error('INVALID_SNAPSHOT_REQUEST');
  const before=this.latest.get(id),sid=this.cache.subscriptions.get(id);if(!before||sid===undefined||before.e.book.sequence===null)throw Error('NO_SEQUENCED_BOOK');
  const request:SnapshotRequest={venue:'kalshi',marketId:id,at:Date.now(),mono:performance.now(),kind:'get_snapshot',requestId:String(this.stream.snapshotRequestId+1),sid,beforeSequence:this.cache.sequences.get(sid)};
  this.record('REQUESTED_SNAPSHOT',{request});
  const response=await new Promise<SnapshotReceipt>((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('KALSHI_SNAPSHOT_TIMEOUT'));},adapterLimits.responseMs);
   this.pending.set(id,r=>{if(r.messageType==='orderbook_snapshot'&&r.e.book.receivedMono>=request.mono){clearTimeout(timer);this.pending.delete(id);resolve(r);}});
   if(!this.stream.requestSnapshot(id,sid)){clearTimeout(timer);this.pending.delete(id);reject(Error('KALSHI_SNAPSHOT_REQUEST_FAILED'));}
  });
  // Let all frames already queued at receipt run before assessing availability.
  await new Promise<void>(r=>setImmediate(r));
  return {request,response,...assessSnapshot(request,response,this.latest.get(id),this.health(),Date.now(),performance.now())};
 }
}
export async function confirmPolyBook(id:string,current:()=>SnapshotReceipt|undefined,health:()=>FeedHealth,record:RecordEvidence=noop){
 // The venue rejects a duplicate slug subscription on one socket. A bounded new
 // subscription on its own connection provides a correlated initial full book.
 const feed=new ConfirmationFeed('poly',[id],record);
 try{feed.start();await feed.ready();const response=feed.latest.get(id)!,request=feed.requests.get(id)!;
  return {request,response,...assessSnapshot(request,response,current(),{connected:feed.health().connected&&health().connected,backlog:feed.health().backlog+health().backlog,clockOkay:feed.health().clockOkay&&health().clockOkay},Date.now(),performance.now())};
 }finally{feed.stop();}
}
export async function publicConfirmationGet(url:string,record:RecordEvidence=noop){
 // Hard-coded public GET callers only. Do not send credentials to public endpoints.
 const requestAt=Date.now(),requestMono=performance.now(),requestHeaders={accept:'application/json','cache-control':'no-cache, no-store',pragma:'no-cache'};
 record('HTTP_REQUEST',{url,requestAt,requestMono,headers:requestHeaders});
 const response=await fetch(url,{headers:requestHeaders,cache:'no-store',signal:AbortSignal.timeout(adapterLimits.responseMs)});
 const raw=await response.text(),responseAt=Date.now(),responseMono=performance.now();
 const data=JSON.parse(raw),processedAt=Date.now(),processedMono=performance.now();
 const headers=Object.fromEntries([...response.headers].filter(([k])=>['date','age','cache-control','cf-cache-status','x-cache','etag','last-modified','via','retry-after'].includes(k)));
 const evidence:HttpEvidence={url,requestAt,requestMono,responseAt,responseMono,processedAt,processedMono,status:response.status,headers,bodySha256:createHash('sha256').update(raw).digest('hex')};record('HTTP_RESPONSE',{evidence,body:raw});return {evidence,data};
}
