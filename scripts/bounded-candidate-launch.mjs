import {resolve} from 'node:path';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {supervise} from './screen-supervisor.mjs';
const [output,envFile]=process.argv.slice(2),root=resolve(new URL('..',import.meta.url).pathname),dir=resolve(output);
const f=JSON.parse(readFileSync(resolve(dir,'frozen.json'),'utf8'));
if(f.policy.ordersEnabled!==false||f.policy.durationMs!==7200000||existsSync(resolve(dir,'launch.json')))throw Error('SINGLE_READ_ONLY_WATCH_ONLY');
const deadline=Date.now()+f.policy.durationMs;
writeFileSync(resolve(dir,'launch.json'),JSON.stringify({at:Date.now(),deadline,ordersEnabled:false}),{flag:'wx',mode:0o600});
console.log(await supervise({command:process.execPath,args:['--experimental-strip-types',resolve(root,'worker/bounded-candidate-watch.ts'),'observe',dir,resolve(envFile),String(deadline)],cwd:root,log:resolve(dir,'worker.log'),status:resolve(dir,'supervisor.json'),durationMs:deadline-Date.now()+2000,silenceMs:45000,graceMs:10000,forceMs:5000,minFreeBytes:2*1024**3}));
