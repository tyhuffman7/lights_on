import {constants,createPrivateKey,sign} from 'node:crypto';
import type {Venue} from '../arb/types.ts';
import {encodePilotBuy,encodePilotSell} from './order-wire.ts';
import {moneyMicros} from './fill-evidence.ts';
import {dormantPilot} from './live-admission.ts';
import type {LiveLedger} from './live-ledger.ts';

type Leg=Parameters<typeof encodePilotBuy>[0];
type Metadata=Parameters<typeof encodePilotBuy>[1];
export type OrderDraft={venue:Venue;method:'POST';url:string;path:string;body:Record<string,unknown>;leg:Leg;metadata:Metadata;action:'buy'|'sell';localId:string};
export function constructLiveOrder(leg:Leg,metadata:Metadata,localId:string,action:'buy'|'sell'='buy'):OrderDraft{
 if(action!=='buy'&&action!=='sell')throw Error('INVALID_ACTION');
 if(!/^[a-zA-Z0-9:_-]{1,128}$/.test(localId))throw Error('INVALID_LOCAL_ID');
 if(!Number.isSafeInteger(Math.round(metadata.minimumQuantity*10000))||Math.abs(metadata.minimumQuantity*10000-Math.round(metadata.minimumQuantity*10000))>1e-8||10000%Math.round(metadata.minimumQuantity*10000)!==0)throw Error('QUANTITY_INCREMENT_UNSUPPORTED');
 if(leg.venue==='poly'&&(leg.limitPrice<100||leg.limitPrice>9900))throw Error('PM_PRICE_OUTSIDE_ABSOLUTE_LIMITS');
 const wire=(action==='buy'?encodePilotBuy:encodePilotSell)(leg,metadata,localId);
 const path=leg.venue==='kalshi'?'/trade-api/v2/portfolio/events/orders':'/v1/orders';
 return {venue:leg.venue,method:'POST',url:(leg.venue==='kalshi'?'https://external-api.kalshi.com':'https://api.polymarket.us')+path,path,
  body:wire.venue==='poly'?{...wire.body,synchronousExecution:true,maxBlockTime:'2'}:wire.body,leg:{...leg},metadata:{...metadata},action,localId};
}
export function validateOrderDraft(draft:OrderDraft){if(JSON.stringify(draft)!==JSON.stringify(constructLiveOrder(draft.leg,draft.metadata,draft.localId,draft.action)))throw Error('ORDER_DRAFT_CHANGED');}
// Offline signing, also exercised with generated test keys. No environment lookup,
// output logging or network here; callers must never persist the returned headers.
export function signOrderDraft(draft:OrderDraft,credentials:{keyId:string;secret:string},at:number):Record<string,string>{
 if(!Number.isSafeInteger(at)||at<0||!credentials.keyId)throw Error('INVALID_SIGNING_INPUT');
 validateOrderDraft(draft);
 const path=draft.venue==='kalshi'?'/trade-api/v2/portfolio/events/orders':'/v1/orders';
 if(draft.path!==path||draft.method!=='POST'||draft.url!==(draft.venue==='kalshi'?'https://external-api.kalshi.com':'https://api.polymarket.us')+path)throw Error('DESTINATION_NOT_ALLOWED');
 const timestamp=String(at),message=Buffer.from(timestamp+'POST'+path);
 if(draft.venue==='kalshi')return {'Content-Type':'application/json','KALSHI-ACCESS-KEY':credentials.keyId,'KALSHI-ACCESS-TIMESTAMP':timestamp,
  'KALSHI-ACCESS-SIGNATURE':sign('sha256',message,{key:credentials.secret,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64')};
 if(draft.venue!=='poly')throw Error('VENUE_NOT_ALLOWED');
 const raw=Buffer.from(credentials.secret,'base64');if(![32,64].includes(raw.length))throw Error('INVALID_ED25519_KEY');
 const key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),raw.subarray(0,32)]),format:'der',type:'pkcs8'});
 return {'Content-Type':'application/json','X-PM-Access-Key':credentials.keyId,'X-PM-Timestamp':timestamp,'X-PM-Signature':sign(null,message,key).toString('base64')};
}
export type LiveOutcome={state:'fill'|'no-fill'|'rejected'|'unknown';orderId:string|null;filled:number|null;feeMicros:number|null;reason:string;raw:unknown};
const object=(x:any)=>x&&typeof x==='object'&&!Array.isArray(x);
const qty=(x:unknown)=>typeof x==='string'&&/^\d+(\.\d{1,2})?$/.test(x)?Number(x):NaN;
// A receipt is preliminary venue evidence. Inventory still requires matching fills
// and GET order/account reconciliation; neither HTTP 200 nor an ID implies a fill.
export function interpretLiveReply(draft:OrderDraft,status:number,raw:unknown):LiveOutcome{
 let id:string|null=null;const unknown=(reason:string):LiveOutcome=>({state:'unknown',orderId:id,filled:null,feeMicros:null,reason,raw});
 const r=raw as any;if(!object(r))return unknown('MALFORMED_REPLY');
 id=typeof (draft.venue==='kalshi'?r.order_id:r.id)==='string'?(draft.venue==='kalshi'?r.order_id:r.id):null;
 if(status<200||status>=300)return unknown('HTTP_ERROR_REQUIRES_RECONCILIATION');
 if(!id)return unknown('ORDER_ID_MISSING');
 try{
  if(draft.venue==='kalshi'){
   if(r.client_order_id!==undefined&&r.client_order_id!==draft.localId)return unknown('CLIENT_ID_MISMATCH');
   const filled=qty(r.fill_count),remaining=qty(r.remaining_count);
   if(!Number.isSafeInteger(r.ts_ms)||r.ts_ms<=0||remaining!==0||![0,draft.leg.quantity].includes(filled))return unknown('NONTERMINAL_OR_PARTIAL_FOK');
   if(filled===0){if(r.average_fill_price!==undefined||r.average_fee_paid!==undefined)return unknown('ZERO_FILL_WITH_FILL_FIELDS');return {state:'no-fill',orderId:id,filled:0,feeMicros:null,reason:'VENUE_FOK_ZERO_FILL_RECEIPT_RECONCILE',raw};}
   const fee=r.average_fee_paid===undefined?null:moneyMicros(r.average_fee_paid)*filled;
   const px=moneyMicros(r.average_fill_price),owned=draft.leg.side==='yes'?px:1000000-px;
   if(px<=0||px>=1000000||(draft.action==='buy'?owned>draft.leg.limitPrice*100:owned<draft.leg.limitPrice*100))return unknown('FILL_PRICE_OUTSIDE_LIMIT');
   return {state:'fill',orderId:id,filled,feeMicros:fee,reason:'VENUE_FOK_FILL_RECEIPT_RECONCILE',raw};
  }
  if(!Array.isArray(r.executions)||!r.executions.length)return unknown('ACKNOWLEDGEMENT_ONLY');
  const executions=r.executions,ids=new Set<string>();let lastAt=-Infinity,previousFilled=0;
  for(const e of executions){
   const o=e?.order,at=Date.parse(e?.transactTime);
   if(!object(o)||typeof e.id!=='string'||!e.id||ids.has(e.id)||!Number.isFinite(at)||at<lastAt||o.id!==id||o.marketSlug!==draft.leg.marketId||o.intent!==(draft.body.intent as string)||o.quantity!==draft.leg.quantity||typeof o.cumQuantity!=='number'||o.cumQuantity<previousFilled||o.cumQuantity>draft.leg.quantity)return unknown('EXECUTION_IDENTITY_OR_ORDERING_MISMATCH');
   ids.add(e.id);lastAt=at;previousFilled=o.cumQuantity;
  }
  const o=executions.at(-1).order,filled=o.cumQuantity;
  if(o.leavesQuantity!==0||![0,draft.leg.quantity].includes(filled))return unknown('NONTERMINAL_OR_PARTIAL_FOK');
  const fee=o.commissionNotionalTotalCollected===undefined?null:o.commissionNotionalTotalCollected.currency==='USD'?moneyMicros(o.commissionNotionalTotalCollected.value):NaN;
  if(fee!==null&&!Number.isSafeInteger(fee))return unknown('INVALID_COLLECTED_FEE');
  if(o.state==='ORDER_STATE_FILLED'&&filled===draft.leg.quantity){
   if(o.avgPx?.currency!=='USD')return unknown('FILL_PRICE_MISSING');
   const px=moneyMicros(o.avgPx.value),owned=draft.leg.side==='yes'?px:1000000-px;
   if(px<=0||px>=1000000||(draft.action==='buy'?owned>draft.leg.limitPrice*100:owned<draft.leg.limitPrice*100))return unknown('FILL_PRICE_OUTSIDE_LIMIT');
   return {state:'fill',orderId:id,filled,feeMicros:fee,reason:'VENUE_FOK_FILL_RECEIPT_RECONCILE',raw};
  }
  if(filled===0&&(fee===null||fee===0)&&['ORDER_STATE_CANCELED','ORDER_STATE_EXPIRED','ORDER_STATE_REJECTED'].includes(o.state))return {state:o.state==='ORDER_STATE_REJECTED'?'rejected':'no-fill',orderId:id,filled,feeMicros:fee,reason:'VENUE_TERMINAL_ZERO_FILL_RECONCILE',raw};
  return unknown('STATE_NOT_TERMINAL');
 }catch{return unknown('REPLY_FIELDS_INVALID');}
}
export type Arming={ordersEnabled:boolean;planSha256:string;authorization:{userAuthorizedAt:number;expiresAt:number;planSha256:string;reference:string}|null};
// Literal build gate, not an environment switch. The dormant transport below is
// unreachable in this checkpoint, even with a forged arming file. Future activation
// requires separately authorized review of this gate plus an exact-plan grant.
export class DisabledLiveAdapter {
 readonly ordersEnabled=false;
 async submit(slot:'first'|'second'|'recovery',ledger:LiveLedger,arming:Arming,
  credentials:()=>{keyId:string;secret:string},revalidate:()=>Promise<boolean>):Promise<LiveOutcome>{
  if(!dormantPilot.checkpointAllowsOrders)throw Error('CHECKPOINT_HARD_DISABLED_NEW_USER_AUTHORIZATION_REQUIRED');
  const now=Date.now(),state=ledger.view(),grant=arming.authorization;
  if(arming.ordersEnabled!==true||!grant||!grant.reference||!Number.isSafeInteger(grant.userAuthorizedAt)||!Number.isSafeInteger(grant.expiresAt)||grant.userAuthorizedAt>now||grant.expiresAt<=now||grant.planSha256!==state.planSha256||arming.planSha256!==state.planSha256)throw Error('EXACT_USER_AUTHORIZATION_REQUIRED');
  if(!await revalidate())throw Error('CURRENT_ADMISSION_REJECTED');
  const draft=ledger.request(slot); // durable reservation + intent precede transport
  let outcome:LiveOutcome;
  try{
   const headers=signOrderDraft(draft,credentials(),Date.now());
   const response=await fetch(draft.url,{method:'POST',headers,body:JSON.stringify(draft.body),redirect:'error',signal:AbortSignal.timeout(5000)});
   const raw=await response.text();if(Buffer.byteLength(raw)>1024*1024)throw Error('RESPONSE_RESOURCE_LIMIT');
   outcome=interpretLiveReply(draft,response.status,JSON.parse(raw));
  }catch{outcome={state:'unknown',orderId:null,filled:null,feeMicros:null,reason:'TRANSPORT_OR_RESPONSE_UNKNOWN_NO_RETRY',raw:null};}
  ledger.receipt(outcome);return outcome;
 }
}
