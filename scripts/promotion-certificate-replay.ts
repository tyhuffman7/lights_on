// Replay frozen reviewed evidence without changing native prices or prior labels.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {paperSettlement} from '../lib/research/hot-confirmation.ts';
const output=resolve(process.argv[2]??'work/promotion-certificate-20261001');mkdirSync(output,{recursive:true});
const legacy=JSON.parse(readFileSync('tests/fixtures/semantic-difference-retained.json','utf8')).map((r:any)=>({...r,source:'retained-120'}));
const latest=['promoted','unresolved','rejected','confirmed-unresolved'].flatMap(stratum=>JSON.parse(readFileSync('docs/research/semantic-difference/'+stratum+'-audit.json','utf8')).candidates.map((r:any)=>({source:'fresh-previous-'+stratum,stratum,rank:r.rank,route:r.quote.route,before:r.observedClassification,reference:r.referenceReview.classification,referenceReview:r.referenceReview})));
const results=[...legacy,...latest].map((r:any)=>{const c=paperSettlement(r.route);return {...r,after:c.classification,certificate:c.certificate,missing:c.certificate.missing,conflicts:c.certificate.conflicts};});
const matrices:Record<string,Record<string,Record<string,number>>>={};
for(const r of results){const m=matrices[r.source]??={};const row=m[r.after]??={};row[r.reference]=(row[r.reference]??0)+1;}
const falsePromotions=results.filter(r=>r.after==='ORDINARY_EQUIVALENT_BASIS_RISK'&&r.reference!=='ORDINARY_EQUIVALENT_BASIS_RISK');
const wrongRejections=results.filter(r=>r.after==='DIFFERENT_QUESTION'&&r.reference!=='DIFFERENT_QUESTION');
const lostBasis=results.filter(r=>r.reference==='ORDINARY_EQUIVALENT_BASIS_RISK'&&r.after!=='ORDINARY_EQUIVALENT_BASIS_RISK').map(r=>({source:r.source,rank:r.rank,after:r.after,missing:r.missing,conflicts:r.conflicts}));
const summary={scope:'240 correlated retained native reference rows; labels preserved. Missing evidence downgrades require inspection. Not population accuracy.',matrices,rows:results.length,falsePromotions:falsePromotions.length,wrongRejections:wrongRejections.length,lostBasis,
 preservedOriginalBasis:results.filter(r=>r.source==='retained-120'&&r.reference==='ORDINARY_EQUIVALENT_BASIS_RISK'&&r.after===r.reference).length,
 certificatesEmitted:results.filter(r=>r.after==='ORDINARY_EQUIVALENT_BASIS_RISK').length};
writeFileSync(resolve(output,'retained-regression.json'),JSON.stringify({...summary,results},null,2)+'\n');console.log(JSON.stringify(summary,null,2));
if(falsePromotions.length||wrongRejections.length)process.exitCode=1;
