// Run against a local preview only. Uses an isolated development user; never production.
import assert from 'node:assert/strict';
const base=process.env.TEST_ORIGIN||'http://localhost:5173';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw new Error('Local preview only');
const id='integration-'+crypto.randomUUID();
const headers={'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@sites.test','Content-Type':'application/json'};
async function req(path,body){const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
const first=await req('state');assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.data.cash.kalshi,500000);
const start=await req('state',{action:'start'});assert.equal(start.status,200);assert.ok(start.data.startedAt);
const invalid=await req('state',{action:'expense',amount:-100});assert.equal(invalid.status,400);
const spend=await req('state',{action:'expense',amount:2000});assert.equal(spend.status,200);assert.equal(spend.data.cash.kalshi,498000);
const again=await req('state');assert.equal(again.data.expenses,2000);assert.equal(again.data.cash.kalshi,498000);
const concurrent=await Promise.all([req('state',{action:'expense',amount:1000}),req('state',{action:'expense',amount:1000})]);
const successes=concurrent.filter(x=>x.status===200).length;assert.ok(successes>=1);
const final=await req('state');assert.equal(final.data.cash.kalshi,498000-successes*1000);
const cycle=await req('run',{});assert.equal(cycle.status,200,JSON.stringify(cycle));assert.equal(cycle.data.positions.length,0);assert.ok(cycle.data.logs.some(x=>x.message==='No qualifying entry. Cash preserved.'));
const duplicate=await req('run',{});assert.equal(duplicate.status,400);assert.match(duplicate.data.error,/30 seconds/);
const noauth=await fetch(base+'/api/state');assert.equal(noauth.status,401);
const csrf=await fetch(base+'/api/state',{method:'POST',headers:{...headers,Origin:'https://wrong.example'},body:JSON.stringify({action:'start'})});assert.equal(csrf.status,400);
console.log('HTTP smoke passed: isolated ledger, persistence, rejected input, concurrent writes, no-op cycle, cooldown, authentication, origin check.');
console.log('Local test user:',id);
