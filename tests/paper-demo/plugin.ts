import type {Plugin} from 'vite';
import {resolve} from 'node:path';
export function paperDemo():Plugin{return {name:'local-synthetic-paper-demo',enforce:'pre',
 transform(code,id){
  if(!id.includes('/app/api/'))return;
  return code.replaceAll("'@/lib/store'",JSON.stringify(resolve('tests/paper-demo/store.ts')))
   .replaceAll("'@/lib/arb/paper-data'",JSON.stringify(resolve('tests/paper-demo/data.ts')));
 },configureServer(server){
 server.middlewares.use((req,res,next)=>{
  const url=new URL(req.url||'/', 'http://127.0.0.1');
  if(url.pathname==='/paper-demo'){
   const scenario=url.searchParams.get('case')||'eligible',run=url.searchParams.get('run')||'manual';
   if(!/^(eligible|no-edge|unwind|unmatched)$/.test(scenario)||!/^[a-zA-Z0-9-]{1,80}$/.test(run)){res.statusCode=400;res.end('Invalid fixture case');return;}
   res.setHeader('Set-Cookie',[`paper-case=${scenario}-${run}; Path=/; SameSite=Strict`,
    `paper-settled=${url.searchParams.get('settled')==='1'?'1':'0'}; Path=/; SameSite=Strict`]);
   res.statusCode=302;res.setHeader('Location','/signin-with-chatgpt?return_to=/challenge');res.end();return;
  }
  // A synthetic demonstration must never discover or review real market pairs.
  if(url.pathname.startsWith('/api/')&&!['/api/state','/api/run','/api/scan'].includes(url.pathname)){
   res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Synthetic demo only: live discovery and pair changes are disabled.'}));return;
  }
  next();
 });
}};}
