// Fixed commands only; no exchange observation, credentials, or model calls.
import {spawnSync} from 'node:child_process';
import {mkdirSync,openSync,closeSync,readFileSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
const mode=process.argv[2];if(!['correctness','benchmarks'].includes(mode))throw Error('Expected correctness or benchmarks');
mkdirSync('.ci',{recursive:true});
const commands=mode==='correctness'?[['install','npm',['run','install:ci']],['tests','npm',['test']],['types','npx',['--no-install','tsc','--noEmit','--incremental','false']],['build','npm',['run','build']]]:[['install','npm',['run','install:ci']],['load','npm',['run','test:load','--','.ci/load.json']],['discovery','npm',['run','test:discovery-load','--','.ci/discovery.json']]];
const commit=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout?.trim()||'unknown',results=[];
for(const [name,cmd,args] of commands){const path=`.ci/${name}.log`,fd=openSync(path,'w');let result;try{result=spawnSync(cmd,args,{stdio:['ignore',fd,fd],timeout:name==='install'?600000:300000});}finally{closeSync(fd);}results.push({name,command:[cmd,...args].join(' '),exitCode:result.status,error:result.error?.message,log:path});if(result.status!==0){process.exitCode=1;if(name==='install')break;}}
const testLog=existsSync('.ci/tests.log')?readFileSync('.ci/tests.log','utf8'):'';
const totals=testLog.split('\n').filter(l=>/^(?:ℹ|#) (tests|pass|fail|cancelled|skipped)\b/.test(l));
const failures=testLog.split('\n').filter(l=>/^not ok |^✖/.test(l)).slice(0,20);
const highlights={};for(const name of ['load','discovery']){const p=`.ci/${name}.json`;if(existsSync(p)){const r=JSON.parse(readFileSync(p,'utf8'));highlights[name]=name==='load'?r.stages.map(s=>({passed:s.passed,updatesPerSecond:s.updatesPerSecond,stopReason:s.stopReason})):{passed:r.passed,cycles:r.completedDiscoveryCycles,updatesPerSecond:r.result?.updatesPerSecond};}}
const summary={commit,mode,results,totals,failures,highlights,artifacts:'.ci/ (7-day workflow artifact)'};
writeFileSync('.ci/summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'```json\n'+JSON.stringify(summary,null,2)+'\n```\n');
