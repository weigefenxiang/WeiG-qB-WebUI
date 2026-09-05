import assert from 'node:assert/strict';
import {createWorld,deleteTorrents,renameTorrent} from '../simulator/core/engine.js';
import {
  clearRuntimeSnapshot,listTorrentsSnapshot,mainDataSnapshot,runtimeSnapshotStats,transferSnapshot
} from '../simulator/core/runtime-view.js';

const baseNow=1700000000000;
const profile={qbVersion:'5.2.3',webApiVersion:'2.15.1'};
function make(seed){return createWorld({profile,count:5000,seed,now:baseNow});}

{
  const world=make('aggregate-cache');
  const now=baseNow+1100;
  const transfer=transferSnapshot(world,now);
  const main=mainDataSnapshot(world,0,now+100);
  const stats=runtimeSnapshotStats(world);
  assert.equal(main.server_state.dl_info_speed,transfer.dl_info_speed);
  assert.equal(stats.aggregateRuns,1,'one coherent runtime snapshot must sum 5000 torrent rates only once');
  assert.ok(stats.aggregateHits>=1,'sync/maindata must reuse the transfer aggregate computed by transfer/info in the same snapshot');
}

{
  const world=make('membership-index');
  const full=mainDataSnapshot(world,0,baseNow+1000);
  const rid=full.rid;
  const target=world.torrents[200].hash;
  renameTorrent(world,target,'Indexed rename');
  const delta=mainDataSnapshot(world,rid,baseNow+1100);
  assert.equal(delta.torrents[target].name,'Indexed rename');
  let stats=runtimeSnapshotStats(world);
  assert.equal(stats.indexBuilds,1,'first delta lookup should build one reusable hash index');

  const rid2=delta.rid;
  const target2=world.torrents[400].hash;
  renameTorrent(world,target2,'Indexed rename 2');
  const delta2=mainDataSnapshot(world,rid2,baseNow+1200);
  assert.equal(delta2.torrents[target2].name,'Indexed rename 2');
  stats=runtimeSnapshotStats(world);
  assert.equal(stats.indexBuilds,1,'non-membership torrent changes must not rebuild the 5000-row membership index');
  assert.ok(stats.indexHits>=1,'subsequent delta lookup must hit the membership index');
}

{
  const world=make('hash-selection');
  const hashes=[world.torrents[12].hash,world.torrents[2411].hash,world.torrents[4990].hash];
  const rows=listTorrentsSnapshot(world,{hashes:hashes.slice().reverse().join('|')},baseNow+1000);
  assert.deepEqual(rows.map(row=>row.hash),hashes,'hash-filtered torrents/info must preserve qB session order rather than caller hash order');
  const stats=runtimeSnapshotStats(world);
  assert.equal(stats.hashSelections,1);
  assert.equal(stats.projectedRows,3,'three requested hashes should project three rows instead of scanning/projecting all 5000');
}

{
  const world=make('membership-rebuild');
  const keep=world.torrents[10].hash;
  listTorrentsSnapshot(world,{hashes:keep},baseNow+1000);
  const doomed=world.torrents[20].hash;
  deleteTorrents(world,doomed,baseNow+1100);
  listTorrentsSnapshot(world,{hashes:keep},baseNow+1200);
  const stats=runtimeSnapshotStats(world);
  assert.equal(stats.indexBuilds,2,'membership replacement after delete must invalidate and rebuild the hash index');
}

{
  const world=make('clear-index');
  const hash=world.torrents[0].hash;
  listTorrentsSnapshot(world,{hashes:hash},baseNow+1000);
  clearRuntimeSnapshot(world);
  listTorrentsSnapshot(world,{hashes:hash},baseNow+1100);
  const stats=runtimeSnapshotStats(world);
  assert.equal(stats.indexBuilds,1,'explicit runtime cache clear must drop membership and aggregate caches together');
}

console.log('Virtual qB runtime index contract passed: 5000-row membership maps and transfer aggregates are reused across coherent reads, hash queries select directly, and membership changes invalidate safely.');
