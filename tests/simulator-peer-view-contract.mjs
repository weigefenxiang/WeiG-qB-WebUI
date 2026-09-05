import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authenticate,createWorld,peers as legacyPeers} from '../simulator/core/engine.js';
import {peerViewStats} from '../simulator/core/peer-view.js';
import {runtimeIndexStats} from '../simulator/core/runtime-index.js';
import {webseedList as legacyWebseedList} from '../simulator/core/virtual-services.js';
import {handleApi} from '../simulator/protocol/router.js';

const baseNow=1700000000000;
const world=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.16.2',stable:true},count:5000,seed:'peer-view-contract',now:baseNow});
authenticate(world,'demo','demo',baseNow);
const target=world.torrents[3456];
const url=`https://example.invalid/api/v2/sync/torrentPeers?hash=${target.hash}`;

let response=await handleApi(world,new Request(url));
assert.equal(response.status,200);
let body=await response.json();
assert.equal(body.full_update,true);
assert.equal(body.rid,Number(world.peerRid)||1);
assert.deepEqual(body.peers,legacyPeers(world,target.hash),'indexed peer snapshot must preserve the legacy qB peer payload exactly when no manual/banned peers exist');

let stats=runtimeIndexStats(world);
assert.equal(stats.indexedRows,5000,'first peer detail poll must build the shared 5000-row hash index once');
const firstHits=stats.indexHits;
assert.ok(firstHits>=1,'peer generation plus manual-peer merge must reuse the just-built index within the first poll');
let peerStats=peerViewStats(world);
assert.equal(peerStats.templateBuilds,1,'first peer poll must build one static metadata template set');
assert.equal(peerStats.templateRows,40,'peer metadata cache must stay bounded to the qB response maximum of 40 generated peers');

response=await handleApi(world,new Request(url));
assert.equal(response.status,200);
body=await response.json();
assert.deepEqual(body.peers,legacyPeers(world,target.hash),'repeated peer polls must remain payload-equivalent');
stats=runtimeIndexStats(world);
assert.equal(stats.indexedRows,5000,'repeated peer detail polls must retain the same membership index');
assert.ok(stats.indexHits>=firstHits+2,'second peer poll must use O(1) hash lookups for generated and manual peers instead of rescanning 5000 torrents');
peerStats=peerViewStats(world);
assert.equal(peerStats.templateBuilds,1,'repeated peer polls must not rerun deterministic client/country/progress generation');
assert.ok(peerStats.templateHits>=1,'repeated peer polls must reuse cached static metadata');

target.effectiveDownloadRate+=4096;
target.effectiveUploadRate+=2048;
response=await handleApi(world,new Request(url));
body=await response.json();
const legacyAfterRateChange=legacyPeers(world,target.hash);
assert.deepEqual(body.peers,legacyAfterRateChange,'static peer metadata cache must still project current live transfer speeds');
peerStats=peerViewStats(world);
assert.equal(peerStats.templateBuilds,1,'rate changes must not invalidate static peer identity metadata');

const missing=await handleApi(world,new Request('https://example.invalid/api/v2/sync/torrentPeers?hash=missing'));
assert.equal(missing.status,404,'unknown torrent peer lookup must preserve Not Found behavior');

const publicTorrent=world.torrents.find(t=>!t.private);
const privateTorrent=world.torrents.find(t=>t.private);
assert.ok(publicTorrent&&privateTorrent,'webseed fixture needs both public and private torrents');
const hitsBeforeWebseed=runtimeIndexStats(world).indexHits;
response=await handleApi(world,new Request(`https://example.invalid/api/v2/torrents/webseeds?hash=${publicTorrent.hash}`));
assert.equal(response.status,200);
const webseeds=await response.json();
assert.deepEqual(webseeds,legacyWebseedList(world,publicTorrent.hash),'indexed WebSeed GET must preserve lazy-generated legacy payloads');
response=await handleApi(world,new Request(`https://example.invalid/api/v2/torrents/webseeds?hash=${privateTorrent.hash}`));
assert.equal(response.status,200);assert.deepEqual(await response.json(),[],'private torrents must continue exposing no WebSeeds');
response=await handleApi(world,new Request('https://example.invalid/api/v2/torrents/webseeds?hash=missing'));
assert.equal(response.status,200);assert.deepEqual(await response.json(),[],'missing WebSeed hash must preserve historical empty-array behavior');
stats=runtimeIndexStats(world);
assert.ok(stats.indexHits>=hitsBeforeWebseed+3,'WebSeed detail reads must use the existing membership index instead of linear torrent scans');

const auxiliaryRouter=fs.readFileSync(new URL('../simulator/protocol/auxiliary-router.js',import.meta.url),'utf8');
assert.match(auxiliaryRouter,/generatedPeers\(world,hash\)/,'live auxiliary sync/torrentPeers route must use the indexed peer projection');
assert.match(auxiliaryRouter,/indexedWebseedList\(world,url\.searchParams\.get\('hash'\)\|\|''\)/,'live WebSeed GET must use the indexed detail projection');
assert.doesNotMatch(auxiliaryRouter,/import\s*\{\s*peers\s*\}\s*from\s*['"]\.\.\/core\/engine\.js['"]/,'live peer polling must not import the legacy linear-scan engine peer helper');

console.log(`Virtual qB detail-view contract passed: 5000-Torrent peer/WebSeed GETs preserve legacy payloads, reuse one shared membership index (${stats.indexHits} index hits), and peer metadata builds once (${peerStats.templateHits} cache hits).`);
