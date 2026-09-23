import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {VenueRebuildBudget,feedDiagnostic,stopClassification,assessLaneEvidence,executionLanePolicy} from '../lib/arb/production-operations.ts';
import {MultiPaper,reviewedRows} from '../lib/arb/multi-paper.ts';
import {workingScenario,sessionPolicy} from '../lib/arb/production-paper.ts';
import {observeBook,quoteCandidate} from '../lib/screen/confirmation.ts';
import {accountLeg,modelLeg,assumedStatus} from '../lib/arb/ksu-paper.ts';
import {MarketStatusTracker} from '../lib/screen/market-status.ts';
import {FrameQueue} from '../worker/frame-queue.ts';
import type {SnapshotReceipt,SnapshotRequest} from '../lib/screen/book-confirmation.ts';
import type {Pair,Venue} from '../lib/arb/types.ts';

const healthy={connected:true,backlog:0,clockOkay:true},closed={...healthy,connected:false},transport={connected:false,heartbeatAgeMs:100};
const target=(venue:Venue,lane:'discovery'|'strategy'='discovery')=>({venue,lane});
test('three physical rebuilds per venue; dual-venue rebuild consumes one from each independent allowance',()=>{
  const budget=new VenueRebuildBudget(sessionPolicy.maxReconnects,7200000);
  assert(budget.reserve([target('poly')],1).accepted);assert(budget.reserve([target('poly')],2).accepted);
  assert(budget.reserve([target('poly'),target('kalshi')],3).accepted);assert.deepEqual(budget.used,{kalshi:1,poly:3});
  assert(budget.reserve([target('kalshi')],4).accepted);assert(budget.reserve([target('kalshi')],5).accepted);
  for(const venue of ['kalshi','poly'] as const)assert.equal(budget.reserve([target(venue)],6).accepted,false);
  assert.deepEqual(budget.used,{kalshi:3,poly:3});
});
test('discovery and strategy share venue budget; failed attempts remain spent and refused batches are atomic',()=>{
  const budget=new VenueRebuildBudget(3,100);
  assert(budget.reserve([target('kalshi'),target('kalshi','strategy')],1).accepted);
  // Reservation is consumed before dialing; a failed dial cannot refund it.
  assert(budget.reserve([target('kalshi','strategy')],2).accepted);
  assert(!budget.reserve([target('kalshi'),target('poly')],3).accepted);assert.deepEqual(budget.used,{kalshi:3,poly:0});
  assert(!budget.reserve([target('poly')],100).accepted);assert(!budget.reserve([target('poly')],4,true).accepted);
  assert(!budget.reserve([target('poly'),target('poly')],4).accepted);assert.deepEqual(budget.used,{kalshi:3,poly:0});
});
test('diagnostics distinguish transport, heartbeat, ingress, parser/sequence, clock and supervisor/deadline evidence',()=>{
  const diagnose=(failures:string[],h=closed,t=transport)=>feedDiagnostic(target('kalshi'),h,failures,t);
  assert.deepEqual(diagnose(['DISCONNECTED']).categories,['TRANSPORT_DISCONNECT']);assert(diagnose(['DISCONNECTED']).transportRebuildable);
  assert.deepEqual(diagnose(['HEARTBEAT_TIMEOUT']).categories,['HEARTBEAT_TIMEOUT']);assert(diagnose(['HEARTBEAT_TIMEOUT']).transportRebuildable);
  const heartbeat=diagnose([],closed,{connected:true,heartbeatAgeMs:15001});assert(heartbeat.categories.includes('HEARTBEAT_TIMEOUT'));assert(!heartbeat.categories.includes('TRANSPORT_DISCONNECT'));
  assert.deepEqual(diagnose([]).categories,['HEALTH_CHECK_FAILED_CAUSE_UNESTABLISHED']);assert(!diagnose([]).transportRebuildable);
  assert(diagnose([],{...healthy,backlog:1}).categories.includes('INGRESS_HEALTH'));
  for(const failure of ['PARSER_RECOVERY','SEQUENCE_RECOVERY','INGRESS_OVERFLOW','AUTH_CONFIGURATION','SAME_VERSION_CONFLICTING_BOOKS','TRANSPORT_ARRIVAL_STALE'])assert(!diagnose(['DISCONNECTED',failure]).transportRebuildable,failure);
  assert(diagnose(['DISCONNECTED'],{...closed,clockOkay:false}).categories.includes('CLOCK_FAILURE'));
  assert.equal(stopClassification('EXTERNAL_OR_SUPERVISOR_STOP'),'SUPERVISOR_STOP');assert.equal(stopClassification('ORIGINAL_DEADLINE'),'DEADLINE_STOP');
});

const read=(p:string)=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const review=read('../docs/research/contract-shortlist/review.json'),markets=read('../docs/research/contract-shortlist/retained-markets.json');
const row=reviewedRows(review).authorized.find(r=>r.kalshiId==='KXMLBAL-26-CWS')!;
const pair:Pair={id:row.pairId,a:markets.kalshi.find((m:any)=>m.id===row.kalshiId),b:markets.poly.find((m:any)=>m.id===row.polyId),inverted:false,reviewed:false};
const wall=Date.parse('2026-09-22T17:00:00Z'),mono=100,status={knownBlocked:false,reportedStatus:'active',reasons:[]},constraints={kalshi:{tick:100,minimum:1},poly:{tick:10,minimum:1}};
// Synthetic books solely reproduce the ingress hazard. No historic outcome is
// recomputed or claimed to fill from these fixture prices.
function receipt(venue:Venue):SnapshotReceipt{
  const price=venue==='kalshi'?9100:780,side=row.sides[venue],book={venue,marketId:venue==='kalshi'?row.kalshiId:row.polyId,yes:[],no:[],[side]:[{price,quantity:1}],yesBids:[{price:100,quantity:1}],noBids:[{price:100,quantity:1}],receivedAt:wall,receivedMono:mono,exchangeAt:venue==='kalshi'?null:wall,sequence:venue==='kalshi'?2:null,connection:'LIVE' as const,valid:true,open:true,source:'fixture' as const};
  return {e:observeBook(book,undefined,venue==='kalshi'?'orderbook_snapshot':'marketData',wall,mono),messageType:venue==='kalshi'?'orderbook_snapshot':'marketData',sid:venue==='kalshi'?5:undefined,requestId:venue==='poly'?'requested':undefined,transactTime:venue==='poly'?new Date(wall).toISOString():undefined};
}
function proof(venue:Venue){const response=receipt(venue),request:SnapshotRequest={venue,marketId:response.e.book.marketId,at:wall-10,mono:mono-10,kind:venue==='kalshi'?'get_snapshot':'new_subscription',requestId:'requested',sid:venue==='kalshi'?5:undefined,beforeSequence:venue==='kalshi'?1:undefined};return {request,response};}
async function attempt(primaryBacklog:number,discoveryBacklog:number){
  const portfolio=new MultiPaper(review,workingScenario),k=proof('kalshi'),p=proof('poly'),quote=quoteCandidate(pair,k.response.e.book,p.response.e.book,row.sides.kalshi,wall,1);
  const admissions=await portfolio.execute(row,pair,quote,async()=>({quote,status,constraints,reasons:[]}),async session=>{
    for(const venue of ['kalshi','poly'] as const){
      const pr=venue==='kalshi'?k:p;
      const ev=assessLaneEvidence('strategy',pr,pr.response,{...healthy,backlog:venue==='kalshi'?primaryBacklog:0},wall+500,mono+500,{receipt:pr.response,health:{...healthy,backlog:discoveryBacklog}});
      if(discoveryBacklog)assert(ev.corroboration?.reasons.includes('INGRESS_BACKLOG'));
      const modeled=modelLeg(session.plan![venue],venue==='kalshi'?pair.a:pair.b,ev.selected.e.book,ev.reasons,false,wall+500,mono+500);accountLeg(session,pair,venue,modeled);
    }
  },()=>wall,()=>mono,()=>true);
  assert(admissions.attempted);return portfolio;
}
test('bulk discovery ingress queue cannot contaminate healthy dedicated 500 ms strategy arrival',async()=>{
  const broad=new FrameQueue<number>(()=>{},assert.fail),dedicated=new FrameQueue<number>(()=>{},assert.fail);
  try{
    for(let i=0;i<100;i++)broad.push(i,20);assert.equal(broad.depth,100);assert.equal(dedicated.depth,0);
    const portfolio=await attempt(dedicated.depth,broad.depth);
    assert.deepEqual(Object.values(portfolio.entries[0].session.results).map(r=>r!.outcome),['FILLED','FILLED']);assert.equal(portfolio.halt,null);
  }finally{broad.close();dedicated.close();}
});
test('dedicated backlog remains INCONCLUSIVE and holds unknown exposure through later successful transport rebuilds',async()=>{
  const dedicated=new FrameQueue<number>(()=>{},assert.fail);
  try{
    dedicated.push(1,20);const portfolio=await attempt(dedicated.depth,0),session=portfolio.entries[0].session;
    assert.equal(session.results.kalshi?.outcome,'INCONCLUSIVE');assert(session.results.kalshi?.reasons.includes('INGRESS_BACKLOG'));
    assert.equal(session.results.poly?.outcome,'FILLED');assert.equal(portfolio.halt,'UNRESOLVED_EXECUTION_EXPOSURE');assert.equal(session.held.kalshi,session.plan!.kalshi.reserved);
    const before=JSON.stringify({summary:portfolio.summary(),entries:portfolio.entries}),budget=new VenueRebuildBudget(3,10000);
    assert(budget.reserve([target('kalshi','strategy')],1000).accepted);assert.equal(JSON.stringify({summary:portfolio.summary(),entries:portfolio.entries}),before);
  }finally{dedicated.close();}
});
test('execution exact market must be present, request-bound, synchronized and healthy; no discovery fallback',()=>{
  const p=proof('poly');
  const persistent=structuredClone(p.response);assert.equal(assessLaneEvidence('strategy',p,persistent,healthy,wall,mono).selected,persistent);
  for(const latest of [undefined,{...p.response,transactTime:new Date(wall-1).toISOString()}])assert(assessLaneEvidence('strategy',p,latest,healthy,wall,mono).reasons.includes('EXECUTION_MARKET_NOT_SYNCHRONIZED'));
  for(const venue of ['kalshi','poly'] as const){const pr=proof(venue),wrong=structuredClone(pr.response);wrong.e.book.marketId='other';assert(!assessLaneEvidence('strategy',pr,wrong,healthy,wall,mono).accepted);assert(!assessLaneEvidence('strategy',pr,pr.response,closed,wall,mono).accepted);}
  const unbound={...p,response:{...p.response,requestId:'different'}};assert(!assessLaneEvidence('strategy',unbound,p.response,healthy,wall,mono).accepted);
  const future={...p,response:{...p.response,e:{...p.response.e,processedMono:mono+1}}};assert(!assessLaneEvidence('strategy',future,p.response,healthy,wall,mono).accepted);
  const k=proof('kalshi');assert(!assessLaneEvidence('discovery',k,k.response,{...healthy,backlog:1},wall,mono).accepted);
  assert.equal(executionLanePolicy.maxMarkets,5);assert.equal(executionLanePolicy.maxPersistentFeeds,4);assert.equal(sessionPolicy.transportMs,500);
});
test('separate exact-market lifecycle state isolates discovery transport faults and retains actual negative events',()=>{
  const broad=new MarketStatusTracker([row.kalshiId,'other']),dedicated=new MarketStatusTracker([row.kalshiId]);
  for(const tracker of [broad,dedicated]){
    tracker.receive({type:'subscribed',id:9000,msg:{channel:'market_lifecycle_v2',sid:9}},wall-20,mono-20);tracker.beginBaseline(row.kalshiId);
    tracker.applyBaseline(row.kalshiId,{ticker:row.kalshiId,status:'active',open_time:new Date(wall-86400000).toISOString(),close_time:new Date(wall+86400000).toISOString()},{url:'https://example.invalid/public-fixture',requestAt:wall-10,requestMono:mono-10,responseAt:wall,responseMono:mono,processedAt:wall,processedMono:mono,status:200,headers:{},bodySha256:'synthetic'});
  }
  broad.invalidate('DISCONNECTED');assert(!assumedStatus(broad.view(row.kalshiId,wall,false)).admitted);assert(assumedStatus(dedicated.view(row.kalshiId,wall,true)).admitted);
  dedicated.receive({type:'market_lifecycle_v2',sid:9,seq:1,msg:{market_ticker:row.kalshiId,event_type:'deactivated'}},wall+1,mono+1);
  assert(assumedStatus(dedicated.view(row.kalshiId,wall+1,true)).reasons.includes('KNOWN_NONTRADING_STATE'));
});
test('historical PR12 White Sox outcome and Julia/Oregon accounting remain byte-for-byte unchanged',()=>{
  const data=readFileSync(new URL('../docs/research/production-paper-results-20260922.json',import.meta.url));
  assert.equal(createHash('sha256').update(data).digest('hex'),'b084722448647f3ba3d33b520f09163f937170296b89c8713d517d3cdda1c6aa');
  const report=JSON.parse(data.toString());assert.equal(report.strategyEntryStop,'UNRESOLVED_EXECUTION_EXPOSURE');
  const holding=report.strategy.holdings.find((h:any)=>h.pairId===row.pairId);assert(holding.unresolvedPossibleInventory);assert.deepEqual(holding.reserved,{kalshi:9400,poly:600});assert.deepEqual(report.strategy.cash,{kalshi:468900,poly:340120});
});
