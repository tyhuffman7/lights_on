import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {discoverCandidates} from '../lib/research/matching.ts';import {EntityRegistry} from '../lib/research/entities.ts';
const data=JSON.parse(readFileSync(new URL('./fixtures/mlb-city-names.json',import.meta.url),'utf8'));
test('Actual MLB city versus nickname identities recover both orientations for three games',()=>{const c=discoverCandidates(data.kalshi,data.poly).candidates;assert.equal(c.length,6);assert.equal(new Set(c.map(x=>x.pair.b.id)).size,3);assert.ok(c.every(x=>x.status==='UNVERIFIED'));});
test('MLB aliases retain league, team and event distinctions',()=>{
 const r=new EntityRegistry();assert.equal(r.resolve('Los Angeles A','mlb'),r.resolve('Angels','mlb'));assert.ok(r.resolve('Angels','mlb'));assert.equal(r.resolve('Los Angeles','mlb'),undefined);assert.equal(r.resolve('Angels','nfl'),undefined);assert.notEqual(r.resolve('Miami','mlb'),r.resolve('Miami','nfl'));
 const wrongDate=data.poly.map(m=>({...m,identity:{...m.identity,eventDate:'2026-09-16',eventAt:'2026-09-16T01:40:00Z'}}));assert.equal(discoverCandidates(data.kalshi,wrongDate).candidates.length,0);
});
