// Alias is installed only by explicit local Vite serve mode, never a production build.
import {db,loadState as load,saveState as save} from '../../lib/store';
import type {State} from '../../lib/arb/types';
import {context} from './context';
import {pair} from './data';
export async function loadState(user:string):Promise<State>{
 // Create the existing schema in the isolated demo database; no migration/reset of user data.
 await db().prepare('CREATE TABLE IF NOT EXISTS experiments (user_id text PRIMARY KEY NOT NULL, revision integer DEFAULT 0 NOT NULL, body text NOT NULL)').run();
 const {key}=await context(),uid=`synthetic:${key}:${user}`;
 let s=await load(uid);
 if(!s.provenance){s.provenance='synthetic';s.pairs=[pair(key)];s=await save(uid,s,s.version);}
 return s;
}
export async function saveState(user:string,state:State,version:number){
 return save(`synthetic:${(await context()).key}:${user}`,state,version);
}
