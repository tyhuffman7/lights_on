import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {practicalSettlement,practicalClasses} from '../lib/pilot/bounded-basis.ts';
import type {FamilyProof,RouteProof} from '../lib/research/family-settlement.ts';
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function practicalAudit(rows:{family:string;proof:RouteProof}[],old:{routeAuditSha256:string;candidateRoutes:number},matrix:{records:FamilyProof[]}){
 if(hash(rows)!==old.routeAuditSha256||rows.length!==old.candidateRoutes)throw Error('REVIEWED_ROUTE_AUDIT_CHANGED');
 const families=new Map(matrix.records.map(f=>[f.id,f]));
 const totals=Object.fromEntries(practicalClasses.map(c=>[c,0])) as Record<typeof practicalClasses[number],number>;
 for(const row of rows){const family=families.get(row.family);if(!family)throw Error('FAMILY_NOT_BOUND');totals[practicalSettlement(family,row.proof).classification]++;}
 return {version:1,scope:'Reclassification of pinned PR17 ordinary-predicate evidence; no matcher, mapping, catalog refresh or price watch',
  candidateRoutes:rows.length,totals,ordinaryOutcomeEligible:totals.ECONOMICALLY_EQUIVALENT+totals.BOUNDED_BASIS,
  priorRouteAuditSha256:old.routeAuditSha256,ordersEnabled:false,marketWatchRun:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [file,output]=process.argv.slice(2);if(!file||!output)throw Error('Usage: REVIEWED_PRIVATE_ROUTE_AUDIT OUTPUT_DIRECTORY');
 const read=(p:string|URL)=>JSON.parse(readFileSync(p,'utf8'));
 const root=new URL('../docs/research/settlement-families/',import.meta.url),summary=practicalAudit(read(file),read(new URL('aggregate.json',root)),read(new URL('matrix.json',root)));
 mkdirSync(output,{recursive:true,mode:0o700});writeFileSync(resolve(output,'classification.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(summary));
}
