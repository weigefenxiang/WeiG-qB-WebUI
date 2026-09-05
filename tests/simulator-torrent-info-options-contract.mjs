import assert from 'node:assert/strict';
import {createWorld} from '../simulator/core/engine.js';
import {listTorrentsSnapshot} from '../simulator/core/runtime-view.js';
import {torrentInfoOptionSupport} from '../simulator/core/torrent-info-options.js';

const now=1700000000000;
function world(version,seed){
  return createWorld({profile:{qbVersion:version,webApiVersion:version.startsWith('5.2')?'2.15.1':version.startsWith('5.1')?'2.11.4':'2.10.4'},count:8,seed,now});
}

assert.deepEqual(torrentInfoOptionSupport({qbVersion:'4.6.7'}),{includeTrackers:false,includeFiles:false});
assert.deepEqual(torrentInfoOptionSupport({qbVersion:'5.0.5'}),{includeTrackers:false,includeFiles:false});
assert.deepEqual(torrentInfoOptionSupport({qbVersion:'5.1.0'}),{includeTrackers:true,includeFiles:false});
assert.deepEqual(torrentInfoOptionSupport({qbVersion:'5.2.0'}),{includeTrackers:true,includeFiles:true});

{
  const qB50=world('5.0.5','info-options-50');
  const row=listTorrentsSnapshot(qB50,{limit:1,includeTrackers:'true',includeFiles:'true'},now)[0];
  assert.equal(Object.hasOwn(row,'trackers'),false,'qB 5.0.x must ignore later includeTrackers query option');
  assert.equal(Object.hasOwn(row,'files'),false,'qB 5.0.x must ignore later includeFiles query option');
}

{
  const qB51=world('5.1.0','info-options-51');
  const row=listTorrentsSnapshot(qB51,{limit:1,includeTrackers:'true',includeFiles:'true'},now)[0];
  assert.ok(Array.isArray(row.trackers),'qB 5.1.0+ includeTrackers must inline the tracker list');
  assert.equal(Object.hasOwn(row,'files'),false,'qB 5.1.x must not expose the later includeFiles option');
  const off=listTorrentsSnapshot(qB51,{limit:1,includeTrackers:'false'},now)[0];
  assert.equal(Object.hasOwn(off,'trackers'),false,'includeTrackers=false must remain zero-cost projection');
}

{
  const qB52=world('5.2.3','info-options-52');
  const withMeta=qB52.torrents.find(t=>t.has_metadata!==false)||qB52.torrents[0];
  withMeta.has_metadata=true;
  const row=listTorrentsSnapshot(qB52,{hashes:withMeta.hash,includeTrackers:'true',includeFiles:'true'},now)[0];
  assert.ok(Array.isArray(row.trackers),'qB 5.2.x includeTrackers must remain available');
  assert.ok(Array.isArray(row.files),'qB 5.2.x includeFiles must inline files for torrents with metadata');
  assert.ok(row.files.length>0,'metadata-backed torrent should have at least one virtual file projection');

  const pending=qB52.torrents.find(t=>t.hash!==withMeta.hash)||qB52.torrents[1];
  pending.has_metadata=false;
  const pendingRow=listTorrentsSnapshot(qB52,{hashes:pending.hash,includeFiles:'true'},now)[0];
  assert.equal(Object.hasOwn(pendingRow,'files'),false,'upstream only inserts includeFiles output when torrent metadata is available');
}

{
  const qB52=world('5.2.3','info-options-window');
  const rows=listTorrentsSnapshot(qB52,{includeTrackers:'true',includeFiles:'true',limit:2,offset:1},now);
  assert.equal(rows.length,2);
  assert.ok(rows.every(row=>Array.isArray(row.trackers)),'expensive optional projections should apply only to returned rows when Core pagination is used');
  assert.ok(rows.every(row=>Object.hasOwn(row,'files')||qB52.torrents.find(t=>t.hash===row.hash)?.has_metadata===false));
}

console.log('Virtual qB torrents/info option contract passed: includeTrackers begins at qB 5.1, includeFiles at qB 5.2, false/older generations stay clean, and metadata gating matches upstream insertion behavior.');
