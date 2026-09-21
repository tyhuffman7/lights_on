import {test} from 'node:test';
import assert from 'node:assert/strict';
import {screenPair,selectRoutes} from '../lib/screen/executable.ts';
import {normalizeBook} from '../lib/arb/adapters.ts';
import type {Pair,Book} from '../lib/arb/types.ts';
import type {Candidate} from '../lib/research/matching.ts';
const now=Date.parse('2026-09-21T18:00:00Z');
const pair:Pair={id:'K::P',reviewed:false,inverted:false,a:{id:'K',venue:'kalshi',title:'fixture',outcome:'Yes',opposite:'No',category:'Economics',rules:'unknown',url:'',closeAt:'2026-09-23T18:00:00Z',open:true,feeRate:700,feeRounding:'ceil',minQty:1,hash:'k',settlement:null},b:{id:'P',venue:'poly',title:'fixture',outcome:'Yes',opposite:'No',category:'Economics',rules:'unknown',url:'',closeAt:'2026-09-23T18:00:00Z',open:true,feeRate:695,feeRounding:'even',minQty:1,hash:'p',settlement:null}};
const book:Book={yes:[{price:4100,quantity:100}],no:[{price:6100,quantity:100}],yesBids:[{price:3900,quantity:100}],noBids:[{price:5900,quantity:100}],receivedAt:now,exchangeAt:now,open:true};
const candidate=(p:Pair):Candidate=>({pair:p,status:'UNVERIFIED',score:0,reasons:[],structured:{a:{},b:{}}});
test('shared PM subscriptions deduplicate without dropping distinct Kalshi routes, including non-sports',()=>{
 const p2={...pair,id:'K2::P',a:{...pair.a,id:'K2'},inverted:true};
 const s=selectRoutes([candidate(pair),candidate(p2),candidate(pair)],now);
 assert.equal(s.selected.length,2);assert.deepEqual(s.subscriptions,{kalshi:['K','K2'],poly:['P']});
 const capped=selectRoutes([candidate(pair),candidate(p2)],now,1);assert.equal(capped.selected.length,0);assert.equal(capped.omitted.length,2);
});
test('all four routes preserve direction, timestamp reasons, and hypothetical status',()=>{
 for(const inverted of [false,true]){
  const rows=screenPair({...pair,inverted},book,book,now);
  assert.equal(rows.length,4);
  for(const r of rows){assert.equal(r.bSide,inverted?r.aSide:r.aSide==='yes'?'no':'yes');assert.equal(r.qualifies,false);assert.equal(r.classification,'UNVERIFIED_PRICE_COMPARISON');assert(r.policyReasons.includes('SETTLEMENT_RULES_NEED_REVIEW'));if(r.route==='MAKER_TAKER_HYPOTHETICAL'){assert.equal(r.displayedDepthExecutable,false);assert(r.qualificationReasons.includes('RESTING_BID_IS_NOT_AVAILABLE_FILL'));}}
 }
 const stale=screenPair(pair,{...book,receivedAt:now-3000},book,now)[0];assert(stale.dataReasons.includes('KALSHI_RECEIPT_STALE'));assert.equal(stale.displayedDepthExecutable,false);
 const missing=screenPair(pair,undefined,book,now)[0];assert(missing.dataReasons.includes('KALSHI_BOOK_MISSING'));assert.equal(missing.economics,null);
});
test('risk allowance is expense; recovery cash is a separate reservation',()=>{
 const e=screenPair({...pair,inverted:true},book,book,now)[0].economics!;
 assert(e);assert.equal(e.exchangeNetUnderFeeBound,e.payout-e.cost-e.feeBound);
 assert.equal(e.afterRisk,e.exchangeNetUnderFeeBound-e.riskAllowance);
 assert.equal(e.reservedCash,e.cost+e.feeBound+e.riskAllowance+e.recoveryReservation.kalshi+e.recoveryReservation.poly);
 assert(e.reservedCash<=100000);assert.equal(e.recoveryIsExpense,false);
});
test('real opposing bids produce complementary asks and use available whole depth',()=>{
 const k=normalizeBook('kalshi',{orderbook_fp:{yes_dollars:[['0.42','3']],no_dollars:[['0.61','2']]}},now);
 assert.deepEqual(k.yes,[{price:3900,quantity:2}]);assert.deepEqual(k.no,[{price:5800,quantity:3}]);
 const rows=screenPair(pair,{...k,exchangeAt:now},book,now);assert.equal(rows[0].economics!.quantity,2);assert.equal(rows[2].economics!.quantity,3);
});
test('unknown fees, out-of-horizon and same-day exclusions stay visible',()=>{
 const r=screenPair({...pair,a:{...pair.a,feeRate:null,closeAt:'2027-09-21'}},book,book,now)[0];
 assert.equal(r.economics,null);assert(r.policyReasons.includes('UNKNOWN_FEE_SCHEDULE'));assert.equal(r.labels.horizon,'OUTSIDE_BASELINE_HORIZON');assert.equal(r.labels.sameDay,'EVENT_DAY_UNKNOWN');
});
