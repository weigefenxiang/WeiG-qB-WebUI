import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildOwnedCopyProfileShard} from '../simulator/build/runtime-shards.mjs';

const registry=fs.readFileSync('webui/private/data/qb-settings-native.txt','utf8');
const catalog=JSON.parse(fs.readFileSync('tests/fixtures/qb-release-catalog.lkg.json','utf8'));
const worker=fs.readFileSync('simulator/service-worker/service-worker.js','utf8');
const build=fs.readFileSync('simulator/build/build-pages.mjs','utf8');

const tokenOrder=(a,b)=>parseInt(a,36)-parseInt(b,36);
function assertOwnedCopyShardStructure(shard,profile,version){
  const lines=shard.split(/\r?\n/);
  const profileRows=lines.filter(line=>line.startsWith('@@PROFILE\t'));
  assert.equal(profileRows.length,1,version+' copy shard must own exactly one profile');
  const profileFields=profileRows[0].split('\t'),bindingId=profileFields[4];
  assert.equal(profileFields[1],profile.sourceSha,version+' copy shard must preserve exact source identity');

  const bridgeRows=lines.filter(line=>line.startsWith('@@BRIDGE\t')).map(line=>line.split('\t'));
  assert.ok(bridgeRows.every(fields=>fields[1]===profile.sourceSha),version+' copy shard must not retain foreign source bridges');
  const bindingRows=lines.filter(line=>line.startsWith('@@PREF\t')||line.startsWith('@@UI\t')).map(line=>line.split('\t'));
  assert.ok(bindingRows.length>0&&bindingRows.every(fields=>fields[1]===bindingId),version+' copy shard must retain only the selected binding');

  const bridgeSetIds=new Set(bridgeRows.map(fields=>fields[3]).filter(id=>id&&id!=='-'));
  const setRows=new Map(lines.filter(line=>line.startsWith('@@SET\t')).map(line=>{const fields=line.split('\t');return[fields[1],fields];}));
  assert.deepEqual([...setRows.keys()].sort(),[...bridgeSetIds].sort(),version+' copy shard must retain only selected locale-route bridge sets');

  const reachableTokens=new Set();
  for(const [id,fields] of setRows){
    assert.equal(fields[2],'-',version+' selected bridge set '+id+' must be profile-local rather than depend on a foreign delta parent');
    assert.equal(fields[4]||'','',version+' selected bridge set '+id+' must not retain historical delta removals');
    for(const token of String(fields[3]||'').split(',').filter(Boolean))reachableTokens.add(token);
  }

  const valueRows=new Map(lines.filter(line=>line.startsWith('@@VAL\t')).map(line=>{const fields=line.split('\t');return[fields[1],fields];}));
  assert.deepEqual([...valueRows.keys()].sort(tokenOrder),[...reachableTokens].sort(tokenOrder),version+' copy shard must retain exactly the values reachable from selected locale routes');

  const refIds=new Set(lines.filter(line=>line.startsWith('@@REF\t')).map(line=>line.split('\t')[1]));
  assert.equal(refIds.size,(registry.match(/^@@REF\t/gm)||[]).length,version+' shard must retain the shared qB source-ref vocabulary');
  for(const fields of valueRows.values())assert.ok(refIds.has(fields[2]),version+' retained bridge value must resolve through the shared qB source-ref vocabulary');

  assert.ok(Buffer.byteLength(shard,'utf8')<2*1024*1024,version+' selected-profile copy shard must stay below the absolute 2 MiB startup budget');
}

for(const version of ['4.1.0','4.6.7','5.2.3']){
  const profile=catalog.find(item=>String(item.qbVersion)===version);
  assert.ok(profile,version+' fixture profile missing');
  const profileJson=JSON.stringify(profile)+'\n';
  assert.ok(Buffer.byteLength(profileJson,'utf8')<Buffer.byteLength(JSON.stringify(catalog),'utf8')/5,version+' profile catalog shard should be much smaller than the 65-release catalog');
  const shard=buildOwnedCopyProfileShard(registry,version);
  assertOwnedCopyShardStructure(shard,profile,version);
}
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
