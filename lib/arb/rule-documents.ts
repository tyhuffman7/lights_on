import {createHash} from 'node:crypto';
export type RuleDocument={url:string;sha256:string};
// Reviewed September 15, 2026. Updating these pins requires a new settlement review.
export const CHALLENGER_RULE_DOCUMENTS:readonly RuleDocument[]=Object.freeze([
 Object.freeze({url:'https://assets.kalshi.com/contract_terms/ACHIEVEMENTS.pdf',sha256:'f56411d3bc76c0d9f693433dfbabce09c452a18eb05ce36f6565fe2db793e17a'}),
 Object.freeze({url:'https://www.polymarketexchange.com/files/products/PMUS%20-%20AEC%20-%20%282026.03.26%29.pdf',sha256:'cb4ad9c4d7ddc8db99c4cd271a4ee0fe7db367828d1f2832d727a0f6084f2d07'}),
]);
export const RULE_DOCUMENT_MAX_AGE_MS=300000;
const MAX_BYTES=2*1024*1024;
export class RuleDocumentVerifier{
 private checkedAt:number|undefined;
 private generation=0;
 private readonly documents:readonly RuleDocument[];
 constructor(documents:readonly RuleDocument[]){this.documents=documents.map(d=>({...d}));}
 matches(documents:readonly RuleDocument[]|undefined,now=Date.now()){
  return this.checkedAt!==undefined&&Number.isFinite(now)&&now>=this.checkedAt&&now-this.checkedAt<RULE_DOCUMENT_MAX_AGE_MS&&JSON.stringify(documents)===JSON.stringify(this.documents);
 }
 async refresh(fetcher:typeof fetch=fetch,now:()=>number=Date.now){
  const generation=++this.generation;this.checkedAt=undefined;
  const started=now();
  try{
   if(!this.documents.length)throw Error('No reviewed rule documents');
   for(const document of this.documents){
    const response=await fetcher(document.url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok||!response.body)throw Error('Rule document unavailable');
    const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw Error('Rule document exceeds size bound');chunks.push(value);}}finally{await reader.cancel();}
    const bytes=Buffer.concat(chunks);
    if(bytes.subarray(0,5).toString()!=='%PDF-'||createHash('sha256').update(bytes).digest('hex')!==document.sha256)throw Error('Reviewed rule document changed');
   }
   const finished=now();
   if(!Number.isFinite(started)||!Number.isFinite(finished)||finished<started||finished-started>=RULE_DOCUMENT_MAX_AGE_MS)throw Error('Rule document verification clock invalid');
   if(generation===this.generation)this.checkedAt=started;
   return {ok:generation===this.generation,checkedAt:started,documents:this.documents.map(d=>({...d}))};
  }catch(error){return {ok:false,error:String(error),documents:this.documents.map(d=>({...d}))};}
 }
}
// Process-local evidence: persisted approvals cannot authorize a restarted worker by themselves.
export const challengerRuleVerifier=new RuleDocumentVerifier(CHALLENGER_RULE_DOCUMENTS);

export const MLB_RULE_DOCUMENTS:readonly RuleDocument[]=Object.freeze([
 Object.freeze({url:'https://assets.kalshi.com/contract_terms/BASEBALLGAMEWIN.pdf',sha256:'46b02443153f4692acb3bac3d3aedabe93e837b08c80323013c8dce117ebb6e7'}),
 CHALLENGER_RULE_DOCUMENTS[1],
]);
export const mlbRuleVerifier=new RuleDocumentVerifier(MLB_RULE_DOCUMENTS);
export function ruleVerificationForSeries(series:string|undefined){
 if(series==='KXATPCHALLENGERMATCH')return {documents:CHALLENGER_RULE_DOCUMENTS,verifier:challengerRuleVerifier};
 if(series==='KXMLBGAME'||series==='KXKBOGAME')return {documents:MLB_RULE_DOCUMENTS,verifier:mlbRuleVerifier};
 return undefined;
}
