import {createHash} from 'node:crypto';
import type {Pair,Venue,Side,Level} from '../arb/types.ts';
import type {StreamBook} from './types.ts';
import {evPaperDefaults,normalFee,takeDepth,type ArbEvaluation,type EvPaperPolicy,type Taken} from './ev-arb.ts';

export type PaperFinalState='CLEAN_PAIRED_FILL'|'DISAPPEARED_BEFORE_ENTRY'|
  'FIRST_LEG_FILLED_HEDGE_FAILED_UNWOUND'|'PARTIAL_UNWIND'|'ORPHAN_EXPOSURE'|
  'REJECTED_DATA_QUALITY'|'REJECTED_SETTLEMENT'|'REJECTED_RISK_LIMIT';
export type PaperAttempt={
  attemptId:string;strategy:string;simulation:'PAPER_DEPTH_COUNTERFACTUAL_NOT_REAL_FILL';attemptRole:'PRIMARY'|'COUNTERFACTUAL';pairId:string;
  marketIds:{kalshi:string;poly:string};orientation:string;quantity:number;detectedAt:number;
  sourceBooks:ArbEvaluation['sourceBooks'];consumedLevels:{kalshi:Level[];poly:Level[]};
  entryBookReferences:Record<Venue,{at:number;sha256:string}>;futureBookReferences:Record<Venue,{at:number;sha256:string}>;
  grossProfit:number|null;estimatedFees:number|null;estimatedNetProfit:number|null;
  stressFeeBound:number|null;stress:ArbEvaluation['stress'];settlementStatus:ArbEvaluation['settlementStatus'];settlementWarnings:string[];
  firstLegVenue:Venue;firstLegSide:Side;firstLegIntendedPrice:number|null;
  firstLegSimulatedFill:Taken|null;firstLegFee:number;
  hedgeDelayMs:number;secondLegIntendedPrice:number|null;secondLegAvailablePrice:number|null;
  secondLegSimulatedFill:Taken|null;secondLegFee:number;
  unwindRequired:boolean;unwindLevels:Level[];unwindProceeds:number;unwindFee:number;
  residualQuantity:number;residualCost:number;eventualModeledOutcome:null;
  grossPaperProfit:number;fees:number;normalSlippage:number;unwindLoss:number;orphanLoss:number;
  paperPnL:number;finalState:PaperFinalState;reason:string|null;at:number;
};
function sellAvailable(levels:Level[],quantity:number):Taken|null{
  let remaining=quantity*10000,cost=0;const used:Level[]=[];
  for(const l of [...levels].sort((a,b)=>b.price-a.price)){
    const n=Math.round(l.quantity*10000);
    if(!Number.isSafeInteger(l.price)||l.price<=0||l.price>=10000||!Number.isSafeInteger(n)||n<0||Math.abs(l.quantity*10000-n)>1e-5)throw Error('INVALID_UNWIND_BOOK');
    const filled=Math.min(remaining,n);if(!filled)continue;
    used.push({price:l.price,quantity:filled/10000});cost+=l.price*filled;remaining-=filled;if(!remaining)break;
  }
  const filled=(quantity*10000-remaining)/10000;
  return filled?{levels:used,quantity:filled,cost,lastPrice:used.at(-1)!.price}:null;
}
export function simulatePaperAttempt(pair:Pair,frozen:ArbEvaluation,entry:Record<Venue,StreamBook>,future:Record<Venue,StreamBook>,
    firstVenue:Venue,hedgeDelayMs:number,at:number,policy:EvPaperPolicy=evPaperDefaults,attemptRole:'PRIMARY'|'COUNTERFACTUAL'='PRIMARY'):PaperAttempt{
  const firstSide=firstVenue==='kalshi'?frozen.kalshiSide:frozen.polySide;
  const secondVenue:Venue=firstVenue==='kalshi'?'poly':'kalshi';
  const secondSide=secondVenue==='kalshi'?frozen.kalshiSide:frozen.polySide;
  const firstQuote=frozen[firstVenue],secondQuote=frozen[secondVenue];
  const attemptId=createHash('sha256').update(JSON.stringify([frozen.strategy,frozen.pairId,frozen.orientation,
    frozen.at,frozen.sourceBooks,firstVenue,at,attemptRole])).digest('hex');
  const result:PaperAttempt={attemptId,strategy:frozen.strategy,simulation:'PAPER_DEPTH_COUNTERFACTUAL_NOT_REAL_FILL',attemptRole,
    pairId:frozen.pairId,marketIds:frozen.markets,orientation:frozen.orientation,quantity:frozen.quantity,
    detectedAt:frozen.at,sourceBooks:frozen.sourceBooks,consumedLevels:{kalshi:frozen.kalshi?.levels??[],poly:frozen.poly?.levels??[]},
    entryBookReferences:Object.fromEntries((['kalshi','poly'] as const).map(v=>[v,{at:entry[v].receivedAt,sha256:bookDigest(entry[v])}])) as PaperAttempt['entryBookReferences'],
    futureBookReferences:Object.fromEntries((['kalshi','poly'] as const).map(v=>[v,{at:future[v].receivedAt,sha256:bookDigest(future[v])}])) as PaperAttempt['futureBookReferences'],
    grossProfit:frozen.grossProfit,estimatedFees:frozen.estimatedFees,estimatedNetProfit:frozen.estimatedNetProfit,
    stressFeeBound:frozen.stress.feeBound,stress:frozen.stress,settlementStatus:frozen.settlementStatus,
    settlementWarnings:frozen.settlementWarnings,
    firstLegVenue:firstVenue,firstLegSide:firstSide,firstLegIntendedPrice:firstQuote?.lastPrice??null,
    firstLegSimulatedFill:null,firstLegFee:0,hedgeDelayMs,secondLegIntendedPrice:secondQuote?.lastPrice??null,
    secondLegAvailablePrice:null,secondLegSimulatedFill:null,secondLegFee:0,unwindRequired:false,unwindLevels:[],
    unwindProceeds:0,unwindFee:0,residualQuantity:0,residualCost:0,eventualModeledOutcome:null,
    grossPaperProfit:0,fees:0,normalSlippage:0,unwindLoss:0,orphanLoss:0,paperPnL:0,
    finalState:'REJECTED_DATA_QUALITY',reason:null,at};
  const reject=(state:PaperFinalState,reason:string)=>{result.finalState=state;result.reason=reason;return result;};
  if(frozen.settlementStatus==='INCOMPATIBLE')return reject('REJECTED_SETTLEMENT','SETTLEMENT_INCOMPATIBLE');
  if(!frozen.stress.freshnessPass)return reject('REJECTED_DATA_QUALITY','DETECTION_BOOK_NOT_FRESH');
  if(!frozen.execution.paperEligible){const cap=frozen.execution.reasons.some(r=>r.endsWith('_CAP'));
    return reject(cap?'REJECTED_RISK_LIMIT':'REJECTED_DATA_QUALITY',frozen.execution.reasons.join(';'));}
  if(!firstQuote||!secondQuote||frozen.estimatedFees===null)return reject('REJECTED_DATA_QUALITY','INCOMPLETE_FROZEN_ECONOMICS');
  if(hedgeDelayMs<policy.hedgeDelayMs)return reject('REJECTED_DATA_QUALITY','HEDGE_DELAY_NOT_OBSERVED');
  const same=(v:Venue,b:StreamBook,clock:number)=>b.marketId===frozen.markets[v]&&b.valid&&b.open&&b.connection==='LIVE'&&b.source==='stream'&&
    clock-b.receivedAt>=0&&clock-b.receivedAt<=policy.maxBookAgeMs&&
    (b.exchangeAt===null||clock-b.exchangeAt>=-1000&&clock-b.exchangeAt<=policy.maxBookAgeMs);
  if(!same(firstVenue,entry[firstVenue],at))return reject('REJECTED_DATA_QUALITY','FIRST_BOOK_NOT_CURRENT');
  const first=takeDepth(entry[firstVenue][firstSide],frozen.quantity);
  if(!first||first.lastPrice>firstQuote.lastPrice)return reject('DISAPPEARED_BEFORE_ENTRY','FIRST_LEG_PRICE_OR_DEPTH_DISAPPEARED');
  const firstFee=normalFee(first.levels,(firstVenue==='kalshi'?pair.a:pair.b).feeRate??NaN,firstVenue);
  if(firstFee===null)return reject('REJECTED_DATA_QUALITY','FIRST_FEE_UNAVAILABLE');
  if(first.cost+firstFee>policy.maxOneSidedExposure||first.cost+firstFee+(secondQuote.cost+
    (normalFee(secondQuote.levels,(secondVenue==='kalshi'?pair.a:pair.b).feeRate??NaN,secondVenue)??0))>policy.maxPairedCommitment)
    return reject('REJECTED_RISK_LIMIT','SIMULATED_EXPOSURE_OR_COMMITMENT_CAP');
  result.firstLegSimulatedFill=first;result.firstLegFee=firstFee;result.fees=firstFee;
  const hedgeCurrent=same(secondVenue,future[secondVenue],at+hedgeDelayMs);
  const hedge=hedgeCurrent?takeDepth(future[secondVenue][secondSide],frozen.quantity):null;
  result.secondLegAvailablePrice=hedge?.lastPrice??null;
  const hedgeFee=hedge?normalFee(hedge.levels,(secondVenue==='kalshi'?pair.a:pair.b).feeRate??NaN,secondVenue):null;
  const normalSlip=hedge?first.cost+hedge.cost-(firstQuote.cost+secondQuote.cost):null;
  const hedgeOkay=hedge&&hedgeFee!==null&&normalSlip!==null&&normalSlip<=policy.maxHedgeSlippage&&
    first.cost+firstFee+hedge.cost+hedgeFee<=policy.maxPairedCommitment;
  if(hedgeOkay){
    result.secondLegSimulatedFill=hedge;result.secondLegFee=hedgeFee;result.fees+=hedgeFee;
    result.normalSlippage=normalSlip;result.grossPaperProfit=frozen.grossProfit!;
    result.paperPnL=result.grossPaperProfit-result.fees-result.normalSlippage;
    result.finalState='CLEAN_PAIRED_FILL';return result;
  }
  result.unwindRequired=true;
  const unwindBook=future[firstVenue];
  const unwind=same(firstVenue,unwindBook,at+hedgeDelayMs)?sellAvailable(firstSide==='yes'?unwindBook.yesBids:unwindBook.noBids,frozen.quantity):null;
  if(unwind){
    const unwindFee=normalFee(unwind.levels,(firstVenue==='kalshi'?pair.a:pair.b).feeRate??NaN,firstVenue)??0;
    result.unwindLevels=unwind.levels;result.unwindProceeds=unwind.cost;result.unwindFee=unwindFee;result.fees+=unwindFee;
    const soldUnits=Math.round(unwind.quantity*10000),totalUnits=frozen.quantity*10000;
    const soldBasis=Math.floor(first.cost*soldUnits/totalUnits);
    result.unwindLoss=soldBasis-unwind.cost;
    result.residualQuantity=frozen.quantity-unwind.quantity;result.residualCost=first.cost-soldBasis;
  }else{result.residualQuantity=frozen.quantity;result.residualCost=first.cost;}
  result.paperPnL=-result.fees-result.unwindLoss;
  result.finalState=result.residualQuantity===0?'FIRST_LEG_FILLED_HEDGE_FAILED_UNWOUND':unwind?'PARTIAL_UNWIND':'ORPHAN_EXPOSURE';
  result.reason=hedgeCurrent?(hedge?'HEDGE_PRICE_OR_COMMITMENT_LIMIT':'SECOND_LEG_DEPTH_DISAPPEARED'):'SECOND_BOOK_NOT_CURRENT';
  return result;
}
export const bookEvidence=(book:StreamBook)=>({venue:book.venue,marketId:book.marketId,yes:book.yes,no:book.no,
  yesBids:book.yesBids,noBids:book.noBids,receivedAt:book.receivedAt,exchangeAt:book.exchangeAt,
  sequence:book.sequence,connection:book.connection,valid:book.valid,open:book.open,source:book.source,
  receivedMono:book.receivedMono,...(book.capture?{capture:book.capture}:{})});
export const bookDigest=(book:StreamBook)=>createHash('sha256').update(JSON.stringify(bookEvidence(book))).digest('hex');
