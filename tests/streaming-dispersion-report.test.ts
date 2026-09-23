import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

function fixture(phase='STOPPED'){
 const dir=mkdtempSync(join(tmpdir(),'dispersion-report-')),startedAt=100000000,endedAt=startedAt+3600000;
 const metric=(median:number|null)=>({median,max:median,weightedMs:median===null?0:1800000});
 const routes=[['film','Netflix',1800000],['show','Netflix',0],['game','sports',1800000]].map(([id,category,ms])=>({
  pairId:id,category,kalshiId:'K-'+id,polyId:'P-'+id,classification:'CONDITIONAL',validSimultaneousMs:1800000,priceableMs:ms,
  rawGap:metric(ms?100:null),feeNetGap:metric(ms?-100:null),oneContractRawGap:metric(ms?100:null),oneContractFeeNetGap:metric(ms?-100:null),
  quantitySet:ms?[1,2]:[],best:null,bookChanges:2,pricedChanges:ms?1:0,excludedMs:{},
 }));
 const quote={pairId:'game',aSide:'yes',bSide:'no',quantity:2,at:startedAt+10,principal:19500,feeBound:100,feeNetSurplus:400,
  rawGapPerContract:250,feeNetGapPerContract:200,totalReservedCash:21000,consumedDepth:{kalshi:[{price:4000,quantity:2}],poly:[{price:5750,quantity:2}]}};
 const interval={id:1,key:'game|yes',kind:'fee',openedAt:startedAt+10,closedAt:startedAt+1010,observedMs:1000,knownOnset:true,leftCensored:false,rightCensored:false,segments:[{start:startedAt+10,end:startedAt+1010}],quantitySet:[2],best:quote};
 const summary={phase,startedAt,endedAt,deadlineAt:endedAt,reason:'ORIGINAL_DEADLINE',scope:'TEST',policy:{},routes,intervals:[interval],
  confirmations:[{intervalId:1,startedAt:startedAt+20,endedAt:startedAt+100,status:'EDGE_SURVIVED',reasons:[],repriced:quote,bookConfirmed:true}],
  reconnections:{kalshi:0,poly:0},feedEvents:[],clockFault:false,bytes:1,privateAccount:'MUST_NOT_PUBLISH'};
 const selection=routes.map(r=>({pair:{id:r.pairId,inverted:false},contractReview:{indicativeEventAt:new Date(startedAt+86400000).toISOString(),lockupBasis:'Indicative only',administrativeTimes:{}}}));
 for(const [name,x]of Object.entries({'summary.json':summary,'frozen.json':{selection},'started.json':{freezeSha256:'fixture'}}))writeFileSync(join(dir,name),JSON.stringify(x));
 writeFileSync(join(dir,'evidence.ndjson'),[JSON.stringify({kind:'RAW_BOOK',body:{privateAccount:'MUST_NOT_PUBLISH',book:'RAW_MUST_STAY_PRIVATE'}}),JSON.stringify({kind:'DERIVED_CHANGE',body:{usable:true,quotes:[quote]}})].join('\n')+'\n');
 return {dir,output:join(dir,'result.json')};
}
const run=(dir:string,output:string)=>spawnSync(process.execPath,['scripts/streaming-dispersion-report.mjs',dir,output],{encoding:'utf8'});
test('offline report preserves unavailable depth, route-hour denominators and exact confirmed economics without publishing raw records',()=>{
 const {dir,output}=fixture();try{
  const done=run(dir,output);assert.equal(done.status,0,done.stderr);const text=readFileSync(output,'utf8'),r=JSON.parse(text);
  assert.equal(r.routes.find((x:any)=>x.pairId==='show').feePositiveIntervals,null);
  assert.equal(r.routes.find((x:any)=>x.pairId==='film').feePositiveIntervals,0);
  assert.equal(r.comparison.culture.usablePriceableRouteHours,0.5);assert.equal(r.comparison.culture.feePositiveIntervalsPerUsableRouteHour,0);
  assert.equal(r.comparison.sports.feePositiveIntervalsPerUsableRouteHour,2);assert.equal(r.everyDistinctConfirmedPositiveInterval.length,1);
  assert.equal(r.capitalEfficiency[0].quote.quantity,2);assert.equal(r.capitalEfficiency[0].conditionalFeeNetReturnOnPrincipalAndFees,400/19600);
  assert.equal(r.intervals[0].intervalDurationMs,1000);assert.equal(r.intervals[0].dataGapMs,0);
  assert(!text.includes('MUST_NOT_PUBLISH'));assert(!text.includes('RAW_MUST_STAY_PRIVATE'));assert.equal(r.ordersEnabled,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('offline report refuses to turn an ongoing study into a final result',()=>{
 const {dir,output}=fixture('RUNNING');try{const done=run(dir,output);assert.notEqual(done.status,0);assert.match(done.stderr,/Only a completed bounded study/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('segmented reports use durable full-session extrema after raw monitoring has rotated',()=>{
 const {dir,output}=fixture();try{
  const s=JSON.parse(readFileSync(join(dir,'summary.json'),'utf8')),q=s.confirmations[0].repriced;
  s.routes[2].recordedExtrema=q;s.routes[2].largestQuantity=q;
  s.evidenceStorage={critical:{bytes:100},retained:[{bytes:500}],evictedMonitoring:{segments:12},closed:true};
  writeFileSync(join(dir,'summary.json'),JSON.stringify(s));mkdirSync(join(dir,'evidence'));writeFileSync(join(dir,'evidence/manifest.json'),JSON.stringify(s.evidenceStorage));unlinkSync(join(dir,'evidence.ndjson'));
  const done=run(dir,output);assert.equal(done.status,0,done.stderr);const r=JSON.parse(readFileSync(output,'utf8'));
  assert.equal(r.routes[2].maximumFeeNetGapInRecordedContentChanges,200);assert.equal(r.privateEvidenceBytes,600);assert.equal(r.evidenceStorage.evictedMonitoring.segments,12);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
