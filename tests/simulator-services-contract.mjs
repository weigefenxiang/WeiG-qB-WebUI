import assert from 'node:assert/strict';
import {authenticate,createWorld} from '../simulator/core/engine.js';
import {handleApi} from '../simulator/protocol/router.js';

function world(qb='5.2.3',api='2.15.1',extra={}){
  const w=createWorld({profile:{qbVersion:qb,webApiVersion:api,stable:true,...extra},count:320,seed:`services-${qb}-${api}`,now:1700000000000});
  authenticate(w,'demo','demo',1700000000000);
  return w;
}
function formRequest(path,body={}){
  return new Request(`https://example.invalid/api/v2/${path}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
}
function getRequest(path){return new Request(`https://example.invalid/api/v2/${path}`);}

{
  const w=world('4.1.0','2.0.0');
  for(const path of ['rss/items?withData=true','search/plugins','app/buildInfo']){
    const response=await handleApi(w,getRequest(path));
    assert.equal(response.status,404,`${path} must be unavailable before its WebAPI capability boundary`);
  }
  const ban=await handleApi(w,formRequest('transfer/banPeers',{peers:'10.0.0.1:50000'}));
  assert.equal(ban.status,404,'peer ban must be unavailable before WebAPI 2.3.0');
}

{
  const before=world('4.1.1','2.0.1');
  let response=await handleApi(before,formRequest('torrents/reannounce',{hashes:before.torrents[0].hash}));
  assert.equal(response.status,404,'reannounce must remain unavailable through qB 4.1.1 / WebAPI 2.0.1');

  const atBoundary=world('4.1.2','2.0.2');
  response=await handleApi(atBoundary,formRequest('torrents/reannounce',{hashes:atBoundary.torrents[0].hash}));
  assert.equal(response.status,200,'reannounce must become available at qB 4.1.2 / WebAPI 2.0.2');
}

{
  const w=world('4.1.3','2.1.0');
  let response=await handleApi(w,getRequest('rss/items?withData=true'));
  assert.equal(response.status,200,'RSS must exist at WebAPI 2.1.0');
  response=await handleApi(w,getRequest('search/plugins'));
  assert.equal(response.status,404,'Search must remain unavailable before WebAPI 2.1.1');
  response=await handleApi(w,formRequest('rss/refreshItem',{itemPath:'missing'}));
  assert.equal(response.status,404,'RSS refresh capability must remain unavailable before WebAPI 2.2.1');
  response=await handleApi(w,getRequest('torrents/categories'));
  assert.equal(response.status,404,'categories getter must remain unavailable through qB 4.1.3 / WebAPI 2.1.0');
}

{
  const middle=world('4.1.4','2.1.1');
  let response=await handleApi(middle,getRequest('torrents/categories'));
  assert.equal(response.status,200,'categories getter must become available at qB 4.1.4 / WebAPI 2.1.1');
  const middleTarget=middle.torrents[0],middleTracker=middleTarget.trackers[0].url;
  response=await handleApi(middle,formRequest('torrents/removeTrackers',{hash:middleTarget.hash,urls:middleTracker}));
  assert.equal(response.status,404,'removeTrackers must remain unavailable through qB 4.1.4 / WebAPI 2.1.1');

  const atBoundary=world('4.1.5','2.2.0');
  const target=atBoundary.torrents[0],tracker=target.trackers[0].url,beforeCount=target.trackers.length;
  response=await handleApi(atBoundary,formRequest('torrents/removeTrackers',{hash:target.hash,urls:tracker}));
  assert.equal(response.status,200,'removeTrackers must become available at qB 4.1.5 / WebAPI 2.2.0');
  assert.equal(target.trackers.length,beforeCount-1,'removeTrackers must mutate persistent tracker state once available');
}

{
  const w=world('4.1.9.1','2.2.1');
  const target=w.torrents[0],oldUrl=target.trackers[0].url,newUrl='https://edited.example.invalid/announce';
  let response=await handleApi(w,formRequest('torrents/editTracker',{hash:target.hash,origUrl:oldUrl,newUrl}));
  assert.equal(response.status,200,'tracker edit must exist at WebAPI 2.2.1');
  assert.equal(target.trackers[0].url,newUrl,'tracker edit must mutate persistent virtual tracker state');
  response=await handleApi(w,formRequest('rss/addFeed',{url:'https://feed.example.invalid/rss',path:''}));
  assert.equal(response.status,200);
  const items=await (await handleApi(w,getRequest('rss/items?withData=true'))).json();
  const key=Object.keys(items)[0];assert.ok(key);
  response=await handleApi(w,formRequest('rss/refreshItem',{itemPath:key}));
  assert.equal(response.status,200,'RSS refresh must exist at WebAPI 2.2.1');
  response=await handleApi(w,formRequest('torrents/addPeers',{hashes:target.hash,peers:'203.0.113.41:51413'}));
  assert.equal(response.status,404,'addPeers must remain unavailable through qB 4.1.9.1 / WebAPI 2.2.1');
  response=await handleApi(w,getRequest('app/networkInterfaceList'));
  assert.equal(response.status,404,'networkInterfaceList must remain unavailable through qB 4.1.9.1 / WebAPI 2.2.1');
  response=await handleApi(w,getRequest('app/networkInterfaceAddressList?iface=lo'));
  assert.equal(response.status,404,'networkInterfaceAddressList must remain unavailable through qB 4.1.9.1 / WebAPI 2.2.1');
}

{
  const w=world('4.2.0','2.3.0');
  let response=await handleApi(w,getRequest('app/buildInfo'));
  assert.equal(response.status,200,'buildInfo must be available at WebAPI 2.3.0');
  response=await handleApi(w,formRequest('transfer/banPeers',{peers:'10.0.0.8:50008'}));
  assert.equal(response.status,200,'peer ban must be available at WebAPI 2.3.0');
  response=await handleApi(w,getRequest('log/peers?last_known_id=-1'));
  assert.equal(response.status,200);const peerLogs=await response.json();
  assert.ok(peerLogs.some(x=>x.blocked===true&&x.ip==='10.0.0.8'),'peer ban must leave an observable peer-log record');
  response=await handleApi(w,getRequest('torrents/tags'));
  assert.equal(response.status,200,'tags must be available at WebAPI 2.3.0');
  const target=w.torrents[0];
  response=await handleApi(w,formRequest('torrents/addPeers',{hashes:target.hash,peers:'203.0.113.42:51413'}));
  assert.equal(response.status,200,'addPeers must become available at qB 4.2.0 / WebAPI 2.3.0');
  response=await handleApi(w,getRequest('app/networkInterfaceList'));
  assert.equal(response.status,200,'networkInterfaceList must become available at qB 4.2.0 / WebAPI 2.3.0');
  response=await handleApi(w,getRequest('app/networkInterfaceAddressList?iface=lo'));
  assert.equal(response.status,200,'networkInterfaceAddressList must become available at qB 4.2.0 / WebAPI 2.3.0');
}

{
  const before=world('4.2.4','2.5.0');
  let response=await handleApi(before,formRequest('rss/markAsRead',{itemPath:'missing'}));
  assert.equal(response.status,404,'markAsRead must remain unavailable at qB 4.2.4 / WebAPI 2.5.0');
  response=await handleApi(before,getRequest('rss/matchingArticles?ruleName=missing'));
  assert.equal(response.status,404,'matchingArticles must remain unavailable at qB 4.2.4 / WebAPI 2.5.0');

  const atBoundary=world('4.2.5','2.5.1');
  response=await handleApi(atBoundary,formRequest('rss/markAsRead',{itemPath:'missing'}));
  assert.equal(response.status,200,'markAsRead must become routable at qB 4.2.5 / WebAPI 2.5.1');
  response=await handleApi(atBoundary,getRequest('rss/matchingArticles?ruleName=missing'));
  assert.equal(response.status,200,'matchingArticles must become routable at qB 4.2.5 / WebAPI 2.5.1');
}

{
  const before=world('4.4.5','2.8.5');
  let response=await handleApi(before,formRequest('transfer/setSpeedLimitsMode',{mode:'1'}));
  assert.equal(response.status,404,'setSpeedLimitsMode must remain unavailable at qB 4.4.5 / WebAPI 2.8.5');

  const atBoundary=world('4.5.0','2.8.18');
  response=await handleApi(atBoundary,formRequest('transfer/setSpeedLimitsMode',{mode:'1'}));
  assert.equal(response.status,200,'setSpeedLimitsMode must become available at qB 4.5.0 / WebAPI 2.8.18');
}

{
  const before=world('4.5.5','2.8.19');
  let response=await handleApi(before,formRequest('rss/setFeedURL',{path:'Boundary',url:'https://mirror.example.invalid/feed.xml'}));
  assert.equal(response.status,404,'setFeedURL must remain unavailable at qB 4.5.5 / WebAPI 2.8.19');

  const atBoundary=world('4.6.0','2.9.2');
  response=await handleApi(atBoundary,formRequest('rss/addFeed',{url:'https://feed.example.invalid/boundary.xml',path:'Boundary'}));
  assert.equal(response.status,200);
  response=await handleApi(atBoundary,formRequest('rss/setFeedURL',{path:'Boundary',url:'https://mirror.example.invalid/boundary.xml'}));
  assert.equal(response.status,200,'setFeedURL must become available at qB 4.6.0 / WebAPI 2.9.2');
}

{
  const before=world('4.6.7','2.9.3');
  let response=await handleApi(before,formRequest('search/downloadTorrent',{}));
  assert.equal(response.status,404,'search/downloadTorrent must remain unavailable through qB 4.6.7 / WebAPI 2.9.3');

  const atBoundary=world('5.0.0','2.11.2');
  response=await handleApi(atBoundary,formRequest('search/downloadTorrent',{}));
  assert.equal(response.status,400,'search/downloadTorrent must become routable at qB 5.0.0 / WebAPI 2.11.2');
}

{
  const before=world('5.1.4','2.11.4');
  let response=await handleApi(before,formRequest('rss/setFeedRefreshInterval',{path:'Boundary',refreshInterval:'60'}));
  assert.equal(response.status,404,'setFeedRefreshInterval must remain unavailable through qB 5.1.4 / WebAPI 2.11.4');

  const atBoundary=world('5.2.0','2.15.1');
  response=await handleApi(atBoundary,formRequest('rss/addFeed',{url:'https://feed.example.invalid/refresh.xml',path:'Boundary'}));
  assert.equal(response.status,200);
  response=await handleApi(atBoundary,formRequest('rss/setFeedRefreshInterval',{path:'Boundary',refreshInterval:'60'}));
  assert.equal(response.status,200,'setFeedRefreshInterval must become available at qB 5.2.0 / WebAPI 2.15.1');
}

{
  const w=world('5.2.3','2.15.1');
  const publicTorrent=w.torrents.find(t=>!t.private),privateTorrent=w.torrents.find(t=>t.private);
  assert.ok(publicTorrent&&privateTorrent,'service contract needs public and private torrents');
  let response=await handleApi(w,getRequest(`torrents/webseeds?hash=${encodeURIComponent(publicTorrent.hash)}`));
  const publicWebseeds=await response.json();assert.ok(publicWebseeds.length>=1,'public torrent must expose deterministic virtual web seeds');
  response=await handleApi(w,getRequest(`torrents/webseeds?hash=${encodeURIComponent(privateTorrent.hash)}`));
  assert.deepEqual(await response.json(),[],'private/PT torrent must not fabricate public web seeds');

  const before=w.torrents.length;
  response=await handleApi(w,formRequest('rss/setRule',{ruleName:'Auto Add',ruleDef:JSON.stringify({enabled:true,mustContain:'Virtual update',tags:['rss-auto'],assignedCategory:'Linux'})}));
  assert.equal(response.status,200,'RSS rule must be writable');
  response=await handleApi(w,formRequest('rss/addFeed',{url:'https://auto.example.invalid/releases.xml',path:''}));
  assert.equal(response.status,200);
  const items=await (await handleApi(w,getRequest('rss/items?withData=true'))).json();
  const feedKey=Object.keys(items)[0];assert.ok(feedKey);
  response=await handleApi(w,formRequest('rss/refreshItem',{itemPath:feedKey}));
  assert.equal(response.status,200);
  assert.equal(w.torrents.length,before+1,'matching RSS rule must create a real Virtual Torrent entity');
  const rssAdded=w.torrents.at(-1);assert.ok(rssAdded.tags.includes('rss-auto'));assert.equal(rssAdded.category,'Linux');
  const rules=await (await handleApi(w,getRequest('rss/rules'))).json();
  assert.equal(rules['Auto Add'].lastMatch,rssAdded.name,'RSS rule must persist its last match');

  response=await handleApi(w,formRequest('search/start',{pattern:'Debian ISO',plugins:'enabled',category:'all'}));
  const searchJob=await response.json();assert.ok(searchJob.id>0);
  response=await handleApi(w,getRequest(`search/results?id=${searchJob.id}&limit=20&offset=0`));
  const search=await response.json();assert.ok(search.results.length>=6,'Search must expose deterministic partial results');

  response=await handleApi(w,formRequest('torrentcreator/addTask',{sourcePath:'/virtual/source'}));
  const creator=await response.json();assert.ok(creator.taskID);
  w.creatorTasks[creator.taskID].createdAt-=5000;
  response=await handleApi(w,getRequest(`torrentcreator/status?taskID=${encodeURIComponent(creator.taskID)}`));
  const status=await response.json();assert.equal(status.status,'Finished');
  response=await handleApi(w,getRequest(`torrentcreator/torrentFile?taskID=${encodeURIComponent(creator.taskID)}`));
  assert.equal(response.status,200);assert.ok((await response.blob()).size>0,'finished creator task must return a non-empty virtual torrent blob');

  response=await handleApi(w,getRequest('virtual/unknown-endpoint'));
  assert.equal(response.status,501,'unimplemented API must fail closed');
}

{
  const w=world('5.2.3','2.15.1');
  let response=await handleApi(w,formRequest('rss/addFolder',{path:'Linux'}));assert.equal(response.status,200);
  response=await handleApi(w,formRequest('rss/addFeed',{url:'https://feed.example.invalid/releases.xml',path:'Linux/Releases',refreshInterval:'1800'}));assert.equal(response.status,200);
  response=await handleApi(w,formRequest('rss/setFeedURL',{path:'Linux/Releases',url:'https://mirror.example.invalid/releases.xml'}));assert.equal(response.status,200);
  response=await handleApi(w,formRequest('rss/setFeedRefreshInterval',{path:'Linux/Releases',refreshInterval:'900'}));assert.equal(response.status,200);
  let items=await (await handleApi(w,getRequest('rss/items?withData=true'))).json();
  assert.equal(items['Linux/Releases'].url,'https://mirror.example.invalid/releases.xml');assert.equal(items['Linux/Releases'].refreshInterval,900);
  const articleId=items['Linux/Releases'].articles[0].id;
  response=await handleApi(w,formRequest('rss/markAsRead',{itemPath:'Linux/Releases',articleId}));assert.equal(response.status,200);
  items=await (await handleApi(w,getRequest('rss/items?withData=true'))).json();assert.equal(items['Linux/Releases'].articles[0].isRead,true);
  response=await handleApi(w,formRequest('rss/addFolder',{path:'Archive'}));assert.equal(response.status,200);
  response=await handleApi(w,formRequest('rss/moveItem',{itemPath:'Linux/Releases',destPath:'Archive'}));assert.equal(response.status,200);
  items=await (await handleApi(w,getRequest('rss/items?withData=true'))).json();assert.ok(items['Archive/Releases']);
  response=await handleApi(w,formRequest('rss/setRule',{ruleName:'Archive Rule',ruleDef:JSON.stringify({enabled:true,mustContain:'Virtual release',affectedFeeds:['Archive/Releases']})}));assert.equal(response.status,200);
  response=await handleApi(w,getRequest(`rss/matchingArticles?ruleName=${encodeURIComponent('Archive Rule')}`));assert.equal(response.status,200);
  const matches=await response.json();assert.ok(Object.values(matches).flat().some(title=>title.includes('Virtual release')),'matchingArticles must project current rule matches');

  response=await handleApi(w,getRequest('search/plugins'));assert.equal(response.status,200);let plugins=await response.json();assert.ok(plugins.some(x=>x.name==='virtual'));
  response=await handleApi(w,formRequest('search/installPlugin',{sources:'https://plugins.example.invalid/extra.py'}));assert.equal(response.status,200);
  plugins=await (await handleApi(w,getRequest('search/plugins'))).json();assert.ok(plugins.some(x=>x.name==='extra'));
  response=await handleApi(w,formRequest('search/enablePlugin',{names:'extra',enable:'false'}));assert.equal(response.status,200);
  plugins=await (await handleApi(w,getRequest('search/plugins'))).json();assert.equal(plugins.find(x=>x.name==='extra').enabled,false);
  const oldVersion=plugins.find(x=>x.name==='extra').version;
  response=await handleApi(w,formRequest('search/updatePlugins',{}));assert.equal(response.status,200);
  plugins=await (await handleApi(w,getRequest('search/plugins'))).json();assert.notEqual(plugins.find(x=>x.name==='extra').version,oldVersion);

  response=await handleApi(w,formRequest('search/start',{pattern:'Virtual Linux',plugins:'virtual',category:'all'}));const job=await response.json();
  const results=await (await handleApi(w,getRequest(`search/results?id=${job.id}&limit=5&offset=0`))).json();assert.ok(results.results[0].engineName);assert.ok(Number.isInteger(results.results[0].pubDate));
  const countBefore=w.torrents.length;
  response=await handleApi(w,formRequest('search/downloadTorrent',{torrentUrl:results.results[0].fileUrl,pluginName:'virtual'}));assert.equal(response.status,200);assert.equal(w.torrents.length,countBefore+1,'search download must add a real Virtual Torrent');
  response=await handleApi(w,formRequest('search/delete',{id:String(job.id)}));assert.equal(response.status,200);assert.equal(w.searchJobs[job.id],undefined);
  response=await handleApi(w,formRequest('search/uninstallPlugin',{names:'extra'}));assert.equal(response.status,200);
  plugins=await (await handleApi(w,getRequest('search/plugins'))).json();assert.ok(!plugins.some(x=>x.name==='extra'));
}

{
  const w=world('5.9.9','2.99.0',{preferenceKeys:['max_active_downloads','future_setting']});
  w.preferences.future_setting=42;
  const response=await handleApi(w,getRequest('app/preferences'));
  const prefs=await response.json();
  assert.deepEqual(Object.keys(prefs).sort(),['future_setting','max_active_downloads'],'generated upstream preference keys must constrain the profile response without being discarded');
  assert.equal(prefs.future_setting,42);
}

{
  const w=world('4.6.7','2.10.4');
  const response=await handleApi(w,formRequest('torrentcreator/addTask',{sourcePath:'/virtual/source'}));
  assert.equal(response.status,404,'qB4 must not expose qB5 Torrent Creator even if other APIs are modern');
}

console.log('Virtual qB services contract passed: source-derived historical action boundaries, WebSeeds, peer logs, full stateful RSS management, Search plugin/download management, Torrent Creator, future preference manifests and fail-closed endpoints.');
