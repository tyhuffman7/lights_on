import type {Quote} from './types.ts';
// USD x 10,000. Frozen paper stress allowances, not predicted expenses/fills.
export const recoveryPolicy=Object.freeze({id:'bounded-v1' as const,hedgeHeadroomPerContract:500,makerFeeBufferPerContract:100,transportMs:500,unwindWindowMs:2500});
export function makerAllocation(q:Quote){
 return {policy:recoveryPolicy.id,
  kalshi:q.aFill.cost+q.aFill.fees+Math.ceil(q.reserve/2)+Math.ceil(q.quantity*recoveryPolicy.makerFeeBufferPerContract),
  poly:q.bFill.cost+q.bFill.fees+Math.floor(q.reserve/2)+Math.ceil(q.quantity*recoveryPolicy.hedgeHeadroomPerContract)};
}
