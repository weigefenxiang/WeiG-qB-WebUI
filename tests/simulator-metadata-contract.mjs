import assert from 'node:assert/strict';
import {CANONICAL,authenticate,createWorld} from '../simulator/core/engine.js';
import {propertiesForTorrent,trackersForTorrent} from '../simulator/core/torrent-metadata.js';
import {handleApi} from '../simulator/protocol/router.js';
import {upstreamActionRef,upstreamRouteAvailable} from '../simulator/protocol/upstream-gates.js';

function world(qb='5.2.3',api='2.15.1',extra={}){
  return createWorld({profile:{qbVersion:qb,webApiVersion:api,stable:true,...extra},count:32,seed:'metadata-contract',now:1700000000000});
}
function formRequest(path,body){
  return new Request(`https://example.invalid/api/v2/${path}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
}
function getRequest(path){return new Request(`https://example.invalid/api/v2/${path}`);}

{
  assert.equal(upstreamActionRef('torrents/pieceStates'),'torrentscontroller.h:pieceStatesAction');
  assert.equal(upstreamActionRef('app/webapiVersion'),'appcontroller.h:webapiVersionAction');
  assert.equal(upstreamRouteAvailable({apiActions:['torrentscontroller.h:infoAction']},'torrents/info'),true);
  assert.equal(upstreamRouteAvailable({apiActions:['torrentscontroller.h:infoAction']},'torrents/properties'),false);
  assert.equal(upstreamRouteAvailable({apiActions:null},'torrents/properties'),true,'bootstrap profiles must retain version-rule fallback');
}

{
  const w=world('5.2.3','2.15.1',{apiActions:['torrentscontroller.h:infoAction']});authenticate(w,'demo','demo');
  let r=await handleApi(w,getRequest('torrents/info'));assert.equal(r.status,200,'catalog-declared action must remain reachable');
  r=await handleApi(w,getRequest(`torrents/properties?hash=${w.torrents[0].hash}`));assert.equal(r.status,404,'catalog-missing action must be hidden');
  w.profile.apiActions.push('torrentscontroller.h:propertiesAction');
  r=await handleApi(w,getRequest(`torrents/properties?hash=${w.torrents[0].hash}`));assert.equal(r.status,200,'adding exact upstream action must expose endpoint');
}

{
  const w=world();authenticate(w,'demo','demo');
  const t=w.torrents.find(x=>!x.completed);assert.ok(t);
  t.has_metadata=false;t.canonicalState=CANONICAL.METADATA;
  for(const endpoint of ['files','pieceStates','pieceHashes']){
    const r=await handleApi(w,getRequest(`torrents/${endpoint}?hash=${t.hash}`));
    assert.equal(r.status,200,`${endpoint} must succeed without metadata`);
    assert.deepEqual(await r.json(),[],`${endpoint} must be an empty array while metadata is unavailable`);
  }
  const r=await handleApi(w,formRequest('torrents/filePrio',{hash:t.hash,id:'0',priority:'7'}));
  assert.equal(r.status,409,'file priority mutation must conflict until metadata exists');
}

{
  const w=world();const t=w.torrents[0];t.has_metadata=false;t.private=true;
  const p=propertiesForTorrent(w,t.hash,1700000005000);assert.ok(p);
  assert.equal(p.hash,t.hash);assert.equal(p.name,t.name);assert.equal(p.has_metadata,false);
  assert.equal(p.private,null,'modern exact private field must be unknown without metadata');
  assert.equal(p.is_private,false,'deprecated private compatibility field must not invent private metadata');
  assert.equal(p.pieces_num,0);assert.equal(p.piece_size,0);
  assert.equal(p.availability,0,'WebAPI 2.15.1 availability must remain conservative while metadata is unavailable');
}

{
  const before=world('5.2.0','2.15.0'),beforeTorrent=before.torrents[0];
  const oldProperties=propertiesForTorrent(before,beforeTorrent.hash,1700000005000);assert.ok(oldProperties);
  assert.ok(!('availability' in oldProperties),'torrents/properties must not expose availability before WebAPI 2.15.1');
  const current=world('5.2.0','2.15.1'),currentTorrent=current.torrents[0];
  const currentProperties=propertiesForTorrent(current,currentTorrent.hash,1700000005000);assert.ok(currentProperties);
  assert.ok(Number.isFinite(currentProperties.availability)&&currentProperties.availability>=0,'WebAPI 2.15.1 properties availability must be a non-negative distributed-copies number');
}

{
  const w=world('4.1.0','2.0.0');const t=w.torrents[0];
  const p=propertiesForTorrent(w,t.hash,1700000005000);assert.ok(p);
  assert.ok(!('hash' in p)&&!('private' in p)&&!('has_metadata' in p),'qB 4.1.0 properties must retain legacy field surface');
  const trackers=trackersForTorrent(w,t.hash,1700000005000);assert.ok(trackers.length>=1);
  assert.equal(typeof trackers[0].status,'string','qB 4.1.0 tracker status must use legacy string form');
  assert.ok(!String(trackers[0].url).startsWith('** ['),'qB 4.1.0 must not receive later sticky pseudo-trackers');
}

{
  const w=world('5.1.4','2.11.4');const t=w.torrents[0];
  const trackers=trackersForTorrent(w,t.hash,1700000005000);assert.ok(trackers.length>=4);
  assert.deepEqual(trackers.slice(0,3).map(x=>x.url),['** [DHT] **','** [PeX] **','** [LSD] **']);
  const real=trackers[3];assert.equal(typeof real.status,'number');
  for(const key of ['updating','next_announce','min_announce','endpoints'])assert.ok(!(key in real),`qB 5.1 tracker payload must not expose later field ${key}`);
}

{
  const w=world('5.2.0','2.12.9');const t=w.torrents[0];
  const real=trackersForTorrent(w,t.hash,1700000005000)[3];
  for(const key of ['updating','next_announce','min_announce','endpoints'])assert.ok(!(key in real),`tracker payload must not expose WebAPI 2.13.0 field ${key} on 2.12.9`);
}

{
  const w=world('5.2.0','2.13.0');const t=w.torrents[0];t.has_metadata=true;t.private=true;
  const trackers=trackersForTorrent(w,t.hash,1700000005000);assert.ok(trackers.length>=4);
  assert.deepEqual(trackers.slice(0,3).map(x=>x.url),['** [DHT] **','** [PeX] **','** [LSD] **']);
  for(const item of trackers.slice(0,3)){
    assert.equal(item.status,0,'private torrent discovery pseudo-trackers must be disabled');
    assert.equal(item.msg,'This torrent is private');
  }
  const real=trackers[3];assert.equal(typeof real.status,'number');assert.ok(Array.isArray(real.endpoints));
  assert.ok(Number.isFinite(real.next_announce)&&Number.isFinite(real.min_announce),'WebAPI 2.13.0 tracker projection must carry endpoint announce timing');
}

{
  const w=world();authenticate(w,'demo','demo');
  let r=await handleApi(w,getRequest('torrents/properties?hash=0000000000000000000000000000000000000000'));assert.equal(r.status,404);
  r=await handleApi(w,getRequest('torrents/trackers?hash=0000000000000000000000000000000000000000'));assert.equal(r.status,404);
}

console.log('Virtual qB metadata contract passed: exact action gating, metadata-empty behavior, WebAPI 2.13.0 tracker projection and 2.15.1 availability boundaries.');
