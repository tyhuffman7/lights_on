import type {RecallRoute,ObservedBook} from './recall-detector.ts';
import {recallSignals,currentBook,singleEventWinner} from './recall-detector.ts';
import {normalizeText} from './identity.ts';
import {catalogEntities} from './entities.ts';
import {comparePropositions} from './proposition.ts';
import {assessSettlement} from './settlement-validation.ts';
export type HotSignal=ReturnType<typeof recallSignals>[number];
export type Pending={key:string;route:RecallRoute;signal:HotSignal;queuedAt:number;firstQueuedAt:number};
export const candidateKey=(r:RecallRoute,s:HotSignal)=>r.pair.id+':'+s.evaluation.kalshiSide;
const semanticPriority=(r:RecallRoute)=>r.semanticClass==='STRICT_EQUIVALENT'?3:r.semanticClass==='ORDINARY_EQUIVALENT_BASIS_RISK'?2:r.semanticClass==='DIFFERENT_QUESTION'?0:1;
export function priority(a:Pending,b:Pending){return semanticPriority(b.route)-semanticPriority(a.route)|| ({CANONICAL:3,SPORTS_EVENT:2,TEXT:1}[b.route.matchSource])-({CANONICAL:3,SPORTS_EVENT:2,TEXT:1}[a.route.matchSource])||
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
// Native named outcomes in one explicit two-participant winner book determine the complement orientation.
export function namedOrientation(route:RecallRoute):boolean|null{
 const registry=catalogEntities([route.pair.a.identity,route.pair.b.identity]);
 const a=route.pair.a.identity&&registry.normalize({...route.pair.a.identity,competition:route.pair.a.identity.competition??route.pair.b.identity?.competition}),b=route.pair.b.identity&&registry.normalize(route.pair.b.identity);
 if(!a?.sports||!b?.sports||!(a.marketType==='winner'||singleEventWinner(route.pair.a))||!(b.marketType==='winner'||singleEventWinner(route.pair.b))||!a.outcome||!b.outcome||
  !a.eventDate||a.eventDate!==b.eventDate)return null;
 const participants=b.participants.length===2?b.participants:a.participants;
 if(participants.length!==2||!participants.includes(a.outcome)||!participants.includes(b.outcome))return null;
 return a.outcome!==b.outcome;
}
// These vetoes describe explicit ordinary questions, never missing metadata.
function legacyDifferentQuestion(route:RecallRoute){
 const [a,b]=[route.pair.a,route.pair.b];const text=(m:typeof a)=>normalizeText(m.title+' '+m.outcome+' '+m.rules.split('\n')[0]);
 const x=text(a),y=text(b),reasons:string[]=[];
 const dimension=(name:string,fn:(s:string)=>string|undefined)=>{const p=fn(x),q=fn(y);if(p&&q&&p!==q)reasons.push(name+':'+p+' vs '+q);};
 const orientation=namedOrientation(route);if(orientation!==null&&orientation!==route.pair.inverted)reasons.push('Native named winner outcomes contradict route orientation');
 dimension('season predicate',s=>/undefeated regular season|regular season undefeated|undefeated.*regular season/.test(s)?'undefeated':/finish.*top.*(?:big ten|conference|regular season)/.test(s)?'standings-ranking':/at least.*wins|over.*wins/.test(s)&&/season/.test(s)?'win-count':undefined);
 dimension('chart metric',s=>/year in search|google.*search/.test(s)?'google-search':/spotify/.test(s)?'spotify':/billboard/.test(s)?'billboard':undefined);
 dimension('payout shape',s=>/each yes contract pays|scalar market|escalator|yards ladder/.test(s)?'scalar':/settle to yes if|then the market resolves to yes|this market will settle to yes/.test(s)?'binary':undefined);
 dimension('combined outcomes',s=>/all of the following occur|combination market|presidential ticket|nominee is.*and.*nominee is/.test(s)?'conjunction':/this market will settle to yes if|if .+ (?:wins|win|comes|receives)/.test(s)?'single-outcome':undefined);
 dimension('country',s=>/senate|presidential|election/.test(s)?/brazil|brazilian/.test(s)?'brazil':/united states|u s senate|u s house|us presidential/.test(s)?'united-states':undefined:undefined);
 dimension('playoff stage',s=>!/playoff/.test(s)?undefined:/quarterfinal/.test(s)?'quarterfinal':/semifinal/.test(s)?'semifinal':/top 4 seed/.test(s)?'top-four-seed':/qualif|advances|reach/.test(s)?/national championship|final qualif/.test(s)?'championship-final':'any-playoff':undefined);
 dimension('election round',s=>!/presidential.*election|election.*winner/.test(s)?undefined:/first round|first-round/.test(s)?'first-round':/including any potential runoff|presidential election winner/.test(s)?'whole-election':undefined);
 dimension('team/aggregate conference',s=>/a team from|conference to win.*national championship/.test(s)?'any-team-in-conference':/if .+ wins|will .+ win/.test(s)&&/college football|championship/.test(s)?'named-team':undefined);
 dimension('economic metric',s=>{const ms=[['fantasy points',/fantasy points|fantasy scoring/],['QBR',/\bqbr\b/],['passing touchdowns',/passing touchdowns|passing tds/],['passing yards',/passing yards/],['rushing yards',/rushing yards/],['receiving yards',/receiving yards/],['receptions',/\breceptions\b/],['MVP',/most valuable player|\bmvp\b/],['Cy Young',/cy young/]] as const;return ms.find(([,r])=>r.test(s))?.[0];});
 dimension('election metric',s=>/margin of victory/.test(s)?'victory-margin':/popular vote|vote share|percentage of.*vote|receive at least.*%/.test(s)?'vote-share':/\d+[- ]\d+ house seats|how many.*seats|win \d+.*seats/.test(s)?'seat-count':
  /control.*house|house.*midterm winner/.test(s)?'national-control':/election.*winner|wins? the.*election|win.*gubernatorial election/.test(s)?'election-winner':undefined);
 dimension('relative performance',s=>/underperform|outperform|more fantasy points than|fewer.*than/.test(s)?'relative-to-named-comparator':/election winner|season leader|regular season leader/.test(s)?'absolute-winner-or-leader':undefined);
 dimension('elimination/winner',s=>/elimination|eliminated/.test(s)?'elimination':/win.*(?:big brother|dancing)|(?:big brother|dancing).*winner/.test(s)?'winner':undefined);
 dimension('finish rank',s=>{const m=s.match(/(?:finish(?:es)?(?: in)? |season \d+ )([2-9])(?:nd|rd|th)?(?: place|\b)/)??s.match(/\b([2-9])(?:nd|rd|th) place/);
  if(m)return 'place:'+m[1];const w=s.match(/\b(second|third|fourth|fifth)[ -]place/);if(w)return 'place:'+({second:2,third:3,fourth:4,fifth:5} as Record<string,number>)[w[1]];
  const numbered=s.match(/(?:be|ranked|rank|position) (?:number )?([2-9])\b/);if(numbered)return 'place:'+numbered[1];const top=s.match(/\btop (\d+)\b/);if(top)return 'top:'+top[1];
  return /season.*winner|winner.*season|\bwin(?:ner)?\b.*(?:ballon d or|big brother|dancing)|ballon d or.*winner|election.*winner|receives the most valid votes|top us netflix (?:show|movie)/.test(s)?'place:1':undefined;});

 dimension('qualifier/winner',s=>/qualify for|qualifiers|reach.*championship game/.test(s)?'qualifier':/win.*(?:championship|clausura)|championship.*winner|league winner/.test(s)?'champion':undefined);
 dimension('office/stage',s=>/\bvp nominee|vice president.*nominee/.test(s)?'vp-nomination':/democratic nominee|republican nominee|presidential.*nominee/.test(s)&&!/defeat|election winner/.test(s)?'presidential-nomination':/presidential election|us presidential election winner/.test(s)?'presidential-election':undefined);
 dimension('award status',s=>/selected as a finalist|nominations|nominees/.test(s)?'nominee-finalist':/award|mvp|cy young/.test(s)&&/winner|selected|win/.test(s)?'award-winner':undefined);
 dimension('acting award',s=>/supporting actress/.test(s)?'supporting-actress':/supporting actor/.test(s)?'supporting-actor':/best actress/.test(s)?'leading-actress':/best actor/.test(s)?'leading-actor':undefined);
 dimension('political scope',s=>/control.*(?:house|senate)|(?:house|senate).*midterm winner|(?:house|senate).*control|majority.*(?:house|senate)/.test(s)?'national-control':
  /(?:alaska|nevada|state senate|state house|district|gubernatorial|governor|mayor)|(?:house|senate) (?:race|election|seat)/.test(s)?'local-race':undefined);
 dimension('competition scope',s=>/season|champion|apertura|clausura|series winner|world series|tournament winner/.test(s)?'season-series':/game winner|wins the .* game|winner of the .* game|match winner|wins the .* match|match scheduled|game scheduled|win against/.test(s)?'single-event':undefined);
 dimension('individual/aggregate',s=>/team total|combined|aggregate|national control/.test(s)?'aggregate':/player .* (?:yards|points)|individual/.test(s)?'individual':undefined);
 dimension('period',s=>s.match(/\b(?:first|second|third|fourth|1st|2nd|3rd|4th) (?:half|quarter|set)\b/)?.[0]??(/full (?:game|match)|entire game/.test(s)?'full-event':undefined));
 dimension('outcome kind',s=>/campaign|endorse|announce.*(?:candidacy|run for)/.test(s)?'campaign':/win.*(?:election|nomination)/.test(s)?'election-winner':undefined);
 for(const w of route.warnings)if(route.matchSource!=='CANONICAL'&&/^(DIMENSION|PROPOSITION)_CONFLICT:/.test(w))reasons.push(w);
 return reasons;
}
export function differentQuestion(route:RecallRoute){
 return [...new Set([...comparePropositions(route.pair,namedOrientation(route)).conflicts,...legacyDifferentQuestion(route)])];
}
export type SettlementClass='STRICT_EQUIVALENT'|'ORDINARY_EQUIVALENT_BASIS_RISK'|'DIFFERENT_QUESTION'|'UNRESOLVED';
export function paperSettlement(route:RecallRoute){
 const proposition=comparePropositions(route.pair,namedOrientation(route));
 const falseMatch=[...new Set([...proposition.conflicts,...legacyDifferentQuestion(route)])];
 const assessment=assessSettlement(route.pair);
 let classification:SettlementClass='UNRESOLVED';
 const checks=[...assessment.checks];
 if(falseMatch.length)classification='DIFFERENT_QUESTION';
 else if((proposition.ordinaryAligned||assessment.normalOutcomeMatched)&&!proposition.missing.some(x=>x.startsWith('Unconfirmed fixture timing:'))){
  classification='ORDINARY_EQUIVALENT_BASIS_RISK';
  checks.push(proposition.ordinaryAligned?'All required ordinary proposition dimensions align':'Existing native family proof aligns ordinary dimensions');
 }
 return {classification,strictEquivalent:false,guaranteedArbitrage:false,checks,
  divergenceBranches:[...new Set([...proposition.divergenceBranches,...assessment.risks])],
  blockers:[...proposition.missing,...assessment.blockers],differentQuestionReasons:falseMatch,proposition,assessment};
}
export function selectConfirmationBooks(route:RecallRoute,books:Record<'kalshi'|'poly',ObservedBook>|null,at:number){
 return (['kalshi','poly'] as const).filter(v=>!books||!currentBook(books[v],at));
}
