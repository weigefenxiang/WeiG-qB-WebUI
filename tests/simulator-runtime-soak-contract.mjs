import assert from 'node:assert/strict';
import {createWorld} from '../simulator/core/engine.js';
import {listTorrentsSnapshot,mainDataSnapshot,runtimeSnapshotStats,transferSnapshot} from '../simulator/core/runtime-view.js';

const baseNow=1700000000000;
const world=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:5000,seed:'runtime-soak',now:baseNow});
let main=mainDataSnapshot(world,0,baseNow);
let rid=main.rid;
const hashes=[world.torrents[5].hash,world.torrents[2500].hash,world.torrents[4995].hash].join('|');

for(let step=1;step<=120;step++){
  const now=baseNow+step*250;
  const transfer=transferSnapshot(world,now);
  main=mainDataSnapshot(world,rid,now+10);
  rid=main.rid;
  const selected=listTorrentsSnapshot(world,{hashes,limit:3},now+20);
  const page=listTorrentsSnapshot(world,{limit:50,offset:(step%10)*50},now+30);
  assert.equal(selected.length,3);
  assert.equal(page.length,50);
  assert.equal(main.server_state.dl_info_speed,transfer.dl_info_speed,'same 1-second bucket must preserve transfer/mainData snapshot coherence');
}

const stats=runtimeSnapshotStats(world);
assert.ok(stats.advanceRuns<=30,`250ms read pressure must not schedule more than one world advance per second; got ${stats.advanceRuns}`);
assert.equal(stats.indexBuilds,1,'repeated hash and delta reads over an unchanged 5000-torrent membership must build one hash index');
assert.ok(stats.indexHits>=100,`runtime index should absorb repeated hash lookups; got ${stats.indexHits}`);
assert.equal(stats.index.indexedRows,5000,'runtime index must remain bounded to the current torrent membership');
assert.equal(stats.aggregateRuns,0,`scheduler-primed transfer totals must eliminate duplicate 5000-row aggregate scans; got ${stats.aggregateRuns}`);
assert.ok(stats.aggregateHits>=100,`transfer/mainData paired reads should reuse scheduler-primed aggregate totals; got ${stats.aggregateHits}`);
assert.equal(stats.hashSelections,120,'each targeted hash query must use direct membership selection');
assert.ok(stats.projectedRows<=120*53+100,'soak should project requested rows rather than repeatedly serializing the full 5000-torrent library');
assert.equal(stats.sortedRows,0,'unsorted soak traffic must never pay a full-library sort cost');

console.log(`Virtual qB 5000-torrent logical soak passed: 120 read cycles over 30s used ${stats.advanceRuns} world advances, zero duplicate aggregate scans, one membership index build and ${stats.indexHits} index hits.`);
