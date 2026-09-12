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
 }else if(/^KXNFL(?:PASS|REC|RSH)YDS$/.test(pair.a.series??'')&&a?.competition==='nfl'&&b?.competition==='nfl'){
  result.profile='nfl-player-yards';
  if(pair.inverted||!base()||a.marketType!=='prop'||b.marketType!=='prop'||!same('participant')||!same('propType')||!same('units')||!same('line')||!Number.isFinite(a.line))return reject('Missing or different player, teams, date, statistic, threshold, units, period, or orientation');
  const ka=pair.a.rules.match(/^If (.+) records (\d+)\+ (passing|receiving|rushing) yards in the (.+) vs (.+) Pro Football game originally scheduled for (.+), then the market resolves to Yes\./i);
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
