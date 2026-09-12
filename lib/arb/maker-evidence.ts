import {quantityUnits} from './fractional.ts';
import type {Side} from './types.ts';
export type SellPrint={id:string;marketId:string;side:Side;price:number;quantity:number;at:number};
// Outcome/book direction are aliases (yes=bid, no=ask), not maker/taker roles.
// Use explicit YES price and complement for NO; never infer the trade price scale.
export function kalshiSellPrint(message:Record<string,any>):SellPrint|null{
 const m=message.type==='trade'&&message.msg;if(!m||m.is_block_trade===true||!m.trade_id||!m.market_ticker)return null;

 const taker=m.taker_outcome_side??m.taker_side;if(!['yes','no'].includes(taker)||(m.taker_side!==undefined&&m.taker_side!==taker))return null;
 if(m.taker_book_side!==undefined&&m.taker_book_side!==(taker==='yes'?'bid':'ask'))return null;
 const side:Side=taker==='yes'?'no':'yes',p=m.yes_price_dollars;
 if(!/^(0?\.\d{1,4})$/.test(String(p))||!/^\d+(\.\d{1,4})?$/.test(String(m.count_fp)))return null;
 const yesPrice=Math.round(Number(p)*10000),price=side==='yes'?yesPrice:10000-yesPrice,quantity=Number(m.count_fp),at=m.ts_ms??Number(m.ts)*1000;
 if(price<=0||price>=10000||!Number.isFinite(quantity)||quantity<=0||!Number.isSafeInteger(at)||at<=0)return null;
 return {id:String(m.trade_id),marketId:String(m.market_ticker),side,price,quantity,at};
}
export class MakerQueue{
 seen=new Set<string>();filled=0;invalidated=false;
 marketId:string;side:Side;price:number;quantity:number;ahead:number;activeAt:number;expiresAt:number;
 constructor(marketId:string,side:Side,price:number,quantity:number,ahead:number,activeAt:number,expiresAt:number){
  this.marketId=marketId;this.side=side;this.price=price;this.quantity=quantity;this.ahead=ahead;this.activeAt=activeAt;this.expiresAt=expiresAt;
  if(!marketId||!['yes','no'].includes(side)||!Number.isSafeInteger(price)||price<=0||price>=10000||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(ahead)||ahead<0||expiresAt<=activeAt)throw Error('Invalid maker queue');
 }
 invalidate(){this.invalidated=true;}
 consume(t:SellPrint,receivedAt:number){
  if(this.invalidated||t.marketId!==this.marketId||t.side!==this.side||t.at<this.activeAt||t.at>=this.expiresAt||receivedAt>=this.expiresAt||t.at>receivedAt||receivedAt-t.at>2000||t.price>this.price||this.seen.has(t.id))return 0;
  if(this.seen.size>=10000){this.invalidate();return 0;}this.seen.add(t.id);
  // Never infer queue progress from cancellations, a touch, or book-size changes.
  // Retain initial visible depth ahead even if a print occurs through our price.
  const aheadUnits=quantityUnits(this.ahead),tradeUnits=quantityUnits(t.quantity),consumed=Math.min(aheadUnits,tradeUnits);this.ahead=(aheadUnits-consumed)/10000;
  const fillUnits=Math.min(quantityUnits(this.quantity)-quantityUnits(this.filled),tradeUnits-consumed);this.filled=(quantityUnits(this.filled)+fillUnits)/10000;return fillUnits/10000;
 }
}
