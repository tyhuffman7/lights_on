import test from 'node:test';
import type {Market} from '../lib/arb/types.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paperSettlement} from '../lib/research/hot-confirmation.ts';
import {structuredProposition} from '../lib/research/proposition.ts';
import {recallMatches,type RecallRoute} from '../lib/research/recall-detector.ts';
import {market} from './research-fixture.ts';
const frozen=JSON.parse(readFileSync(new URL('./fixtures/proposition-frozen-top20.json',import.meta.url),'utf8'));
for(const row of frozen)test('frozen native top '+row.rank+': '+row.label,()=>{
 assert.equal(paperSettlement(row.route).classification,row.expected);
 // No exact-ID exclusion: the same native proposition with unfamiliar IDs works.
 const route=structuredClone(row.route);route.pair.a.id='unseen-k';route.pair.b.id='unseen-p';route.pair.id='unseen-pair';
 assert.equal(paperSettlement(route).classification,row.expected);
});
const season=()=>structuredClone(frozen.find((r:any)=>r.rank===12).route) as RecallRoute;
test('different ordinary constraints override canonical discovery promotion',()=>{
 const r=season();r.pair.a.rules=r.pair.a.rules.replace('regular season','home regular season');
 r.pair.a.title='Will Houston have at least 9 home regular season wins in 2026?';
 assert.equal(paperSettlement(r).classification,'DIFFERENT_QUESTION');
});
test('same threshold retains season-win basis and never certifies strict settlement',()=>{
 const r=season(),c=paperSettlement(r);assert.equal(c.classification,'ORDINARY_EQUIVALENT_BASIS_RISK');
 assert.equal(c.proposition.a.dimensions.threshold,'9');assert.equal(c.proposition.b.dimensions.threshold,'9');
 assert.equal(c.strictEquivalent,false);assert.ok(c.divergenceBranches.length>=4);
});
test('unknown native clauses never become ordinary-equivalent from canonical route label',()=>{
 const r=season();r.pair.b.rules='';assert.equal(paperSettlement(r).classification,'UNRESOLVED');
});
test('broad discovery keeps structurally different hypotheses for inexpensive observation',()=>{
 const r=frozen.find((r:any)=>r.rank===2).route;
 const found=recallMatches([r.pair.a],[r.pair.b]).routes;
 assert.ok(found.length);assert.equal(paperSettlement(found[0]).classification,'DIFFERENT_QUESTION');
});
test('player statistic dimensions capture metric, threshold, unit and scope',()=>{
 const r=frozen.find((r:any)=>r.rank===2).route;
 assert.equal(structuredProposition(r.pair.a).dimensions.metric,'rushing-attempts');
 assert.equal(structuredProposition(r.pair.b).dimensions.metric,'rushing-yards');
});
function unseen(a:string,b:string):RecallRoute{
 return {pair:{id:'new-pair',a:{...(market('kalshi','new-k') as Market),rules:a,title:a,venue:'kalshi'},
 b:{...(market('poly','new-p') as Market),rules:b,title:b,venue:'poly'},inverted:false,reviewed:false},matchSource:'TEXT',warnings:[],eventKey:'new'};
}
for(const [label,a,b] of [
 ['metric','If New Player records 15+ rushing attempts in the Alpha vs Beta professional football game originally scheduled for Oct 5, 2026, then the market resolves to Yes.','This market will settle to Yes if New Player records at least 15 rushing yards in the Alpha vs Beta professional football game scheduled for Oct 5, 2026.'],
 ['stage','If New Team qualifies for the 2026-27 Champions League Semifinals, then the market resolves to Yes.','This market will settle to Yes if New Team qualifies for the 2026-27 Champions League Quarterfinals.'],
 ['champion scope','If New Team wins the 2027 MLS Cup, then the market resolves to Yes.','This market will settle to Yes if New Team wins the 2027 MLS Western Conference Final.'],
 ['player/team','If New Player records 100+ rushing yards in the Alpha vs Beta professional football game scheduled for Oct 5, 2026, then the market resolves to Yes.','This market will settle to Yes if New Player records at least 100 team total rushing yards in the Alpha vs Beta professional football game scheduled for Oct 5, 2026.'],
 ['conditional nomination','If New Person wins the Republican nomination in 2028, provided that Another Person wins the Democratic nomination, then the market resolves to Yes.','This market will settle to Yes if New Person wins the Republican nomination in 2028.'],
 ['named-winner scope','If New Player scores the first touchdown in the Alpha vs Beta professional football game scheduled for Oct 5, 2026, then the market resolves to Yes.','This market will settle to the player who scores the first touchdown for Alpha in the Alpha vs Beta professional football game scheduled for Oct 5, 2026.'],
 ['local/aggregate','If New Party wins the Ohio House district election in 2026, then the market resolves to Yes.','This market will settle to Yes if New Party controls the U.S. House in 2026.']
])test('unseen entities and clauses reject structural '+label,()=>assert.equal(paperSettlement(unseen(a,b)).classification,'DIFFERENT_QUESTION'));
test('continuous statistics never receive integer threshold rounding',()=>{
 const r=unseen('If New Player records over 8.5 QBR in 2026, then the market resolves to Yes.','This market will settle to Yes if New Player records at least 9 QBR in 2026.');
 assert.equal(paperSettlement(r).classification,'DIFFERENT_QUESTION');assert.equal(structuredProposition(r.pair.a).dimensions.threshold,'8.5');
});
test('conference qualifier scheduled date does not replace the ordinary season',()=>{
 const r=unseen('If New Team qualifies for the 2026 College Football Big Ten Championship Game, then the market resolves to Yes.','This market will settle to Yes if New Team qualifies for the 2026 Big Ten Football Championship Game scheduled for December 5, 2026.');
 r.pair.a.identity={sports:true,competition:'cfb',participants:[],entities:[],numbers:[]};r.pair.b.identity=r.pair.a.identity;
 assert.equal(paperSettlement(r).classification,'ORDINARY_EQUIVALENT_BASIS_RISK');
});
test('hockey ending-year finals and a spanning season preserve the same predicate',()=>{
 const r=unseen('If New Team wins the 2026-27 NHL Eastern Conference Finals, then the market resolves to Yes.','This market will settle to Yes if New Team wins the 2027 NHL Eastern Conference Finals.');
 r.pair.a.identity={sports:true,competition:'nhl',participants:[],entities:[],numbers:[]};r.pair.b.identity=r.pair.a.identity;
 assert.equal(paperSettlement(r).classification,'ORDINARY_EQUIVALENT_BASIS_RISK');
});
