// One bounded run; no restart, strategy tuning, orders, or recurring automation.
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {supervise} from './screen-supervisor.mjs';
const mode=process.argv[2];if(!['smoke','final'].includes(mode))throw Error('Usage: run-execution-realism.mjs smoke|final');
const cwd=process.cwd(),directory=resolve(`work/execution-realism-20261001-${mode}`);
if(existsSync(directory))throw Error('EXISTING_RUN_MUST_NOT_BE_RESTARTED');mkdirSync(directory,{recursive:true,mode:0o700});
const durationSeconds=mode==='smoke'?60:10800;
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const paths=execFileSync('git',['ls-files','lib','worker','scripts','package.json','package-lock.json','tsconfig.json'],{encoding:'utf8'}).trim().split('\n');
const hashes=()=>Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
const before=hashes();writeFileSync(resolve(directory,'pre-window-freeze.json'),JSON.stringify({mode,sourceCommit,durationSeconds,sourceHashes:before,ordersEnabled:false,at:Date.now()},null,2)+'\n');
const result=await supervise({command:process.execPath,args:['--experimental-strip-types','worker/recall-observer.ts',directory,'--execution-study','--realistic-execution',`--duration-seconds=${durationSeconds}`,`--env=${resolve('../../..','.env.research')}`],cwd,
 log:resolve(directory,'worker.log'),status:resolve(directory,'supervisor.json'),durationMs:(durationSeconds+22*60)*1000,silenceMs:12*60*1000,minFreeBytes:8*1024**3});
const after=hashes(),changed=paths.filter(p=>before[p]!==after[p]);
writeFileSync(resolve(directory,'post-window-receipt.json'),JSON.stringify({result,sourceCommit,sourceHashesUnchanged:changed.length===0,changed,at:Date.now()},null,2)+'\n');
if(result.exitCode!==0||changed.length)throw Error('COLLECTOR_OR_SOURCE_FREEZE_FAILED');
const summary=JSON.parse(readFileSync(resolve(directory,'summary.json'),'utf8'));
if(mode==='final'){
 const reported=spawnSync(process.execPath,['--experimental-strip-types','scripts/report-execution-realism.ts',directory,'docs/research/execution-realism'],{cwd,encoding:'utf8'});
 writeFileSync(resolve(directory,'analysis.log'),reported.stdout+reported.stderr);if(reported.status!==0)throw Error('OFFLINE_ANALYSIS_FAILED');
}
console.log(JSON.stringify({mode,phase:summary.phase,minutes:(summary.at-summary.start)/60000,reasons:summary.reasons,evidenceBytes:summary.evidenceBytes,result,sourceHashesUnchanged:changed.length===0}));
