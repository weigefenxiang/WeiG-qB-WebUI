import assert from 'node:assert/strict';
import fs from 'node:fs';

const [catalogPath,registryPath]=process.argv.slice(2);
if(!catalogPath||!registryPath)throw new Error('Usage: node tests/qb-runtime-copy-materialization-contract.mjs <enriched-catalog.json> <qb-settings-native.txt>');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const registry=fs.readFileSync(registryPath,'utf8');
const decode=value=>{try{return decodeURIComponent(String(value||''));}catch{return String(value||'');}};
const refs=new Map();
for(const match of registry.matchAll(/^@@REF\t([0-9a-f]{24})\t([^\t\r\n]*)\t([^\t\r\n]*)$/gm))refs.set(match[1],{context:decode(match[2]),source:decode(match[3])});
const profiles=new Map();
for(const match of registry.matchAll(/^@@PROFILE\t([0-9a-f]{40})\t([^\t\r\n]*)\t[^\t\r\n]*\t(b[0-9a-f]{20})\t/gm))profiles.set(match[1],{version:decode(match[2]),binding:match[3]});
const uiByBinding=new Map();
for(const match of registry.matchAll(/^@@UI\t(b[0-9a-f]{20})\t([^\t\r\n]*)\t([0-9a-f]{24})$/gm)){const rows=uiByBinding.get(match[1])||new Map();rows.set(decode(match[2]),match[3]);uiByBinding.set(match[1],rows);}
let priorityProfiles=0,priorityBindings=0,routeBindings=0;
for(const profile of catalog){
  const sha=String(profile?.sourceSha||''),version=String(profile?.qbVersion||''),runtime=profiles.get(sha);
  assert.ok(runtime,version+' generated copy registry is missing exact profile '+sha);
  assert.equal(runtime.version,version,sha+' generated copy registry version mismatch');
  const ui=uiByBinding.get(runtime.binding)||new Map();
  const options=profile?.torrentDetailUi?.controls?.filePriority?.options||[];
  if(options.length){
    priorityProfiles++;
    for(const option of options){
      const key='detail.control.filePriority.'+String(option.value),id=ui.get(key);
      assert.ok(id,version+' generated copy registry is missing '+key);
      assert.deepEqual(refs.get(id),option.translation,version+' generated Priority ref disagrees with exact source/context for '+option.value);
      priorityBindings++;
    }
  }
  for(const [key,expected] of Object.entries(profile?.qbOwnedUi||{})){
    if(!key.startsWith('route.'))continue;
    const id=ui.get(key);
    assert.ok(id,version+' generated copy registry is missing '+key);
    assert.deepEqual(refs.get(id),expected,version+' generated route ref disagrees with exact qB source/context for '+key);
    routeBindings++;
  }
}
assert.ok(priorityProfiles>0&&priorityBindings>0,'generated runtime copy coherence must cover source-derived Priority profiles');
assert.ok(routeBindings>0,'generated runtime copy coherence must cover source-derived qB route copy');
console.log('qB runtime copy materialization contract passed: generated exact-profile bindings retain source-derived Detail Priority and route source/context refs.');
