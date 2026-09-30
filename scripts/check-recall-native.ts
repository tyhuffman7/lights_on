// Independent scalar L2 arithmetic. Does not import the detector or fee evaluator.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const [directory,output]=process.argv.slice(2);if(!directory||!output)throw Error('Usage: check-recall-native.ts STOPPED_SESSION OUTPUT_JSON');
const summary=JSON.parse(readFileSync(resolve(directory,'summary.json'),'utf8'));
if(summary.phase!=='STOPPED')throw Error('SESSION_MUST_BE_STOPPED');
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
type Level={p:number;q:number};
function take(levels:Level[],q:number){let left=q,cost=0;const used:Level[]=[];
  for(const l of levels.sort((a,b)=>a.p-b.p)){const n=Math.min(left,l.q);if(n<=0)continue;used.push({p:l.p,q:n});cost+=n*l.p;left-=n;if(left<1e-9)break;}
  return left>1e-9?null:{cost,used};}
function fee(used:Level[],rate:number,kalshi:boolean){if(!Number.isFinite(rate))return null;
  const fees=used.map(l=>rate*l.q*l.p*(1-l.p));
  if(kalshi)return fees.reduce((n,x)=>n+Math.ceil((x-1e-12)*100)/100,0);
  const cents=fees.reduce((n,x)=>n+x,0)*100,base=Math.floor(cents),part=cents-base;
  return (part>.5+1e-9?base+1:part<.5-1e-9?base:base%2?base+1:base)/100;}
async function get(url:string){const u=new URL(url);u.searchParams.set('native_check',crypto.randomUUID());
  const at=Date.now(),r=await fetch(u,{headers:{accept:'application/json','cache-control':'no-cache'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('HTTP_'+r.status);const data=await r.json();return {at,receivedAt:Date.now(),age:r.headers.get('age'),cache:r.headers.get('cf-cache-status'),data};}
const results:unknown[]=[];
for(const x of summary.best){const p=x.route.pair,q=x.signal.evaluation.quantity;
  try{const [k,pm]=await Promise.all([get(`https://external-api.kalshi.com/trade-api/v2/markets/${encodeURIComponent(p.a.id)}/orderbook?depth=100`),
    get(`https://gateway.polymarket.us/v1/markets/${encodeURIComponent(p.b.id)}/book`)]);
    const kd=k.data.orderbook_fp,pd=pm.data.marketData;if(pd.marketSlug!==p.b.id)throw Error('WRONG_PM_US_ID');
    const kl=(side:string):Level[]=>(side==='yes'?kd.no_dollars:kd.yes_dollars).map((l:any)=>({p:1-Number(l[0]),q:Number(l[1])}));
    const pl=(side:string):Level[]=>(side==='yes'?pd.offers:pd.bids).map((l:any)=>{if(l.px.currency!=='USD')throw Error('NON_USD');return {p:side==='yes'?Number(l.px.value):1-Number(l.px.value),q:Number(l.qty)};});
    const cases=[];for(const side of ['yes','no']){const other=p.inverted?side:side==='yes'?'no':'yes',a=take(kl(side),q),b=take(pl(other),q);
      const kFee=a?fee(a.used,p.a.feeRate===null?NaN:p.a.feeRate/10000,true):null,pFee=b?fee(b.used,p.b.feeRate===null?NaN:p.b.feeRate/10000,false):null;
      cases.push({orientation:'kalshi_'+side+'+pm_us_'+other,quantity:q,kalshi:a,poly:b,
        gross:a&&b?q-a.cost-b.cost:null,fees:kFee!==null&&pFee!==null?kFee+pFee:null,
        normalNet:a&&b&&kFee!==null&&pFee!==null?q-a.cost-b.cost-kFee-pFee:null});}
    results.push({pairId:p.id,event:p.a.title,matchSource:x.route.matchSource,warnings:x.route.warnings,
      originalObservedAt:x.signal.evaluation.at,nativeCheckedAt:Date.now(),kalshi:k,poly:pm,cases,
      interpretation:'Prices are native executable depth; orientation, fee metadata age and settlement must still be checked. Not a verified arbitrage.'});
  }catch(error){results.push({pairId:p.id,error:(error as Error).message});}
  await pause(400);
}
writeFileSync(output,JSON.stringify({ordersEnabled:false,scope:'INDEPENDENT_NATIVE_REST_CHECK_TOP_20_ROUTES',
  sourceWindow:{start:summary.start,deadline:summary.deadline},results},null,2)+'\n');
console.log(JSON.stringify({checked:results.length,positive:results.filter((x:any)=>x.cases?.some((c:any)=>c.normalNet>1e-9)).length}));
