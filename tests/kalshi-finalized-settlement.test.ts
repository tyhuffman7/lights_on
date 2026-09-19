import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeKalshi} from '../lib/arb/adapters.ts';
const base={ticker:'KXNCAAFGAME-EXAMPLE',market_type:'binary',notional_value_dollars:'1.0000'};
test('Kalshi finalized REST status exposes published zero, one and scalar payouts',async()=>{
 for(const [value,expected] of [['0.0000',0],['1.0000',10000],['0.5600',5600]] as const){
  const m=await normalizeKalshi({...base,status:'finalized',settlement_value_dollars:value});
  assert.equal(m.settlement,expected);assert.equal(m.open,false);
 }
});
test('Kalshi terminal result fallback and legacy settled status remain supported',async()=>{
 for(const status of ['finalized','settled'])for(const result of ['yes','no']){
  assert.equal((await normalizeKalshi({...base,status,result})).settlement,result==='yes'?10000:0);
 }
});
test('Kalshi provisional outcomes cannot credit settlement; absent or invalid final values fail closed',async()=>{
 for(const status of ['initialized','active','inactive','closed','determined','disputed','amended']){
  assert.equal((await normalizeKalshi({...base,status,result:'yes',settlement_value_dollars:'1.0000'})).settlement,null);
 }
 assert.equal((await normalizeKalshi({...base,status:'finalized'})).settlement,null);
 await assert.rejects(normalizeKalshi({...base,status:'finalized',result:'yes',settlement_value_dollars:'bad'}),/Unsupported price precision/);
});
