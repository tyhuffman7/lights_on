import {readAccountHistory} from './account-history.ts';
import {readOrder} from './account-read.ts';
import {polyActivityFill,type ExpectedFill} from './fill-evidence.ts';
import type {Venue} from '../arb/types.ts';
import type {PilotExecutionLedger} from './execution-ledger.ts';
const object=(x:unknown):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
// Incomplete pagination is never proof of no fills. Select only the authenticated
// account's execution, not its counterparty or the user's unrelated holdings.
export function ownedRawFills(venue:Venue,expected:ExpectedFill,body:unknown):unknown[]{
 if(!object(body))throw Error('Fill page schema unavailable');
 if(venue==='kalshi'){
  if(body.cursor!==''||!Array.isArray(body.fills))throw Error('Incomplete Kalshi fill page');
  return body.fills.filter((f:unknown)=>object(f)&&f.order_id===expected.orderId);
 }
 if(venue!=='poly'||body.eof!==true||body.nextCursor!==''||!Array.isArray(body.activities))throw Error('Incomplete Polymarket fill page');
 const fills=[];
 for(const activity of body.activities){
  if(!object(activity)||activity.type!=='ACTIVITY_TYPE_TRADE'||!object(activity.trade)||typeof activity.trade.isAggressor!=='boolean')throw Error('Unknown trade ownership');
  const trade=activity.trade,execution=trade.isAggressor?trade.aggressorExecution:trade.passiveExecution;
  if(!object(execution)||!object(execution.order)||typeof execution.order.id!=='string')throw Error('Owned execution identity missing');
  if(execution.order.id!==expected.orderId)continue;
  polyActivityFill(activity,expected);fills.push(execution);
 }
 return fills;
}
export async function refreshOwnedIntent(execution:PilotExecutionLedger,id:string,options:Parameters<typeof readOrder>[2]={}){
 const expected=execution.expected(id),row=execution.ledger.get(id),venue=row.venue as Venue;
 try{
  const [fills,order]=await Promise.all([readAccountHistory(venue,'fills',options),readOrder(venue,expected.orderId,options)]);
  if(!order.ok)throw Error('Authoritative order/fill read unavailable');
  if(!object(order.body)||!object(order.body.order))throw Error('Order envelope unavailable');
  return execution.reconcile(id,order.body.order,ownedRawFills(venue,expected,fills.body));
 }catch(e){execution.ledger.halt('AUTHORITATIVE_RECONCILIATION_FAILED');throw e;}
}
