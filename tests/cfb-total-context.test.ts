import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PolyEventContexts } from '../lib/arb/poly-event-context.ts';
import { normalizeKalshi, normalizePoly } from '../lib/arb/adapters.ts';
import { matchCandidates } from '../lib/research/matching.ts';
import { assessSettlement } from '../lib/research/settlement-validation.ts';
import { createPaperApproval, validPaperApproval } from '../lib/arb/paper-approval.ts';
const f = JSON.parse(readFileSync(new URL('./fixtures/cfb-total-context.json', import.meta.url), 'utf8'));
async function pairs() {
  const ctx = new PolyEventContexts(async () => ({event: f.event}));
  return matchCandidates(await Promise.all(f.kalshi.map(m => normalizeKalshi(m, f.series))),
    await Promise.all(f.poly.map(async m => normalizePoly(await ctx.enrich(m)))));
}
test('Full-game totals match all common half-point lines using parent-event teams', async () => {
  const candidates = await pairs();
  const lines = f.kalshi.map(m=>m.floor_strike).filter(n=>f.poly.some(m=>m.line===n));
  assert.equal(candidates.length, lines.length);
  for (const {pair:p} of candidates) {
    assert.equal(p.reviewed, false);
    assert.equal(p.inverted, false);
    assert.equal(p.a.identity.line, p.b.identity.line);
    const a = assessSettlement(p);
    assert.equal(a.status, 'CONDITIONAL', JSON.stringify(a));
    assert.equal(a.strictEquivalent, false);
    assert.ok(a.risks.some(r=>r.includes('55-minute')));
    const now=Date.parse('2026-09-12T16:00:00Z');
    assert.ok(validPaperApproval(createPaperApproval(p,'Synthetic test of explicitly accepted conditional risk',now),p,now));
  }
});
test('Event membership, team codes and exact schedule are required for enrichment', async () => {
  const m=f.poly[0];let calls=0,now=0;
  const ctx = new PolyEventContexts(async()=>{calls++;return {event:f.event}},()=>now);
  assert.equal((await ctx.enrich(m)).eventTeams.length,2);
  await ctx.enrich(f.poly[1]);assert.equal(calls,1);
  now=60000;await ctx.enrich(m);assert.equal(calls,2);
  for(const e of [ {...f.event,markets:[]}, {...f.event,startTime:'2026-09-13T16:00:00Z'},
    {...f.event,teams:[{...f.event.teams[0],abbreviation:'buf'},f.event.teams[1]]} ]) {
    assert.equal((await new PolyEventContexts(async()=>({event:e})).enrich(m)).eventTeams,undefined);
  }
  assert.equal((await new PolyEventContexts(async()=>{throw Error('Unavailable')}).enrich(m)).eventTeams,undefined);
});
test('Event-list display titles do not alter total metadata on individual refresh', async()=>{
  const ctx=new PolyEventContexts(async()=>({event:f.event}));
  const m=await ctx.enrich(f.poly[0]);
  assert.deepEqual(await normalizePoly({...m,title:'Over '+m.line+' total points'}),await normalizePoly({...m,title:undefined}));
});
test('Unenriched total metadata cannot authorize a same-nickname matchup', async()=>{
  const a=await normalizeKalshi(f.kalshi.find(m=>m.floor_strike===f.poly[0].line)??f.kalshi[0],f.series);
  const b=await normalizePoly(f.poly[0]);
  assert.notEqual(assessSettlement({id:'unlinked',a,b,inverted:false,reviewed:false}).status,'CONDITIONAL');
});
test('Total settlement rejects changed period, team, threshold, labels and overtime rule',async()=>{
  const p=(await pairs())[0].pair;
  for(const change of [
    q=>q.b.identity.period='first half',
    q=>q.b.rules=q.b.rules.replace('Black Knights','Bulldogs'),
    q=>q.b.rules=q.b.rules.replace('over '+q.b.identity.line,'over '+(q.b.identity.line+1)),
    q=>q.b.outcome='Under',
    q=>q.b.rules=q.b.rules.replace('Overtime is included if played.','Overtime is excluded.'),
    q=>delete q.b.identity.eventContext,
    q=>q.inverted=true,
  ]) {const q=structuredClone(p);change(q);assert.notEqual(assessSettlement(q).status,'CONDITIONAL');}
});
