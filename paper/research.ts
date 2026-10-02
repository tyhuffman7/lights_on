// Separate, read-only candidate search. No runtime matcher or automatic approval.
import {writeFileSync} from 'node:fs';
import {get,K,P,rules} from './markets.ts';
import {sha} from './config.ts';

const arg=(name:string,fallback:string)=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const series=arg('series','KXNCAAFWINS'),query=arg('query','college football wins');
if(!/^[A-Z0-9]{1,80}$/.test(series))throw Error('Expected a Kalshi series ticker');
const terms=(await get(`${K}/series/${series}`)).series;
const kalshi:any[]=[];let cursor='';
for(let page=0;page<5;page++){
  const data=await get(`${K}/markets?status=open&series_ticker=${series}&limit=1000&cursor=${encodeURIComponent(cursor)}`);
  kalshi.push(...data.markets);cursor=data.cursor??'';if(!cursor)break;
}
const search=await get(`${P}/search?query=${encodeURIComponent(query)}&limit=100&status=active`);
const poly=[...new Map<string,any>((search.events??[]).flatMap((e:any)=>e.markets??[])
  .filter((p:any)=>p.active===true&&!p.closed).map((p:any)=>[p.slug,p] as [string,any])).values()];
const words=(s:string)=>new Set(s.toLowerCase().match(/[a-z0-9]+/g)?.filter(w=>w.length>2&&!['will','the','yes','no','this','season','games','win','wins','over','under','least'].includes(w))??[]);
const suggestions=kalshi.map(k=>{
  const kw=words(`${k.title} ${k.yes_sub_title} ${k.rules_primary}`);
  const ranked=poly.map(p=>({p,score:[...words(`${p.title} ${p.description}`)].filter(w=>kw.has(w)).length})).sort((a,b)=>b.score-a.score);
  return ranked.filter(x=>x.score>=2).slice(0,2).map(({p,score})=>{
    const r=rules(k,terms,p);
    return {score,kalshiQuestion:k.rules_primary,polyQuestion:p.description,
      candidate:{id:k.ticker.toLowerCase(),label:k.title,kalshi:k.ticker,poly:p.slug,
        kalshiRulesHash:sha(r.kalshi),polyRulesHash:sha(r.poly),kalshiCloseAt:k.close_time,polyCloseAt:p.endDate,
        reviewedAt:null,reviewSource:null,settlementModel:'ordinary-$1-pair',settlementRisk:null},
      sources:{kalshi:`${K}/markets/${k.ticker}`,poly:`${P}/market/slug/${p.slug}`}};
  });
}).flat().sort((a,b)=>b.score-a.score).slice(0,30);
const report={at:new Date().toISOString(),series,query,kalshiMarkets:kalshi.length,polyMarkets:poly.length,
  truncated:!!cursor||search.events?.length>=100,
  reviewRequired:'Token overlap only. Check participant, season, threshold, period, orientation, ordinary payout and exceptional settlement before copying a candidate. Review nulls intentionally fail config validation.',
  existingSource:'config/approved-pairs.json links the retained native manual audits; no paid pairing service required.',suggestions};
const output=arg('out','');if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
