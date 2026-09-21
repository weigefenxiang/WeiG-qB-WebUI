import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authenticate,createWorld} from '../simulator/core/engine.js';
import {generatedPeers,peerViewStats} from '../simulator/core/peer-view.js';
import {runtimeIndexStats} from '../simulator/core/runtime-index.js';
import {handleApi} from '../simulator/protocol/router.js';

const baseNow=1700000000000;
const world=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1',stable:true},count:5000,seed:'peer-view-contract',now:baseNow});
authenticate(world,'demo','demo',baseNow);
function get(path){return new Request(`https://example.invalid/api/v2/${path}`);}
function post(path,body){return new Request(`https://example.invalid/api/v2/${path}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});}
const target=world.torrents[3456];
const peerPath=`sync/torrentPeers?hash=${target.hash}`;

function peerIdentity(row){
  return{
    client:row.client,country:row.country,country_code:row.country_code,downloaded:row.downloaded,uploaded:row.uploaded,
    progress:row.progress,connection:row.connection,flags:row.flags,flags_desc:row.flags_desc,ip:row.ip,port:row.port,
    relevance:row.relevance,files:row.files
  };
}
function peerIdentityMap(peers){return Object.fromEntries(Object.entries(peers).map(([key,row])=>[key,peerIdentity(row)]));}
function assertGeneratedPeerPayload(peers){
  const entries=Object.entries(peers);
  assert.ok(entries.length>0,'peer contract fixture must expose at least one generated peer');
  for(const [key,row] of entries){
    assert.equal(key,`${row.ip}:${row.port}`,'peer map key must be the qB IP:port identity');
    for(const field of ['client','country','country_code','connection','flags','flags_desc','ip','files'])assert.equal(typeof row[field],'string',`peer ${key} ${field} must be a string`);
    for(const field of ['dl_speed','up_speed','downloaded','uploaded','progress','port','relevance'])assert.ok(Number.isFinite(Number(row[field])),`peer ${key} ${field} must be numeric`);
    assert.ok(Number(row.port)>0&&Number(row.port)<=65535,`peer ${key} port must be valid`);
    assert.ok(Number(row.progress)>=0&&Number(row.progress)<=1,`peer ${key} progress must stay normalized`);
  }
}

let response=await handleApi(world,get(peerPath));
assert.equal(response.status,200);
let body=await response.json();
assert.equal(body.full_update,true,'torrentPeers must be a full qB snapshot');
assert.ok(Number.isInteger(Number(body.rid))&&Number(body.rid)>=1,'torrentPeers rid must be a positive integer');
assertGeneratedPeerPayload(body.peers);
const firstIdentity=peerIdentityMap(body.peers);

let stats=runtimeIndexStats(world);
assert.equal(stats.indexedRows,5000,'first peer detail poll must build the shared 5000-row hash index once');
const firstHits=stats.indexHits;
assert.ok(firstHits>=1,'peer generation plus manual-peer merge must reuse the just-built index within the first poll');
let peerStats=peerViewStats(world);
const initialGeneratedPeers=Object.keys(body.peers).length;
assert.equal(peerStats.templateBuilds,1,'first peer poll must create one static metadata cache entry');
assert.equal(peerStats.templateRows,initialGeneratedPeers,'first peer poll must lazily generate only the peer templates actually returned');
assert.ok(peerStats.templateRows<=40,'peer metadata cache must stay bounded to qB maximum peer projection size');

response=await handleApi(world,get(peerPath));
assert.equal(response.status,200);
body=await response.json();
assert.deepEqual(peerIdentityMap(body.peers),firstIdentity,'repeated peer polls must preserve deterministic static peer identity');
stats=runtimeIndexStats(world);
assert.equal(stats.indexedRows,5000,'repeated peer detail polls must retain the same membership index');
assert.ok(stats.indexHits>=firstHits+2,'second peer poll must use O(1) hash lookups for generated and manual peers instead of rescanning 5000 torrents');
peerStats=peerViewStats(world);
assert.equal(peerStats.templateBuilds,1,'repeated peer polls must not rerun deterministic client/country/progress generation');
assert.equal(peerStats.templateRows,initialGeneratedPeers,'stable peer count must not grow the static metadata cache');
assert.ok(peerStats.templateHits>=1,'repeated peer polls must reuse cached static metadata');

const beforeRatePeers=generatedPeers(world,target.hash),ratePeerKey=Object.keys(beforeRatePeers)[0];
assert.ok(ratePeerKey,'rate projection contract needs a generated peer');
const beforeRateIdentity=peerIdentityMap(beforeRatePeers);
const peerCount=Math.max(1,Object.keys(beforeRatePeers).length);
target.effectiveDownloadRate+=peerCount*4096;
target.effectiveUploadRate+=peerCount*2048;
const afterRatePeers=generatedPeers(world,target.hash);
assert.deepEqual(peerIdentityMap(afterRatePeers),beforeRateIdentity,'rate changes must not alter deterministic peer identity metadata');
assert.notEqual(afterRatePeers[ratePeerKey].dl_speed,beforeRatePeers[ratePeerKey].dl_speed,'peer download rate must project live torrent rate changes');
assert.notEqual(afterRatePeers[ratePeerKey].up_speed,beforeRatePeers[ratePeerKey].up_speed,'peer upload rate must project live torrent rate changes');
peerStats=peerViewStats(world);
assert.equal(peerStats.templateBuilds,1,'rate changes must not invalidate static peer identity metadata');
assert.equal(peerStats.templateRows,initialGeneratedPeers,'rate changes must not expand static peer templates');

const missing=await handleApi(world,get('sync/torrentPeers?hash=missing'));
assert.equal(missing.status,404,'unknown torrent peer lookup must preserve Not Found behavior');

const publicTorrent=world.torrents.find(t=>!t.private);
const privateTorrent=world.torrents.find(t=>t.private);
assert.ok(publicTorrent&&privateTorrent,'webseed fixture needs both public and private torrents');
const publicWebseedPath=`torrents/webseeds?hash=${publicTorrent.hash}`;
const hitsBeforeWebseed=runtimeIndexStats(world).indexHits;
response=await handleApi(world,get(publicWebseedPath));
assert.equal(response.status,200);
const webseeds=await response.json();
assert.ok(webseeds.length>=1&&webseeds.length<=2,'public torrents must expose one or two deterministic WebSeed entries');
for(let i=0;i<webseeds.length;i++){
  assert.equal(webseeds[i].url,`https://cdn${i+1}.example.invalid/${publicTorrent.hash.slice(0,12)}/${encodeURIComponent(publicTorrent.name)}`,'WebSeed URL must be deterministic and tied to torrent identity');
}
response=await handleApi(world,get(publicWebseedPath));
assert.equal(response.status,200);assert.deepEqual(await response.json(),webseeds,'repeated public WebSeed reads must preserve deterministic identity');
response=await handleApi(world,get(`torrents/webseeds?hash=${privateTorrent.hash}`));
assert.equal(response.status,200);assert.deepEqual(await response.json(),[],'private torrents must expose no WebSeeds');
response=await handleApi(world,get('torrents/webseeds?hash=missing'));
assert.equal(response.status,200);assert.deepEqual(await response.json(),[],'missing WebSeed hash must preserve historical empty-array behavior');
stats=runtimeIndexStats(world);
assert.ok(stats.indexHits>=hitsBeforeWebseed+4,'WebSeed detail reads must use the existing membership index instead of linear torrent scans');

const soakIndexHits=stats.indexHits,soakTemplateHits=peerViewStats(world).templateHits,soakTemplateRows=peerViewStats(world).templateRows;
for(let i=0;i<120;i++){
  const peerResponse=await handleApi(world,get(peerPath));
  assert.equal(peerResponse.status,200);await peerResponse.json();
  const webseedResponse=await handleApi(world,get(publicWebseedPath));
  assert.equal(webseedResponse.status,200);await webseedResponse.json();
}
stats=runtimeIndexStats(world);peerStats=peerViewStats(world);
assert.equal(stats.indexedRows,5000,'120 detail polling cycles must retain the same bounded membership index');
assert.ok(stats.indexHits>=soakIndexHits+360,`120 peer/WebSeed cycles must use three O(1) membership lookups per cycle; gained ${stats.indexHits-soakIndexHits} hits`);
assert.equal(peerStats.templateBuilds,1,'120 peer polling cycles must never rebuild deterministic peer identity metadata');
assert.equal(peerStats.templateRows,soakTemplateRows,'stable 120-poll peer count must not allocate additional static templates');
assert.ok(peerStats.templateHits>=soakTemplateHits+120,'every warm peer poll must hit the static metadata cache');

const manualEndpoint='203.0.113.77:51413';
response=await handleApi(world,post('torrents/addPeers',{hashes:target.hash,peers:manualEndpoint}));assert.equal(response.status,200);
response=await handleApi(world,get(peerPath));body=await response.json();
assert.ok(body.peers[manualEndpoint],'manual peer added after static cache warmup must appear immediately');
assert.equal(body.peers[manualEndpoint].ip,'203.0.113.77');
assert.equal(body.peers[manualEndpoint].port,51413);
const ridAfterManual=body.rid;
response=await handleApi(world,post('transfer/banPeers',{peers:manualEndpoint}));assert.equal(response.status,200);
response=await handleApi(world,get(peerPath));body=await response.json();
assert.ok(body.rid>=ridAfterManual,'peer response rid must remain monotonic after dynamic peer mutations');
assert.equal(body.peers[manualEndpoint],undefined,'banned manual peer must disappear immediately without rebuilding static generated-peer metadata');
peerStats=peerViewStats(world);
assert.equal(peerStats.templateBuilds,1,'manual-peer and ban overlays must not rebuild static generated-peer metadata');
assert.ok(peerStats.templateRows<=40,'dynamic peer count growth must lazily expand but never exceed 40 static templates');

const auxiliaryRouter=fs.readFileSync(new URL('../simulator/protocol/auxiliary-router.js',import.meta.url),'utf8');
assert.match(auxiliaryRouter,/generatedPeers\(world,hash\)/,'live auxiliary sync/torrentPeers route must use the indexed peer projection');
assert.match(auxiliaryRouter,/indexedWebseedList\(world,url\.searchParams\.get\('hash'\)\|\|''\)/,'live WebSeed GET must use the indexed detail projection');
assert.doesNotMatch(auxiliaryRouter,/import\s*\{\s*peers\s*\}\s*from\s*['"]\.\.\/core\/engine\.js['"]/,'live peer polling must not import the legacy linear-scan engine peer helper');

console.log(`Virtual qB detail-view contract passed: 120 peer/WebSeed cycles on 5000 Torrents reused one membership index (+${stats.indexHits-soakIndexHits} hits), lazily built peer metadata once (${peerStats.templateRows}/40 templates), and kept manual-peer/ban overlays live.`);
