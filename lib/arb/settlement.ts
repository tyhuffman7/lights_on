import type {State,Venue,Market} from './types.ts';
import {settle,log} from './ledger.ts';
export async function checkSettlements(state:State,lookup:(venue:Venue,id:string)=>Promise<Pick<Market,'settlement'>>):Promise<State>{
 let s=structuredClone(state);
 // Check least recently visited positions first so an unresolved contract cannot starve others.
 const pending=s.positions.filter(p=>p.status!=='settled').sort((a,b)=>(a.settlementCheckedAt||0)-(b.settlementCheckedAt||0)).slice(0,8);
 for(const p of pending){
  p.settlementCheckedAt=Date.now();
  const results=await Promise.allSettled([
   p.aPayout===undefined?lookup('kalshi',p.pair.a.id):Promise.resolve({settlement:null}),
   p.bPayout===undefined?lookup('poly',p.pair.b.id):Promise.resolve({settlement:null})
  ]);
  const values=results.map(r=>{if(r.status==='fulfilled')return r.value.settlement;log(s,'data unavailable',`Settlement check: ${r.reason instanceof Error?r.reason.message:String(r.reason)}`);return null;});
  s=settle(s,p.id,values[0],values[1]);
  // settle clones state, so persist the check timestamp explicitly for subsequent cycles.
  s.positions.find(x=>x.id===p.id)!.settlementCheckedAt=p.settlementCheckedAt;
 }
 return s;
}
