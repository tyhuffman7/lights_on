import type {RecallRoute,ObservedBook} from './recall-detector.ts';
import {recallSignals,currentBook} from './recall-detector.ts';
import {normalizeText} from './identity.ts';
import {assessSettlement} from './settlement-validation.ts';
export type HotSignal=ReturnType<typeof recallSignals>[number];
export type Pending={key:string;route:RecallRoute;signal:HotSignal;queuedAt:number;firstQueuedAt:number};
export const candidateKey=(r:RecallRoute,s:HotSignal)=>r.pair.id+':'+s.evaluation.kalshiSide;
export function priority(a:Pending,b:Pending){return Number(b.route.matchSource==='CANONICAL')-Number(a.route.matchSource==='CANONICAL')||
 Number(a.route.warnings.includes('ORIENTATION_UNPROVEN'))-Number(b.route.warnings.includes('ORIENTATION_UNPROVEN'))||
 Number(b.signal.fresh)-Number(a.signal.fresh)||
 (b.signal.evaluation.estimatedNetProfit??-Infinity)-(a.signal.evaluation.estimatedNetProfit??-Infinity)||
 b.signal.evaluation.quantity-a.signal.evaluation.quantity||b.queuedAt-a.queuedAt;}
export class LatestCandidates {
 pending=new Map<string,Pending>();superseded=0;disappeared=0;peak=0;
 update(route:RecallRoute,signals:HotSignal[],at:number){
  for(const side of ['yes','no'] as const){const key=route.pair.id+':'+side,old=this.pending.get(key);
   const s=signals.filter(s=>s.evaluation.kalshiSide===side&&s.candidate).sort((a,b)=>Number(b.withinCapital)-Number(a.withinCapital)||
    (b.evaluation.estimatedNetProfit??-Infinity)-(a.evaluation.estimatedNetProfit??-Infinity)||b.evaluation.quantity-a.evaluation.quantity)[0];
   if(!s){if(old){this.pending.delete(key);this.disappeared++;}continue;}
   if(old)this.superseded++;
   this.pending.set(key,{key,route,signal:s,queuedAt:at,firstQueuedAt:old?.firstQueuedAt??at});
  }this.peak=Math.max(this.peak,this.pending.size);
 }
 next(){return [...this.pending.values()].sort(priority)[0];}
}
// These vetoes describe explicit ordinary questions, never missing metadata.
export function differentQuestion(route:RecallRoute){
 const [a,b]=[route.pair.a,route.pair.b];const text=(m:typeof a)=>normalizeText(m.title+' '+m.outcome+' '+m.rules.split('\n')[0]);
 const x=text(a),y=text(b),reasons:string[]=[];
 const dimension=(name:string,fn:(s:string)=>string|undefined)=>{const p=fn(x),q=fn(y);if(p&&q&&p!==q)reasons.push(name+':'+p+' vs '+q);};
 dimension('economic metric',s=>{const ms=[['fantasy points',/fantasy points|fantasy scoring/],['QBR',/\bqbr\b/],['passing touchdowns',/passing touchdowns|passing tds/],['passing yards',/passing yards/],['rushing yards',/rushing yards/],['receiving yards',/receiving yards/],['receptions',/\breceptions\b/],['MVP',/most valuable player|\bmvp\b/],['Cy Young',/cy young/]] as const;return ms.find(([,r])=>r.test(s))?.[0];});
 dimension('election metric',s=>/popular vote|vote share|percentage of.*vote|receive at least.*%/.test(s)?'vote-share':/\d+[- ]\d+ house seats|how many.*seats|win \d+.*seats/.test(s)?'seat-count':
  /control.*house|house.*midterm winner/.test(s)?'national-control':/election.*winner|wins? the.*election|win.*gubernatorial election/.test(s)?'election-winner':undefined);
 dimension('relative performance',s=>/underperform|outperform|more fantasy points than|fewer.*than/.test(s)?'relative-to-named-comparator':/election winner|season leader|regular season leader/.test(s)?'absolute-winner-or-leader':undefined);
 dimension('finish rank',s=>/finish in.*(?:2 place|3 place|second|third|top [2-9])|placing (?:second|third)|top (?:five|ten)|top (?:5|10)/.test(s)?'non-winner-rank':/season.*winner|winner.*season|\bwin(?:ner)?\b.*(?:ballon d or|big brother|dancing)|ballon d or.*winner/.test(s)?'winner':undefined);
 dimension('qualifier/winner',s=>/qualify for|qualifiers|reach.*championship game/.test(s)?'qualifier':/win.*(?:championship|clausura)|championship.*winner/.test(s)?'champion':undefined);
 dimension('office/stage',s=>/\bvp nominee|vice president.*nominee/.test(s)?'vp-nomination':/democratic nominee|republican nominee|presidential.*nominee/.test(s)&&!/defeat|election winner/.test(s)?'presidential-nomination':/presidential election|us presidential election winner/.test(s)?'presidential-election':undefined);
 dimension('award status',s=>/selected as a finalist|nominations|nominees/.test(s)?'nominee-finalist':/award|mvp|cy young/.test(s)&&/winner|selected|win/.test(s)?'award-winner':undefined);
 dimension('acting award',s=>/supporting actress/.test(s)?'supporting-actress':/supporting actor/.test(s)?'supporting-actor':/best actress/.test(s)?'leading-actress':/best actor/.test(s)?'leading-actor':undefined);
 dimension('political scope',s=>/control.*(?:house|senate)|house.*midterm winner|(?:house|senate).*control|majority.*(?:house|senate)/.test(s)?'national-control':
  /(?:alaska|district|gubernatorial|governor|mayor)|(?:house|senate) (?:race|election|seat)/.test(s)?'local-race':undefined);
 dimension('competition scope',s=>/season|championship|series winner|world series|tournament winner/.test(s)?'season-series':/game winner|wins the .* game|winner of the .* game|match winner|wins the .* match|match scheduled|game scheduled|win against/.test(s)?'single-event':undefined);
 dimension('individual/aggregate',s=>/team total|combined|aggregate|national control/.test(s)?'aggregate':/player .* (?:yards|points)|individual/.test(s)?'individual':undefined);
 dimension('period',s=>s.match(/\b(?:first|second|third|fourth|1st|2nd|3rd|4th) (?:half|quarter|set)\b/)?.[0]??(/full (?:game|match)|entire game/.test(s)?'full-event':undefined));
 dimension('outcome kind',s=>/campaign|announce.*(?:candidacy|run for)/.test(s)?'campaign':/win.*(?:election|nomination)/.test(s)?'election-winner':undefined);
 for(const w of route.warnings)if(route.matchSource!=='CANONICAL'&&/^(DIMENSION|PROPOSITION)_CONFLICT:/.test(w))reasons.push(w);
 return reasons;
}
export type SettlementClass='STRICT_EQUIVALENT'|'ORDINARY_EQUIVALENT_BASIS_RISK'|'MATERIAL_SETTLEMENT_DIFFERENCE'|'DIFFERENT_QUESTION'|'UNRESOLVED';
export function paperSettlement(route:RecallRoute){
 const falseMatch=differentQuestion(route);const assessment=assessSettlement(route.pair);
 let classification:SettlementClass='UNRESOLVED';let branches=[...assessment.risks];const checks=[...assessment.checks];
 if(falseMatch.length)classification='DIFFERENT_QUESTION';
 else if(assessment.normalOutcomeMatched){classification='ORDINARY_EQUIVALENT_BASIS_RISK';}
 else if(route.pair.a.series==='KXNCAAFWINS'&&route.matchSource==='CANONICAL'){
  classification='ORDINARY_EQUIVALENT_BASIS_RISK';checks.push('Canonical same named team, season and integer win predicate');
  branches=['Modified or shortened season: actual count versus fair-price settlement/review','Corrections after expiration versus official-result finality before settlement','Named-source hierarchy versus exchange/governing-body sources','Different expiry, review and extension deadlines'];
 }else if(/IPO/i.test(route.pair.a.series??'')&&route.matchSource==='CANONICAL'){
  classification='ORDINARY_EQUIVALENT_BASIS_RISK';checks.push('Same canonical company and ordinary IPO confirmation predicate; full IPOEVENTANNOUNCE includes foreign filing equivalents');
  branches=['IPO issuance and contingency language remain unresolved','Deadline interpretation and source cutoffs may diverge','Listing approval, review and expiration-extension branches require full clause review'];
 }else if(assessment.status==='CONFLICT'&&!assessment.blockers.some(s=>/matching rejects|unavailable|unsupported|missing/i.test(s)))classification='MATERIAL_SETTLEMENT_DIFFERENCE';
 return {classification,strictEquivalent:false,guaranteedArbitrage:false,checks,divergenceBranches:branches,
  blockers:assessment.blockers,differentQuestionReasons:falseMatch,assessment};
}
export function selectConfirmationBooks(route:RecallRoute,books:Record<'kalshi'|'poly',ObservedBook>|null,at:number){
 return (['kalshi','poly'] as const).filter(v=>!books||!currentBook(books[v],at));
}
