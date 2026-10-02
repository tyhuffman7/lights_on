import type {SettlementClass} from './hot-confirmation.ts';
export const isPromoted=(c:SettlementClass)=>c==='STRICT_EQUIVALENT'||c==='ORDINARY_EQUIVALENT_BASIS_RISK';
export function rankedSemanticLists<T>(rows:T[],classification:(r:T)=>SettlementClass,net:(r:T)=>number,limit=30){
 const ranked=[...rows].sort((a,b)=>net(b)-net(a));
 return {promotedOpportunities:ranked.filter(r=>isPromoted(classification(r))).slice(0,limit),
  unresolvedResearch:ranked.filter(r=>classification(r)==='UNRESOLVED').slice(0,limit),
  rejectedDifferentQuestions:ranked.filter(r=>classification(r)==='DIFFERENT_QUESTION').slice(0,limit)};
}
