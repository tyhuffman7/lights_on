// Offline, bounded audit of captured PAPER data. No network or ledger writes.
import {readFileSync,writeFileSync,createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

export async function sourceModules(root){
 const get=p=>import(pathToFileURL(resolve(root,p)).href);
 return Object.assign({},...await Promise.all(['lib/arb/maker-evidence.ts','lib/arb/clock-window.ts','lib/arb/maker-activity.ts','lib/arb/maker-ledger.ts','lib/arb/maker-allocation.ts','lib/arb/fractional.ts','lib/arb/maker-fees.ts','lib/arb/maker-size-admission.ts','lib/research/books.ts'].map(get)));
}
async function* rows(path){for await(const line of createInterface({input:createReadStream(path),crlfDelay:Infinity}))if(line)yield JSON.parse(line);}
const bump=(obj,key,n=1)=>{obj[key]=(obj[key]??0)+n;};
const sum=(xs,fn=x=>x)=>xs.reduce((a,x)=>a+fn(x),0);
export class Heap{
 items=[];
 push(x){const a=this.items;let i=a.push(x)-1;while(i){const p=(i-1)>>1;if(a[p].at<=x.at)break;a[i]=a[p];i=p;}a[i]=x;}
 peek(){return this.items[0];}
 pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].at<a[j].at)j++;if(a[j].at>=last.at)break;a[i]=a[j];i=j;}a[i]=last;}return first;}
}

export function auditOrders(control,src){
 const es=control.events,trades=es.filter(e=>e.kind==='PAPER_PUBLIC_TRADE');
 return es.filter(e=>e.kind==='PAPER_MAKER_ORDER').map(event=>{
  const o=event.body.order,related=es.filter(e=>e.body.id===o.id),activation=related.find(e=>e.kind==='PAPER_MAKER_ACTIVATION'),cancel=related.find(e=>e.kind==='PAPER_MAKER_CANCEL_REQUEST'),close=related.find(e=>e.kind==='PAPER_MAKER_CLOSE'),rejection=related.find(e=>e.kind==='PAPER_MAKER_ACTIVATION_REJECTED');
  const end=Math.min(o.expiresAt,cancel?.body.effectiveAt??Infinity),active=activation?.body.activeAt??null;
  const queue=active===null?null:new src.MakerQueue(o.pair.a.id,o.quote.aSide,o.price,o.quote.quantity,activation.body.queueAhead,active,end,o.clock);
  const stats={processedWindowSameMarketPrints:0,receiptWindowSameMarketVolume:0,receiptWindowSameSideVolume:0,receiptWindowPriceQualifiedVolume:0,fullyTimeQualifiedVolume:0,modeledFill:0};const rejected={},evidence=[];
  for(const e of trades){
   const t=src.kalshiSellPrint(e.body.message);if(!t||t.marketId!==o.pair.a.id||!queue||e.id<=activation.id||e.id>=close.id)continue;
   stats.processedWindowSameMarketPrints++;
   const wall=e.body.wall,mono=e.body.mono,bounds=src.localTradeBounds(t.at,o.clock,wall,mono),inside=wall>=active&&wall<end;
   if(inside){stats.receiptWindowSameMarketVolume+=t.quantity;if(t.side===o.quote.aSide){stats.receiptWindowSameSideVolume+=t.quantity;if(t.price<=o.price)stats.receiptWindowPriceQualifiedVolume+=t.quantity;}}
   const reasons=[];
   if(t.side!==o.quote.aSide)reasons.push('OTHER_SIDE');
   if(!bounds)reasons.push('CLOCK_UNUSABLE');
   else{if(bounds[0]<active)reasons.push('EXCHANGE_BOUNDS_BEFORE_ACTIVATION');if(bounds[1]>=end)reasons.push('EXCHANGE_BOUNDS_AT_OR_AFTER_EXPIRY');if(bounds[0]>wall)reasons.push('EXCHANGE_BOUNDS_AFTER_RECEIPT');if(wall-bounds[0]>2000)reasons.push('TRADE_TOO_OLD');}
   if(wall>=end)reasons.push('RECEIPT_AT_OR_AFTER_EXPIRY');
   if(t.price>o.price)reasons.push('PRICE_ABOVE_BID');if(queue.seen.has(t.id))reasons.push('DUPLICATE');
   const before=queue.seen.size,fill=queue.consume(t,wall,mono);stats.modeledFill+=fill;
   if(queue.seen.size>before)stats.fullyTimeQualifiedVolume+=t.quantity;
   for(const reason of reasons)bump(rejected,reason);
   evidence.push({diagnosticId:e.id,tradeId:t.id,receiptAt:wall,exchangeAt:t.at,localBounds:bounds,side:t.side,price:t.price,quantity:t.quantity,reasons,queueAfter:queue.ahead,modeledFill:fill});
  }
  return {orderId:o.id,placementDiagnostic:event.id,activationDiagnostic:activation?.id??null,closeDiagnostic:close?.id??null,pairId:o.pair.id,market:o.pair.a.title,side:o.quote.aSide,quantity:o.quote.quantity,price:o.price,placedAt:o.placedAt,activeAt:active,effectiveEnd:end,closedAt:close?.at??null,activeDurationMs:active===null?0:Math.max(0,end-active),placementQueue:o.initialQueueAhead,activationQueue:activation?.body.queueAhead??null,finalQueue:queue?.ahead??null,cancellation:cancel?{at:cancel.body.at,effectiveAt:cancel.body.effectiveAt,reason:cancel.body.reason}:null,rejection:rejection?.body??null,disposition:rejection?'ACTIVATION_REJECTED':cancel?'CANCELLED_UNFILLED':'EXPIRED_UNFILLED',stats,rejectedOverlaps:rejected,trades:evidence,scope:'CAPTURED_TAPE_REPLAY_USING_EXECUTED_QUEUE; NOT NEW FILLS'};
 });
}

export async function selectionCounts(path){
 const out={events:0,processedSlots:0,zeroProcessed:0,emptyEligible:0,eligiblePlans:0,activeEligiblePlans:0,inactiveEligiblePlans:0,selectedEvents:0,consecutiveIdenticalSummaries:0,globalNonemptyRuns:0,processedHistogram:{}};let last=null,inRun=false;
 for await(const e of rows(path)){const b=e.body;out.events++;out.processedSlots+=b.processed;out.zeroProcessed+=Number(!b.processed);out.emptyEligible+=Number(!b.eligible);out.eligiblePlans+=b.eligible;out.activeEligiblePlans+=b.activeEligible;out.inactiveEligiblePlans+=b.inactiveEligible;out.selectedEvents+=Number(!!b.selectedPair);bump(out.processedHistogram,b.processed);
  const sig=JSON.stringify(b);out.consecutiveIdenticalSummaries+=Number(sig===last);last=sig;
  if(b.eligible&&!inRun)out.globalNonemptyRuns++;inRun=!!b.eligible;
 }
 out.scope='Exact logged totals; processed includes early-skipped queue slots; eligible is a retained side/price plan, not every enumerated size. Summary runs are NOT distinct per-pair opportunities.';
 return out;
}

// Evaluate the lowest-price retained candidate (join bid), not a price search.
// Enumerate the exact integer-size work bound and stop at the first base-cash
// break, as the executed engine does. Only the $0.10 floor is relaxed in noFloor.
export function sizeLadder(pair,a,b,side,settings,cash,makerRate,src){
 const bid=a[side==='yes'?'yesBids':'noBids'][0],ask=a[side][0],other=pair.inverted?side:side==='yes'?'no':'yes';
 if(!bid||!ask||bid.price>=ask.price)return [];
 const limit=Math.min(1000,Math.floor(sum(b[other],x=>x.quantity))),minimum=Math.max(1,Math.ceil(pair.a.minQty),Math.ceil(pair.b.minQty)),out=[];
 for(let quantity=minimum;quantity<=limit;quantity++){
  const hedge=src.fractionalWalk(b[other],quantity,pair.b.feeRate,'even');if(!hedge)break;
  const principal=src.fractionalCost(quantity,bid.price),fee=src.makerFillFee(quantity,bid.price,makerRate),reserve=quantity*settings.reserve;
  const quote={quantity,aFill:{quantity,cost:principal,fees:fee,levels:[{price:bid.price,quantity}]},bFill:hedge,reserve};
  const allocation=src.makerAllocation(quote),cost=principal+hedge.cost+fee+hedge.fees+reserve,profit=quantity*10000-cost;
  const baseA=principal+fee+Math.ceil(reserve/2),baseB=hedge.cost+hedge.fees+Math.floor(reserve/2),baseFits=cost<=settings.maxTrade&&baseA<=cash.kalshi&&baseB<=cash.poly;
  out.push({quantity,price:bid.price,hedgeSide:other,hedgeLevels:hedge.levels,afterFees:profit+reserve,profit,roi:profit/cost*100,cost,baseFits,funded:baseFits&&allocation.kalshi<=cash.kalshi&&allocation.poly<=cash.poly&&allocation.kalshi+allocation.poly<=settings.maxTrade,allocation});
  if(!baseFits)break;
 }
 return out;
}
export function classifyLadder(ladder,settings,volume,sizes,ahead,pair,rate,src){
 const stages=[['AFTER_FEES_NONPOSITIVE',x=>x.afterFees>0],['RESERVE_ERASES_EDGE',x=>x.profit>0],['BASE_CAPITAL',x=>x.baseFits],['RECOVERY_HEADROOM',x=>x.funded],['ROI',x=>x.roi>=settings.minRoi]];
 let survivors=ladder,primary=ladder.length?null:'NO_POST_ONLY_DEPTH';
 for(const [reason,keep] of stages){const next=survivors.filter(keep);if(!primary&&!next.length)primary=reason;survivors=next;}
 const noFloor=survivors,withFloor=noFloor.filter(x=>x.profit>=settings.minProfit);
 const rank=xs=>xs.reduce((best,x)=>{const score=src.makerActivityScore(volume,ahead,x.quantity,x.profit);return !best||score>best.score||score===best.score&&x.profit>best.profit?{...x,score}:best;},null);
 const chosen=rank(withFloor),alternative=rank(noFloor);
 const stress=x=>x?src.observedSizeAdmission({price:x.price,quantity:x.quantity,hedgeLevels:x.hedgeLevels,hedgeStep:pair.b.minQty,makerRate:rate,hedgeRate:pair.b.feeRate,reserve:settings.reserve,sizes}):null;
 const originalStress=stress(chosen),alternativeStress=stress(alternative);
 primary??=!withFloor.length?'MIN_TOTAL_PROFIT':volume<=0?'ACTIVITY':!originalStress?.eligible?'SIZE_STRESS':'ADMISSIBLE';
 const baselineSize=ladder.filter(x=>x.baseFits&&x.profit>0&&x.roi>=settings.minRoi&&x.profit>=settings.minProfit);
 const overlaps={minimumProfit:noFloor.some(x=>x.profit<settings.minProfit),roi:ladder.some(x=>x.funded&&x.profit>0&&x.roi<settings.minRoi),reserve:ladder.some(x=>x.afterFees>0&&x.profit<=0),headroom:ladder.some(x=>x.baseFits&&!x.funded&&x.profit>0),capital:ladder.some(x=>!x.baseFits&&x.profit>0),sizeStress:!!alternative&&volume>0&&!alternativeStress.eligible,activity:!!alternative&&volume<=0};
 return {primary,positiveAfterFees:ladder.some(x=>x.afterFees>0),positiveNet:ladder.some(x=>x.profit>0),fundedPositive:ladder.some(x=>x.funded&&x.profit>0),floorOnly:!chosen&&!!alternative&&volume>0&&alternativeStress.eligible,
  recoveryFloorInteraction:!chosen&&!!alternative&&baselineSize.length>0,
  admitted:!!chosen&&volume>0&&originalStress.eligible,noFloorAdmitted:!!alternative&&volume>0&&alternativeStress.eligible,overlaps,
  chosen,alternative,originalStress,alternativeStress,minimumFloorQuantity:baselineSize.length?Math.min(...baselineSize.map(x=>x.quantity)):null,maximumBaseQuantity:Math.max(0,...ladder.filter(x=>x.baseFits).map(x=>x.quantity)),maximumFundedQuantity:Math.max(0,...ladder.filter(x=>x.funded).map(x=>x.quantity))};
}

function prefix(levels,quantity){let left=quantity;const out=[];for(const l of levels){const n=Math.min(left,l.quantity);if(n>0)out.push({price:l.price,quantity:n});left-=n;if(left<=0)break;}return out;}
export function ladderKey(pair,a,b,side,settings,rate){
 const price=a[side==='yes'?'yesBids':'noBids'][0]?.price??0,other=pair.inverted?side:side==='yes'?'no':'yes';
 const cheapest=price+(b[other][0]?.price??0)+settings.reserve;
 const bound=cheapest>0?Math.min(1000,Math.floor(settings.maxTrade/cheapest)+1):1000;
 return JSON.stringify([price,a[side][0]?.price,rate,prefix(b[other],bound)]);
}

export async function replayCapture(dir,control,src){
 const start=control.session.start,end=control.session.end,settings=control.frozen.settings,cash=control.frozen.capital;
 const pairs=control.mappings.map(m=>({...m.pair,reviewed:true})),keyPairs=new Map();
 for(const p of pairs)for(const v of ['a','b'])keyPairs.set(`${p[v].venue}:${p[v].id}`,p.id);
 const byId=new Map(pairs.map(p=>[p.id,p])),activity=new src.MakerActivity(),books=new Map(),profiles=new Map(),health=new Map(),cache=new Map(),states=new Map(),coverage=new Map(),dirty=new Set();
 const heap=new Heap(),summary={snapshots:0,primarySnapshots:{},primaryMilliseconds:{},overlapMilliseconds:{},positiveAfterFeePrimaryMilliseconds:{},observablePairMilliseconds:{},intervals:[],examples:[],ruleRefreshWindows:[],ladderCalculations:0,ladderCacheHits:0};
 let clock=null,rule=null,busy=null,lastMonoOffset=null;
 for(const e of control.events){if(['PAPER_PUBLIC_TRADE','CONNECTED','DISCONNECTED','PAUSED','TELEMETRY','PAPER_CLOCK_CALIBRATION','PAPER_CLOCK_UNAVAILABLE','PAPER_MAKER_FEE_PROFILES','PAPER_RULE_DOCUMENT_VERIFICATION','PAPER_MAKER_ORDER','PAPER_MAKER_CLOSE'].includes(e.kind))heap.push({at:e.at,type:'control',event:e});
  if(e.kind==='PAPER_RULE_DOCUMENT_VERIFICATION'&&e.body.checkedAt!==undefined){heap.push({at:e.body.checkedAt,type:'ruleStart'});summary.ruleRefreshWindows.push({start:e.body.checkedAt,end:e.at,ok:e.body.ok});}
 }
 const intervalFlags=['positiveAfterFees','fundedPositive','admitted','noFloorAdmitted','floorOnly','recoveryFloorInteraction'];
 function saveState(key,at,next){
  const prior=states.get(key);
  if(prior){const dt=at-prior.at;if(dt>0){bump(summary.primaryMilliseconds,prior.value.primary,dt);for(const [name,yes] of Object.entries(prior.value.overlaps??{}))if(yes)bump(summary.overlapMilliseconds,name,dt);if(prior.value.positiveAfterFees)bump(summary.positiveAfterFeePrimaryMilliseconds,prior.value.primary,dt);}}
  const open=prior?.open??{};
  for(const flag of intervalFlags){const yes=!!next?.[flag];if(open[flag]&&!yes){const i=open[flag];if(at>i.start)summary.intervals.push({...i,end:at,durationMs:at-i.start,endedBy:next?.primary??'CAPTURE_END'});delete open[flag];}if(!open[flag]&&yes)open[flag]={key,flag,start:at};}
  if(next){states.set(key,{at,value:next,open});summary.snapshots++;bump(summary.primarySnapshots,next.primary);}else states.delete(key);
 }
 function markAll(){for(const p of pairs)dirty.add(p.id);}
 function processControl(e,t){const b=e.body;
  switch(e.kind){
   case 'PAPER_PUBLIC_TRADE':{const trade=src.kalshiSellPrint(b.message);if(trade){activity.observe(trade,b.wall);const id=keyPairs.get('kalshi:'+trade.marketId);if(id)dirty.add(id);heap.push({at:b.wall+60000,type:'activityExpiry',pairId:id});}break;}
   case 'CONNECTED':health.set(b.venue,{connected:true,until:t+15000});heap.push({at:t+15000,type:'all'});markAll();break;
   case 'DISCONNECTED':case 'PAUSED':health.set(b.venue,{connected:false,until:t});markAll();break;
   case 'TELEMETRY':for(const h of b.streams??[]){const until=Math.ceil(b.telemetry.at+15000-h.heartbeatAgeMs);health.set(h.venue,{connected:h.connected,until});heap.push({at:until,type:'all'});}markAll();break;
   case 'PAPER_CLOCK_CALIBRATION':clock=b;heap.push({at:b.expiresAt-3000,type:'all'});markAll();break;
   case 'PAPER_CLOCK_UNAVAILABLE':clock=null;markAll();break;
   case 'PAPER_MAKER_FEE_PROFILES':profiles.clear();for(const p of b.profiles){profiles.set(p.series,p);heap.push({at:p.expiresAt-3000,type:'all'});}cache.clear();markAll();break;
   case 'PAPER_RULE_DOCUMENT_VERIFICATION':rule=b.ok?b:null;markAll();break;
   case 'PAPER_MAKER_ORDER':busy=b.order.id;markAll();break;
   case 'PAPER_MAKER_CLOSE':if(b.id===busy)busy=null;markAll();break;
  }
 }
 for(const p of pairs){coverage.set(p.id,{at:start,usable:false});for(const side of ['yes','no'])saveState(p.id+'|'+side,start,{primary:'WORKER_STARTUP'});}
 const it=rows(resolve(dir,'books.ndjson'))[Symbol.asyncIterator]();let bookNext=await it.next();
 while(!bookNext.done||heap.peek()){
  const bookAt=bookNext.done?Infinity:bookNext.value.book.capture.processedAt,at=Math.min(bookAt,heap.peek()?.at??Infinity);
  if(at>=end)break;if(!Number.isFinite(at))break;
  // A one-millisecond boundary makes same-ms cross-table ordering explicitly
  // unresolved, rather than assigning books to particular historical calls.
  while(!bookNext.done&&bookNext.value.book.capture.processedAt===at){const row=bookNext.value,b=row.book,key=b.venue+':'+b.marketId;books.set(key,row);lastMonoOffset=b.capture.processedAt-b.capture.processedMono;dirty.add(keyPairs.get(key));
   const expires=[b.receivedAt+2001,Math.ceil(b.capture.processedAt+b.receivedMono+2000-b.capture.processedMono)+1,...(b.exchangeAt===null?[]:[b.exchangeAt+2001,b.exchangeAt-1000])];
   for(const deadline of expires)if(deadline>at)heap.push({at:deadline,type:'bookExpiry',key,version:b.capture.version});bookNext=await it.next();}
  while(heap.peek()?.at===at){const e=heap.pop();if(e.type==='control')processControl(e.event,at);else if(e.type==='ruleStart'){rule=null;markAll();}else if(e.type==='bookExpiry'){if(books.get(e.key)?.book.capture.version===e.version)dirty.add(keyPairs.get(e.key));}else if(e.type==='activityExpiry'){if(e.pairId)dirty.add(e.pairId);}else markAll();}
  const now=Math.max(start,at+1);if(now>=end)break;
  for(const id of dirty){if(!id)continue;const pair=byId.get(id),ar=books.get('kalshi:'+pair.a.id),br=books.get('poly:'+pair.b.id),a=ar?.book,b=br?.book;
   const mono=now-(lastMonoOffset??now),ha=health.get('kalshi'),hb=health.get('poly'),heartbeat=ha?.connected&&hb?.connected&&now<ha.until&&now<hb.until;
   const bookFresh=src.fresh(a,mono,now,settings.maxAge)&&src.fresh(b,mono,now,settings.maxAge)&&a.open&&b.open;
   const usable=!!bookFresh&&!!heartbeat,prior=coverage.get(id);if(prior?.usable)bump(summary.observablePairMilliseconds,id,now-prior.at);coverage.set(id,{at:now,usable});
   let gate=!a||!b?'BOOK_MISSING':!bookFresh?'FRESHNESS':!heartbeat?'STREAM_HEALTH_UNKNOWN_OR_DOWN':!clock||!src.clockUsable(clock,now,mono)||clock.expiresAt-now<3000?'CLOCK':!rule||now-rule.checkedAt>=300000?'APPROVAL_REFRESH':busy?'MAKER_BUSY':null;
   if(!pair.a.open||!pair.b.open||Date.parse(pair.a.closeAt)<=now||Date.parse(pair.b.closeAt)<=now)gate='MARKET_CLOSED';
   for(const side of ['yes','no']){
    const key=id+'|'+side;if(!a||!b){saveState(key,now,{primary:gate});continue;}
    const profile=profiles.get(pair.a.series),rate=src.usableMakerFee(profile,pair.a.series,pair.a.feeRate,now)?profile.rate:pair.a.feeRate;
    const signature=ladderKey(pair,a,b,side,settings,rate),memoKey=key+'|'+signature;let ladder=cache.get(memoKey);
    if(!ladder){ladder=sizeLadder(pair,a,b,side,settings,cash,rate,src);if(cache.size>=20000)cache.clear();cache.set(memoKey,ladder);summary.ladderCalculations++;}else summary.ladderCacheHits++;
    const price=a[side==='yes'?'yesBids':'noBids'][0]?.price??0,ahead=sum(a[side==='yes'?'yesBids':'noBids'].filter(l=>l.price>=price),l=>l.quantity),volume=activity.volume(pair.a.id,side,price,now),sizes=activity.sizes(pair.a.id,side,price,now);
    const diagnosis=classifyLadder(ladder,settings,volume,sizes,ahead,pair,rate,src);
    if(gate){saveState(key,now,{primary:gate,positiveAfterFees:diagnosis.positiveAfterFees,overlaps:diagnosis.overlaps});continue;}
    saveState(key,now,diagnosis);
    if((diagnosis.floorOnly||diagnosis.recoveryFloorInteraction)&&summary.examples.length<24&&!summary.examples.some(x=>x.key===key&&x.price===price&&x.kind===(diagnosis.floorOnly?'FLOOR_ONLY':'HEADROOM_FLOOR'))){const compact=q=>q?{quantity:q.quantity,profit:q.profit,roi:q.roi,cost:q.cost,allocation:q.allocation}:null;summary.examples.push({kind:diagnosis.floorOnly?'FLOOR_ONLY':'HEADROOM_FLOOR',key,at:now,price,kalshiBookId:ar.id,polyBookId:br.id,kalshiCapture:a.capture,polyCapture:b.capture,volume,sizes,ahead,minimumFloorQuantity:diagnosis.minimumFloorQuantity,maximumBaseQuantity:diagnosis.maximumBaseQuantity,maximumFundedQuantity:diagnosis.maximumFundedQuantity,chosen:compact(diagnosis.chosen),alternative:compact(diagnosis.alternative),alternativeStress:diagnosis.alternativeStress});}
   }
  }
  dirty.clear();
 }
 for(const [key] of states)saveState(key,end,null);for(const [id,c] of coverage)if(c.usable)bump(summary.observablePairMilliseconds,id,end-c.at);
 summary.intervalSummary=Object.fromEntries(intervalFlags.map(flag=>{const xs=summary.intervals.filter(x=>x.flag===flag);return [flag,{count:xs.length,totalMs:sum(xs,x=>x.durationMs),maxMs:xs.reduce((m,x)=>Math.max(m,x.durationMs),0),atLeast500ms:xs.filter(x=>x.durationMs>=500).length}];}));
 summary.scope='Full capture transition audit at join bid per pair/side. Counterfactual admission only, not actual evaluated IDs, submitted orders, fills, or profit. Only noFloor removes the absolute profit floor; positive net/ROI/reserve/headroom/activity/size/data/capital gates remain. Headroom/floor interaction is same-price arithmetic, not a third execution policy.';
 summary.primaryHierarchy=['WORKER_STARTUP','MARKET_CLOSED','BOOK_MISSING','FRESHNESS','STREAM_HEALTH_UNKNOWN_OR_DOWN','CLOCK','APPROVAL_REFRESH','MAKER_BUSY','NO_POST_ONLY_DEPTH','AFTER_FEES_NONPOSITIVE','RESERVE_ERASES_EDGE','BASE_CAPITAL','RECOVERY_HEADROOM','ROI','MIN_TOTAL_PROFIT','ACTIVITY','SIZE_STRESS','ADMISSIBLE'];
 summary.limitations=['Selection logs omit rejected pair/price/size IDs; exact per-gate runtime counts cannot be recovered.','Heartbeat proofs use recorded connections and telemetry; unobserved heartbeats are unknown.','Book processing-start timestamps and millisecond ties do not establish exact decision availability; interval endpoints carry at least 1 ms uncertainty.','Opportunity intervals end at actual maker reservations as well as gate failures; their duration is censored, not a natural quote lifetime.','Join bid is the cheapest retained price: economic rejection there cannot be rescued by a more expensive bid; activity can differ at higher bids.','Metadata refresh initiation is not fully logged; captured rule refresh windows are excluded, other transient invalidations remain unknown.','Overlap columns are non-additive and describe recorded-book arithmetic, including non-executable stale snapshots.'];
 return summary;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [dir,sourceRoot,out]=process.argv.slice(2);if(!dir||!sourceRoot||!out)throw Error('Usage: audit EXTRACTED_DIR EXECUTED_SOURCE OUTPUT_JSON');
 const control=JSON.parse(readFileSync(resolve(dir,'control.json'),'utf8'));
 for(const [name,expected] of Object.entries(control.frozen.files))if(createHash('sha256').update(readFileSync(resolve(sourceRoot,name))).digest('hex')!==expected)throw Error('Executed source mismatch: '+name);
 const src=await sourceModules(sourceRoot);
 const result={session:control.session,identity:{head:control.launch.sourceHead,runtime:control.launch.runtime,sourceStatus:control.launch.sourceStatus,observerSha256:control.observerSha256,paperSha256:control.paperSha256,historicalSha256:control.historicalSha256},orders:auditOrders(control,src),selection:await selectionCounts(resolve(dir,'selections.ndjson')),replay:await replayCapture(dir,control,src)};
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({orders:result.orders.map(o=>({id:o.orderId,duration:o.activeDurationMs,ahead:o.activationQueue,stats:o.stats})),selection:result.selection,intervals:result.replay.intervalSummary,primaryMilliseconds:result.replay.primaryMilliseconds,examples:result.replay.examples.length}));
}
