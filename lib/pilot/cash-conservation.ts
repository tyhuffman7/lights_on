import type {assessPolySettlement} from './settlement-evidence.ts';
import {moneyMicros,polyActivityFill,type ExpectedFill} from './fill-evidence.ts';
import type {normalizeCashObservation} from './cash-observation.ts';
type Observation=ReturnType<typeof normalizeCashObservation>;
const object=(x:unknown):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export type Movement={id:string;cashFlowMicros:number;earliestAt:number;latestAt:number;attribution:'EXTERNAL_DEPOSIT'|'OWNED_TRADE'|'UNRELATED_TRADE'|'EXPECTED_SETTLEMENT'|'UNRELATED_SETTLEMENT'|'UNSCOPED_DEPOSIT'};
export function classifyPolyCashActivities(activities:unknown[],ownedOrders:Record<string,ExpectedFill>={},settlements:{record:unknown;assessment:ReturnType<typeof assessPolySettlement>}[]=[]){
 if(!Array.isArray(activities))throw Error('Complete account activities required');
 const movements=new Map<string,Movement>(),unresolved:string[]=[];
 const time=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
 for(const activity of activities){
  let movement:Movement;
  try{
   if(!object(activity))throw Error('UNKNOWN_ACTIVITY');
   if(activity.type==='ACTIVITY_TYPE_TRADE'){
    const t=activity.trade;if(!object(t)||typeof t.isAggressor!=='boolean')throw Error('UNKNOWN_TRADE_OWNERSHIP');
    const execution=t.isAggressor?t.aggressorExecution:t.passiveExecution,order=execution?.order;
    if(!object(order)||typeof order.id!=='string'||!['ORDER_ACTION_BUY','ORDER_ACTION_SELL'].includes(order.action)||!['OUTCOME_SIDE_YES','OUTCOME_SIDE_NO'].includes(order.outcomeSide))throw Error('TRADE_IDENTITY_UNAVAILABLE');
    const owned=Object.hasOwn(ownedOrders,order.id)?ownedOrders[order.id]:undefined;
    const expected:ExpectedFill=owned??{orderId:order.id,marketId:order.marketSlug,side:order.outcomeSide==='OUTCOME_SIDE_YES'?'yes':'no',action:order.action==='ORDER_ACTION_BUY'?'buy':'sell'};
    const fill=polyActivityFill(activity,expected);
    movement={id:'fill:'+fill.fillId,cashFlowMicros:fill.cashFlowMicros,earliestAt:time(t.createTime),latestAt:time(t.updateTime),attribution:owned?'OWNED_TRADE':'UNRELATED_TRADE'};
   }else if(activity.type==='ACTIVITY_TYPE_POSITION_RESOLUTION'){
    const matching=settlements.filter(s=>JSON.stringify(s.record)===JSON.stringify(activity));
    if(matching.length!==1)throw Error('SETTLEMENT_CASH_EVIDENCE_REQUIRED');
    const a=matching[0].assessment,r=activity.positionResolution;
    if(!Object.hasOwn(ownedOrders,a.orderId)||ownedOrders[a.orderId].marketId!==a.marketId||r.marketSlug!==a.marketId||time(r.updateTime)!==time(a.resolvedAt)||!Number.isSafeInteger(a.expectedPayoutMicros)||a.expectedPayoutMicros<0)throw Error('SETTLEMENT_OWNERSHIP_OR_AMOUNT_CONFLICT');
    movement={id:'settlement:'+a.marketId+':'+r.side,cashFlowMicros:a.expectedPayoutMicros,earliestAt:time(a.resolvedAt),latestAt:time(a.resolvedAt),attribution:'EXPECTED_SETTLEMENT'};
   }else if(activity.type==='ACTIVITY_TYPE_ACCOUNT_DEPOSIT'){
    const b=activity.accountBalanceChange;
    if(!object(b)||b.status!=='ACCOUNT_BALANCE_CHANGE_STATUS_COMPLETED'||typeof b.transactionId!=='string'||!b.transactionId||!object(b.amount)||b.amount.currency!=='USD')throw Error('DEPOSIT_NOT_PROVEN_COMPLETE');
    const amount=moneyMicros(b.amount.value);if(amount<=0)throw Error('DEPOSIT_AMOUNT_INVALID');
    movement={id:'deposit:'+b.transactionId,cashFlowMicros:amount,earliestAt:time(b.createTime),latestAt:time(b.updateTime),attribution:'EXTERNAL_DEPOSIT'};
   }else throw Error(activity.type==='ACTIVITY_TYPE_POSITION_RESOLUTION'?'SETTLEMENT_CASH_EVIDENCE_REQUIRED':'UNSUPPORTED_CASH_ACTIVITY');
   if(!Number.isFinite(movement.earliestAt)||!Number.isFinite(movement.latestAt)||movement.earliestAt>movement.latestAt)throw Error('CASH_EVENT_TIME_UNAVAILABLE');
   const old=movements.get(movement.id);if(old&&JSON.stringify(old)!==JSON.stringify(movement))throw Error('CONFLICTING_CASH_EVENT');
   movements.set(movement.id,movement);
  }catch(e){unresolved.push(e instanceof Error?e.message:'UNKNOWN_ACTIVITY');}
 }
 return {venue:'poly' as const,movements:[...movements.values()],unresolved,complete:unresolved.length===0};
}
// Diagnostic conservation only. Complete pagination is not proof of an atomic
// event stream; this check never authorizes credits or reports realized profit.
export function auditCashConservation(before:Observation,after:Observation,history:{venue:'kalshi'|'poly';movements:Movement[];unresolved:string[];complete:boolean}){
 if(!['kalshi','poly'].includes(before.venue)||history.venue!==before.venue||after.venue!==before.venue||before.credentialScope!==after.credentialScope||!/^[a-f0-9]{64}$/.test(before.credentialScope)||![before.cashMicros,after.cashMicros,before.startedAt,before.finishedAt,after.startedAt,after.finishedAt].every(Number.isSafeInteger)||before.startedAt>before.finishedAt||before.finishedAt>=after.startedAt||after.startedAt>after.finishedAt)throw Error('Comparable nonoverlapping cash observations required');
 const reasons=[...history.unresolved];if(!history.complete)reasons.push('INCOMPLETE_CASH_CLASSIFICATION');let expected=0n,external=0n,owned=0n,unrelated=0n,settlement=0n,unrelatedSettlement=0n;
 const seen=new Map<string,Movement>();
 for(const movement of history.movements){
  if(!Number.isSafeInteger(movement.cashFlowMicros)||!Number.isFinite(movement.earliestAt)||!Number.isFinite(movement.latestAt)||movement.earliestAt>movement.latestAt||!movement.id)throw Error('Invalid classified cash event');
  const old=seen.get(movement.id);if(old){if(JSON.stringify(old)!==JSON.stringify(movement))throw Error('Conflicting cash movement');continue;}seen.set(movement.id,movement);
  if(movement.latestAt<before.startedAt||movement.earliestAt>after.finishedAt)continue;
  if(movement.earliestAt<=before.finishedAt||movement.latestAt>=after.startedAt){reasons.push('CASH_EVENT_OVERLAPS_OBSERVATION');continue;}
  const cash=BigInt(movement.cashFlowMicros);expected+=cash;
  if(movement.attribution==='EXTERNAL_DEPOSIT')external+=cash;else if(movement.attribution==='OWNED_TRADE')owned+=cash;else if(movement.attribution==='UNRELATED_TRADE')unrelated+=cash;else if(movement.attribution==='EXPECTED_SETTLEMENT')settlement+=cash;else if(movement.attribution==='UNRELATED_SETTLEMENT')unrelatedSettlement+=cash;else if(movement.attribution==='UNSCOPED_DEPOSIT'){external+=cash;reasons.push('FUNDING_ACCOUNT_SCOPE_UNVERIFIED');}else throw Error('Unknown cash attribution');
 }
 const actual=BigInt(after.cashMicros)-BigInt(before.cashMicros),residual=actual-expected;
 const exact=(n:bigint)=>{const value=Number(n);if(!Number.isSafeInteger(value))throw Error('Cash aggregate overflow');return value;};
 if(residual!==0n)reasons.push('UNEXPLAINED_CASH_CHANGE');
 return {status:reasons.length?'UNRECONCILED':'CONSISTENT_WITH_CLASSIFIED_CASH',actualDeltaMicros:exact(actual),classifiedDeltaMicros:exact(expected),unexplainedDeltaMicros:exact(residual),externalDepositMicros:exact(external),expectedSettlementMicros:exact(settlement),unrelatedSettlementMicros:exact(unrelatedSettlement),ownedTradeCashFlowMicros:exact(owned),unrelatedTradeCashFlowMicros:exact(unrelated),reasons:[...new Set(reasons)],realizedProfitMicros:null,creditAuthorized:false as const};
}
