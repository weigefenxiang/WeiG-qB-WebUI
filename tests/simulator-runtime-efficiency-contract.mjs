import assert from 'node:assert/strict';
import {CANONICAL,createWorld} from '../simulator/core/engine.js';
import {
  applyRuntimePolicies,recheckTorrents,setLocation,simulatorRuntimePolicyStats
} from '../simulator/core/torrent-actions.js';
import {applyShareLimitPolicies,setShareLimits,shareLimitPolicyStats} from '../simulator/core/torrent-content.js';

const baseNow=1700000000000;
const world=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:5000,seed:'runtime-efficiency',now:baseNow});

applyRuntimePolicies(world,baseNow);
let stats=simulatorRuntimePolicyStats(world);
assert.equal(stats.actionStateScans,1,'legacy/initial world may perform one discovery scan for pending maintenance actions');
assert.equal(world.nextActionTransitionAt,-1,'idle world must remember that no maintenance deadline exists');

for(let i=1;i<=120;i++)applyRuntimePolicies(world,baseNow+i*250);
stats=simulatorRuntimePolicyStats(world);
assert.equal(stats.actionStateScans,1,'idle 5000-Torrent world must not rescan every torrent on each runtime-policy tick');
assert.ok(stats.environmentHeavyScans<=3,'30 seconds of runtime polling should execute only the expected 15-second heavy environment buckets');
assert.ok(stats.heavyTorrentsVisited<=stats.environmentHeavyScans*512,'each heavy environment bucket must visit at most 512 Torrents');
assert.ok(stats.heavyTorrentsVisited<world.torrents.length,'short idle polling window must avoid even one equivalent full-world swarm/tracker traversal');

const shareWorld=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:5000,seed:'share-runtime-efficiency',now:baseNow});
applyShareLimitPolicies(shareWorld,baseNow);
let shareStats=shareLimitPolicyStats(shareWorld);
assert.equal(shareStats.candidateBuilds,1,'share policy must discover candidates once for a persisted/default world');
assert.equal(shareStats.candidateBuildRows,5000,'initial candidate discovery may inspect the current membership once');
assert.equal(shareStats.candidateCount,0,'default qB share-limit settings must produce no periodic candidates');
assert.equal(shareStats.torrentsVisited,0,'default share-limit maintenance must not revisit 5000 torrents after discovery');
for(let i=1;i<=120;i++)applyShareLimitPolicies(shareWorld,baseNow+i*250);
shareStats=shareLimitPolicyStats(shareWorld);
assert.equal(shareStats.candidateBuilds,1,'unchanged share-limit settings must reuse the empty candidate set');
assert.ok(shareStats.candidateCacheHits>=120,'idle share-limit ticks must hit the candidate cache');
assert.equal(shareStats.torrentsVisited,0,'30 seconds of idle share-limit maintenance must visit zero torrent candidates');

const shareTarget=shareWorld.torrents.find(t=>t.completed);
assert.ok(shareTarget,'share-limit fixture needs a completed torrent');
assert.equal(setShareLimits(shareWorld,shareTarget.hash,{ratioLimit:999}),1);
applyShareLimitPolicies(shareWorld,baseNow+31000);
shareStats=shareLimitPolicyStats(shareWorld);
assert.equal(shareStats.candidateBuilds,2,'changing one torrent share limit must rebuild candidate membership once');
assert.equal(shareStats.candidateCount,1,'one explicit per-torrent limit must create one maintenance candidate');
assert.equal(shareStats.torrentsVisited,1,'share maintenance must visit only the configured candidate, not all 5000 torrents');
for(let i=1;i<=20;i++)applyShareLimitPolicies(shareWorld,baseNow+31000+i*250);
shareStats=shareLimitPolicyStats(shareWorld);
assert.equal(shareStats.candidateBuilds,2,'stable per-torrent share limits must keep the candidate cache reusable');
assert.equal(shareStats.torrentsVisited,21,'twenty additional ticks must add twenty candidate visits, not 100000 full-world visits');

const recheckTarget=world.torrents.find(t=>![CANONICAL.ERROR,CANONICAL.METADATA,CANONICAL.MOVING].includes(t.canonicalState));
assert.ok(recheckTarget);
const beforeRecheckScans=stats.actionStateScans;
assert.equal(recheckTorrents(world,recheckTarget.hash,baseNow+31000),1);
assert.equal(world.nextActionTransitionAt,baseNow+33500,'recheck must register the exact next maintenance deadline');
applyRuntimePolicies(world,baseNow+32000);
assert.equal(simulatorRuntimePolicyStats(world).actionStateScans,beforeRecheckScans,'runtime policy must not scan the world before a known maintenance deadline');
applyRuntimePolicies(world,baseNow+33600);
assert.equal(simulatorRuntimePolicyStats(world).actionStateScans,beforeRecheckScans+1,'runtime policy must scan once when a maintenance deadline becomes due');
assert.notEqual(recheckTarget.canonicalState,CANONICAL.CHECKING,'due recheck must still transition back to its resumable state');

const moveTarget=world.torrents.find(t=>![CANONICAL.ERROR,CANONICAL.METADATA].includes(t.canonicalState));
const beforeMoveScans=simulatorRuntimePolicyStats(world).actionStateScans;
assert.equal(setLocation(world,moveTarget.hash,'/virtual/new-location',baseNow+34000),1);
assert.equal(world.nextActionTransitionAt,baseNow+35800,'move must register its exact next maintenance deadline');
applyRuntimePolicies(world,baseNow+35000);
assert.equal(simulatorRuntimePolicyStats(world).actionStateScans,beforeMoveScans,'move transition must not cause premature full-world scanning');
applyRuntimePolicies(world,baseNow+35900);
assert.equal(simulatorRuntimePolicyStats(world).actionStateScans,beforeMoveScans+1,'move deadline must trigger one maintenance scan');
assert.notEqual(moveTarget.canonicalState,CANONICAL.MOVING,'due move must still finish normally');

console.log(`Virtual qB runtime-efficiency contract passed: idle maintenance scans=${stats.actionStateScans}, heavy scans=${stats.environmentHeavyScans}, environment visited=${stats.heavyTorrentsVisited}; share-limit idle candidates=${shareStats.candidateCount}, candidate visits=${shareStats.torrentsVisited} for a 5000-Torrent world.`);
