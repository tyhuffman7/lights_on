// Deterministic market inputs only. Execution, sizing, fees and settlement use production code.
import type {Pair,Market,Book,Venue} from '../../lib/arb/types';
import {context} from './context';
export function pair(key:string):Pair {
 const market=(venue:Venue):Market=>({id:`SYNTHETIC-${key}-${venue}`,venue,
  title:`SYNTHETIC ${key} threshold`,outcome:'Yes',opposite:'No',category:'Economics',
  rules:'Synthetic identical threshold and settlement; never an actual approved mapping.',
  url:'https://example.invalid/synthetic',closeAt:new Date(Date.now()+86400000).toISOString(),
  open:true,feeRate:venue==='kalshi'?700:600,feeRounding:venue==='kalshi'?'ceil':'even',
  minQty:1,hash:'synthetic-identical-rules-v1',settlement:null});
 return {id:`SYNTHETIC-${key}`,a:market('kalshi'),b:market('poly'),inverted:false,reviewed:true};
}
const reads=new WeakMap<Market,number>();
export async function freshPair(saved:Pair){
 if(!saved.id.startsWith('SYNTHETIC-'))throw Error('Demo refuses real market IDs');
 return structuredClone(saved);
}
export async function book(m:Market):Promise<Book>{
 if(!m.id.startsWith('SYNTHETIC-'))throw Error('Demo refuses real market IDs');
 const {scenario}=await context(),n=(reads.get(m)||0)+1;reads.set(m,n);
 const missing=n>1&&(scenario==='unwind'||scenario==='unmatched');
 const level=(price:number)=>[{price,quantity:100}];
 return {yes:level(m.venue==='kalshi'?(scenario==='no-edge'?6000:4000):7000),
  no:m.venue==='poly'&&missing?[]:level(m.venue==='poly'?(scenario==='no-edge'?6000:5000):7000),
  yesBids:scenario==='unmatched'?[]:level(3800),noBids:[],
  receivedAt:Date.now(),exchangeAt:Date.now(),open:true};
}
export async function market(_venue:Venue,id:string){
 if(!id.startsWith('SYNTHETIC-'))throw Error('Demo refuses real market IDs');
 return {settlement:(await context()).settled?10000:null};
}
