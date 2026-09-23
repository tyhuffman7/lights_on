// Offline only. Raw catalogs and full candidates remain in ignored private work/.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {discoverCandidates} from '../lib/research/matching.ts';
import {nonSportsFamilies,nonSportsFamily,settlementDimensions} from '../lib/research/non-sports.ts';
import {canonicalTemplate,canonicalTemplateKey} from '../lib/research/canonical-template.ts';
import {catalogEntities} from '../lib/research/entities.ts';
import type {Market} from '../lib/arb/types.ts';

export function reportNonSports(catalogPath:string,beforePath:string,output:string){
 const raw=readFileSync(catalogPath),data=JSON.parse(raw.toString()) as {kalshi:Market[];poly:Market[];complete:boolean;errors:string[];at:number};
 if(!data.complete||data.errors.length)throw Error('Complete catalog required');
 const before=JSON.parse(readFileSync(beforePath,'utf8')) as {pairId:string;kalshiId:string;polyId:string}[];
 const result=discoverCandidates(data.kalshi,data.poly),after=result.candidates;
 const k=new Map(data.kalshi.map(m=>[m.id,m])), old=new Set(before.map(c=>c.pairId)),newIds=new Set(after.map(c=>c.pair.id));
 const registry=catalogEntities([...data.kalshi,...data.poly].map(m=>m.identity));
 const templates=(ms:Market[])=>ms.map(m=>({m,t:canonicalTemplate(m,registry)}));
 const kt=templates(data.kalshi),pt=templates(data.poly);
 const exactK=new Map<string,Market[]>();for(const {m,t} of kt)if(t){const key=canonicalTemplateKey(t);exactK.set(key,[...(exactK.get(key)??[]),m]);}
 const exactPairs=pt.flatMap(({m,t})=>t?(exactK.get(canonicalTemplateKey(t))??[]).map(a=>({a,b:m,id:a.id+'::'+m.id})):[]);
 const families=nonSportsFamilies.map(f=>{
  const km=data.kalshi.filter(m=>nonSportsFamily(m)===f),pm=data.poly.filter(m=>nonSportsFamily(m)===f);
  const bc=before.filter(c=>k.has(c.kalshiId)&&nonSportsFamily(k.get(c.kalshiId)!)===f),ac=after.filter(c=>nonSportsFamily(c.pair.a)===f);
  const exact=exactPairs.filter(c=>nonSportsFamily(c.a)===f),missing=exact.filter(c=>!old.has(c.id));
  return {family:f,kalshi:km.length,poly:pm.length,before:bc.length,after:ac.length,added:ac.filter(c=>!old.has(c.pair.id)).length,removed:bc.filter(c=>!newIds.has(c.pairId)).length,
   exactParsedPairs:exact.length,exactParsedMissingBefore:missing.length,exactParsedMissingAfter:exact.filter(c=>!newIds.has(c.id)).length,
   parsedKalshi:kt.filter(x=>nonSportsFamily(x.m)===f&&x.t).length,parsedPoly:pt.filter(x=>nonSportsFamily(x.m)===f&&x.t).length,
   missingBeforeExamples:missing.slice(0,3).map(c=>({kalshiId:c.a.id,polyId:c.b.id,kalshiTitle:c.a.title,polyTitle:c.b.title})),settlementDimensions:settlementDimensions[f]};
 });
 const summary={scope:'ORDER_DISABLED_PUBLIC_CATALOG_ONLY',snapshotAt:data.at,snapshotSha256:createHash('sha256').update(raw).digest('hex'),catalogs:{kalshi:k.size,poly:new Set(data.poly.map(m=>m.id)).size},beforeTotal:before.length,afterTotal:after.length,families,
  statuses:after.reduce((a,c)=>(a[c.status]=(a[c.status]??0)+1,a),{} as Record<string,number>),
  caveat:'Exact parsed pairs are review candidates, not settlement equivalence. Missing-before counts are a reproducible lower bound on parser omissions, not all underlying shared events. No registry or ledger was opened.'};
 mkdirSync(output,{recursive:true});writeFileSync(resolve(output,'coverage.json'),JSON.stringify(summary,null,2)+'\n');
 writeFileSync(resolve(output,'candidates.json'),JSON.stringify(after));
 writeFileSync(resolve(output,'removed.json'),JSON.stringify(before.filter(c=>!newIds.has(c.pairId)),null,2));
 console.log(JSON.stringify({before:before.length,after:after.length,families:families.map(({family,kalshi,poly,before,after,added,removed})=>({family,kalshi,poly,before,after,added,removed}))}));
 return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [catalog,before,output]=process.argv.slice(2);if(!catalog||!before||!output)throw Error('Usage: non-sports-coverage.ts CATALOG BEFORE_CANDIDATES OUTPUT');reportNonSports(catalog,before,output);}
