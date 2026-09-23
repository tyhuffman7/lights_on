import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,readdirSync,appendFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SegmentedEvidence,evidencePolicy,verifyCriticalEvidence} from '../worker/segmented-evidence.ts';
const temporary=()=>mkdtempSync(join(tmpdir(),'segmented-evidence-'));
test('monitoring exceeds the old 256 MiB ceiling while retained raw stays bounded and critical proof survives',()=>{
 const dir=temporary();try{
  const w=new SegmentedEvidence(dir);w.append('ADMISSION',{book:'exact-context',quantity:1},true);
  const data='x'.repeat(512*1024);for(let i=0;i<530;i++)w.append('WS_BOOK',{data,i});
  w.append('NO_FILL',{orderId:'synthetic',filled:0},true);w.close();const m=w.snapshot();
  assert(m.totalBytes>256*1024**2);assert(m.retained.length<=8);assert(m.retained.reduce((n,r)=>n+r.bytes,0)<=64*1024**2);assert(m.evictedMonitoring.segments>0);
  assert.equal(verifyCriticalEvidence(join(dir,'critical.ndjson')).records,2);assert.equal(verifyCriticalEvidence(join(dir,'critical.ndjson')).digest,m.critical.digest);
  assert.equal(readdirSync(dir).filter(f=>f.startsWith('raw-')).length,m.retained.length);assert.equal(m.fault,null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('protected exhaustion fails closed, preserves every earlier record, and never spills into disposable storage',()=>{
 const dir=temporary();try{const w=new SegmentedEvidence(dir,{...evidencePolicy,criticalBytes:800});w.append('INTENT',{q:1},true);assert.throws(()=>w.append('FILL',{data:'x'.repeat(700)},true),/EVIDENCE_WRITE_FAILED/);assert.throws(()=>w.append('BOOK',{}),/EVIDENCE_WRITE_FAILED/);w.close();assert.equal(verifyCriticalEvidence(join(dir,'critical.ndjson')).records,1);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('resource reserve, restart ambiguity and torn critical writes are rejected',()=>{
 const dir=temporary();try{
  assert.throws(()=>new SegmentedEvidence(dir,{...evidencePolicy,minFreeBytes:Number.MAX_SAFE_INTEGER}),/RESOURCE_EXHAUSTED/);
  const w=new SegmentedEvidence(dir);w.append('REQUEST',{},true);w.close();assert.throws(()=>new SegmentedEvidence(dir),/ALREADY_USED/);
  appendFileSync(join(dir,'critical.ndjson'),'broken');assert.throws(()=>verifyCriticalEvidence(join(dir,'critical.ndjson')),/TORN/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('changed critical payload is detected by the hash chain',()=>{
 const dir=temporary();try{const w=new SegmentedEvidence(dir);w.append('FILL',{quantity:1},true);w.close();const file=join(dir,'critical.ndjson'),s=readFileSync(file,'utf8');assert(s.includes('"quantity":1'));writeFileSync(file,s.replace('"quantity":1','"quantity":2'));assert.throws(()=>verifyCriticalEvidence(file),/CHAIN_INVALID/);}finally{rmSync(dir,{recursive:true,force:true});}
});
