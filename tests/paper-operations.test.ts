import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {generateKeyPairSync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {ResearchStore} from '../lib/research/store.ts';
import {MappingRegistry} from '../lib/research/mappings.ts';
import {Observer} from '../worker/observer.ts';
import {configSchema} from '../worker/config.ts';
import {pair} from './research-fixture.ts';
test('Startup persists rejection of old mismatched candidates before subscriptions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'paper-restore-')),path=join(dir,'research.sqlite');
 let store=new ResearchStore(path);const registry=new MappingRegistry(store);
 const bad=pair('bad');bad.a.title='Will Coventry City be relegated from English Premier League in 2026-27 Season?';bad.b.title='Coventry City English Premier League Champion';
 registry.add(bad);registry.add(pair('reviewed'));registry.verify('reviewed','MANUAL_VERIFIED','Fixture review');store.close();
 store=new ResearchStore(path);const observer=new Observer(store,configSchema.parse({database:path,discoveryEnabled:false}));
 try{await observer.initialize();assert.equal(observer.registry.get('bad')?.active,false);assert.equal(observer.registry.get('bad')?.reason,'CANDIDATE_NO_LONGER_MATCHES');assert.equal(observer.registry.get('reviewed')?.active,true);
 const persisted=JSON.parse(String(store.db.prepare('SELECT body FROM mappings WHERE id=?').get('bad')?.body));assert.equal(persisted.active,false);
 }finally{await observer.stop();store.close();}
});
test('Paper CLI repeated shutdown signals flush session and release both leases', {timeout:15000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'paper-shutdown-')),research=join(dir,'research.sqlite'),paper=join(dir,'paper.sqlite'),config=join(dir,'config.json');
 writeFileSync(config,JSON.stringify({database:research,discoveryEnabled:false,markets:[]}));
 const key=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'}).toString();
 const child=spawn(process.execPath,['--experimental-strip-types',resolve('worker/paper-cli.ts'),'run',config,paper],{cwd:dir,env:{...process.env,KALSHI_KEY_ID:'fixture',KALSHI_PRIVATE_KEY:key,POLYMARKET_KEY_ID:'fixture',POLYMARKET_SECRET_KEY:Buffer.alloc(32,1).toString('base64')},stdio:['ignore','pipe','pipe']});
 let output='';let signaled=false;child.stderr.on('data',b=>output+=b);
 child.stdout.on('data',b=>{output+=b;if(!signaled&&output.includes('worker started')){signaled=true;child.kill('SIGINT');setTimeout(()=>child.kill('SIGTERM'),1);}});
 const timeout=setTimeout(()=>child.kill('SIGKILL'),12000);
 try{const result=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));});assert.deepEqual(result,{code:0,signal:null},output);assert.ok(signaled);
  const db=new DatabaseSync(research,{readOnly:true});try{assert.ok(db.prepare('SELECT ended_at FROM sessions').get()?.ended_at);}finally{db.close();}
  for(const path of [research,paper]){const lock=new DatabaseSync(path+'.lease.sqlite',{readOnly:true});try{assert.equal(lock.prepare('SELECT count(*) AS n FROM observer_lease').get()?.n,0);}finally{lock.close();}}
 }finally{clearTimeout(timeout);if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');}
});
