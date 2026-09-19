import {getJSON} from '../lib/arb/adapters.ts';import {makerFeeProfile,type MakerFeeProfile} from '../lib/arb/maker-fees.ts';
export async function fetchMakerFees(series:string[]){
 const profiles=new Map<string,MakerFeeProfile>();
 for(const id of new Set(series)){if(!/^[A-Z0-9]+$/.test(id))continue;try{const result=await getJSON('https://external-api.kalshi.com/trade-api/v2/series/'+id);profiles.set(id,makerFeeProfile(id,result.series,Date.now()));}catch{/* Unsupported or unavailable schedule keeps the conservative taker fallback. */}}
 return profiles;
}
