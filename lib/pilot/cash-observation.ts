import {createHash} from 'node:crypto';
import {moneyMicros} from './fill-evidence.ts';
import {readAccount} from './account-read.ts';
import type {Venue} from '../arb/types.ts';
const object=(x:unknown):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function signedMoney(x:unknown){
 if(typeof x!=='string'&&typeof x!=='number')throw Error('Exact cash unavailable');
 const value=String(x);return value.startsWith('-')?-moneyMicros(value.slice(1)):moneyMicros(value);
}
// Exact cash is neither buying power nor the pilot's capped available balance.
export function normalizeCashObservation(venue:Venue,raw:unknown,timing:{startedAt:number;finishedAt:number;elapsedMs:number},credentialScope:string){
 const {startedAt,finishedAt,elapsedMs}=timing;
 if(![startedAt,finishedAt].every(n=>Number.isSafeInteger(n)&&n>0)||!Number.isFinite(elapsedMs)||elapsedMs<0||elapsedMs>5000||finishedAt<startedAt||finishedAt-startedAt>5000||Math.abs(finishedAt-startedAt-elapsedMs)>250||!/^[a-f0-9]{64}$/.test(credentialScope))throw Error('Invalid cash observation timing or scope');
 if(!object(raw))throw Error('Cash schema unavailable');
 let cashMicros:number,buyingPowerMicros:number|null=null;
 if(venue==='kalshi')cashMicros=signedMoney(raw.balance_dollars);
 else if(venue==='poly'){
  if(!Array.isArray(raw.balances))throw Error('Cash schema unavailable');
  const usd=raw.balances.filter((x:unknown)=>object(x)&&x.currency==='USD');if(usd.length!==1)throw Error('Unique USD balance required');
  cashMicros=signedMoney(usd[0].currentBalance);buyingPowerMicros=signedMoney(usd[0].buyingPower);
 }else throw Error('Unknown cash venue');
 return {venue,cashMicros,buyingPowerMicros,credentialScope,startedAt,finishedAt,elapsedMs,source:'AUTHENTICATED_BALANCE_GET' as const,accountCashReconciled:false as const};
}
export async function readExactCash(venue:Venue,options:Parameters<typeof readAccount>[2]={}){
 const env=options.env??process.env,key=venue==='kalshi'?env.KALSHI_KEY_ID:env.POLYMARKET_KEY_ID;
 if(!key)throw Error('Cash credential scope unavailable');
 // Fingerprint scopes observations to the same credential identity. Rotation
 // requires review; this is not proof of an exchange account identifier.
 const credentialScope=createHash('sha256').update(venue+':'+key).digest('hex');
 const startedAt=Date.now(),mono=performance.now();const result=await readAccount(venue,'balance',options);
 const finishedAt=Date.now(),elapsedMs=performance.now()-mono;
 if(!result.ok)throw Error('Cash read unavailable');
 const timing={startedAt,finishedAt,elapsedMs};
 return {observation:normalizeCashObservation(venue,result.body,timing,credentialScope),raw:result.body};
}
