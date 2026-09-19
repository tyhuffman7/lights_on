import type {Identity} from './identity.ts';
import type {Market} from '../arb/types.ts';
// Reviewed official 2026 main draw, tournament 2937, September 14–20.
// https://www.protennislive.com/posting/2026/2937/mds.pdf
// Only these captured first-round matches justify the shorter PM parent label.
const guangzhouMatches:Record<string,string[]>={
 'aec-atp-shimoc-pavkot-2026-09-14':['ATP:PAVEL_KOTOV','ATP:SHINTARO_MOCHIZUKI'],
 'aec-atp-jakdel-hikshi-2026-09-14':['ATP:HIKARU_SHIRAISHI','ATP:JAKE_DELANEY'],
};
export function sameTennisTournament(a:Identity,b:Identity,poly:Market){
 const x=a.tennisContext,y=b.tennisContext;
 if(!x||!y||x.year!==y.year||x.round!==y.round)return false;
 if(x.tournament===y.tournament)return true;
 const players=guangzhouMatches[poly.id],date=b.eventDate;
 return !!players&&x.year==='2026'&&x.round==='round of 32'&&x.tournament==='challenger guangzhou huangpu'&&y.tournament==='challenger guangzhou'&&
  !!date&&date>='2026-09-14'&&date<='2026-09-20'&&
  JSON.stringify([...b.participants].sort())===JSON.stringify(players);
}
