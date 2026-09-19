import type {Pair} from './types.ts';
import type {StreamBook} from '../research/types.ts';
import {fresh} from '../research/books.ts';
import {clockUsable,type ClockWindow} from './clock-window.ts';
import {validPaperApproval,type ConditionalPaperApproval} from './paper-approval.ts';
// Eligibility to evaluate current conditional-paper economics, never an order/fill approval.
export function paperPreflightGate(pair:Pair,approval:ConditionalPaperApproval|undefined,a:StreamBook|undefined,b:StreamBook|undefined,clock:ClockWindow|undefined,healthy:boolean,wall:number,mono:number){
 const reasons:string[]=[];
 if(!validPaperApproval(approval,pair,wall))reasons.push('CONDITIONAL_APPROVAL_INVALID');
 if(!pair.a.open||!pair.b.open)reasons.push('MARKET_CLOSED');
 if(!clock||!clockUsable(clock,wall,mono))reasons.push('CLOCK_INVALID');
 if(!healthy)reasons.push('STREAM_UNHEALTHY');
 for(const [venue,market,book] of [['kalshi',pair.a,a],['poly',pair.b,b]] as const){
  if(!book||book.venue!==venue||book.marketId!==market.id||book.source!=='stream')reasons.push(venue.toUpperCase()+'_STREAM_BOOK_REQUIRED');
  else if(!book.open||!fresh(book,mono,wall,2000))reasons.push(venue.toUpperCase()+'_BOOK_NOT_FRESH');
 }
 return {eligible:reasons.length===0,reasons,scope:'PAPER_ECONOMICS_PREFLIGHT_NOT_EXECUTION' as const};
}
