import assert from 'node:assert/strict';
import {createWorld,deleteTorrents,renameTorrent} from '../simulator/core/engine.js';
import {filesForTorrent,pieceHashes,pieceStates,setShareLimits,setSuperSeeding} from '../simulator/core/torrent-content.js';
import {propertiesForTorrent,trackersForTorrent} from '../simulator/core/torrent-metadata.js';
import {runtimeIndexStats} from '../simulator/core/runtime-index.js';
import {addTrackers,editTracker,reannounceTorrents,removeTrackers,setFilePriority,toggleSequential} from '../simulator/core/torrent-actions.js';
import {
  clearRuntimeSnapshot,listTorrentsSnapshot,mainDataSnapshot,runtimeSnapshotStats,transferSnapshot
} from '../simulator/core/runtime-view.js';
import {setVirtualSpeedLimitsMode} from '../simulator/core/transfer-controls.js';

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
  const world=make('aggregate-speed-mode');
  world.preferences.alt_dl_limit=32;
  world.preferences.alt_up_limit=16;
  const now=baseNow+1100;
  const normal=transferSnapshot(world,now);
  assert.ok(normal.dl_info_speed>32*1024,'fixture must exceed the tiny alternate download cap before switching modes');
  const before=runtimeSnapshotStats(world);
  assert.equal(before.aggregateRuns,1);
  setVirtualSpeedLimitsMode(world,1,now+100);
  const alternate=transferSnapshot(world,now+200);
  const after=runtimeSnapshotStats(world);
  assert.ok(alternate.dl_info_speed<=32*1024,'same-bucket alternate mode must never reuse the normal-mode transfer aggregate');
  assert.ok(alternate.up_info_speed<=16*1024,'same-bucket alternate upload cap must invalidate the aggregate too');
  assert.equal(after.aggregateRuns,2,'speed-limit mode change must rebuild the aggregate even when lastTick and rid stay otherwise reusable');
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

{
  const world=make('detail-index');
  const target=world.torrents.find(t=>t.has_metadata!==false)||world.torrents[0];
  assert.ok(propertiesForTorrent(world,target.hash,baseNow+1000),'torrent properties must resolve from the shared hash index');
  let stats=runtimeIndexStats(world);
  assert.equal(stats.indexedRows,5000,'first detail lookup must build the shared 5000-row membership index exactly once');
  const hitsBefore=stats.indexHits;
  assert.ok(trackersForTorrent(world,target.hash,baseNow+1000));
  assert.ok(Array.isArray(filesForTorrent(world,target.hash)));
  assert.ok(Array.isArray(pieceStates(world,target.hash)));
  assert.ok(Array.isArray(pieceHashes(world,target.hash)));
  const selected=[world.torrents[120].hash,world.torrents[2300].hash,world.torrents[4700].hash].join('|');
  assert.equal(setShareLimits(world,selected,{ratioLimit:2.5}),3);
  assert.equal(setSuperSeeding(world,selected,true),3);
  stats=runtimeIndexStats(world);
  assert.equal(stats.indexedRows,5000,'detail and selected-action reads must keep one shared membership index');
  assert.ok(stats.indexHits>=hitsBefore+6,'detail endpoints and multi-hash actions must reuse the existing index instead of rescanning 5000 torrents');
}

{
  const world=make('torrent-action-index');
  const metadataTarget=world.torrents.find(t=>t.has_metadata!==false)||world.torrents[0];
  const selected=[metadataTarget.hash,world.torrents[2500].hash,world.torrents[4999].hash].join('|');
  assert.equal(reannounceTorrents(world,selected,baseNow+1000),3,'multi-hash action must still affect the selected torrents');
  let stats=runtimeIndexStats(world);
  assert.equal(stats.indexedRows,5000,'first action selection must build one shared membership index');
  const hitsBefore=stats.indexHits;
  assert.equal(toggleSequential(world,selected),3);
  assert.equal(setFilePriority(world,metadataTarget.hash,'0',6),true);
  const added='https://action-index.example/announce';
  assert.equal(addTrackers(world,metadataTarget.hash,added),true);
  const edited='https://action-index.example/edited';
  assert.equal(editTracker(world,metadataTarget.hash,added,edited),true);
  assert.equal(removeTrackers(world,metadataTarget.hash,edited),true);
  stats=runtimeIndexStats(world);
  assert.equal(stats.indexedRows,5000,'non-membership torrent actions must retain the same membership index');
  assert.ok(stats.indexHits>=hitsBefore+5,'selected actions, file priority and tracker mutations must reuse the hash index instead of rescanning 5000 torrents');
}

console.log('Virtual qB runtime index contract passed: 5000-row membership maps and transfer aggregates invalidate on live rate controls, hash queries, details and torrent actions select directly, and membership changes invalidate safely.');
