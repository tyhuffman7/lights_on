import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceModules,sizeLadder,classifyLadder,auditOrders,Heap,ladderKey,replayCapture} from '../scripts/missed-opportunity-audit.mjs';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const src=await sourceModules(new URL('..',import.meta.url).pathname);
function synthetic(){
 const pair={a:{minQty:1,feeRate:0},b:{minQty:1,feeRate:0},inverted:false};
 const a={yesBids:[{price:4000,quantity:10}],noBids:[],yes:[{price:5000,quantity:100}],no:[]};
 const b={yes:[],no:[{price:5700,quantity:100}]};
 const settings={maxTrade:100000,minProfit:1000,minRoi:1,reserve:200};
 return {pair,a,b,settings,cash:{kalshi:500000,poly:500000}};
}
test('Single-floor diagnostic isolates headroom-funded nine contracts below ten-cent floor',()=>{
 const {pair,a,b,settings,cash}=synthetic(),ladder=sizeLadder(pair,a,b,'yes',settings,cash,0,src);
 const r=classifyLadder(ladder,settings,100,[10],10,pair,0,src);
 assert.equal(r.primary,'MIN_TOTAL_PROFIT');assert.equal(r.minimumFloorQuantity,10);assert.equal(r.maximumBaseQuantity,10);assert.equal(r.maximumFundedQuantity,9);
 assert.equal(r.alternative.profit,900);assert.equal(r.alternative.quantity,9);assert.equal(r.floorOnly,true);assert.equal(r.recoveryFloorInteraction,true);assert.equal(r.admitted,false);assert.equal(r.noFloorAdmitted,true);
});
test('Floor relaxation retains ROI, reserve and strictly positive net requirements',()=>{
 const {pair,a,b,settings,cash}=synthetic();b.no[0].price=5780;
 let r=classifyLadder(sizeLadder(pair,a,b,'yes',settings,cash,0,src),settings,100,[10],10,pair,0,src);
 assert.equal(r.primary,'ROI');assert.equal(r.noFloorAdmitted,false);
 b.no[0].price=5800;settings.minRoi=0;
 r=classifyLadder(sizeLadder(pair,a,b,'yes',settings,cash,0,src),settings,100,[10],10,pair,0,src);
 assert.equal(r.primary,'RESERVE_ERASES_EDGE');assert.equal(r.noFloorAdmitted,false);
});
test('Floor relaxation keeps observed-size and activity gates; funding never borrows cash',()=>{
 const {pair,a,b,settings,cash}=synthetic(),ladder=sizeLadder(pair,a,b,'yes',settings,cash,0,src);
 assert.equal(classifyLadder(ladder,settings,100,[0.01],10,pair,0,src).noFloorAdmitted,false);
 assert.equal(classifyLadder(ladder,settings,0,[],10,pair,0,src).noFloorAdmitted,false);
 assert.equal(sizeLadder(pair,a,b,'yes',settings,{...cash,poly:1},0,src).filter(x=>x.funded).length,0);
});
test('Economic memoization retains required actual depth and ignores only unreachable depth',()=>{
 const {pair,a,b,settings}=synthetic(),key=ladderKey(pair,a,b,'yes',settings,0);
 b.no[0].quantity=1000;assert.equal(ladderKey(pair,a,b,'yes',settings,0),key);
 b.no[0].quantity=1;b.no.push({price:5900,quantity:100});assert.notEqual(ladderKey(pair,a,b,'yes',settings,0),key);
});
test('Heap deadlines are chronological, including ties',()=>{const h=new Heap();for(const at of [5,1,8,1,3])h.push({at});assert.deepEqual([h.pop().at,h.pop().at,h.pop().at,h.pop().at,h.pop().at],[1,1,3,5,8]);});
test('Order audit rejects boundary and opposite-side prints and preserves queue ahead',()=>{
 const o={id:'o',pair:{id:'p',a:{id:'K',title:'Synthetic'}},quote:{aSide:'yes',quantity:2},price:4000,placedAt:1000,activeAt:1500,expiresAt:3500,initialQueueAhead:10};
 const trade=(id:number,at:number,qty:number,taker='no')=>({id,at,kind:'PAPER_PUBLIC_TRADE',body:{wall:at,mono:at,message:{type:'trade',msg:{trade_id:String(id),market_ticker:'K',yes_price_dollars:'0.4000',count_fp:String(qty),taker_side:taker,ts_ms:at}}}});
 const events=[{id:1,at:1000,kind:'PAPER_MAKER_ORDER',body:{order:o}},{id:2,at:1500,kind:'PAPER_MAKER_ACTIVATION',body:{id:'o',activeAt:1500,queueAhead:10}},trade(3,1600,4),trade(4,1700,100,'yes'),trade(5,3500,100),{id:6,at:3501,kind:'PAPER_MAKER_CLOSE',body:{id:'o',filledA:0,filledB:0}}];
 const result=auditOrders({events},src)[0];assert.equal(result.activeDurationMs,2000);assert.equal(result.stats.fullyTimeQualifiedVolume,4);assert.equal(result.finalQueue,6);assert.equal(result.stats.modeledFill,0);assert.equal(result.rejectedOverlaps.OTHER_SIDE,1);assert.equal(result.rejectedOverlaps.RECEIPT_AT_OR_AFTER_EXPIRY,1);
});
test('Transition audit accounts for startup and censors intervals at actual reservations',async()=>{
 const {pair:base,a,b,settings,cash}=synthetic(),dir=mkdtempSync(join(tmpdir(),'missed-audit-'));
 const market=(venue:string,id:string)=>({venue,id,open:true,closeAt:new Date(100000).toISOString(),series:'fixture',minQty:1,feeRate:0});
 const pair={...base,id:'p',a:market('kalshi','K'),b:market('poly','P')};
 const book=(venue:string,id:string,data:any,version:number)=>({id:version,book:{yes:[],no:[],yesBids:[],noBids:[],...data,venue,marketId:id,open:true,valid:true,source:'stream',connection:'LIVE',receivedAt:100,receivedMono:100,exchangeAt:100,capture:{sessionId:'s',version,processedAt:100,processedMono:100}}});
 writeFileSync(join(dir,'books.ndjson'),[book('kalshi','K',a,1),book('poly','P',b,2)].map(x=>JSON.stringify(x)).join('\n')+'\n');
 const event=(at:number,kind:string,body:any)=>({at,kind,body});
 const control={session:{start:0,end:1000},frozen:{settings:{...settings,maxAge:2000},capital:cash},mappings:[{pair}],events:[event(0,'CONNECTED',{venue:'kalshi'}),event(0,'CONNECTED',{venue:'poly'}),event(0,'PAPER_CLOCK_CALIBRATION',{minOffsetMs:0,maxOffsetMs:0,measuredAt:0,measuredMono:0,expiresAt:60000,sources:[]}),event(1,'PAPER_RULE_DOCUMENT_VERIFICATION',{ok:true,checkedAt:0}),event(200,'PAPER_PUBLIC_TRADE',{wall:200,mono:200,message:{type:'trade',msg:{trade_id:'t',market_ticker:'K',yes_price_dollars:'0.4000',count_fp:'10',taker_side:'no',ts_ms:200}}}),event(500,'PAPER_MAKER_ORDER',{order:{id:'busy'}}),event(700,'PAPER_MAKER_CLOSE',{id:'busy'})]};
 const result=await replayCapture(dir,control,src);
 assert.equal(Object.values(result.primaryMilliseconds).reduce((n:number,x:any)=>n+x,0),2000);
 assert.equal(result.intervalSummary.admitted.count,0);assert.equal(result.intervalSummary.noFloorAdmitted.totalMs,599);
 assert.equal(result.intervalSummary.noFloorAdmitted.count,2);assert.ok(result.intervals.some(x=>x.flag==='noFloorAdmitted'&&x.endedBy==='MAKER_BUSY'));
});
