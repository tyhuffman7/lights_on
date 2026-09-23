import {createHash} from 'node:crypto';
import type {Pair} from '../arb/types.ts';
import type {StudyQuote} from '../research/streaming-dispersion.ts';

export const dormantPilot=Object.freeze({version:1,ordersEnabled:false,checkpointAllowsOrders:false,
 maxCommitted:50000,moneyScale:10000,quantity:1,maxPositions:1,maxEntryAttempts:1,maxRecoveryAttempts:1,
 reuseProceeds:false,concurrentSequences:1,stopOnUnknown:true,stopOnRealizedLoss:true,
 recovery:'ONE_REDUCING_FOK_UNWIND_ONLY_AFTER_CONFIRMED_ONE_SIDED_FILL',authorization:null,
 maxConfirmationAgeMs:2000,maxAccountAgeMs:5000,maxLockupMs:7*86400000});
export type LiveClassification='LIVE_EQUIVALENT'|'LIVE_BLOCKED'|'UNRESOLVED';
export const settlementDimensions=['event','outcome','source','threshold','date','geography','cancellation','void','postponement','correction','tie'] as const;
export type LiveReview={pairId:string;classification:LiveClassification;ordinaryOnly:boolean;marketHashes:{kalshi:string;poly:string};
 reviewedAt:number;expiresAt:number;dimensions:Record<typeof settlementDimensions[number],'MATCH'|'CONFLICT'|'UNKNOWN'>;
 reasons:string[];sources:{url:string;sha256:string}[]};
export function liveSettlementReasons(pair:Pair,review:LiveReview|undefined,now:number){
 const reasons:string[]=[];
 if(!review||review.classification!=='LIVE_EQUIVALENT')reasons.push('NO_LIVE_EQUIVALENCE');
 if(review){
  if(review.ordinaryOnly||settlementDimensions.some(k=>review.dimensions[k]!=='MATCH'))reasons.push('MATERIAL_SETTLEMENT_BRANCH_NOT_ALIGNED');
  if(review.pairId!==pair.id||review.marketHashes.kalshi!==pair.a.hash||review.marketHashes.poly!==pair.b.hash)reasons.push('LIVE_REVIEW_IDENTITY_CHANGED');
  if(!Number.isFinite(review.reviewedAt)||!Number.isFinite(review.expiresAt)||review.reviewedAt>now||review.expiresAt<=now)reasons.push('LIVE_REVIEW_EXPIRED');
  if(review.sources.length<2||review.sources.some(s=>!/^https:\/\//.test(s.url)||! /^[a-f0-9]{64}$/.test(s.sha256)))reasons.push('CONTROLLING_RULE_EVIDENCE_MISSING');
 }
 return reasons;
}
export type LivePrerequisites={ohioEligible:boolean;accountReady:boolean;accountAt:number;feesValidated:boolean;
 unresolvedInventory:boolean;unresolvedExecution:boolean;isolatedFeedsHealthy:boolean;persistenceHealthy:boolean;realizedLoss:boolean};
export function liveAdmission(pair:Pair,review:LiveReview|undefined,q:StudyQuote,input:LivePrerequisites&{confirmed:boolean;confirmationAt:number;marketStatusOpen:boolean;expectedReleaseAt:number;maxCommitted?:number},now:number){
 const reasons=liveSettlementReasons(pair,review,now),e=q.economics,cap=input.maxCommitted??dormantPilot.maxCommitted;
 if(!Number.isSafeInteger(cap)||cap<=0||cap>dormantPilot.maxCommitted)reasons.push('INVALID_PILOT_CAP');
 if(q.pairId!==pair.id||q.quantity!==dormantPilot.quantity||q.pricingReasons.length||!e)reasons.push('EXACT_QUANTITY_DEPTH_NOT_VALIDATED');
 if(!e||!Number.isSafeInteger(e.reservedCash)||e.reservedCash>cap||e.reservedCash<=0)reasons.push('FIVE_DOLLAR_EXPOSURE_CAP');
 if(!e||!Number.isFinite(e.feeBoundSurplus)||e.feeBoundSurplus<=0||e.afterRisk<=0)reasons.push('NO_POSITIVE_AFTER_FEE_AND_RISK_EDGE');
 if(!input.confirmed||!Number.isFinite(input.confirmationAt)||input.confirmationAt>now||now-input.confirmationAt>dormantPilot.maxConfirmationAgeMs)reasons.push('CURRENT_EXACT_BOOK_CONFIRMATION_REQUIRED');
 if(!input.marketStatusOpen||!pair.a.open||!pair.b.open)reasons.push('MARKET_NOT_CONFIRMED_OPEN');
 if(!Number.isFinite(input.expectedReleaseAt)||input.expectedReleaseAt<=now||input.expectedReleaseAt-now>dormantPilot.maxLockupMs)reasons.push('SHORT_LOCKUP_UNESTABLISHED');
 if(!input.ohioEligible)reasons.push('OHIO_ELIGIBILITY_NOT_REVALIDATED');
 if(!input.accountReady||!Number.isFinite(input.accountAt)||input.accountAt>now||now-input.accountAt>dormantPilot.maxAccountAgeMs)reasons.push('CURRENT_ACCOUNT_CAPABILITY_AND_CASH_REQUIRED');
 if(!input.feesValidated)reasons.push('ACCOUNT_SPECIFIC_FEE_BOUND_UNVALIDATED');
 if(input.unresolvedInventory||input.unresolvedExecution)reasons.push('UNRESOLVED_EXPOSURE');
 if(!input.isolatedFeedsHealthy)reasons.push('ISOLATED_EXECUTION_FEEDS_UNHEALTHY');
 if(!input.persistenceHealthy)reasons.push('PERSISTENCE_UNHEALTHY');
 if(input.realizedLoss)reasons.push('REALIZED_LOSS_HARD_STOP');
 return {admitted:reasons.length===0,reasons:[...new Set(reasons)],ordersEnabled:false as const};
}
export const planHash=(plan:unknown)=>createHash('sha256').update(JSON.stringify(plan)).digest('hex');
