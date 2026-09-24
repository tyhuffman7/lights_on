import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {market,book,getJSON} from '../lib/arb/adapters.ts';
import {matchCandidates} from '../lib/research/matching.ts';
import {assessSettlement} from '../lib/research/settlement-validation.ts';
import {evaluateEvArb,USD_SCALE,type SettlementStatus} from '../lib/research/ev-arb.ts';
import type {Pair,Venue,Book} from '../lib/arb/types.ts';
import type {StreamBook} from '../lib/research/types.ts';

const dollars=(n:number|null)=>n===null?'UNAVAILABLE':`${n<0?'-':'+'}$${(Math.abs(n)/USD_SCALE).toFixed(4)}`;
export function asRestBook(venue:Venue,id:string,b:Book):StreamBook{return {...b,venue,marketId:id,receivedMono:performance.now(),
  sequence:null,connection:'LIVE',valid:true,source:'rest'};}
export function formatPairAudit(pair:Pair,books:Record<Venue,StreamBook>,now=Date.now(),matchStatus='UNVERIFIED',quantity=1,
    ticks:Record<Venue,number>={kalshi:0,poly:0}){
  const assessment=assessSettlement(pair),status:SettlementStatus=assessment.status==='CONFLICT'?'INCOMPATIBLE':'UNVERIFIED';
  const rows=(['yes','no'] as const).map(side=>evaluateEvArb(pair,books,side,quantity,now,status,undefined,ticks,assessment.risks));
  const best=[...rows].sort((a,b)=>(b.estimatedNetProfit??-Infinity)-(a.estimatedNetProfit??-Infinity))[0];
  const out=['PAIR AUDIT — READ-ONLY PUBLIC L2; NO PAPER FILL OR LIVE ORDER',`Equal paired quantity: ${quantity}`,
    `Kalshi: ${pair.a.id} — ${pair.a.title}`,`Polymarket US: ${pair.b.id} — ${pair.b.title}`,
    `Orientation match: ${matchStatus}; settlement: ${assessment.status}; profile: ${assessment.profile??'NONE'}`,
    `Settlement warnings: ${[...assessment.blockers,...assessment.risks].join(' | ')||'NONE'}`];
  for(const r of rows){out.push('',r.orientation,
    `Book timestamps: Kalshi ${new Date(books.kalshi.receivedAt).toISOString()}, PM-US ${new Date(books.poly.receivedAt).toISOString()}`,
    `Consumed Kalshi levels: ${JSON.stringify(r.kalshi?.levels??[])}`,
    `Consumed PM-US levels: ${JSON.stringify(r.poly?.levels??[])}`,
    `Acquisition cost: ${dollars(r.acquisitionCost)}`,
    `Gross profit: ${dollars(r.grossProfit)}; ${r.grossStatus}`,
    `Estimated fees: ${dollars(r.estimatedFees)}; confidence: ${r.feeConfidence}`,
    `Estimated net: ${dollars(r.estimatedNetProfit)}; ${r.economicStatus}`,
    `Stress fee bound: ${dollars(r.stress.feeBound)}; pass: ${r.stress.feeBoundPass??'UNKNOWN'}`,
    `One-tick stress: ${dollars(r.stress.oneTickProfit)}; pass: ${r.stress.oneTickPass??'UNKNOWN'}`,
    `Freshness: ${r.stress.freshnessPass?'PASS':'FAIL'}`,
    `Current paper attempt: ${r.execution.paperEligible?'YES':'NO'}; gate(s): ${r.execution.reasons.join(', ')||'NONE'}`);
  }
  out.push('',`Best modeled net: ${best.orientation} ${dollars(best.estimatedNetProfit)}`,
    'Public REST snapshot is diagnostic only; a stream-confirmed future snapshot is required before a paper attempt.');
  return out.join('\n');
}
export async function auditPair(kalshiId:string,pmUsId:string,quantity=1){
  if(!/^[a-zA-Z0-9_.-]{1,220}$/.test(kalshiId)||!/^[a-zA-Z0-9_.-]{1,220}$/.test(pmUsId))throw Error('INVALID_MARKET_ID');
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100)throw Error('INVALID_AUDIT_QUANTITY');
  const [a,b]=await Promise.all([market('kalshi',kalshiId),market('poly',pmUsId)]);
  const matches=matchCandidates([a],[b]),m=matches[0];
  const pair:Pair=m?.pair??{id:`direct:${kalshiId}|${pmUsId}`,a,b,inverted:false,reviewed:false};
  const [ka,pb,rawK,rawP]=await Promise.all([book(a),book(b),
    getJSON(`https://external-api.kalshi.com/trade-api/v2/markets/${encodeURIComponent(a.id)}`),
    getJSON(`https://gateway.polymarket.us/v1/market/slug/${encodeURIComponent(b.id)}`)]);
  const km=rawK.market,pm=rawP.market??rawP,ranges=km?.price_ranges;
  const kalshiTick=km?.price_level_structure==='linear_cent'&&ranges?.length===1&&ranges[0].step==='0.0100'?100:0;
  const pTick=Math.round(Number(pm.orderPriceMinTickSize)*10000);
  return formatPairAudit(pair,{kalshi:asRestBook('kalshi',a.id,ka),poly:asRestBook('poly',b.id,pb)},Date.now(),
    m?'MATCHED':'UNVERIFIED_ORIENTATION',quantity,{kalshi:kalshiTick,poly:Number.isSafeInteger(pTick)&&pTick>0?pTick:0});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const kalshi=process.argv.find(x=>x.startsWith('--kalshi='))?.slice(9),pmus=process.argv.find(x=>x.startsWith('--pmus='))?.slice(7);
  if(!kalshi||!pmus)throw Error('Usage: npm run research:audit-pair -- --kalshi=MARKET_TICKER --pmus=PM_US_SLUG');
  const quantity=Number(process.argv.find(x=>x.startsWith('--quantity='))?.slice(11)??1);
  console.log(await auditPair(kalshi,pmus,quantity));
}
