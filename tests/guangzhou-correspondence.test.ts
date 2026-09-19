import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {identity} from '../lib/research/identity.ts';import {discoverCandidates} from '../lib/research/matching.ts';import {assessSettlement} from '../lib/research/settlement-validation.ts';
const f=JSON.parse(readFileSync(new URL('./fixtures/guangzhou-correspondence.json',import.meta.url),'utf8'));
const k=f.kalshi.map((m:any)=>({...m,identity:identity('kalshi',{ticker:m.id,yes_sub_title:m.outcome,category:m.category,title:m.title,rules_primary:m.rules},{})}));
test('Draw-corroborated Guangzhou first-round matches recover three conditional unapproved pairings',()=>{
 const candidates=discoverCandidates(k,f.poly).candidates;assert.equal(candidates.length,3);
 for(const c of candidates){assert.equal(c.status,'UNVERIFIED');assert.equal(c.pair.reviewed,false);assert.equal(assessSettlement(c.pair).status,'CONDITIONAL');assert.equal(c.pair.a.identity?.tennisContext?.tournament,'challenger guangzhou huangpu');}
});
test('Guangzhou correspondence cannot expand to another week, year, round, venue, player or parent',()=>{
 for(const change of [(m:any)=>m.identity.eventDate='2026-09-21',(m:any)=>m.identity.tennisContext.year='2027',(m:any)=>m.identity.tennisContext.round='round of 16',(m:any)=>m.identity.tennisContext.tournament='challenger guangzhou nansha',(m:any)=>m.identity.participants[0]='other player',(m:any)=>m.identity.tennisContext.source+='-other',(m:any)=>{m.id=m.id.replace('2026-09-14','2026-09-15');m.identity.tennisContext.source=m.identity.tennisContext.source.replace('2026-09-14','2026-09-15');}]){
  const poly=structuredClone(f.poly);poly.forEach(change);assert.equal(discoverCandidates(k,poly).candidates.length,0);
 }
});
