import assert from 'node:assert/strict';
import {createWorld,transferInfo,setTorrentLimit,setPaused,authenticate,logout,setPreferences,addVirtualTorrent,deleteTorrents,mainData} from '../simulator/core/engine.js';
import {handleApi} from '../simulator/protocol/router.js';

const MiB=1024*1024;
function world(qb='5.2.3',api='2.15.1',count=500){
  return createWorld({profile:{qbVersion:qb,webApiVersion:api,stable:true},count,seed:'contract-seed',now:1700000000000});
}
function formRequest(url,body){
  return new Request(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
}

{
  const a=world('5.2.3','2.15.1',100),b=world('5.2.3','2.15.1',100);
  assert.deepEqual(a.torrents.slice(0,20).map(x=>[x.hash,x.name,x.size,x.canonicalState]),b.torrents.slice(0,20).map(x=>[x.hash,x.name,x.size,x.canonicalState]),'same seed must reproduce the same world');
}

{
  const w=world();
  authenticate(w,'anything','also-anything',1700000000000);
  assert.equal(w.authenticated,true,'arbitrary credentials are accepted');
  logout(w,1700000001000);
  assert.equal(w.authenticated,false,'logout invalidates virtual session');
}

{
  const w=world();authenticate(w,'demo','demo');
  let r=await handleApi(w,formRequest('https://example.invalid/api/v2/auth/login',{username:'x',password:'y'}));
  assert.equal(r.status,200);assert.equal((await r.text()).trim(),'Ok.','router accepts arbitrary login');
  r=await handleApi(w,formRequest('https://example.invalid/api/v2/auth/logout',{}));
  assert.equal(r.status,200);
  r=await handleApi(w,new Request('https://example.invalid/api/v2/app/preferences'));
  assert.equal(r.status,403,'protected API must fail after logout');
}

{
  const w=world();authenticate(w,'demo','demo');
  w.globalDownloadLimit=10*MiB;
  for(const t of w.torrents){if(!t.completed){t.seeders=Math.max(10,t.seeders);t.leechers=Math.max(10,t.leechers);}}
  const t=transferInfo(w,1700000005000);
  assert.ok(t.dl_info_speed<=10*MiB+1,'global download budget must be respected');
}

{
  const w=world();authenticate(w,'demo','demo');
  const target=w.torrents.find(t=>!t.completed);
  assert.ok(target,'need incomplete torrent');
  target.seeders=50;target.leechers=20;
  setTorrentLimit(w,target.hash,'download',2*MiB,1700000000000);
  transferInfo(w,1700000005000);
  assert.ok(target.effectiveDownloadRate<=2*MiB,'per-torrent download limit must be respected');
}

{
  const w=world();authenticate(w,'demo','demo');
  setPreferences(w,{queueing_enabled:true,max_active_downloads:2,max_active_uploads:2,max_active_torrents:4},1700000000000);
  for(const t of w.torrents){if(!t.completed){t.seeders=Math.max(2,t.seeders);t.leechers=Math.max(2,t.leechers);}else t.leechers=Math.max(2,t.leechers);}
  transferInfo(w,1700000001000);
  const activeDl=w.torrents.filter(t=>!t.completed&&t.effectiveDownloadRate>0).length;
  const activeUl=w.torrents.filter(t=>t.completed&&t.effectiveUploadRate>0).length;
  assert.ok(activeDl<=2,'max_active_downloads must be respected');
  assert.ok(activeUl<=2,'max_active_uploads must be respected');
  assert.ok(activeDl+activeUl<=4,'max_active_torrents must be respected');
}

{
  const w=world('4.1.9.1','2.2.1');authenticate(w,'demo','demo');
  const target=w.torrents.find(t=>!t.completed);assert.ok(target);
  let r=await handleApi(w,formRequest('https://example.invalid/api/v2/torrents/pause',{hashes:target.hash}));assert.equal(r.status,200);
  assert.equal(target.canonicalState,'DOWNLOAD_PAUSED');
  r=await handleApi(w,formRequest('https://example.invalid/api/v2/torrents/stop',{hashes:target.hash}));assert.equal(r.status,404,'qB4 must not expose qB5 stop endpoint');
}

{
  const w=world('5.2.3','2.15.1');authenticate(w,'demo','demo');
  const target=w.torrents.find(t=>!t.completed);assert.ok(target);
  let r=await handleApi(w,formRequest('https://example.invalid/api/v2/torrents/stop',{hashes:target.hash}));assert.equal(r.status,200);
  assert.equal(target.canonicalState,'DOWNLOAD_PAUSED');
  r=await handleApi(w,formRequest('https://example.invalid/api/v2/torrents/pause',{hashes:target.hash}));assert.equal(r.status,404,'qB5 must not expose legacy pause endpoint');
}

{
  const w=world();authenticate(w,'demo','demo');
  const before=w.torrents.length;
  const added=addVirtualTorrent(w,{name:'Contract Magnet'},1700000010000);
  assert.equal(w.torrents.length,before+1);assert.ok(added.hash);
  const data=mainData(w,0,1700000010000);assert.equal(data.full_update,true);assert.ok(data.torrents[added.hash]);
  deleteTorrents(w,added.hash,1700000011000);assert.equal(w.torrents.length,before);
}

{
  const w=world();authenticate(w,'demo','demo');
  const target=w.torrents.find(t=>!t.completed);assert.ok(target);
  setPaused(w,target.hash,true,1700000000000);assert.equal(target.canonicalState,'DOWNLOAD_PAUSED');
  setPaused(w,target.hash,false,1700000001000);assert.notEqual(target.canonicalState,'DOWNLOAD_PAUSED');
}

console.log('Virtual qB simulator contract passed: deterministic world, arbitrary login/logout, limits, queueing, qB4/qB5 endpoint split, add/delete and state transitions.');
