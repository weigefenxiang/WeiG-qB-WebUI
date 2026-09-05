import assert from 'node:assert/strict';
import {authenticate,createWorld} from '../simulator/core/engine.js';
import {handleApi} from '../simulator/protocol/router.js';

function world(qb='5.2.3',api='2.16.2'){
  const w=createWorld({profile:{qbVersion:qb,webApiVersion:api,stable:true},count:24,seed:'auxiliary-contract',now:1700000000000});
  authenticate(w,'demo','demo',1700000000000);return w;
}
function get(path){return new Request(`https://example.invalid/api/v2/${path}`);}
function post(path,body){return new Request(`https://example.invalid/api/v2/${path}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});}

{
  const old=world('4.1.0','2.0.0');
  const r=await handleApi(old,get('torrents/count'));assert.equal(r.status,404,'bootstrap qB 4.1 must not invent later count endpoint');
}

{
  const w=world('4.2.0','2.3.0'),t=w.torrents[0];
  t.downloadLimit=2*1024*1024;t.uploadLimit=512*1024;
  let r=await handleApi(w,get(`torrents/downloadLimit?hashes=${t.hash}`));assert.equal(r.status,200);assert.equal((await r.json())[t.hash],2*1024*1024);
  r=await handleApi(w,get(`torrents/uploadLimit?hashes=${t.hash}|missing`));const limits=await r.json();assert.equal(limits[t.hash],512*1024);assert.equal(limits.missing,-1);
  const before=t.leechers;
  r=await handleApi(w,post('torrents/addPeers',{hashes:t.hash,peers:'203.0.113.20:51413|[2001:db8::20]:51414'}));assert.equal(r.status,200);
  assert.equal(Object.keys(t.manualPeers||{}).length,2);assert.equal(t.leechers,before+2,'manual peers must affect virtual swarm pressure');
}

{
  const w=world('4.6.7','2.9.0'),t=w.torrents[0];
  let r=await handleApi(w,post('torrents/setSavePath',{id:t.hash,path:'/virtual/archive'}));assert.equal(r.status,200);assert.equal(t.savePath,'/virtual/archive');
  r=await handleApi(w,post('torrents/setDownloadPath',{id:t.hash,path:'/virtual/incomplete'}));assert.equal(r.status,200);assert.equal(t.downloadPath,'/virtual/incomplete');
  r=await handleApi(w,get(`torrents/export?hash=${t.hash}`));assert.equal(r.status,200);assert.match(r.headers.get('content-type')||'',/application\/x-bittorrent/);assert.ok((await r.text()).length>40);
  t.has_metadata=false;r=await handleApi(w,get(`torrents/export?hash=${t.hash}`));assert.equal(r.status,409,'export must fail until metadata exists');
}

{
  const w=world(),t=w.torrents.find(x=>!x.private);assert.ok(t);
  let r=await handleApi(w,get(`torrents/pieceAvailability?hash=${t.hash}`));assert.equal(r.status,200);const availability=await r.json();assert.ok(availability.length>0);assert.ok(availability.every(Number.isInteger));
  t.has_metadata=false;r=await handleApi(w,get(`torrents/pieceAvailability?hash=${t.hash}`));assert.deepEqual(await r.json(),[]);
  t.has_metadata=true;

  r=await handleApi(w,post('torrents/setComment',{hashes:t.hash,comment:'Virtual note'}));assert.equal(r.status,200);
  r=await handleApi(w,get(`torrents/properties?hash=${t.hash}`));assert.equal((await r.json()).comment,'Virtual note');

  r=await handleApi(w,post('torrents/setTags',{hashes:t.hash,tags:'one, two,one'}));assert.equal(r.status,200);assert.deepEqual(t.tags,['one','two']);

  r=await handleApi(w,get(`torrents/webseeds?hash=${t.hash}`));const initial=await r.json();const added='https://mirror.example.invalid/new-seed';
  r=await handleApi(w,post('torrents/addWebSeeds',{hash:t.hash,urls:added}));assert.equal(r.status,200);
  r=await handleApi(w,get(`torrents/webseeds?hash=${t.hash}`));let seeds=await r.json();assert.ok(seeds.some(x=>x.url===added));
  const edited='https://mirror.example.invalid/edited-seed';
  r=await handleApi(w,post('torrents/editWebSeed',{hash:t.hash,origUrl:added,newUrl:edited}));assert.equal(r.status,200);
  r=await handleApi(w,get(`torrents/webseeds?hash=${t.hash}`));seeds=await r.json();assert.ok(seeds.some(x=>x.url===edited));
  r=await handleApi(w,post('torrents/removeWebSeeds',{hash:t.hash,urls:edited}));assert.equal(r.status,200);
  r=await handleApi(w,get(`torrents/webseeds?hash=${t.hash}`));seeds=await r.json();assert.ok(!seeds.some(x=>x.url===edited));assert.ok(seeds.length>=initial.length);
}

console.log('Virtual qB auxiliary contract passed: version-aware count, per-torrent limit maps, manual peers, save/download paths, export, piece availability, comments, tags and WebSeed mutations.');
