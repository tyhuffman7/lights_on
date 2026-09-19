import {filterPriorPolyHistory} from './prior-poly-history.ts';
import {classifyKalshiCash} from './kalshi-cash.ts';
import {assessKalshiFunding} from './kalshi-funding.ts';
import {classifyPolyCashActivities,auditCashConservation} from './cash-conservation.ts';
import {normalizeCashObservation} from './cash-observation.ts';
import {reconcileKalshiSettlement,assessPolySettlement} from './settlement-evidence.ts';
import {encodePilotBuy} from './order-wire.ts';
import {existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {PilotLedger,type IntentState} from './ledger.ts';
import {FillJournal} from './fill-journal.ts';
import {reconcileOrderEvidence,reservationDebit} from './order-evidence.ts';
import type {pilotPreflight} from './preflight.ts';
import type {ExpectedFill} from './fill-evidence.ts';
import type {Venue} from '../arb/types.ts';
type Plan=ReturnType<typeof pilotPreflight>;
type Owned={intent_id:string;pair_id:string;venue:Venue;expected:string;order_id:string|null;snapshot:string|null};
// One database/transaction boundary for bot ownership, fills, exact accounting
// and reservation state. No credentials or submission transport are exposed.
export class PilotExecutionLedger {
 readonly ledger:PilotLedger;readonly journal:FillJournal;
 constructor(path:string,scope:'synthetic'|'live'){
  if(path!==':memory:'&&existsSync(path)){
   const check=new DatabaseSync(path,{readOnly:true});try{
    const allowed=new Set(['pilot_intents','pilot_control','pilot_execution_scope','pilot_execution_pairs','pilot_execution_orders','pilot_execution_receipts','pilot_execution_dispatches','pilot_cash_observations','pilot_cash_baselines','pilot_cash_audits','pilot_settlement_expectations','pilot_cash_failures','pilot_funding_observations','pilot_activity_observations','owned_fill_orders','owned_fill_evidence']);
    const tables=check.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {name:string}[];
    if(tables.some(t=>!allowed.has(t.name)))throw Error('Refusing unrelated database');
   }finally{check.close();}
  }
  this.ledger=new PilotLedger(path);
  const db=this.ledger.db;
  try{
   db.exec(`CREATE TABLE IF NOT EXISTS pilot_execution_scope(id INTEGER PRIMARY KEY CHECK(id=1),scope TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_execution_pairs(id TEXT PRIMARY KEY,plan TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_execution_orders(intent_id TEXT PRIMARY KEY,pair_id TEXT NOT NULL,venue TEXT NOT NULL,expected TEXT NOT NULL,order_id TEXT,snapshot TEXT,UNIQUE(venue,order_id));
    CREATE TABLE IF NOT EXISTS pilot_activity_observations(id TEXT PRIMARY KEY,source TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_funding_observations(id TEXT PRIMARY KEY,source TEXT NOT NULL,assessment TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_cash_failures(id INTEGER PRIMARY KEY,input TEXT NOT NULL,error TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_settlement_expectations(intent_id TEXT PRIMARY KEY,source TEXT NOT NULL,assessment TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_cash_audits(id TEXT PRIMARY KEY,input TEXT NOT NULL,result TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_cash_observations(id TEXT PRIMARY KEY,venue TEXT NOT NULL,body TEXT NOT NULL,raw TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_cash_baselines(pair_id TEXT NOT NULL,venue TEXT NOT NULL,observation_id TEXT NOT NULL,PRIMARY KEY(pair_id,venue));
    CREATE TABLE IF NOT EXISTS pilot_execution_dispatches(intent_id TEXT PRIMARY KEY,request TEXT NOT NULL,staged_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_execution_receipts(id INTEGER PRIMARY KEY,intent_id TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,error TEXT);`);
   this.atomic(()=>{
    if(!['synthetic','live'].includes(scope))throw Error('Invalid execution scope');
    const prior=db.prepare('SELECT scope FROM pilot_execution_scope WHERE id=1').get() as {scope:string}|undefined;
    if(prior&&prior.scope!==scope)throw Error('Cannot mix synthetic and live execution ledgers');
    if(!prior){if(db.prepare('SELECT id FROM pilot_intents LIMIT 1').get())throw Error('Existing intents require explicit ownership migration');db.prepare('INSERT INTO pilot_execution_scope VALUES(1,?)').run(scope);}
   });
   this.journal=new FillJournal(db);
   if(db.prepare("SELECT id FROM pilot_execution_receipts WHERE status='PENDING' LIMIT 1").get())this.ledger.halt('UNAPPLIED_EXECUTION_RECEIPTS');
  }catch(e){this.ledger.close();throw e;}
 }
 private atomic<T>(work:()=>T):T{const db=this.ledger.db;db.exec('BEGIN IMMEDIATE');try{const result=work();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 private owned(id:string){const r=this.ledger.db.prepare('SELECT * FROM pilot_execution_orders WHERE intent_id=?').get(id) as Owned|undefined;if(!r)throw Error('Unknown bot intent');return r;}
 expected(id:string):ExpectedFill&{quantity:number}{const r=this.owned(id);if(!r.order_id)throw Error('Submission outcome unknown; order identity not established');return {...JSON.parse(r.expected),orderId:r.order_id};}
 preparePair(id:string,plan:Plan,now=Date.now()){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||plan.mode!=='PILOT_PREFLIGHT_ONLY'||!plan.eligible||plan.reasons.length||!Number.isSafeInteger(now)||now<plan.createdAt||now>=plan.expiresAt||plan.expiresAt-plan.createdAt>250||plan.quantity!==1||plan.legs.length!==2||new Set(plan.legs.map(l=>l.venue)).size!==2)throw Error('Fresh eligible one-contract preflight required');
  return this.atomic(()=>{
   const db=this.ledger.db,body=JSON.stringify(plan),old=db.prepare('SELECT plan FROM pilot_execution_pairs WHERE id=?').get(id) as {plan:string}|undefined;
   if(old&&old.plan!==body)throw Error('Immutable pair plan conflict');
   const budgets={} as Record<Venue,number>;
   for(const l of plan.legs){if(!['kalshi','poly'].includes(l.venue)||!l.marketId||!['yes','no'].includes(l.side)||l.quantity!==1)throw Error('Invalid plan identity');budgets[l.venue]=l.modeledDebit;}
   this.ledger.reservePair(id,budgets);
   if(!old){db.prepare('INSERT INTO pilot_execution_pairs VALUES(?,?)').run(id,body);for(const l of plan.legs)db.prepare('INSERT INTO pilot_execution_orders(intent_id,pair_id,venue,expected) VALUES(?,?,?,?)').run(id+':'+l.venue,id,l.venue,JSON.stringify({marketId:l.marketId,side:l.side,action:'buy',quantity:l.quantity,limitPrice:l.limitPrice}));}
   return this.pair(id);
  });
 }
 recordCashObservation(id:string,venue:Venue,raw:unknown,timing:Parameters<typeof normalizeCashObservation>[2],credentialScope:string){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Invalid cash observation id');
  const observation=normalizeCashObservation(venue,raw,timing,credentialScope),body=JSON.stringify(observation),source=JSON.stringify(raw);
  this.atomic(()=>{const db=this.ledger.db,old=db.prepare('SELECT body,raw FROM pilot_cash_observations WHERE id=?').get(id) as {body:string;raw:string}|undefined;
   if(old){if(old.body!==body||old.raw!==source)throw Error('Cash observation conflict');return;}
   db.prepare('INSERT INTO pilot_cash_observations VALUES(?,?,?,?)').run(id,venue,body,source);
  });return observation;
 }
 private persistCashFailure(input:unknown,error:unknown){
  this.atomic(()=>{this.ledger.halt('CASH_EVIDENCE_REQUIRES_REVIEW');this.ledger.db.prepare('INSERT INTO pilot_cash_failures(input,error) VALUES(?,?)').run(JSON.stringify(input),error instanceof Error?error.message:String(error));});
 }
 recordKalshiFundingObservation(id:string,history:{deposits:unknown[];withdrawals:unknown[];subaccountTransfers:unknown[];intraAccountTransfers:unknown[]},observedAt:number,credentialScope:string){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!/^[a-f0-9]{64}$/.test(credentialScope)||!history||![history.deposits,history.withdrawals,history.subaccountTransfers,history.intraAccountTransfers].every(Array.isArray))throw Error('Complete funding observation required');
  try{return this.atomic(()=>{const funding=assessKalshiFunding(history.deposits,history.withdrawals,observedAt);
   const unresolved=[...funding.unresolved];if(history.subaccountTransfers.length||history.intraAccountTransfers.length)unresolved.push('TRANSFER_SEMANTICS_REQUIRE_REVIEW');
   const assessment={...funding,unresolved,complete:unresolved.length===0,transferHistoryEmpty:!history.subaccountTransfers.length&&!history.intraAccountTransfers.length};
   const source=JSON.stringify({history,observedAt,credentialScope}),body=JSON.stringify(assessment),db=this.ledger.db;
   const old=db.prepare('SELECT source,assessment FROM pilot_funding_observations WHERE id=?').get(id) as {source:string;assessment:string}|undefined;
   if(old){if(old.source!==source||old.assessment!==body)throw Error('Funding observation conflict');return assessment;}
   db.prepare('INSERT INTO pilot_funding_observations VALUES(?,?,?)').run(id,source,body);return assessment;
  });}catch(e){this.persistCashFailure({kind:'funding',id,history,observedAt,credentialScope},e);throw e;}
 }
 fundingKnownBeforeCash(fundingId:string,cashId:string){
  const db=this.ledger.db,f=db.prepare('SELECT source,assessment FROM pilot_funding_observations WHERE id=?').get(fundingId) as {source:string;assessment:string}|undefined,c=db.prepare('SELECT body FROM pilot_cash_observations WHERE id=?').get(cashId) as {body:string}|undefined;
  if(!f||!c)throw Error('Durable funding and cash observations required');
  const source=JSON.parse(f.source),funding=JSON.parse(f.assessment) as ReturnType<PilotExecutionLedger['recordKalshiFundingObservation']>,cash=JSON.parse(c.body) as ReturnType<typeof normalizeCashObservation>;
  if(cash.venue!=='kalshi'||cash.credentialScope!==source.credentialScope||source.observedAt>=cash.startedAt)throw Error('Funding must be observed before the same-scope cash baseline');
  if(!funding.complete||!funding.transferHistoryEmpty)throw Error('Unresolved funding or transfers');
  return {fundingId,cashId,knownAppliedDepositIds:funding.records.map(r=>r.id),knownAppliedBy:source.observedAt as number,coverage:'FUNDING_ONLY' as const,creditAuthorized:false as const};
 }
 recordPolySettlementExpectation(id:string,record:unknown,published:unknown,accountActivities:unknown[]){
  try{return this.atomic(()=>{
   const assessment=this.assessPolySettlement(id,record,published,accountActivities),source=JSON.stringify({record,published,accountActivities});
   const db=this.ledger.db,old=db.prepare('SELECT source,assessment FROM pilot_settlement_expectations WHERE intent_id=?').get(id) as {source:string;assessment:string}|undefined;
   if(old){if(old.source!==source||old.assessment!==JSON.stringify(assessment))throw Error('Immutable settlement expectation conflict');return assessment;}
   db.prepare('INSERT INTO pilot_settlement_expectations VALUES(?,?,?)').run(id,source,JSON.stringify(assessment));return assessment;
  });}catch(e){this.persistCashFailure({kind:'settlement',id,record,published,accountActivities},e);throw e;}
 }
 recordKalshiSettlementExpectation(id:string,record:unknown,market:unknown,accountFills:unknown[]){
  try{return this.atomic(()=>{const assessment=this.assessKalshiSettlement(id,record,market,accountFills),source=JSON.stringify({record,market,accountFills}),db=this.ledger.db;
   const old=db.prepare('SELECT source,assessment FROM pilot_settlement_expectations WHERE intent_id=?').get(id) as {source:string;assessment:string}|undefined;
   if(old){if(old.source!==source||old.assessment!==JSON.stringify(assessment))throw Error('Immutable settlement expectation conflict');return assessment;}
   db.prepare('INSERT INTO pilot_settlement_expectations VALUES(?,?,?)').run(id,source,JSON.stringify(assessment));return assessment;
  });}catch(e){this.persistCashFailure({kind:'kalshi-settlement',id,record,market,accountFills},e);throw e;}
 }
 recordKalshiCashAudit(id:string,beforeId:string,afterId:string,beforeFundingId:string,afterFundingId:string,fills:unknown[],settlements:unknown[]){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!Array.isArray(fills)||!Array.isArray(settlements))throw Error('Invalid Kalshi cash audit');
  const source={kind:'kalshi-audit',id,beforeId,afterId,beforeFundingId,afterFundingId,fills,settlements};
  try{return this.atomic(()=>{const db=this.ledger.db,input=JSON.stringify(source),old=db.prepare('SELECT input,result FROM pilot_cash_audits WHERE id=?').get(id) as {input:string;result:string}|undefined;
   if(old){if(old.input!==input)throw Error('Cash audit conflict');return JSON.parse(old.result) as ReturnType<typeof auditCashConservation>;}
   this.fundingKnownBeforeCash(beforeFundingId,beforeId);
   const cash=(key:string)=>{const r=db.prepare('SELECT body FROM pilot_cash_observations WHERE id=?').get(key) as {body:string}|undefined;if(!r)throw Error('Missing cash observation');return JSON.parse(r.body) as ReturnType<typeof normalizeCashObservation>;};
   const funding=(key:string)=>{const r=db.prepare('SELECT source,assessment FROM pilot_funding_observations WHERE id=?').get(key) as {source:string;assessment:string}|undefined;if(!r)throw Error('Missing funding observation');return {source:JSON.parse(r.source),assessment:JSON.parse(r.assessment) as ReturnType<typeof assessKalshiFunding>};};
   const before=cash(beforeId),after=cash(afterId),prior=funding(beforeFundingId),current=funding(afterFundingId);
   if(after.venue!=='kalshi'||current.source.credentialScope!==after.credentialScope||current.source.observedAt>=after.startedAt||current.source.observedAt<before.finishedAt)throw Error('Fresh current funding must precede same-scope ending cash');
   const orders=db.prepare("SELECT * FROM pilot_execution_orders WHERE venue='kalshi' AND order_id IS NOT NULL").all() as Owned[],ownedOrders:Record<string,ExpectedFill>=Object.create(null);
   for(const order of orders)ownedOrders[order.order_id!]={...JSON.parse(order.expected),orderId:order.order_id};
   const saved=db.prepare("SELECT s.intent_id,s.source FROM pilot_settlement_expectations s JOIN pilot_execution_orders o ON o.intent_id=s.intent_id WHERE o.venue='kalshi'").all() as {intent_id:string;source:string}[];
   const expectations=saved.map(s=>{const raw=JSON.parse(s.source);return {record:raw.record,assessment:this.assessKalshiSettlement(s.intent_id,raw.record,raw.market,fills)};});
   const classified=classifyKalshiCash({fills,settlements,funding:current.assessment,priorFunding:prior.assessment,subaccountTransfers:current.source.history.subaccountTransfers,intraAccountTransfers:current.source.history.intraAccountTransfers},ownedOrders,expectations);
   const result=auditCashConservation(before,after,classified);db.prepare('INSERT INTO pilot_cash_audits VALUES(?,?,?)').run(id,input,JSON.stringify(result));
   if(result.status==='UNRECONCILED')this.ledger.halt('ACCOUNT_CASH_UNRECONCILED');return result;
  });}catch(e){this.persistCashFailure(source,e);throw e;}
 }
 recordPolyHistoryObservation(id:string,activities:unknown[],observedAt:number,credentialScope:string){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!Array.isArray(activities)||!Number.isSafeInteger(observedAt)||observedAt<=0||!/^[a-f0-9]{64}$/.test(credentialScope))throw Error('Invalid prior history observation');
  const source=JSON.stringify({activities,observedAt,credentialScope});
  this.atomic(()=>{const db=this.ledger.db,old=db.prepare('SELECT source FROM pilot_activity_observations WHERE id=?').get(id) as {source:string}|undefined;if(old){if(old.source!==source)throw Error('Prior history observation conflict');return;}db.prepare('INSERT INTO pilot_activity_observations VALUES(?,?)').run(id,source);});
 }
 recordPolyCashAudit(id:string,beforeId:string,afterId:string,activities:unknown[],priorHistoryId?:string){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Invalid cash audit id');
  try{return this.atomic(()=>{const db=this.ledger.db,input=JSON.stringify({beforeId,afterId,activities,priorHistoryId});
   const prior=db.prepare('SELECT input,result FROM pilot_cash_audits WHERE id=?').get(id) as {input:string;result:string}|undefined;
   if(prior){if(prior.input!==input)throw Error('Cash audit conflict');return JSON.parse(prior.result) as ReturnType<typeof auditCashConservation>;}
   const load=(key:string)=>{const row=db.prepare('SELECT body FROM pilot_cash_observations WHERE id=?').get(key) as {body:string}|undefined;if(!row)throw Error('Missing durable cash observation');return JSON.parse(row.body) as ReturnType<typeof normalizeCashObservation>;};
   const orders=db.prepare("SELECT * FROM pilot_execution_orders WHERE venue='poly' AND order_id IS NOT NULL").all() as Owned[];
   const ownedOrders:Record<string,ExpectedFill>=Object.create(null);
   for(const order of orders)ownedOrders[order.order_id!]={...JSON.parse(order.expected),orderId:order.order_id};
   const saved=db.prepare("SELECT s.intent_id,s.source FROM pilot_settlement_expectations s JOIN pilot_execution_orders o ON o.intent_id=s.intent_id WHERE o.venue='poly'").all() as {intent_id:string;source:string}[];
   const settlements=saved.map(s=>{const source=JSON.parse(s.source);return {record:source.record,assessment:this.assessPolySettlement(s.intent_id,source.record,source.published,activities.filter((a:any)=>a?.type==='ACTIVITY_TYPE_TRADE'))};});
   const before=load(beforeId);let intervalActivities=activities,priorIssues:string[]=[];
   if(priorHistoryId){const row=db.prepare('SELECT source FROM pilot_activity_observations WHERE id=?').get(priorHistoryId) as {source:string}|undefined;if(!row)throw Error('Missing prior history observation');const prior=JSON.parse(row.source);if(before.venue!=='poly'||before.credentialScope!==prior.credentialScope)throw Error('Prior history credential scope mismatch');const filtered=filterPriorPolyHistory(activities,prior.activities,prior.observedAt,before.startedAt);intervalActivities=filtered.activities;priorIssues=filtered.issues;}
   const classified=classifyPolyCashActivities(intervalActivities,ownedOrders,settlements);classified.unresolved.push(...priorIssues);classified.complete=classified.unresolved.length===0;
   const result=auditCashConservation(before,load(afterId),classified);
   db.prepare('INSERT INTO pilot_cash_audits VALUES(?,?,?)').run(id,input,JSON.stringify(result));
   if(result.status==='UNRECONCILED')this.ledger.halt('ACCOUNT_CASH_UNRECONCILED');
   return result;
  });}catch(e){this.persistCashFailure({kind:'audit',id,beforeId,afterId,activities,priorHistoryId},e);throw e;}
 }
 linkPairCashBaselines(id:string,ids:Record<Venue,string>){
  this.atomic(()=>{const db=this.ledger.db,row=db.prepare('SELECT plan FROM pilot_execution_pairs WHERE id=?').get(id) as {plan:string}|undefined;
   if(!row)throw Error('Unknown pair');const plan:Plan=JSON.parse(row.plan);
   if(this.pair(id).legs.some(l=>l.state!=='RESERVED'))throw Error('Cannot backfill a submitted baseline');
   for(const venue of ['kalshi','poly'] as const){
    const saved=db.prepare('SELECT venue,body FROM pilot_cash_observations WHERE id=?').get(ids[venue]) as {venue:Venue;body:string}|undefined;
    if(!saved||saved.venue!==venue)throw Error('Missing venue cash baseline');
    const observation=JSON.parse(saved.body) as ReturnType<typeof normalizeCashObservation>;
    if(observation.finishedAt>plan.createdAt||plan.createdAt-observation.startedAt>5000)throw Error('Baseline must precede the fresh plan');
    const old=db.prepare('SELECT observation_id FROM pilot_cash_baselines WHERE pair_id=? AND venue=?').get(id,venue) as {observation_id:string}|undefined;
    if(old){if(old.observation_id!==ids[venue])throw Error('Immutable cash baseline conflict');}
    else db.prepare('INSERT INTO pilot_cash_baselines VALUES(?,?,?)').run(id,venue,ids[venue]);
   }
  });
 }
 // Durable outbound journal only. Both legs become ambiguous atomically BEFORE
 // any future sender could consume the returned requests. No sender is implemented.
 stagePairDispatch(id:string,metadata:Record<Venue,Parameters<typeof encodePilotBuy>[1]>,now=Date.now()){
  return this.atomic(()=>{
   const db=this.ledger.db,row=db.prepare('SELECT plan FROM pilot_execution_pairs WHERE id=?').get(id) as {plan:string}|undefined;
   if(!row)throw Error('Unknown pair');
   const p:Plan=JSON.parse(row.plan);
   if(!Number.isSafeInteger(now)||now<p.createdAt||now>=p.expiresAt)throw Error('Expired submission plan');
   if((db.prepare('SELECT halted FROM pilot_control WHERE id=1').get() as {halted:number}).halted)throw Error('Pilot halted');
   if((db.prepare('SELECT count(*) n FROM pilot_cash_baselines WHERE pair_id=?').get(id) as {n:number}).n!==2)throw Error('Two pre-entry cash baselines required');
   for(const baseline of db.prepare('SELECT o.body FROM pilot_cash_baselines b JOIN pilot_cash_observations o ON o.id=b.observation_id WHERE b.pair_id=?').all(id) as {body:string}[]){if(now-JSON.parse(baseline.body).startedAt>5000)throw Error('Stale dispatch cash baseline');}
   // Validate both wires before changing either intent. Metadata freshness must
   // still be checked by a future sender; serialization alone is not validation.
   const requests=p.legs.map(l=>({intentId:id+':'+l.venue,wire:encodePilotBuy(l,metadata[l.venue],id+':'+l.venue)}));
   for(const request of requests){
    const owned=this.owned(request.intentId);
    if(owned.order_id)throw Error('Order already bound');
    this.ledger.markSubmissionUnknown(request.intentId);
    db.prepare('INSERT INTO pilot_execution_dispatches VALUES(?,?,?)').run(request.intentId,JSON.stringify(request.wire),now);
   }
   return {requests,stagedAt:now,expiresAt:p.expiresAt,liveSubmissionEnabled:false as const};
  });
 }
 stagedDispatch(id:string){
  this.owned(id);const row=this.ledger.db.prepare('SELECT request,staged_at FROM pilot_execution_dispatches WHERE intent_id=?').get(id) as {request:string;staged_at:number}|undefined;
  return row?{wire:JSON.parse(row.request),stagedAt:row.staged_at,automaticRetryAllowed:false as const}:null;
 }
 recovery(id:string){
  const pair=this.pair(id);
  const unknown=pair.legs.filter(l=>l.state==='SUBMISSION_UNKNOWN'&&!l.orderId).map(l=>l.intentId);
  const open=pair.legs.filter(l=>l.orderId&&!l.terminal).map(l=>l.intentId);
  // An unresolved order may still fill: never automatically hedge or liquidate
  // against a zero inferred from the last accepted snapshot.
  const action=pair.unappliedReceipts?'REVIEW_UNAPPLIED_EVIDENCE':unknown.length?'RESOLVE_SUBMISSION_IDENTITY':open.length?'RECONCILE_OPEN_ORDERS':pair.status==='UNMATCHED'?'PLAN_EXPOSURE_RECOVERY':pair.status==='PAIRED_INVENTORY'?'AWAIT_SETTLEMENT_OR_REVIEW_EXIT':pair.status==='NO_FILL'?'NO_INVENTORY': 'NOT_SUBMITTED';
  const excess=pair.legs.filter(l=>l.filled>pair.matchedQuantity).map(l=>({intentId:l.intentId,venue:l.venue,quantity:(Math.round(l.filled*10000)-Math.round(pair.matchedQuantity*10000))/10000}));
  return {action,unknownIntents:unknown,openIntents:open,acceptedExcessInventory:excess,inventoryMayIncrease:!!unknown.length||!!open.length||!!pair.unappliedReceipts,halted:pair.halted,automaticRetryAllowed:false as const,automaticRecoveryAllowed:false as const,liveSubmissionEnabled:false as const};
 }
 beginSubmission(id:string,now=Date.now()){
  this.atomic(()=>{const r=this.owned(id),db=this.ledger.db;
   if((db.prepare('SELECT halted FROM pilot_control').get() as {halted:number}).halted)throw Error('Pilot halted');
   const row=db.prepare('SELECT plan FROM pilot_execution_pairs WHERE id=?').get(r.pair_id) as {plan:string};const p:Plan=JSON.parse(row.plan);
   if(!Number.isSafeInteger(now)||now<p.createdAt||now>=p.expiresAt)throw Error('Expired submission plan');
   this.ledger.markSubmissionUnknown(id);
  });
 }
 // Only a response correlated with this bot submission may bind the venue id.
 // Never call this with an account-wide trade or a guessed order match.
 bindSubmissionResponse(id:string,orderId:string){
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(orderId))throw Error('Invalid venue order identity');
  this.atomic(()=>{const r=this.owned(id),intent=this.ledger.get(id);
   if(r.order_id){if(r.order_id!==orderId)throw Error('Order binding conflict');return;}
   if(intent.state!=='SUBMISSION_UNKNOWN')throw Error('No owned submission awaiting a response');
   this.journal.register(r.venue,{...JSON.parse(r.expected),orderId});
   this.ledger.db.prepare('UPDATE pilot_execution_orders SET order_id=? WHERE intent_id=?').run(orderId,id);
  });
 }
 reconcile(id:string,rawOrder:unknown,rawFills:unknown[]){
  const owned=this.owned(id),expected=this.expected(id),db=this.ledger.db;
  if(!Array.isArray(rawFills))throw Error('Individual fill evidence required');
  // Preserve even rejected/unapplied evidence across process death. No headers or
  // credentials belong in this inbox. Restart never resubmits an unknown order.
  const receipt=db.prepare("INSERT INTO pilot_execution_receipts(intent_id,body,status) VALUES(?,?,'PENDING')").run(id,JSON.stringify({order:rawOrder,fills:rawFills})).lastInsertRowid;
  try{return this.atomic(()=>{
   const current=this.owned(id),prior=current.snapshot?JSON.parse(current.snapshot) as ReturnType<typeof reconcileOrderEvidence>:null;
   let inserted=0;for(const raw of rawFills)if(this.journal.record(owned.venue,expected.orderId,raw).inserted)inserted++;
   const source=owned.venue==='kalshi'?(rawOrder as any)?.last_update_time:(rawOrder as any)?.lastTransactTime;
   const sourceAt=typeof source==='string'?Date.parse(source):NaN;
   if(prior&&Number.isFinite(sourceAt)&&sourceAt<Date.parse(prior.sourceUpdatedAt)){
    if(inserted)throw Error('Stale snapshot introduced unseen fill evidence');
    db.prepare("UPDATE pilot_execution_receipts SET status='STALE' WHERE id=?").run(receipt);return {applied:false,reason:'STALE'};
   }
   const fills=this.journal.evidence(owned.venue,expected.orderId);
   const limit=JSON.parse(current.expected).limitPrice;
   if(!Number.isSafeInteger(limit)||fills.some(f=>f.price>limit))throw Error('Execution price exceeded immutable limit');
   const evidence=reconcileOrderEvidence(owned.venue,rawOrder,expected,fills);
   evidence.sourceUpdatedAt=new Date(evidence.sourceUpdatedAt).toISOString();
   if(prior&&sourceAt===Date.parse(prior.sourceUpdatedAt)){
    if(JSON.stringify(prior)!==JSON.stringify(evidence))throw Error('Conflicting same-time order evidence');
    db.prepare("UPDATE pilot_execution_receipts SET status='DUPLICATE' WHERE id=?").run(receipt);return {applied:false,reason:'DUPLICATE'};
   }
   const intent=this.ledger.get(id);
   // revision is a LOCAL serialized application sequence, never an invented
   // exchange revision. Source time and immutable fill ids guard source ordering.
   this.ledger.reconcile(id,{revision:intent.revision+1,state:evidence.state as Exclude<IntentState,'RESERVED'|'SUBMISSION_UNKNOWN'>,filled:evidence.filled,debit:reservationDebit(evidence),venueOrderId:expected.orderId});
   db.prepare('UPDATE pilot_execution_orders SET snapshot=? WHERE intent_id=?').run(JSON.stringify(evidence),id);
   db.prepare("UPDATE pilot_execution_receipts SET status='APPLIED' WHERE id=?").run(receipt);
   if(this.pair(owned.pair_id).status==='UNMATCHED')this.ledger.halt('UNMATCHED_FILL_REQUIRES_RECONCILIATION');
   return {applied:true,reason:'APPLIED'};
  });}catch(e){
   this.atomic(()=>{this.ledger.halt('EXECUTION_EVIDENCE_REQUIRES_REVIEW');db.prepare("UPDATE pilot_execution_receipts SET status='FAILED',error=? WHERE id=?").run(e instanceof Error?e.message:String(e),receipt);});throw e;
  }
 }
 assessKalshiSettlement(id:string,record:unknown,market:unknown,accountFills:unknown[]){
  const r=this.owned(id),pair=this.pair(r.pair_id);
  if(r.venue!=='kalshi'||!r.snapshot||pair.unappliedReceipts)throw Error('Reconciled Kalshi evidence required');
  const snapshot=JSON.parse(r.snapshot) as ReturnType<typeof reconcileOrderEvidence>;
  if(!snapshot.terminal||snapshot.filled<=0)throw Error('Terminal owned inventory required');
  const expected=this.expected(id),fills=this.journal.evidence('kalshi',expected.orderId);
  const evidence=reconcileKalshiSettlement({expected,ownedFillIds:fills.map(f=>f.fillId),accountFills,record,market});
  if(evidence.entryDebitMicros!==-snapshot.cashFlowMicros||evidence.feeMicros!==snapshot.feeMicros||evidence.quantityUnits!==Math.round(snapshot.filled*10000))throw Error('Settlement differs from durable entry accounting');
  return evidence;
 }
 assessPolySettlement(id:string,record:unknown,published:unknown,accountActivities:unknown[]){
  const r=this.owned(id),pair=this.pair(r.pair_id);
  if(r.venue!=='poly'||!r.snapshot||pair.unappliedReceipts)throw Error('Reconciled Polymarket evidence required');
  const snapshot=JSON.parse(r.snapshot) as ReturnType<typeof reconcileOrderEvidence>;
  if(!snapshot.terminal||snapshot.filled<=0)throw Error('Terminal owned inventory required');
  const expected=this.expected(id),fills=this.journal.evidence('poly',expected.orderId);
  const evidence=assessPolySettlement({expected,ownedFillIds:fills.map(f=>f.fillId),accountActivities,record,published});
  if(evidence.entryDebitMicros!==-snapshot.cashFlowMicros||evidence.feeMicros!==snapshot.feeMicros||evidence.quantityUnits!==Math.round(snapshot.filled*10000))throw Error('Settlement differs from durable entry accounting');
  return evidence;
 }
 recoverPending(){
  const rows=this.ledger.db.prepare("SELECT id,intent_id,body FROM pilot_execution_receipts WHERE status='PENDING' ORDER BY id").all() as {id:number;intent_id:string;body:string}[];
  for(const row of rows){const raw=JSON.parse(row.body);this.reconcile(row.intent_id,raw.order,raw.fills);this.ledger.db.prepare("UPDATE pilot_execution_receipts SET status='RECOVERED' WHERE id=? AND status='PENDING'").run(row.id);}
  // Recovery repairs accounting, not permission to resume trading. Halt persists.
  return rows.length;
 }
 pair(id:string){
  const rows=this.ledger.db.prepare('SELECT * FROM pilot_execution_orders WHERE pair_id=? ORDER BY venue').all(id) as Owned[];if(rows.length!==2)throw Error('Unknown or incomplete pair');
  const legs=rows.map(r=>{const intent=this.ledger.get(r.intent_id),s=r.snapshot?JSON.parse(r.snapshot) as ReturnType<typeof reconcileOrderEvidence>:null;return {intentId:r.intent_id,venue:r.venue,orderId:r.order_id,state:intent.state as IntentState,filled:s?.filled??0,cashFlowMicros:s?.cashFlowMicros??0,feeMicros:s?.feeMicros??0,reservationDebit:intent.debit,terminal:s?.terminal??false};});
  const terminal=legs.every(l=>l.terminal),unmatched=Math.abs(Math.round(legs[0].filled*10000)-Math.round(legs[1].filled*10000))/10000;
  const outstanding=this.ledger.db.prepare("SELECT count(*) n FROM pilot_execution_receipts WHERE intent_id IN (?,?) AND status IN ('PENDING','FAILED')").get(...rows.map(r=>r.intent_id)) as {n:number};
  const control=this.ledger.db.prepare('SELECT halted,reason FROM pilot_control WHERE id=1').get() as {halted:number;reason:string|null};
  return {id,halted:!!control.halted,haltReason:control.reason,accountingComplete:outstanding.n===0&&legs.every(l=>l.state!=='SUBMISSION_UNKNOWN'),legs,status:outstanding.n?'RECONCILIATION_BLOCKED':!terminal?'AWAITING_ORDER_COMPLETION':unmatched?'UNMATCHED':legs[0].filled?'PAIRED_INVENTORY':'NO_FILL',matchedQuantity:Math.min(...legs.map(l=>l.filled)),unmatchedQuantity:unmatched,cashFlowMicros:legs.reduce((n,l)=>n+l.cashFlowMicros,0),feeMicros:legs.reduce((n,l)=>n+l.feeMicros,0),unappliedReceipts:outstanding.n,realizedProfitMicros:null,liveSubmissionEnabled:false as const};
 }
 close(){this.journal.close();this.ledger.close();}
}
