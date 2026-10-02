import {mkdirSync,openSync,closeSync,writeFileSync,readFileSync,existsSync,renameSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import type {State} from './engine.ts';

export function openStore(directory:string,configHash:string){
  mkdirSync(directory,{recursive:true,mode:0o700});
  const lock=join(directory,'bot.lock'),fd=openSync(lock,'wx',0o600);
  writeFileSync(fd,String(process.pid));closeSync(fd);
  const path=join(directory,'state.json');
  const release=()=>unlinkSync(lock);
  try{
    const state:State=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{version:1,configHash,positions:[]};
    if(state.version!==1||state.configHash!==configHash||!Array.isArray(state.positions))
      throw Error('State/config mismatch; preserve this directory and choose a new --data directory');
    // Verify saved positions by reconstructing them; fail closed on damaged cashflows.
    for(const p of state.positions){
      if(!p.id||!p.pair?.id||!Number.isInteger(p.quantity)||p.quantity<1||!Number.isFinite(Date.parse(p.timestamp))
        ||!['open','early-exit','settled'].includes(p.status))throw Error('Invalid stored position');
      for(const v of ['kalshi','poly'] as const){
        const l=p[v];
        if(!['yes','no'].includes(l.side)||!Number.isSafeInteger(l.fees)||l.fees<0||!Array.isArray(l.levels)
          ||l.levels.some(x=>!Number.isInteger(x.quantity)||x.quantity<=0||!Number.isInteger(x.price)||x.price<=0||x.price>=10000)
          ||l.levels.reduce((n,x)=>n+x.quantity,0)!==p.quantity||l.levels.reduce((n,x)=>n+x.price*x.quantity,0)!==l.notional)
          throw Error('Invalid stored entry cashflow');
      }
      if(p.totalCost!==p.kalshi.notional+p.poly.notional+p.kalshi.fees+p.poly.fees
        ||p.lockedSettlementProfit!==p.quantity*10000-p.totalCost)throw Error('Invalid stored cost');
      if(p.status!=='open'&&(!Number.isSafeInteger(p.proceeds)||p.pnl!==p.proceeds!-p.totalCost))throw Error('Invalid stored close cashflow');
      if(p.status==='early-exit'&&(!p.exit||p.proceeds!==p.exit.kalshi.notional+p.exit.poly.notional-p.exit.kalshi.fees-p.exit.poly.fees))throw Error('Invalid stored exit');
      if(p.status==='settled'&&(!p.settlementPayouts||Object.values(p.settlementPayouts).some(x=>!Number.isInteger(x)||x<0||x>10000)
        ||p.proceeds!==(p.settlementPayouts.kalshi+p.settlementPayouts.poly)*p.quantity))throw Error('Invalid stored settlement');
    }
    const atomic=(target:string,content:string)=>{writeFileSync(target+'.tmp',content,{mode:0o600});renameSync(target+'.tmp',target);};
    const save=()=>{
      atomic(path,JSON.stringify(state,null,2)+'\n');
      const cols=['id','pair','kalshi_side','poly_side','quantity','timestamp','kalshi_prices','poly_prices','fees_usd','total_cost_usd','conditional_locked_profit_usd','status','closed_at','paper_pnl_usd'];
      const escape=(x:unknown)=>'"'+String(x??'').replaceAll('"','""')+'"';
      const rows=state.positions.map(p=>[p.id,p.pair.id,p.kalshi.side,p.poly.side,p.quantity,p.timestamp,
        JSON.stringify(p.kalshi.levels),JSON.stringify(p.poly.levels),(p.kalshi.fees+p.poly.fees)/10000,p.totalCost/10000,
        p.lockedSettlementProfit/10000,p.status,p.closedAt,p.pnl===undefined?'':p.pnl/10000].map(escape).join(','));
      atomic(join(directory,'positions.csv'),cols.join(',')+'\n'+rows.join('\n')+'\n');
    };
    return {state,save,release};
  }catch(error){release();throw error;}
}
