import type {StreamBook} from '../research/types.ts';
import type {Settings} from './types.ts';
import {fresh} from '../research/books.ts';
import {clockUsable} from './clock-window.ts';
import {makerHedgeViable,type MakerOrder} from './maker-ledger.ts';
// Observational fixed-price lifetime only. Does not reserve cash or generate fills.
export class QuoteLifetime{
 readonly order:MakerOrder;endedAt:number|null=null;reason:string|null=null;activatedAt:number|null=null;updates=0;queueAhead:number;
 constructor(order:MakerOrder,ahead:number){this.order=structuredClone(order);this.queueAhead=ahead;}
 end(reason:string,wall:number){if(this.endedAt===null){this.reason=reason;this.endedAt=wall;}}
 update(a:StreamBook|undefined,b:StreamBook|undefined,settings:Settings,authorized:boolean,healthy:boolean,wall:number,mono:number){
  if(this.endedAt!==null)return;this.updates++;const o=this.order;
  if(wall>=o.expiresAt){this.end('EXPIRED',wall);return;}
  if(!authorized){this.end('APPROVAL_INVALID',wall);return;}
  if(!o.clock||!clockUsable(o.clock,wall,mono)){this.end('CLOCK_INVALID',wall);return;}
  if(!healthy||a?.source!=='stream'||b?.source!=='stream'||a.marketId!==o.pair.a.id||b.marketId!==o.pair.b.id||a.venue!=='kalshi'||b.venue!=='poly'||!a.open||!b.open||!fresh(a,mono,wall,Math.min(settings.maxAge,2000))||!fresh(b,mono,wall,Math.min(settings.maxAge,2000))){this.end('BOOK_OR_STREAM_INVALID',wall);return;}
  if(!a[o.quote.aSide][0]||a[o.quote.aSide][0].price<=o.price){this.end('POST_ONLY_CROSS',wall);return;}
  if(!makerHedgeViable(o,b,settings)){this.end('HEDGE_NO_LONGER_VIABLE',wall);return;}
  if(this.activatedAt===null&&wall>=o.activeAt){
   this.activatedAt=wall;
   const ahead=(o.quote.aSide==='yes'?a.yesBids:a.noBids).filter(l=>l.price>=o.price).reduce((n,l)=>n+l.quantity,0);
   this.queueAhead=Math.max(this.queueAhead,ahead);
  }
 }
}
