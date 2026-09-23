// Offline, read-only comparison against a preserved implementation on one snapshot.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {discoverCandidates} from '../lib/research/matching.ts';
import type {Candidate} from '../lib/research/matching.ts';
import type {Market} from '../lib/arb/types.ts';

const counts=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(k=>[k,values.filter(v=>v===k).length]));
const compact=(c:Candidate)=>({pairId:c.pair.id,kalshiId:c.pair.a.id,polyId:c.pair.b.id,
  kalshiTitle:c.pair.a.title,polyTitle:c.pair.b.title,status:c.status,inverted:c.pair.inverted,
  category:c.pair.a.category,family:c.pair.a.identity?.marketType??'general',reasons:c.reasons});
export async function compareMappingCoverage(catalogPath:string,baselineRoot:string,outputDirectory:string,registryPath?:string){
  const raw=readFileSync(catalogPath),data=JSON.parse(raw.toString()) as {kalshi:Market[];poly:Market[];at:number;complete:boolean;errors:string[]};
  if(!data.complete||data.errors.length)throw Error('Complete public catalog required for coverage comparison');
  const baseline=await import(pathToFileURL(resolve(baselineRoot,'lib/research/matching.ts')).href);
  const before=baseline.discoverCandidates(data.kalshi,data.poly) as ReturnType<typeof discoverCandidates>;
  const after=discoverCandidates(data.kalshi,data.poly);
  const oldIds=new Set(before.candidates.map(c=>c.pair.id)),newIds=new Set(after.candidates.map(c=>c.pair.id));
  const added=after.candidates.filter(c=>!oldIds.has(c.pair.id)),removed=before.candidates.filter(c=>!newIds.has(c.pair.id));
  const summarize=(r:ReturnType<typeof discoverCandidates>)=>({pairs:r.candidates.length,
    statuses:{AUTO_VERIFIED:0,MANUAL_VERIFIED:0,UNVERIFIED:0,...counts(r.candidates.map(c=>c.status))},
    uniqueKalshiMarkets:new Set(r.candidates.map(c=>c.pair.a.id)).size,
    uniquePolyMarkets:new Set(r.candidates.map(c=>c.pair.b.id)).size,
    categories:counts(r.candidates.map(c=>c.pair.a.category)),diagnostics:r.diagnostics});
  const catalogs={kalshi:new Map(data.kalshi.map(m=>[m.id,m])),poly:new Map(data.poly.map(m=>[m.id,m]))};
  const matchedPoly=new Set(after.candidates.map(c=>c.pair.b.id));
  const unmatched=[...catalogs.poly.values()].filter(m=>m.open&&!matchedPoly.has(m.id));
  const inventories=registryPath?JSON.parse(readFileSync(registryPath,'utf8')) as {database:string;total:number;active:number;statuses:Record<string,number>;rows:{id:string;status:string;active:boolean}[]}[]:[];
  const result={scope:'OFFLINE_PUBLIC_CATALOG_MAPPING_ONLY',at:data.at,complete:data.complete,errors:data.errors,
    snapshotSha256:createHash('sha256').update(raw).digest('hex'),
    catalogs:Object.fromEntries(Object.entries(catalogs).map(([v,ms])=>[v,{listed:data[v as 'kalshi'|'poly'].length,unique:ms.size,eligibleOpen:[...ms.values()].filter(m=>m.open).length}])),
    before:summarize(before),after:summarize(after),added:added.length,removed:removed.length,
    retained:after.candidates.length-added.length,netAdditionalRoutes:after.candidates.length-before.candidates.length,
    addedFamilies:counts(added.map(c=>c.pair.a.identity?.marketType??'general')),
    registry:inventories.map(({rows,...rest})=>({...rest,
      currentCandidateOverlap:rows.filter(r=>newIds.has(r.id)).length,
      currentCandidateStatuses:counts(rows.filter(r=>newIds.has(r.id)).map(r=>r.status)),
      baselineCandidateOverlap:rows.filter(r=>oldIds.has(r.id)).length})),
    unmatchedPoly:{eligible:unmatched.length,categories:counts(unmatched.map(m=>m.category)),
      families:counts(unmatched.map(m=>m.identity?.marketType??'general'))},
    interpretation:'Candidates are review routes, not settlement equivalence or executable/profitable opportunities. Rejection counters describe evaluated pair comparisons, not independent missing mappings. Unmatched listings may have no counterpart. Registry inventories are read-only historical state.'};
  const dir=resolve(outputDirectory);mkdirSync(dir,{recursive:true});
  for(const [name,value] of Object.entries({'coverage-comparison':result,'before-candidates':before.candidates.map(compact),'after-candidates':after.candidates.map(compact),'added-candidates':added.map(compact),'removed-candidates':removed.map(compact),'unmatched-poly':unmatched.map(m=>({id:m.id,title:m.title,identity:m.identity}))}))
    writeFileSync(resolve(dir,name+'.json'),JSON.stringify(value,null,2)+'\n');
  console.log(JSON.stringify({before:before.candidates.length,after:after.candidates.length,added:added.length,removed:removed.length,catalogs:result.catalogs}));
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [catalogPath,baselineRoot,outputDirectory,registryPath]=process.argv.slice(2);
  if(!catalogPath||!baselineRoot||!outputDirectory)throw Error('Usage: mapping-coverage-report.ts CATALOG_JSON BASELINE_CHECKOUT OUTPUT_DIRECTORY [READ_ONLY_REGISTRY_INVENTORY_JSON]');
  await compareMappingCoverage(catalogPath,baselineRoot,outputDirectory,registryPath);
}
