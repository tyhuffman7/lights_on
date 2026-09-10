import type {Level,Venue} from '../arb/types.ts';
import type {StreamBook} from './types.ts';
const USD=10000;
function px(v:unknown){
 const s=String(v);if(!/^(?:0?\.\d{1,4}|0|1(?:\.0{1,4})?)$/.test(s))throw new Error('Invalid price precision');
 const p=Math.round(Number(s)*USD);if(p<=0||p>=USD)throw new Error('Invalid book price');return p;
}
function quantity(v:unknown,signed=false){
 if(!/^-?\d+(?:\.\d{1,2})?$/.test(String(v)))throw new Error('Invalid quantity precision');
 const n=Math.round(Number(v)*100);if(!Number.isSafeInteger(n)||(!signed&&n<0))throw new Error('Invalid quantity');return n/100;
}
function canonical(ls:Level[],bid=false){
 const map=new Map<number,number>();for(const l of ls){if(map.has(l.price))throw new Error('Duplicate price');if(l.quantity>0)map.set(l.price,l.quantity);}
 return [...map].map(([price,quantity])=>({price,quantity})).sort((a,b)=>bid?b.price-a.price:a.price-b.price);
}
function complement(ls:Level[]){return ls.map(l=>({...l,price:USD-l.price}));}
export class BookCache{
 books=new Map<string,StreamBook>();sequences=new Map<number,number>();subscriptions=new Map<string,number>();
 get(venue:Venue,id:string){return this.books.get(`${venue}:${id}`);}
 reset(venue:Venue){this.invalidate(venue);if(venue==='kalshi'){this.sequences.clear();this.subscriptions.clear();}}
 invalidate(venue:Venue){for(const b of this.books.values())if(b.venue===venue){b.valid=false;b.connection='RECOVERING';}}
 private save(venue:Venue,id:string,yesBids:Level[],noBids:Level[],at:number,mono:number,exchangeAt:number|null,sequence:number|null,open:boolean):StreamBook{
  yesBids=canonical(yesBids,true);noBids=canonical(noBids,true);
  const b:StreamBook={venue,marketId:id,yes:canonical(complement(noBids)),no:canonical(complement(yesBids)),yesBids,noBids,receivedAt:at,receivedMono:mono,exchangeAt,sequence,connection:'LIVE',valid:true,open,source:'stream'};
  if(b.yes[0]&&yesBids[0]&&yesBids[0].price>=b.yes[0].price)throw new Error('Crossed or locked book');
  this.books.set(`${venue}:${id}`,b);return b;
 }
 kalshi(data:Record<string,any>,at:number,mono:number):StreamBook|null{
  if(!['orderbook_snapshot','orderbook_delta'].includes(data.type))return null;
  try{
   const {sid,seq,msg:m}=data;
   if(!Number.isSafeInteger(sid)||!Number.isSafeInteger(seq)||!m?.market_ticker)throw new Error('Missing sequence/market');
   const prev=this.sequences.get(sid);if(prev!==undefined&&seq!==prev+1)throw new Error('Kalshi sequence gap or reorder');
   this.sequences.set(sid,seq);const id=String(m.market_ticker);this.subscriptions.set(id,sid);
   let yes:Level[],no:Level[];
   if(data.type==='orderbook_snapshot'){
    if(!Array.isArray(m.yes_dollars_fp)||!Array.isArray(m.no_dollars_fp))throw new Error('Missing snapshot sides');
    const parse=(ls:unknown[][])=>ls.map(l=>({price:px(l[0]),quantity:quantity(l[1])}));yes=parse(m.yes_dollars_fp);no=parse(m.no_dollars_fp);
   }else{
    const old=this.get('kalshi',id);if(!old?.valid)throw new Error('Delta requires current snapshot');
    yes=structuredClone(old.yesBids);no=structuredClone(old.noBids);
    if(m.side!=='yes'&&m.side!=='no')throw new Error('Unknown side');
    const ls=m.side==='yes'?yes:no,p=px(m.price_dollars),delta=quantity(m.delta_fp,true),index=ls.findIndex(l=>l.price===p);
    const q=Math.round(((index<0?0:ls[index].quantity)+delta)*100)/100;if(q<0)throw new Error('Negative depth');
    if(index>=0)ls.splice(index,1);if(q>0)ls.push({price:p,quantity:q});
   }
   const ts=m.ts_ms??(m.ts?Date.parse(m.ts):null);if(ts!==null&&!Number.isFinite(ts))throw new Error('Invalid exchange timestamp');
   return this.save('kalshi',id,yes,no,at,mono,ts,seq,true);
  }catch(e){this.invalidate('kalshi');throw e;}
 }
 poly(data:Record<string,any>,at:number,mono:number):StreamBook|null{
  if(!data.marketData)return null;
  try{
   const m=data.marketData;if(!m.marketSlug||!Array.isArray(m.bids)||!Array.isArray(m.offers))throw new Error('Missing full market book');
   const parse=(ls:Record<string,any>[])=>ls.map(l=>{if(l.px?.currency!=='USD')throw new Error('Non-USD book');return {price:px(l.px.value),quantity:quantity(l.qty)};});
   const ts=Date.parse(m.transactTime);if(!Number.isFinite(ts))throw new Error('Missing exchange timestamp');
   const old=this.get('poly',m.marketSlug);if(old?.valid&&old.exchangeAt!==null&&ts<old.exchangeAt)throw new Error('Exchange timestamp moved backwards');
   return this.save('poly',String(m.marketSlug),parse(m.bids),complement(parse(m.offers)),at,mono,ts,null,m.state==='MARKET_STATE_OPEN');
  }catch(e){this.invalidate('poly');throw e;}
 }
}
export function fresh(b:StreamBook|undefined,mono:number,wall:number,maxAge:number){
 return !!b&&b.valid&&b.connection==='LIVE'&&b.source!=='rest'&&mono>=b.receivedMono&&mono-b.receivedMono<=maxAge&&Math.abs(wall-b.receivedAt)<=maxAge&&(b.exchangeAt===null||(wall>=b.exchangeAt-1000&&wall-b.exchangeAt<=maxAge));
}
