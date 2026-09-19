import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {assessSettlement} from '../lib/research/settlement-validation.ts';import type {Pair} from '../lib/arb/types.ts';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/nfl-rushing-settlement.json',import.meta.url),'utf8')) as Pair;
test('NFL yardage profile accepts equivalent professional football and Pro Football wording across thresholds',()=>{
 for(const label of ['professional football','Pro Football'])for(const threshold of [40,100,110]){
  const p=structuredClone(fixture);for(const m of [p.a,p.b]){m.rules=m.rules.replaceAll('100',String(threshold));m.identity!.line=threshold-.5;m.identity!.numbers=[String(threshold)];}p.a.rules=p.a.rules.replaceAll('professional football',label);
  const r=assessSettlement(p);assert.equal(r.status,'CONDITIONAL');assert.equal(r.profile,'nfl-player-yards');assert.equal(r.strictEquivalent,false);assert.ok(r.risks.length);
 }
});
test('Equivalent league wording never permits a changed player, statistic, threshold, date or sport',()=>{
 for(const [from,to] of [['James Cook III','Josh Allen'],['100+','90+'],['rushing yards','receiving yards'],['Sep 13, 2026','Sep 14, 2026'],['professional football','professional baseball']]){
  const p=structuredClone(fixture);p.a.rules=p.a.rules.replaceAll(from,to);assert.notEqual(assessSettlement(p).status,'CONDITIONAL',`${from} -> ${to}`);
 }
});
