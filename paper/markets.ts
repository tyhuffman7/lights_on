import type {ApprovedPair} from './config.ts';
import {sha} from './config.ts';
import type {Metadata} from './engine.ts';
import {USD} from './engine.ts';

export const K='https://external-api.kalshi.com/trade-api/v2';
export const P='https://gateway.polymarket.us/v1';
export async function get(url:string,signal?:AbortSignal):Promise<any>{
  const u=new URL(url);
  if(![new URL(K).host,new URL(P).host].includes(u.host)||u.protocol!=='https:')throw Error('Public native hosts only');
  const response=await fetch(u,{method:'GET',headers:{accept:'application/json','cache-control':'no-cache'},
    cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
  if(!response.ok)throw Error(`Public metadata HTTP ${response.status}`);
  return response.json();
}
export function rules(k:any,s:any,p:any){
  return {kalshi:[k.rules_primary,k.rules_secondary,s.contract_terms_url,JSON.stringify(s.settlement_sources??[])].filter(Boolean).join('\n\n'),
    poly:String(p.description??'')};
}
export function metadata(pair:ApprovedPair,k:any,s:any,e:any,p:any,published:any,at:number):Metadata{
  if(k.ticker!==pair.kalshi||s.ticker!==pair.kalshi.split('-')[0]||e.event_ticker!==k.event_ticker||p.slug!==pair.poly)
    throw Error('Native metadata identity mismatch');
  const feeType=e.fee_type_override??s.fee_type,multiplier=e.fee_multiplier_override??s.fee_multiplier;
  const kr=['quadratic','quadratic_with_maker_fees'].includes(feeType)&&Number.isFinite(multiplier)?Math.round(700*multiplier):NaN;
  const pr=typeof p.feeCoefficient==='number'?Math.round(p.feeCoefficient*USD):NaN;
  if([kr,pr].some(rate=>!Number.isInteger(rate)||rate<0||rate>USD))throw Error('Unknown native fee schedule');
  // Waivers use the normal rate as a conservative bound; never assume zero fees.
  const r=rules(k,s,p),sides=p.marketSides??[];
  const value=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1&&Number.isInteger(n*USD)?n*USD:null;
  const kPayout=['finalized','settled'].includes(k.status)&&typeof k.settlement_value_dollars==='string'
    &&/^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/.test(k.settlement_value_dollars)?value(Number(k.settlement_value_dollars)):null;
  const pPayout=p.closed===true&&published?.slug===p.slug?value(published.settlement):null;
  const minQty=typeof p.minimumTradeQty==='number'&&p.minimumTradeQty>0?p.minimumTradeQty:NaN;
  const approved=sha(r.kalshi)===pair.kalshiRulesHash&&sha(r.poly)===pair.polyRulesHash
    &&Date.parse(k.close_time)===Date.parse(pair.kalshiCloseAt)&&Date.parse(p.endDate)===Date.parse(pair.polyCloseAt)
    &&Number.isFinite(minQty)&&k.is_provisional!==true;
  return {at,approved,open:k.status==='active'&&p.active===true&&p.closed===false&&!p.archived
    &&p.ep3Status==='OPEN'&&p.status==='MARKET_STATUS_OPEN'&&Date.parse(k.close_time)>at&&Date.parse(p.endDate)>at
    &&sides.some((x:any)=>x.long===true&&x.tradable===true)&&sides.some((x:any)=>x.long===false&&x.tradable===true),
    minQty:Math.max(1,minQty),yesPayout:{kalshi:kPayout,poly:pPayout},
    fees:{kalshi:{rate:kr,rounding:'ceil',aggregation:'level',source:'Native quadratic coefficient; whole-contract fragmentation upper bound; account precision unproven'},
      poly:{rate:pr,rounding:'even',aggregation:'order',source:'Native feeCoefficient; cumulative nearest-cent ties-to-even paper model'}}};
}
export async function loadMetadata(pair:ApprovedPair,signal?:AbortSignal):Promise<Metadata>{
  const at=Date.now(),kr=await get(`${K}/markets/${encodeURIComponent(pair.kalshi)}`,signal),k=kr.market;
  const s=(await get(`${K}/series/${encodeURIComponent(pair.kalshi.split('-')[0])}`,signal)).series;
  const e=(await get(`${K}/events/${encodeURIComponent(k.event_ticker)}`,signal)).event;
  const response=await get(`${P}/market/slug/${encodeURIComponent(pair.poly)}`,signal),p=response.market??response;
  let published=null;
  if(p.closed===true)published=await get(`${P}/markets/${encodeURIComponent(pair.poly)}/settlement`,signal);
  return metadata(pair,k,s,e,p,published,at);
}
