import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classifySettlement,lateStateUsable,routeDimensions,type FamilyProof,type RouteProof} from '../lib/research/family-settlement.ts';
import {proveRoute} from '../lib/research/family-route.ts';
import {catalogEntities} from '../lib/research/entities.ts';
import type {Market,Pair} from '../lib/arb/types.ts';
const route=():RouteProof=>({dimensions:Object.fromEntries(routeDimensions.map(k=>[k,{kalshi:k,poly:k,evidence:'independent primary terms'}])),missingEvidence:[],conflicts:[]});
const family=():FamilyProof=>({id:'reviewed',documents:['K','P','K-RB','P-RB'],missingEvidence:[],ordinaryConflicts:[],divergences:[],stateProofs:[]});
test('all four classes have distinct proof requirements; none enables execution',()=>{
 const f=family(),r=route();assert.equal(classifySettlement(f,r).classification,'LIVE_EXACT');
 f.divergences=[{id:'prestart',evidence:'Different prestart cancellation payouts'}];assert.equal(classifySettlement(f,r).classification,'BOUNDED_BASIS');
 f.stateProofs=[{predicate:'official.firstPointPlayed === true',evidence:'Rules make only prestart branch impossible',eliminates:['prestart'],bothTradableAfter:'PROVEN'}];assert.equal(classifySettlement(f,r).classification,'STATE_CONDITIONED');
 f.ordinaryConflicts=['Different reference month'];assert.equal(classifySettlement(f,r).classification,'INCOMPATIBLE');assert.equal(classifySettlement(f,r).executable,false);
});
test('start/publication cannot remove a surviving review or correction branch',()=>{
 const f=family();f.divergences=[{id:'cancel',evidence:'Before start'},{id:'review',evidence:'Before settlement'}];f.stateProofs=[{predicate:'official.started',evidence:'Start verified',eliminates:['cancel'],bothTradableAfter:'PROVEN'}];assert.equal(classifySettlement(f,route()).classification,'BOUNDED_BASIS');
});
test('missing source, creator, window or empty evidence stays unresolved',()=>{
 for(const d of routeDimensions){const r=route();delete r.dimensions[d];assert.equal(classifySettlement(family(),r).classification,'UNRESOLVED');}
 const r=route();r.dimensions.entity!.evidence='';assert.equal(classifySettlement(family(),r).classification,'UNRESOLVED');
 const f=family();f.documents=[];assert.equal(classifySettlement(f,route()).classification,'UNRESOLVED');
});
test('known ordinary mismatch wins over other missing evidence',()=>{
 const r=route();r.missingEvidence=['issuer timestamp absent'];r.dimensions.window!.poly='different month';assert.equal(classifySettlement(family(),r).classification,'INCOMPATIBLE');
});
test('conditional equivalence does not imply a trading window',()=>{
 const f=family();f.divergences=[{id:'publication',evidence:'missing publication'}];f.stateProofs=[{predicate:'official published',evidence:'Bounded rule proof',eliminates:['publication'],bothTradableAfter:'CLOSED'}];const x=classifySettlement(f,route());assert.equal(x.classification,'STATE_CONDITIONED');assert.equal(x.state!.bothTradableAfter,'CLOSED');assert.equal(x.executable,false);
});
test('late state requires fresh official evidence and two fresh open markets',()=>{
 const state={kind:'PUBLICATION' as const,officialEvidence:'official-release-hash',observedAt:10000,eventAt:9500,exceptionsIndicated:false,sourceFinal:true};const markets=[{open:true,checkedAt:10000,closesAt:15000},{open:true,checkedAt:10000,closesAt:15000}];assert.equal(lateStateUsable(state,11000,markets),true);
 for(const bad of [{...state,sourceFinal:false},{...state,exceptionsIndicated:true},{...state,observedAt:12000},{...state,eventAt:11000},{...state,officialEvidence:''}])assert.equal(lateStateUsable(bad,11000,markets),false);
 assert.equal(lateStateUsable(state,13001,markets),false);assert.equal(lateStateUsable(state,11000,[markets[0],{...markets[1],closesAt:9000}]),false);assert.equal(lateStateUsable(state,11000,[markets[0]]),false);
});
const market=(venue:'kalshi'|'poly',rules:string):Market=>({id:venue==='kalshi'?'KXU3-26SEP-T3.7':'urc-example',venue,rules,title:'September U3',outcome:'Yes',opposite:'No',category:'economics',url:'https://example.invalid',closeAt:'2026-10-02T12:29:00Z',open:true,feeRate:null,feeRounding:'ceil',minQty:1,hash:'fixture',settlement:null});
const unemployment=():Pair=>({id:'example',inverted:false,reviewed:false,a:market('kalshi','If the seasonally adjusted unemployment rate (U-3) reported by the Bureau of Labor Statistics in the Employment Situation Report is above 3.7% in September 2026, then the market resolves to Yes.\nhttps://assets.kalshi.com/contract_terms/U3.pdf'),b:market('poly','This market will settle to Yes if the U.S. seasonally adjusted unemployment rate (U-3) reported by the Bureau of Labor Statistics (BLS) in the Employment Situation Report for September 2026 is above 3.7%. Outcome sourced from BLS.')});
test('route parser compares actual reference month and threshold, and rejects inversion',()=>{
 const p=unemployment(),reg=catalogEntities([]);assert.equal(classifySettlement(family(),proveRoute(p,reg)).classification,'LIVE_EXACT');
 for(const field of ['month','threshold','orientation']){const changed=unemployment();if(field==='month')changed.b.rules=changed.b.rules.replace('September','October');if(field==='threshold')changed.b.rules=changed.b.rules.replace('3.7','3.8');if(field==='orientation')changed.inverted=true;assert.equal(classifySettlement(family(),proveRoute(changed,reg)).classification,'INCOMPATIBLE');}
});
test('ordinary Grok successor mismatch is not erased by a matching title',()=>{const p=unemployment();p.a.rules='If xAI releases Grok 5 before Oct 1, 2026, then the market resolves to Yes.\nhttps://assets.kalshi.com/contract_terms/MODELRELEASEDATE.pdf';p.b.id='aimc-grok';p.b.rules='This market will settle to Yes if xAI releases Grok 5 by September 30, 2026, 11:59 PM ET. Grok 5 or greater qualifies.';assert.equal(classifySettlement(family(),proveRoute(p,catalogEntities([]))).classification,'INCOMPATIBLE');});
test('reviewed matrix covers every required dimension and pins every controlling source',()=>{
 const base=new URL('../docs/research/settlement-families/',import.meta.url);const matrix=JSON.parse(fs.readFileSync(new URL('matrix.json',base),'utf8'));const sources=new Map(JSON.parse(fs.readFileSync(new URL('sources.json',base),'utf8')).map((s:{id:string;sha256:string})=>[s.id,s.sha256]));
 assert.equal(matrix.records.length,52);assert.equal(new Set(matrix.records.map((f:{semanticFamily:string})=>f.semanticFamily)).size,46);
 const dimensions=['ordinaryPredicate','resolutionSource','thresholdComparator','observationWindow','geography','tieSharedOutcome','cancellation','postponement','interruption','withdrawal','disqualification','correctionsRevisions','missingPublication','fractionalFairValue','expiration','reviewCutoff'];
 for(const f of matrix.records){assert.deepEqual(Object.keys(f.dimensions),dimensions);for(const d of dimensions){assert.ok(f.dimensions[d].kalshi);assert.ok(f.dimensions[d].poly);}for(const id of f.documents)assert.equal(f.sourceBindings[id],sources.get(id));assert.ok(f.lateStateInvestigation.tradability);assert.ok(f.divergences.some((d:{id:string})=>d.id==='venue-finality'));}
});
test('new bounded-basis design remains isolated and disabled',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('../config/tiny-live-bounded-basis.disabled.json',import.meta.url),'utf8'));assert.equal(p.ordersEnabled,false);assert.equal(p.checkpointAllowsOrders,false);assert.equal(p.authorization,null);assert.equal(p.maxCommitted,50000);assert.equal(p.maxEntryAttempts,1);assert.equal(p.maxPositions,1);assert.equal(p.reuseProceeds,false);assert.equal(p.stopOnUnknown,true);assert.equal(p.stopOnRealizedLoss,true);
});

test('same teams on adjacent baseball dates are not the same game',()=>{
 const a=market('kalshi','If Los Angeles D wins the Los Angeles D vs San Francisco professional baseball game originally scheduled for Sep 22, 2026 at 9:45 PM EDT, then the market resolves to Yes.\nhttps://assets.kalshi.com/contract_terms/BASEBALLGAMEWIN.pdf');
 const b=market('poly','This market will settle to the winner of the Los Angeles Dodgers vs San Francisco Giants MLB game scheduled for 2026-09-23 at 3:45PM ET.');b.id='aec-example';
 a.identity={sports:true,sport:'baseball',competition:'mlb',participants:['los angeles d','san francisco'],outcome:'los angeles d',eventAt:'2026-09-23T01:45:00.000Z',marketType:'winner',period:'full event',aliases:[],entities:[],numbers:[]};
 b.identity={...a.identity,participants:['los angeles dodgers','san francisco giants'],outcome:'los angeles dodgers',eventAt:'2026-09-23T19:45:00.000Z'};
 const p={id:'baseball-fixture',a,b,inverted:false,reviewed:false};const r=proveRoute(p,catalogEntities([a.identity,b.identity]));assert.equal(classifySettlement(family(),r).classification,'INCOMPATIBLE');assert.ok(r.conflicts.some(x=>x.includes('scheduled instant')));
});
test('Pacific elimination cutoff is an ordinary conflict, even with same date labels',()=>{
 const p=unemployment();p.a.rules='If Test Contestant is eliminated before Sep 23, 2026, then the market resolves to Yes.\nhttps://assets.kalshi.com/contract_terms/COMPETITIONREALITYELIM.pdf';p.b.id='rtc-example';p.b.rules='This market settles Yes if Test Contestant is eliminated by September 22, 2026, 11:59 PM PT.';assert.equal(classifySettlement(family(),proveRoute(p,catalogEntities([]))).classification,'INCOMPATIBLE');
});
