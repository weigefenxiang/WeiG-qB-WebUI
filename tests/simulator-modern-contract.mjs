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
  r=await handleApi(w,post('app/rotateAPIKey',{}));assert.equal(r.status,404,'API-key rotation must not leak before WebAPI 2.14.1');
}

{
  const w=world('5.1.4','2.11.4'),t=w.torrents[0],original=t.trackers[0].url,replacement='https://tracker.example/legacy-edited';
  let r=await handleApi(w,post('torrents/editTracker',{hash:t.hash,url:original,newUrl:replacement}));
  assert.equal(r.status,400,'qB 5.1 editTracker must reject the qB 5.2 url parameter contract');
  r=await handleApi(w,post('torrents/editTracker',{hash:t.hash,origUrl:original,newUrl:replacement}));
  assert.equal(r.status,200,'qB 5.1 editTracker must preserve origUrl + newUrl semantics');
  assert.ok(t.trackers.some(item=>item.url===replacement),'qB 5.1 editTracker must persist the replacement tracker URL');
}

{
  const w=world('5.2.0','2.15.1'),t=w.torrents[0],original=t.trackers[0].url,replacement='https://tracker.example/modern-edited';
  let r=await handleApi(w,post('torrents/editTracker',{hash:t.hash,origUrl:original,newUrl:replacement}));
  assert.equal(r.status,400,'qB 5.2 editTracker must reject the legacy origUrl parameter contract');
  r=await handleApi(w,post('torrents/editTracker',{hash:t.hash,url:original}));
  assert.equal(r.status,400,'qB 5.2 editTracker must require newUrl or tier');
  r=await handleApi(w,post('torrents/editTracker',{hash:t.hash,url:original,tier:'300'}));
  assert.equal(r.status,400,'qB 5.2 editTracker must reject tiers outside 0..255');
  r=await handleApi(w,post('torrents/editTracker',{hash:t.hash,url:'udp://missing.invalid:80/announce',tier:'2'}));
  assert.equal(r.status,409,'qB 5.2 editTracker must report unknown trackers as conflict');
  r=await handleApi(w,post('torrents/editTracker',{hash:t.hash,url:original,tier:'7'}));
  assert.equal(r.status,200,'qB 5.2 editTracker must support tier-only updates');
  assert.equal(t.trackers.find(item=>item.url===original)?.tier,7,'tier-only editTracker must persist the new tier');
  r=await handleApi(w,post('torrents/editTracker',{hash:t.hash,url:original,newUrl:replacement,tier:'3'}));
  assert.equal(r.status,200,'qB 5.2 editTracker must support combined URL and tier updates');
  assert.equal(t.trackers.find(item=>item.url===replacement)?.tier,3,'combined editTracker must persist both URL and tier');
  r=await handleApi(w,post('torrents/editTracker',{hash:'missing',url:replacement,tier:'2'}));
  assert.equal(r.status,404,'qB 5.2 editTracker must preserve Not Found for missing torrents');
}

{
  const w=world('5.1.4','2.11.4'),a=w.torrents[0],b=w.torrents[1],url='https://tracker.example/legacy-collection';
  let r=await handleApi(w,post('torrents/addTrackers',{hash:`${a.hash}|${b.hash}`,urls:url}));
  assert.equal(r.status,404,'qB 5.1 addTrackers must remain a single-hash endpoint');
  assert.equal(a.trackers.some(item=>item.url===url),false);assert.equal(b.trackers.some(item=>item.url===url),false);
  r=await handleApi(w,post('torrents/addTrackers',{hash:a.hash,urls:url}));assert.equal(r.status,200);
  r=await handleApi(w,post('torrents/addTrackers',{hash:b.hash,urls:url}));assert.equal(r.status,200);
  r=await handleApi(w,post('torrents/removeTrackers',{hash:`${a.hash}|${b.hash}`,urls:url}));
  assert.equal(r.status,404,'qB 5.1 removeTrackers must reject multiple hashes');
  assert.ok(a.trackers.some(item=>item.url===url)&&b.trackers.some(item=>item.url===url));
  r=await handleApi(w,post('torrents/removeTrackers',{hash:'*',urls:url}));
  assert.equal(r.status,200,'qB 5.1 removeTrackers must preserve the upstream * all-torrents selector');
  assert.equal(a.trackers.some(item=>item.url===url),false);assert.equal(b.trackers.some(item=>item.url===url),false);
}

{
  const w=world('5.2.0','2.15.1'),a=w.torrents[0],b=w.torrents[1],url='https://tracker.example/modern-collection';
  let r=await handleApi(w,post('torrents/addTrackers',{hash:`${a.hash}|${b.hash}`,urls:url}));
  assert.equal(r.status,200,'qB 5.2 addTrackers must support multiple hashes');
  assert.ok(a.trackers.some(item=>item.url===url)&&b.trackers.some(item=>item.url===url));
  r=await handleApi(w,post('torrents/removeTrackers',{hash:`${a.hash}|missing|${b.hash}`,urls:url}));
  assert.equal(r.status,200,'qB 5.2 removeTrackers must ignore missing members in a batch');
  assert.equal(a.trackers.some(item=>item.url===url),false);assert.equal(b.trackers.some(item=>item.url===url),false);
  r=await handleApi(w,post('torrents/addTrackers',{hash:'all',urls:url}));
  assert.equal(r.status,200,'qB 5.2 addTrackers must support the upstream all selector');
  assert.ok(w.torrents.every(item=>item.trackers.some(tracker=>tracker.url===url)));
  r=await handleApi(w,post('torrents/removeTrackers',{hash:'*',urls:url}));
  assert.equal(r.status,200,'qB 5.2 removeTrackers must map * to the all selector');
  assert.ok(w.torrents.every(item=>!item.trackers.some(tracker=>tracker.url===url)));
}

{
  const w=world('5.2.0','2.15.0'),name=Object.keys(w.categories)[0],existing=w.categories[name];
  assert.ok(name&&existing,'legacy editCategory contract needs an existing category');
  let r=await handleApi(w,post('torrents/editCategory',{category:'',savePath:'/invalid'}));
  assert.equal(r.status,400,'editCategory must reject an empty category as Bad Request');
  r=await handleApi(w,post('torrents/editCategory',{category:name}));
  assert.equal(r.status,400,'editCategory must require savePath');
  r=await handleApi(w,post('torrents/editCategory',{category:'missing-category',savePath:'/missing'}));
  assert.equal(r.status,409,'pre-2.15.1 editCategory must preserve Conflict for a missing category');
  r=await handleApi(w,post('torrents/editCategory',{category:name,savePath:existing.savePath}));
  assert.equal(r.status,409,'pre-2.15.1 editCategory must preserve Conflict for unchanged settings');
  r=await handleApi(w,post('torrents/editCategory',{category:name,savePath:'/legacy-category-edited'}));
  assert.equal(r.status,200,'pre-2.15.1 editCategory must still apply a real save-path change');
  assert.equal(w.categories[name].savePath,'/legacy-category-edited');
}

{
  const w=world('5.2.0','2.15.1'),name=Object.keys(w.categories)[0],existing=w.categories[name];
  assert.ok(name&&existing,'modern editCategory contract needs an existing category');
  let r=await handleApi(w,post('torrents/editCategory',{category:'missing-category',savePath:'/missing'}));
  assert.equal(r.status,404,'WebAPI 2.15.1 editCategory must return Not Found for a missing category');
  r=await handleApi(w,post('torrents/editCategory',{category:name,savePath:existing.savePath}));
  assert.equal(r.status,200,'WebAPI 2.15.1 editCategory must accept unchanged category settings');
  r=await handleApi(w,post('torrents/editCategory',{category:name,savePath:'/modern-category-edited'}));
  assert.equal(r.status,200,'WebAPI 2.15.1 editCategory must apply a real save-path change');
  assert.equal(w.categories[name].savePath,'/modern-category-edited');
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

  r=await handleApi(w,get('app/defaultSavePath'));assert.equal(r.status,200);assert.equal(await r.text(),w.preferences.save_path);
  r=await handleApi(w,get(`app/getDirectoryContent?dirPath=${encodeURIComponent('/downloads')}&mode=dirs&withMetadata=true`));assert.equal(r.status,200);
  const dirs=await r.json();assert.ok(dirs.length>0);assert.ok(dirs.every(item=>item.type==='dir'&&typeof item.name==='string'));
  r=await handleApi(w,post('app/sendTestEmail',{}));assert.equal(r.status,200);assert.ok(w.lastTestEmailAt>0);assert.ok(w.logs.some(item=>item.message.includes('test email')));

  r=await handleApi(w,post('app/rotateAPIKey',{}));assert.equal(r.status,200);const key1=(await r.json()).apiKey;assert.match(key1,/^[0-9a-f]{32}$/);
  r=await handleApi(w,post('app/rotateAPIKey',{}));const key2=(await r.json()).apiKey;assert.notEqual(key2,key1,'API-key rotation must replace the current key');
  r=await handleApi(w,post('app/deleteAPIKey',{}));assert.equal(r.status,200);assert.equal(w.webApiKey,'');

  r=await handleApi(w,get('app/networkInterfaceList'));assert.equal(r.status,200);const ifaces=await r.json();assert.ok(ifaces.some(item=>item.value==='eth0'));
  r=await handleApi(w,get('app/networkInterfaceAddressList?iface=eth0'));assert.equal(r.status,200);const addresses=await r.json();assert.ok(addresses.includes('192.0.2.10'));

  r=await handleApi(w,post('app/shutdown',{}));assert.equal(r.status,200);assert.equal(w.shutdownRequested,true);assert.equal(w.environment.online,false,'virtual shutdown must stop virtual network activity without affecting the real browser');
}

{
  const w=world('5.2.0','2.12.0');
  const form=new FormData();form.append('torrent',new Blob(['legacy'],{type:'application/x-bittorrent'}),'legacy.torrent');
  const r=await handleApi(w,new Request('https://example.invalid/api/v2/torrents/parseMetadata',{method:'POST',body:form}));
  assert.equal(r.status,200);const parsed=await r.json();assert.equal(Array.isArray(parsed),false,'pre-2.13 parseMetadata should preserve keyed-object response shape');assert.ok(parsed['legacy.torrent']);
}

{
  const w=world('4.3.9','2.8.2'),t=w.torrents[0];
  let r=await handleApi(w,post('torrents/setSavePath',{id:t.hash,path:'/too-early-save'}));
  assert.equal(r.status,404,'setSavePath must not leak before qB 4.4.0');
  r=await handleApi(w,post('torrents/setDownloadPath',{id:t.hash,path:'/too-early-download'}));
  assert.equal(r.status,404,'setDownloadPath must not leak before qB 4.4.0');
  r=await handleApi(w,get(`torrents/export?hash=${t.hash}`));
  assert.equal(r.status,404,'torrent export must not leak before qB 4.5.0');
}

{
  const w=world('4.4.0','2.8.4'),t=w.torrents[0];
  let r=await handleApi(w,post('torrents/setSavePath',{id:t.hash,path:'/qB44-save'}));
  assert.equal(r.status,200,'setSavePath must be available from qB 4.4.0');
  r=await handleApi(w,post('torrents/setDownloadPath',{id:t.hash,path:'/qB44-download'}));
  assert.equal(r.status,200,'setDownloadPath must be available from qB 4.4.0');
  r=await handleApi(w,get(`torrents/export?hash=${t.hash}`));
  assert.equal(r.status,404,'torrent export must remain unavailable on qB 4.4.x');
}

{
  const w=world('4.5.0','2.8.18'),t=w.torrents[0];
  const r=await handleApi(w,get(`torrents/export?hash=${t.hash}`));
  assert.equal(r.status,200,'torrent export must be available from qB 4.5.0');
  assert.match(r.headers.get('content-type')||'',/application\/x-bittorrent/);
}

{
  const w=world('4.1.0','2.0.0');
  let r=await handleApi(w,get('app/defaultSavePath'));assert.equal(r.status,200,'defaultSavePath must remain available on the original v2 WebAPI generation');
  assert.equal(await r.text(),w.preferences.save_path);
  r=await handleApi(w,get('app/processInfo'));assert.equal(r.status,404,'processInfo must not leak into qB4');
}

console.log('Virtual qB modern contract passed: SSL state, manual peer visibility, qB 5.1/5.2 tracker edit and collection semantics, WebAPI 2.15.1 editCategory behavior, metadata fetch/parse/save, clientdata, process info, virtual filesystem, network interfaces, API keys, test email, historical path/export boundaries and shutdown semantics.');