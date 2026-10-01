// Frozen replay is independent of new market collection and never alters labels.
import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {paperSettlement} from '../lib/research/hot-confirmation.ts';
const directory=resolve(process.argv[2]),output=resolve(process.argv[3]);
const before:Record<string,number>={},after:Record<string,number>={},transitions:Record<string,number>={};
const routes=new Map<string,any>(),cache=new Map<string,ReturnType<typeof paperSettlement>>();
let fresh=0,changed=0,previousBasis=0,preservedBasis=0;
const count=(o:Record<string,number>,k:string)=>o[k]=(o[k]??0)+1;
for await(const line of createInterface({input:createReadStream(resolve(directory,'evidence.ndjson')),crlfDelay:Infinity})){
 const x=JSON.parse(line),b=x.body;
 if(x.kind!=='CONFIRMATION'||!b.signal.candidate||!b.signal.executable)continue;
 fresh++;const key=b.route.pair.id+':'+b.route.pair.a.hash+':'+b.route.pair.b.hash;
 let c=cache.get(key);if(!c){c=paperSettlement(b.route);cache.set(key,c);}
 const old=b.settlement?.classification??'UNRESOLVED';count(before,old);count(after,c.classification);count(transitions,old+' -> '+c.classification);
 if(old!==c.classification)changed++;
 if(old==='ORDINARY_EQUIVALENT_BASIS_RISK'){previousBasis++;if(c.classification===old)preservedBasis++;}
 const routeKey=b.route.pair.id+':'+b.signal.evaluation.kalshiSide;
 if((routes.get(routeKey)?.modeledNet??-Infinity)<b.signal.evaluation.estimatedNetProfit)routes.set(routeKey,{
  route:b.route,side:b.signal.evaluation.kalshiSide,modeledNet:b.signal.evaluation.estimatedNetProfit,
  before:old,after:c.classification,semantic:c,quoteAt:b.signal.evaluation.at});
}
const manual=JSON.parse(readFileSync(resolve('tests/fixtures/proposition-frozen-top20.json'),'utf8'));
const top20=manual.map((r:any)=>{const c=paperSettlement(r.route);return {rank:r.rank,id:r.route.pair.id,label:r.expected,
  after:c.classification,agrees:c.classification===r.expected,reasons:c.differentQuestionReasons,missing:c.proposition.missing};});
const summary=JSON.parse(readFileSync(resolve(directory,'summary.json'),'utf8'));
const result={scope:'Frozen native quote replay. Counts are repeated readings, not trades, fills or profits.',
 input:directory,at:new Date().toISOString(),sourceSha256:createHash('sha256').update(readFileSync('lib/research/proposition.ts')).digest('hex'),
 discoveredRoutes:summary.matchedRoutes,fresh,changed,before,after,transitions,previousBasis,preservedBasis,
 top20,top20Agreement:top20.filter((r:any)=>r.agrees).length,knownFalseMatchesCaught:top20.filter((r:any)=>r.label==='DIFFERENT_QUESTION'&&r.agrees).length,
 strongestAfter:[...routes.values()].filter(r=>r.after!=='DIFFERENT_QUESTION').sort((a,b)=>b.modeledNet-a.modeledNet).slice(0,20),
 routes:[...routes.values()]};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,top20:result.top20.map((r:any)=>({rank:r.rank,label:r.label,after:r.after})),strongestAfter:result.strongestAfter.map(r=>({id:r.route.pair.id,after:r.after,net:r.modeledNet})),routes:result.routes.length},null,2));
