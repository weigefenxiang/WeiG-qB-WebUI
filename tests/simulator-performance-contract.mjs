import assert from 'node:assert/strict';
import {authenticate,createWorld} from '../simulator/core/engine.js';
import {handleApi,simulatorApiCacheStats} from '../simulator/protocol/router.js';

const baseNow=1700000000000;
function authenticatedWorld(profile,count=5000,seed='performance-contract'){
  const world=createWorld({profile,count,seed,now:baseNow});
  authenticate(world,'demo','demo',baseNow);
  return world;
}

const profile={qbVersion:'5.2.3',webApiVersion:'2.15.1',stable:true};
const world=authenticatedWorld(profile);
const started=Date.now();
const hashes=new Set();
for(let offset=0;offset<5000;offset+=200){
  const url=`https://example.invalid/api/v2/torrents/info?sort=added_on&reverse=true&limit=200&offset=${offset}`;
  const response=await handleApi(world,new Request(url));
  assert.equal(response.status,200,`catalog page at offset ${offset} must succeed`);
  const rows=await response.json();
  assert.equal(rows.length,200,`catalog page at offset ${offset} must contain 200 torrents`);
  for(const row of rows)hashes.add(row.hash);
}

const elapsedMs=Date.now()-started;
const stats=simulatorApiCacheStats(world);
assert.equal(hashes.size,5000,'paged catalog scan must expose every torrent exactly once');
assert.equal(stats.cached,true,'full torrent projection must remain cached during a catalog scan');
assert.equal(stats.rows,5000,'cached projection must contain the complete virtual library');
assert.ok(stats.hits>=20,`catalog pagination should reuse the projection cache; observed ${stats.hits} cache hits`);
assert.equal(stats.snapshot.index.indexedRows,5000,'share-limit enrichment must reuse the shared 5000-row runtime membership index');
assert.ok(stats.snapshot.index.indexHits>=0,'runtime membership diagnostics must remain available through Router cache stats');

const last3=await handleApi(world,new Request('https://example.invalid/api/v2/torrents/info?sort=added_on&reverse=true&limit=3&offset=-3'));
assert.equal(last3.status,200);
assert.equal((await last3.json()).length,3,'Router projection cache must preserve negative qB offsets instead of clamping them to zero');

const qB4=authenticatedWorld({qbVersion:'4.6.7',webApiVersion:'2.10.4',stable:true},20,'router-window-qb4');
const qB4All=await (await handleApi(qB4,new Request('https://example.invalid/api/v2/torrents/info?sort=added_on'))).json();
const qB4Overflow=await (await handleApi(qB4,new Request('https://example.invalid/api/v2/torrents/info?sort=added_on&limit=2&offset=999'))).json();
assert.deepEqual(qB4Overflow.map(row=>row.hash),qB4All.slice(0,2).map(row=>row.hash),'qB4 cached Router slicing must preserve historical out-of-range offset reset-to-zero behavior');

const qB5Small=authenticatedWorld({qbVersion:'5.2.3',webApiVersion:'2.15.1',stable:true},20,'router-window-qb5');
const qB5Overflow=await (await handleApi(qB5Small,new Request('https://example.invalid/api/v2/torrents/info?sort=added_on&limit=2&offset=999'))).json();
assert.deepEqual(qB5Overflow,[],'qB5 cached Router slicing must preserve QList out-of-range empty behavior');

const mutation=new Request('https://example.invalid/api/v2/transfer/setDownloadLimit',{
  method:'POST',
  headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({limit:String(140*1024*1024)})
});
const mutationResponse=await handleApi(world,mutation);
assert.equal(mutationResponse.status,200,'write request must succeed');
assert.equal(simulatorApiCacheStats(world).cached,false,'write requests must invalidate torrent projection caches immediately');

const fresh=await handleApi(world,new Request('https://example.invalid/api/v2/torrents/info?sort=added_on&reverse=true&limit=50&offset=0'));
assert.equal(fresh.status,200);
assert.equal((await fresh.json()).length,50);
const rebuilt=simulatorApiCacheStats(world);
assert.equal(rebuilt.cached,true,'first read after a mutation must rebuild the projection cache');
assert.equal(rebuilt.hits,0,'rebuilt projection must not report a stale cache hit');

console.log(`Virtual qB performance contract passed: 5000 torrents paged through one reusable projection (${stats.hits} hits, ${elapsedMs} ms), Router slicing preserves qB4/qB5 window semantics, and shared runtime membership indexes enrich rows without duplicate Maps.`);
