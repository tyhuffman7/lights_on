export class IngressCapacityError extends Error{
 readonly details:{reason:'INVALID_FRAME_SIZE'|'FRAME_LIMIT'|'BYTE_LIMIT';depth:number;bytes:number;incomingBytes:number;maxFrames:number;maxBytes:number;oldestQueuedMs:number;processedFrames:number};
 constructor(details:IngressCapacityError['details']){super('Ingress queue capacity exceeded');this.name='IngressCapacityError';this.details=details;}
}
// Bound synchronous work per socket so bursts cannot monopolize the event loop.
export class FrameQueue<T>{
 private items:{value:T;bytes:number;queuedMono:number}[]=[];private next=0;private task:ReturnType<typeof setImmediate>|null=null;
 bytes=0;closed=false;maximumDepth=0;private processedFrames=0;
 private consume:(value:T)=>void;private fail:(error:unknown)=>void;private maxFrames:number;private maxBytes:number;
 constructor(consume:(value:T)=>void,fail:(error:unknown)=>void,maxFrames=512,maxBytes=8*1024*1024){this.consume=consume;this.fail=fail;this.maxFrames=maxFrames;this.maxBytes=maxBytes;}
 get depth(){return this.items.length-this.next;}
 push(value:T,bytes:number){
  if(this.closed)return;
  if(!Number.isSafeInteger(bytes)||bytes<0||this.depth>=this.maxFrames||this.bytes+bytes>this.maxBytes){
   const error=new IngressCapacityError({reason:!Number.isSafeInteger(bytes)||bytes<0?'INVALID_FRAME_SIZE':this.depth>=this.maxFrames?'FRAME_LIMIT':'BYTE_LIMIT',depth:this.depth,bytes:this.bytes,incomingBytes:bytes,maxFrames:this.maxFrames,maxBytes:this.maxBytes,oldestQueuedMs:this.depth?Math.max(0,performance.now()-this.items[this.next].queuedMono):0,processedFrames:this.processedFrames});
   this.close();this.fail(error);return;
  }
  this.items.push({value,bytes,queuedMono:performance.now()});this.bytes+=bytes;this.maximumDepth=Math.max(this.maximumDepth,this.depth);this.schedule();
 }
 private schedule(){if(!this.closed&&!this.task)this.task=setImmediate(()=>{this.task=null;this.drain();});}
 private drain(){
  const started=performance.now();let count=0;
  try{while(!this.closed&&this.next<this.items.length&&count<8&&(count===0||performance.now()-started<4)){
   const item=this.items[this.next++];this.bytes-=item.bytes;count++;this.consume(item.value);this.processedFrames++;
  }}catch(error){this.close();this.fail(error);return;}
  if(this.closed)return;
  if(this.next===this.items.length){this.items=[];this.next=0;}else if(this.next>=256){this.items=this.items.slice(this.next);this.next=0;}
  if(this.depth)this.schedule();
 }
 flush(){while(!this.closed&&this.depth){if(this.task)clearImmediate(this.task);this.task=null;this.drain();}if(this.task)clearImmediate(this.task);this.task=null;}
 close(){this.closed=true;if(this.task)clearImmediate(this.task);this.task=null;this.items=[];this.next=0;this.bytes=0;}
}
