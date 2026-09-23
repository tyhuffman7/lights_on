import {createHash} from 'node:crypto';
import {openSync,closeSync,writeSync,fsyncSync,renameSync,unlinkSync,readFileSync,mkdirSync,statfsSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

export const evidencePolicy=Object.freeze({segmentBytes:8*1024**2,rawSegments:8,criticalBytes:64*1024**2,maxRecordBytes:2*1024**2,minFreeBytes:2*1024**3,maxRssBytes:768*1024**2});
type Limits=typeof evidencePolicy;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
type Segment={file:string;bytes:number;records:number;first:number;last:number;digest:string};
// Disposable monitoring history and non-disposable decision evidence have separate
// budgets. Caller must protect complete book/metadata context BEFORE any decision.
// A write error permanently latches this instance closed; never keep trading after it.
export class SegmentedEvidence {
 readonly dir:string;readonly limits:Limits;private rawFd=-1;private criticalFd=-1;
 private segment:Segment|null=null;private segments:Segment[]=[];private rawHash=createHash('sha256');
 private criticalHash='0'.repeat(64);private criticalSize=0;private criticalRecords=0;
 private evicted={segments:0,bytes:0,records:0,digest:'0'.repeat(64)};
 private sequence=0;private segmentNumber=0;private fault:string|null=null;private closed=false;
 totalBytes=0;
 constructor(dir:string,limits:Limits=evidencePolicy){
  if(Object.values(limits).some(n=>!Number.isSafeInteger(n)||n<=0)||limits.rawSegments<2||limits.maxRecordBytes>limits.segmentBytes)throw Error('INVALID_EVIDENCE_LIMITS');
  this.dir=resolve(dir);this.limits=Object.freeze({...limits});mkdirSync(this.dir,{recursive:true,mode:0o700});
  if(existsSync(resolve(this.dir,'manifest.json'))||existsSync(resolve(this.dir,'critical.ndjson')))throw Error('EVIDENCE_DIRECTORY_ALREADY_USED');
  this.checkResources();this.criticalFd=openSync(resolve(this.dir,'critical.ndjson'),'wx',0o600);this.persist();
 }
 checkResources(){
  if(this.fault||this.closed)throw Error(this.fault??'EVIDENCE_CLOSED');
  try {const fs=statfsSync(this.dir);if(fs.bavail*fs.bsize<this.limits.minFreeBytes)throw Error('LOW_DISK');if(process.memoryUsage().rss>this.limits.maxRssBytes)throw Error('RSS_LIMIT');}
  catch{this.fault='EVIDENCE_RESOURCE_EXHAUSTED';throw Error(this.fault);}
 }
 append(kind:string,body:unknown,critical=false){
  this.checkResources();
  try{
   const payload=JSON.stringify({sequence:++this.sequence,at:Date.now(),kind,body});
   const digest=critical?hash(this.criticalHash+payload):null;
   const line=JSON.stringify({payload:JSON.parse(payload),...(critical?{previous:this.criticalHash,digest}:{})})+'\n',bytes=Buffer.byteLength(line);
   if(bytes>this.limits.maxRecordBytes)throw Error('RECORD_LIMIT');
   if(critical){
    if(this.criticalSize+bytes>this.limits.criticalBytes)throw Error('CRITICAL_EVIDENCE_FULL');
    this.writeAll(this.criticalFd,line);fsyncSync(this.criticalFd);
    this.criticalSize+=bytes;this.criticalRecords++;this.criticalHash=digest!;
   }else{
    if(!this.segment||this.segment.bytes+bytes>this.limits.segmentBytes)this.rotate();
    this.writeAll(this.rawFd,line);this.rawHash.update(line);this.segment!.bytes+=bytes;this.segment!.records++;this.segment!.last=this.sequence;
   }
   this.totalBytes+=bytes;
  }catch{this.fault='EVIDENCE_WRITE_FAILED';throw Error(this.fault);}
 }
 private writeAll(fd:number,line:string){const b=Buffer.from(line);let offset=0;while(offset<b.length){const n=writeSync(fd,b,offset,b.length-offset);if(n<=0)throw Error('SHORT_WRITE');offset+=n;}}
 private seal(){if(this.segment){fsyncSync(this.rawFd);closeSync(this.rawFd);this.rawFd=-1;this.segment.digest=this.rawHash.digest('hex');this.segments.push(this.segment);this.segment=null;}}
 private rotate(){
  this.seal();
  // Persist a tombstone BEFORE removal. At most one orphan is possible on crash;
  // used directories are never resumed automatically or mistaken for new evidence.
  while(this.segments.length>=this.limits.rawSegments){const old=this.segments.shift()!;this.evicted={segments:this.evicted.segments+1,bytes:this.evicted.bytes+old.bytes,records:this.evicted.records+old.records,digest:hash(this.evicted.digest+JSON.stringify(old))};this.persist();unlinkSync(resolve(this.dir,old.file));}
  const file=`raw-${String(++this.segmentNumber).padStart(8,'0')}.ndjson`;
  this.rawFd=openSync(resolve(this.dir,file),'wx',0o600);this.rawHash=createHash('sha256');
  this.segment={file,bytes:0,records:0,first:this.sequence,last:this.sequence,digest:''};this.persist();
 }
 snapshot(){return {version:1,limits:this.limits,totalBytes:this.totalBytes,sequence:this.sequence,critical:{file:'critical.ndjson',bytes:this.criticalSize,records:this.criticalRecords,digest:this.criticalHash},retained:[...this.segments,...(this.segment?[{...this.segment,digest:this.rawHash.copy().digest('hex')}]:[])],evictedMonitoring:this.evicted,fault:this.fault,closed:this.closed,rawRetention:'ROLLING; evicted raw monitoring is unavailable; protected decisions are never evicted'};}
 checkpoint(){this.checkResources();try{if(this.rawFd>=0)fsyncSync(this.rawFd);this.persist();}catch{this.fault='EVIDENCE_CHECKPOINT_FAILED';throw Error(this.fault);}}
 private persist(){const file=resolve(this.dir,'manifest.json'),fd=openSync(file+'.tmp','w',0o600);try{this.writeAll(fd,JSON.stringify(this.snapshot(),null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}renameSync(file+'.tmp',file);const d=openSync(this.dir,'r');try{fsyncSync(d);}finally{closeSync(d);}}
 close(){if(this.closed)return;try{this.seal();if(this.criticalFd>=0){fsyncSync(this.criticalFd);closeSync(this.criticalFd);this.criticalFd=-1;}this.closed=true;this.persist();}catch{this.fault='EVIDENCE_CLOSE_FAILED';throw Error(this.fault);}}
}
export function verifyCriticalEvidence(file:string){
 let previous='0'.repeat(64),count=0,last=0;const raw=readFileSync(file,'utf8');if(raw&&!raw.endsWith('\n'))throw Error('TORN_CRITICAL_RECORD');
 for(const line of raw.trim().split('\n').filter(Boolean)){const row=JSON.parse(line);if(row.previous!==previous||row.digest!==hash(previous+JSON.stringify(row.payload))||row.payload.sequence<=last)throw Error('CRITICAL_CHAIN_INVALID');previous=row.digest;last=row.payload.sequence;count++;}
 return {records:count,digest:previous,bytes:Buffer.byteLength(raw)};
}
