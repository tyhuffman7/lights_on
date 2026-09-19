// ws defers callbacks under fair dispatch. Retain the oldest socket arrival until
// its receiver is fully idle; never relabel buffered bytes with callback time.
export class TransportArrival {
 private first:{wall:number;mono:number}|null=null;
 private bytes=0;
 observe(bytes:number,idle:boolean,wall:number,mono:number){
  if(!Number.isSafeInteger(bytes)||bytes<0||!Number.isFinite(wall)||!Number.isFinite(mono))throw Error('TRANSPORT_ARRIVAL_INVALID');
  if(idle||!this.first){this.first={wall,mono};this.bytes=0;}
  this.bytes+=bytes;
  if(this.bytes>8*1024*1024)throw Error('TRANSPORT_BATCH_CAPACITY');
  return this.receipt(wall,mono);
 }
 receipt(wall:number,mono:number){
  if(!this.first)throw Error('TRANSPORT_ARRIVAL_MISSING');
  const elapsed=mono-this.first.mono;
  if(elapsed<0||!Number.isFinite(elapsed)||Math.abs((wall-this.first.wall)-elapsed)>50)throw Error('TRANSPORT_CLOCK_CHANGED');
  if(elapsed>2000)throw Error('TRANSPORT_BACKLOG_STALE');
  return {...this.first};
 }
}
// Deliberately version-sensitive: unknown ws receiver layouts fail closed.
// These fields are corroborated by the installed ws receiver implementation.
export function receiverIdle(receiver:unknown):boolean{
 const r=receiver as {_state?:number;_bufferedBytes?:number;_fragmented?:number;writableLength?:number}|null;
 if(!r||![r._state,r._bufferedBytes,r._fragmented,r.writableLength].every(v=>Number.isSafeInteger(v)&&v!>=0))throw Error('TRANSPORT_RECEIVER_UNSUPPORTED');
 return r._state===0&&r._bufferedBytes===0&&r._fragmented===0&&r.writableLength===0;
}
