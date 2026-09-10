import {loadState,saveState} from '@/lib/store';
import {user,reply,error,sameOrigin} from '@/lib/api';
import {integer} from '@/lib/arb/core';
import {log} from '@/lib/arb/ledger';
export async function GET(){try{return reply(await loadState(await user()));}catch(e){return error(e);}}
export async function POST(req:Request){try{
 sameOrigin(req);const uid=await user(),s=await loadState(uid),body=await req.json() as Record<string,any>;
 if(body.action==='start'){if(!s.startedAt){s.startedAt=Date.now();log(s,'challenge','30-day paper challenge started');}}
 else if(body.action==='settings'){
  const x=body.settings;const check=(key:string,min:number,max:number)=>integer(x[key],min,max);
  s.settings={maxTrade:check('maxTrade',10000,1000000),maxCommitted:check('maxCommitted',10000,1000000),minProfit:check('minProfit',100,100000),minRoi:check('minRoi',1,50),reserve:check('reserve',100,1000),maxDays:check('maxDays',1,30),maxAge:2000};
  if(s.settings.maxTrade>s.settings.maxCommitted)throw new Error('Per-trade limit exceeds total commitment limit');log(s,'settings','Paper risk limits updated');
 }else if(body.action==='remove'){s.pairs=s.pairs.filter(p=>p.id!==body.pairId);log(s,'watchlist','Pair removed from watchlist');}
 else if(body.action==='expense'){const n=integer(body.amount,1,1000000);if(n>s.cash.kalshi)throw new Error('Expense exceeds available Kalshi paper cash');s.cash.kalshi-=n;s.expenses+=n;log(s,'expense',`Operating expense: $${(n/10000).toFixed(2)}`);}
 else throw new Error('Unknown action');
 return reply(await saveState(uid,s,s.version));
 }catch(e){return error(e);}}
