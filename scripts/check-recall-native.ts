// Independent scalar L2 arithmetic. Does not import the detector or fee evaluator.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const [directory,output]=process.argv.slice(2);if(!directory||!output)throw Error('Usage: check-recall-native.ts STOPPED_SESSION OUTPUT_JSON');
const summary=JSON.parse(readFileSync(resolve(directory,'summary.json'),'utf8'));
if(summary.phase!=='STOPPED')throw Error('SESSION_MUST_BE_STOPPED');
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const K='https://external-api.kalshi.com/trade-api/v2',P='https://gateway.polymarket.us/v1';
type Level={p:number;q:number};
function take(levels:Level[],q:number){let left=q,cost=0;const used:Level[]=[];
  for(const l of levels.sort((a,b)=>a.p-b.p)){const n=Math.min(left,l.q);if(n<=0)continue;used.push({p:l.p,q:n});cost+=n*l.p;left-=n;if(left<1e-9)break;}
  return left>1e-9?null:{cost,used};}
function fee(used:Level[],rate:number,kalshi:boolean){if(!Number.isFinite(rate))return null;
  const fees=used.map(l=>rate*l.q*l.p*(1-l.p));
  if(kalshi)return fees.reduce((n,x)=>n+Math.ceil((x-1e-12)*100)/100,0);
  const cents=fees.reduce((n,x)=>n+x,0)*100,base=Math.floor(cents),part=cents-base;
  return (part>.5+1e-9?base+1:part<.5-1e-9?base:base%2?base+1:base)/100;}
const slots=new Map<string,number>();
async function get(url:string){const u=new URL(url);u.searchParams.set('native_check',crypto.randomUUID());
  const slot=Math.max(Date.now(),slots.get(u.hostname)??0);slots.set(u.hostname,slot+400);await pause(slot-Date.now());
  const at=Date.now(),r=await fetch(u,{headers:{accept:'application/json','cache-control':'no-cache'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('HTTP_'+r.status);const data=await r.json() as Record<string,any>;
  return {at,receivedAt:Date.now(),age:r.headers.get('age'),cache:r.headers.get('cf-cache-status'),data};}
const checks=summary.independentCheckRoutes??{};
const selected=[...summary.best,...(checks.highestGross??[]),...(checks.nearPositive??[]),...(checks.canonicalChecks??[])];
const unique=[...new Map<string,any>(selected.map((x:any)=>[x.route.pair.id,x])).values()];
const results:unknown[]=[];
for(const x of unique){const p=x.route.pair;
  try{
    const [kr,pr,sr]=await Promise.all([get(`${K}/markets/${encodeURIComponent(p.a.id)}`),
      get(`${P}/market/slug/${encodeURIComponent(p.b.id)}`),get(`${K}/series/${encodeURIComponent(p.a.series)}`)]);
    const km=kr.data.market,pm=pr.data.market??pr.data,series=sr.data.series;
    const er=await get(`${K}/events/${encodeURIComponent(km.event_ticker)}`),event=er.data.event;
    const feeType=event.fee_type_override??series.fee_type,multiplier=event.fee_multiplier_override??series.fee_multiplier;
    const kRate=km.fee_waiver_expiration_time&&Date.parse(km.fee_waiver_expiration_time)>Date.now()?0:
      ['quadratic','quadratic_with_maker_fees'].includes(feeType)&&Number.isFinite(multiplier)?.07*multiplier:NaN;
    const pRate=Number.isFinite(pm.feeCoefficient)?pm.feeCoefficient:NaN;
    const [k,poly]=await Promise.all([get(`${K}/markets/${encodeURIComponent(p.a.id)}/orderbook?depth=100`),get(`${P}/markets/${encodeURIComponent(p.b.id)}/book`)]);
    const kd=k.data.orderbook_fp,pd=poly.data.marketData;if(pd.marketSlug!==p.b.id||km.ticker!==p.a.id||pm.slug!==p.b.id)throw Error('WRONG_NATIVE_ID');
    const kl=(side:string):Level[]=>(side==='yes'?kd.no_dollars:kd.yes_dollars).map((l:any)=>({p:1-Number(l[0]),q:Number(l[1])}));
    const pl=(side:string):Level[]=>(side==='yes'?pd.offers:pd.bids).map((l:any)=>{if(l.px.currency!=='USD')throw Error('NON_USD');return {p:side==='yes'?Number(l.px.value):1-Number(l.px.value),q:Number(l.qty)};});
    const cases=[];for(const q of [...new Set([1,x.signal.evaluation.quantity])])for(const side of ['yes','no']){
      const other=p.inverted?side:side==='yes'?'no':'yes',a=take(kl(side),q),b=take(pl(other),q);
      const kFee=a?fee(a.used,kRate,true):null,pFee=b?fee(b.used,pRate,false):null;
      cases.push({orientation:'kalshi_'+side+'+pm_us_'+other,quantity:q,kalshi:a,poly:b,
        gross:a&&b?q-a.cost-b.cost:null,fees:kFee!==null&&pFee!==null?kFee+pFee:null,
        normalNet:a&&b&&kFee!==null&&pFee!==null?q-a.cost-b.cost-kFee-pFee:null});}
    results.push({pairId:p.id,event:p.a.title,matchSource:x.route.matchSource,warnings:x.route.warnings,inverted:p.inverted,
      originalObservedAt:x.signal.evaluation.at,nativeCheckedAt:Date.now(),kalshi:k,poly,cases,
      currentFeeMetadata:{kRate:Number.isFinite(kRate)?kRate:null,pRate:Number.isFinite(pRate)?pRate:null,feeType,multiplier},
      currentMarketMetadata:{kalshi:km,poly:pm,series,event},
      interpretation:'Native depth and refreshed ordinary fee arithmetic. Contract equivalence, exceptional settlement and book freshness require separate review. Not a verified arbitrage.'});
  }catch(error){results.push({pairId:p.id,error:(error as Error).message});}
}
writeFileSync(output,JSON.stringify({ordersEnabled:false,scope:'INDEPENDENT_NATIVE_HIGH_GROSS_NEAR_NET_CANONICAL_AND_TOP_ROUTES',
  sourceWindow:{start:summary.start,deadline:summary.deadline},results},null,2)+'\n');
console.log(JSON.stringify({checked:results.length,positive:results.filter((x:any)=>x.cases?.some((c:any)=>c.normalNet>1e-9)).length}));
