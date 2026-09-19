import {readHistoryPage,type HistoryOperation} from './account-read.ts';
import type {Venue} from '../arb/types.ts';
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
// Bounded complete history: no partial results escape on HTTP/schema/loop failure.
// Completeness is pagination completeness, not a cross-request atomic snapshot.
export async function readAccountHistory(venue:Venue,operation:HistoryOperation,options:Parameters<typeof readHistoryPage>[3]={},maxPages=20){
 if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>20)throw Error('Invalid history page bound');
 const seen=new Set<string>(),rows:unknown[]=[];let cursor='';
 for(let page=0;page<maxPages;page++){
  const result=await readHistoryPage(venue,operation,cursor,options);
  if(!result.ok)throw Error('History read unavailable');
  const body=result.body,key=venue==='kalshi'?(operation==='subaccountTransfers'||operation==='intraAccountTransfers'?'transfers':operation):'activities';
  if(!object(body)||!Array.isArray(body[key])||body[key].length>100)throw Error('History page schema unavailable');
  const funding=venue==='kalshi'&&['deposits','withdrawals','subaccountTransfers','intraAccountTransfers'].includes(operation);
  // Funding/transfer cursor is optional in the published schema and omitted on observed
  // short terminal pages. A full page without a cursor remains ambiguous.
  const next=funding&&!Object.hasOwn(body,'cursor')&&body[key].length<100?'':venue==='kalshi'?body.cursor:body.nextCursor;
  if(typeof next!=='string'||next.length>4096||(venue==='poly'&&(typeof body.eof!=='boolean'||body.eof!==(next===''))))throw Error('Inconsistent history pagination');
  rows.push(...body[key]);
  if(!next)return {pages:page+1,records:rows.length,body:venue==='kalshi'?{[key]:rows,cursor:''}:{activities:rows,nextCursor:'',eof:true}};
  if(seen.has(next))throw Error('Repeated history cursor');seen.add(next);cursor=next;
 }
 throw Error('History exceeds bounded pagination; no complete evidence');
}
