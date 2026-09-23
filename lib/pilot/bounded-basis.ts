import {createHash} from 'node:crypto';
import type {Level, Pair, Side, Venue} from '../arb/types.ts';
import type {StreamBook} from '../research/types.ts';
import {classifySettlement, type FamilyProof, type RouteProof} from '../research/family-settlement.ts';

// Candidate research only. This module has no order adapter, credentials or ledger writes.
export const boundedPolicy = Object.freeze({
  version: 2, policy: 'TINY_LIVE_BOUNDED_BASIS', implementationStatus: 'READ_ONLY_CANDIDATE_POLICY',
  ordersEnabled: false, checkpointAllowsOrders: false, authorization: null,
  acceptedClasses: Object.freeze(['ECONOMICALLY_EQUIVALENT', 'BOUNDED_BASIS'] as const),
  maxCommitted: 50000, moneyScale: 10000, maxPositions: 1, maxEntryAttempts: 1,
  maxRecoveryAttempts: 1, maxSimultaneousSequences: 1, reuseProceeds: false,
  stopOnUnknown: true, stopOnRealizedLoss: true, entryAttemptScope: 'LIFETIME_DURABLE_LEDGER_NEVER_RESET',
  consumeAttemptBeforeFirstSubmission: true, maxAccountAgeMs: 5000, maxConfirmationAgeMs: 2000,
  maxExceptionCheckAgeMs: 60000, maxWatchMs: 90 * 60000, maxRoutes: 60,
  preferredSettlementHours: 72, riskFreeClaim: false, exceptionProbability: null,
  exceptionalRiskPenalty: null, admissionCushion: 0, separateLaunchAuthorizationRequired: true,
});
export const practicalClasses = ['ECONOMICALLY_EQUIVALENT', 'BOUNDED_BASIS', 'INCOMPATIBLE', 'UNRESOLVED'] as const;
export type PracticalClass = typeof practicalClasses[number];
export function practicalSettlement(family: FamilyProof, route: RouteProof) {
  // The dimension values are canonical payout predicates produced independently
  // from the two contracts, NOT their source prose. Legacy reports stay immutable.
  const old = classifySettlement(family, route);
  const classification: PracticalClass = old.classification === 'LIVE_EXACT' ? 'ECONOMICALLY_EQUIVALENT'
    : old.classification === 'STATE_CONDITIONED' ? 'BOUNDED_BASIS' : old.classification;
  return {classification, ordinaryComplementary: ['ECONOMICALLY_EQUIVALENT', 'BOUNDED_BASIS'].includes(classification),
    reasons: old.reasons, residualMismatches: structuredClone(family.divergences), ordersEnabled: false as const};
}
export type Evidence = {url: string; sha256: string};
export type Review = {
  pairId: string; hashes: [string, string]; productClasses: Record<Venue, string>;
  family: FamilyProof & {sourceBindings: Record<string,string>}; route: RouteProof; sources: Record<string, Evidence>;
  reviewedAt: number; expiresAt: number; expectedReleaseAt: number; lockupEvidence: Evidence;
  ordinaryState: {status: 'NORMAL' | 'EXCEPTION' | 'UNKNOWN'; checkedAt: number; evidence: Evidence};
  exceptions: {id: string; status: 'CLEAR' | 'INDICATED' | 'UNKNOWN'; checkedAt: number; evidence: Evidence}[];
};
export type FeeEvidence = {
  marketId: string; marketHash: string; checkedAt: number; expiresAt: number; source: Evidence;
  rate: number; model: 'KALSHI_FRAGMENT_BOUND' | 'PM_CUMULATIVE';
  // Upper bound for unknown account class is one cent; never infer precision from a balance.
  balancePrecisionMicros?: 100 | 10000; minFillHundredths?: number;
};
export type AccountGate = {
  accountBinding: string; observedAt: number; complete: boolean; reconciled: boolean;
  available: number; openOrders: number; occupiedMarkets: string[]; unknownExposure: boolean;
  permission: {accountBinding: string; jurisdiction: 'OH'; productClasses: string[];
    tradingPermitted: boolean; writeCapability: boolean; checkedAt: number; expiresAt: number; evidence: Evidence[]};
};
export type Prerequisites = {
  accounts: Record<Venue, AccountGate>; lifetimeAttempts: number; pairedPositions: number;
  executionSequences: number; recoveryAttempts: number; realizedLoss: boolean; reusedProceeds: boolean;
  ledgerReconciled: boolean; ledgerEvidence: Evidence;
};
const digest = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const integer = (n: number, min = 0) => Number.isSafeInteger(n) && n >= min;
const evidence = (e: Evidence | undefined) => !!e && /^https:\/\//.test(e.url) && /^[a-f0-9]{64}$/.test(e.sha256);
const fresh = (at: number, now: number, age: number) => Number.isFinite(now) && integer(at, 1) && at <= now && now - at <= age;
const current = (at: number, expires: number, now: number) => integer(at, 1) && at <= now && Number.isFinite(expires) && expires > now;
export function prerequisiteReasons(input: Prerequisites, productClasses: Record<Venue, string>, now: number) {
  const reasons: string[] = [];
  for (const venue of ['kalshi', 'poly'] as const) {
    const a = input.accounts[venue], p = a.permission;
    if (!a.complete || !a.reconciled || !fresh(a.observedAt, now, boundedPolicy.maxAccountAgeMs) ||
      !integer(a.available) || !integer(a.openOrders) || !Array.isArray(a.occupiedMarkets)) reasons.push(`${venue}:ACCOUNT_RECONCILIATION_REQUIRED`);
    if (a.unknownExposure) reasons.push('UNKNOWN_EXPOSURE_HARD_STOP');
    if (!a.accountBinding || p.accountBinding !== a.accountBinding || p.jurisdiction !== 'OH' ||
      !productClasses[venue] || !p.productClasses.includes(productClasses[venue]) || !p.tradingPermitted || !p.writeCapability ||
      !current(p.checkedAt, p.expiresAt, now) || !p.evidence.length || !p.evidence.every(evidence)) reasons.push(`${venue}:CURRENT_OHIO_PRODUCT_TRADING_PERMISSION_REQUIRED`);
  }
  if (!input.ledgerReconciled || !/^[a-f0-9]{64}$/.test(input.ledgerEvidence.sha256) || !input.ledgerEvidence.url) reasons.push('LIFETIME_LEDGER_RECONCILIATION_REQUIRED');
  if (input.lifetimeAttempts !== 0 || input.pairedPositions !== 0 || input.executionSequences !== 0 || input.recoveryAttempts !== 0) reasons.push('ONE_LIFETIME_ATTEMPT_OR_POSITION_LIMIT');
  if (input.realizedLoss) reasons.push('REALIZED_LOSS_HARD_STOP');
  if (input.reusedProceeds) reasons.push('PROCEEDS_REUSE_FORBIDDEN');
  return [...new Set(reasons)];
}
export function reviewReasons(pair: Pair, r: Review, now: number) {
  const reasons = practicalSettlement(r.family, r.route).ordinaryComplementary ? [] : ['ORDINARY_PAYOUT_NOT_COMPLEMENTARY'];
  if (r.pairId !== pair.id || r.hashes[0] !== pair.a.hash || r.hashes[1] !== pair.b.hash || pair.a.venue !== 'kalshi' || pair.b.venue !== 'poly') reasons.push('REVIEW_IDENTITY_CHANGED');
  if (!current(r.reviewedAt, r.expiresAt, now)) reasons.push('REVIEW_EXPIRED');
  if (r.family.documents.some(d => !evidence(r.sources[d]) || r.sources[d].sha256 !== r.family.sourceBindings[d])) reasons.push('CONTROLLING_SOURCES_UNBOUND');
  if(r.ordinaryState.status!=='NORMAL'||!fresh(r.ordinaryState.checkedAt,now,boundedPolicy.maxExceptionCheckAgeMs)||!evidence(r.ordinaryState.evidence))reasons.push('CURRENT_ORDINARY_EVENT_STATE_UNESTABLISHED');
  const ids = r.family.divergences.map(d => d.id);
  if (new Set(ids).size !== ids.length || r.exceptions.length !== ids.length || new Set(r.exceptions.map(e => e.id)).size !== ids.length ||
    r.exceptions.some(e => !ids.includes(e.id)) || ids.some(id => !r.exceptions.some(e => e.id === id))) reasons.push('EXCEPTION_REVIEW_INCOMPLETE');
  if (r.exceptions.some(e => e.status !== 'CLEAR' || !fresh(e.checkedAt, now, boundedPolicy.maxExceptionCheckAgeMs) || !evidence(e.evidence))) reasons.push('EXCEPTION_INDICATED_OR_UNKNOWN');
  if (!Number.isFinite(r.expectedReleaseAt) || r.expectedReleaseAt <= now || !evidence(r.lockupEvidence)) reasons.push('LOCKUP_UNESTABLISHED');
  return [...new Set(reasons)];
}
function validateFee(f: FeeEvidence, venue: Venue, id: string, hash: string, now: number) {
  return f.marketId === id && f.marketHash === hash && current(f.checkedAt, f.expiresAt, now) && evidence(f.source) &&
    integer(f.rate) && f.rate <= 10000 && (venue === 'poly' ? f.model === 'PM_CUMULATIVE' :
      f.model === 'KALSHI_FRAGMENT_BOUND' && [100,10000].includes(f.balancePrecisionMicros!) && integer(f.minFillHundredths!, 1) && 100 % f.minFillHundredths! === 0);
}
const ceil = (n: bigint, d: bigint) => (n + d - 1n) / d;
export function conservativeFee(levels: Level[], f: FeeEvidence) {
  // Prices use 1/10,000 USD, quantities are whole paired contracts. The Kalshi
  // fill count bound includes fractional fragmentation; rebates are never needed.
  const raw = levels.reduce((n,l) => n + BigInt(Math.round(l.quantity*100)) * BigInt(l.price) * BigInt(10000-l.price) * BigInt(f.rate), 0n);
  if (f.model === 'PM_CUMULATIVE') return Number(ceil(raw, 1000000000000n)) * 100;
  const fills = levels.reduce((n,l) => n + Math.round(l.quantity * 100) / f.minFillHundredths!, 0);
  const micros = ceil(raw, 100000000n) + BigInt(Math.max(0,fills-1)) + BigInt(fills) * BigInt(f.balancePrecisionMicros!-1);
  return Number(ceil(micros, 100n));
}
function depth(levels: Level[]) {
  if (!Array.isArray(levels) || levels.some(l => !integer(l.price,1) || l.price >= 10000 || !Number.isFinite(l.quantity) || l.quantity <= 0 || !Number.isSafeInteger(Math.round(l.quantity*100)) || Math.abs(l.quantity*100-Math.round(l.quantity*100))>1e-8)) return null;
  // Preserve fractional visible fills even though the paired order size is whole.
  return [...levels].map(l => ({price:l.price,quantity:Math.round(l.quantity*100)/100})).filter(l=>l.quantity>0).sort((a,b)=>a.price-b.price);
}
function take(levels: Level[], quantity: number) {
  let left = quantity*100;
  const used: Level[] = [];
  for (const l of levels) {const n = Math.min(left,Math.round(l.quantity*100)); if(n)used.push({price:l.price,quantity:n/100});left-=n;if(!left)break;}
  return left ? null : used;
}
export type Quote = {
  pairId: string; hashes: [string,string]; aSide: Side; bSide: Side; quantity: number; at: number;
  kalshi: {levels: Level[]; cost: number; feeUpper: number; maximumFeeUpper: number; maxDebit: number; recoveryCash: number};
  poly: {levels: Level[]; cost: number; feeUpper: number; maximumFeeUpper: number; maxDebit: number; recoveryCash: number};
  entryDebit: number; maxCommitted: number; recoveryCash: number; ordinaryPayout: number;
  feeNetProfit: number; returnOnCommitted: number; expectedReleaseAt: number; feeEvidenceHash: string; integrity: string;
};
export function quoteBounded(pair: Pair, books: Record<Venue,StreamBook>, side: Side, fees: Record<Venue,FeeEvidence>, releaseAt: number, now: number, exactQuantity?: number) {
  if (!Number.isFinite(now) || !Number.isFinite(releaseAt) || releaseAt<=now || !['yes','no'].includes(side) || !pair.a.open || !pair.b.open ||
    ![pair.a.minQty,pair.b.minQty].every(n=>Number.isFinite(n)&&n>0)) return [] as Quote[];
  for(const [v,m] of [['kalshi',pair.a],['poly',pair.b]] as const)if(!books[v]?.open || !books[v].valid || books[v].connection!=='LIVE' || books[v].marketId!==m.id || books[v].venue!==v || !validateFee(fees[v],v,m.id,m.hash,now))return [] as Quote[];
  const bSide:Side=pair.inverted?side:side==='yes'?'no':'yes', a=depth(books.kalshi[side]),b=depth(books.poly[bSide]);
  if(!a?.length||!b?.length)return [] as Quote[];
  const minimum=Math.max(1,Math.ceil(pair.a.minQty),Math.ceil(pair.b.minQty));
  const limit=Math.min(Math.floor(boundedPolicy.maxCommitted/(a[0].price+b[0].price)),Math.floor(a.reduce((n,l)=>n+Math.round(l.quantity*100),0)/100),Math.floor(b.reduce((n,l)=>n+Math.round(l.quantity*100),0)/100));
  if(exactQuantity!==undefined&&(!integer(exactQuantity,minimum)||exactQuantity>limit))return [] as Quote[];
  const out:Quote[]=[];
  for(let q=exactQuantity??minimum;q<=(exactQuantity??limit);q++){
    const al=take(a,q),bl=take(b,q);if(!al||!bl||al.some(l=>Math.round(l.quantity*100)%fees.kalshi.minFillHundredths!))continue;
    const leg=(levels:Level[],f:FeeEvidence)=>{const cost=Math.ceil(levels.reduce((n,l)=>n+l.price*Math.round(l.quantity*100),0)/100),feeUpper=conservativeFee(levels,f);
      // Reserve one reducing unwind at the maximum quadratic fee price. This is
      // cash capacity, not a deduction from ordinary settlement profitability.
      const recoveryCash=conservativeFee([{price:5000,quantity:q}],f);
      // A marketable limit can fill every unit at the last consumed level.
      // Reserve and test profitability at that ceiling, including the largest
      // possible quadratic fee below it; the displayed VWAP stays in cost.
      const limitPrice=levels.at(-1)!.price;
      const maximumFeeUpper=conservativeFee([{price:Math.min(5000,limitPrice),quantity:q}],f);
      return {levels,cost,feeUpper,maximumFeeUpper,maxDebit:q*limitPrice+maximumFeeUpper,recoveryCash};};
    const kalshi=leg(al,fees.kalshi),poly=leg(bl,fees.poly),entryDebit=kalshi.maxDebit+poly.maxDebit;
    const recoveryCash=Math.max(kalshi.recoveryCash,poly.recoveryCash),maxCommitted=entryDebit+recoveryCash;
    if(maxCommitted>boundedPolicy.maxCommitted)continue;
    const ordinaryPayout=q*10000,feeNetProfit=ordinaryPayout-entryDebit;
    const row:Omit<Quote,'integrity'>={pairId:pair.id,hashes:[pair.a.hash,pair.b.hash],aSide:side,bSide,quantity:q,at:now,kalshi,poly,
      entryDebit,maxCommitted,recoveryCash,ordinaryPayout,feeNetProfit,returnOnCommitted:feeNetProfit/maxCommitted,
      expectedReleaseAt:releaseAt,feeEvidenceHash:digest(fees)};
    out.push({...row,integrity:digest(row)});
  }
  return out.sort(rankQuotes);
}
export const rankQuotes=(a:Quote,b:Quote)=>b.feeNetProfit-a.feeNetProfit || b.returnOnCommitted-a.returnOnCommitted || a.expectedReleaseAt-b.expectedReleaseAt || a.quantity-b.quantity || a.pairId.localeCompare(b.pairId);
export type Confirmation = {pairId:string;quantity:number;aSide:Side;bSide:Side;hashes:[string,string];accepted:boolean;
  requestedAt:number;confirmedAt:number;evidenceSha256:string;isolatedFeedsHealthy:boolean;marketStatusOpen:boolean;persistenceHealthy:boolean};
export function admitBounded(pair:Pair,r:Review,q:Quote,input:Prerequisites,c:Confirmation,now:number){
  const reasons=[...reviewReasons(pair,r,now),...prerequisiteReasons(input,r.productClasses,now)];
  const {integrity,...content}=q;
  if(integrity!==digest(content)||q.expectedReleaseAt!==r.expectedReleaseAt)reasons.push('QUOTE_CHANGED');
  if(q.pairId!==pair.id||q.hashes[0]!==pair.a.hash||q.hashes[1]!==pair.b.hash||!integer(q.quantity,1)||q.bSide!==(pair.inverted?q.aSide:q.aSide==='yes'?'no':'yes'))reasons.push('QUOTE_IDENTITY_OR_ORIENTATION_CHANGED');
  if(!integer(q.maxCommitted,1)||q.maxCommitted>boundedPolicy.maxCommitted||!integer(q.entryDebit,1)||!integer(q.recoveryCash)||
    q.maxCommitted!==q.entryDebit+q.recoveryCash||q.entryDebit!==q.kalshi.maxDebit+q.poly.maxDebit||q.ordinaryPayout!==q.quantity*10000||
    q.feeNetProfit!==q.ordinaryPayout-q.entryDebit||!integer(q.feeNetProfit,1))reasons.push('CAP_OR_POSITIVE_FEE_NET_ECONOMICS_FAILED');
  for(const [v,m]of [['kalshi',pair.a],['poly',pair.b]] as const){const a=input.accounts[v];
    if(a.openOrders!==0||a.occupiedMarkets.includes(m.id))reasons.push('EXISTING_ORDER_OR_ROUTE_POSITION');
    if(a.available<q[v].maxDebit+q[v].recoveryCash)reasons.push('VENUE_CASH_INSUFFICIENT');
  }
  if(!c.accepted||c.pairId!==q.pairId||c.quantity!==q.quantity||c.aSide!==q.aSide||c.bSide!==q.bSide||
    c.hashes[0]!==q.hashes[0]||c.hashes[1]!==q.hashes[1]||!integer(c.requestedAt,1)||c.requestedAt>c.confirmedAt||
    !fresh(c.confirmedAt,now,boundedPolicy.maxConfirmationAgeMs)||!fresh(q.at,now,boundedPolicy.maxConfirmationAgeMs)||q.at<c.confirmedAt||
    !/^[a-f0-9]{64}$/.test(c.evidenceSha256))reasons.push('CURRENT_EXACT_REQUESTED_BOOK_PROOF_REQUIRED');
  if(!pair.a.open||!pair.b.open||!c.marketStatusOpen)reasons.push('MARKET_NOT_TRADABLE');
  if(!c.isolatedFeedsHealthy)reasons.push('ISOLATED_EXECUTION_FEEDS_UNHEALTHY');
  if(!c.persistenceHealthy)reasons.push('PERSISTENCE_UNHEALTHY');
  return {candidate:reasons.length===0,reasons:[...new Set(reasons)],ordersEnabled:false as const};
}
export function freezeCandidate(pair:Pair,review:Review,quote:Quote,input:Prerequisites,confirmation:Confirmation,now:number){
  const admission=admitBounded(pair,review,quote,input,confirmation,now);if(!admission.candidate)throw Error(admission.reasons.join(';'));
  const result={policy:boundedPolicy.policy,frozenAt:now,pairId:pair.id,markets:[pair.a.id,pair.b.id],quote:structuredClone(quote),
    indicativeLockupMs:review.expectedReleaseAt-now,classification:practicalSettlement(review.family,review.route).classification,
    residualSettlementMismatches:structuredClone(review.family.divergences),ordinaryState:structuredClone(review.ordinaryState),exceptions:structuredClone(review.exceptions),
    requestedBookEvidenceSha256:confirmation.evidenceSha256,reviewSha256:digest(review),
    approvalRequired:true,ordersEnabled:false,fillClaim:false};
  return {...result,sha256:digest(result)};
}
