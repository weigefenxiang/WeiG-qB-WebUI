import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const catalogPath=path.resolve(process.argv[2]||'');
assert.ok(catalogPath&&fs.existsSync(catalogPath),'Usage: node tests/full-stable-peer-compat.mjs <qb-releases.json>');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
assert.ok(Array.isArray(catalog)&&catalog.length>0,'frozen Peer matrix requires a non-empty release catalog');
assert.equal(catalog[0].qbVersion,'4.1.0','frozen Peer matrix floor must remain qB 4.1.0');
const PEERS='synccontroller.h:torrentPeersAction';
const BAN='transfercontroller.h:banPeersAction';
let banCount=0,firstBan=null;
for(const profile of catalog){
  assert.equal(profile.stable,true,`${profile.qbVersion}: frozen Peer matrix accepts stable profiles only`);
  assert.notEqual(profile.officialWeiGSupport,false,`${profile.qbVersion}: frozen Peer matrix accepts official supported profiles only`);
  assert.ok(Array.isArray(profile.apiActions),`${profile.qbVersion}: apiActions source facts missing`);
  assert.ok(profile.apiActions.includes(PEERS),`${profile.qbVersion}: Torrent Peers detail endpoint lost exact source action ${PEERS}`);
  if(profile.apiActions.includes(BAN)){
    banCount++;
    if(!firstBan)firstBan=profile.qbVersion;
    const params=profile.apiActionParameters?.[BAN];
    assert.ok(params,`${profile.qbVersion}: source-proven banPeers lacks parameter descriptor`);
    assert.ok(Array.isArray(params.parameters)&&params.parameters.includes('peers'),`${profile.qbVersion}: banPeers source contract lost peers parameter`);
    assert.ok(Array.isArray(params.required)&&params.required.includes('peers'),`${profile.qbVersion}: banPeers source contract must require peers`);
  }
}
assert.ok(banCount>0&&banCount<catalog.length,'Frozen profiles must preserve both pre-banPeers and banPeers-capable eras');
console.log(`Frozen Torrent Peer compatibility passed: ${catalog.length} official stable releases keep source-proven sync/torrentPeers; banPeers is source-proven in ${banCount} releases, first appearing at ${firstBan}.`);
