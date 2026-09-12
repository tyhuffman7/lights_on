import type {MakerOrder} from '../lib/arb/maker-ledger.ts';
import type {PaperDiagnostics} from './paper-diagnostics.ts';
import type {ConditionalPaperApproval} from '../lib/arb/paper-approval.ts';
import {DatabaseSync} from 'node:sqlite';
import {initial} from '../lib/arb/ledger.ts';
import type {State} from '../lib/arb/types.ts';
export type PaperDocument={state:State;mode:'live-data'|'synthetic';pendingId:string|null;halt:string|null;
 approvals?:Record<string,ConditionalPaperApproval>;
 diagnostics?:PaperDiagnostics;
 makerOrder?:MakerOrder;
 executionMode?:'maker'|'taker';
 counts:Record<string,number>;lastDecisions:Record<string,{at:number;reasons:string[]}>};
export class PaperStore {
 db:DatabaseSync;
 constructor(path:string,readonly=false){
  this.db=new DatabaseSync(path,{readOnly:readonly});
  if(!readonly){
   const tables=this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {name:string}[];
   if(tables.some(t=>t.name!=='paper_bot')){this.db.close();throw Error('Refusing to add paper state to an unrelated database');}
   this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS paper_bot (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)');}
 }
 load(mode:'live-data'|'synthetic'):PaperDocument{
  const row=this.db.prepare('SELECT body FROM paper_bot WHERE id=1').get() as {body:string}|undefined;
  if(row){const d=JSON.parse(row.body) as PaperDocument;if(d.mode!==mode)throw Error('Refusing to mix synthetic and live-data paper ledgers');return d;}
  const state=initial();state.startedAt=Date.now();if(mode==='synthetic')state.provenance='synthetic';
  return {state,mode,pendingId:null,halt:null,counts:{},lastDecisions:{}};
 }
 save(d:PaperDocument){this.db.prepare('INSERT INTO paper_bot VALUES(1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(JSON.stringify(d));}
 read():PaperDocument{const row=this.db.prepare('SELECT body FROM paper_bot WHERE id=1').get() as {body:string}|undefined;if(!row)throw Error('Paper worker has not initialized this ledger');return JSON.parse(row.body);}
 close(){this.db.close();}
}
