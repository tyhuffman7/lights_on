import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {electionStage,meetingPredicate} from '../lib/research/identity.ts';
import {matchCandidates} from '../lib/research/matching.ts';
const pairs=JSON.parse(readFileSync(new URL('./fixtures/payout-predicate-conflicts.json',import.meta.url),'utf8'));
for(const p of pairs)test(`Actual payout conflict excluded: ${p.a.id}`,()=>{
 assert.equal(matchCandidates([p.a],[p.b]).length,0);
 const aligned={...p.a,rules:p.b.rules,title:p.b.title,outcome:p.b.outcome,identity:p.b.identity};
 const matches=matchCandidates([aligned],[p.b]);assert.ok(matches.length>0);assert.ok(matches.every(m=>m.status==='UNVERIFIED'));
});
test('Meeting mode and observation window each independently exclude a conflict',()=>{
 const p=pairs.find(p=>p.a.id.endsWith('KJON'));
 const a={...p.a,title:p.b.title,identity:p.b.identity,rules:p.b.rules};
 const sameWindowCalls={...a,rules:a.rules.replace('meets in person with','meets (including phone calls) with')};
 assert.equal(matchCandidates([sameWindowCalls],[p.b]).length,0);
 const sameModeSeptember={...a,rules:a.rules.replace('between Contract Issuance and December 31, 2026, 11:59 PM ET','in Sep 2026')};
 assert.equal(matchCandidates([sameModeSeptember],[p.b]).length,0);
});

test('Payout hints ignore later exception text and unknown date templates',()=>{
 assert.equal(electionStage('If Candidate wins the 2027 French Presidential Election, then Yes.\nCandidate wins the primary to select a nominee.'),'presidential-election');
 assert.equal(electionStage('The primary source reports on elections.'),undefined);
 assert.deepEqual(meetingPredicate('Unknown primary payout.\nIf Trump meets in person in Sep 2026, then Yes.'),{});
 assert.equal(meetingPredicate('If Trump meets in person in Septober 2026, then Yes.').window,undefined);
 assert.equal(meetingPredicate('If Trump meets in person between Contract Issuance and February 31, 2026, 11:59 PM ET, then Yes.').window,undefined);
 assert.equal(meetingPredicate('If Trump meets in person in September 2026, then Yes.').window,meetingPredicate('If Trump meets in person in Sep 2026, then Yes.').window);
});
