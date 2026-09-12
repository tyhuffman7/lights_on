import type {SellPrint} from './maker-evidence.ts';
import type {Side} from './types.ts';

// A bounded selection hint, never fill evidence or a probability estimate.
export class MakerActivity {
 readonly windowMs=60000;
 private prints=new Map<string,{trade:SellPrint;receivedAt:number}>();
 prune(now:number){for(const [id,p] of this.prints)if(now-p.receivedAt>=this.windowMs||p.receivedAt>now)this.prints.delete(id);}
 observe(trade:SellPrint,receivedAt:number){
  this.prune(receivedAt);
  // Small exchange-clock lead is acceptable for ranking only. MakerQueue retains
  // its stricter activation/expiry timestamp checks before crediting any fill.
  if(trade.at>receivedAt+1000||receivedAt-trade.at>2000||this.prints.has(trade.id))return;
  if(this.prints.size>=10000)this.prints.delete(this.prints.keys().next().value!);
  this.prints.set(trade.id,{trade,receivedAt});
 }
 volume(marketId:string,side:Side,price:number,now:number){
  this.prune(now);let volume=0;
  for(const {trade} of this.prints.values())if(trade.marketId===marketId&&trade.side===side&&trade.price<=price)volume+=trade.quantity;
  return volume;
 }
}
export function makerActivityScore(volume:number,ahead:number,quantity:number,profit:number){
 return Math.min(1,volume/(ahead+quantity))*profit;
}
