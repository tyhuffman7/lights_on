import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';
import {RuleDocumentVerifier,RULE_DOCUMENT_MAX_AGE_MS,CHALLENGER_RULE_DOCUMENTS} from '../lib/arb/rule-documents.ts';
import {createPaperApproval,validPaperApproval,paperFingerprint} from '../lib/arb/paper-approval.ts';
import {discoverCandidates} from '../lib/research/matching.ts';
const bytes='%PDF-1.7 synthetic rule document',documents=[{url:'https://example.test/rules.pdf',sha256:createHash('sha256').update(bytes).digest('hex')}];
const response=(body=bytes,status=200)=>(async()=>new Response(body,{status})) as typeof fetch;
test('Exact document verification expires and cannot survive restart or clock rollback',async()=>{
 const v=new RuleDocumentVerifier(documents);assert.equal(v.matches(documents,1000),false);
 assert.equal((await v.refresh(response(),()=>1000)).ok,true);assert(v.matches(documents,1000));assert(v.matches(documents,1000+RULE_DOCUMENT_MAX_AGE_MS-1));
 assert.equal(v.matches(documents,1000+RULE_DOCUMENT_MAX_AGE_MS),false);assert.equal(v.matches(documents,999),false);assert.equal(new RuleDocumentVerifier(documents).matches(documents,1000),false);
 assert.equal(v.matches([{...documents[0],url:'https://example.test/other.pdf'}],1000),false);
});
test('Changed bytes, failed fetch and oversized responses revoke earlier verification',async()=>{
 for(const fetcher of [response(bytes+'revision'),response('unavailable',503),response('x'.repeat(2*1024*1024+1)),(async()=>{throw Error('offline');}) as typeof fetch]){
  const v=new RuleDocumentVerifier(documents);await v.refresh(response(),()=>1000);assert(v.matches(documents,1000));assert.equal((await v.refresh(fetcher,()=>1001)).ok,false);assert.equal(v.matches(documents,1001),false);
 }
});
test('All documents must match and verification begins with evidence invalidated',async()=>{
 const v=new RuleDocumentVerifier([...documents,{...documents[0],url:'https://example.test/second.pdf'}]);
 let calls=0;assert.equal((await v.refresh((async()=>new Response(++calls===1?bytes:'%PDF-changed')) as typeof fetch,()=>1000)).ok,false);assert.equal(v.matches(documents,1000),false);
 const one=new RuleDocumentVerifier(documents);await one.refresh(response(),()=>1000);let resolve!:(r:Response)=>void;
 const pending=one.refresh((()=>new Promise<Response>(r=>{resolve=r;})) as typeof fetch,()=>1001);assert.equal(one.matches(documents,1001),false);resolve(new Response(bytes));assert.equal((await pending).ok,true);
});
test('Challenger cannot create or reuse an approval from inline fingerprint and persisted hashes alone',()=>{
 const f=JSON.parse(readFileSync(new URL('./fixtures/challenger-name-variants.json',import.meta.url),'utf8'));const p=discoverCandidates(f.kalshi,f.poly).candidates[0].pair;
 const now=Date.parse('2026-09-15T00:00:00Z');assert.throws(()=>createPaperApproval(p,'Synthetic review',now),/Fresh verification/);
 const a={scope:'conditional-paper-only' as const,version:1 as const,pairId:p.id,fingerprint:paperFingerprint(p),approvedAt:now,expiresAt:now+1000,profile:'atp-challenger-named-match',checks:[],risks:['conditional'],evidence:'Synthetic persisted review',ruleDocuments:CHALLENGER_RULE_DOCUMENTS.map(d=>({...d}))};
 assert.equal(validPaperApproval(a,p,now),false);assert.equal(validPaperApproval({...a,profile:'other'},p,now),false);
});
