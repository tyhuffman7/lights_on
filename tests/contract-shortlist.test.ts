import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {matchCandidates} from '../lib/research/matching.ts';
import {catalogEntities} from '../lib/research/entities.ts';
import {spotifyGeography, israeliOffice, israeliSuccession, awardCeremony,
  repeatElectionTreatment, bestRecordTieTreatment} from '../lib/research/identity.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const inputs = read('../docs/research/contract-shortlist/retained-markets.json');
const summary = read('../docs/research/depth-discovery/summary.json');
const rows = summary.ranked.filter((r: any) => r.confirmation?.status === 'EDGE_SURVIVED');
// Original earlier public team aliases are necessary to reproduce the collapse.
// Closed inputs supply aliases but cannot themselves become price candidates.
const poly = [...inputs.aliasContext.map((m: any) => ({...m, open: false})), ...inputs.poly];
const matches = new Map(matchCandidates(inputs.kalshi, poly).map(c => [c.pair.id, c]));
const excluded = new Set([1,2,3,4,5,6,8,9,11,12,18,20,21,22,40,49]);

for (const [i, row] of rows.entries()) {
  test(`Retained comparison ${i + 1}: ${excluded.has(i + 1) ? 'reject contradiction' : 'preserve unverified route'}`, () => {
    const candidate = matches.get(row.quote.pairId);
    assert.equal(!!candidate, !excluded.has(i + 1), row.key);
    if (candidate) {
      assert.equal(candidate.status, 'UNVERIFIED');
      assert.equal(candidate.pair.reviewed, false);
      assert.equal(candidate.pair.inverted, false);
    }
  });
}

test('Kansas and Kansas State remain distinct in either catalogue order; both valid routes survive', () => {
  const ks = inputs.kalshi.filter((m: any) => /KXNCAAFB12QUAL-26-(KSU|KU)$/.test(m.id));
  const ps = inputs.poly.filter((m: any) => /champq-(kan|kanst)$/.test(m.id));
  for (const order of [ps, [...ps].reverse()]) {
    const ids = new Set(matchCandidates(ks, order).map(c => c.pair.id));
    assert.deepEqual(ids, new Set([
      'KXNCAAFB12QUAL-26-KSU::aqc-cfb-big12-2026-12-04-champq-kanst',
      'KXNCAAFB12QUAL-26-KU::aqc-cfb-big12-2026-12-04-champq-kan',
    ]));
  }
});

test('College State and Tech suffixes are preserved with aliases and without neighbours', () => {
  for (const suffix of ['State', 'Tech']) {
    const make = (name: string): any => ({sports:true,competition:'cfb',participants:[name],
      aliases:[{name,venue:'poly',venueId:name,aliases:[]}]});
    const named = make(`Test ${suffix}`), bare = make('Test');
    const alone = catalogEntities([named]);
    assert.equal(alone.resolve('Test','cfb'), undefined);
    for (const order of [[named,bare], [bare,named]]) {
      const registry = catalogEntities(order);
      assert.notEqual(registry.resolve('Test','cfb'), registry.resolve(`Test ${suffix}`,'cfb'));
      if (suffix === 'State') assert.equal(registry.resolve('Test St.','cfb'), registry.resolve('Test State','cfb'));
    }
  }
});

test('Changing the evidenced conflicting predicates to the same terms preserves valid routes', () => {
  for (const rank of [1,3,6,9,11,21,49]) {
    const row = rows[rank - 1];
    const a = inputs.kalshi.find((m: any) => m.id === row.kalshiId);
    const b = inputs.poly.find((m: any) => m.id === row.polyId);
    const aligned = {...a,rules:b.rules,title:b.title,outcome:b.outcome,identity:b.identity};
    const result = matchCandidates([aligned], [b]);
    assert.equal(result.length, 1, row.key);
    assert.equal(result[0].status, 'UNVERIFIED');
  }
});

test('Unknown terms and later illustrative text cannot invent a primary predicate conflict', () => {
  for (const hint of [israeliOffice,israeliSuccession,awardCeremony,repeatElectionTreatment,bestRecordTieTreatment]) {
    assert.equal(hint('Terms unavailable.'), undefined);
  }
  assert.equal(awardCeremony('Unknown payout.\nExample: at the 69th Annual Grammy Awards'), undefined);
  assert.equal(israeliOffice('Unknown payout.\nThe first Minister of Defense to take office in the first new Israeli government'), undefined);
  const rules = 'If Example is the most streamed Spotify artist in 2026, then the market resolves to Yes.';
  assert.equal(spotifyGeography({venue:'poly', rules}), undefined);
  assert.equal(spotifyGeography({venue:'kalshi', series:'KXOTHER', rules:rules+'\nhttps://assets.kalshi.com/contract_terms/TOPARTIST.pdf'}), undefined);
  assert.equal(spotifyGeography({venue:'kalshi', series:'KXTOPARTIST', rules}), undefined);
  const row = rows[0], a = inputs.kalshi.find((m: any) => m.id === row.kalshiId);
  const b = inputs.poly.find((m: any) => m.id === row.polyId);
  const result = matchCandidates([{...a,rules:'Terms unavailable.'}], [b]);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'UNVERIFIED');
});

test('Conflicting exception statements remain unknown, never a fabricated treatment', () => {
  const government = inputs.kalshi.find((m: any) => m.id === 'KXISRAELPM-26OCT27-NBEN');
  const pm = inputs.poly.find((m: any) => m.id.endsWith('pm-2026-10-27-nafben'));
  assert.equal(repeatElectionTreatment(government.rules+'\n'+pm.rules), undefined);
  const nba = inputs.kalshi.find((m: any) => m.id === 'KXNBARECORD-27BEST-OKC');
  const nbaPm = inputs.poly.find((m: any) => m.id.endsWith('bestrecord-okc'));
  assert.equal(bestRecordTieTreatment(nba.rules+'\n'+nbaPm.rules), undefined);
});

test('Published screen covers exactly the original 50 and agrees with the matching path', () => {
  const review = read('../docs/research/contract-shortlist/review.json');
  assert.equal(review.rows.length, 50);
  assert.equal(new Set(review.rows.map((r: any) => r.pairId)).size, 50);
  const counts: Record<string, number> = {};
  for (const [i, row] of review.rows.entries()) {
    assert.equal(row.pairId, rows[i].quote.pairId);
    assert.deepEqual(row.sides, {kalshi:rows[i].quote.aSide, poly:rows[i].quote.bSide});
    assert.equal(row.matcherAfter === 'UNVERIFIED', matches.has(row.pairId));
    counts[row.identityScreen] = (counts[row.identityScreen] ?? 0) + 1;
  }
  assert.deepEqual(counts, {IDENTITY_CONFLICT:11, STRUCTURALLY_PLAUSIBLE:36, INSUFFICIENT_EVIDENCE:3});
  const bytes = readFileSync(new URL('../docs/research/depth-discovery/summary.json', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), review.discoverySummarySha256);
  for (const inherited of summary.triage) {
    assert.equal(review.rows.find((r: any) => r.pairId === inherited.pairId).settlementClassification, 'INCOMPATIBLE');
  }
});

test('Shortlist copies exact confirmations without changing quantities, fees, reserves or admission', () => {
  const review = read('../docs/research/contract-shortlist/review.json');
  assert.equal(review.deepReviews.length, 5);
  for (const d of review.deepReviews) {
    const r = rows.find((r: any) => r.quote.pairId === d.pairId);
    assert.ok(r);
    assert.equal(d.confirmedAt, new Date(r.quote.at).toISOString());
    assert.equal(d.quantity, r.quote.quantity);
    assert.equal(d.kalshiSide, r.quote.aSide);
    assert.equal(d.polySide, r.quote.bSide);
    assert.deepEqual(d.economics, r.quote.economics);
    assert.deepEqual(d.bookConfirmation, r.confirmation.bookConfirmation);
    assert.deepEqual(d.confirmationWindow, r.confirmation.window);
    assert.deepEqual(d.marketStatus, r.confirmation.marketStatus);
    assert.deepEqual(d.historicalBaselineAdmission, r.quote.additionalPolicyAdmission);
    assert.equal(d.economics.feeBoundSurplus, d.quantity * 10000 - d.economics.cost - d.economics.feeBound);
    assert.equal(d.paperExecutionReady, false);
  }
});
