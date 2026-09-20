// Offline arithmetic only: no executor, network, ledger writes, or parameter search.
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {fractionalWalk} from '../lib/arb/maker-ledger.ts';
import {fractionalCost,makerFillFee} from '../lib/arb/fractional.ts';
import type {StreamBook} from '../lib/research/types.ts';
export const LATENCY_GRID_MS=[0,100,250,500,750,1000] as const;
const USD=10000;
export type Row={id:number;at:number;book:StreamBook};
// Receipt-indexed SCENARIO, not proof of historical processing availability.
// A newer unusable book censors the result; never fall back to an older cheap one.
export function latest(rows:Row[],venue:string,at:number){
 return rows.filter(r=>r.book.venue===venue&&r.at<=at).sort((a,b)=>b.at-a.at||b.id-a.id)[0]??null;
}
function usable(row:Row|null,now:number){
 const b=row?.book;
 return !!b&&b.open&&b.valid!==false&&(!b.connection||b.connection==='LIVE')&&now-b.receivedAt<=2000&&b.receivedAt<=now&&b.exchangeAt!==null&&now-b.exchangeAt<=2000&&b.exchangeAt<=now+1000;
}
export function entry(q:number){const principal=fractionalCost(q,4300),fees=makerFillFee(q,4300,175),reserve=fractionalCost(q,100);return {principal,fees,reserve,debit:principal+fees+reserve};}
export function buy(row:Row|null,q:number,at:number){
 if(!usable(row,at))return null;
 const fill=fractionalWalk(row!.book.no,q,695,'even');if(!fill)return null;
 const reserve=fractionalCost(q,100);return {principal:fill.cost,fees:fill.fees,reserve,debit:fill.cost+fill.fees+reserve,bookId:row!.id,quantity:q};
}
export function sell(row:Row|null,q:number,at:number){
 if(!Number.isInteger(q)||q<=0||!usable(row,at))return null;
 const fill=fractionalWalk(row!.book.yesBids.map(l=>({price:USD-l.price,quantity:l.quantity})),q,700);if(!fill)return null;
 const reserve=fractionalCost(q,100),gross=q*USD-fill.cost;
 return {gross,fees:fill.fees,reserve,proceeds:gross-fill.fees-reserve,bookId:row!.id,quantity:q,limit:Math.min(...fill.levels.map(l=>USD-l.price))};
}
export function full(q:number,row:Row|null,at:number,reservedB:number){
 const a=entry(q),b=buy(row,q,at),reasons:string[]=[];
 if(!b)reasons.push('BOOK_OR_FULL_DEPTH_UNAVAILABLE');
 if(b&&b.debit>reservedB)reasons.push('PREALLOCATED_HEDGE_BUDGET');
 if(b&&a.debit+b.debit>100000)reasons.push('MAX_TRADE');
 return {q,a,b,feasible:!reasons.length,reasons,conditionalProfit:b?q*USD-a.debit-b.debit:null,conditionalProfitBeforeReserves:b?q*USD-a.principal-a.fees-b.principal-b.fees:null,capitalUntilSettlement:b?a.debit+b.debit:null};
}
export function delayedUnwind(rows:Row[],q:number,decisionAt:number){
 const intent=sell(latest(rows,'kalshi',decisionAt),q,decisionAt),arrival=decisionAt+500,fill=sell(latest(rows,'kalshi',arrival),q,arrival);
 const accepted=!!intent&&!!fill&&fill.limit>=intent.limit&&fill.proceeds>=intent.proceeds;
 return {decisionAt,arrival,intent,fill:accepted?fill:null,status:accepted?'SCENARIO_FLAT':'UNRESOLVED_EXPOSURE',remaining:accepted?0:q,profit:accepted?fill!.proceeds-entry(q).debit:null};
}
export function partialRecovery(rows:Row[],q:number,decisionAt:number,reservedB:number){
 // Whole-contract hedge leaves a residual independently sellable on Kalshi's 1-contract grid.
 let quantity=0,quote:ReturnType<typeof buy>=null;
 for(let n=q-1;n>=1;n--){const b=buy(latest(rows,'poly',decisionAt),n,decisionAt);if(b&&b.debit<=reservedB&&entry(q).debit+b.debit<=100000){quantity=n;quote=b;break;}}
 if(!quantity)return {status:'NO_ADMISSIBLE_PARTIAL',quantity:0,profit:null};
 const arrival=decisionAt+500,fill=buy(latest(rows,'poly',arrival),quantity,arrival);
 // The quantity and budget are fixed at intent; a new arrival book cannot authorize more cash.
 if(!fill||fill.debit>reservedB||entry(q).debit+fill.debit>100000)return {status:'PARTIAL_IOC_FAILED',quantity,quote,arrival,fill:null,remaining:q,profit:null};
 const residual=q-quantity,unwind=delayedUnwind(rows,residual,arrival);
 const profit=unwind.fill?quantity*USD+unwind.fill.proceeds-entry(q).debit-fill.debit:null;
 return {status:unwind.fill?'CONDITIONAL_PAIR_WITH_RESIDUAL_SOLD':'RESIDUAL_UNRESOLVED',quantity,quote,arrival,fill,residual,unwind,conditionalProfit:profit,capitalUntilSettlement:entry(q).debit+fill.debit-(unwind.fill?.proceeds??0)};
}
export function hypothesis(rows:Row[],at:number){
 const hedge=full(9,latest(rows,'poly',at),at,60000),unwindQuote=sell(latest(rows,'kalshi',at),9,at);
 // Relative recovery criterion, not the profitable-new-entry criterion. No larger limits.
 const chooseHedge=hedge.feasible&&!!unwindQuote&&hedge.conditionalProfit!>=unwindQuote.proceeds-entry(9).debit;
 return {at,choice:chooseHedge?'FULL_HEDGE_CONDITIONAL':'UNWIND',hedge,unwindQuote,unwind:chooseHedge?null:delayedUnwind(rows,9,at)};
}
export function delayedHeadroom(rows:Row[],decisionAt:number,delay:number){
 const intent=hypothesis(rows,decisionAt),arrival=decisionAt+delay;
 if(intent.choice==='UNWIND')return {decisionAt,arrival,intent,choice:'UNWIND',recovery:delayedUnwind(rows,9,decisionAt)};
 // Freeze the loss comparison at submission. The arrival cannot relax the budget.
 const maxDebit=Math.min(60000,90000-intent.unwindQuote!.proceeds);
 const candidate=buy(latest(rows,'poly',arrival),9,arrival);
 const accepted=!!candidate&&candidate.debit<=maxDebit&&entry(9).debit+candidate.debit<=100000;
 return {decisionAt,arrival,intent,maxDebit,choice:accepted?'FULL_HEDGE_CONDITIONAL':'HEDGE_FAILED_THEN_UNWIND',fill:accepted?candidate:null,conditionalProfit:accepted?90000-entry(9).debit-candidate!.debit:null,capitalUntilSettlement:accepted?entry(9).debit+candidate!.debit:null,recovery:accepted?null:delayedUnwind(rows,9,arrival)};
}
export function audit(rows:Row[]){
 const receipt=1789852143840,fillDiagnostic=1789852143895,due=receipt+500;
 const scenario=(at:number)=>({at,polyBook:latest(rows,'poly',at)?.id??null,kalshiBook:latest(rows,'kalshi',at)?.id??null,baselineFull:full(10,latest(rows,'poly',at),at,54094),headroom:hypothesis(rows,at)});
 const planning=buy(latest(rows,'poly',1789852142254),9,1789852142254)!;
 const admission={quantity:9,kalshi:entry(9),plannedPoly:planning,plannedConditionalProfit:90000-entry(9).debit-planning.debit,reservedA:40000,reservedB:60000,totalReserved:100000,maxTrade:100000,maxCommitted:400000,priorCommitted:0,cashBefore:{kalshi:526096,poly:558324},cashAfterReservation:{kalshi:486096,poly:498324},headroom:60000-planning.debit};
 const basePoly=latest(rows,'poly',due)!,baseK=latest(rows,'kalshi',due)!;
 const stress=(name:string,price:number|null,quantity=100,failedExit=false)=>{
  const b=structuredClone(basePoly),k=structuredClone(baseK);b.at=due;b.book.receivedAt=due;b.book.exchangeAt=due;b.book.no=price===null?[]:[{price,quantity}];k.at=due;k.book.receivedAt=due;k.book.exchangeAt=due;
  const kArrival=structuredClone(k);kArrival.at=due+500;kArrival.book.receivedAt=due+500;kArrival.book.exchangeAt=due+500;if(failedExit)kArrival.book.yesBids=[];
  const inputs=[k,b,kArrival];return {name,scope:'SYNTHETIC_ADVERSE_INPUT_NOT_OBSERVED_TRADE',full10:full(10,b,due,54094),policy:hypothesis(inputs,due),partial:partialRecovery(inputs,9,due,60000)};
 };
 return {scope:'OFFLINE_CONDITIONAL_SCENARIOS_NOT_EXECUTIONS',units:'USD x 10000; all reported profit includes fees and simulated reserves',latencyGridMs:LATENCY_GRID_MS,knowledge:'Receipt-index selection; historical processing/health at hypothetical decisions unknown. Newer unusable data never replaced with older data.',baselineRecorded:{profit:-5300,profitBeforeReserves:-3300,openInventory:0,haltPreserved:true},admission,due:scenario(due),delayedHeadroom500:delayedHeadroom(rows,fillDiagnostic,500),partialAtDue:partialRecovery(rows,10,due,54094),unwindAtDue:delayedUnwind(rows,10,due),latency:LATENCY_GRID_MS.map(ms=>({ms,receiptAnchor:scenario(Math.max(fillDiagnostic,receipt+ms)),processingDiagnosticAnchor:scenario(fillDiagnostic+ms),delayedPolicy:delayedHeadroom(rows,fillDiagnostic,ms)})),adverse:[stress('captured-price-0.94',9400),stress('larger-than-due-0.70',7000),stress('extreme-0.99',9900),stress('insufficient-depth',5350,8),stress('missing-depth',null),stress('failed-recovery',9400,100,true)]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node --experimental-strip-types scripts/hedge-policy-audit.ts INPUT_CAPTURE_JSON OUTPUT_JSON');
 const data=JSON.parse(readFileSync(input,'utf8'));writeFileSync(output,JSON.stringify(audit(data.rows),null,2)+'\n');
}
