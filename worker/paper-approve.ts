import {existsSync} from 'node:fs';
import {readConfig,lease} from './config.ts';
import {ResearchStore} from '../lib/research/store.ts';
import {PaperStore} from './paper-store.ts';
import {createPaperApproval,paperFingerprint} from '../lib/arb/paper-approval.ts';
import {market} from '../lib/arb/adapters.ts';
import type {Mapping} from '../lib/research/types.ts';
const [flag,configPath,paperPath,...ids]=process.argv.slice(2);
if(flag!=='--accept-conditional-paper-risk'||!configPath||!paperPath||!ids.length||ids.length>100)throw Error('Usage: paper:approve -- --accept-conditional-paper-risk CONFIG PAPER_DB PAIR_ID [PAIR_ID...], maximum 100; stop worker first');
if(existsSync('.env.research'))process.loadEnvFile('.env.research');
const config=readConfig(configPath),releaseResearch=lease(config.database);let releasePaper:(()=>void)|undefined,research:ResearchStore|undefined,paper:PaperStore|undefined;
try{
 releasePaper=lease(paperPath);research=new ResearchStore(config.database,true);paper=new PaperStore(paperPath);const d=paper.read();
 if(d.mode!=='live-data')throw Error('Conditional approvals require a live-data paper ledger');
 const approvals=[];
 for(const id of new Set(ids)){
  const row=research.db.prepare('SELECT body FROM mappings WHERE id=?').get(id);if(!row)throw Error('Unknown mapping: '+id);
  const m=JSON.parse(String(row.body)) as Mapping;if(!m.active)throw Error('Inactive mapping: '+id);
  const [a,b]=await Promise.all([market('kalshi',m.pair.a.id),market('poly',m.pair.b.id)]);
  if(paperFingerprint({...m.pair,a,b})!==paperFingerprint(m.pair))throw Error('Metadata changed: refresh observer before approval: '+id);
  approvals.push(createPaperApproval({...m.pair,a,b},'Explicit conditional-paper risk acceptance via CLI; ordinary-outcome profile checked against current venue metadata. Exceptional-state payouts are not guaranteed complementary.'));
 }
 d.approvals={...d.approvals,...Object.fromEntries(approvals.map(a=>[a.pairId,a]))};paper.save(d);
 console.log(JSON.stringify({scope:'conditional-paper-only',realTradingAuthorized:false,registryApprovalsChanged:0,approvals},null,2));
}finally{
 try{paper?.close();}finally{try{research?.close();}finally{try{releasePaper?.();}finally{releaseResearch();}}}
}
