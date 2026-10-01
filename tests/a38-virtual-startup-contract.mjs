import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildOwnedCopyProfileShard} from '../simulator/build/runtime-shards.mjs';

const registry=fs.readFileSync('webui/private/data/qb-settings-native.txt','utf8');
const catalog=JSON.parse(fs.readFileSync('tests/fixtures/qb-release-catalog.lkg.json','utf8'));
const worker=fs.readFileSync('simulator/service-worker/service-worker.js','utf8');
const build=fs.readFileSync('simulator/build/build-pages.mjs','utf8');

for(const version of ['4.1.0','4.6.7','5.2.3']){
  const profile=catalog.find(item=>String(item.qbVersion)===version);
  assert.ok(profile,version+' fixture profile missing');
  const profileJson=JSON.stringify(profile)+'\n';
  assert.ok(Buffer.byteLength(profileJson,'utf8')<Buffer.byteLength(JSON.stringify(catalog),'utf8')/5,version+' profile catalog shard should be much smaller than the 65-release catalog');
  const shard=buildOwnedCopyProfileShard(registry,version);
  assert.equal((shard.match(/^@@PROFILE\t/gm)||[]).length,1,version+' copy shard must own exactly one profile');
  assert.ok(shard.includes('@@PROFILE\t'+profile.sourceSha+'\t'+version+'\t'),version+' copy shard must preserve exact source identity');
  assert.equal((shard.match(/^@@REF\t/gm)||[]).length,(registry.match(/^@@REF\t/gm)||[]).length,version+' shard must retain the shared qB source-ref vocabulary');
  assert.ok(Buffer.byteLength(shard,'utf8')<Buffer.byteLength(registry,'utf8')*.45,version+' copy shard should remove unrelated profile/bridge payloads');
}
const latestShard=buildOwnedCopyProfileShard(registry,'5.2.3');
assert.ok(Buffer.byteLength(latestShard,'utf8')<2*1024*1024,'latest qB copy shard must stay below 2 MiB');

assert.match(worker,/const STATIC_CACHE=STATIC_CACHE_PREFIX\+WEIG_BUILD_SHA/,'Virtual qB immutable cache must be exact-build keyed.');
assert.match(worker,/immutableFetchUrl[\s\S]*cache\.match\(url\)[\s\S]*cache\.put\(url,response\.clone\(\)\)/,'immutable simulator/source assets must reuse CacheStorage within one exact build.');
assert.match(worker,/loadCatalog\(qbVersion\)[\s\S]*RUNTIME_PROFILE_BASE\+key\+'\.json'[\s\S]*LEGACY_CATALOG_URL/s,'Virtual qB must load the selected profile shard first and retain the full catalog only as a fallback/evidence reader.');
assert.match(worker,/fetchCopyProfileShard\(world\)[\s\S]*RUNTIME_COPY_BASE\+key\+'\.txt'/s,'Virtual qB must substitute the selected qB copy-registry shard for the multi-profile registry.');
assert.match(worker,/prewarmPrivateSource\(world\)[\s\S]*Math\.min\(6,items\.length\)/s,'private bootstrap prewarming must be bounded rather than opening an unbounded request fan-out.');
assert.match(worker,/event\.waitUntil\(responsePromise\.then\(\(\)=>statePromise\)\.then\(\(\{world\}\)=>prewarmPrivateSource\(world\)\)/s,'navigation response and background prewarm must share the same resolved world, while prewarm stays under event.waitUntil instead of blocking response construction.');
assert.ok(build.includes('function bootstrapAssets(html)')&&build.includes("for(const name of ['styles','scripts'])")&&build.includes('new RegExp(`var ${name}='),'prewarm asset inventory must be derived from the canonical private bootstrap arrays rather than duplicated manually.');
assert.match(build,/writeSimulatorRuntimeShards\(\{catalog:simulatorCatalog,registryPath:runtimeRegistryPath/,'Pages build must materialize catalog/copy shards from canonical evidence at build time.');
assert.doesNotMatch(worker,/fetch\(CATALOG_URL/,'normal Virtual qB startup must not directly fetch the full multi-release catalog owner.');

console.log('A38 Virtual startup contract passed: selected-profile catalog/copy shards, exact-SHA immutable caching and canonical-bootstrap prewarming replace full-catalog/full-registry cold-path loading.');
