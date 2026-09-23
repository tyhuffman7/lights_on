import type {Market, Pair} from '../arb/types.ts';
import {canonicalTemplate, type CanonicalTemplate} from './canonical-template.ts';
import type {EntityRegistry} from './entities.ts';
import {normalizeText, footballYardProp} from './identity.ts';
import {assessSettlement} from './settlement-validation.ts';
import type {RouteProof} from './family-settlement.ts';

export function documentPair(pair: Pair) {
  const documents = [...pair.a.rules.matchAll(/https:\/\/assets\.kalshi\.com\/contract_terms\/(\w+)\.pdf/g)].map(m => m[1]);
  return documents.length === 1 ? `${documents[0]} × ${pair.b.id.split('-')[0].toUpperCase()}` : undefined;
}
const first = (m: Market) => m.rules.trim().split('\n')[0];
const date = (s: string) => {
  const d = s.match(/\b20\d\d-\d\d-\d\d\b|\b[A-Za-z]+ \d{1,2},? 20\d\d\b/)?.[0];
  const ms = d && Date.parse(d+' UTC');
  return ms && Number.isFinite(ms) ? new Date(ms).toISOString().slice(0,10) : undefined;
};
const conference = (s: string) => normalizeText(s).replace(/college football | football| conference/g,'').replace(/^mac$/,'mid american').replace(/^atlantic coast$/,'acc').replace(/^usa$/,'conference usa');
const vector = (t: CanonicalTemplate) => ({entity:t.subject, threshold:`${t.comparator}:${t.threshold}`, orientation:t.orientation,
  window:t.period, geography:t.geography, source:t.domain, familyDimensions:JSON.stringify([t.family,t.metric,t.outcome,t.creator??null,t.participants??null])});

// Parse only the pre-reviewed contract grammars. Unrecognized evidence stays a
// research gap. This does not alter discovery, aliases, mappings or live gates.
export function proveRoute(pair: Pair, registry: EntityRegistry): RouteProof {
  const proof: RouteProof = {dimensions:{},missingEvidence:[],conflicts:[]};
  const key = documentPair(pair);
  if (!key) { proof.missingEvidence.push('Single Kalshi primary-document binding unavailable'); return proof; }
  const [k,p] = key.split(' × ');
  const a = pair.a, b = pair.b;
  if (pair.inverted && !['FOOTBALLGAMEWIN','BASEBALLGAMEWIN','BASKETBALLGAMEWIN','ACHIEVEMENTS'].includes(k)) proof.conflicts.push('Non-winner route has unsupported inverted orientation.');
  const norm = (m: Market) => m.identity && registry.normalize(m.identity);
  const ai = norm(a), bi = norm(b);
  const resolve = (name: string, m: Market) => registry.resolve(normalizeText(name),m.identity?.competition) ?? normalizeText(name);
  const compare = (x: Record<string,string>, y: Record<string,string>, evidence: string) => {
    for (const field of ['entity','threshold','orientation','window','geography','source','familyDimensions'] as const)
      if (x[field] && y[field]) proof.dimensions[field]={kalshi:x[field],poly:y[field],evidence};
  };
  const fill = (x: Record<string,string>, evidence: string) => compare(x,x,evidence);
  // Known ordinary conflicts must win over parser/evidence gaps.
  const conflict: Record<string,string> = {
    SCOURT:'Senate confirmation versus formal assumption including recess appointment.',
    CONTROL:'Leader-party snapshot versus election-attributed majority/VP tiebreak; a party switch or different leader can disagree.',
    PRESPERSON:'Inaugurated non-acting president versus electoral winner; a successor inauguration can disagree.',
    MODELRELEASEDATE:'Named Grok 5 versus Grok 5-or-greater/generation successor in PM inline terms.',
    NEXTOUT:'First departure in a set versus individual departure by 2026 year-end.',
    PERSONMEETING:'September meeting window versus issuance-to-2026-year-end interaction window.',
    RANKLISTMUSICINDUSTRY:'Year-end Luminate digital-sales list versus monthly Billboard Hot 100 achievement.',
    POLITICALSTATVALUECOMPARISON:'2026 contested-governor set and current count versus November election-day party attribution; range-title/inline boundary conflict also present.',
    COMPETITIONREALITYELIM:'Kalshi before next calendar date in ET versus PM 23:59 Pacific; three-hour ordinary announcement window differs.',
    BIGBROTHERELIMINATION:'Kalshi before next calendar date in ET versus PM 23:59 Pacific; three-hour ordinary announcement window differs.',
  };
  if (conflict[k]) proof.conflicts.push(conflict[k]);
  if (k==='RANKLISTSONG' && p==='CCRC') proof.conflicts.push('Any September chart versus single September 26 chart.');
  if (k==='FRENCHPRES' || k==='ELECTION') proof.conflicts.push('Next election after issuance versus specifically 2027 election; an earlier election need not be the same event.');
  if (k==='NETFLIXRANK') proof.missingEvidence.push('Kalshi US inline chart versus English-chart PDF scope: authoritative precedence/scope clarification unavailable.');
  if (['TOPALBUMBY','WHENIPO','IPOEVENTANNOUNCE','RUN','RANKLISTSONG'].includes(k)) proof.missingEvidence.push('Common contractual issuance/qualifying-history boundary is unproven; creation/open timestamps alone do not establish identical eligible history.');
  if (k==='WHENIPO') proof.missingEvidence.push('First-ever-public-company restriction needs company-history binding absent from catalog.');

  const ta=canonicalTemplate({...a,rules:a.rules.trimStart()},registry), tb=canonicalTemplate({...b,rules:b.rules.trimStart()},registry);
  if (ta && tb) {
    if (k==='MTVVMAS' && ta.subject!==tb.subject) {
      proof.missingEvidence.push('Artist-only versus specific work/credited recipient: official category nomination/credit binding unavailable.');
      const x=vector(ta),y=vector(tb);x.entity='';y.entity='';x.familyDimensions=JSON.stringify([ta.family,ta.metric,ta.outcome]);y.familyDimensions=JSON.stringify([tb.family,tb.metric,tb.outcome]);compare(x,y,'Award edition/category compare; entity deliberately unproven.');
    } else {
      // A missing creator on one side is not evidence for a particular work.
      if ((ta.creator || tb.creator) && ta.creator!==tb.creator) proof.missingEvidence.push('Exact work/version creator attribution absent on one side.');
      const x=vector(ta),y=vector(tb);
      if (proof.missingEvidence.some(s=>s.startsWith('Exact work'))) { x.familyDimensions=JSON.stringify([ta.family,ta.metric,ta.outcome]);y.familyDimensions=JSON.stringify([tb.family,tb.metric,tb.outcome]); }
      compare(x,y,'Independent canonical predicates from both original inline rules, with linked product scope checked.');
    }
    if (pair.inverted) proof.conflicts.push('Canonical YES predicates match but candidate orientation is inverted.');
    return proof;
  }
  const reviewed=assessSettlement(pair);
  if (reviewed.normalOutcomeMatched && ['ACHIEVEMENTS','FOOTBALLENTITYSTAT'].includes(k)) {
    const prop=footballYardProp(a.rules), id=JSON.stringify(ai?.tennisContext??[ai?.eventDate,ai?.participants]);
    fill({entity:prop?.player??ai?.outcome??'',threshold:prop?`gte:${prop.line+0.5}`:'winner',orientation:pair.inverted?'opposing winner / same-side hedge':'same predicate / opposite-side hedge',window:id,geography:ai?.competition??'',source:'official governing body',familyDimensions:prop?prop.statistic:'full-match with verified participants'},reviewed.checks.join('; '));
    return proof;
  }
  if (['FOOTBALLGAMEWIN','BASEBALLGAMEWIN','BASKETBALLGAMEWIN'].includes(k)) {
    const ar=first(a).match(/^If (.+?) wins the (.+?) vs (.+?) (?:professional baseball|pro baseball|professional football|pro football|college football|women's Pro Basketball|WNBA|NBA|Korea KBO|Japan NPB) game originally scheduled for (.+?), then/i);
    const br=first(b).match(/^This market will settle to the winner of the (.+?) vs (.+?) (?:MLB|Korea KBO|KBO|Japan NPB|NPB|NFL|College Football|WNBA|NBA) game scheduled for (.+?)\./i);
    if (ar && br && ai?.outcome && bi?.outcome && ai.competition===bi.competition) {
      const teamsA=[resolve(ar[2],a),resolve(ar[3],a)].sort(),teamsB=[resolve(br[1],b),resolve(br[2],b)].sort();
      const selected=resolve(ar[1],a);
      if (selected!==ai.outcome || !teamsA.includes(selected) || !teamsB.includes(bi.outcome)) proof.conflicts.push('Winner prose/outcome labels contradict participant identity.');
      if ((selected===bi.outcome)===pair.inverted) proof.conflicts.push('Winner orientation contradicts selected outcomes.');
      const orientation=pair.inverted?'opposite-winner predicates':'same-winner predicates';
      compare({entity:JSON.stringify(teamsA),threshold:'winner',orientation,window:date(ar[4])??'',geography:ai.competition??'',source:'official governing body',familyDimensions:'full game'},
        {entity:JSON.stringify(teamsB),threshold:'winner',orientation,window:date(br[3])??'',geography:bi.competition??'',source:'official governing body',familyDimensions:'full game'},'Primary winner clauses independently name both teams/date; original outcome aliases and inversion checked.');
      if (k==='BASEBALLGAMEWIN' && ai.eventAt && bi.eventAt && ai.eventAt!==bi.eventAt) proof.conflicts.push('Baseball scheduled instant differs (possible doubleheader).');
      return proof;
    }
  }
  if (['NCAAF','NCAAFCONFCHAMPQ','NEWACHIEVEMENT'].includes(k)) {
    const re=/^(?:If|This market will settle to Yes if) (.+?) (wins|qualifies for) the (20\d\d) (?:College Football )?(.+?) (?:Football )?Championship(?: Game)?(?:, then| scheduled for)/i;
    const x=first(a).match(re),y=first(b).match(re);
    if (x&&y) {
      const v=(r:RegExpMatchArray,m:Market)=>({entity:resolve(r[1],m),threshold:normalizeText(r[2]),orientation:'yes',window:r[3]+':season',geography:'cfb',source:'official conference',familyDimensions:conference(r[4])});
      const vx=v(x,a),vy=v(y,b);
      if (!registry.resolve(normalizeText(x[1]),a.identity?.competition) || !registry.resolve(normalizeText(y[1]),b.identity?.competition)) { proof.missingEvidence.push('Primary conference-team alias lacks an exact venue-ID binding in saved metadata.'); delete proof.dimensions.entity; vx.entity='';vy.entity=''; }
      compare(vx,vy,'Explicit conference, season, winner/qualification and named team; MAC/Mid-American and ACC/Atlantic Coast are conference names, not added route mappings.');return proof;
    }
  }
  if (['NCAAFUNDEFEATED','NBA','RELEGATION','NFLLASTUNDEFEATEDTEAM','TITLE'].includes(k) && ai?.outcome && bi?.outcome) {
    const year=(m:Market)=>first(m).match(/\b20\d\d(?:-(?:20)?\d\d)?\b/)?.[0]?.replace(/-(20)(\d\d)$/,'-$2');
    const detail=(m:Market)=>{
      const s=normalizeText(first(m));
      if(k==='NBA') return (s.includes('western')?'west':s.includes('eastern')?'east':'')+':seed1';
      if(k==='NCAAFUNDEFEATED') return s.includes('undefeated')&&s.includes('regular season')?'undefeated:regular':'';
      if(k==='NFLLASTUNDEFEATEDTEAM') return s.includes('last remaining')&&/without a loss|undefeated/.test(s)?'last-undefeated:regular:week':'';
      if(k==='RELEGATION') return /relegated/.test(s)?'relegation:season':'';
      if(k==='TITLE') return s.includes('american league')?'american-league-pennant':s.includes('national league')?'national-league-pennant':s.includes('world series')||(m.identity?.competition==='mlb'&&s.includes('pro baseball championship'))?'world-series':s.includes('super bowl')||(m.identity?.competition==='nfl'&&s.includes('pro football championship'))?'super-bowl':s.includes('wnba championship')||s.includes('women s pro basketball championship')?'wnba-championship':'';
      return '';
    };
    let ya=year(a),yb=year(b);if(k==='NFLLASTUNDEFEATEDTEAM'&&ya===yb+'-27')yb=ya;
    compare({entity:ai.outcome,threshold:'achievement',orientation:'yes',window:ya??'',geography:ai.competition??'',source:'official governing body',familyDimensions:detail(a)},
      {entity:bi.outcome,threshold:'achievement',orientation:'yes',window:yb??'',geography:bi.competition??'',source:'official governing body',familyDimensions:detail(b)},'Original venue participant IDs/aliases, inline season and specific achievement compared.');
    if(pair.inverted)proof.conflicts.push('Achievement predicate unexpectedly inverted.');
    return proof;
  }
  if (k==='U3') {
    const x=first(a).match(/above ([\d.]+)% in (\w+ 20\d\d)/), y=first(b).match(/for (\w+ 20\d\d) is above ([\d.]+)%/);
    if(x&&y&&/seasonally adjusted unemployment rate \(U-3\)/.test(a.rules)&&/seasonally adjusted unemployment rate \(U-3\)/.test(b.rules)){
      const v=(value:string,month:string)=>({entity:'U3',threshold:'gt:'+value,orientation:'yes',window:month,geography:'US',source:'BLS',familyDimensions:'seasonally-adjusted:monthly:initial'});
      compare(v(x[1],x[2]),v(y[2],y[1]),'Both inline clauses specify BLS U3, seasonal adjustment, reference month and threshold.');return proof;
    }
  }
  if(k==='PRESNOM'){
    const x=first(a).match(/^If (.+?) wins and accepts the nomination for the Presidency for the (.+?) party in (20\d\d)/i),y=first(b).match(/^This market will settle to Yes if (.+?) wins and accepts the (.+?) Party nomination to contest the (20\d\d)/i);
    if(x&&y){const v=(r:RegExpMatchArray)=>({entity:normalizeText(r[1]),threshold:'wins-and-accepts',orientation:'yes',window:r[3],geography:'US',source:normalizeText(r[2])+':party',familyDimensions:'president:first-accepted'});compare(v(x),v(y),'Exact nomination and acceptance clauses; PM inline replacement clause reviewed.');return proof;}
  }
  if(k==='USELECTION'){
    const x=first(a).match(/^If (.+?) wins the (20\d\d) (.+?) mayoral election/i),y=first(b).match(/(?:if )?(.+?) wins the (20\d\d) (?:election for Mayor of (.+?)\.|(.+?) Mayoral Election)/i);
    if(x&&y){const v=(person:string,year:string,city:string)=>({entity:normalizeText(person),threshold:'elected-winner',orientation:'yes',window:year,geography:normalizeText(city),source:'official electoral authority',familyDimensions:'mayor:final-round'});compare(v(x[1],x[2],x[3]),v(y[1].replace(/^This market will settle to Yes if |^If /i,''),y[2],y[3]??y[4]),'Exact candidate/city/year, final election and source; product cancellation/media-review differences retained.');return proof;}
  }
  if(!proof.conflicts.length&&!proof.missingEvidence.length)proof.missingEvidence.push('Exact event/participant/window evidence not fully established by the reviewed grammar; inspect private route audit before admission.');
  return proof;
}
