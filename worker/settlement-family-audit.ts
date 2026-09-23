import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import type {Market, Pair} from '../lib/arb/types.ts';
import {discoverCandidates} from '../lib/research/matching.ts';
import {catalogEntities} from '../lib/research/entities.ts';
import {classifySettlement, settlementClasses, type FamilyProof} from '../lib/research/family-settlement.ts';
import {documentPair, proveRoute} from '../lib/research/family-route.ts';

// Offline catalog analysis only: no network, order adapter, paper store, prices,
// account data, or mapping writes. Private per-route audit is never public output.
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
export function auditFamilies(catalog: {kalshi:Market[];poly:Market[];complete:boolean;errors:unknown[];at:number}, pairs:Pair[], matrix:{records:(FamilyProof & {semanticFamily:string;sourceBindings:Record<string,string>})[]}, sources:{id:string;sha256:string}[]) {
  if(!catalog.complete||catalog.errors.length)throw new Error('Complete error-free source catalog required');
  const sourceMap=new Map(sources.map(s=>[s.id,s.sha256]));
  const marketMap=new Map([...catalog.kalshi,...catalog.poly].map(m=>[`${m.venue}:${m.id}`,m]));
  const registry=catalogEntities([...marketMap.values()].map(m=>m.identity));
  const families=new Map(matrix.records.map(f=>[f.id,f]));
  if(new Set(pairs.map(p=>p.id)).size!==pairs.length)throw new Error('Duplicate candidate pair');
  const rows=pairs.map(pair=>{
    const a=marketMap.get(`kalshi:${pair.a.id}`),b=marketMap.get(`poly:${pair.b.id}`);
    if(!a||!b||a.hash!==pair.a.hash||b.hash!==pair.b.hash)throw new Error('Candidate not bound to source catalog');
    const original={...pair,a,b};const id=documentPair(original);const found=id ? families.get(id) : undefined;
    const family:FamilyProof=found??{id:id??'UNKNOWN',documents:[],missingEvidence:['Unreviewed controlling document pair'],ordinaryConflicts:[],divergences:[],stateProofs:[]};
    if(found&&found.documents.some(d=>found.sourceBindings[d]!==sourceMap.get(d)||!sourceMap.get(d)))throw new Error('Unpinned rule source');
    const proof=proveRoute(original,registry), result=classifySettlement(family,proof);
    return {routeId:pair.id,metadataHashes:[a.hash,b.hash],family:id??'UNKNOWN',semanticFamily:found?found.semanticFamily:'UNKNOWN',...result,proof};
  });
  const counts=()=>Object.fromEntries(settlementClasses.map(c=>[c,0])) as Record<typeof settlementClasses[number],number>;
  const totals=counts();const groups=new Map<string,{family:string;routes:number;counts:ReturnType<typeof counts>;reasons:Record<string,number>}>();
  const semantic=new Map<string,{family:string;routes:number;counts:ReturnType<typeof counts>}>();
  for(const r of rows){totals[r.classification]++;const g=groups.get(r.family)??{family:r.family,routes:0,counts:counts(),reasons:{}};g.routes++;g.counts[r.classification]++;for(const reason of r.reasons)g.reasons[reason]=(g.reasons[reason]??0)+1;groups.set(r.family,g);const s=semantic.get(r.semanticFamily)??{family:r.semanticFamily,routes:0,counts:counts()};s.routes++;s.counts[r.classification]++;semantic.set(r.semanticFamily,s);}
  const aggregate={version:1,catalogAt:new Date(catalog.at).toISOString(),scope:'Existing matcher output over saved complete catalog; not current tradable inventory',candidateRoutes:rows.length,semanticFamilyPairs:semantic.size,documentVariantPairs:groups.size,totals,
    families:[...semantic.values()].sort((a,b)=>b.routes-a.routes),documentVariants:[...groups.values()].sort((a,b)=>b.routes-a.routes),
    routeAuditSha256:hash(JSON.stringify(rows)),pricesUsed:false,marketWatchRun:false,paperSessionRun:false,ordersEnabled:false};
  return {aggregate,rows};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);const arg=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
  const catalogFile=arg('--catalog'),output=arg('--private-output');if(!catalogFile||!output)throw new Error('Usage: --catalog FILE --private-output DIRECTORY [--candidate-cache FILE --candidate-cache-sha256 HASH]');
  const bytes=fs.readFileSync(catalogFile),catalog=JSON.parse(bytes.toString());
  let pairs:Pair[];let diagnostics:unknown;
  const cache=arg('--candidate-cache');
  if(cache){const raw=fs.readFileSync(cache);if(hash(raw)!==arg('--candidate-cache-sha256'))throw new Error('Explicit matcher cache SHA-256 required');pairs=JSON.parse(raw.toString()).map((c:{pair:Pair})=>c.pair);diagnostics='Pinned precomputed unmodified matcher result';}
  else {const found=discoverCandidates(catalog.kalshi,catalog.poly);pairs=found.candidates.map(c=>c.pair);diagnostics=found.diagnostics;}
  const root=new URL('../docs/research/settlement-families/',import.meta.url);const matrix=JSON.parse(fs.readFileSync(new URL('matrix.json',root),'utf8')),sources=JSON.parse(fs.readFileSync(new URL('sources.json',root),'utf8'));
  if(hash(bytes)!==matrix.reviewedCatalogSha256)throw new Error('Catalog is outside this reviewed checkpoint; rebind route evidence before reusing family profiles');
  const {aggregate,rows}=auditFamilies(catalog,pairs,matrix,sources);
  fs.mkdirSync(output,{recursive:true,mode:0o700});
  fs.writeFileSync(path.join(output,'route-audit.json'),JSON.stringify(rows,null,2)+'\n',{mode:0o600});
  fs.writeFileSync(path.join(output,'aggregate.json'),JSON.stringify({...aggregate,catalogSha256:hash(bytes),matcherDiagnostics:diagnostics},null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({candidateRoutes:aggregate.candidateRoutes,families:aggregate.semanticFamilyPairs,totals:aggregate.totals}));
}
