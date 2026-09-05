import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authenticate,createWorld,peers as legacyPeers} from '../simulator/core/engine.js';
import {runtimeIndexStats} from '../simulator/core/runtime-index.js';
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

response=await handleApi(world,new Request(url));
assert.equal(response.status,200);
body=await response.json();
assert.deepEqual(body.peers,legacyPeers(world,target.hash),'repeated peer polls must remain payload-equivalent');
stats=runtimeIndexStats(world);
assert.equal(stats.indexedRows,5000,'repeated peer detail polls must retain the same membership index');
assert.ok(stats.indexHits>=firstHits+2,'second peer poll must use O(1) hash lookups for generated and manual peers instead of rescanning 5000 torrents');

const missing=await handleApi(world,new Request('https://example.invalid/api/v2/sync/torrentPeers?hash=missing'));
assert.equal(missing.status,404,'unknown torrent peer lookup must preserve Not Found behavior');

const auxiliaryRouter=fs.readFileSync(new URL('../simulator/protocol/auxiliary-router.js',import.meta.url),'utf8');
assert.match(auxiliaryRouter,/generatedPeers\(world,hash\)/,'live auxiliary sync/torrentPeers route must use the indexed peer projection');
assert.doesNotMatch(auxiliaryRouter,/import\s*\{\s*peers\s*\}\s*from\s*['"]\.\.\/core\/engine\.js['"]/,'live peer polling must not import the legacy linear-scan engine peer helper');

console.log(`Virtual qB peer-view contract passed: 5000-Torrent sync/torrentPeers preserves the legacy payload while reusing one shared membership index (${stats.indexHits} index hits).`);
