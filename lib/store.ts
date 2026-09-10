import {env} from 'cloudflare:workers';
import {initial} from './arb/ledger';
import type {State} from './arb/types';
export function db(){if(!env.DB)throw new Error('Paper storage is unavailable. Try again shortly.');return env.DB;}
export async function loadState(user:string):Promise<State>{
 await db().prepare('INSERT OR IGNORE INTO experiments (user_id,revision,body) VALUES (?,0,?)').bind(user,JSON.stringify(initial())).run();
 const row=await db().prepare('SELECT revision,body FROM experiments WHERE user_id=?').bind(user).first<{revision:number;body:string}>();if(!row)throw new Error('Experiment could not be loaded');
 return {...JSON.parse(row.body),version:row.revision};
}
export async function saveState(user:string,state:State,version:number):Promise<State>{
 const next={...state,version:version+1};const r=await db().prepare('UPDATE experiments SET revision=revision+1,body=? WHERE user_id=? AND revision=?').bind(JSON.stringify(next),user,version).run();
 if(r.meta.changes!==1)throw new Error('Your experiment changed in another request. Refresh and retry.');return next;
}
