import {normalizeText,type Identity} from './identity.ts';
import type {Pair} from '../arb/types.ts';
import {catalogEntities} from './entities.ts';
import {matchCandidates} from './matching.ts';

export type SettlementAssessment={
 version:1; status:'CONDITIONAL'|'CONFLICT'|'UNSUPPORTED'; profile:string|null;
 normalOutcomeMatched:boolean; strictEquivalent:false;
 checks:string[]; risks:string[]; blockers:string[];
};
// This is a diagnostic, not an approval. Matching the ordinary result does not prove
// complementary payouts after cancellation, missing data, or exchange discretion.
export function assessSettlement(pair:Pair):SettlementAssessment{
 const result:SettlementAssessment={version:1,status:'UNSUPPORTED',profile:null,normalOutcomeMatched:false,strictEquivalent:false,checks:[],risks:[],blockers:[]};
 const reject=(reason:string,status:'CONFLICT'|'UNSUPPORTED'='CONFLICT')=>{result.blockers.push(reason);result.status=status;return result;};
 if(!pair.a.rules.trim()||!pair.b.rules.trim())return reject('Full inline settlement rules unavailable');
 if(!matchCandidates([pair.a],[pair.b]).some(c=>c.pair.inverted===pair.inverted))return reject('Current matching rejects the event, outcome, or orientation');
 const registry=catalogEntities([pair.a.identity,pair.b.identity]);
 const a=pair.a.identity&&registry.normalize(pair.a.identity),b=pair.b.identity&&registry.normalize(pair.b.identity);
 const same=(key:keyof Identity)=>{
  const x=a?.[key],y=b?.[key];
  return x!==undefined&&x!==null&&x!==''&&JSON.stringify(x)===JSON.stringify(y);
 };
 const teams=()=>a?.participants?.length===2&&b?.participants?.length===2&&new Set(a.participants).size===2&&JSON.stringify([...a.participants].sort())===JSON.stringify([...b.participants].sort());
 const base=()=>same('sport')&&same('competition')&&same('eventDate')&&same('period')&&a?.period==='full event'&&teams();
 const canonical=(name:string)=>registry.normalize({...pair.b.identity!,outcome:name}).outcome;
 const date=(text:string)=>{const t=Date.parse(text+' UTC');return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):null;};
 const namedTeams=(names:string[])=>JSON.stringify(names.map(canonical).sort());
 if(pair.a.series==='KXNCAAFGAME'&&a?.competition==='cfb'&&b?.competition==='cfb'){
  result.profile='college-football-full-game';
  if(!base()||a.marketType!=='winner'||b.marketType!=='winner')return reject('Missing or different teams, date, competition, or game period');
  if(!a.outcome||!b.outcome||!a.participants.includes(a.outcome)||!b.participants.includes(b.outcome)||(pair.inverted?(a.outcome===b.outcome):(a.outcome!==b.outcome)))return reject('YES/NO team orientation is not proven');
  const ka=pair.a.rules.match(/^If (.+) wins the (.+) vs (.+) college football game originally scheduled for (.+), then the market resolves to Yes\./i);
  const pb=pair.b.rules.match(/^This market will settle to the winner of the (.+) vs (.+) College Football game scheduled for ([^.]+)\./i);
  if(!ka||!pb)return reject('Unsupported winner-rule template','UNSUPPORTED');
  if(canonical(ka[1])!==a.outcome||namedTeams([ka[2],ka[3]])!==JSON.stringify([...a.participants].sort())||namedTeams([pb[1],pb[2]])!==JSON.stringify([...b.participants].sort())||date(ka[4])!==a.eventDate||date(pb[3])!==b.eventDate)return reject('Rule prose contradicts the normalized teams, winner, or date');
  result.checks=['Same two teams, competition, event date and full-game period','YES/NO orientation agrees with the named team on each venue'];
  result.risks=['Postponement: Kalshi uses a 48-hour start window; Polymarket US uses a two-week rescheduling window','Tie, abandoned-game and result-correction treatments require separate review','Fair-price cancellation payouts are independently determined and need not hedge'];
 }else if(pair.a.series==='KXMLBGAME'&&a?.competition==='mlb'&&b?.competition==='mlb'){
  result.profile='mlb-named-full-game';
  if(!teams()||!same('sport')||!same('period')||a.period!=='full event'||a.marketType!=='winner'||b.marketType!=='winner')return reject('Missing MLB full-game identity','UNSUPPORTED');
  if(!a.outcome||!b.outcome||!a.participants.includes(a.outcome)||!b.participants.includes(b.outcome)||(pair.inverted?(a.outcome===b.outcome):(a.outcome!==b.outcome)))return reject('MLB winner orientation is not proven');
  const ka=pair.a.rules.match(/^If (.+) wins the (.+) vs (.+) professional baseball game originally scheduled for (.+ at \d{1,2}:\d{2} [AP]M E[DS]T), then the market resolves to Yes\./);
  const pb=pair.b.rules.match(/^This market will settle to the winner of the (.+) vs (.+) MLB game scheduled for (20\d\d-\d\d-\d\d) at (\d{1,2}):(\d{2})(AM|PM) ET\./);
  if(!ka||!pb)return reject('Unsupported MLB full-game rule template','UNSUPPORTED');
  const instant=Date.parse(ka[4].replace(' at ',' ')),polyInstant=easternRuleInstant(pb[3],Number(pb[4]),Number(pb[5]),pb[6]);
  const expected=JSON.stringify([...a.participants].sort());
  if(canonical(ka[1])!==a.outcome||namedTeams([ka[2],ka[3]])!==expected||namedTeams([pb[1],pb[2]])!==expected||!Number.isFinite(instant)||polyInstant===null||instant!==polyInstant||Date.parse(a.eventAt??'')!==instant||Date.parse(b.eventAt??'')!==instant)return reject('MLB named teams or exact written start time contradict identity');
  if(!pair.a.rules.includes('https://assets.kalshi.com/contract_terms/BASEBALLGAMEWIN.pdf')||!pair.a.rules.includes('(within two days)')||!pair.b.rules.includes('Extra innings are included if played.')||!pair.b.rules.includes('within two weeks of the originally scheduled date')||!pair.b.rules.includes('Outcome sourced from MLB.'))return reject('Unreviewed MLB referenced terms or exception template','UNSUPPORTED');
  result.checks=['Same named teams, exact Eastern-time scheduled instant, full game and explicit outcome orientation','Extra innings included; official MLB shortened-game winner supported by both published terms'];
  result.risks=['Postponement and suspension windows differ: Kalshi 48 hours versus Polymarket two weeks; independent fair-market payouts need not hedge','Kalshi home/away reversal can trigger fair-price settlement while Polymarket venue-change terms keep markets valid','Doubleheader and makeup-game assignment, replay and pre-expiry revisions require separate review if circumstances change','Pre-start forfeits, ties without a tie strike, disqualification and source hierarchy are not proven equivalent','Polymarket AEC permits expiration extension; administrative close times do not guarantee capital release'];
 }else if(pair.a.series==='KXKBOGAME'&&a?.competition==='kbo'&&b?.competition==='kbo'){
  result.profile='kbo-named-full-game';
  if(!base()||a.sport!=='baseball'||a.marketType!=='winner'||b.marketType!=='winner')return reject('Missing KBO full-game identity','UNSUPPORTED');
  if(!a.outcome||!b.outcome||!a.participants.includes(a.outcome)||!b.participants.includes(b.outcome)||(pair.inverted?(a.outcome===b.outcome):(a.outcome!==b.outcome)))return reject('KBO winner orientation is not proven');
  const ka=pair.a.rules.match(/^If (.+) wins the (.+) vs (.+) Korea KBO game originally scheduled for (.+ at \d{1,2}:\d{2} [AP]M E[DS]T), then the market resolves to Yes\./);
  const pb=pair.b.rules.match(/^This market will settle to the winner of the (.+) vs (.+) KBO game scheduled for ([^.]+)\./);
  if(!ka||!pb)return reject('Unsupported KBO primary rule template','UNSUPPORTED');
  const instant=Date.parse(ka[4].replace(' at ',' ')),expected=JSON.stringify([...a.participants].sort());
  if(!Number.isFinite(instant)||Date.parse(a.eventAt??'')!==instant||Date.parse(b.eventAt??'')!==instant||canonical(ka[1])!==a.outcome||namedTeams([ka[2],ka[3]])!==expected||namedTeams([pb[1],pb[2]])!==expected)return reject('KBO named teams or metadata start instant contradict primary rules');
  const localDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
  if(date(pb[3])!==localDay)return reject('KBO written game date contradicts Korean calendar start date');
  if(!pair.a.rules.includes(`The following market refers to the ${ka[2]} vs ${ka[3]} Korea KBO game originally scheduled for ${ka[4]}.`)||!pair.a.rules.includes('https://assets.kalshi.com/contract_terms/BASEBALLGAMEWIN.pdf')||!pair.a.rules.includes('(within two days)')||!pair.a.rules.includes('If the game ends in a tie the markets will resolve to 50/50.')||!pair.b.rules.includes('Extra innings are included if played.')||!pair.b.rules.includes('If the game ends in a tie, the market will settle to $0.50.')||!pair.b.rules.includes('If the game is delayed, postponed, or suspended and not rescheduled to a date within two days of the originally scheduled date, the market will settle to the last fair market price.')||!pair.b.rules.includes('Outcome sourced from KBO.'))return reject('Unreviewed KBO exception or referenced terms template','UNSUPPORTED');
  result.checks=['Same named teams, full game and explicit outcome orientation','Kalshi written start agrees with both metadata instants and Polymarket written Korean game date','Both inline templates specify two-day rescheduling and 50-cent tie payouts'];
  result.risks=['Independent fair-price cancellation payouts need not hedge; matching two-day language does not prove identical suspension deadlines','Kalshi home/away reversal, makeup-game assignment and pre-start forfeits may differ from Polymarket treatment','Replay, result revisions and source hierarchy remain venue-specific','Polymarket AEC permits discretionary cancellation and expiration extension; no guaranteed capital-release time'];
 }else if(pair.a.series==='KXATPCHALLENGERMATCH'&&a?.competition==='atp'&&b?.competition==='atp'){
  result.profile='atp-challenger-named-match';
  if(!teams()||!same('sport')||!same('period')||a.period!=='full event'||a.marketType!=='winner'||b.marketType!=='winner'||!a.tennisContext||!b.tennisContext)return reject('Missing Challenger player, tournament or round context','UNSUPPORTED');
  if(!a.outcome||!b.outcome||!a.participants.includes(a.outcome)||!b.participants.includes(b.outcome)||(pair.inverted?(a.outcome===b.outcome):(a.outcome!==b.outcome)))return reject('Named player orientation is not proven');
  const ka=pair.a.rules.match(/^If (.+) wins the (.+) vs (.+) professional tennis match in the (20\d\d) ATP (Challenger .+?) (Round Of (?:128|64|32|16)) after a ball has been played, then the market resolves to Yes\./i);
  const pb=pair.b.rules.match(/^This market will settle to the winner of the (.+) vs (.+) ATP match scheduled for ([^.]+)\./i);
  if(!ka||!pb)return reject('Unsupported Challenger winner-rule template','UNSUPPORTED');
  const expected=JSON.stringify([...a.participants].sort());
  if(canonical(ka[1])!==a.outcome||namedTeams([ka[2],ka[3]])!==expected||namedTeams([pb[1],pb[2]])!==expected||ka[4]!==a.tennisContext.year||normalizeText(ka[5])!==a.tennisContext.tournament||normalizeText(ka[6])!==a.tennisContext.round)return reject('Primary rule prose contradicts Challenger identity');
  if(!pair.a.rules.includes('https://assets.kalshi.com/contract_terms/ACHIEVEMENTS.pdf')||!pair.a.rules.includes('If the match does not occur (signaled by a ball being played)')||!/prior to the first point being played, the market will settle to fair market price\./i.test(pair.b.rules)||!/If a player retires during the match, the opponent will be recorded as the winner\./i.test(pair.b.rules))return reject('Start, retirement or referenced contract treatment is not the reviewed template','UNSUPPORTED');
  result.checks=['Same two players, ATP Challenger season, tournament and round with verified parent-event membership; no scheduled date inferred','Both primary rules identify the same ordinary match winner and compatible YES/NO orientation','Published ACHIEVEMENTS and PMUS AEC (2026-03-26) use official results for early-ended events; Polymarket inline retirement clause is explicit'];
  result.risks=['Pre-start cancellation and walkover fair-price payouts are venue-specific and need not sum to one dollar','Kalshi ACHIEVEMENTS generic suspension clause allows up to two years, while inline delay wording says two weeks; applicable precedence and timing need explicit review','Polymarket AEC permits expiration extension or discretionary cancellation settlement; administrative close times do not guarantee capital release','Start-of-play wording, disqualification, replay and result-revision exceptions are not proven equivalent'];
 }else if(pair.a.series==='KXNCAAFTOTAL'&&a?.competition==='cfb'&&b?.competition==='cfb'){
  result.profile='college-football-full-game-points';
  if(pair.inverted||!base()||a.marketType!=='total'||b.marketType!=='total'||!same('line')||!Number.isFinite(a.line)||a.line!%1!==.5||a.outcome!=='over'||b.outcome!=='over')return reject('Different game, period, point threshold, or Over orientation');
  if(!b.eventContext||b.eventContext.source!=='https://gateway.polymarket.us/v1/events/slug/'+b.eventContext.eventSlug||!b.eventContext.eventSlug.startsWith('cfb-')||b.aliases?.length!==2)return reject('Authoritative parent-event team context unavailable','UNSUPPORTED');
  const ka=pair.a.rules.match(/^If the teams collectively score more than (\d+\.5) points in the (.+?) vs (.+?) college football game originally scheduled for ([^.]+), then the market resolves to Yes\./i);
  const pb=pair.b.rules.match(/^This market will settle to Yes if (.+?) and (.+?) combine for over (\d+\.5) points in the (.+?) vs (.+?) College Football game scheduled for ([^.]+)\./i);
  if(!ka||!pb)return reject('Unsupported full-game total rule template','UNSUPPORTED');
  const expected=JSON.stringify([...a.participants].sort());
  if(Number(ka[1])!==a.line||Number(pb[3])!==b.line||namedTeams([ka[2],ka[3]])!==expected||namedTeams([pb[1],pb[2]])!==expected||namedTeams([pb[4],pb[5]])!==expected||date(ka[4])!==a.eventDate||date(pb[6])!==b.eventDate)return reject('Point-total prose contradicts teams, threshold, or game date');
  if(normalizeText(pair.b.outcome)!=='over'||normalizeText(pair.b.opposite)!=='under'||!pair.a.outcome.toLowerCase().startsWith('over '+a.line+' points'))return reject('Long/short point-total labels contradict the payout rule');
  if(!pair.a.rules.includes('https://assets.kalshi.com/contract_terms/FOOTBALLTOTALS.pdf')||!/Overtime is included if played\./i.test(pair.b.rules))return reject('Full-game overtime treatment is not supported by reviewed terms','UNSUPPORTED');
  result.checks=['Same two event-linked teams, college-football game date, and full-game point total','Both ordinary payout rules require strictly more than the same half-point threshold; no integer-score push','Overtime included by Kalshi FOOTBALLTOTALS terms and explicit Polymarket US prose','Over/Under long/short labels and both team-name clauses checked against parent-event identities'];
  result.risks=['Postponement: Kalshi uses a 48-hour window; Polymarket US uses a two-week window','Kalshi has a 55-minute/finality rule for interrupted games; equivalent Polymarket US treatment is not proven','Fair-price cancellation payouts, venue changes, forfeits and result revisions may differ'];
 }else if(pair.a.series==='KXUFCFIGHT'&&a?.competition==='ufc'&&b?.competition==='ufc'){
  result.profile='ufc-named-fight';
  if(!base()||a.marketType!=='winner'||b.marketType!=='winner')return reject('Missing or different fighters, date, competition, or fight period');
  if(!a.outcome||!b.outcome||!a.participants.includes(a.outcome)||!b.participants.includes(b.outcome)||(pair.inverted?(a.outcome===b.outcome):(a.outcome!==b.outcome)))return reject('YES/NO fighter orientation is not proven');
  const ka=pair.a.rules.match(/^If (.+) wins the (.+) vs (.+) professional MMA fight originally scheduled for (.+), then the market resolves to Yes\./i);
  const pb=pair.b.rules.match(/^This market will settle to the winner of the (.+) vs (.+) UFC fight scheduled for ([A-Za-z]+ \d{1,2}(?:, \d{4})?)(?: at [^.]+)?\./i);
  if(!ka||!pb)return reject('Unsupported fight-rule template','UNSUPPORTED');
  const polyDate=/, \d{4}$/.test(pb[3])?pb[3]:pb[3]+', '+b.eventDate!.slice(0,4);
  if(canonical(ka[1])!==a.outcome||namedTeams([ka[2],ka[3]])!==JSON.stringify([...a.participants].sort())||namedTeams([pb[1],pb[2]])!==JSON.stringify([...b.participants].sort())||date(ka[4])!==a.eventDate||date(polyDate)!==b.eventDate)return reject('Rule prose contradicts the normalized fighters, winner, or date');
  if(!/tie or no contest, the market will resolve to 50\/50/i.test(pair.a.rules)||!/draw or is declared a no contest, the market will settle to \$0\.50/i.test(pair.b.rules))return reject('Matching draw/no-contest payout is not documented','UNSUPPORTED');
  result.checks=['Same two named fighters, competition, calendar date and full-fight period','YES/NO orientation agrees with the named fighter on each venue','Both inline rules specify half-dollar payouts for draw/no contest'];
  result.risks=['Cancellation and independently determined fair-price payouts need not hedge','Withdrawal, disqualification, suspension and result-correction provisions are not proven equivalent','Only the named fight and calendar date are matched; scheduled clock times and rule/metadata differences need separate review'];
 }else if(/^KXNFL(?:PASS|REC|RSH)YDS$/.test(pair.a.series??'')&&a?.competition==='nfl'&&b?.competition==='nfl'){
  result.profile='nfl-player-yards';
  if(pair.inverted||!base()||a.marketType!=='prop'||b.marketType!=='prop'||!same('participant')||!same('propType')||!same('units')||!same('line')||!Number.isFinite(a.line))return reject('Missing or different player, teams, date, statistic, threshold, units, period, or orientation');
  const ka=pair.a.rules.match(/^If (.+) records (\d+)\+ (passing|receiving|rushing) yards in the (.+) vs (.+) (?:Pro|professional) Football game originally scheduled for (.+), then the market resolves to Yes\./i);
  const pb=pair.b.rules.match(/^This market will settle to Yes if (.+) records at least (\d+) (passing|receiving|rushing) yards in the (.+) vs (.+) professional football game scheduled for ([^.]+)\./i);
  if(!ka||!pb)return reject('Unsupported statistic-rule template','UNSUPPORTED');
  if(normalizeText(ka[1])!==a.participant||normalizeText(pb[1])!==b.participant||ka[1].toLowerCase()!==pb[1].toLowerCase()||ka[2]!==pb[2]||ka[3].toLowerCase()!==pb[3].toLowerCase()||Number(ka[2])-.5!==a.line)return reject('Unsupported or contradictory statistic-rule template');
  if(namedTeams([ka[4],ka[5]])!==JSON.stringify([...a.participants].sort())||namedTeams([pb[4],pb[5]])!==JSON.stringify([...b.participants].sort())||date(ka[6])!==a.eventDate||date(pb[6])!==b.eventDate||normalizeText(ka[3]+' yards')!==a.propType||normalizeText(pb[3]+' yards')!==b.propType)return reject('Rule prose contradicts the normalized teams, game date, or statistic');
  result.checks=['Same player, two teams, event date, statistic, units and full-game period','Both ordinary payout conditions require the same integer yards threshold'];
  result.risks=['No-participation payouts use independently determined fair prices','Postponement, abandonment, venue changes and missing-data provisions require separate review','Referenced Kalshi contract terms must be reviewed; inline rules alone are incomplete'];
 }else{
  result.blockers.push('No reviewed settlement profile for this contract family');
  if(/emmy/i.test(pair.a.series??''))result.risks.push('Kalshi EMMYS terms resolve No when source data is unavailable by expiration; matching fallback is not established on Polymarket US');
  if(pair.a.series==='KXU3')result.risks.push('Initial release versus expiration-value revisions and early missing-data fallback require review');
  return result;
 }
 result.normalOutcomeMatched=true;result.status='CONDITIONAL';
 result.blockers.push('Ordinary outcome matches, but exceptional payouts are not proven equivalent');
 return result;
}

// Interpret written ET without assuming DST or relying on the host timezone.
function easternRuleInstant(day:string,hour:number,minute:number,period:string):number|null{
 if(hour<1||hour>12||minute<0||minute>59)return null;
 const h=hour%12+(period==='PM'?12:0),wanted=day+'T'+String(h).padStart(2,'0')+':'+String(minute).padStart(2,'0');
 const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const candidates=['-04:00','-05:00'].map(offset=>Date.parse(wanted+':00'+offset)).filter(t=>Number.isFinite(t)&&formatter.format(t).replace(' ','T')===wanted);
 return candidates.length===1?candidates[0]:null;
}
