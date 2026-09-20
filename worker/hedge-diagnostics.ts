import type {StreamBook} from '../lib/research/types.ts';
import {fractionalWalk,type MakerOrder,type HedgeDecision} from '../lib/arb/maker-ledger.ts';
import {fresh} from '../lib/research/books.ts';

export function hedgeBookState(raw:StreamBook|undefined,healthy:boolean|null,wall:number,mono:number,maxAge:number){
 const reason=!raw?'BOOK_MISSING':raw.source!=='stream'?'BOOK_NOT_STREAM':!healthy?'STREAM_UNHEALTHY':!raw.valid?'BOOK_INVALID':raw.connection!=='LIVE'?'BOOK_CONNECTION_INVALID':mono<raw.receivedMono?'MONOTONIC_FUTURE':mono-raw.receivedMono>maxAge?'MONOTONIC_STALE':Math.abs(wall-raw.receivedAt)>maxAge?'RECEIPT_OUTSIDE_WINDOW':raw.exchangeAt!==null&&wall<raw.exchangeAt-1000?'EXCHANGE_FUTURE':raw.exchangeAt!==null&&wall-raw.exchangeAt>maxAge?'EXCHANGE_STALE':null;
 return {raw,usable:!!raw&&raw.source==='stream'&&!!healthy&&fresh(raw,mono,wall,maxAge),reason,healthy,checkedAt:wall,checkedMono:mono};
}
export type HedgeBookState=ReturnType<typeof hedgeBookState>;
export function compactHedgeBook(view:HedgeBookState){
 const b=view.raw;
 return {reference:b?.capture??null,marketId:b?.marketId??null,receivedAt:b?.receivedAt??null,receivedMono:b?.receivedMono??null,exchangeAt:b?.exchangeAt??null,sequence:b?.sequence??null,source:b?.source??null,open:b?.open??null,valid:b?.valid??null,connection:b?.connection??null,streamHealthy:view.healthy,usable:view.usable,rejection:view.reason,checkedAt:view.checkedAt,checkedMono:view.checkedMono,receiptAgeMs:b?view.checkedAt-b.receivedAt:null,exchangeAgeMs:b&&b.exchangeAt!==null?view.checkedAt-b.exchangeAt:null};
}
export function hedgeEconomics(order:MakerOrder,view:HedgeBookState,decision:HedgeDecision){
 // A quote from an unusable book is diagnostic only. Never feed it back to execution.
 const fill=decision.fill??(view.raw&&decision.remaining>0?fractionalWalk(view.raw[order.quote.bSide],decision.remaining,order.pair.b.feeRate!,'even'):null);
 return {requiredPrincipal:fill?.cost??null,requiredFees:fill?.fees??null,fullDepth:!!fill,pricingScope:view.usable?'CURRENT_BOOK_QUOTE':'UNUSABLE_BOOK_QUOTE_ONLY'};
}
