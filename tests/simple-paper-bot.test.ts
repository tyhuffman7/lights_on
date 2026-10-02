import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readConfig,configSchema,sha} from '../paper/config.ts';
import {quote,tick,balances,settle,type State,type Metadata} from '../paper/engine.ts';
import {metadata,rules} from '../paper/markets.ts';
import {openStore} from '../paper/store.ts';
import {BookCache} from '../lib/research/books.ts';
import {fee,feesForLevels} from '../lib/research/fees.ts';
import type {StreamBook} from '../lib/research/types.ts';

const config=readConfig('config/approved-pairs.json'),pair=config.pairs[0],at=1790967600000;
const state=():State=>({version:1,configHash:sha(JSON.stringify(config)),positions:[]});
const meta=():Metadata=>({at,approved:true,open:true,minQty:1,yesPayout:{kalshi:null,poly:null},
  fees:{kalshi:{rate:700,rounding:'ceil',aggregation:'level',source:'test'},poly:{rate:695,rounding:'even',aggregation:'order',source:'test'}}});
const book=(venue:'kalshi'|'poly'):StreamBook=>({venue,marketId:venue==='kalshi'?pair.kalshi:pair.poly,
  yes:[{price:venue==='kalshi'?4000:6000,quantity:4}],no:[{price:venue==='kalshi'?6100:5000,quantity:4}],
  yesBids:[{price:3900,quantity:4}],noBids:[{price:4900,quantity:4}],
  receivedAt:at,receivedMono:1000,exchangeAt:at,sequence:1,connection:'LIVE',valid:true,source:'stream',open:true});

test('15 manually reviewed pairs load; duplicates, live mode and missing review rejected',()=>{
  assert.equal(config.pairs.length,15);
  assert.throws(()=>configSchema.parse({...config,mode:'live'}));
  assert.throws(()=>configSchema.parse({...config,pairs:[pair,pair]}));
  assert.throws(()=>configSchema.parse({...config,pairs:[{...pair,reviewSource:null}]}));
});
test('fee arithmetic includes ceiling, ties-to-even and PM cumulative rounding',()=>{
  assert.equal(fee(1,4000,700,'ceil'),200);
  assert.equal(fee(1,5000,600,'even'),200); // 1.5 cents -> 2
  assert.equal(fee(1,5000,1000,'even'),200); // 2.5 cents -> 2
  assert.equal(feesForLevels([{price:5000,quantity:4}],meta().fees.poly),700);
  const q=quote([{price:4000,quantity:4}],4,'yes',meta().fees.kalshi,'kalshi')!;
  assert.equal(q.notional,16000);assert.equal(q.fees,800);
});
test('positive asks plus fees open the maximum equal whole depth and record conditional profit',()=>{
  const s=state(),p=tick(pair,book('kalshi'),book('poly'),meta(),config,s,at,1000)!;
  assert.equal(p.quantity,4);assert.equal(p.totalCost,37500);assert.equal(p.lockedSettlementProfit,2500);
  assert.equal(p.kalshi.side,'yes');assert.equal(p.poly.side,'no');assert.equal(balances(s,config).capitalLocked,37500);
  assert.equal(tick(pair,book('kalshi'),book('poly'),meta(),config,s,at,1000),null);
});
test('both opposite-side orientations are evaluated',()=>{
  const k=book('kalshi'),p=book('poly');k.yes=[{price:8000,quantity:4}];k.no=[{price:3000,quantity:4}];p.yes=[{price:5000,quantity:4}];
  const position=tick(pair,k,p,meta(),config,state(),at,1000)!;
  assert.equal(position.kalshi.side,'no');assert.equal(position.poly.side,'yes');
});
test('sizing walks multiple levels, floors fractional depth and respects total and venue cash',()=>{
  const k=book('kalshi');k.yes=[{price:4000,quantity:2.9},{price:4500,quantity:3}];
  const position=tick(pair,k,book('poly'),meta(),config,state(),at,1000)!;
  assert.equal(position.quantity,4);assert.equal(position.totalCost,38500);
  const small={...config,capitalUsd:1.9,perVenueUsd:100};
  assert.equal(tick(pair,book('kalshi'),book('poly'),meta(),small,state(),at,1000)!.quantity,2);
  assert.equal(tick(pair,book('kalshi'),book('poly'),meta(),{...config,perVenueUsd:0.6},state(),at,1000)!.quantity,1);
});
test('fees veto a gross-positive spread and exactly $1 never enters',()=>{
  const k=book('kalshi');k.yes=[{price:4900,quantity:4}];
  assert.equal(tick(pair,k,book('poly'),meta(),config,state(),at,1000),null);
  k.yes=[{price:5000,quantity:4}];const m=meta();m.fees.kalshi.rate=0;m.fees.poly.rate=0;
  assert.equal(tick(pair,k,book('poly'),m,config,state(),at,1000),null);
});
test('stale, skewed, closed, invalid, changed-rule and expired-metadata gates block',()=>{
  for(const patch of [{receivedAt:at-3000},{exchangeAt:at-3000},{receivedMono:-2000},{valid:false},{open:false},{source:'rest' as const}]){
    assert.equal(tick(pair,{...book('kalshi'),...patch},book('poly'),meta(),config,state(),at,1000),null);
  }
  assert.equal(tick(pair,book('kalshi'),{...book('poly'),receivedAt:at-1500},meta(),config,state(),at,1000),null);
  for(const patch of [{approved:false},{open:false},{at:at-120001}])
    assert.equal(tick(pair,book('kalshi'),book('poly'),{...meta(),...patch},config,state(),at,1000),null);
});
test('early exit needs both full bid depths and profit after exit fees; cash reconciles',()=>{
  const s=state(),k=book('kalshi'),p=book('poly');tick(pair,k,p,meta(),config,s,at,1000);
  assert.equal(tick(pair,k,p,meta(),config,s,at,1000),null);
  k.yesBids=[{price:5500,quantity:4}];p.noBids=[{price:5000,quantity:3}];
  assert.equal(tick(pair,k,p,meta(),config,s,at,1000),null);
  p.noBids[0].quantity=4;
  const exited=tick(pair,k,p,meta(),config,s,at,1000)!;
  assert.equal(exited.status,'early-exit');assert.equal(exited.pnl,3000);
  const b=balances(s,config);assert.equal(b.capitalLocked,0);assert.equal(b.cumulativePaperPnl,3000);
  assert.equal(b.cash.kalshi+b.cash.poly,200*10000+3000);
  assert.equal(tick(pair,k,p,meta(),config,s,at+30001,31001),null); // cannot recycle stale depth
});
test('settlement waits for both published payouts, credits the right venue, retains basis divergence',()=>{
  const s=state(),position=tick(pair,book('kalshi'),book('poly'),meta(),config,s,at,1000)!,m=meta();
  m.yesPayout.kalshi=10000;assert.equal(settle(position,m,at),false);
  m.yesPayout.poly=10000;assert.equal(settle(position,m,at),true);
  assert.equal(position.proceeds,40000);assert.equal(position.pnl,2500);assert.equal(balances(s,config).modeledSettlementPnl,2500);
  const t=state(),divergent=tick(pair,book('kalshi'),book('poly'),meta(),config,t,at,1000)!;
  m.yesPayout.kalshi=0;settle(divergent,m,at);assert.equal(divergent.proceeds,0);assert.equal(divergent.pnl,-37500);
});
test('native metadata checks identity, hashes, deadlines, event fee overrides and payout finality',()=>{
  const k={ticker:pair.kalshi,event_ticker:'KXNCAAFWINS-26NEB',status:'active',rules_primary:'test rule',close_time:pair.kalshiCloseAt};
  const series={ticker:'KXNCAAFWINS',fee_type:'quadratic',fee_multiplier:1};const event={event_ticker:k.event_ticker,fee_multiplier_override:2};
  const p={slug:pair.poly,description:'test PM rule',minimumTradeQty:1,feeCoefficient:0.0695,active:true,closed:false,
    ep3Status:'OPEN',status:'MARKET_STATUS_OPEN',endDate:pair.polyCloseAt,marketSides:[{long:true,tradable:true},{long:false,tradable:true}]};
  const r=rules(k,series,p),review={...pair,kalshiRulesHash:sha(r.kalshi),polyRulesHash:sha(r.poly)};
  const m=metadata(review,k,series,event,p,null,at);assert.equal(m.approved,true);assert.equal(m.open,true);assert.equal(m.fees.kalshi.rate,1400);
  assert.equal(metadata(review,{...k,rules_primary:'changed'},series,event,p,null,at).approved,false);
  assert.equal(metadata(review,{...k,status:'finalized',settlement_value_dollars:null},series,event,p,null,at).yesPayout.kalshi,null);
  assert.equal(metadata(review,{...k,status:'determined',settlement_value_dollars:'1.0000'},series,event,p,null,at).yesPayout.kalshi,null);
  assert.throws(()=>metadata(review,k,series,event,{...p,feeCoefficient:null},null,at));
});
test('retained native WS messages normalize; sequence gaps invalidate the venue',()=>{
  const rows=JSON.parse(readFileSync('tests/fixtures/research/authenticated-books-2026-09-10.json','utf8'));
  const cache=new BookCache(),k=rows.find((r:any)=>r.venue==='kalshi'),p=rows.find((r:any)=>r.venue==='poly');
  const kb=cache.kalshi(k.message,k.at,k.mono)!;assert.ok(kb.valid);assert.ok(kb.yes.length);
  const pb=cache.poly(p.message,p.at,p.mono)!;assert.ok(pb.valid);assert.ok(pb.no.length);
  assert.throws(()=>cache.kalshi({...k.message,seq:k.message.seq+2},k.at,k.mono));
  assert.equal(cache.get('kalshi',kb.marketId)!.valid,false);
});
test('JSON/CSV persist and resume, concurrent ownership and changed settings fail closed',()=>{
  const directory=mkdtempSync(join(tmpdir(),'simple-paper-')),hash=sha(JSON.stringify(config));
  try{
    const store=openStore(directory,hash);tick(pair,book('kalshi'),book('poly'),meta(),config,store.state,at,1000);store.save();
    assert.throws(()=>openStore(directory,hash));store.release();
    const resumed=openStore(directory,hash);assert.equal(resumed.state.positions.length,1);resumed.release();
    assert.match(readFileSync(join(directory,'positions.csv'),'utf8'),/conditional_locked_profit_usd/);
    assert.throws(()=>openStore(directory,'changed'));
    const bad=JSON.parse(readFileSync(join(directory,'state.json'),'utf8'));bad.positions[0].totalCost=1;
    writeFileSync(join(directory,'state.json'),JSON.stringify(bad));assert.throws(()=>openStore(directory,hash));
  }finally{rmSync(directory,{recursive:true,force:true});}
});
