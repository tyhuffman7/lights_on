import {classifyPolyCashActivities} from './cash-conservation.ts';
import {evidenceUnits,moneyMicros} from './fill-evidence.ts';
const object=(x:unknown):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function identity(a:unknown):string|null{
 if(!object(a))return null;
 if(a.type==='ACTIVITY_TYPE_TRADE'&&object(a.trade)&&typeof a.trade.isAggressor==='boolean'){const e=a.trade.isAggressor?a.trade.aggressorExecution:a.trade.passiveExecution;return typeof e?.id==='string'&&e.id?'fill:'+e.id:null;}
 if(a.type==='ACTIVITY_TYPE_ACCOUNT_DEPOSIT'&&typeof a.accountBalanceChange?.transactionId==='string'&&a.accountBalanceChange.transactionId)return 'deposit:'+a.accountBalanceChange.transactionId;
 if(a.type==='ACTIVITY_TYPE_POSITION_RESOLUTION'&&typeof a.positionResolution?.marketSlug==='string'&&a.positionResolution.marketSlug&&['POSITION_RESOLUTION_SIDE_LONG','POSITION_RESOLUTION_SIDE_SHORT'].includes(a.positionResolution.side))return 'resolution:'+a.positionResolution.marketSlug+':'+a.positionResolution.side;
 return null;
}
function completedBeforeObservation(a:unknown,observedAt:number){
 if(!object(a))return false;
 if(a.type!=='ACTIVITY_TYPE_POSITION_RESOLUTION'){const h=classifyPolyCashActivities([a]);return h.complete&&h.movements.length===1&&h.movements[0].latestAt<=observedAt;}
 try{const r=a.positionResolution,t=typeof r?.updateTime==='string'?Date.parse(r.updateTime):NaN;
  return !!identity(a)&&Number.isFinite(t)&&t<=observedAt&&r.market?.slug===r.marketSlug&&r.market?.closed===true&&r.market?.status==='MARKET_STATUS_RESOLVED'&&evidenceUnits(r.afterPosition?.netPositionDecimal)===0&&r.afterPosition?.cashValue?.currency==='USD'&&moneyMicros(r.afterPosition.cashValue.value)===0;
 }catch{return false;}
}
// Exclude unchanged completed history already observed before starting cash.
// This does NOT assert that a payout arrived. Any later cash change still leaves
// an unexplained residual unless separately evidenced in the audited interval.
export function filterPriorPolyHistory(current:unknown[],prior:unknown[],observedAt:number,cashStartedAt:number){
 if(!Array.isArray(current)||!Array.isArray(prior)||!Number.isSafeInteger(observedAt)||observedAt<=0||!Number.isSafeInteger(cashStartedAt)||observedAt>=cashStartedAt)throw Error('Prior history must precede cash observation');
 const old=new Map<string,string>(),issues:string[]=[];
 for(const a of prior){const id=identity(a);if(!id||!completedBeforeObservation(a,observedAt))continue;const raw=JSON.stringify(a);if(old.has(id)&&old.get(id)!==raw)issues.push('CONFLICTING_PRIOR_ACTIVITY');else old.set(id,raw);}
 const seen=new Set<string>(),activities:unknown[]=[];let excluded=0;
 for(const a of current){const id=identity(a);if(id&&old.has(id)){seen.add(id);if(old.get(id)===JSON.stringify(a)){excluded++;continue;}issues.push('PRIOR_ACTIVITY_CHANGED');}activities.push(a);}
 for(const id of old.keys())if(!seen.has(id))issues.push('PRIOR_ACTIVITY_MISSING');
 return {activities,excluded,issues:[...new Set(issues)]};
}
