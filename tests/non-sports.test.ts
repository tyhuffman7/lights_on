import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {market} from './research-fixture.ts';
import {nonSportsTemplate,nonSportsFamily,publicDate} from '../lib/research/non-sports.ts';
import {canonicalTemplateConflict,canonicalTemplateKey} from '../lib/research/canonical-template.ts';
import {discoverCandidates} from '../lib/research/matching.ts';
const f=JSON.parse(readFileSync(new URL('./fixtures/non-sports-template-markets.json',import.meta.url),'utf8'));
const pair=(r:any)=>[r.kalshi,r.poly].map(m=>({...market(m.venue,m.id),...m}));
for(const r of f.rows)test(`Native-US ${r.stratum} admits only an unverified review route`,()=>{
 const [a,b]=pair(r),ta=nonSportsTemplate(a)!,tb=nonSportsTemplate(b)!;
 assert.ok(ta);assert.ok(tb);assert.equal(canonicalTemplateKey(ta),canonicalTemplateKey(tb));
 const cs=discoverCandidates([a],[b]).candidates;assert.equal(cs.length,1);assert.equal(cs[0].status,'UNVERIFIED');assert.equal(cs[0].pair.reviewed,false);
 assert.equal(cs[0].structured.a.resolutionSource,undefined);
});
test('Canonical review identity retains every known dimension, including creator and orientation',()=>{
 for(const r of f.rows){const [a,b]=pair(r),t=nonSportsTemplate(a)!,u=nonSportsTemplate(b)!;
  for(const k of ['subject','domain','family','metric','geography','period','threshold','outcome'] as const)assert.ok(canonicalTemplateConflict(t,{...u,[k]:'different'}),r.stratum+':'+k);
  assert.equal(canonicalTemplateConflict({...t,creator:'artist a'},{...u,creator:'artist b'}),'creator');
  assert.equal(nonSportsTemplate({...b,outcome:'No'}),undefined);
 }
});
test('Spotify annual geography/rank/basis are independent; source-free shorthand stays unknown',()=>{
 const [a,b]=pair(f.rows.find((r:any)=>r.stratum.includes('annual-chart-ranking:spotify:artist:us')));
 for(const rules of [b.rules.replace('in the US','globally'),b.rules.replace('2026','2027')])assert.equal(discoverCandidates([a],[{...b,rules}]).candidates.length,0);
 assert.equal(nonSportsTemplate({...b,rules:b.rules.split('\n')[0]}),undefined);
 assert.equal(nonSportsTemplate({...a,rules:a.rules.replace('#1','#2')})?.threshold,'2');
 const legacy={...a,series:'KXTOPARTIST',rules:'If Someone is the most streamed Spotify artist in 2026, then the market resolves to Yes.'};
 assert.equal(nonSportsTemplate(legacy),undefined);
});
test('Reality season, exact-place, top-N and elimination never collapse',()=>{
 const [a,b]=pair(f.rows.find((r:any)=>r.stratum.includes('reality-placement')));
 assert.equal(discoverCandidates([a],[{...b,rules:b.rules.replace(/season \d+/i,'season 999')}]).candidates.length,0);
 const base={...a,rules:'If Jane finishes in the Top 3 on Dancing with the Stars Season 35, then the market resolves to Yes.'};
 const top=nonSportsTemplate(base)!,third=nonSportsTemplate({...base,rules:base.rules.replace('in the Top 3 on','3rd in')})!;
 assert.equal(top.metric,'top-n');assert.equal(third.metric,'exact-place');assert.ok(canonicalTemplateConflict(top,third));
 assert.equal(nonSportsTemplate({...base,rules:'If Jane is officially eliminated from Dancing with the Stars Season 35 before Sep 23, 2026, then the market resolves to Yes.'}),undefined);
});
test('Awards retain ceremony/version/category and winner versus nomination',()=>{
 const [a,b]=pair(f.rows.find((r:any)=>r.stratum.includes('ceremony-award:99th')));
 for(const rules of [b.rules.replace('99th','100th'),b.rules.replace('Best Picture','Best Actor')])assert.equal(discoverCandidates([a],[{...b,rules}]).candidates.length,0);
 assert.equal(nonSportsTemplate({...b,rules:b.rules.replace('wins','is nominated for')}),undefined);
});
test('Business deadlines normalize calendar days without claiming time-zone or jurisdiction equivalence',()=>{
 const [a,b]=pair(f.rows.find((r:any)=>r.stratum.includes('business-deadline')));
 assert.equal(nonSportsTemplate(a)?.period,nonSportsTemplate(b)?.period);
 assert.equal(nonSportsTemplate({...a,rules:a.rules.replace('Jan 1, 2027','Jan 2, 2027')})?.period,'2027-01-01');
 assert.equal(publicDate('Feb 30, 2026'),undefined);assert.equal(publicDate('Smarch 1, 2026'),undefined);
});
test('Classification separates company Netflix mentions and Spotify work titles from Netflix charts',()=>{
 const m=market('kalshi');assert.equal(nonSportsFamily({...m,category:'Entertainment',title:'Netflix & Chill Spotify',rules:'If Netflix & Chill is the #1 most streamed Song on Spotify Wrapped chart'}),'spotify');
 assert.equal(nonSportsFamily({...m,category:'Companies',title:'Netflix revenue',rules:'If Netflix reports revenue above 40 billion'}),'companies-business');
});
test('Award work-to-artist links preserve subjects and never erase category, credit or ceremony',()=>{
 const a={...market('kalshi'),category:'Entertainment',title:'Taylor Swift Best Visual Effects',rules:'If Taylor Swift wins Best Visual Effects at the 2026 MTV Video Music Awards, then the market resolves to Yes.'};
 const b={...market('poly'),category:'culture',title:'The Fate of Ophelia by Taylor Swift Best Visual Effects',rules:'This market will settle to Yes if The Fate of Ophelia by Taylor Swift wins Best Visual Effects at the 2026 MTV Video Music Awards. Outcome sourced from MTV.'};
 const cs=discoverCandidates([a],[b]).candidates;assert.equal(cs.length,1);assert.equal(cs[0].status,'UNVERIFIED');assert.match(cs[0].reasons[0],/subjects remain distinct/);
 assert.equal(nonSportsTemplate(b)?.subject,'the fate of ophelia');assert.equal(nonSportsTemplate(b)?.creator,'taylor swift');
 for(const rules of [b.rules.replace('Taylor Swift','Someone Else'),b.rules.replace('2026','2027'),b.rules.replace('Best Visual Effects','Artist of the Year')])assert.equal(discoverCandidates([a],[{...b,rules}]).candidates.length,0);
});
