// Catalog metadata only: no account credentials, sockets, books, orders or ledger writes.
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {catalog} from './coverage.ts';
import {getJSON} from '../lib/arb/adapters.ts';
import {discoveryPolicy} from '../lib/screen/discovery.ts';

export async function refreshCoverageCatalog(directory:string) {
  const dir=resolve(directory);
  mkdirSync(dir,{recursive:true});
  const receipt=resolve(dir,'catalog-started.json');
  if(existsSync(receipt))throw Error('Use a new catalog directory; preserve prior snapshots');
  const startedAt=Date.now(), signal=AbortSignal.timeout(discoveryPolicy.preparationTimeoutMs);
  let requests=0,progress:any;
  writeFileSync(receipt,JSON.stringify({startedAt,maxRequests:discoveryPolicy.maxCatalogRequests,
    timeoutMs:discoveryPolicy.preparationTimeoutMs,scope:'PUBLIC_CATALOG_ONLY',ordersEnabled:false})+'\n');
  mkdirSync(resolve(dir,'responses'));
  const data=await catalog(async url=>{
    if(signal.aborted||++requests>discoveryPolicy.maxCatalogRequests)throw Error('BOUNDED_CATALOG_LIMIT');
    const response=await getJSON(url);
    const key=createHash('sha256').update(url).digest('hex');
    writeFileSync(resolve(dir,'responses',key+'.json'),JSON.stringify({url,response}));
    return response;
  },signal,p=>{progress=p;if((p.kalshiPages===0&&(p.polyPages===1||p.polyPages%20===0))||(p.kalshiPages>0&&p.kalshiPages%10===0))
    console.log(JSON.stringify({phase:'CATALOG_METADATA',...p,requests}));});
  const body=JSON.stringify(data);
  writeFileSync(resolve(dir,'catalog.json'),body+'\n');
  const result={startedAt,endedAt:Date.now(),requests,...progress,complete:data.complete,
    catalogSha256:createHash('sha256').update(body+'\n').digest('hex'),ordersEnabled:false};
  writeFileSync(resolve(dir,'catalog-receipt.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
  return data;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(!process.argv[2])throw Error('Usage: worker/catalog-coverage.ts <new-local-output-directory>');
  const result=await refreshCoverageCatalog(process.argv[2]);
  if(!result.complete)process.exitCode=1;
}
