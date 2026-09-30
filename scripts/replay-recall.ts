import {createReadStream,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {evaluateEvArb} from '../lib/research/ev-arb.ts';
import {recallSignals,type RecallRoute,type ObservedBook} from '../lib/research/recall-detector.ts';
const [source,output]=process.argv.slice(2);if(!source||!output)throw Error('Usage: replay-recall.ts RETAINED_DEPTH_DISCOVERY_DIR OUTPUT');
const counts={books:0,pairedEvents:0,orientations:0,grossPositive:0,normalFeePositive:0,oldPaperEligible:0,
  preservedCandidates:0,preservedFreshCandidates:0,stressOnlyOldRejections:0,economicDisagreements:0};
const hashes:Record<string,string>={},examples:unknown[]=[],distinct=new Set<string>();
let firstAt:number|null=null,lastAt:number|null=null;
for(const batch of readdirSync(source).filter(n=>/^batch-\d+$/.test(n)).sort()){
  const freezePath=resolve(source,batch,'frozen.json'),bytes=readFileSync(freezePath);
  hashes[batch+'/frozen.json']=createHash('sha256').update(bytes).digest('hex');
  const frozen=JSON.parse(bytes.toString()),routes:RecallRoute[]=frozen.selection.map((x:any)=>({pair:x.pair,matchSource:'CANONICAL',eventKey:x.pair.id,
    warnings:['HISTORICAL_VERIFICATION_PENDING']}));
  const byMarket=new Map<string,RecallRoute[]>(),books=new Map<string,ObservedBook>();
  for(const r of routes)for(const m of [r.pair.a,r.pair.b]){const key=m.venue+':'+m.id,rows=byMarket.get(key)??[];rows.push(r);byMarket.set(key,rows);}
  const digest=createHash('sha256'),stream=createReadStream(resolve(source,batch,'evidence.ndjson'));
  stream.on('data',chunk=>digest.update(chunk));
  for await(const line of createInterface({input:stream,crlfDelay:Infinity})){
    const row=JSON.parse(line),found:any[]=[];
    const walk=(x:any)=>{if(!x||typeof x!=='object')return;
      if(x.venue&&x.marketId&&Array.isArray(x.yes)&&Array.isArray(x.no)&&Number.isFinite(x.receivedAt))found.push(x);
      else for(const v of Object.values(x))walk(v);};walk(row.body);
    for(const b of [...new Map(found.map(b=>[b.venue+':'+b.marketId+':'+b.receivedAt,b])).values()]){
    const oldBook=books.get(b.venue+':'+b.marketId);if(oldBook&&oldBook.book.receivedAt>=b.receivedAt)continue;
    counts.books++;firstAt??=row.at;lastAt=row.at;
    books.set(b.venue+':'+b.marketId,{book:b});
    for(const r of byMarket.get(b.venue+':'+b.marketId)??[]){const kalshi=books.get('kalshi:'+r.pair.a.id),poly=books.get('poly:'+r.pair.b.id);
      if(!kalshi||!poly)continue;counts.pairedEvents++;
      const newer=recallSignals(r,{kalshi,poly},row.at,[1]);
      for(const q of newer){const old=evaluateEvArb(r.pair,{kalshi:kalshi.book,poly:poly.book},q.evaluation.kalshiSide,1,row.at);
        counts.orientations++;if(old.grossStatus==='GROSS_ARB')counts.grossPositive++;
        if(old.economicStatus==='REALISTIC_NET_POSITIVE')counts.normalFeePositive++;
        if(old.execution.paperEligible)counts.oldPaperEligible++;
        if(q.candidate){counts.preservedCandidates++;if(q.fresh)counts.preservedFreshCandidates++;
          const key=r.pair.id+'|'+q.evaluation.orientation;distinct.add(key);
          if(examples.length<5)examples.push({at:row.at,pairId:r.pair.id,signal:q});}
        if(old.execution.paperEligible&&old.stress.feeBoundPass===false)counts.stressOnlyOldRejections++;
        if(q.evaluation.estimatedNetProfit!==old.estimatedNetProfit||q.candidate!==(old.economicStatus==='REALISTIC_NET_POSITIVE'))counts.economicDisagreements++;
      }
    }
  }
  }
  hashes[batch+'/evidence.ndjson']=digest.digest('hex');
}
const result={ordersEnabled:false,simulation:'RETAINED_L2_REPLAY_NOT_FILLS',source:'Retained September 22 depth-discovery books',firstAt,lastAt,
  missingRequestedReplay:'September 23/24 temporary raw directories absent; published 662/71/12 aggregates cannot reconstruct underlying L2.',
  hashes,counts,distinctPositiveRoutes:distinct.size,examples};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({counts,distinctPositiveRoutes:distinct.size}));
if(counts.economicDisagreements)process.exitCode=1;
