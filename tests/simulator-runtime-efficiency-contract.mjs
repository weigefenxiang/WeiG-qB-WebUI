import assert from 'node:assert/strict';
import {CANONICAL,createWorld} from '../simulator/core/engine.js';
import {
  applyRuntimePolicies,recheckTorrents,setLocation,simulatorRuntimePolicyStats
} from '../simulator/core/torrent-actions.js';

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

console.log(`Virtual qB runtime-efficiency contract passed: idle maintenance scans=${stats.actionStateScans}, heavy scans=${stats.environmentHeavyScans}, visited=${stats.heavyTorrentsVisited} for a 5000-Torrent world.`);
