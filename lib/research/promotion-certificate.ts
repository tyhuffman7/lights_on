// The sole positive promotion gate. Discovery labels and settlement diagnostics
// are deliberately not inputs to this certificate.
import type {Pair} from '../arb/types.ts';
import {settlementFamilyProfiles,type PropositionDimension,comparePropositions} from './proposition.ts';
type Comparison=ReturnType<typeof comparePropositions>;
export type CertificateDecision='ORDINARY_EQUIVALENT_BASIS_RISK'|'UNRESOLVED'|'DIFFERENT_QUESTION';
export type PromotionCertificate={
 version:1;family:string|null;requiredDimensions:(PropositionDimension|'orientation')[];
 dimensions:{dimension:PropositionDimension|'orientation';left:{value:string|null;evidence:string|null};right:{value:string|null;evidence:string|null};rule:string;status:'EQUAL'|'UNKNOWN'|'CONFLICT'}[];
 missing:string[];conflicts:string[];exceptionalSettlementBranches:string[];
 decision:CertificateDecision;strictEquivalent:false;
};
function rule(k:PropositionDimension|'orientation',family:string|null){
 if(k==='subject'||k==='creator')return 'Native named entity; existing competition-scoped alias registry; no price or market-ID inference';
 if(k==='competition')return 'Native competition name or normalized native identity; no equality from Champions League context alone';
 if(k==='threshold'&&family==='season-wins')return 'Integer win support: > x = >= floor(x)+1; >= x = >= ceil(x); comparator also required equal';
 if(k==='timeframe')return 'Native season/ceremony/measurement window; NFL/CFB start-year and NHL/NBA/WNBA ending-year conventions; no close-date inference';
 if(k==='metric')return 'Explicit primary payout statistic/category; one recognized statistic only; no competition-name substitution';
 if(k==='stage'||k==='settlementScope')return 'Explicit native reached stage, championship level or counted scope; no top-N-to-knockout inference';
 if(k==='orientation')return 'Same native YES predicate, or independently proved two-participant complement without explicit regulation draw';
 return 'Equal normalized native proposition values with nonempty evidence on both venues';
}
export function promotionCertificate(pair:Pair,p:Comparison,namedOrientation:boolean|null,externalConflicts:string[]=[],branches:string[]=[]):PromotionCertificate{
 const family=p.a.dimensions.family===p.b.dimensions.family?p.a.dimensions.family??null:null;
 const profiles=[p.a.dimensions.family,p.b.dimensions.family].map(f=>f?settlementFamilyProfiles[f]:undefined);
 const required=new Set<PropositionDimension>(['family',...profiles.flatMap(f=>f?.required??[])]);
 // Work charts must bind the credited creator as well as the work. Artist
 // charts bind the named artist directly. Any-song charts need native credit scope.
 if(family?.includes('chart')&&[p.a,p.b].some(v=>/song|album|hot 100|200/.test(v.dimensions.contentType??'')))required.add('creator');
 if([p.a,p.b].some(v=>v.dimensions.artistRole!==undefined))required.add('artistRole');
 const complementary=family==='event-winner'&&pair.inverted&&namedOrientation===true&&!p.conflicts.some(x=>x.startsWith('outcome:'));
 const dimensions=[...required].map(dimension=>{
  const left={value:p.a.dimensions[dimension]??null,evidence:p.a.evidence[dimension]??null};
  const right={value:p.b.dimensions[dimension]??null,evidence:p.b.evidence[dimension]??null};
  const oriented=complementary&&(dimension==='subject'||dimension==='outcome');
  const status=!left.value||!right.value||!left.evidence?.trim()||!right.evidence?.trim()?'UNKNOWN':left.value===right.value||oriented?'EQUAL':'CONFLICT';
  return {dimension,left,right,rule:oriented?rule('orientation',family):rule(dimension,family),status} as PromotionCertificate['dimensions'][number];
 });
 dimensions.push({dimension:'orientation',left:{value:pair.inverted?'complement':'same-YES',evidence:pair.a.rules.trim().split('\n')[0]||null},right:{value:pair.inverted?(complementary?'complement':null):'same-YES',evidence:pair.b.rules.trim().split('\n')[0]||null},rule:rule('orientation',family),status:(!pair.a.rules.trim()||!pair.b.rules.trim()||pair.inverted&&!complementary)?'UNKNOWN':'EQUAL'});
 const missing=[...new Set([...p.missing,...dimensions.filter(d=>d.status==='UNKNOWN').map(d=>'Missing '+d.dimension)])];
 if(!family||!settlementFamilyProfiles[family])missing.push('No complete ordinary proposition profile');
 const conflicts=[...new Set([...p.conflicts,...externalConflicts,...dimensions.filter(d=>d.status==='CONFLICT').map(d=>`${d.dimension}: ${d.left.value} vs ${d.right.value}`)])];
 const decision=conflicts.length?'DIFFERENT_QUESTION':missing.length?'UNRESOLVED':'ORDINARY_EQUIVALENT_BASIS_RISK';
 return {version:1,family,requiredDimensions:[...required,'orientation'],dimensions,missing:[...new Set(missing)],conflicts,
  exceptionalSettlementBranches:[...new Set([...p.divergenceBranches,...branches])],decision,strictEquivalent:false};
}
