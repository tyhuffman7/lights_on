// Exercises real HTTP routes and isolated local D1, with production fees/execution/accounting.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:5174';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw Error('Local demo only');
const restart=process.argv.includes('--restart');
const report=restart?JSON.parse(readFileSync(JSON.parse(readFileSync('work/paper-checkpoint/http-latest.json','utf8')).path,'utf8')):{provenance:'SYNTHETIC ONLY; no actual market approval, orders, fills or profit',run:crypto.randomUUID(),cases:{}};
const reportPath=`work/paper-checkpoint/http-${report.run}.json`;
async function req(scenario,path,body,settled=false){
 const r=await fetch(`${base}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{
  Cookie:`__sites_local_auth=1; paper-case=${scenario}-${report.run}; paper-settled=${settled?1:0}`,
  'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json();return {status:r.status,data};
}
async function ok(...args){const r=await req(...args);assert.equal(r.status,200,JSON.stringify(r));return r.data;}
const balances={kalshi:500000,poly:500000};
if(restart){
 for(const scenario of Object.keys(report.cases)){
  const s=await ok(scenario,'state');
  assert.deepEqual(s,report.cases[scenario].final);
 }
 const s=await ok('eligible','run',{settleOnly:true},true);
 assert.deepEqual(s.cash,report.cases.eligible.final.cash);assert.equal(s.positions.length,1);assert.equal(s.positions[0].profit,4800);
 report.restartVerifiedAt=new Date().toISOString();
}else{
 const unauth=await fetch(base+'/api/state');assert.equal(unauth.status,401);
 const crossOrigin=await fetch(base+'/api/state',{method:'POST',headers:{Cookie:'__sites_local_auth=1',Origin:'https://wrong.example','Content-Type':'application/json'},body:JSON.stringify({action:'start'})});
 assert.ok([400,403].includes(crossOrigin.status),'Cross-origin request must be rejected');
 assert.equal((await req('eligible','discover')).status,400);
 for(const scenario of ['eligible','no-edge','unwind','unmatched']){
  const initial=await ok(scenario,'state');assert.equal(initial.provenance,'synthetic');assert.deepEqual(initial.cash,balances);
  await ok(scenario,'state',{action:'start'});
  let s;
  if(scenario==='eligible'){
   const racing=await Promise.all([req(scenario,'run',{}),req(scenario,'run',{})]);
   assert.equal(racing.filter(r=>r.status===200).length,1);
   assert.equal(racing.filter(r=>r.status===400).length,1);
   s=racing.find(r=>r.status===200).data;
  }else s=await ok(scenario,'run',{});
  if(scenario==='eligible'){
   const p=s.positions[0];assert.equal(p.status,'open');assert.equal(p.quote.quantity,10);
   assert.equal(p.quote.aFill.fees,1700);assert.equal(p.quote.bFill.fees,1500);
   assert.equal(p.aDebit,42700);assert.equal(p.bDebit,52500);
   assert.deepEqual(s.cash,{kalshi:457300,poly:447500});assert.equal(p.profit,undefined);
   assert.equal(p.quote.profit,4800);
  }else if(scenario==='no-edge'){
   assert.deepEqual(s.cash,balances);assert.equal(s.positions.length,0);
   assert.ok(s.logs.some(l=>l.kind==='entry rejected'&&l.message.includes('Net edge below threshold')));
  }else if(scenario==='unwind'){
   const p=s.positions[0];assert.equal(p.status,'settled');assert.equal(p.profit,-6400);
   assert.equal(p.bDebit,0);assert.deepEqual(s.cash,{kalshi:493600,poly:500000});
  }else{
   assert.equal(s.positions[0].status,'unmatched');assert.equal(s.positions[0].aDebit,42700);
   assert.deepEqual(s.cash,{kalshi:457300,poly:500000});
  }
  const duplicate=await req(scenario,'run',{});assert.equal(duplicate.status,400);assert.match(duplicate.data.error,/30 seconds/);
  assert.deepEqual(await ok(scenario,'state'),s);
  const scan=await ok(scenario,'scan');assert.equal(scan.rows.length,1);assert.ok(scan.rows[0].pair.a.title.startsWith('SYNTHETIC'));
  report.cases[scenario]={afterEntry:s};
 }
 console.log('HTTP entry, concurrency, rejection, unwind, unmatched exposure, authentication, origin checks, cooldown and retrieval passed. Waiting for unchanged production cooldown.');
 await new Promise(r=>setTimeout(r,31000));
 const settled=await ok('eligible','run',{settleOnly:true},true);
 assert.equal(settled.positions[0].profit,4800);assert.equal(settled.positions[0].status,'settled');
 assert.deepEqual(settled.cash,{kalshi:557300,poly:447500});
 const blocked=await ok('unmatched','run',{});
 assert.equal(blocked.positions.length,1);assert.equal(blocked.positions[0].status,'unmatched');
 assert.deepEqual(blocked.cash,{kalshi:457300,poly:500000});assert.equal(blocked.logs[0].kind,'paused');
 for(const scenario of Object.keys(report.cases))report.cases[scenario].final=await ok(scenario,'state');
 report.completedAt=new Date().toISOString();
}
mkdirSync('work/paper-checkpoint',{recursive:true});writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
writeFileSync('work/paper-checkpoint/http-latest.json',JSON.stringify({path:reportPath})+'\n');
console.log(restart?'Restart retrieval and once-only settlement passed.':'HTTP fixture checkpoint passed; restart server and run with --restart.');
console.log(JSON.stringify({run:report.run,report:reportPath}));
