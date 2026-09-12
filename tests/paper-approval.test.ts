import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {assessSettlement} from '../lib/research/settlement-validation.ts';
import {createPaperApproval,validPaperApproval,paperFingerprint} from '../lib/arb/paper-approval.ts';
import {PaperStore} from '../worker/paper-store.ts';
import {PaperBot} from '../worker/paper-bot.ts';
import {isVerified} from '../lib/research/mappings.ts';
import {CapacityScheduler} from '../lib/research/capacity.ts';
import {book} from './research-fixture.ts';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/settlement-pairs.json',import.meta.url),'utf8'));
function pair(index=0){const p=structuredClone(fixtures[index]);p.a.closeAt=p.b.closeAt=new Date(Date.now()+86400000).toISOString();return p;}
test('Observed football templates identify ordinary match without certifying exceptional payouts',()=>{
 for(const p of fixtures){const r=assessSettlement(p);assert.equal(r.status,'CONDITIONAL');assert.equal(r.strictEquivalent,false);assert.ok(r.risks.length);}
 const wrong=pair();wrong.inverted=!wrong.inverted;assert.equal(assessSettlement(wrong).status,'CONFLICT');
 const prose=pair();prose.a.rules=prose.a.rules.replace('If Notre Dame wins','If Rice wins');assert.equal(assessSettlement(prose).status,'CONFLICT');
 const otherDay=pair();otherDay.b.identity.eventDate='2030-01-01';assert.equal(assessSettlement(otherDay).status,'CONFLICT');
 const threshold=pair(1);threshold.b.rules=threshold.b.rules.replace('at least 150','at least 151');assert.equal(assessSettlement(threshold).status,'CONFLICT');
 const missing=pair();delete missing.b.identity.eventDate;assert.notEqual(assessSettlement(missing).status,'CONDITIONAL');
});
test('Paper approvals expire and bind full metadata, orientation, IDs, and scope',()=>{
 const p=pair(),now=Date.now(),a=createPaperApproval(p,'Test only',now);assert.ok(validPaperApproval(a,p,now));
 assert.equal(validPaperApproval(a,p,a.expiresAt),false);assert.equal(validPaperApproval({...a,scope:'live'},p,now),false);
 for(const mutate of [p=>p.inverted=!p.inverted,p=>p.a.rules+=' Updated rule.',p=>p.b.id+='x',p=>p.a.identity.period='first half',p=>p.b.feeRate=999]){const changed=structuredClone(p);mutate(changed);assert.equal(validPaperApproval(a,changed,now),false);}
});
async function run(approved:boolean,changeDuringHedge=false){
 const p=pair(),m={id:p.id,pair:p,status:'UNVERIFIED',active:true};
 const store=new PaperStore(join(mkdtempSync(join(tmpdir(),'conditional-paper-')),'paper.sqlite'));
 const books=new Map([['kalshi:'+p.a.id,{...book('kalshi',p.a.id),source:'stream'}],['poly:'+p.b.id,{...book('poly',p.b.id),source:'stream'}]]);
 // Fixture prices deliberately offer an inverted-pair edge; these are not exchange fills.
 books.get('poly:'+p.b.id).yes=[{price:4000,quantity:100}];
 const bot=new PaperBot(store,{mapping:()=>m,book:(v,id)=>books.get(v+':'+id),healthy:()=>true,ready:()=>true,barrier:async()=>{}},'live-data',async()=>{if(changeDuringHedge)p.b.rules+=' Changed while hedging.';});
 try{
  if(approved)bot.document.approvals={[p.id]:createPaperApproval(p,'Synthetic protocol test, not actual-market evidence')};
  bot.notify(p.id);await bot.task;
  assert.equal(isVerified(m),false,'paper approval must never verify shared registry');
  const positions=store.read().state.positions;
  if(!approved){assert.equal(positions.length,0);assert.ok(bot.document.counts['Settlement mapping unapproved']);}
  else{assert.equal(positions.length,1);assert.equal(positions[0].pair.paperApproval.scope,'conditional-paper-only');assert.ok(positions[0].pair.paperApproval.risks.length);assert.equal(positions[0].status,changeDuringHedge?'settled':'open');if(changeDuringHedge){assert.ok(positions[0].profit<0);assert.ok(bot.document.halt);}}
 }finally{await bot.stop();store.close();}
}
test('Conditional paper entry requires explicit approval and preserves risk evidence',async()=>{await run(false);await run(true);});
test('Changed conditional metadata during hedge prevents second leg and triggers modeled unwind',async()=>{await run(true,true);});
test('Paper priority gets subscription capacity without marking registry verified',()=>{
 const p=pair(),other=pair(1);const mappings=[{id:other.id,pair:other,status:'UNVERIFIED',active:true},{id:p.id,pair:p,status:'UNVERIFIED',active:true}];
 const c=new CapacityScheduler();const r=c.select(mappings,1,.2,900000,Date.now(),{},new Set([p.id]));assert.deepEqual(r.selectedIds,[p.id]);assert.equal(mappings.some(isVerified),false);
});

test('Conditional approval survives a ledger restart but expired approval cannot enter',async()=>{
 const p=pair(),path=join(mkdtempSync(join(tmpdir(),'approval-restart-')),'paper.sqlite');let store=new PaperStore(path);const d=store.load('live-data');
 d.approvals={[p.id]:createPaperApproval(p,'Restart protocol test')};store.save(d);store.close();store=new PaperStore(path);
 try{assert.ok(validPaperApproval(store.read().approvals[p.id],p));const expired={...store.read().approvals[p.id],expiresAt:Date.now()-1};assert.equal(validPaperApproval(expired,p),false);assert.equal(store.read().state.positions.length,0);}finally{store.close();}
});

test('Individual NFL refresh and catalog identities yield the same paper approval fingerprint',()=>{
 const p=pair(1),fresh=structuredClone(p);fresh.a.identity.participants=['buffalo','houston'];fresh.b.identity.participants=['buffalo bills','houston texans'];
 assert.equal(assessSettlement(fresh).status,'CONDITIONAL');assert.equal(paperFingerprint(fresh),paperFingerprint(p));
 const wrong=structuredClone(fresh);wrong.b.identity.participants=['buffalo bills','tennessee titans'];assert.equal(assessSettlement(wrong).status,'CONFLICT');
});
test('Paper horizon excludes distant pairs without removing them from research selection',()=>{
 const near=pair(),far=pair(1),now=Date.now(),deadline=now+30*86400000;
 far.b.closeAt=new Date(now+60*86400000).toISOString();
 const mappings=[{id:near.id,pair:near,status:'UNVERIFIED',active:true},{id:far.id,pair:far,status:'MANUAL_VERIFIED',active:true}];
 const c=new CapacityScheduler();const research=c.select(mappings,1,0,900000,now);assert.deepEqual(research.selectedIds,[far.id]);
 const paper=c.select(mappings,1,0,900000,now,{},new Set(),deadline);assert.deepEqual(paper.selectedIds,[near.id]);assert.equal(paper.excludedByPaperHorizon,1);assert.equal(paper.paperSettlementDeadline,deadline);
 const expired=c.select(mappings,1,0,900000,now,{},new Set(),now-1);assert.equal(expired.selected,0);
});

test('NFL rule prose must agree with the game date, teams and statistic metadata',()=>{
 for(const venue of ['a','b']){
  for(const [from,to] of [['Sep 13, 2026','Sep 14, 2026'],['Buffalo','Miami'],['passing yards','rushing yards']]){
   const p=pair(1);p[venue].rules=p[venue].rules.replace(from,to);
   assert.equal(assessSettlement(p).status,'CONFLICT',venue+': '+from);
   assert.throws(()=>createPaperApproval(p,'Contradictory rules must never be approved'));
  }
 }
 const both=pair(1);both.a.rules=both.a.rules.replace('passing yards','rushing yards');both.b.rules=both.b.rules.replace('passing yards','rushing yards');
 assert.equal(assessSettlement(both).status,'CONFLICT','agreement between prose still must agree with metadata');
 const aliases=pair(1);aliases.a.rules=aliases.a.rules.replace('Buffalo vs Houston','Bills vs Texans');
 assert.equal(assessSettlement(aliases).status,'CONDITIONAL','league aliases remain supported');
});
