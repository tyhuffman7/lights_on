import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';
test('publication report does not borrow failed confirmation or expose raw bodies; retains known status blocks',()=>{
 const dir=mkdtempSync(join(tmpdir(),'depth-report-')),save=(name:string,x:unknown)=>writeFileSync(join(dir,name),JSON.stringify(x));mkdirSync(join(dir,'batch-01'));
 const capital={kalshi:500000,poly:500000},leg={cost:4000,feeBound:100,levels:[{price:4000,quantity:1}]};
 const q={pairId:'K::P',at:100,aSide:'yes',bSide:'no',quantity:1,positiveExchangeNet:true,pricingReasons:[],quantitySelection:{compared:[{quantity:1,feeBoundSurplus:1800}]},additionalPolicyAdmission:{blockers:[]},
  marketStatus:{kalshi:{classification:'KNOWN_BLOCKED',reasons:['KNOWN_NONTRADING_STATE']},poly:{reportedOpen:true}},
  economics:{kalshi:leg,poly:leg,cost:8000,feeBound:200,feeBoundSurplus:1800,riskAllowance:200,afterRisk:1600,recoveryCash:{kalshi:100,poly:500},reservedCash:9000,venueReservedCash:{kalshi:4300,poly:4700},simulatedCapital:capital},rawBook:{privateField:'RAW_BODY_MUST_NOT_LEAK'}};
 const observation={pairId:'K::P',category:'Economics',kalshiId:'K',polyId:'P',subscriptionRequestedAt:100,bothBooksAt:100,firstUsableAt:100,economicEvaluations:1};
 const batch={index:0,path:'batch-01',startedAt:100,endedAt:200,durationMs:100,routes:1,attempts:1,routeObservation:[observation],failures:[]};
 save('frozen.json',{selection:[{pair:{id:'K::P',a:{id:'K',title:'fixture',category:'Economics'},b:{id:'P'}},contractReview:{referenceCase:false,reason:'NOT_REVIEWED'}}],policy:{simulatedCapital:capital},manifest:{}});
 save('coverage.json',{matched:1,selected:1,omitted:[],catalogComplete:true,catalogErrors:[],listing:{kalshi:1,poly:1},categories:{Economics:{matched:1,selected:1}}});
 save('summary.json',{batches:[batch],startedAt:100,endedAt:200,reason:'COMPLETED_PLANNED_BATCHES'});
 save('batch-01/summary.json',{...batch,marketStatus:{K:{classification:'KNOWN_BLOCKED',reasons:['KNOWN_NONTRADING_STATE'],reportedStatus:'closed'}},bestUsable:[q],confirmations:[{status:'FAILED',edgeSurvived:null,reasons:['INGRESS_BACKLOG'],original:{...q,at:110},repriced:{...q,at:120},bookConfirmation:{accepted:false,http:{body:'RAW_BODY_MUST_NOT_LEAK'}},marketStatus:q.marketStatus}]});
 const json=join(dir,'public.json'),md=join(dir,'public.md'),result=spawnSync(process.execPath,[resolve('scripts/discovery-report.mjs'),dir,json,md],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const text=readFileSync(json,'utf8'),report=JSON.parse(text);assert(!text.includes('RAW_BODY_MUST_NOT_LEAK'));assert.equal(report.coverage.confirmedPositiveNew,0);assert.equal(report.coverage.subscribed,1);assert.equal(report.ranked[0].confirmation,null);assert.equal(report.ranked[0].marketStatus.kalshi.classification,'KNOWN_BLOCKED');assert.equal(report.ranked[0].quote.at,100);assert.equal(report.ranked[0].otherConfirmationAttempts[0].status,'FAILED');
});
