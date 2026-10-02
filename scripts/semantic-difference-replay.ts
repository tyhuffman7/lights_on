// Retained manual labels, with the predeclared conservative darts binding.
import {readFileSync,writeFileSync} from 'node:fs';
import {paperSettlement} from '../lib/research/hot-confirmation.ts';
const rows=JSON.parse(readFileSync('tests/fixtures/semantic-difference-retained.json','utf8'));
const matrix:Record<string,Record<string,number>>={};
const results=rows.map((r:any)=>{const c=paperSettlement(r.route);(matrix[c.classification]??={})[r.reference]=((matrix[c.classification]??={})[r.reference]??0)+1;return {...r,after:c.classification,conflicts:c.differentQuestionReasons,missing:c.proposition.missing,dimensions:{a:c.proposition.a.dimensions,b:c.proposition.b.dimensions}};});
const result={scope:'120 retained manually reviewed records; enriched/correlated reference sample, not population accuracy.',matrix,
 caughtFalseSurvivors:results.filter((r:any)=>r.before==='UNRESOLVED'&&r.reference==='DIFFERENT_QUESTION'&&r.after==='DIFFERENT_QUESTION').length,
 preservedBasis:results.filter((r:any)=>r.before==='ORDINARY_EQUIVALENT_BASIS_RISK'&&r.after===r.before).length,
 preservedRejections:results.filter((r:any)=>r.before==='DIFFERENT_QUESTION'&&r.after===r.before).length,
 wrongRejections:results.filter((r:any)=>r.reference!=='DIFFERENT_QUESTION'&&r.after==='DIFFERENT_QUESTION').length,
 disagreements:results.filter((r:any)=>r.reference!==r.after).map((r:any)=>({stratum:r.stratum,rank:r.rank,reference:r.reference,after:r.after,conflicts:r.conflicts,missing:r.missing,dimensions:r.dimensions})),results};
writeFileSync(process.argv[2]??'work/semantic-difference-20261001-v2/retained-replay.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,results:undefined},null,2));
