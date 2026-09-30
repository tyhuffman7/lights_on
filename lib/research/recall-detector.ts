import type {Market, Pair, Side, Venue} from '../arb/types.ts';
import type {StreamBook} from './types.ts';
import {catalogEntities} from './entities.ts';
import {canonicalTemplate, canonicalTemplateKey} from './canonical-template.ts';
import {normalizeText,generalHints} from './identity.ts';
import {evaluateEvArb, evPaperDefaults, USD_SCALE} from './ev-arb.ts';

export const recallPolicy = Object.freeze({ordersEnabled:false, sampleMs:250, discoveryMs:300_000,
  durationMs:20*60_000, maxContracts:10, maxConfirmationJobs:2, confirmationCooldownMs:10_000,
  streamGroupSize:100,maxStreamRestarts:3,maxPublicHttpAttempts:3, maxBookAgeMs:2000, restSpacingMs:300, maxEvidenceBytes:256*1024*1024,
  delayMs:[0,100,250,500,1000], simulatedCapitalPerVenue:50, maxPairedCommitment:5});
export type RecallRoute={pair:Pair;matchSource:'CANONICAL'|'SPORTS_EVENT'|'TEXT';warnings:string[];eventKey:string;ticks?:Record<Venue,number>};
const stop=new Set('will the be in of by a an to on at for is than before after above below yes no and or win wins winner over under total game match'.split(' '));
const tokens=(m:Market)=>new Set(normalizeText(m.title+' '+m.outcome).split(' ').filter(w=>w.length>2&&!stop.has(w)&&!/^\d+$/.test(w)));

// Independent public proposition hints, not settlement/exception verification.
function proposition(m:Market){
  const primary=m.rules.split('\n')[0].split(/\. (?=[A-Z])/)[0],s=normalizeText(m.title+' '+primary);
  const metrics=[['fantasy points',/fantasy points/],['passing touchdowns',/passing touchdowns/],
    ['rushing touchdowns',/rushing touchdowns/],['receiving touchdowns',/receiving touchdowns/],
    ['receptions',/\breceptions\b/],['fantasy points',/fantasy|#1 in scoring/],
    ['passing yards',/passing yards/],['rushing yards',/rushing yards/],['receiving yards',/receiving yards/],
    ['first touchdown',/first touchdown|1st touchdown/],['touchdowns',/touchdowns/],
    ['mvp',/most valuable player|\bmvp\b/],['rbi',/\brbis?\b|runs batted in/],
    ['home runs',/home runs/],['strikeouts',/strikeouts/],['hits',/\bhits\b/],
    ['championship',/champion|championship|world series|pennant/]] as const;
  const metric=metrics.find(([,r])=>r.test(s))?.[0];
  const scope=/career|retirement/.test(s)?'career':/\bweek \d+\b/.test(s)?s.match(/\bweek \d+\b/)![0]:
    /postseason|playoff/.test(s)?'postseason':/regular season/.test(s)?'regular-season':/game (?:originally )?scheduled/.test(s)?'game':undefined;
  const rank=/most|highest|leads|leader|#1 ranked|#1 in scoring/.test(s)?'leader':/first touchdown|1st touchdown/.test(s)?'first':undefined;
  const round=s.match(/\bround (\d+)\b/)?.[1];
  const award=metric==='mvp'?/world series/.test(s)?'world-series':/national league|\bnl mvp\b/.test(s)?'national-league':
    /american league|\bal mvp\b/.test(s)?'american-league':undefined:undefined;
  const chart=/billboard/.test(s)?/at least (\d+) week/.test(s)?'weeks:'+s.match(/at least (\d+) week/)![1]:
    /any billboard.*chart/.test(s)?'weeks:1':undefined:undefined;
  const threshold=primary.replace(/,(?=\d{3}\b)/g,'').match(/(?:at least|over|more than|records?) (\d+(?:\.\d+)?)(\+| or more)?/i);
  const lower=threshold?(/^(?:at least|records?)/i.test(threshold[0])?Math.ceil(Number(threshold[1])):Math.floor(Number(threshold[1]))+1):undefined;
  return {metric,scope,rank,round,lower,award,chart};
}

// This index is for observation, never settlement approval. Conflicting/missing
// dimensions are retained as warnings; an unknown orientation gets both hypotheses.
export function recallMatches(kalshi:Market[],poly:Market[]){
  const registry=catalogEntities([...kalshi,...poly].map(m=>m.identity));
  const prepare=(ms:Market[])=>ms.filter(m=>m.open).map(m=>{
    const identity=m.identity&&registry.normalize(m.identity),market={...m,identity};
    const template=canonicalTemplate(market,registry);
    const event=identity?.sports&&identity.eventDate&&identity.participants.length>=2
      ?JSON.stringify([identity.competition,identity.eventDate,[...identity.participants].sort()]):null;
    const hints=generalHints(market);
    const subject=normalizeText(identity?.outcome||hints.subject||
      (m.venue==='poly'?m.title.split(' · ')[0]:m.outcome));
    return {market,identity,template,event,words:tokens(market),subject,hints,proposition:proposition(market)};
  });
  const left=prepare(kalshi),right=prepare(poly),index=new Map<string,number[]>();
  const keys=(x:typeof left[number])=>[
    ...(x.template?['c:'+canonicalTemplateKey(x.template)]:[]),...(x.event?['e:'+x.event]:[]),
    ...[...x.words].map(w=>'w:'+w)];
  right.forEach((r,n)=>{for(const k of keys(r)){const a=index.get(k)??[];a.push(n);index.set(k,a);}});
  const routes:RecallRoute[]=[],events=new Set<string>();
  const diagnostics={comparisons:0,textDeferred:0,canonical:0,sports:0,text:0,orientationHypotheses:0,
    knownDimensionConflicts:{} as Record<string,number>,weakTextRejected:0};
  for(const a of left){
    const choices=new Set<number>();
    for(const k of keys(a).filter(k=>!k.startsWith('w:')))for(const n of index.get(k)??[])choices.add(n);
    // Rare shared tokens find additional subjects without a quadratic catalog join.
    const rare=[...a.words].map(w=>index.get('w:'+w)??[]).sort((x,y)=>x.length-y.length).slice(0,3);
    for(const ids of rare){if(ids.length>1000){diagnostics.textDeferred+=ids.length;continue;}for(const n of ids)choices.add(n);}
    for(const n of choices){
      const b=right[n];diagnostics.comparisons++;
      const exact=!!a.template&&!!b.template&&canonicalTemplateKey(a.template)===canonicalTemplateKey(b.template);
      const sports=!!a.event&&a.event===b.event;
      const shared=[...a.words].filter(w=>b.words.has(w)).length;
      const genericSubject=new Set('regular season postseason playoffs playoff round least most ranked points yards receptions touchdown touchdowns'.split(' '));
      const namedSubject=(s:string)=>s.split(' ').filter(w=>w&&!stop.has(w)&&!genericSubject.has(w)&&!/^\d+$/.test(w));
      const as=namedSubject(a.subject),bs=namedSubject(b.subject);
      const sameSubject=as.length>=2&&a.subject===b.subject;
      const subjectInOther=as.length>=2&&as.every(w=>b.words.has(w))||bs.length>=2&&bs.every(w=>a.words.has(w));
      const sameQuestionTitle=a.words.size>=3&&normalizeText(a.market.title)===normalizeText(b.market.title);
      // Text fallback intentionally accepts pending threshold/date/period review.
      if(!exact&&!sports&&(shared<2||shared/Math.max(1,Math.min(a.words.size,b.words.size))<.65))continue;
      if(!exact&&!sports&&!sameSubject&&!subjectInOther&&!sameQuestionTitle){diagnostics.weakTextRejected++;continue;}
      if(!exact&&!sports&&a.hints.years.length&&b.hints.years.length&&!a.hints.years.some(y=>b.hints.years.includes(y))){
        diagnostics.knownDimensionConflicts.YEAR=(diagnostics.knownDimensionConflicts.YEAR??0)+1;continue;}
      if(!exact&&!sports&&a.identity?.sports!==b.identity?.sports)continue;
      const warnings:string[]=[];
      const ia=a.identity,ib=b.identity;
      for(const k of ['competition','eventDate','marketType','line','period','units','location'] as const)
        if(ia?.[k]!==undefined&&ib?.[k]!==undefined&&ia[k]!==ib[k])warnings.push('DIMENSION_CONFLICT:'+k);
      if(!exact){
        for(const k of ['metric','scope','rank','round','lower','award','chart'] as const){const x=a.proposition[k],y=b.proposition[k];
          if(x!==undefined&&y!==undefined&&x!==y)warnings.push('PROPOSITION_CONFLICT:'+k);}
        // A named winner and a round leader, or a threshold and a leader, are
        // distinct questions even where one venue omits a structured type.
        if(ia?.sports&&ib?.sports)for(const k of ['rank','round'] as const)if((a.proposition[k]===undefined)!==(b.proposition[k]===undefined))warnings.push('PROPOSITION_CONFLICT:'+k);
      }
      // Known different questions are not plausible outcome matches. Canonical
      // templates handle discrete >=N / >N-.5 and venue spread conventions.
      if(!exact&&warnings.length){for(const w of warnings)diagnostics.knownDimensionConflicts[w]=(diagnostics.knownDimensionConflicts[w]??0)+1;continue;}
      if(!exact&&!sports){
        const contextA=[...a.words].filter(w=>!as.includes(w)&&!bs.includes(w));
        const contextB=[...b.words].filter(w=>!as.includes(w)&&!bs.includes(w));
        const contextShared=contextA.filter(w=>contextB.includes(w)).length;
        const metricMatch=a.proposition.metric!==undefined&&a.proposition.metric===b.proposition.metric;
        if(contextShared<1&&!metricMatch&&!sameQuestionTitle){diagnostics.weakTextRejected++;continue;}
      }
      const source=exact?'CANONICAL':sports?'SPORTS_EVENT':'TEXT';
      if(source==='CANONICAL')diagnostics.canonical++;else if(source==='SPORTS_EVENT')diagnostics.sports++;else diagnostics.text++;
      const named=(s:string|undefined)=>!!s&&!/^(yes|no|unknown long|unknown short)$/i.test(s);
      let orientations:boolean[];
      if(exact)orientations=[false];
      else if(sameSubject||subjectInOther||named(ia?.outcome)&&named(ib?.outcome)&&ia!.outcome===ib!.outcome)orientations=[false];
      else if(sports&&ia?.marketType==='winner'&&ib?.marketType==='winner'&&ia.participants.length===2&&
        ia.participants.includes(ia.outcome??'')&&ib.participants.includes(ib.outcome??''))orientations=[true];
      else {orientations=[false,true];warnings.push('ORIENTATION_UNPROVEN');diagnostics.orientationHypotheses+=2;}
      const eventKey=(a.event??a.market.identity?.eventKey??a.market.id)+'::'+(b.event??b.market.identity?.eventKey??b.market.id);
      events.add(eventKey);
      for(const inverted of orientations)routes.push({pair:{id:`${a.market.id}::${b.market.id}${inverted?'::inverted':''}`,
        a:a.market,b:b.market,inverted,reviewed:false},matchSource:source,warnings:[...warnings,'SETTLEMENT_REVIEW_PENDING'],eventKey});
    }
  }
  return {routes,diagnostics,eventMatches:events.size};
}

export type TransportEvidence={requestAt:number;responseAt:number;durationMs:number;cacheAgeSeconds:number|null;
  cacheStatus:string|null;bodySha256:string};
export type ObservedBook={book:StreamBook;transport?:TransportEvidence};
export function bookAges(b:ObservedBook,now:number){
  return {receiptMs:now-b.book.receivedAt,exchangeMs:b.book.exchangeAt===null?null:now-b.book.exchangeAt,
    cacheMs:b.transport?.cacheAgeSeconds===null||b.transport?.cacheAgeSeconds===undefined?null:b.transport.cacheAgeSeconds*1000,
    requestMs:b.transport?now-b.transport.requestAt:null};
}
export function currentBook(b:ObservedBook,now:number,maxAgeMs=recallPolicy.maxBookAgeMs){
  const a=bookAges(b,now);
  if(!b.book.valid||!b.book.open||b.book.connection!=='LIVE')return false;
  if(a.receiptMs<0||a.receiptMs>maxAgeMs||a.exchangeMs!==null&&(a.exchangeMs< -1000||a.exchangeMs>maxAgeMs))return false;
  if(b.book.source==='rest')return !!b.transport&&a.requestMs!==null&&a.requestMs>=0&&a.requestMs<=maxAgeMs&&
    (a.cacheMs===null||a.cacheMs===0)&&!/(HIT|STALE|UPDATING)/i.test(b.transport.cacheStatus??'');
  return b.book.source==='stream';
}
export function freshnessBucket(ms:number|null){if(ms===null)return 'unknown';if(ms<0)return 'future';
  for(const n of [250,500,1000,2000,5000])if(ms<=n)return '<='+n+'ms';return '>5000ms';}

export function recallSignals(route:RecallRoute,books:Record<Venue,ObservedBook>,now=Date.now(),quantities?:number[]){
  const quantitiesToTry=quantities??Array.from({length:recallPolicy.maxContracts},(_,i)=>i+1);
  return (['yes','no'] as Side[]).flatMap(side=>quantitiesToTry.map(quantity=>{
    const e=evaluateEvArb(route.pair,{kalshi:books.kalshi.book,poly:books.poly.book},side,quantity,now,'UNVERIFIED',
      evPaperDefaults,route.ticks??{kalshi:0,poly:0},route.warnings);
    const fresh=currentBook(books.kalshi,now)&&currentBook(books.poly,now);
    const ages={kalshi:bookAges(books.kalshi,now),poly:bookAges(books.poly,now)};
    const minimumsKnown=route.pair.a.minQty>0&&route.pair.b.minQty>0;
    const minimumQuantityPass=minimumsKnown&&quantity>=route.pair.a.minQty&&quantity>=route.pair.b.minQty;
    const withinCapital=e.acquisitionCost!==null&&e.estimatedFees!==null&&
      e.acquisitionCost+e.estimatedFees<=recallPolicy.maxPairedCommitment*USD_SCALE;
    return {evaluation:e,ages,skewMs:Math.abs(books.kalshi.book.receivedAt-books.poly.book.receivedAt),fresh,
      candidate:e.economicStatus==='REALISTIC_NET_POSITIVE',minimumQuantityPass,minimumsKnown,withinCapital,
      verificationStatus:'verification-pending' as const,
      executable:fresh&&minimumQuantityPass&&route.pair.a.open&&route.pair.b.open&&(route.pair.a.exchangeIndex??0)===0&&
        !route.warnings.includes('ORIENTATION_UNPROVEN')&&e.kalshi!==null&&e.poly!==null};
  }));
}

// Fair category interleaving; hot jobs have their own bounded lane in the worker.
export function fairRoutes(routes:RecallRoute[]){
  const groups=new Map<string,RecallRoute[]>();for(const r of routes){const key=r.pair.a.identity?.competition??r.pair.a.category;
    const g=groups.get(key)??[];g.push(r);groups.set(key,g);}
  const out:RecallRoute[]=[];for(let i=0;out.length<routes.length;i++)for(const g of groups.values())if(g[i])out.push(g[i]);return out;
}
