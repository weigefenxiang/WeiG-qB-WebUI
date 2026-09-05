import assert from 'node:assert/strict';
import {authenticate,createWorld} from '../simulator/core/engine.js';
import {handleApi} from '../simulator/protocol/router.js';

function world(qb='5.2.3',api='2.16.2'){
  const w=createWorld({profile:{qbVersion:qb,webApiVersion:api,stable:true},count:24,seed:'modern-contract',now:1700000000000});
  authenticate(w,'demo','demo',1700000000000);return w;
}
function get(path){return new Request(`https://example.invalid/api/v2/${path}`);}
function post(path,body){return new Request(`https://example.invalid/api/v2/${path}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});}

{
  const w=world('5.1.2','2.11.8'),t=w.torrents[0];
  let r=await handleApi(w,get(`torrents/SSLParameters?hash=${t.hash}`));assert.equal(r.status,200,'qB 5.1 SSL parameters should remain available');
  r=await handleApi(w,post('torrents/fetchMetadata',{source:'magnet:?xt=urn:btih:abc&dn=TooEarly'}));assert.equal(r.status,404,'metadata preview endpoints must not leak into qB 5.1 bootstrap profiles');
}

{
  const w=world(),t=w.torrents[0];
  let r=await handleApi(w,get(`torrents/SSLParameters?hash=${t.hash}`));assert.deepEqual(await r.json(),{ssl_certificate:'',ssl_private_key:'',ssl_dh_params:''});
  r=await handleApi(w,post('torrents/setSSLParameters',{
    hash:t.hash,ssl_certificate:'CERT',ssl_private_key:'KEY',ssl_dh_params:'DH'
  }));assert.equal(r.status,204);
  r=await handleApi(w,get(`torrents/SSLParameters?hash=${t.hash}`));assert.deepEqual(await r.json(),{ssl_certificate:'CERT',ssl_private_key:'KEY',ssl_dh_params:'DH'});

  const manual='203.0.113.44:51413';
  r=await handleApi(w,post('torrents/addPeers',{hashes:t.hash,peers:manual}));assert.equal(r.status,200);
  r=await handleApi(w,get(`sync/torrentPeers?hash=${t.hash}&rid=0`));assert.equal(r.status,200);
  const peerData=await r.json();assert.ok(peerData.peers[manual],'manually added peer must be visible through sync/torrentPeers');
  assert.equal(peerData.peers[manual].client,'Manual virtual peer');
  r=await handleApi(w,get('sync/torrentPeers?hash=missing'));assert.equal(r.status,404,'torrentPeers should match upstream Not Found semantics');

  const source='magnet:?xt=urn:btih:0123456789abcdef&dn=Metadata%20Demo';
  r=await handleApi(w,post('torrents/fetchMetadata',{source}));assert.equal(r.status,202,'first metadata poll should model pending retrieval');
  const pending=await r.json();assert.equal(pending.info.name,'Metadata Demo');assert.ok(pending.infohash_v1);
  r=await handleApi(w,post('torrents/fetchMetadata',{source}));assert.equal(r.status,200,'subsequent metadata poll should complete deterministically');
  const metadata=await r.json();assert.equal(metadata.info.name,'Metadata Demo');assert.equal(metadata.info.files.length,3);assert.ok(metadata.info.length>0);

  r=await handleApi(w,get(`torrents/saveMetadata?source=${encodeURIComponent(source)}`));assert.equal(r.status,200);
  assert.match(r.headers.get('content-type')||'',/application\/x-bittorrent/);assert.ok((await r.text()).length>40);

  const form=new FormData();
  form.append('torrents',new Blob(['virtual torrent one'],{type:'application/x-bittorrent'}),'one.torrent');
  form.append('torrents',new Blob(['virtual torrent two'],{type:'application/x-bittorrent'}),'two.torrent');
  r=await handleApi(w,new Request('https://example.invalid/api/v2/torrents/parseMetadata',{method:'POST',body:form}));
  assert.equal(r.status,200);const parsed=await r.json();assert.ok(Array.isArray(parsed));assert.equal(parsed.length,2);assert.equal(parsed[0].info.name,'one');

  r=await handleApi(w,post('clientdata/store',{data:JSON.stringify({theme:'dark',columns:['name','size'],nullable:'remove-me'})}));assert.equal(r.status,204);
  r=await handleApi(w,get(`clientdata/load?keys=${encodeURIComponent(JSON.stringify(['theme','columns']))}`));assert.deepEqual(await r.json(),{theme:'dark',columns:['name','size']});
  r=await handleApi(w,post('clientdata/store',{data:JSON.stringify({nullable:null})}));assert.equal(r.status,204);
  r=await handleApi(w,get('clientdata/load'));assert.equal((await r.json()).nullable,undefined,'null client data should delete the key');

  r=await handleApi(w,get('app/processInfo'));assert.equal(r.status,200);const first=await r.json();
  r=await handleApi(w,get('app/processInfo'));const second=await r.json();assert.deepEqual(second,first);assert.ok(Number.isInteger(first.launch_time));
}

{
  const w=world('5.2.0','2.12.0');
  const form=new FormData();form.append('torrent',new Blob(['legacy'],{type:'application/x-bittorrent'}),'legacy.torrent');
  const r=await handleApi(w,new Request('https://example.invalid/api/v2/torrents/parseMetadata',{method:'POST',body:form}));
  assert.equal(r.status,200);const parsed=await r.json();assert.equal(Array.isArray(parsed),false,'pre-2.13 parseMetadata should preserve keyed-object response shape');assert.ok(parsed['legacy.torrent']);
}

console.log('Virtual qB modern contract passed: SSL state, manual peer visibility, metadata fetch/parse/save lifecycle, clientdata persistence and process info.');
