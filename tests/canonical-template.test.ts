import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalTemplate,canonicalTemplateKey} from '../lib/research/canonical-template.ts';
import {catalogEntities,EntityRegistry} from '../lib/research/entities.ts';
import {canonicalCompetition} from '../lib/research/identity.ts';
import {discoverCandidates} from '../lib/research/matching.ts';
import {market} from './research-fixture.ts';
const f=JSON.parse(readFileSync(new URL('./fixtures/canonical-template-markets.json',import.meta.url),'utf8'));
const evidence=f.rows.flatMap((r:any)=>[r.kalshi,r.poly]).map((m:any)=>({...market(m.venue,m.id),...m,open:false}));
const markets=(r:any)=>[r.kalshi,r.poly].map((m:any)=>({...market(m.venue,m.id),...m}));
for(const row of f.rows) test(`Captured ${row.family}/${row.domain}/${row.metric} wording recovers an unverified candidate`,()=>{
 const [a,b]=markets(row);const registry=catalogEntities(evidence.map((m:any)=>m.identity));
 const x=canonicalTemplate(a,registry),y=canonicalTemplate(b,registry);assert.ok(x);assert.ok(y);
 assert.equal(canonicalTemplateKey(x),canonicalTemplateKey(y));
 const c=discoverCandidates([a], [b,...evidence.filter((m:any)=>m.id!==b.id)]).candidates;if(row.domain==='mlb'){assert.equal(c.length,0,'captured PM-US start time contradicts the primary scheduled game');return;}assert.equal(c.length,1);assert.equal(c[0].status,'UNVERIFIED');assert.equal(c[0].pair.reviewed,false);
});
test('Every canonical template retains threshold, calendar window and subject distinctions',()=>{
 for(const row of f.rows){const [a,b]=markets(row),registry=catalogEntities([a.identity,b.identity]);const c=canonicalTemplate(b,registry)!;
  for(const change of ['year','threshold'] as const){const changed=structuredClone(b); if(change==='year'){changed.rules=changed.rules.replaceAll('2026','2028');changed.title=changed.title.replaceAll('2026','2028');}else{const number=Number(c.threshold); const re=new RegExp(String(number).replace('.','\\.')+'(?=[^0-9]|$)');if(!re.test(changed.rules))continue;changed.rules=changed.rules.replace(re,String(number+2));changed.identity.line=undefined;} assert.equal(discoverCandidates([a],[changed]).candidates.length,0,row.family+':'+change);}
 }
});
test('Full-game templates do not erase quarter/inning metadata or same-day doubleheader times',()=>{
 const row=f.rows.find((r:any)=>r.family==='game-total'&&r.domain==='nfl');const [a,b]=markets(row);const registry=catalogEntities([a.identity,b.identity]);
 const partial=structuredClone(b);partial.rules=partial.rules.replace('points in the','points in the first quarter of the');partial.identity.period='first quarter';assert.equal(canonicalTemplate(partial,registry),undefined);assert.equal(discoverCandidates([a],[partial]).candidates.length,0);
 const later=structuredClone(b);a.identity.eventAt='2026-09-24T14:00:00Z';later.identity.eventAt='2026-09-24T21:00:00Z';assert.equal(discoverCandidates([a],[later]).candidates.length,0);
 for(const invalid of ['Feb 30, 2026','2026-13-24','2026-09-31']){const broken=structuredClone(b);broken.rules=broken.rules.replace('Sep 24, 2026',invalid);assert.equal(canonicalTemplate(broken,registry),undefined);}
});
test('Conference winner/qualifier and Kansas/Kansas State remain distinct',()=>{
 const row=f.rows.find((r:any)=>r.family==='conference-championship'&&r.metric==='winner');const [a,b]=markets(row);
 const qualifies=structuredClone(b);qualifies.rules=qualifies.rules.replace(' wins the ',' qualifies for the ');assert.equal(discoverCandidates([a],[qualifies]).candidates.length,0);
 const teams=['Kansas','Kansas State'].map(name=>({sports:true,competition:'cfb',participants:[],entities:[],numbers:[],aliases:[{name,aliases:[],venue:'poly',venueId:name}]}));
 for(const order of [teams,[...teams].reverse()]){const registry=catalogEntities(order);assert.notEqual(registry.resolve('Kansas','cfb'),registry.resolve('Kansas State','cfb'));assert.equal(registry.resolve('Kansas St','cfb'),registry.resolve('Kansas State','cfb'));}
});
test('Published full aliases and venue IDs reuse NFL seeds regardless of catalog order',()=>{
 const teams=[{name:'HOU Texans',aliases:['Houston Texans','Texans','HOU'],venue:'poly',venueId:'hou'},{name:'NY Giants',aliases:['New York Giants','Giants','NYG'],venue:'poly',venueId:'nyg'}];
 for(const rows of [teams,[...teams].reverse()]){const registry=catalogEntities([{sports:true,competition:'National Football League',participants:[],entities:[],numbers:[],aliases:rows}]);assert.equal(registry.resolve('HOU Texans','nfl'),'NFL:HOUSTON');assert.equal(registry.resolve('NY Giants','nfl'),'NFL:NEW_YORK_G');assert.equal(registry.resolve('Houston Texans','nfl'),'NFL:HOUSTON');}
 assert.equal(canonicalCompetition('National Football League'),'nfl');assert.notEqual(canonicalCompetition('National Basketball Association'),canonicalCompetition("Women's National Basketball Association"));
});
test('A venue ID joins safeName variants; ambiguous OSU stays unresolved without its venue ID',()=>{
 const rows=[{name:'Ohio State',aliases:['OSU'],venue:'poly',venueId:'1129'},{name:'Ohio State Buckeyes',aliases:['OSU'],venue:'poly',venueId:'1129'},{name:'Oregon State',aliases:['OSU'],venue:'poly',venueId:'1130'}];
 for(const order of [rows,[...rows].reverse()]){const registry=catalogEntities([{sports:true,competition:'cfb',participants:[],entities:[],numbers:[],aliases:order}]);assert.equal(registry.resolve('Ohio State Buckeyes','cfb'),registry.resolve('Ohio State','cfb'));assert.equal(registry.resolve('OSU','cfb'),undefined);assert.equal(registry.resolve('OSU','cfb','poly','1129'),registry.resolve('Ohio State','cfb'));}
});
test('Economic basis is independently supported; missing advance source or CPI family document stays unknown',()=>{
 for(const row of f.rows.filter((r:any)=>r.family==='economic-release')){const [a,b]=markets(row),registry=new EntityRegistry();
  if(row.metric.startsWith('real-gdp')){b.rules=b.rules.split('\n')[0];assert.equal(canonicalTemplate(b,registry),undefined);}
  else{a.rules=a.rules.replace('https://assets.kalshi.com/contract_terms/CPI.pdf','');assert.equal(canonicalTemplate(a,registry),undefined);}
 }
});
test('Netflix uses primary publication date, region, format, rank and named outcome including numerals',()=>{
 const make=(venue:string,region='US',format='Movie',day='22',rank=1)=>({...market(venue),category:'Culture',rules:`${venue==='kalshi'?'If':'This market will settle to Yes if'} Anaconda 3: Offspring is #${rank} on the Netflix Top 10 ${region} ${format} chart published on September ${day}, 2026.`,title:'Anaconda 3: Offspring Netflix chart'} as any);
 const a=make('kalshi'),b=make('poly');assert.equal(discoverCandidates([a],[b]).candidates.length,1);
 for(const bad of [make('poly','Global'),make('poly','US','Show'),make('poly','US','Movie','29'),make('poly','US','Movie','22',2)])assert.equal(discoverCandidates([a],[bad]).candidates.length,0);
});

test('Distinct authoritative venue IDs with the same short name never collapse identity',()=>{
 const rows=[{name:'OSU',aliases:['Ohio State','Buckeyes'],venue:'poly',venueId:'ohio-state'},{name:'OSU',aliases:['Oklahoma State','Cowboys'],venue:'poly',venueId:'oklahoma-state'}];
 for(const order of [rows,[...rows].reverse()]){const registry=catalogEntities([{sports:true,competition:'cfb',participants:[],entities:[],numbers:[],aliases:order}]);assert.notEqual(registry.resolve('Ohio State','cfb'),registry.resolve('Oklahoma State','cfb'));assert.equal(registry.resolve('OSU','cfb'),undefined);assert.notEqual(registry.resolve('OSU','cfb','poly','ohio-state'),registry.resolve('OSU','cfb','poly','oklahoma-state'));}
});
test('Explicit opposing orientation cannot be erased by a matching primary total template',()=>{
 const row=f.rows.find((r:any)=>r.family==='game-total'&&r.domain==='cfb');const [a,b]=markets(row);b.identity.outcome='under';assert.equal(canonicalTemplate(b,catalogEntities([a.identity,b.identity])),undefined);assert.equal(discoverCandidates([a],[b]).candidates.length,0);
});
test('An exact canonical block has priority inside the finite lexical comparison budget',()=>{
 const row=f.rows.find((r:any)=>r.family==='season-wins');const [a,b]=markets(row);a.title='alpha bravo charlie delta echo foxtrot';b.title='zulu';a.outcome=b.outcome='';a.identity.outcome=b.identity.outcome=undefined;a.identity.participants=b.identity.participants=[];
 const noise=a.title.split(' ').map((title:string,n:number)=>({...b,id:'noise'+n,title,rules:'No parsed payout predicate',identity:{...b.identity,line:99}}));
 const result=discoverCandidates([a],[b,...noise]);assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].pair.b.id,b.id);assert.ok(result.diagnostics.comparisons<=300);
});
test('Known ambiguous primary aliases cannot fall back to equal literal template subjects',()=>{
 const rows=[{name:'OSU',aliases:['Ohio State','Buckeyes'],venue:'poly',venueId:'ohio-state'},{name:'OSU',aliases:['Oklahoma State','Cowboys'],venue:'poly',venueId:'oklahoma-state'}];
 const make=(venue:string,n:number)=>({...market(venue),category:'Sports',title:'OSU Big Ten Championship Winner',rules:`${venue==='kalshi'?'If':'This market will settle to Yes if'} OSU wins the 2026 Big Ten Football Championship scheduled for December 5, 2026.`,identity:{sports:true,competition:'cfb',participants:['OSU'],outcome:'OSU',marketType:'future',eventKey:'Big Ten Championship Winner',aliases:[rows[n]],entities:[],numbers:[]}} as any);
 const a=make('kalshi',0),b=make('poly',1),registry=catalogEntities([a.identity,b.identity]);assert.equal(canonicalTemplate(a,registry),undefined);assert.equal(canonicalTemplate(b,registry),undefined);assert.equal(discoverCandidates([a],[b]).candidates.length,0);
});
test('Explicit below/under direction and conflicting conference subject remain fail-closed',()=>{
 for(const family of ['season-wins','economic-release','conference-championship']){const row=f.rows.find((r:any)=>r.family===family);const [a,b]=markets(row);b.identity.outcome=family==='conference-championship'?'unrelated team':'under';b.outcome=family==='conference-championship'?'Unrelated team':'Below';assert.equal(canonicalTemplate(b,catalogEntities([a.identity,b.identity])),undefined);assert.equal(discoverCandidates([a],[b]).candidates.length,0,family);}
});
test('College final words are not presumed mascots: Georgia Southern cannot invent Georgia',()=>{
 for(const competition of ['cfb','cbb','wcbb']){const make=(name:string)=>({sports:true,competition,participants:[name],entities:[],numbers:[],aliases:[{name,aliases:[],venue:'poly',venueId:name}]});
  const southern=make('Georgia Southern'),georgia=make('Georgia');assert.equal(catalogEntities([southern]).resolve('Georgia',competition),undefined);
  for(const order of [[southern,georgia],[georgia,southern]]){const r=catalogEntities(order);assert.notEqual(r.resolve('Georgia',competition),r.resolve('Georgia Southern',competition));assert.equal(r.ambiguous('Georgia',competition),false);}
 }
});
