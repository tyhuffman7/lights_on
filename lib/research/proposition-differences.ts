// Independent native dimensions: unknown evidence is never a negative value.
// These parsers do not grant promotion or identify markets by ticker/slug.
import type {Market} from '../arb/types.ts';
import {normalizeText} from './identity.ts';
export const differenceDimensions=['fixtureParticipants','homeParticipant','awayParticipant','fixtureDate','fixtureScheduledAt','targetRange','awardCategory','ceremony','chartFamily','chartRank','contentType','artistRole','action','ordinal','cohort','vicePresident','ostp','cycle','windowStart','windowEnd'] as const;
export type DifferenceDimension=typeof differenceDimensions[number];
export function nativeDifferences(m:Market,resolve:(s:string)=>string){
 const dimensions:Partial<Record<DifferenceDimension,string>>={},evidence:Partial<Record<DifferenceDimension,string>>={};
 const primary=m.rules.trim().split('\n')[0],s=normalizeText(primary),text=normalizeText(m.title+' '+primary),full=normalizeText(m.rules);
 const put=(k:DifferenceDimension,v:string|undefined,proof=primary)=>{if(v){dimensions[k]=v;evidence[k]=proof;}};
 // The two sides of "vs" are fixture participants, not home/away assertions.
 // Never infer home/away from presentation order or use "neither team" as a participant.
 const fixture=primary.match(/(?:\bin (?:the )?|\bwins the |winner of the )(.+?)\s+(?:vs\.?|versus|v\.)\s+(.+?)\s+(?:(?:pro(?:fessional)?|college) (?:football|baseball|basketball)|MODUS Super Series|darts|soccer|hockey|tennis|(?:game|match) (?:originally )?scheduled)/i);
 const participants=fixture?[resolve(fixture[1]),resolve(fixture[2])]:m.identity?.participants.length===2?m.identity.participants.map(resolve):[];
 if(participants.length===2&&!participants.some(p=>/neither team|scheduled|round|finals/.test(p))){
  put('fixtureParticipants',participants.sort().join('|'),fixture?.[0]??JSON.stringify(m.identity?.participants));
  const scheduled=primary.match(/scheduled for ([A-Za-z]+ \d{1,2}, 20\d\d)/i)?.[1];
  const day=scheduled?Date.parse(scheduled+' UTC'):NaN;
  put('fixtureDate',Number.isFinite(day)?new Date(day).toISOString().slice(0,10):m.identity?.eventDate,scheduled??JSON.stringify(m.identity));
  const timing=primary.match(/scheduled for ([A-Za-z]+ \d{1,2}, 20\d\d) at (\d{1,2}:\d{2} [AP]M) (EDT|EST|UTC)/i);
  const timestamp=timing?Date.parse(`${timing[1]} ${timing[2]} ${timing[3]}`):NaN;
  if(Number.isFinite(timestamp))put('fixtureScheduledAt',new Date(timestamp).toISOString(),timing![0]);
 }
 put('homeParticipant',primary.match(/home (?:team|participant) (?:is |: )?(.+?)(?:,|;|\.|$)/i)?.[1]&&resolve(primary.match(/home (?:team|participant) (?:is |: )?(.+?)(?:,|;|\.|$)/i)![1]));
 put('awayParticipant',primary.match(/away (?:team|participant) (?:is |: )?(.+?)(?:,|;|\.|$)/i)?.[1]&&resolve(primary.match(/away (?:team|participant) (?:is |: )?(.+?)(?:,|;|\.|$)/i)![1]));
 if(/league phase/.test(s)){
  const top=s.match(/top (\d+)/),bottom=s.match(/(?:bottom|last) (\d+)/),range=s.match(/(?:positions?|places?|rank(?:s|ed)?|between) (\d+)(?:st|nd|rd|th)? (?:through|to|and) (\d+)/);
  put('targetRange',top?'top:'+top[1]:bottom?'bottom:'+bottom[1]:range?'range:'+range[1]+'-'+range[2]:/bottom of the table/.test(s)?'bottom-of-table':undefined);
 }
 const category=s.match(/\bbest (?:supporting (?:actor|actress)|actor|actress|director|picture|cinematography|original screenplay|adapted screenplay|animated (?:feature|film)|international (?:feature|film)|documentary (?:feature|film)|original song|original score|visual effects|sound|film editing|costume design|production design|makeup and hairstyling)\b/);
 if(category&&/award|oscar|golden globe|bafta/.test(text)){
  put('awardCategory',category[0]);
  put('ceremony',s.match(/(\d+)(?:st|nd|rd|th) (?:academy awards|oscars)/)?.[1]&&'academy:'+s.match(/(\d+)(?:st|nd|rd|th) (?:academy awards|oscars)/)![1]);
 }
 if(/billboard|hot 100|billboard 200/.test(text)){
  put('chartFamily',/hot 100/.test(s)?'billboard-hot-100':/billboard 200/.test(s)?'billboard-200':undefined);
  const top=primary.match(/top\s+(\d+)/i),rank=primary.match(/(?:#|number\s+)(\d+)/i);
  put('chartRank',top?'lte:'+top[1]:rank?'eq:'+rank[1]:undefined);
  put('contentType',/\balbum\b/.test(s)?'album':/\bsong\b|\bsingle\b/.test(s)?'song':undefined);
  put('artistRole',/including features|including featured/.test(s)?'primary-or-featured':/excluding features|primary artist only|lead artist only/.test(s)?'primary-only':/featured artist only/.test(s)?'featured-only':undefined);
 }
 if(/leave|leaves|left|depart|ceases to hold|assume the office/.test(s)&&/office|position|cabinet|minister|secretary|chancellor|leaders/.test(text)){
  const announcement=/announce|announcement/.test(s),actual=/actually left|formally ceases|leave or announce|leaves|to leave|has .+ left/.test(s);
  put('action',/assume the office/.test(s)?'assume-office':announcement&&actual?'departure-or-announcement':announcement?'departure-announcement':actual?'actual-departure':undefined);
  put('ordinal',/\bfirst\b|\bnext (?:member|person|individual)\b/.test(s)?'first-in-cohort':'any-occurrence');
  put('cohort',/g7 leaders/.test(s)?'g7-leaders':/cabinet/.test(s)?'us-cabinet':undefined);
  // Explicit inclusion/exclusion only; absent tokens do not prove exclusion.
  for(const [k,name] of [['vicePresident','vice president'],['ostp','(?:ostp|office of science and technology policy)']] as const){
   put(k,new RegExp('(?:exclud\\w*|does not include|not including)[^.;]{0,80}'+name).test(full)?'excluded':new RegExp('(?:includ\\w*)[^.;]{0,80}'+name).test(full)?'included':undefined,m.rules);
  }
  const definition=full.match(/the cabinet (?:includes|consists of) (.+?)(?: acting| leaving office| a departure|$)/)?.[1];
  if(definition&&/heads of the 15/.test(definition)){
   put('vicePresident',/vice president/.test(definition)?'included':'excluded',definition);
   put('ostp',/ostp|office of science and technology policy/.test(definition)?'included':'excluded',definition);
   put('cohort','us-cabinet:15-departments'+(/as of issuance/.test(definition)?':at-issuance':''),definition);
  }
  const date='([A-Za-z]+ \\d{1,2}, 20\\d\\d)';
  const start=primary.match(new RegExp('after '+date,'i'))?.[1],end=primary.match(new RegExp('(?:before|by) '+date,'i'))?.[1];
  const iso=(x:string|undefined)=>{const t=x?Date.parse(x+' UTC'):NaN;return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):undefined;};
  put('windowStart',iso(start));put('windowEnd',iso(end));
 }
 if(/election|midterm|control of the senate|control of the house/.test(s))put('cycle',s.match(/\b20\d\d\b/)?.[0]);
 return {dimensions,evidence};
}

// A native timestamp contradicting its own title is uncertainty about event
// binding, not proof that the two contracts are different games.
export function fixtureTimingUncertainty(m:Market):string[]{
 if(!m.identity?.eventAt||!m.identity.sports)return [];
 const scheduled=(m.rules+' '+m.title).match(/scheduled for (?:[A-Za-z]+ \d{1,2}, 20\d\d) at (\d{1,2}):(\d{2}) (AM|PM) (EDT|EST|UTC)/i);
 if(!scheduled)return [];
 let hour=Number(scheduled[1])%12+(scheduled[3].toUpperCase()==='PM'?12:0);
 hour=(hour+(({EDT:4,EST:5,UTC:0} as Record<string,number>)[scheduled[4].toUpperCase()]??0))%24;
 const at=new Date(m.identity.eventAt);
 return at.getUTCHours()===hour&&at.getUTCMinutes()===Number(scheduled[2])?[]:[`Unconfirmed fixture timing: native scheduled ${String(hour).padStart(2,'0')}:${scheduled[2]} UTC vs metadata ${m.identity.eventAt}`];
}
