import type { Market } from '../arb/types.ts';
import { canonicalCompetition, netflixChart, normalizeText } from './identity.ts';
import type { EntityRegistry } from './entities.ts';

// Public metadata candidate identity only. This deliberately omits settlement/void
// equivalence and cannot populate StructuredMarket or promote registry verification.
export type CanonicalTemplate = {
  subject: string;
  domain: string;
  family: string;
  metric: string;
  geography: string;
  period: string;
  threshold: string;
  comparator: 'gt' | 'eq' | 'gte';
  outcome: string;
  orientation: 'yes';
  participants?: string[];
  source: 'public-venue-metadata';
};
const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const cleanSubject = (s:string) => normalizeText(s.replace(/^the /i,''));
function date(s:string) {
  const iso = s.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
  const word = s.match(/\b([A-Za-z]+) (\d{1,2}),? (20\d\d)\b/);
  const parts = iso ? [Number(iso[1]),Number(iso[2])-1,Number(iso[3])] : word ? [Number(word[3]),months.indexOf(word[1].slice(0,3).toLowerCase()),Number(word[2])] : null;
  if (!parts || parts[1]<0) return undefined;
  const d = new Date(Date.UTC(parts[0],parts[1],parts[2]));
  return d.getUTCFullYear()===parts[0] && d.getUTCMonth()===parts[1] && d.getUTCDate()===parts[2] ? d.toISOString().slice(0,10) : undefined;
}
const canonicalFields = ['subject','domain','family','metric','geography','period','threshold','comparator','outcome','orientation'] as const;
export function canonicalTemplateKey(t:CanonicalTemplate) {
  return JSON.stringify(canonicalFields.map(k=>t[k]));
}
export function canonicalTemplateConflict(a:CanonicalTemplate,b:CanonicalTemplate) {
  if (a.family!==b.family) return 'marketFamily';
  if (a.domain!==b.domain) return 'competition';
  if (a.subject!==b.subject) return 'entityAlias';
  if (a.metric!==b.metric) return 'marketMetric';
  if (a.geography!==b.geography) return 'geography';
  if (a.period!==b.period) return 'dateWindow';
  if (a.threshold!==b.threshold || a.comparator!==b.comparator) return 'threshold';
  if (a.outcome!==b.outcome || a.orientation!==b.orientation) return 'outcomeOrientation';
  return undefined;
}
export function canonicalTemplate(m:Market, registry:EntityRegistry):CanonicalTemplate | undefined {
  const primary = m.rules.split(/\n/)[0].trim();
  const competition = canonicalCompetition(m.identity?.competition);
  let ambiguous=false;
  const resolve = (s:string) => {const name=cleanSubject(s);if(registry.ambiguous(name,competition)) ambiguous=true;return registry.resolve(name,competition) ?? name;};
  const make = (v:Omit<CanonicalTemplate,'source'|'orientation'|'geography'> & {geography?:string}):CanonicalTemplate | undefined => {
    const oppositeDirection=[m.outcome,m.identity?.outcome].some(s=>/^(?:under|below|less than|fewer than|at most|no more than)\b/.test(normalizeText(s)));
    if (ambiguous || (v.comparator!=='eq' && oppositeDirection)) return undefined;
    return {geography:'competition-scope',...v,orientation:'yes',source:'public-venue-metadata'};
  };
  // Full-game point/run totals and negative handicap spreads have explicit
  // payout-margin predicates. Never infer a period from a title or ignore an inning.
  const game = primary.match(/\bin the (.+?) (?:vs\.?|versus) (.+?) (professional baseball|pro baseball|MLB|professional football|pro football|college football|women's Pro Basketball|WNBA|NBA|Korea KBO|Japan NPB) game (?:originally )?scheduled for (.+?)(?=, then|\. |$)/i);
  if (game && competition && canonicalCompetition(game[3])===competition) {
    const day=date(game[4]);
    const participants=[resolve(game[1]),resolve(game[2])].sort();
    const total=primary.match(/(?:collectively score more(?: than)?|combine for over) (\d+(?:\.\d+)?) (runs|points) (?:in the|, then)/i);
    const spread=primary.match(/^(?:If|This market will settle to Yes if) (?:the )?(.+?) wins? by more than (\d+(?:\.\d+)?)(?: (runs|points))? in the /i);
    // A segment in the primary clause is meaningful even if the older identity
    // parser called it "full event". Full-game-only templates never erase it.
    const segment=/\b(first|second|third|fourth|[1-9](?:st|nd|rd|th)?) (?:\d+ )?(?:innings?|quarters?|halves|half|periods?|sets?)\b/i.test(primary);
    if (day && participants[0]!==participants[1] && !segment && (!m.identity?.period || m.identity.period==='full event')) {
      if (total && m.identity?.marketType==='total' &&
          !/\bunder\b/i.test((m.identity.outcome??'')+' '+m.outcome) &&
          (m.identity.line===undefined || m.identity.line===Number(total[1])))
        return make({subject:participants.join('|'),domain:competition,family:'game-total',metric:total[2].toLowerCase(),period:day+':full-game',threshold:String(Number(total[1])),comparator:'gt',outcome:'combined-total',participants});
      if (spread && m.identity?.marketType==='spread') {
        const subject=resolve(spread[1]);
        const line=Number(spread[2]);
        const compatible=m.identity.line===undefined || m.identity.line===(m.venue==='poly'?-line:line);
        const namedOutcome=m.identity.outcome;
        const outcomeCompatible=!namedOutcome || resolve(namedOutcome)===subject ||
          (m.venue==='kalshi' && normalizeText(namedOutcome).startsWith(cleanSubject(spread[1])+' wins by over '));
        if (participants.includes(subject) && compatible && outcomeCompatible)
          return make({subject,domain:competition,family:'game-spread',metric:spread[3]?.toLowerCase()??'points',period:day+':full-game',threshold:String(line),comparator:'gt',outcome:participants.join('|'),participants});
      }
    }
  }
  // Integer win counts have a discrete domain: >= 9 and > 8.5 are the same
  // candidate threshold. Apply no such conversion to continuous statistics.
  const winK=primary.match(/^If (?:the )?(.+?) college football team has at least (\d+) wins in the (20\d\d) regular season, then /i);
  const winP=primary.match(/^This market will settle to Yes if (.+?) finishes the (20\d\d) College Football regular season with over (\d+\.5) wins\./i);
  if (competition==='cfb' && (winK || winP)) {
    const r=winK??winP!; const min=winK?Number(r[2]):Math.floor(Number(r[3]))+1;
    const expected=winK?min:Number(r[3]);
    if (m.identity?.line!==undefined && m.identity.line!==expected) return undefined;
    return make({subject:resolve(r[1]),domain:competition,family:'season-wins',metric:'team-wins',period:(winK?r[3]:r[2])+':regular-season',threshold:String(min),comparator:'gte',outcome:'minimum-wins'});
  }
  // Conference championship winner and qualification use distinct metrics.
  const conference=primary.match(/^(?:If|This market will settle to Yes if) (.+?) (wins|qualifies for) the (20\d\d) (?:College Football )?(.+?) (?:Football )?Championship(?: Game)?(?:, then| scheduled for)/i);
  if (competition==='cfb' && conference) {
    const subject=resolve(conference[1]);
    if(m.identity?.outcome && resolve(m.identity.outcome)!==subject) return undefined;
    const event=normalizeText(conference[4]).replace(/ football$/,'').replace(/ conference$/,'');
    const known = new Set(['big ten','big 12','sec','acc','american athletic','conference usa','usa','sun belt','mountain west','mid american','pac 12']);
    if (known.has(event)) return make({subject,domain:competition,family:'conference-championship',metric:conference[2].toLowerCase()==='wins'?'winner':'qualifier',period:conference[3]+':season',threshold:'1',comparator:'eq',outcome:event==='usa'?'conference usa':event});
  }
  const chart=netflixChart(m.rules);
  const chartSubject=primary.match(/^(?:If|This market will settle to Yes if) (.+?) is #\d+ on the Netflix /i)?.[1];
  if (chartSubject && chart?.rank && chart.region && chart.format && chart.published)
    return make({subject:cleanSubject(chartSubject),domain:'netflix',family:'published-chart-ranking',metric:chart.format+':'+(chart.language??'unspecified-language'),geography:chart.region,period:chart.published,threshold:String(chart.rank),comparator:'eq',outcome:'rank'});
  // Economic templates require an explicit measured window and basis. Family
  // labels constrain the Kalshi CPI shorthand; month/year come from payout text.
  // CPI.pdf's Underlying explicitly names US CPI-U, one-month, seasonally
  // adjusted (reviewed in this September 2026 checkpoint). Require this exact linked family document.
  // Its missing-data fallback differs from PM-US: these remain review candidates.
  const cpiK=m.venue==='kalshi' && m.series==='KXCPI' && m.rules.includes('https://assets.kalshi.com/contract_terms/CPI.pdf') ? primary.match(/^If the Consumer Price Index \(CPI\) increases by more than (-?\d+(?:\.\d+)?)% \(single-decimal\) in ([A-Za-z]+) (20\d\d), then /i):null;
  const cpiP=primary.match(/^This market will settle to Yes if the one-month percent change in the seasonally adjusted Consumer Price Index for All Urban Consumers \(CPI MoM\) for ([A-Za-z]+) (20\d\d) is above (-?\d+(?:\.\d+)?)%\./i);
  if (cpiK || cpiP) {
    const r=cpiK??cpiP!; const month=months.indexOf(r[cpiK?2:1].slice(0,3).toLowerCase());
    if(month>=0) return make({subject:'consumer-price-index-all-urban',domain:'economics',family:'economic-release',metric:'cpi:headline:month-over-month:seasonally-adjusted',geography:'us',period:r[cpiK?3:2]+'-'+String(month+1).padStart(2,'0'),threshold:String(Number(r[cpiK?1:3])),comparator:'gt',outcome:'reported-value'});
  }
  const gdpK=m.venue==='kalshi' && m.series==='KXGDP' ? primary.match(/^If real GDP \(as measured by the BEA[’']s seasonally adjusted and annualized Advance Estimate\) increases by more than (-?\d+(?:\.\d+)?), then /i):null;
  const gdpP=/Settlement is based on the Advance Estimate GDP release published by the BEA\b/.test(m.rules) ? primary.match(/^This market will settle to Yes if the seasonally adjusted annualized rate of real U\.S\. GDP growth for (Q[1-4]) (20\d\d) is above (-?\d+(?:\.\d+)?)%\./i) : null;
  const quarter=gdpK?m.title.match(/\b(Q[1-4]) (20\d\d)\b/):gdpP;
  if ((gdpK || gdpP) && quarter)
    return make({subject:'real-gross-domestic-product',domain:'economics',family:'economic-release',metric:'real-gdp:quarter-growth:seasonally-adjusted-annualized:advance',geography:'us',period:quarter[2]+'-'+quarter[1],threshold:String(Number(gdpK?.[1]??gdpP![3])),comparator:'gt',outcome:'reported-value'});
  return undefined;
}
