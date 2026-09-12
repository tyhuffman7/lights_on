import {matchCandidates} from '../lib/research/matching.ts';
import type {MappingRegistry} from '../lib/research/mappings.ts';
// Recheck restored discovery candidates before they can consume subscriptions or emit signals.
// Explicitly verified mappings retain their independent settlement review.
export function revalidateCandidates(registry:MappingRegistry){
 let rejected=0;
 for(const m of registry.list()){
  if(!m.active||m.status!=='UNVERIFIED')continue;
  if(!matchCandidates([m.pair.a],[m.pair.b]).some(c=>c.pair.inverted===m.pair.inverted)){
   registry.deactivate(m.id,'CANDIDATE_NO_LONGER_MATCHES');rejected++;
  }
 }
 return rejected;
}
