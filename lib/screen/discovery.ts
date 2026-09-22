import type {Candidate} from '../research/matching.ts';
import type {Pair} from '../arb/types.ts';
import {category,selectRoutes} from './executable.ts';
import {confirmationPolicy,quoteCandidate} from './confirmation.ts';

export const discoveryPolicy=Object.freeze({version:1,durationMs:1800000,maxBatches:20,routesPerBatch:60,maxRoutes:1200,
 batchGapMs:2000,shutdownReserveMs:10000,maxAttempts:120,maxEvidenceBytes:256*1024*1024,
 preparationTimeoutMs:1200000,maxCatalogRequests:2000,ordersEnabled:false,
 simulatedCapital:confirmationPolicy.capital,maxContracts:confirmationPolicy.maxContracts,largerSizesEvaluated:false});

// Reuse the existing category round-robin and atomic PM-market bundles. The
// route cap applies per batch; shared feed IDs do not collapse distinct routes.
export function planDiscovery(candidates:Candidate[],at:number){
 let remaining=[...new Map(candidates.map(c=>[c.pair.id,c])).values()];
 const batches:ReturnType<typeof selectRoutes>[]=[];
 while(remaining.length&&batches.length<discoveryPolicy.maxBatches){
  const batch=selectRoutes(remaining,at,discoveryPolicy.routesPerBatch);
  if(!batch.selected.length)break;
  batches.push(batch);const chosen=new Set(batch.selected.map(c=>c.pair.id));remaining=remaining.filter(c=>!chosen.has(c.pair.id));
 }
 const bundles=new Map<string,number>();for(const c of remaining){const key=category(c.pair)+'::'+c.pair.b.id;bundles.set(key,(bundles.get(key)??0)+1);}
 const omitted=remaining.map(c=>({pairId:c.pair.id,kalshiId:c.pair.a.id,polyId:c.pair.b.id,category:category(c.pair),reason:(bundles.get(category(c.pair)+'::'+c.pair.b.id)??0)>discoveryPolicy.routesPerBatch?'SHARED_MARKET_BUNDLE_EXCEEDS_BATCH_CAP':'FINITE_WINDOW_BATCH_CAP'}));
 return {batches,omitted,matchedUnique:candidates.length?new Set(candidates.map(c=>c.pair.id)).size:0,
  batchDurationMs:batches.length?Math.floor((discoveryPolicy.durationMs-discoveryPolicy.shutdownReserveMs-(batches.length-1)*discoveryPolicy.batchGapMs)/batches.length):0};
}

// Unused levels and timestamp-only changes do not justify a repeat request.
export function executableFingerprint(q:ReturnType<typeof quoteCandidate>){return JSON.stringify([q.pairId,q.aSide,q.bSide,q.quantity,q.economics?.kalshi.levels,q.economics?.poly.levels,q.economics?.feeBound]);}

export class RouteObservation{
 rows=new Map<string,{pairId:string;category:string;kalshiId:string;polyId:string;attemptedAt:number;subscriptionRequestedAt:number|null;bothBooksAt:number|null;firstUsableAt:number|null;lastUsableAt:number|null;usableMs:number;unmeasuredGapMs:number;dataReasons:Record<string,number>;evaluations:number;economicEvaluations:number}>();
 previous=new Map<string,{at:number;usable:boolean}>();
 constructor(pairs:Pair[],at:number){for(const pair of pairs)this.rows.set(pair.id,{pairId:pair.id,category:category(pair),kalshiId:pair.a.id,polyId:pair.b.id,attemptedAt:at,subscriptionRequestedAt:null,bothBooksAt:null,firstUsableAt:null,lastUsableAt:null,usableMs:0,unmeasuredGapMs:0,dataReasons:{},evaluations:0,economicEvaluations:0});}
 sample(id:string,at:number,requested:boolean,bothBooks:boolean,usable:boolean,reasons:string[],hasEconomics:boolean){
  const row=this.rows.get(id)!;this.advance(id,at);row.evaluations++;if(hasEconomics)row.economicEvaluations++;
  if(requested)row.subscriptionRequestedAt??=at;if(bothBooks)row.bothBooksAt??=at;
  if(usable){row.firstUsableAt??=at;row.lastUsableAt=at;}
  for(const reason of new Set(reasons))row.dataReasons[reason]=(row.dataReasons[reason]??0)+1;
  this.previous.set(id,{at,usable});
 }
 advance(id:string,at:number){const row=this.rows.get(id)!,prev=this.previous.get(id);if(!prev)return;const elapsed=at-prev.at;if(elapsed<0||elapsed>1000)row.unmeasuredGapMs+=Math.max(0,elapsed);else if(prev.usable)row.usableMs+=elapsed;prev.at=at;}
 finish(at:number){for(const id of this.rows.keys())this.advance(id,at);}
}
