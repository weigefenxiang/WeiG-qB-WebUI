import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createWorld,listTorrents,mainData,transferInfo
} from '../simulator/core/engine.js';
import {
  listTorrentsSnapshot,mainDataSnapshot,runtimeSnapshotStats,transferSnapshot
} from '../simulator/core/runtime-view.js';

const baseNow=1700000000000;
const profile={qbVersion:'5.2.3',webApiVersion:'2.15.1'};
function make(seed='runtime-view'){return createWorld({profile,count:5000,seed,now:baseNow});}

{
  const world=make('shared-snapshot');
  const now=baseNow+2500;
  const transfer=transferSnapshot(world,now);
  const main=mainDataSnapshot(world,0,now+100);
  const rows=listTorrentsSnapshot(world,{sort:'added_on',reverse:'true',limit:50,offset:0},now+200);
  const stats=runtimeSnapshotStats(world);
  assert.equal(stats.advanceRuns,1,'transfer/info, sync/maindata and torrents/info within one two-second snapshot must share one world advance');
  assert.equal(rows.length,50);
  assert.equal(Object.keys(main.torrents).length,5000,'full sync snapshot must still expose the full virtual library');
  assert.equal(main.server_state.dl_info_speed,transfer.dl_info_speed,'mainData server_state and transfer/info must read the same world snapshot');
  assert.ok(stats.sortedRows>=5000,'sorted library request must project each candidate once');
}

{
  const world=make('page-projection');
  const now=baseNow+2000;
  const first=listTorrentsSnapshot(world,{limit:50,offset:0},now);
  const stats=runtimeSnapshotStats(world);
  assert.equal(first.length,50);
  assert.equal(stats.projectedRows,50,'unsorted first page must serialize only the requested 50 rows, not all 5000 torrents');
  assert.equal(stats.sortedRows,0,'unsorted page must avoid sort projection work entirely');
}

{
  const world=make('same-bucket-rate-controls');
  world.preferences.alt_dl_limit=32;
  world.preferences.alt_up_limit=16;
  const normal=transferSnapshot(world,baseNow+100);
  assert.ok(normal.dl_info_speed>32*1024,'same-bucket control fixture must begin above alternate cap');
  world.altSpeedMode=true;
  const alternate=transferSnapshot(world,baseNow+200);
  assert.ok(alternate.dl_info_speed<=32*1024,'alternate mode changed inside one snapshot bucket must immediately reschedule torrent rates');
  assert.ok(alternate.up_info_speed<=16*1024,'alternate upload mode must also apply inside the current bucket');
  world.altSpeedMode=false;
  world.globalDownloadLimit=48*1024;
  const limited=transferSnapshot(world,baseNow+300);
  assert.ok(limited.dl_info_speed<=48*1024,'normal global download limit changed inside one bucket must immediately reschedule rates');
  const stats=runtimeSnapshotStats(world);
  assert.equal(stats.advanceRuns,0,'same-bucket control changes must not advance simulation time');
  assert.equal(stats.controlReschedules,3,'initial same-bucket read plus two control changes should require only three zero-elapsed schedules');
}

{
  const legacy=make('semantic-equivalence'),modern=make('semantic-equivalence');
  const now=baseNow+2000;
  const legacyRows=listTorrents(legacy,{sort:'added_on',reverse:'true',limit:200,offset:400,now});
  const snapshotRows=listTorrentsSnapshot(modern,{sort:'added_on',reverse:'true',limit:200,offset:400},now);
  assert.deepEqual(snapshotRows.map(row=>row.hash),legacyRows.map(row=>row.hash),'optimized sorting must preserve qB torrent ordering exactly');
  assert.deepEqual(snapshotRows.map(row=>row.state),legacyRows.map(row=>row.state),'optimized projection must preserve version-correct torrent states');
}

{
  const legacy=make('transfer-equivalence'),modern=make('transfer-equivalence');
  const now=baseNow+2000;
  assert.deepEqual(transferSnapshot(modern,now),transferInfo(legacy,now),'snapshot transfer/info must preserve legacy API values');
}

{
  const legacy=make('main-equivalence'),modern=make('main-equivalence');
  const now=baseNow+2000;
  const a=mainData(legacy,0,now),b=mainDataSnapshot(modern,0,now);
  assert.equal(b.full_update,a.full_update);
  assert.deepEqual(b.server_state,a.server_state,'snapshot mainData server_state must preserve legacy values');
  assert.deepEqual(Object.keys(b.torrents),Object.keys(a.torrents),'snapshot full sync must preserve torrent membership and order');
}

{
  const router=fs.readFileSync(new URL('../simulator/protocol/router.js',import.meta.url),'utf8');
  assert.match(router,/transferSnapshot\(world,now\)/,'router transfer/info must use the shared snapshot path');
  assert.match(router,/mainDataSnapshot\(world,url\.searchParams\.get\('rid'\)\|\|0,now\)/,'router sync/maindata must use the shared snapshot path');
  assert.match(router,/listTorrentsSnapshot\(world,query,now\)/,'router torrents/info must use the shared optimized projection path');
  assert.doesNotMatch(router,/\bmainData\(world,/,'router hot path must not fall back to legacy mainData world advancement');
  assert.doesNotMatch(router,/\btransferInfo\(world/,'router hot path must not fall back to legacy transferInfo world advancement');
}

console.log('Virtual qB runtime-view contract passed: hot reads share two-second advances, same-bucket rate-control changes reschedule without advancing time, pages project minimally, and qB API values remain equivalent.');
