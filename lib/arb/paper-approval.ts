import {catalogEntities} from '../research/entities.ts';
import {createHash} from 'node:crypto';
import type {Pair} from './types.ts';
import {assessSettlement} from '../research/settlement-validation.ts';
export type ConditionalPaperApproval={
 scope:'conditional-paper-only';version:1;pairId:string;fingerprint:string;
 approvedAt:number;expiresAt:number;profile:string;checks:string[];risks:string[];
 evidence:string;
};
export function paperFingerprint(pair:Pair){
 const registry=catalogEntities([pair.a.identity,pair.b.identity]);
 const normalized=(m:Pair['a'])=>({...m,identity:m.identity?registry.normalize(m.identity):undefined});
 return createHash('sha256').update(JSON.stringify({id:pair.id,a:normalized(pair.a),b:normalized(pair.b),inverted:pair.inverted})).digest('hex');
}
export function createPaperApproval(pair:Pair,evidence:string,now=Date.now()):ConditionalPaperApproval{
 const a=assessSettlement(pair);
 if(a.status!=='CONDITIONAL'||!a.normalOutcomeMatched||!a.profile||!evidence.trim())throw Error('Conditional settlement profile and explicit review evidence required');
 if(!pair.a.open||!pair.b.open)throw Error('Both markets must be open');
 const expiresAt=Math.min(now+86400000,Date.parse(pair.a.closeAt),Date.parse(pair.b.closeAt));
 if(!Number.isFinite(expiresAt)||expiresAt<=now)throw Error('Future closure dates required');
 return {scope:'conditional-paper-only',version:1,pairId:pair.id,fingerprint:paperFingerprint(pair),approvedAt:now,expiresAt,profile:a.profile,checks:a.checks,risks:a.risks,evidence};
}
export function validPaperApproval(a:ConditionalPaperApproval|undefined,pair:Pair,now=Date.now()){
 return !!a&&a.scope==='conditional-paper-only'&&a.version===1&&a.pairId===pair.id&&a.approvedAt<=now&&a.expiresAt>now&&a.expiresAt<=a.approvedAt+86400000&&a.fingerprint===paperFingerprint(pair)&&!!a.evidence?.trim()&&Array.isArray(a.risks)&&a.risks.length>0;
}
