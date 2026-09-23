import type {Market} from '../arb/types.ts';
import type {CanonicalTemplate} from './canonical-template.ts';
import {normalizeText, spotifyGeography} from './identity.ts';

// Exclusive reporting strata, based on primary predicates, not incidental rule
// references. Counts describe accessible listings, never settlement equivalence.
export const nonSportsFamilies = ['netflix-ranking','netflix-views','spotify','other-music-charts','billboard','reality-tv','awards','time-person','entertainment-release','critic-score','box-office','casting-announcement','culture-lists','science-technology','companies-business','economics'] as const;
export type NonSportsFamily = typeof nonSportsFamilies[number];
export function nonSportsFamily(m:Market):NonSportsFamily | undefined {
  if(m.identity?.sports) return undefined;
  const p=(m.title+' '+m.rules.split('\n')[0]).toLowerCase(), c=m.category.toLowerCase();
  if(/netflix.*(?:chart|#\d|top |views)/.test(p)&&!/spotify/.test(p)) return /million views/.test(p)?'netflix-views':'netflix-ranking';
  if(/spotify/.test(p)&&/rank|wrapped|streamed|top artist|top song|top podcast/.test(p))return 'spotify';
  if(/billboard/.test(p))return 'billboard';
  if(/luminate|youtube.*(?:chart|views)|ifpi/.test(p))return 'other-music-charts';
  if(/(?:win|place|runner.up|eliminat|advance|qualif|finalist|top \d).*(?:big brother|dancing with the stars|got talent|survivor|bachelor|love island)|(?:big brother|dancing with the stars|got talent|survivor|bachelor|love island).*(?:winner|place|eliminat|advance|finalist)/.test(p))return 'reality-tv';
  if(/time.*person of the (?:year|decade)/.test(p))return 'time-person';
  if(/oscar|academy awards|emmy|emmys|grammy|grammys|golden globe|video music awards|vma |nobel|game award|music association award|spirit award|streamer award/.test(p))return 'awards';
  if(/rotten tomatoes|tomatometer|metacritic/.test(p))return 'critic-score';
  if(/box.office|opening weekend.*(?:gross|million)|(?:gross|million).*opening weekend/.test(p))return 'box-office';
  if(/release|premiere/.test(p)&&(/grand theft auto|gta ?vi|gta ?6|elder scrolls|video game|movie|film|album|song|trailer|episode|season|prison break|winds of winter/.test(p)||c==='entertainment'))return 'entertainment-release';
  if(c==='entertainment'&&/cast|perform|host|headlin|announc|feature|franchise|james bond/.test(p))return 'casting-announcement';
  if(/net.worth|sexiest man|rank.*list|list.*rank|word of the year|year in search|dj mag|forbes|vogue|best restaurants|university rankings|national universities rankings/.test(p))return 'culture-lists';
  if(['science and technology','technology','science','ai'].includes(c))return 'science-technology';
  if(['companies','business'].includes(c)||/\bipo\b|as (?:tesla|openai|anthropic) ceo|acqui(?:re|sition)|merger/.test(p))return 'companies-business';
  if(['economics','macro'].includes(c)||/\b(?:cpi|gdp|unemployment|payroll|fed rate|federal reserve|consumer sentiment)\b/.test(p))return 'economics';
  return undefined;
}
const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export function publicDate(value:string):string | undefined {
  const m=value.match(/^([A-Za-z]+) (\d{1,2}),? (20\d\d)$/);
  if(!m)return undefined;
  const month=months.indexOf(m[1].slice(0,3).toLowerCase()), day=Number(m[2]), year=Number(m[3]);
  const d=new Date(Date.UTC(year,month,day));
  return month>=0&&d.getUTCMonth()===month&&d.getUTCDate()===day?d.toISOString().slice(0,10):undefined;
}
// Supported primary-clause grammars retain work/artist, chart, geography,
// ceremony/category, placement and season. No aliases are inferred from prices.
export function nonSportsTemplate(m:Market):CanonicalTemplate | undefined {
  if(m.identity?.sports)return undefined;
  if([m.outcome,m.identity?.outcome].some(s=>/^(?:no|under|below|not)(?: |$)/.test(normalizeText(s))))return undefined;
  const primary=m.rules.split('\n')[0].trim();
  const p=primary.replace(/^(?:If |This market will settle to Yes if )/i,'');
  const make=(v:Omit<CanonicalTemplate,'source'|'orientation'>):CanonicalTemplate=>({...v,source:'public-venue-metadata',orientation:'yes'});
  const subject=(s:string)=>normalizeText(s); // retain “The”, numerals and seasons
  const spotify=p.match(/^(.+?) is the #(\d+)\s+most streamed (Artist|Song|Album) on Spotify's (20\d\d) Spotify Wrapped Top 10 (?:Artists?|Songs?|Albums?) (U\.S\.?|USA|Globally) chart on the date that the chart is released for (20\d\d),/i);
  const spotifyP=p.match(/^(.+?) is ranked the (?:top|#1) (artist|song|album) (globally|in the (?:US|United States)) on Spotify in (20\d\d)[,.]/i);
  const spotifyLegacy=p.match(/^(.+?) is the most streamed Spotify artist in (20\d\d),/i);
  if(spotify && spotify[4]===spotify[6])return make({subject:subject(spotify[1]),domain:'spotify',family:'annual-chart-ranking',metric:spotify[3].toLowerCase(),geography:/globally/i.test(spotify[5])?'global':'us',period:spotify[4]+':wrapped',threshold:String(Number(spotify[2])),comparator:'eq',outcome:'rank'});
  if(spotifyP && /annual Spotify Wrapped campaign/.test(m.rules)) {
    const work=spotifyP[2].toLowerCase()==='artist'?[spotifyP[1]]:spotifyP[1].split(' - ');
    return make({subject:subject(work[0]),creator:work.length===2?subject(work[1]):undefined,domain:'spotify',family:'annual-chart-ranking',metric:spotifyP[2].toLowerCase(),geography:spotifyP[3].toLowerCase()==='globally'?'global':'us',period:spotifyP[4]+':wrapped',threshold:'1',comparator:'eq',outcome:'rank'});
  }
  if(spotifyLegacy && spotifyGeography(m)==='global')return make({subject:subject(spotifyLegacy[1]),domain:'spotify',family:'annual-chart-ranking',metric:'artist',geography:'global',period:spotifyLegacy[2]+':wrapped',threshold:'1',comparator:'eq',outcome:'rank'});
  const billboardK=p.match(/^(.+?) is #(\d+) on the Billboard (Hot 100|200)\s+chart for the Week of ([A-Za-z]+ \d{1,2},? 20\d\d),/i);
  const billboardP=p.match(/^(.+?) by (.+?) is the #(\d+) (song|album) on the Billboard (Hot 100|200) chart dated Week of ([A-Za-z]+ \d{1,2},? 20\d\d)\./i);
  const chartDate=publicDate(billboardK?.[4]??billboardP?.[6]??'');
  if(chartDate&&(billboardK||billboardP))return make({subject:subject((billboardK??billboardP)![1]),creator:billboardP?subject(billboardP[2]):undefined,domain:'billboard',family:'weekly-chart-ranking',metric:normalizeText(billboardK?.[3]??billboardP![5]),geography:'us',period:chartDate,threshold:String(Number(billboardK?.[2]??billboardP![3])),comparator:'eq',outcome:'rank'});
  const reality=p.match(/^(.+?) (wins|(?:is|are) officially declared the winner of|finishes (?:\d+(?:st|nd|rd|th)|in the Top \d+)(?: place)? (?:in|on)|comes in (?:second|third)-place in|finishes as the runner-up \(second place\) on|is the runner-up of) (.+?) [Ss]eason (\d+)(?=[,.])/);
  if(reality){
    const predicate=reality[2],rank=/winner|^wins$/.test(predicate)?'1':/runner-up|second/.test(predicate)?'2':/third/.test(predicate)?'3':predicate.match(/\d+/)![0];
    return make({subject:subject(reality[1]),domain:normalizeText(reality[3]),family:'reality-placement',metric:/Top /.test(predicate)?'top-n':'exact-place',geography:'program-scope',period:'season-'+reality[4],threshold:rank,comparator:'eq',outcome:'placement'});
  }
  const award=p.match(/^(.+?) (?:has won|wins) (.+?) at the (.+?)(?:, then|\. Outcome|\.$)/i);
  if(award && /(?:\d+(?:st|nd|rd|th) (?:Annual )?(?:Academy|Daytime Emmy|Grammy) Awards|20\d\d (?:MTV Video Music|Latin Grammy|Game) Awards)/i.test(award[3])) {
    const credit=m.venue==='poly'?award[1].match(/^(.+?) by (.+)$/):null;
    return make({subject:subject(credit?.[1]??award[1]),creator:credit?subject(credit[2]):undefined,domain:normalizeText(award[3]),family:'ceremony-award',metric:normalizeText(award[2]).replace(/ award$/,''),geography:'ceremony-scope',period:normalizeText(award[3]),threshold:'1',comparator:'eq',outcome:'winner'});
  }
  const time=p.match(/^(.+?) is Time Person of the (Year|Decade) (?:for|in) (20\d\d)(?:,|\.)/i);
  if(time)return make({subject:subject(time[1]),domain:'time',family:'named-list-award',metric:'person-of-the-'+time[2].toLowerCase(),geography:'publisher-scope',period:time[3],threshold:'1',comparator:'eq',outcome:'named'});
  const ipo=p.match(/^(.+?) confirms an IPO (before|by) ([A-Za-z]+ \d{1,2},? 20\d\d)(?:,|\.)/i);
  if(ipo){let day=publicDate(ipo[3]);if(day&&ipo[2]==='before')day=new Date(Date.parse(day)-86400000).toISOString().slice(0,10);
    if(day)return make({subject:subject(ipo[1]),domain:'business',family:'business-deadline',metric:'ipo-confirmation',geography:'issuer-scope',period:day,threshold:'1',comparator:'eq',outcome:'confirmed'});
  }
  // Only exact named models. “GPT-7” is not presumed equivalent to “7 or greater”.
  const model=p.match(/^(.+?) releases (Grok \d+(?:\.\d+)?|Gemini \d+(?:\.\d+)?(?: Pro)?) (before|by) ([A-Za-z]+ \d{1,2},? 20\d\d)(?:,|\.)/i);
  if(model){let day=publicDate(model[4]);if(day&&model[3]==='before')day=new Date(Date.parse(day)-86400000).toISOString().slice(0,10);
    if(day)return make({subject:subject(model[1]),domain:'technology',family:'model-release',metric:normalizeText(model[2]),geography:'public-release',period:day,threshold:'1',comparator:'eq',outcome:'released'});
  }
  return undefined;
}

export const settlementDimensions:Record<NonSportsFamily,string[]>={
 'netflix-ranking':['US/global; English/non-English; movie/show','published Tuesday vs observation week vs Monday close','rank, season and Other fallback; delayed publication; ties'],
 'netflix-views':['views vs hours; global English show/movie; chart date','threshold/comparator; rounding; corrections and missing chart'],
 spotify:['US/global; daily/weekly/annual Wrapped; artist/song/album','rank; title and credited artist; source date; ties'],
 'other-music-charts':['publisher; chart type; geography; day/week/year','streams/views/sales/units; revisions; threshold and credits'],
 billboard:['Hot 100/200; song/album; credited artist','dated Saturday vs publication Tuesday; issuance start; year cutoff','rank/top-N; features and joint credits; corrections'],
 'reality-tv':['program/season; winner/exact-place/top-N/advancement','split payouts for shared winners; withdrawal/disqualification','initial vs final elimination; ET/PT deadline; finale postponement'],
 awards:['ceremony/version and category; nomination vs winner','work vs credited person; tie/shared award or separate Tie outcome','postponement; changed categories; rescission'],
 'time-person':['year vs decade; individual vs group','explicit naming vs cover depiction; shared winners'],
 'entertainment-release':['platform/geography; full release vs beta/early access','release vs announcement; before/by and time zone'],
 'critic-score':['Tomatometer vs audience/Metacritic; film vs TV season','strict above vs at least; measurement instant; source revisions'],
 'box-office':['domestic/global; gross vs net; preview receipts','opening weekend/calendar window; source and revisions'],
 'casting-announcement':['confirmed casting vs performance/rumor','franchise/version/role; announcement deadline; source'],
 'culture-lists':['publisher; list edition/date; rank vs top-N','named entity vs group; tie and revision rules'],
 'science-technology':['model/version/benchmark/source and date','public release vs beta; named model vs successor; geographic scope'],
 'companies-business':['company identity; confirmed IPO vs trading start','regulatory jurisdiction; acquisition announcement vs completion; fiscal period'],
 economics:['headline/core; MoM/YoY; seasonal basis; advance/revised','period, precision, comparator; missing-release and shutdown fallback'],
};
