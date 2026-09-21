import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {supervise} from '../scripts/screen-supervisor.mjs';
test('reused supervisor stops at its finite deadline without restarting',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'screen-supervisor-'));
 const result=await supervise({command:process.execPath,args:['-e',"process.on('SIGINT',()=>process.exit(0)); console.log(JSON.stringify({mode:'live-data'})); setInterval(()=>{},100);"],cwd:dir,log:join(dir,'log'),status:join(dir,'status'),durationMs:400,silenceMs:3000,tickMs:50,graceMs:1000,forceMs:1000,minFreeBytes:0});
 assert.equal(result.reason,'BOUNDED_OBSERVATION_DEADLINE');assert.equal(result.exitCode,0);
 assert.equal(JSON.parse(readFileSync(join(dir,'status'),'utf8')).phase,'STOPPED');
});
