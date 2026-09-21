// Deterministic process supervision only. Never submits orders or mutates a ledger.
import {spawn} from 'node:child_process';
import {createWriteStream,writeFileSync,renameSync,statfsSync,readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {pathToFileURL} from 'node:url';
export function supervise(spec){
 const startedAt=Date.now(),startMono=performance.now(),deadlineAt=startedAt+spec.durationMs;
 const log=createWriteStream(spec.log,{flags:'a'});let reason=null,stopping=false,lastOutputAt=startedAt,lastStatus=null,grace,hard;
 const child=spawn(spec.command,spec.args,{cwd:spec.cwd,stdio:['ignore','pipe','pipe']});
 const save=extra=>{const status={scope:'PAPER_ONLY_NO_REAL_ORDERS',phase:stopping?'STOPPING':lastStatus?'RUNNING':'STARTING',supervisorPid:process.pid,childPid:child.pid,command:[spec.command,...spec.args],cwd:spec.cwd,startedAt,deadlineAt,at:Date.now(),reason,lastOutputAt,lastStatus,...extra};writeFileSync(spec.status+'.tmp',JSON.stringify(status,null,2)+'\n');renameSync(spec.status+'.tmp',spec.status);};
 const stop=why=>{if(stopping)return;stopping=true;reason=why;child.kill('SIGINT');grace=setTimeout(()=>{child.kill('SIGTERM');hard=setTimeout(()=>{reason+=':FORCED_KILL_UNRESOLVED_STATE_REQUIRES_REVIEW';child.kill('SIGKILL');},spec.forceMs??30000);},spec.graceMs??120000);save();};
 for(const stream of [child.stdout,child.stderr])createInterface({input:stream}).on('line',line=>{lastOutputAt=Date.now();log.write(line+'\n');try{const row=JSON.parse(line);if(row.message==='PAPER_RECOVERY_CHECKPOINT_COMPLETE')reason='FIRST_FILLED_ORDER_RESOLVED';if(row.mode==='live-data'){lastStatus=row;if(row.halt||(row.positions??[]).some(p=>p.status==='unmatched')){if(!row.makerRecoveryCheckpoint)stop('PAPER_EXECUTION_HALT');}if(row.observerHealth&&(row.observerHealth.paused||row.observerHealth.stopped||row.observerHealth.recorderFailed))stop('OBSERVER_HEALTH_FAILURE');save();}}catch{}});
 const tick=setInterval(()=>{try{if(Date.now()>=deadlineAt||performance.now()-startMono>=spec.durationMs)stop('BOUNDED_OBSERVATION_DEADLINE');const fs=statfsSync(spec.cwd);if(fs.bavail*fs.bsize<(spec.minFreeBytes??8*1024**3))stop('LOW_DISK_SPACE');if(Date.now()-lastOutputAt>(spec.silenceMs??120000))stop('WORKER_OUTPUT_STALLED');save();}catch(error){stop('SUPERVISOR_ERROR:'+String(error));}},spec.tickMs??5000);
 const deadline=setTimeout(()=>stop('BOUNDED_OBSERVATION_DEADLINE'),spec.durationMs);
 const interrupt=()=>stop('EXTERNAL_STOP');process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
 save();
 return new Promise(resolve=>{child.on('error',error=>{reason='SPAWN_FAILED:'+String(error);});child.on('close',(exitCode,exitSignal)=>{clearInterval(tick);clearTimeout(deadline);clearTimeout(grace);clearTimeout(hard);process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);reason??=exitCode===0?'WORKER_EXITED':'WORKER_FAILED';save({phase:'STOPPED',endedAt:Date.now(),exitCode,exitSignal});log.end();resolve({reason,exitCode,exitSignal});});});
}
