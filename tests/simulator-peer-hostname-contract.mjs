import assert from 'node:assert/strict';
import {authenticate,createWorld} from '../simulator/core/engine.js';
import {handleApi} from '../simulator/protocol/router.js';

function makeWorld(qbVersion,webApiVersion){
  const world=createWorld({profile:{qbVersion,webApiVersion,stable:true},count:32,seed:`peer-host-${qbVersion}`,now:1700000000000});
  authenticate(world,'demo','demo');
  return world;
}
async function peers(world){
  const target=world.torrents.find(item=>item.connectedPeers>0)||world.torrents[0];
  target.connectedPeers=Math.max(1,target.connectedPeers||1);
  const response=await handleApi(world,new Request(`https://example.invalid/api/v2/sync/torrentPeers?hash=${target.hash}`));
  assert.equal(response.status,200);
  return (await response.json()).peers;
}

{
  const legacy=makeWorld('5.2.0','2.15.0');
  const rows=Object.values(await peers(legacy));
  assert.ok(rows.length>0);
  assert.ok(rows.every(row=>!Object.prototype.hasOwnProperty.call(row,'host_name')),'pre-2.15.1 peers must not expose host_name');
}

{
  const modern=makeWorld('5.2.3','2.15.1');
  let rows=Object.values(await peers(modern));
  assert.ok(rows.length>0);
  assert.ok(rows.every(row=>Object.prototype.hasOwnProperty.call(row,'host_name')&&row.host_name===''),'2.15.1 non-I2P peers must expose empty host_name when resolution is disabled');
  modern.preferences.resolve_peer_host_names=true;
  const first=Object.values(await peers(modern));
  const second=Object.values(await peers(modern));
  assert.ok(first.every(row=>typeof row.host_name==='string'&&row.host_name.endsWith('.peer.virtual.invalid')),'enabled virtual host-name resolution must project deterministic hostnames');
  assert.deepEqual(first.map(row=>row.host_name),second.map(row=>row.host_name),'resolved virtual hostnames must remain stable across peer polls');
}

console.log('Virtual qB peer hostname contract passed: sync/torrentPeers introduces host_name exactly at WebAPI 2.15.1, preserves empty-disabled semantics, and resolves stable virtual names when enabled.');
