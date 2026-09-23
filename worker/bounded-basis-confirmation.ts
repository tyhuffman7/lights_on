// Read-only adapter for the practical policy. Reuses requested WebSocket proof,
// never the legacy 2-cent cushion, one-contract selector or LIVE_EXACT gate.
import {assessSnapshot} from '../lib/screen/book-confirmation.ts';
import {ConfirmationFeed,confirmPolyBook,type RecordEvidence} from './book-confirmation-adapter.ts';
import type {Pair,Venue} from '../lib/arb/types.ts';
import {quoteBounded,admitBounded,freezeCandidate,reviewReasons,prerequisiteReasons,type Quote,type Review,type FeeEvidence,type Prerequisites} from '../lib/pilot/bounded-basis.ts';
import {createHash} from 'node:crypto';
export async function confirmBoundedCandidate(pair:Pair,original:Quote,review:Review,fees:Record<Venue,FeeEvidence>,
 feeds:{kalshi:Pick<ConfirmationFeed,'confirmKalshi'|'latest'|'health'>;poly:Pick<ConfirmationFeed,'latest'|'health'>},status:()=>{admitted:boolean},readAccounts:()=>Promise<Prerequisites>,record:RecordEvidence,
 options:{isolated:boolean;persistenceHealthy:()=>boolean;stopped:()=>boolean},requestPoly:typeof confirmPolyBook=confirmPolyBook){
 const requestedAt=Date.now();
 // An account reconciliation immediately before proof avoids aging while waiting
 // for an opportunity. Account reads and proof run concurrently, not REST prices.
 const [kr,pr,ar]=await Promise.allSettled([feeds.kalshi.confirmKalshi(pair.a.id),requestPoly(pair.b.id,()=>feeds.poly.latest.get(pair.b.id),()=>feeds.poly.health(),record),readAccounts()]);
 if([kr,pr,ar].some(r=>r.status==='rejected'))return {status:'FAILED',candidate:null,reasons:['CONFIRMATION_OR_ACCOUNT_READ_FAILED']};
 const k=(kr as PromiseFulfilledResult<Awaited<ReturnType<ConfirmationFeed['confirmKalshi']>>>).value;
 const p=(pr as PromiseFulfilledResult<Awaited<ReturnType<typeof confirmPolyBook>>>).value;
 const accounts=(ar as PromiseFulfilledResult<Prerequisites>).value,at=Date.now(),mono=performance.now();
 const ka=assessSnapshot(k.request,k.response,feeds.kalshi.latest.get(pair.a.id),feeds.kalshi.health(),at,mono);
 const pa=assessSnapshot(p.request,p.response,feeds.poly.latest.get(pair.b.id),feeds.poly.health(),at,mono);
 const reasons=[...k.reasons,...p.reasons,...ka.reasons,...pa.reasons];
 if(Math.abs(k.response.e.book.receivedMono-p.response.e.book.receivedMono)>2000)reasons.push('CROSS_VENUE_CONFIRMATION_DELAY');
 if(options.stopped())reasons.push('WATCH_STOPPED');
 const proof={requestedAt,confirmedAt:at,kalshi:{...k,...ka},poly:{...p,...pa},reasons};
 const evidenceSha256=createHash('sha256').update(JSON.stringify(proof)).digest('hex');record('BOUNDED_REQUESTED_BOOK_PROOF',{...proof,evidenceSha256});
 const q=quoteBounded(pair,{kalshi:ka.selected.e.book,poly:pa.selected.e.book},original.aSide,fees,review.expectedReleaseAt,at,original.quantity)[0];
 if(!q||q.quantity!==original.quantity||q.aSide!==original.aSide||q.bSide!==original.bSide||original.pairId!==pair.id||
   original.hashes[0]!==pair.a.hash||original.hashes[1]!==pair.b.hash||original.feeEvidenceHash!==q.feeEvidenceHash)reasons.push('EXACT_FROZEN_QUANTITY_OR_FEES_CHANGED');
 if(reasons.length||!q)return {status:'FAILED',candidate:null,reasons:[...new Set(reasons)]};
 const confirmation={pairId:q.pairId,quantity:q.quantity,aSide:q.aSide,bSide:q.bSide,hashes:q.hashes,accepted:true,requestedAt,confirmedAt:at,evidenceSha256,
  isolatedFeedsHealthy:options.isolated&&Object.values(feeds).every(f=>{const h=f.health();return h.connected&&h.clockOkay&&h.backlog===0;}),
  marketStatusOpen:status().admitted&&pa.selected.e.book.open,persistenceHealthy:options.persistenceHealthy()};
 const admission=admitBounded(pair,review,q,accounts,confirmation,at);
 const candidate=admission.candidate?freezeCandidate(pair,review,q,accounts,confirmation,at):null;
 record('BOUNDED_CONFIRMATION_RESULT',{admission,quote:q,candidate});
 return {status:q.feeNetProfit>0?'EDGE_SURVIVED':'EDGE_DISAPPEARED',candidate,reasons:admission.reasons};
}
// This pre-watch boundary must run before sockets or a single-use watch marker.
// It is deliberately separate from price health, which is established by the watch.
export function requireWatchPrerequisites(entries:{pair:Pair;review:Review}[],input:Prerequisites,now:number){
 if(!entries.length)throw Error('NO_REVIEWED_ROUTES');
 const reasons=entries.flatMap(e=>[...reviewReasons(e.pair,e.review,now),...prerequisiteReasons(input,e.review.productClasses,now)]);
 if(reasons.length)throw Error([...new Set(reasons)].join(';'));
}
