import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paperSettlement} from '../lib/research/hot-confirmation.ts';
import {recallMatches,type RecallRoute} from '../lib/research/recall-detector.ts';
import {comparePropositions} from '../lib/research/proposition.ts';
import {promotionCertificate} from '../lib/research/promotion-certificate.ts';
const retained=JSON.parse(readFileSync(new URL('./fixtures/semantic-difference-retained.json',import.meta.url),'utf8'));
const seed=()=>structuredClone(retained.find((r:any)=>r.reference==='ORDINARY_EQUIVALENT_BASIS_RISK').route) as RecallRoute;
function native(a:string,b:string){const r=seed();r.matchSource='TEXT';r.warnings=[];r.pair.inverted=false;
 for(const [m,s] of [[r.pair.a,a],[r.pair.b,b]] as const){m.rules=s;m.title=s;m.identity=undefined;m.series=undefined;m.propositionContext=undefined;}return r;}
for(const [a,b] of [['goals','assists'],['goals','shots'],['passing yards','passing attempts'],['passing yards','passing touchdowns'],['receptions','receiving yards']])test(`unseen leader metric conflict ${a}/${b}`,()=>{
 const r=native(`If New Player leads the 2027 Champions League in ${a} for the tournament, then the market resolves to Yes.`,`This market will settle to Yes if New Player leads the 2027 Champions League in ${b} for the tournament.`);
 const c=paperSettlement(r);assert.equal(c.classification,'DIFFERENT_QUESTION');assert.ok(c.certificate.conflicts.some(x=>x.startsWith('metric:')));
 assert.equal(c.proposition.a.dimensions.family,'statistic-leader');assert.equal(c.proposition.b.dimensions.family,'statistic-leader');
});
for(const metric of ['unrecognized scoring statistic','goals and assists'])test('uncertain leader cannot turn competition into championship: '+metric,()=>{
 const r=native(`If New Player leads the 2027 Champions League in ${metric} for the tournament, then the market resolves to Yes.`,`This market will settle to Yes if New Player leads the 2027 Champions League in ${metric} for the tournament.`);
 const c=paperSettlement(r);assert.equal(c.classification,'UNRESOLVED');assert.ok(c.certificate.missing.includes('Missing metric'));assert.equal(c.certificate.family,'statistic-leader');
});
test('retained goals/assists false promotions now conflict without ID exclusions',()=>{
 const doc=JSON.parse(readFileSync(new URL('../docs/research/semantic-difference/promoted-audit.json',import.meta.url),'utf8'));
 for(const row of doc.candidates.filter((r:any)=>r.referenceReview.classification==='DIFFERENT_QUESTION')){
  const r=structuredClone(row.quote.route);for(const m of [r.pair.a,r.pair.b])m.id='unknown';r.pair.id='unknown';
  assert.equal(paperSettlement(r).classification,'DIFFERENT_QUESTION');
 }
});
test('every retained basis promotion has complete native evidence and no strict inference',()=>{
 for(const r of retained.filter((r:any)=>r.reference==='ORDINARY_EQUIVALENT_BASIS_RISK')){
  const c=paperSettlement(r.route);assert.equal(c.classification,'ORDINARY_EQUIVALENT_BASIS_RISK');assert.equal(c.certificate.decision,c.classification);
  assert.equal(c.certificate.missing.length,0);assert.ok(c.certificate.exceptionalSettlementBranches.length);
  for(const d of c.certificate.dimensions){assert.equal(d.status,'EQUAL');assert.ok(d.left.evidence);assert.ok(d.right.evidence);assert.ok(d.rule);}
  assert.equal(c.certificate.strictEquivalent,false);
 }
});
test('any missing required positive evidence blocks promotion even with equal values',()=>{
 const r=seed(),p=comparePropositions(r.pair),original=promotionCertificate(r.pair,p,null);
 for(const dimension of original.requiredDimensions.filter(d=>d!=='orientation')){
  const q=structuredClone(p);delete q.b.evidence[dimension];
  const c=promotionCertificate(r.pair,q,null);assert.equal(c.decision,'UNRESOLVED');assert.ok(c.missing.includes('Missing '+dimension));
 }
});
test('same competition is insufficient when the season, player or period differs',()=>{
 const a='If New Player leads Pro Football in passing yards for the 2027 regular season, then the market resolves to Yes.';
 for(const b of [a.replace('New Player','Other Player'),a.replace('2027','2028'),a.replace('regular season','postseason')])assert.equal(paperSettlement(native(a,b)).classification,'DIFFERENT_QUESTION');
});
test('native matching leader stays unresolved when counted scope is missing',()=>{
 const doc=JSON.parse(readFileSync(new URL('../docs/research/semantic-difference/promoted-audit.json',import.meta.url),'utf8'));
 const r=structuredClone(doc.candidates[0].quote.route);r.pair.b.rules=r.pair.b.rules.replaceAll('assists','goals');
 const c=paperSettlement(r);assert.equal(c.classification,'UNRESOLVED');assert.ok(c.certificate.missing.includes('Missing settlementScope'));
});
test('conference and national champion cannot share a certificate',()=>{
 const c=paperSettlement(native('If New Team wins the 2027 College Football American Athletic Conference Championship Game, then the market resolves to Yes.','This market will settle to Yes if New Team wins the 2027 College Football National Championship Game.'));
 assert.equal(c.classification,'DIFFERENT_QUESTION');assert.ok(c.certificate.conflicts.some(x=>x.startsWith('stage:')));
});
test('exact calendar deadline cannot be certified from date-only canonical normalization',()=>{
 const c=paperSettlement(native('If xAI releases Grok 5 before Jan 1, 2027, then the market resolves to Yes.','This market will settle to Yes if xAI releases Grok 5 by December 31, 2026, 11:59 PM ET.'));
 assert.equal(c.classification,'UNRESOLVED');assert.ok(c.certificate.missing.includes('Missing windowEnd'));
});
