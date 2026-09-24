// Explicit aggregate allowlist: never copy books, native metadata or account payloads.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const [input,output]=process.argv.slice(2);
const read=name=>JSON.parse(readFileSync(resolve(input,name),'utf8'));
const s=read('summary.json'),f=read('frozen.json'),coverage=read('coverage-private.json');
if(s.phase!=='STOPPED'||s.ordersEnabled!==false||s.candidate!==null)throw Error('Requires stopped no-candidate session; review any candidate separately before publication');
const entries=new Map(f.shards.flat().map(e=>[e.pair.id,e]));
const categories={sports:{routes:0,usableRouteHours:0},nonSports:{routes:0,usableRouteHours:0}};
for(const [id,row] of coverage.rows){const e=entries.get(id);if(!e)throw Error('Unknown observed route');const group=e.pair.a.identity?.sports||e.pair.b.identity?.sports?'sports':'nonSports';categories[group].routes++;categories[group].usableRouteHours+=row.usableMs/3600000;}
const result={version:1,scope:s.scope,ordersEnabled:false,fillClaim:false,liveSubmission:s.liveSubmission,
 startedAt:new Date(s.startedAt).toISOString(),endedAt:new Date(s.endedAt).toISOString(),deadlineAt:new Date(s.deadlineAt).toISOString(),durationSeconds:(s.endedAt-s.startedAt)/1000,stopReason:s.reason,
 universe:s.universe,visitedRoutes:s.visitedRoutes,metadataEligibleRoutes:s.metadataEligibleRoutes,monitorableRoutes:s.monitorableRoutes,usableRouteHours:s.usableRouteHours,categories,
 distinctPositiveAfterFeeEpisodes:s.positiveEpisodes,requestedConfirmations:s.requestedConfirmations,survivingConfirmedPositives:s.confirmedPositives,strongestConfirmedCandidate:null,
 allNonEligibilityPilotPrerequisites:false,prerequisiteExplanation:'No confirmed positive economic candidate; account and event review cannot substitute for profitable confirmed books.',
 diagnosis:'FEES_ERASE_RAW_SPREADS_UNDER_EXISTING_UNKNOWN_PRECISION_BOUND',diagnosticSampleCounts:s.diagnostics,metadataExclusions:s.exclusions,
 feeBoundLimitation:'Kalshi unknown-account cent precision with possible 0.01-contract fragmentation and zero rebate credit consumes at least the paired ordinary payout before entry prices. No actual fee-net opportunity is claimed.',
 coverageLimitations:['60 concurrent routes in 90-second shards; not continuous simultaneous coverage of 2,852 routes','Exact metadata hashes required, including dates; changed administrative dates can exclude economically unchanged routes','Usable time excludes acquisition and invalid/missing book intervals; diagnostic counts are samples, not independent episodes'],
 residualSettlementRisk:'Every original family mismatch retained. No candidate was frozen, so no candidate-specific exception or launch clearance is claimed.',
 reconnects:s.reconnections,sampledPeakRssMiB:s.maxRss/1048576,evidence:{totalBytesWritten:s.storage.totalBytes,retainedMonitoringSegments:s.storage.retained.length,rotatedMonitoringSegments:s.storage.evictedMonitoring.segments,protectedDecisionBytes:s.storage.critical.bytes,protectedDecisionRecords:s.storage.critical.records,protectedDecisionDigest:s.storage.critical.digest,resourceFault:s.storage.fault},
 frozenPolicy:s.policy,sourceManifest:f.manifest,privateSummarySha256:createHash('sha256').update(readFileSync(resolve(input,'summary.json'))).digest('hex')};
mkdirSync(output,{recursive:true});writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({routes:result.monitorableRoutes,routeHours:result.usableRouteHours,positiveEpisodes:result.distinctPositiveAfterFeeEpisodes,ordersEnabled:false}));
