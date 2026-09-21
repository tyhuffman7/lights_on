import type {HttpEvidence} from './confirmation.ts';
const adapterLimits={responseMs:1500,processingMs:250,clockMs:1000};
export function inspectHttp(e:HttpEvidence){
 const h=e.headers,reasons:string[]=[];const age=h.age===undefined?null:Number(h.age),date=h.date===undefined?null:Date.parse(h.date);
 if(e.status!==200)reasons.push('HTTP_'+e.status);
 const dt=e.responseMono-e.requestMono,processing=e.processedMono-e.responseMono;
 if(dt<0||dt>adapterLimits.responseMs)reasons.push('CONFIRMATION_RESPONSE_DELAY');
 if(processing<0||processing>adapterLimits.processingMs)reasons.push('CONFIRMATION_PROCESSING_BACKLOG');
 if(Math.abs((e.responseAt-e.requestAt)-dt)>adapterLimits.clockMs||Math.abs((e.processedAt-e.responseAt)-processing)>adapterLimits.clockMs)reasons.push('CONFIRMATION_CLOCK_DISCONTINUITY');
 if(date!==null&&(!Number.isFinite(date)||date>e.responseAt+1000||e.responseAt-date>2000))reasons.push('HTTP_DATE_NOT_CURRENT');
 if(age!==null&&(!Number.isFinite(age)||age<0))reasons.push('INVALID_CACHE_AGE');
 const cached=(age!==null&&age>0)||/hit|stale|updating/i.test(h['cf-cache-status']??'')||/\bhit\b/i.test(h['x-cache']??'');
 const explicit=/no-cache|no-store|private/i.test(h['cache-control']??'')||['DYNAMIC','BYPASS','MISS','EXPIRED','REVALIDATED'].includes(h['cf-cache-status']?.toUpperCase()??'');
 return {transportReasons:reasons,ageSeconds:age,dateAt:date,cacheEvidence:cached?'CACHED':explicit?'EXPLICIT_REVALIDATION_OR_BYPASS':'UNKNOWN',
  missingOptionalHeaders:['age','cache-control','cf-cache-status','x-cache','etag','last-modified','via'].filter(k=>h[k]===undefined),
  // Even explicit HTTP cache metadata is not a book version or a matching-engine timestamp.
  bookCurrentness:'UNPROVEN_BY_HTTP_ALONE'};
}

export function assessKalshiStatus(id:string,market:Record<string,unknown>|undefined,http:HttpEvidence){
 const assessment=inspectHttp(http),reasons=[...assessment.transportReasons];
 if(market?.ticker!==id)reasons.push('KALSHI_MARKET_ID_MISMATCH');
 if(market?.status!=='active')reasons.push('KALSHI_MARKET_NOT_ACTIVE');
 const closeAt=typeof market?.close_time==='string'?Date.parse(market.close_time):NaN;
 if(!Number.isFinite(closeAt)||closeAt<=http.processedAt)reasons.push('KALSHI_CLOSE_TIME_PASSED_OR_UNKNOWN');
 if(assessment.cacheEvidence==='UNKNOWN'||assessment.dateAt===null)reasons.push('MARKET_STATUS_CURRENTNESS_UNPROVEN');
 if(assessment.cacheEvidence==='CACHED')reasons.push('MARKET_STATUS_CACHED');
 return {confirmedOpen:reasons.length===0,reportedStatus:market?.status??null,closeTime:market?.close_time??null,reasons,http:assessment};
}
