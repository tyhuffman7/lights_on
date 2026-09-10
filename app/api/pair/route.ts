import {market} from '@/lib/arb/adapters';import {loadState,saveState} from '@/lib/store';import {user,reply,error,sameOrigin} from '@/lib/api';import {log} from '@/lib/arb/ledger';
export async function POST(req:Request){try{
 sameOrigin(req);const uid=await user(),x=await req.json() as Record<string,any>;const [a,b]=await Promise.all([market('kalshi',String(x.kalshi||'')),market('poly',String(x.poly||''))]);
 const pair={id:a.id+'::'+b.id,a,b,inverted:x.inverted===true,reviewed:false};
 if(x.action==='review'){
  if(x.rulesChecked!==true||x.outcomesChecked!==true||x.voidChecked!==true)throw new Error('Review all settlement conditions first');
  if(x.aHash!==a.hash||x.bHash!==b.hash)throw new Error('Rules changed while you reviewed. Load the pair again.');
  if([a,b].some(m=>/sport|unknown/i.test(m.category)||!m.rules.trim()))throw new Error('Sports, unknown categories, or missing rules are excluded');
  const s=await loadState(uid);if(s.pairs.length>=8&&!s.pairs.some(p=>p.id===pair.id))throw new Error('Watchlist is limited to 8 carefully reviewed pairs');
  const reviewed={...pair,reviewed:true,reviewedAt:Date.now(),notes:String(x.notes||'').slice(0,1000)};s.pairs=[reviewed,...s.pairs.filter(p=>p.id!==pair.id)];log(s,'review','Settlement mapping approved for paper research');return reply({pair:reviewed,state:await saveState(uid,s,s.version)});
 }
 return reply({pair});
 }catch(e){return error(e);}}
