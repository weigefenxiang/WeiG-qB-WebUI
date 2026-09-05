import assert from 'node:assert/strict';
import {createWorld} from '../simulator/core/engine.js';
import {applyShareLimitPolicies,shareLimitPolicyStats} from '../simulator/core/torrent-content.js';
import {runtimeSnapshotStats,transferSnapshot} from '../simulator/core/runtime-view.js';
import {createWorldCache} from '../simulator/storage/world-cache.js';

const baseNow=1700000000000;
const profile={qbVersion:'5.2.3',webApiVersion:'2.15.1'};
const world=createWorld({profile,count:5000,seed:'low-power-budget',now:baseNow});

for(let step=1;step<=60;step++){
  const now=baseNow+step*500;
  transferSnapshot(world,now);
  applyShareLimitPolicies(world,now);
}

const runtime=runtimeSnapshotStats(world);
const share=shareLimitPolicyStats(world);
assert.ok(runtime.advanceRuns<=15,`30 seconds of 500ms read pressure must stay within the 2-second scheduler budget; got ${runtime.advanceRuns} full advances`);
assert.equal(runtime.aggregateRuns,0,'scheduler-primed totals must keep duplicate aggregate scans at zero under low-power polling');
assert.equal(share.candidateBuilds,1,'idle share-limit maintenance may discover the candidate set only once');
assert.equal(share.candidateCount,0,'default share-limit settings must leave the periodic candidate set empty');
assert.equal(share.torrentsVisited,0,'idle share-limit maintenance must visit zero torrent candidates after discovery');

let clock=1000,saves=0;
const cache=createWorldCache({
  load:async()=>null,
  save:async()=>{saves++;},
  remove:async()=>{},
  now:()=>clock
});
const largeWorld={value:1,torrents:new Array(5000).fill(null)};
await cache.seed('budget',largeWorld,{persist:true});
largeWorld.value=2;clock=31001;await cache.touch('budget',largeWorld,{mutation:false});
assert.equal(saves,1,'5000-Torrent read-only world must stay below the persistence-write budget at 30 seconds');
clock=61001;await cache.touch('budget',largeWorld,{mutation:false});
assert.equal(saves,2,'5000-Torrent read-only world must eventually checkpoint at the 60-second budget');
largeWorld.value=3;clock=61100;await cache.touch('budget',largeWorld,{mutation:true});
assert.equal(saves,3,'low-power persistence policy must never delay explicit mutations');

console.log(`Virtual qB low-power budget passed: ${runtime.advanceRuns} full scheduler advances/30s, ${share.torrentsVisited} idle share-policy candidate visits, and one read-only large-world checkpoint/minute.`);
