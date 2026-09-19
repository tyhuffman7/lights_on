import {existsSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {lease} from './config.ts';import {PilotExecutionLedger} from '../lib/pilot/execution-ledger.ts';import {refreshOwnedIntent} from '../lib/pilot/order-refresh.ts';
const [path,pairId]=process.argv.slice(2);
if(!path||!pairId||!existsSync(path))throw Error('Usage: pilot:reconcile EXISTING_OWNED_LIVE_PILOT_DB PAIR_ID');
const check=new DatabaseSync(path,{readOnly:true});try{const scope=check.prepare('SELECT scope FROM pilot_execution_scope WHERE id=1').get() as {scope:string}|undefined;if(scope?.scope!=='live')throw Error('Only an existing owned live execution ledger can be refreshed');if(!check.prepare('SELECT id FROM pilot_execution_pairs WHERE id=?').get(pairId))throw Error('Unknown owned pair');}finally{check.close();}
if(existsSync('.env.research'))process.loadEnvFile('.env.research');
const release=lease(path);let execution:PilotExecutionLedger|undefined;
try{execution=new PilotExecutionLedger(path,'live');execution.recoverPending();const pair=execution.pair(pairId);
 for(const leg of pair.legs){if(!leg.orderId){if(leg.state==='SUBMISSION_UNKNOWN')execution.ledger.halt('SUBMISSION_IDENTITY_UNKNOWN');continue;}await refreshOwnedIntent(execution,leg.intentId);}
 console.log(JSON.stringify({pair:execution.pair(pairId),recovery:execution.recovery(pairId)},null,2));
}finally{execution?.close();release();}
