import {evidenceUnits,moneyMicros,kalshiFill,polyActivityFill,uniqueFillTotals,type ExpectedFill} from './fill-evidence.ts';
const object=(x:unknown):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
// Pure evidence assessment for a buy-only, isolated Kalshi position. No cash
// credit, ownership adoption, or capital release. Caller supplies its owned fill
// ids from the durable journal and COMPLETE primary-account market history.
export function reconcileKalshiSettlement(input:{expected:ExpectedFill;ownedFillIds:string[];accountFills:unknown[];record:unknown;market:unknown}){
 const {expected,record:r,market:m}=input;
 if(expected.action!=='buy'||!['yes','no'].includes(expected.side)||!expected.marketId||!expected.orderId||!Array.isArray(input.ownedFillIds)||!input.ownedFillIds.length||input.ownedFillIds.some(id=>typeof id!=='string'||!id)||new Set(input.ownedFillIds).size!==input.ownedFillIds.length||!Array.isArray(input.accountFills))throw Error('Isolated owned buy evidence required');
 if(!object(r)||!object(m)||r.ticker!==expected.marketId||m.ticker!==expected.marketId||r.exchange_index!==0||m.status!=='finalized'||!['yes','no'].includes(r.market_result)||m.result!==r.market_result)throw Error('Final settlement identity or result unavailable');
 const time=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
 const settledAt=time(r.settled_time),finalAt=time(m.settlement_ts);
 if(!Number.isFinite(settledAt)||!Number.isFinite(finalAt))throw Error('Final settlement timestamps required');
 const yesPayout=moneyMicros(m.settlement_value_dollars);
 if(yesPayout!==(r.market_result==='yes'?1000000:0))throw Error('Unsupported or conflicting settlement value');
 const owned=new Set(input.ownedFillIds),fills=[];
 for(const raw of input.accountFills){
  if(!object(raw)||typeof raw.ticker!=='string')throw Error('Incomplete account fill identity');
  if(raw.ticker!==expected.marketId)continue;
  if(!owned.has(raw.fill_id)||raw.order_id!==expected.orderId)throw Error('Mixed or unknown market ownership');
  fills.push(kalshiFill(raw,expected));
 }
 const totals=uniqueFillTotals(fills);
 const quantityUnits=Number([...new Map(fills.map(f=>[f.fillId,f])).values()].reduce((sum,f)=>sum+BigInt(f.quantityUnits),0n));
 if(!Number.isSafeInteger(quantityUnits))throw Error('Settlement quantity out of range');
 if(new Set(fills.map(f=>f.fillId)).size!==owned.size)throw Error('Owned fill history incomplete');
 const held=expected.side,other=held==='yes'?'no':'yes';
 if(evidenceUnits(r[held+'_count_fp'])!==quantityUnits||evidenceUnits(r[other+'_count_fp'])!==0||moneyMicros(r[other+'_total_cost_dollars'])!==0)throw Error('Settlement inventory does not match isolated fills');
 const entryDebit=-totals.cashFlowMicros,entryNotional=entryDebit-totals.feeMicros;
 if(moneyMicros(r[held+'_total_cost_dollars'])!==entryNotional||moneyMicros(r.fee_cost)!==totals.feeMicros)throw Error('Settlement cost or fees disagree with fills');
 if(!Number.isSafeInteger(r.revenue)||r.revenue<0||!Number.isSafeInteger(r.revenue*10000))throw Error('Invalid settlement revenue');
 const payoutMicros=r.revenue*10000,expectedPayout=held===r.market_result?quantityUnits*100:0;
 if(!Number.isSafeInteger(expectedPayout)||payoutMicros!==expectedPayout)throw Error('Settlement payout disagrees with outcome and inventory');
 return {venue:'kalshi' as const,marketId:expected.marketId,orderId:expected.orderId,settledAt:new Date(settledAt).toISOString(),marketFinalAt:new Date(finalAt).toISOString(),quantityUnits:quantityUnits,payoutMicros,entryDebitMicros:entryDebit,feeMicros:totals.feeMicros,netCashFlowMicros:payoutMicros-entryDebit,accountCashReconciled:false as const,creditAuthorized:false as const};
}

// PM publishes a per-YES settlement value. This assesses EXPECTED payout only:
// the observed resolution does not contain a reliable account cash-credit amount.
export function assessPolySettlement(input:{expected:ExpectedFill;ownedFillIds:string[];accountActivities:unknown[];record:unknown;published:unknown}){
 const {expected,record,published:p}=input;
 if(expected.action!=='buy'||!['yes','no'].includes(expected.side)||!expected.marketId||!expected.orderId||!Array.isArray(input.ownedFillIds)||!input.ownedFillIds.length||input.ownedFillIds.some(id=>typeof id!=='string'||!id)||new Set(input.ownedFillIds).size!==input.ownedFillIds.length||!Array.isArray(input.accountActivities))throw Error('Isolated owned buy evidence required');
 if(!object(record)||record.type!=='ACTIVITY_TYPE_POSITION_RESOLUTION'||!object(record.positionResolution)||!object(p)||p.slug!==expected.marketId||![0,1].includes(p.settlement))throw Error('Binary published settlement required');
 const r=record.positionResolution,b=r.beforePosition,a=r.afterPosition;
 if(r.marketSlug!==expected.marketId||r.side!==(expected.side==='yes'?'POSITION_RESOLUTION_SIDE_LONG':'POSITION_RESOLUTION_SIDE_SHORT')||!object(r.market)||r.market.slug!==expected.marketId||r.market.status!=='MARKET_STATUS_RESOLVED'||r.market.closed!==true||!object(b)||!object(a)||typeof r.updateTime!=='string'||!Number.isFinite(Date.parse(r.updateTime)))throw Error('Resolution identity or finality unavailable');
 const owned=new Set(input.ownedFillIds),fills=[];
 for(const activity of input.accountActivities){
  if(!object(activity)||activity.type!=='ACTIVITY_TYPE_TRADE'||!object(activity.trade)||typeof activity.trade.marketSlug!=='string')throw Error('Incomplete account activity identity');
  if(activity.trade.marketSlug!==expected.marketId)continue;
  const fill=polyActivityFill(activity,expected);
  if(!owned.has(fill.fillId))throw Error('Mixed or unknown market ownership');
  fills.push(fill);
 }
 const totals=uniqueFillTotals(fills),unique=new Map(fills.map(f=>[f.fillId,f]));
 if(unique.size!==owned.size)throw Error('Owned fill history incomplete');
 const quantityUnits=Number([...unique.values()].reduce((n,f)=>n+BigInt(f.quantityUnits),0n));
 if(!Number.isSafeInteger(quantityUnits))throw Error('Settlement quantity out of range');
 const signedUnits=(x:unknown)=>typeof x==='string'&&x.startsWith('-')?-evidenceUnits(x.slice(1)):evidenceUnits(x);
 const usd=(x:unknown)=>{if(!object(x)||x.currency!=='USD')throw Error('Resolution currency unavailable');return moneyMicros(x.value);};
 const signedQuantity=expected.side==='yes'?quantityUnits:-quantityUnits;
 if(signedUnits(b.netPositionDecimal)!==signedQuantity||signedUnits(a.netPositionDecimal)!==0||evidenceUnits(b.qtyBoughtDecimal)!==quantityUnits||evidenceUnits(a.qtyBoughtDecimal)!==quantityUnits||evidenceUnits(b.qtySoldDecimal)!==0||evidenceUnits(a.qtySoldDecimal)!==quantityUnits||usd(a.cashValue)!==0)throw Error('Resolution inventory differs from isolated fills');
 const entryDebitMicros=-totals.cashFlowMicros;
 if(usd(b.cost)!==entryDebitMicros-totals.feeMicros||usd(b.realized)!==0)throw Error('Resolution entry cost or prior realization differs');
 const yesPayoutMicros=p.settlement*1000000,expectedPayoutMicros=quantityUnits*(expected.side==='yes'?p.settlement:1-p.settlement)*100;
 if(!Number.isSafeInteger(expectedPayoutMicros))throw Error('Payout out of range');
 return {venue:'poly' as const,marketId:expected.marketId,orderId:expected.orderId,resolvedAt:new Date(r.updateTime).toISOString(),quantityUnits,yesPayoutMicros,expectedPayoutMicros,entryDebitMicros,feeMicros:totals.feeMicros,expectedNetCashFlowMicros:expectedPayoutMicros-entryDebitMicros,observedCashCreditMicros:null,accountCashReconciled:false as const,creditAuthorized:false as const};
}
