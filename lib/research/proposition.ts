// Ordinary predicates only. This representation never certifies exceptional
// settlement branches and never grants execution admission.
import type {Market,Pair} from '../arb/types.ts';
import {normalizeText,canonicalCompetition} from './identity.ts';
import {catalogEntities} from './entities.ts';
import {canonicalTemplate,canonicalTemplateKey} from './canonical-template.ts';
import {differenceDimensions,nativeDifferences,fixtureTimingUncertainty} from './proposition-differences.ts';

export const propositionDimensions=['subject','event','competition','family','metric','outcome','comparator','threshold','unit','timeframe','period','stage','geography','scope','conditions','settlementScope',...differenceDimensions] as const;
export type PropositionDimension=typeof propositionDimensions[number];
export type Proposition={version:1;dimensions:Partial<Record<PropositionDimension,string>>;
 evidence:Partial<Record<PropositionDimension,string>>;unknown:PropositionDimension[];canonicalKey?:string};
// Vocabulary maps phrase forms into dimensions, rather than excluding market IDs.
const statistics:[string,RegExp,string][]=[
 ['rushing-attempts',/rushing attempts|rush attempts|carries/,'attempts'],
 ['passing-attempts',/passing attempts|pass attempts/,'attempts'],
 ['passing-interceptions',/interceptions thrown|passing interceptions/,'interceptions'],
 ['passing-touchdowns',/passing touchdowns|passing tds/,'touchdowns'],
 ['rushing-touchdowns',/rushing touchdowns|rushing tds/,'touchdowns'],
 ['receiving-touchdowns',/receiving touchdowns|receiving tds/,'touchdowns'],
 ['passing-yards',/passing yards/,'yards'],['rushing-yards',/rushing yards/,'yards'],
 ['receiving-yards',/receiving yards/,'yards'],['receptions',/\breceptions\b/,'receptions'],
 ['fantasy-points',/fantasy points|fantasy scoring/,'points'],['qbr',/\bqbr\b/,'rating'],
 ['home-runs',/home runs/,'runs'],['rbi',/runs batted in|\brbis?\b/,'runs'],
 ['strikeouts',/strikeouts/,'strikeouts'],['hits',/\bhits\b/,'hits']];
const seasonBranches=['Modified/shortened season and cancellation: actual count versus independent fair-price settlement',
 'Corrections and disqualification after expiry versus official-result finality',
 'Native source precedence, review rights and administrative extensions', 'Different deadlines and settlement timing'];
export const settlementFamilyProfiles:Record<string,{required:PropositionDimension[];branches:string[]}>={
 'season-wins':{required:['subject','competition','metric','comparator','threshold','unit','timeframe','period','scope','conditions'],branches:seasonBranches},
 championship:{required:['subject','competition','metric','timeframe','stage','scope','conditions'],branches:seasonBranches},
 qualification:{required:['subject','competition','metric','timeframe','stage','scope','conditions'],branches:seasonBranches},
 ranking:{required:['subject','competition','metric','comparator','threshold','timeframe','stage','scope','conditions'],branches:[...seasonBranches,'Ties, ranking publication and source finality']},
 'player-statistic':{required:['subject','event','competition','metric','comparator','threshold','unit','timeframe','period','scope','conditions'],branches:[...seasonBranches,'Participation, nullified snaps, overtime and stat corrections']},
 'statistic-leader':{required:['subject','competition','metric','outcome','timeframe','period','scope','conditions'],branches:[...seasonBranches,'Tied leaders may receive fractional payouts']},
 election:{required:['subject','metric','outcome','timeframe','geography','scope','conditions'],branches:[...seasonBranches,'Runoff, recount and office-holder certification']},
 nomination:{required:['subject','metric','outcome','timeframe','geography','scope','conditions'],branches:[...seasonBranches,'Acceptance, substitution and party selection procedure']},
 ipo:{required:['subject','metric','timeframe','conditions'],branches:['Issuance, foreign filing, listing and contingent announcement treatment','Deadline interpretation, source cutoffs and extension/review rights']},
 award:{required:['subject','metric','outcome','timeframe','conditions'],branches:[...seasonBranches,'Award category, ties and withdrawn nominations']}
};

export function structuredProposition(m:Market,registry=catalogEntities([m.identity])):Proposition{
 m={...m,identity:m.identity&&registry.normalize(m.identity)};
 const d:Proposition['dimensions']={},e:Proposition['evidence']={};
 const primary=m.rules.trim().split('\n')[0].split(/\. (?=[A-Z])/)[0].trim();
 const title=normalizeText(m.title),clause=normalizeText(primary),s=clause||title;
 const put=(k:PropositionDimension,v:string|undefined,proof=primary)=>{if(v){d[k]=v;e[k]=proof;}};
 const canonical=canonicalTemplate(m,registry);
 const resolve=(v:string)=>normalizeText((registry.resolve(normalizeText(v.replace(/^the /i,'')),m.identity?.competition)??v.replace(/^the /i,'')).split(':').at(-1));
 // Named ordinary subject is taken from the payout clause where possible.
 const subject=primary.match(/^(?:If|This market will settle to Yes if) (?:the )?(.+?) (?:college football team has|records?|scores?|finishes|goes|leads|accepts|wins?|advances|is selected|is one of|is the|receives|defeats|has|becomes|will be|comes|qualifies|is nominated|leaves|departs)\b/i)?.[1];
 const named=m.identity?.general?.person??m.identity?.participant??m.identity?.outcome;
 put('subject',subject?resolve(subject):named&&!/^(yes|no|over|under|unknown long|unknown short|before .+|after .+)$/i.test(named)?resolve(named):undefined);
 const competition=[[/usl championship/,'uslc'],[/champions league/,'uefa-champions-league'],[/europa league/,'uefa-europa-league'],[/english premier league/,'epl'],[/major league soccer|\bmls\b/,'mls'],[/college football/,'cfb'],[/pro(?:fessional)? football|national football conference|\bnfc\b|\bafc\b/,'nfl']] as const;
 put('competition',competition.find(([r])=>r.test(s+' '+title))?.[1]||canonicalCompetition(m.identity?.competition)||undefined);
 const year=s.match(/\b(20\d\d)(?:[ -](?:20)?\d\d)?\b/)?.[1];
 const period=/regular season/.test(s)?'regular-season':/postseason|playoffs/.test(s)?'postseason':/career|retirement/.test(s)?'career':undefined;
 put('period',s.match(/\b(?:first|second|third|fourth|1st|2nd|3rd|4th) (?:half|quarter|set|period)\b/)?.[0]??period);
 put('timeframe',year?'season:'+year:undefined);
 // Conditions are material ordinary restrictions, not the word "If" that
 // introduces every Kalshi payout. Read titles as well as native payout prose.
 const condition=m.title.match(/with (.+? as the .+? nominee(?: and .+? as the .+? nominee)?)(?:\?|$)/i);
 const dependent=(m.title+' '+primary).match(/(?:conditional on|provided that|only if|assuming|in the event that) (.+?)(?:, then|\.|\?|$)/i)??m.title.match(/^Will .+?\bif (.+?)(?:\?|$)/i);
 const opponent=primary.match(/\bdefeats? (.+?) in the /i)?.[1];
 put('conditions',condition?'nominees:'+normalizeText(condition[1]):dependent?'conditional:'+normalizeText(dependent[1]):opponent?'opponent:'+resolve(opponent):primary?'unconditional':undefined);
 const stat=statistics.find(([,r])=>r.test(s));
 if(stat){put('family',/leads|most|leader|highest/.test(s)?'statistic-leader':'player-statistic');put('metric',stat[0]);put('unit',stat[2]);put('scope',/team total|teams collectively|combined/.test(s)?'team':'player');}
 if(/first touchdown|1st touchdown/.test(s+' '+title)){
  put('family','player-statistic');put('metric','first-touchdown');put('unit','rank');put('scope','player');
  put('settlementScope',/first touchdown for|first .+ touchdown/.test(s+' '+title)&&!/first touchdown in/.test(s)?'team-touchdowns':'game-touchdowns');
 }
 if(/\bwins\b/.test(s)&&/season/.test(s)&&!stat){put('family','season-wins');put('metric','team-wins');put('scope','team');put('unit','wins');put('settlementScope',/home/.test(s)?'home-games':'all-regular-season-games');}
 if(/undefeated/.test(s)){put('family','season-wins');put('metric','zero-losses');put('comparator','eq');put('threshold','0');put('unit','losses');put('scope','team');put('settlementScope',/home games|undefeated at home/.test(s)?'home-games':'all-regular-season-games');}
 const eventWinner=/\b(?:game|match|fight) (?:originally )?scheduled\b/.test(s)&&/^(?:If .+ wins the |This market will settle to the winner)/i.test(primary);
 const seed=s.match(/(?:selected as the|is the) (\d+)(?:st|nd|rd|th)? seed/);
 const rank=s.match(/finishes? (?:in )?(?:the )?(?:first|last|(?:\d+)(?:st|nd|rd|th)?)(?: \((\d+)(?:st|nd|rd|th)?\))?/);
 const top=s.match(/(?:top|at least) (\d+) (?:finish|place|seed)/);
 const qualifying=/qualif|advances to|reach.+(?:championship|playoff|round|final)/.test(s);
 if(seed){put('family','ranking');put('metric','seed');put('comparator','eq');put('threshold',seed[1]);put('scope','team');}
 else if(/league phase/.test(s)&&/finish/.test(s)){
  put('family','ranking');put('metric','finish-rank');put('comparator',top?'lte':'eq');
  put('threshold',top?.[1]??rank?.[1]??(/first|top finisher/.test(s)?'1':undefined));put('scope','team');
 }else if(qualifying){put('family','qualification');put('metric','advancement');put('scope','team');}
 else if(/champion|wins? the .*cup|wins? the .*league|wins? the .*conference.*final|wins? the .*pennant|world series|wins? the .+ singles title/.test(s)&&!stat&&!eventWinner){put('family','championship');put('metric','champion');put('scope',/singles|tennis|golf/.test(s)?'player':'team');}
 // Ranking and awards are different predicates even for the same rookie/player.
 // Scoring methods still need a complete profile before ranking promotion.
 if(!canonical&&/fantasy/.test(title)&&/scoring|points/.test(s)){
  put('family','statistic-ranking');put('metric','fantasy-points');put('scope','player');put('unit','points');put('outcome','rank');
  const r=primary.match(/(?:top\s+|#)(\d+)/i);put('comparator',/top \d+/.test(s)?'lte':'eq');put('threshold',r?.[1]);
  put('conditions',/rookies/.test(s)?'rookie-cohort':'all-players',primary+' '+m.title);
 }else if(!canonical&&!seed&&!/league phase/.test(s)&&/ranked.+rankings/.test(s)){
  put('family','ranking');put('metric','published-ranking');put('scope','player');put('unit','rank');put('outcome','rank');
  put('comparator','eq');put('threshold',primary.match(/#(\d+)\s+ranked/i)?.[1]);
  put('stage',s.match(/on (?:the )?(.+? rankings)/)?.[1]);
 }
 const award=s.match(/(?:offensive|defensive) rookie of the (?:month|year)|most valuable player|cy young/);
 if(award){put('family','award');put('metric',award[0].replaceAll(' ','-'));put('outcome','award-winner');put('scope','player');delete d.unit;delete e.unit;}
 if(['championship','qualification','ranking'].includes(d.family??'')){
  let stage=/league phase/.test(s)?'league-phase':s.match(/round (?:of )?(\d+)/)?.[0]??
   (/quarterfinal/.test(s)?'quarterfinal':/semifinal/.test(s)?'semifinal':/qualif.+\bfinal\b/.test(s)?'final':undefined);
  if(d.family==='qualification'&&/national championship|championship game|playoff final/.test(s)&&!/semifinal|quarterfinal/.test(s))stage='championship-final';
  // Named scopes are retained: Eastern vs Western, NFC vs AFC, division vs league.
  const conference=s.match(/(?:eastern|western|national football|american football) conference|\bnfc\b|\bafc\b/);
  if(!stage&&/division/.test(s))stage='division:'+((s.match(/(?:nfc|afc) (?:north|south|east|west)/)?.[0])??'unspecified');
  if(!stage&&conference)stage='conference:'+conference[0].replace('national football conference','nfc').replace('american football conference','afc');
  const namedConference=s.match(/\b(big ten|big 12|sec|acc|sun belt|mountain west|mid american)\b/);
  if(!stage&&namedConference)stage='conference:'+namedConference[1];
  if(!stage&&/national championship|championship game|playoff final/.test(s))stage='championship-final';
  if(!stage&&/playoff/.test(s))stage='playoff-entry';
  if(!stage&&d.family==='championship')stage='overall-champion';
  put('stage',stage);put('settlementScope',stage);
 }
 if(/nomination|nominee|nominate/.test(s)&&/party|presiden|\bvp\b/.test(s+' '+title)&&!/defeats?/.test(s)){
  put('family','nomination');put('metric',/vice presiden|\bvp\b/.test(s+' '+title)?'vice-presidential-nomination':'presidential-nomination');
  put('outcome',/democratic/.test(s+' '+title)?'democratic':/republican/.test(s+' '+title)?'republican':undefined);
  put('geography','us');put('scope','person');
 }else if(/presidential election/.test(s)){
  put('family','election');put('metric',/declare|candidacy|announce.+run/.test(s)?'candidacy-announcement':'election-winner');
  put('outcome','president');put('geography',/brazil/.test(s)?'brazil':'us');put('scope','person');
 }
 // Departure quantifiers are ordinary dimensions: any departure and the next
 // departure are different. Same-next contracts stay unresolved until cohort,
 // start cutoff, trigger and tie treatment are bound in a complete profile.
 if(/leaves|depart/.test(s)&&/secretary|cabinet|position|office/.test(s+' '+title)){
  put('family','office-departure');put('metric','departure');put('scope','office-holder');
  put('outcome',/first member|next member|first person|next person/.test(s)?'next-in-cohort':'occurrence');
 }
 if(/house|senate|gubernatorial|governor|mayor/.test(s+' '+title)&&!/white house/.test(s+' '+title)){
  const political=s+' '+title;
  put('family','election');put('metric',/control|majority|midterm winner/.test(political)?'aggregate-control':'race-winner');
  put('scope',d.metric==='aggregate-control'?'national-chamber':'local-race');
  put('geography',d.metric==='aggregate-control'?'us':m.identity?.general?.jurisdiction??political.match(/(?:district|state of) [a-z0-9]+/)?.[0]);
 }
 // Threshold parsing preserves decimal punctuation and direction. Counts have
 // integer support; QBR/percentages/continuous values must never be rounded.
 const threshold=primary.replace(/,(?=\d{3}\b)/g,'').match(/(?:at least|over|more than|above|at most|under|below|less than) (-?\d+(?:\.\d+)?)/i);
 const plus=primary.match(/\b(\d+(?:\.\d+)?)\+\s+(?:rushing|passing|receiving|receptions|yards|points)/i);
 if(threshold||plus){
  const value=Number(threshold?.[1]??plus![1]);let comparator=plus||/^at least/i.test(threshold![0])?'gte':/^at most/i.test(threshold![0])?'lte':/^(under|below|less than)/i.test(threshold![0])?'lt':'gt';
  const integer=d.family==='season-wins'||!!stat&&!['qbr','fantasy-points'].includes(stat[0]);let boundary=value;
  if(integer){if(comparator==='gt'){boundary=Math.floor(value)+1;comparator='gte';}else if(comparator==='gte')boundary=Math.ceil(value);
   else if(comparator==='lt'){boundary=Math.ceil(value)-1;comparator='lte';}else boundary=Math.floor(value);}
  put('comparator',comparator);put('threshold',String(boundary));
 }
 const relativeWins=primary.match(/more wins than (.+?) in the /i);
 if(relativeWins){put('comparator','gt');put('threshold','entity:'+resolve(relativeWins[1]));put('outcome','relative-win-count');}
 if(d.family==='statistic-leader')put('outcome','maximum');
 const game=/game (?:originally )?scheduled|match (?:originally )?scheduled|fight (?:originally )?scheduled/.test(s);
 if(eventWinner){
  put('family','event-winner');put('metric','event-winner');put('scope','event-participant');
  put('outcome',/end in a draw|end in a tie/.test(title)?'draw':d.subject?'named:'+d.subject:undefined,primary+' '+m.title);
  if(/90 minutes plus stoppage/.test(s)){put('period','regulation');put('settlementScope','regulation');}
 }
 if(game&&!['championship','qualification','ranking'].includes(d.family??'')){
  put('event',m.identity?.participants.length===2&&!m.identity.participants.some(p=>/finals|round|scheduled|game|match|darts/.test(normalizeText(p)))?m.identity.participants.map(resolve).sort().join('|'):undefined);
  put('timeframe',m.identity?.eventDate?'date:'+m.identity.eventDate:undefined);
  if(!d.period)put('period','full-event');
 }
 // Existing exact canonical parsers are useful positive evidence. They do not
 // override explicit ordinary constraints discovered above.
 if(canonical){
  put('subject',resolve(canonical.subject));put('competition',canonical.domain);if(!d.event)put('event',canonical.participants?canonical.participants.map(resolve).sort().join('|'):[canonical.domain,canonical.family,canonical.period].join(':'));
  if(!d.family)put('family',canonical.metric==='ipo-confirmation'?'ipo':canonical.family);
  if(!d.metric)put('metric',canonical.metric);
  put('comparator',canonical.comparator);put('threshold',canonical.threshold);
  if(d.family==='season-wins'){put('unit','wins');put('scope','team');put('period','regular-season');if(!d.settlementScope)put('settlementScope','all-regular-season-games');}
  put('timeframe',canonical.period);put('geography',canonical.geography);
  if(!d.outcome)put('outcome',canonical.outcome);
 }
 if(['championship','qualification','ranking'].includes(d.family??'')&&['nhl','nba','wnba'].includes(d.competition??'')&&year){
  const span=primary.match(/\b(20\d\d)[-–](?:(20)?)(\d\d)\b/);
  put('timeframe','season-ending:'+(span?span[1].slice(0,2)+span[3]:year));
 }
 if(d.family==='qualification'&&!d.timeframe&&m.propositionContext){
  const context=m.propositionContext,season=context.subtitle.match(/\b(20\d\d)(?:[-–](?:20)?\d\d)?\b/);
  if(season&&/football|playoff|championship/i.test(context.title))put('timeframe','season:'+season[1],JSON.stringify(context));
 }
 const extra=nativeDifferences(m,resolve);
 for(const k of differenceDimensions)put(k,extra.dimensions[k],extra.evidence[k]);
 const race=(s+' '+title).match(/(?:race to|first to (?:score|reach)) (\d+) points/);
 if(race||/first team to score points/.test(s+' '+title)){
  put('family','game-scoring');put('metric',race?'race-to-points':'first-score');put('unit','points');
  put('threshold',race?.[1]);put('comparator','gte');put('scope','fixture');
  if(/neither team/.test(s+' '+title))put('outcome','neither-team');
  if(extra.dimensions.fixtureParticipants)put('event',extra.dimensions.fixtureParticipants,extra.evidence.fixtureParticipants);
  put('timeframe',m.identity?.eventDate?'date:'+m.identity.eventDate:undefined,JSON.stringify(m.identity));
 }
 if(!d.family){delete d.timeframe;delete e.timeframe;}
 return {version:1,dimensions:d,evidence:e,unknown:propositionDimensions.filter(k=>d[k]===undefined),...(canonical?{canonicalKey:canonicalTemplateKey(canonical)}:{})};
}

export function comparePropositions(pair:Pair,namedWinnerOrientation:boolean|null=null){
 const registry=catalogEntities([pair.a.identity,pair.b.identity]),a=structuredProposition(pair.a,registry),b=structuredProposition(pair.b,registry);
 const conflicts:string[]=[],missing:string[]=[];
 const drawDomain=[pair.a,pair.b].some(m=>/market will settle to (?:Tie|Draw)\b/i.test(m.rules));
 const eventWinners=a.dimensions.family==='event-winner'&&b.dimensions.family==='event-winner';
 if(drawDomain&&eventWinners&&pair.inverted)conflicts.push('outcome: explicit regulation draw means opposing named wins do not exhaust the outcome space');
 for(const k of propositionDimensions){const x=a.dimensions[k],y=b.dimensions[k];
  // Canonical event/outcome values may describe a threshold, while a named
  // two-player winner uses opposite outcomes. The latter is proved separately.
  if((k==='subject'||k==='outcome')&&!drawDomain&&namedWinnerOrientation!==null&&namedWinnerOrientation===pair.inverted)continue;
  if(x!==undefined&&y!==undefined&&x!==y)conflicts.push(`${k}: ${x} vs ${y}`);
 }
 const sameCanonical=!!a.canonicalKey&&a.canonicalKey===b.canonicalKey&&!pair.inverted;
 const family=a.dimensions.family===b.dimensions.family?a.dimensions.family:undefined;
 const profile=family?settlementFamilyProfiles[family]:undefined;
 if(!sameCanonical){
  if(!profile)missing.push('No complete ordinary proposition profile');
  else for(const k of profile.required)if(a.dimensions[k]===undefined||b.dimensions[k]===undefined)missing.push(`Missing ${k}`);
  if(pair.inverted)missing.push('Complement orientation requires native named-winner proof');
 }
 if(!pair.a.rules.trim()||!pair.b.rules.trim())missing.push('Native payout clauses unavailable');
 missing.push(...fixtureTimingUncertainty(pair.a),...fixtureTimingUncertainty(pair.b));
 return {version:1 as const,a,b,conflicts,missing,ordinaryAligned:!conflicts.length&&!missing.length,
  profile:family??null,divergenceBranches:profile?.branches??['Native exceptional settlement branches require review']};
}
