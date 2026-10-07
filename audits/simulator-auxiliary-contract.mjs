import assert from 'node:assert/strict';
import {authenticate,createWorld} from '../simulator/core/engine.js';
import {runtimeIndexStats} from '../simulator/core/runtime-index.js';
import {handleApi} from '../simulator/protocol/router.js';

function world(qb='5.2.3',api='2.15.1'){
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
  const before=world('4.6.0','2.9.2');
  let r=await handleApi(before,get('torrents/count'));assert.equal(r.status,404,'count must remain unavailable at qB 4.6.0 / WebAPI 2.9.2');
  const atBoundary=world('4.6.1','2.9.3');
  r=await handleApi(atBoundary,get('torrents/count'));assert.equal(r.status,200,'count must become available at qB 4.6.1 / WebAPI 2.9.3');assert.equal(Number(await r.text()),24);
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
  const w=world('5.0.5','2.11.2'),t=w.torrents.find(x=>!x.private);assert.ok(t);
  const added='https://mirror.example.invalid/boundary-seed',edited='https://mirror.example.invalid/boundary-edited';
  for(const [path,body] of [
    ['torrents/setTags',{hashes:t.hash,tags:'boundary'}],
    ['torrents/addWebSeeds',{hash:t.hash,urls:added}],
    ['torrents/editWebSeed',{hash:t.hash,origUrl:added,newUrl:edited}],
    ['torrents/removeWebSeeds',{hash:t.hash,urls:edited}]
  ]){
    const r=await handleApi(w,post(path,body));assert.equal(r.status,404,`${path} must remain unavailable through qB 5.0.5 / WebAPI 2.11.2`);
  }
}

{
  const w=world('5.1.0','2.11.4'),t=w.torrents.find(x=>!x.private);assert.ok(t);
  let r=await handleApi(w,post('torrents/setTags',{hashes:t.hash,tags:'boundary, five-one'}));assert.equal(r.status,200,'setTags must become available at qB 5.1.0 / WebAPI 2.11.4');assert.deepEqual(t.tags,['boundary','five-one']);
  const added='https://mirror.example.invalid/five-one-seed',edited='https://mirror.example.invalid/five-one-edited';
  r=await handleApi(w,post('torrents/addWebSeeds',{hash:t.hash,urls:added}));assert.equal(r.status,200,'addWebSeeds must become available at qB 5.1.0 / WebAPI 2.11.4');
  r=await handleApi(w,post('torrents/editWebSeed',{hash:t.hash,origUrl:added,newUrl:edited}));assert.equal(r.status,200,'editWebSeed must become available at qB 5.1.0 / WebAPI 2.11.4');
  r=await handleApi(w,post('torrents/removeWebSeeds',{hash:t.hash,urls:edited}));assert.equal(r.status,200,'removeWebSeeds must become available at qB 5.1.0 / WebAPI 2.11.4');
}

{
  const before=world('5.1.4','2.11.4'),beforeTorrent=before.torrents.find(x=>!x.private);assert.ok(beforeTorrent);
  let r=await handleApi(before,get(`torrents/pieceAvailability?hash=${beforeTorrent.hash}`));assert.equal(r.status,404,'pieceAvailability must remain unavailable through qB 5.1.4 / WebAPI 2.11.4');
  r=await handleApi(before,post('torrents/setComment',{hashes:beforeTorrent.hash,comment:'too early'}));assert.equal(r.status,404,'setComment must remain unavailable through qB 5.1.4 / WebAPI 2.11.4');

  const atBoundary=world('5.2.0','2.15.1'),t=atBoundary.torrents.find(x=>!x.private);assert.ok(t);
  r=await handleApi(atBoundary,get(`torrents/pieceAvailability?hash=${t.hash}`));assert.equal(r.status,200,'pieceAvailability must become available at qB 5.2.0 / WebAPI 2.15.1');assert.ok(Array.isArray(await r.json()));
  r=await handleApi(atBoundary,post('torrents/setComment',{hashes:t.hash,comment:'qB 5.2 boundary'}));assert.equal(r.status,200,'setComment must become available at qB 5.2.0 / WebAPI 2.15.1');assert.equal(t.comment,'qB 5.2 boundary');
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

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.16.2',stable:true},count:5000,seed:'auxiliary-index-contract',now:1700000000000});
  authenticate(w,'demo','demo',1700000000000);
  const a=w.torrents[17],b=w.torrents[2499],c=w.torrents[4988];
  a.downloadLimit=123456;b.downloadLimit=234567;c.downloadLimit=345678;
  let r=await handleApi(w,get(`torrents/downloadLimit?hashes=${a.hash}|${b.hash}|${c.hash}`));
  assert.equal(r.status,200);
  let limits=await r.json();
  assert.equal(limits[a.hash],123456);assert.equal(limits[b.hash],234567);assert.equal(limits[c.hash],345678);
  let stats=runtimeIndexStats(w);
  assert.equal(stats.indexedRows,5000,'auxiliary hash lookup must build one shared 5000-row membership index');
  const hitsBefore=stats.indexHits;
  r=await handleApi(w,post('torrents/setComment',{hashes:`${a.hash}|${b.hash}|${c.hash}`,comment:'Indexed auxiliary note'}));assert.equal(r.status,200);
  r=await handleApi(w,post('torrents/setTags',{hashes:`${a.hash}|${b.hash}|${c.hash}`,tags:'indexed,aux'}));assert.equal(r.status,200);
  r=await handleApi(w,get(`torrents/pieceAvailability?hash=${c.hash}`));assert.equal(r.status,200);assert.ok(Array.isArray(await r.json()));
  r=await handleApi(w,get(`torrents/export?hash=${b.hash}`));assert.equal(r.status,200);
  stats=runtimeIndexStats(w);
  assert.equal(stats.indexedRows,5000,'auxiliary reads and mutations must retain the same membership index while membership is unchanged');
  assert.ok(stats.indexHits>=hitsBefore+4,'repeated auxiliary hash operations must hit the shared index instead of rescanning 5000 torrents');
}

console.log('Virtual qB auxiliary contract passed: source-derived count/qB5 auxiliary boundaries, per-torrent limit maps, manual peers, save/download paths, export, piece availability, comments, tags and WebSeed mutations reuse the shared runtime index.');
