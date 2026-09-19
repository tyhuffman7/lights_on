import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {PolyEventContexts} from '../lib/arb/poly-event-context.ts';import {normalizePoly} from '../lib/arb/adapters.ts';import {identity} from '../lib/research/identity.ts';import {matchCandidates} from '../lib/research/matching.ts';
const f=JSON.parse(readFileSync(new URL('./fixtures/challenger-context.json',import.meta.url),'utf8'));
const a={...f.a,identity:identity('kalshi',{ticker:f.a.id,yes_sub_title:f.a.outcome,category:f.a.category,title:f.a.title,rules_primary:f.a.rules},{})};
async function candidate(event=f.event,market=f.event.markets[0]){const contexts=new PolyEventContexts(async()=>({event}));return matchCandidates([a],[await normalizePoly(await contexts.enrich(market))]);}
test('Captured Challenger match recovers an unreviewed inverted candidate without a fabricated date',async()=>{
 assert.equal((await matchCandidates([a],[await normalizePoly(f.event.markets[0])])).length,0);
 const c=await candidate();assert.equal(c.length,1);assert.equal(c[0].status,'UNVERIFIED');assert.equal(c[0].pair.reviewed,false);assert.equal(c[0].pair.inverted,true);assert.equal(c[0].pair.a.identity?.eventDate,undefined);assert.equal(c[0].pair.a.identity?.eventAt,undefined);
});
test('Wrong tournament, round, year and player membership cannot reuse Challenger context',async()=>{
 for(const change of [(e:any)=>e.eventState.tennisState.round='Round of 16',(e:any)=>e.eventState.tennisState.tournamentName='Challenger Phan Thiet 3',(e:any)=>e.seriesSlug='atp-2025',(e:any)=>e.teams[0].id=99999,(e:any)=>e.eventState.eventId=99999]){const e=structuredClone(f.event);change(e);assert.equal((await candidate(e)).length,0);}
});
test('Missing or mismatched parent schedule and market membership remain unmatched',async()=>{
 for(const change of [(e:any)=>e.markets[0].id='different',(e:any)=>e.startTime='2026-09-16T05:20:00Z',(e:any)=>delete e.eventState.tennisState.round,(e:any)=>e.slug='different']){const e=structuredClone(f.event);change(e);assert.equal((await candidate(e,f.event.markets[0])).length,0);}
 const contexts=new PolyEventContexts(async()=>{throw Error('unavailable');});const raw=f.event.markets[0];assert.deepEqual(await contexts.enrich(raw),raw);
});
