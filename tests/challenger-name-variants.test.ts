import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {discoverCandidates} from '../lib/research/matching.ts';
const f=JSON.parse(readFileSync(new URL('./fixtures/challenger-name-variants.json',import.meta.url),'utf8'));
test('Exact captured player variants recover both orientations of four Challenger matches',()=>{
 const d=discoverCandidates(f.kalshi,f.poly);assert.equal(d.candidates.length,8);const groups=new Map<string,boolean[]>();for(const c of d.candidates){assert.equal(c.status,'UNVERIFIED');assert.equal(c.pair.reviewed,false);const g=groups.get(c.pair.b.id)??[];g.push(c.pair.inverted);groups.set(c.pair.b.id,g);}assert.equal(groups.size,4);for(const g of groups.values())assert.deepEqual(g.sort(),[false,true]);
});
test('Aliases do not override another named player, competition or round',()=>{
 for(const mutate of [(m:any)=>m.identity.outcome='John Sultanov',(m:any)=>m.identity.competition='wta',(m:any)=>m.identity.tennisContext.round='round of 16']){const a=structuredClone(f.kalshi.find((m:any)=>m.id.endsWith('SUL')));mutate(a);assert.equal(discoverCandidates([a],f.poly).candidates.length,0);}
});
