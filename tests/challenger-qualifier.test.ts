import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {identity} from '../lib/research/identity.ts';import {PolyEventContexts} from '../lib/arb/poly-event-context.ts';import {normalizePoly} from '../lib/arb/adapters.ts';import {matchCandidates} from '../lib/research/matching.ts';
const rows=JSON.parse(readFileSync(new URL('./fixtures/challenger-qualifier.json',import.meta.url),'utf8'));
const identify=(m:any,rules=m.rules)=>identity('kalshi',{ticker:m.id,yes_sub_title:m.outcome,category:m.category,title:m.title,rules_primary:rules},{});
test('Captured Guangzhou parenthetical qualifier is parsed and preserved, not stripped into an alias',()=>{
 for(const m of rows){const i=identify(m);assert.equal(i.tennisContext?.tournament,'challenger guangzhou huangpu');assert.equal(i.tennisContext?.round,'round of 32');assert.equal(i.eventDate,undefined);
  for(const text of ['Guangzhou (Huangpu','Guangzhou Huangpu)','Guangzhou ((Huangpu))'])assert.equal(identify(m,m.rules.replaceAll('Guangzhou (Huangpu)',text)).tennisContext,undefined);
 }
});
test('Verified parent accepts a balanced qualifier but mismatching tournament qualifiers still block pairing',async()=>{
 const f=JSON.parse(readFileSync(new URL('./fixtures/challenger-context.json',import.meta.url),'utf8')),e=structuredClone(f.event);
 e.eventState.tennisState.tournamentName='Challenger Phan Thiet 4 (Other Venue)';
 const contexts=new PolyEventContexts(async()=>({event:e})),b=await normalizePoly(await contexts.enrich(e.markets[0]));
 assert.equal(b.identity?.tennisContext?.tournament,'challenger phan thiet 4 other venue');
 const a={...f.a,identity:identify(f.a)};assert.equal(matchCandidates([a],[b]).length,0);
});
