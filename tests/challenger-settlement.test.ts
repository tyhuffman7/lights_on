import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {discoverCandidates} from '../lib/research/matching.ts';import {assessSettlement} from '../lib/research/settlement-validation.ts';
const f=JSON.parse(readFileSync(new URL('./fixtures/challenger-name-variants.json',import.meta.url),'utf8'));
const pairs=()=>discoverCandidates(f.kalshi,f.poly).candidates.map(c=>c.pair);
test('Captured Challenger rules support only a conditional ordinary-result review',()=>{
 assert.equal(pairs().length,8);for(const p of pairs()){const r=assessSettlement(p);assert.equal(r.status,'CONDITIONAL');assert(r.normalOutcomeMatched);assert.equal(r.strictEquivalent,false);assert.equal(p.reviewed,false);assert(r.risks.some(x=>x.includes('two years')));assert(r.risks.some(x=>x.includes('fair-price')));assert(r.blockers.length>0);}
});
test('Changed player prose cannot reuse a matching Challenger identity',()=>{
 const p=structuredClone(pairs()[0]);p.b.rules=p.b.rules.replace(/winner of the .+ vs .+ ATP match/,'winner of the Unrelated Player vs Another Person ATP match');assert.equal(assessSettlement(p).status,'CONFLICT');
});
test('Missing retirement or different referenced terms are unsupported',()=>{
 for(const change of [(p:any)=>p.a.rules=p.a.rules.replace('ACHIEVEMENTS.pdf','OTHER.pdf'),(p:any)=>p.b.rules=p.b.rules.replace('If a player retires during the match, the opponent will be recorded as the winner.','')]){const p=structuredClone(pairs()[0]);change(p);assert.equal(assessSettlement(p).status,'UNSUPPORTED');}
});
