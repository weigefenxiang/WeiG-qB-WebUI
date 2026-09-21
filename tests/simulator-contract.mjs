import assert from 'node:assert/strict';
import {createWorld,transferInfo,setTorrentLimit,setPaused,authenticate,logout,setPreferences,addVirtualTorrent,deleteTorrents,mainData} from '../simulator/core/engine.js';
import {handleApi} from '../simulator/protocol/router.js';
import {
  addTrackers,advanceActionStates,applyRuntimePolicies,banPeers,editTracker,filterBannedPeers,
  reannounceTorrents,recheckTorrents,removeTrackers,setAutoManagement,setFilePriority,setLocation,
  toggleFirstLast,toggleSequential
} from '../simulator/core/torrent-actions.js';
import {applyScenario} from '../simulator/core/scenarios.js';
import {
  creatorAddTask,creatorDeleteTask,creatorStatus,creatorTorrentFile,rssAddFeed,rssItems,rssRefreshItem,
  rssRemoveItem,searchResults,searchStart,searchStatus,searchStop
} from '../simulator/core/virtual-services.js';

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
  const w=world();
  let r=await handleApi(w,formRequest('https://example.invalid/api/v2/auth/login',{username:'x',password:'y'}));
  assert.equal(r.status,204,'modern audited WebAPI login success must be No Content');assert.equal(await r.text(),'');
  assert.equal(w.authenticated,true,'default Virtual Lab policy must keep arbitrary login accepted');
  r=await handleApi(w,formRequest('https://example.invalid/api/v2/auth/logout',{}));
  assert.equal(r.status,200);
  r=await handleApi(w,new Request('https://example.invalid/api/v2/app/preferences'));
  assert.equal(r.status,403,'protected API must fail after logout');
}

{
  const legacy=world('5.1.4','2.11.4');
  legacy.authenticationPolicy={acceptAny:false,username:'demo',password:'demo'};
  let r=await handleApi(legacy,formRequest('https://example.invalid/api/v2/auth/login',{username:'wrong',password:'wrong'}));
  assert.equal(r.status,200);assert.equal(await r.text(),'Fails.','pre-2.14 invalid credentials must preserve legacy text response');
  assert.equal(legacy.authenticated,false);
  r=await handleApi(legacy,formRequest('https://example.invalid/api/v2/auth/login',{username:'demo',password:'demo'}));
  assert.equal(r.status,200);assert.equal(await r.text(),'Ok.','pre-2.14 successful login must preserve legacy text response');
  assert.equal(legacy.authenticated,true);

  const modern=world('5.2.3','2.15.1');
  modern.authenticationPolicy={acceptAny:false,username:'demo',password:'demo'};
  r=await handleApi(modern,formRequest('https://example.invalid/api/v2/auth/login',{username:'wrong',password:'wrong'}));
  assert.equal(r.status,401);assert.equal(await r.text(),'Unauthorized','WebAPI 2.14+ invalid credentials must return HTTP 401 status text');
  assert.equal(modern.authenticated,false);
  r=await handleApi(modern,formRequest('https://example.invalid/api/v2/auth/login',{username:'demo',password:'demo'}));
  assert.equal(r.status,204);assert.equal(await r.text(),'','WebAPI 2.14+ successful login must return No Content');
  assert.equal(modern.authenticated,true);
}

{
  const legacy=world('5.1.4','2.11.4');authenticate(legacy,'demo','demo');
  legacy.profile.apiActions=['torrentscontroller.h:propertiesAction'];
  let r=await handleApi(legacy,new Request('https://example.invalid/api/v2/app/definitelyMissing'));
  assert.equal(r.status,404);assert.equal(await r.text(),'Not Found','pre-2.14 unknown endpoints must retain the generic 404 body');

  const modern=world();authenticate(modern,'demo','demo');
  modern.profile.apiActions=['torrentscontroller.h:propertiesAction'];
  r=await handleApi(modern,new Request('https://example.invalid/api/v2/app/definitelyMissing'));
  assert.equal(r.status,404);assert.equal(await r.text(),'Endpoint does not exist','WebAPI 2.14+ unknown endpoints must use the dedicated endpoint error body');
  r=await handleApi(modern,new Request('https://example.invalid/api/v2/torrents/properties?hash=missing-resource'));
  assert.equal(r.status,404);assert.equal(await r.text(),'Not Found','resource-level 404 responses must not be rewritten as missing-endpoint errors');
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

{
  const w=world();
  applyScenario(w,'mixed',1700000000000);
  const stalledDl=w.torrents.filter(t=>t.canonicalState==='DOWNLOAD_STALLED').length;
  const stalledUp=w.torrents.filter(t=>t.canonicalState==='SEED_STALLED').length;
  assert.ok(stalledDl>=1,'mixed scenario must preserve visible stalled downloads');
  assert.ok(stalledUp>=1,'mixed scenario must preserve visible stalled uploads');
  const q=world();applyScenario(q,'queue-stress',1700000000000);transferInfo(q,1700000001000);
  assert.equal(q.preferences.max_active_downloads,2);assert.equal(q.preferences.max_active_uploads,3);assert.equal(q.preferences.max_active_torrents,5);
  const poor=world();applyScenario(poor,'poor-network',1700000000000);
  assert.ok(poor.environment.downCapacity<=22*MiB&&poor.environment.packetLoss>=.02,'poor-network scenario must constrain the environment');
  const disk=world();applyScenario(disk,'disk-bottleneck',1700000000000);
  assert.equal(disk.environment.diskWriteCapacity,18*MiB,'disk-bottleneck scenario must constrain disk writes');
}

{
  const w=world();authenticate(w,'demo','demo');
  const target=w.torrents.find(t=>!t.completed);assert.ok(target);
  setAutoManagement(w,target.hash,true);assert.equal(target.autoManagement,true,'auto management must mutate torrent state');
  const sequential=target.sequential;toggleSequential(w,target.hash);assert.equal(target.sequential,!sequential,'sequential action must mutate torrent state');
  const firstLast=target.firstLastPriority;toggleFirstLast(w,target.hash);assert.equal(target.firstLastPriority,!firstLast,'first/last priority action must mutate torrent state');
  assert.ok(setFilePriority(w,target.hash,'0',0),'file priority action must find the file');assert.equal(target.files[0].priority,0,'file priority must persist');
  setLocation(w,target.hash,'/virtual/new',1700000000000);assert.equal(target.savePath,'/virtual/new');assert.equal(target.canonicalState,'MOVING');
  advanceActionStates(w,1700000003000);assert.notEqual(target.canonicalState,'MOVING','move state must recover after its virtual maintenance window');
}

{
  const w=world();authenticate(w,'demo','demo');
  const target=w.torrents.find(t=>!t.completed);assert.ok(target);
  recheckTorrents(w,target.hash,1700000000000);assert.equal(target.canonicalState,'CHECKING','recheck must enter checking state');
  advanceActionStates(w,1700000003000);assert.notEqual(target.canonicalState,'CHECKING','recheck must recover after its virtual window');
  const tracker=target.trackers[0];tracker.status=4;tracker.msg='timeout';
  reannounceTorrents(w,target.hash,1700000004000);assert.equal(tracker.status,2);assert.equal(tracker.msg,'','reannounce must refresh tracker state');
}

{
  const w=world();authenticate(w,'demo','demo');
  const target=w.torrents[0],original=target.trackers[0].url,newUrl='https://virtual-added.example/announce',edited='https://virtual-edited.example/announce';
  assert.ok(addTrackers(w,target.hash,newUrl));assert.ok(target.trackers.some(x=>x.url===newUrl),'addTrackers must persist');
  assert.ok(editTracker(w,target.hash,newUrl,edited));assert.ok(target.trackers.some(x=>x.url===edited),'editTracker must persist');
  assert.ok(removeTrackers(w,target.hash,edited));assert.ok(!target.trackers.some(x=>x.url===edited),'removeTrackers must persist');
  assert.ok(target.trackers.some(x=>x.url===original),'existing tracker must remain');
}

{
  const w=world();authenticate(w,'demo','demo');
  const map={'10.0.0.1:50000':{ip:'10.0.0.1',port:50000},'10.0.0.2:50001':{ip:'10.0.0.2',port:50001}};
  banPeers(w,'10.0.0.1:50000');const filtered=filterBannedPeers(w,map);
  assert.equal(Object.keys(filtered).length,1);assert.ok(!filtered['10.0.0.1:50000'],'banned peer must disappear from peer API projection');
}

{
  const w=world();
  w.environment.basePeerAvailability=.9;w.environment.peerAvailability=.9;
  setPreferences(w,{dht:false,pex:false,lsd:false},1700000000000);
  applyRuntimePolicies(w,1700000000000);
  assert.ok(w.environment.peerAvailability<.5,'disabling discovery sources must reduce available virtual peers');
  setPreferences(w,{scheduler_enabled:true,schedule_from_hour:8,schedule_to_hour:20},1700000000000);
  applyRuntimePolicies(w,Date.UTC(2026,0,1,9,0));assert.equal(w.altSpeedMode,true,'scheduler window must enable alternate speed mode');
  applyRuntimePolicies(w,Date.UTC(2026,0,1,21,0));assert.equal(w.altSpeedMode,false,'outside scheduler window must disable alternate speed mode');
}

{
  const w=world();authenticate(w,'demo','demo');
  const target=w.torrents.find(t=>!t.completed);assert.ok(target);
  let r=await handleApi(w,formRequest('https://example.invalid/api/v2/torrents/toggleSequentialDownload',{hashes:target.hash}));assert.equal(r.status,200);
  assert.equal(target.sequential,true,'router must execute sequential side effect');
  r=await handleApi(w,formRequest('https://example.invalid/api/v2/torrents/addTrackers',{hash:target.hash,urls:'https://router.example/announce'}));assert.equal(r.status,200);
  assert.ok(target.trackers.some(x=>x.url==='https://router.example/announce'),'router must execute tracker add side effect');
}

{
  const w=world();authenticate(w,'demo','demo');
  const feed=rssAddFeed(w,'https://feeds.example.invalid/releases.xml','',1700000000000);
  let items=rssItems(w,true);assert.ok(items[feed.key],'RSS add must create a visible feed');
  const firstBuild=items[feed.key].lastBuildDate;assert.ok(rssRefreshItem(w,feed.key,1700000005000));
  items=rssItems(w,true);assert.ok(items[feed.key].lastBuildDate>firstBuild,'RSS refresh must update feed state');
  assert.ok(rssRemoveItem(w,feed.key));assert.equal(Object.keys(rssItems(w,true)).length,0,'RSS remove must persist');
}

{
  const w=world();authenticate(w,'demo','demo');
  const started=searchStart(w,{pattern:'Ubuntu ISO'},1700000000000);assert.ok(started.id>0);
  let status=searchStatus(w,started.id,1700000000500);assert.equal(status[0].status,'Running','search must have a running lifecycle');
  const partial=searchResults(w,started.id,100,0,1700000000500);assert.ok(partial.results.length>=6,'running search must expose deterministic partial results');
  const later=searchResults(w,started.id,100,0,1700000005000);assert.ok(later.results.length>partial.results.length,'search results must grow over virtual time');
  assert.ok(searchStop(w,started.id));status=searchStatus(w,started.id,1700000005000);assert.equal(status[0].status,'Stopped');
}

{
  const w=world();authenticate(w,'demo','demo');
  const created=creatorAddTask(w,{sourcePath:'/virtual/source'},1700000000000);assert.ok(created.taskID);
  let status=creatorStatus(w,created.taskID,1700000000500);assert.equal(status.status,'Running');assert.ok(status.progress>0&&status.progress<1);
  status=creatorStatus(w,created.taskID,1700000003000);assert.equal(status.status,'Finished');assert.equal(status.progress,1);
  assert.ok(creatorTorrentFile(w,created.taskID,1700000003000),'finished creator task must expose a virtual torrent file');
  assert.ok(creatorDeleteTask(w,created.taskID));
}

{
  const w=world();authenticate(w,'demo','demo');
  let r=await handleApi(w,formRequest('https://example.invalid/api/v2/rss/addFeed',{url:'https://router-feed.example/rss',path:''}));assert.equal(r.status,200);
  r=await handleApi(w,new Request('https://example.invalid/api/v2/rss/items?withData=true'));const feeds=await r.json();assert.ok(Object.keys(feeds).length===1,'router RSS surface must be stateful');
  r=await handleApi(w,formRequest('https://example.invalid/api/v2/search/start',{pattern:'Fedora',plugins:'enabled',category:'all'}));const job=await r.json();assert.ok(job.id>0);
  r=await handleApi(w,new Request(`https://example.invalid/api/v2/search/results?id=${job.id}&limit=20&offset=0`));const results=await r.json();assert.ok(results.results.length>0,'router search must return virtual results');
}

console.log('Virtual qB simulator contract passed: deterministic world, versioned login and missing-endpoint responses, arbitrary default login, strict credential test policy, limits, queueing, scenarios, qB4/qB5 endpoint split, real torrent actions, trackers, peer bans, RSS/search/torrent-creator lifecycles and scheduled policy effects.');
