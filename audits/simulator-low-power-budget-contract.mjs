import assert from 'node:assert/strict';
import {createWorld} from '../simulator/core/engine.js';
import {
  DEFAULT_READ_PERSIST_MS,DEFAULT_SNAPSHOT_INTERVAL_MS,isLargeWorld,LARGE_READ_PERSIST_MS,
  LARGE_SNAPSHOT_INTERVAL_MS,LARGE_WORLD_THRESHOLD,snapshotIntervalForWorld
} from '../simulator/core/low-power-policy.js';
import {applyShareLimitPolicies,shareLimitPolicyStats} from '../simulator/core/torrent-content.js';
import {runtimeSnapshotStats,transferSnapshot} from '../simulator/core/runtime-view.js';
import {createWorldCache} from '../simulator/storage/world-cache.js';

assert.equal(LARGE_WORLD_THRESHOLD,5000,'low-power large-world boundary must remain aligned with the default demo size');
assert.equal(DEFAULT_SNAPSHOT_INTERVAL_MS,1000);
assert.equal(LARGE_SNAPSHOT_INTERVAL_MS,2000);
assert.equal(DEFAULT_READ_PERSIST_MS,30000);
assert.equal(LARGE_READ_PERSIST_MS,60000);
const belowBoundary={torrents:new Array(LARGE_WORLD_THRESHOLD-1).fill(null)};
const atBoundary={torrents:new Array(LARGE_WORLD_THRESHOLD).fill(null)};
assert.equal(isLargeWorld(belowBoundary),false,'4999-Torrent world must retain the responsive small-world policy');
assert.equal(isLargeWorld(atBoundary),true,'5000-Torrent world must enter the low-power large-world policy');
assert.equal(snapshotIntervalForWorld(belowBoundary),DEFAULT_SNAPSHOT_INTERVAL_MS);
assert.equal(snapshotIntervalForWorld(atBoundary),LARGE_SNAPSHOT_INTERVAL_MS);

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
assert.equal(runtime.snapshotIntervalMs,LARGE_SNAPSHOT_INTERVAL_MS,'5000-Torrent low-power world must select the shared large-world snapshot interval');
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
const largeWorld={value:1,torrents:new Array(LARGE_WORLD_THRESHOLD).fill(null)};
await cache.seed('budget',largeWorld,{persist:true});
largeWorld.value=2;clock=1000+DEFAULT_READ_PERSIST_MS+1;await cache.touch('budget',largeWorld,{mutation:false});
assert.equal(saves,1,'5000-Torrent read-only world must stay below the persistence-write budget at the small-world checkpoint');
clock=1000+LARGE_READ_PERSIST_MS+1;await cache.touch('budget',largeWorld,{mutation:false});
assert.equal(saves,2,'5000-Torrent read-only world must eventually checkpoint at the shared large-world interval');
largeWorld.value=3;clock+=100;await cache.touch('budget',largeWorld,{mutation:true});
assert.equal(saves,3,'low-power persistence policy must never delay explicit mutations');

console.log(`Virtual qB low-power budget passed: boundary=${LARGE_WORLD_THRESHOLD}, ${runtime.advanceRuns} full scheduler advances/30s at ${runtime.snapshotIntervalMs}ms cadence, ${share.torrentsVisited} idle share-policy candidate visits, and one read-only large-world checkpoint/${LARGE_READ_PERSIST_MS/1000}s.`);
