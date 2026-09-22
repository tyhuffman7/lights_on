// Reuses the existing bounded process supervisor. No restart, order or ledger path.
import {supervise} from './screen-supervisor.mjs';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {existsSync,readFileSync} from 'node:fs';
const [output,envFile]=process.argv.slice(2);
if(!output||!envFile)throw Error('Usage: confirmation-launch.mjs OUTPUT_DIRECTORY ENV_FILE');
const dir=resolve(output),root=resolve(new URL('..',import.meta.url).pathname);
if(existsSync(resolve(dir,'status.json')))throw Error('Single supervised launch only; no restart');
const frozen=JSON.parse(readFileSync(resolve(dir,'frozen.json'),'utf8'));
const durationMs=frozen.mode==='CONTROL'?30000:1800000;
if(frozen.policy.durationMs!==durationMs)throw Error('Invalid frozen duration');
const awake=process.platform==='darwin'?spawn('/usr/bin/caffeinate',['-i','-w',String(process.pid)],{stdio:'ignore'}):null;
const result=await supervise({command:process.execPath,args:['--experimental-strip-types',resolve(root,'worker/executable-screen.ts'),'confirmation-observe',dir,resolve(envFile)],cwd:root,log:resolve(dir,'worker.log'),status:resolve(dir,'status.json'),durationMs,silenceMs:60000,graceMs:5000,forceMs:5000,minFreeBytes:2*1024**3});
awake?.kill('SIGTERM');
process.exitCode=result.exitCode??1;
