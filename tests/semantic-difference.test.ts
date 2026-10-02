import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paperSettlement} from '../lib/research/hot-confirmation.ts';
import {rankedSemanticLists} from '../lib/research/semantic-lists.ts';
import type {RecallRoute} from '../lib/research/recall-detector.ts';
const rows=JSON.parse(readFileSync(new URL('./fixtures/semantic-difference-retained.json',import.meta.url),'utf8'));
for(const r of rows)test(`retained ${r.stratum} ${r.rank} — ${r.reference}`,()=>{
 const c=paperSettlement(r.route);assert.equal(c.classification,r.reference);
 const route=structuredClone(r.route);route.pair.id='unknown-pair';route.pair.a.id='unknown-k';route.pair.b.id='unknown-p';
 assert.equal(paperSettlement(route).classification,r.reference);
});
const race=()=>structuredClone(rows[0].route) as RecallRoute;
test('known fixture conflict alone rejects when threshold evidence is missing',()=>{
 const r=race();r.pair.a.rules=r.pair.a.rules.replaceAll('35 points','points');r.pair.a.title='Neither team';
 assert.equal(paperSettlement(r).classification,'DIFFERENT_QUESTION');
 assert.ok(paperSettlement(r).differentQuestionReasons.some(s=>s.startsWith('fixtureParticipants:')));
});
test('unknown threshold and missing event do not imply disagreement or promotion',()=>{
 const r=race();for(const m of [r.pair.a,r.pair.b]){m.title='Neither team';m.rules='First Team to Score Points settles Yes if neither team scores points.';m.identity=undefined;}
 const c=paperSettlement(r);assert.equal(c.classification,'UNRESOLVED');assert.deepEqual(c.differentQuestionReasons,[]);
});
test('same fixture and known unequal race targets reject independent of profile',()=>{
 const r=structuredClone(rows[4].route);assert.ok(paperSettlement(r).differentQuestionReasons.some((s:string)=>s.startsWith('threshold:')));
 assert.equal(paperSettlement(r).proposition.a.dimensions.fixtureParticipants,paperSettlement(r).proposition.b.dimensions.fixtureParticipants);
});
test('Texas Tech needs native parent-event season evidence',()=>{
 const r=structuredClone(rows.find((x:any)=>x.rank===42&&x.stratum==='survivor-audit').route);
 delete r.pair.a.propositionContext;assert.equal(paperSettlement(r).classification,'UNRESOLVED');
});
test('ranked lists keep nominal unresolved/rejected spreads out of promoted economics',()=>{
 const sample=[{c:'UNRESOLVED',net:100},{c:'DIFFERENT_QUESTION',net:200},{c:'ORDINARY_EQUIVALENT_BASIS_RISK',net:1}] as const;
 const lists=rankedSemanticLists([...sample],r=>r.c,r=>r.net,1);
 assert.equal(lists.promotedOpportunities[0].net,1);assert.equal(lists.unresolvedResearch[0].net,100);assert.equal(lists.rejectedDifferentQuestions[0].net,200);
});
function nativePair(a:string,b:string){const r=race();for(const [m,s] of [[r.pair.a,a],[r.pair.b,b]] as const){m.title=s;m.rules=s;m.identity=undefined;}return r;}
for(const [label,a,b] of [
 ['new award category','If New Nominee is nominated for Best Director at the 100th Academy Awards.','If New Nominee is nominated for Best Actress at the 100th Oscars.'],
 ['ceremony','If New Film is nominated for Best Picture at the 100th Academy Awards.','If New Film is nominated for Best Picture at the 101st Oscars.'],
 ['chart family/content','If New Artist has a #1 song on the Billboard Hot 100 in 2027.','If New Artist has a #1 album on the Billboard 200 in 2027.'],
 ['artist role','If New Artist has a #1 song on the Billboard Hot 100 including features in 2027.','If New Artist has a #1 song on the Billboard Hot 100 primary artist only in 2027.'],
 ['event date','If Neither team is first to score 21 points in Alpha vs Beta professional football game scheduled for Oct 5, 2027.','Race to 21 Points settles Yes if neither team reaches 21 points in Alpha vs Beta professional football game scheduled for Oct 6, 2027.'],
 ['cohort','If New Person is the next member of the Cabinet to leave office.\nThe Cabinet consists of the Vice President and the heads of the 15 executive departments.','If New Person is the next member of the Cabinet to leave office.\nThe Cabinet consists of the heads of the 15 executive departments and Director of OSTP.'],
 ['cycle','If New Party wins control of the United States Senate in 2026.','If New Party wins control of the United States Senate in 2028.'],
 ['rank range','If New Team finishes in positions 25 through 36 in the league phase of the 2027 Champions League.','If New Team finishes in top 8 in the league phase of the 2027 Champions League.'],
])test('unseen structural difference: '+label,()=>assert.equal(paperSettlement(nativePair(a,b)).classification,'DIFFERENT_QUESTION'));
test('absent artist-role and cohort evidence stays unknown',()=>{
 const r=nativePair('If New Artist has a #1 song on the Billboard Hot 100 including features in 2027.','If New Artist has a #1 song on the Billboard Hot 100 in 2027.');
 assert.equal(paperSettlement(r).classification,'UNRESOLVED');assert.deepEqual(paperSettlement(r).differentQuestionReasons,[]);
});
