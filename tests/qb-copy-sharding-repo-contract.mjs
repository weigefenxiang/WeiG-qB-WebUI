import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=path.join(root,'webui/private/data');
const textExt=new Set(['.js','.mjs','.json','.yml','.yaml','.sh','.ps1','.md','.html','.css','.txt']);
const skipped=new Set(['node_modules','.git','artifacts','dist']);
const legacyRegistry=['qb-settings','native.txt'].join('-');

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(skipped.has(entry.name))continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(file));
    else if(entry.isFile())out.push(file);
  }
  return out;
}
function rel(file){return path.relative(root,file).replaceAll('\\','/');}
function filesIn(dir,ext){return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith(ext)).map(x=>x.name).sort();}
function recursiveFiles(dir,ext){return walk(dir).filter(file=>file.endsWith(ext)).sort();}

assert.equal(fs.existsSync(path.join(dataDir,legacyRegistry)),false,'retired all-version qB copy registry must stay absent');
const profiles=filesIn(path.join(dataDir,'qb-copy-profiles'),'.json');
const bindings=filesIn(path.join(dataDir,'qb-copy-bindings'),'.txt');
const fallback4=filesIn(path.join(dataDir,'qb-copy-fallback/4'),'.json');
const fallback5=filesIn(path.join(dataDir,'qb-copy-fallback/5'),'.json');
assert.equal(profiles.length,65,'A62.2 must materialize one exact copy profile for every admitted qB release');
assert.equal(bindings.length,33,'A62.2 binding deduplication count drifted');
assert.equal(fallback4.length,91,'A62.2 qB 4.x locale fallback inventory is incomplete');
assert.equal(fallback5.length,42,'A62.2 qB 5.x locale fallback inventory is incomplete');

for(const name of profiles){
  const sha=name.slice(0,-5),profile=JSON.parse(fs.readFileSync(path.join(dataDir,'qb-copy-profiles',name),'utf8'));
  assert.match(sha,/^[0-9a-f]{40}$/);
  assert.equal(profile.sourceSha,sha);
  assert.equal(profile.schemaVersion,1);
  assert.equal(profile.source,'qB-source-context-runtime-copy-profile');
  assert.match(String(profile.bindingId||''),/^b[0-9a-f]{20}$/);
  assert.ok(fs.existsSync(path.join(dataDir,'qb-copy-bindings',profile.bindingId+'.txt')),'profile points at a missing binding '+profile.bindingId);
}
for(const name of bindings){
  const id=name.slice(0,-4),body=fs.readFileSync(path.join(dataDir,'qb-copy-bindings',name),'utf8');
  assert.match(id,/^b[0-9a-f]{20}$/);
  assert.ok(body.includes('@@BINDING\t'+id));
  assert.equal(body.includes('@@VAL\t'),false);
  assert.equal(body.includes('@@SET\t'),false);
  assert.equal(body.includes('@@BRIDGE\t'),false);
}
for(const major of ['4','5']){
  for(const file of recursiveFiles(path.join(dataDir,'qb-copy-fallback',major),'.json')){
    const group=JSON.parse(fs.readFileSync(file,'utf8')),locale=path.basename(file,'.json');
    assert.equal(group.schemaVersion,2);
    assert.equal(group.source,'qB-exact-official-fallback-pack');
    assert.ok(Array.isArray(group.values),'fallback pack values must be a dense tuple array');
    for(const def of Object.values(group.sets||{}))assert.ok(Array.isArray(def)&&def.length===3,'fallback set delta must use [parent,add,remove] compact form');
    assert.equal(group.major,major);
    assert.equal(group.locale,locale);
    assert.ok(Object.keys(group.sets||{}).length>0,'fallback shard must own at least one exact set: '+rel(file));
  }
}

const allowedLegacy={
  'tools/qb-webui-catalog.mjs':['rmSync'],
  'tools/qb-runtime-copy-product.mjs':['existsSync','rmSync'],
  'tests/qb-runtime-copy-materialization-contract.mjs':['existsSync'],
  'audits/qb-webui-catalog-contract.mjs':['existsSync'],
  'tests/qb-locale-pipeline-contract.mjs':['fs.rmSync','runtimeI18n.includes'],
  'installers/install.ps1':['Test-Path'],
  'installers/install.sh':['! -e'],
  'simulator/build/build-pages.mjs':['exists('],
  'tests/candidate-deployment.sh':['existsSync'],
  'tests/i18n-runtime-owner-contract.mjs':['i18n.includes','fs.rmSync'],
  'tests/installer-lifecycle.ps1':['Test-Path'],
  'tests/installer-lifecycle.sh':['test ! -e','fs.existsSync'],
  'tools/build-webui-dist.mjs':['fs.existsSync','redundantBytes'],
};
const legacyHits=[];
for(const file of walk(root)){
  if(!textExt.has(path.extname(file)))continue;
  const body=fs.readFileSync(file,'utf8');
  if(!body.includes(legacyRegistry))continue;
  const name=rel(file),allowed=allowedLegacy[name];
  if(!allowed){legacyHits.push(name);continue;}
  const lines=body.split(/\r?\n/).filter(line=>line.includes(legacyRegistry));
  for(const line of lines)assert.ok(allowed.some(token=>line.includes(token)),name+' contains a non-retirement use of the legacy qB copy registry: '+line.trim());
}
assert.deepEqual(legacyHits,[],'retired all-version qB copy registry still has active repository callers');

const i18n=fs.readFileSync(path.join(root,'webui/private/scripts/i18n.js'),'utf8');
for(const token of ['data/qb-copy-profiles/','data/qb-copy-bindings/','data/qb-copy-fallback/'])assert.ok(i18n.includes(token),'runtime i18n is missing '+token);
assert.equal(i18n.includes(legacyRegistry),false);

const simulator=fs.readFileSync(path.join(root,'simulator/service-worker/service-worker.js'),'utf8');
assert.equal(simulator.includes('RUNTIME_COPY_BASE'),false,'Virtual qB must not generate or consume a second copy-shard format');
assert.equal(simulator.includes(legacyRegistry),false);

for(const workflow of ['.github/workflows/a62-focused.yml','.github/workflows/ci.yml','.github/workflows/pages-source.yml','.github/workflows/pages.yml']){
  assert.equal(fs.readFileSync(path.join(root,workflow),'utf8').includes(legacyRegistry),false,workflow+' still treats the retired registry as an active workflow asset');
}
const dist=fs.readFileSync(path.join(root,'tools/build-webui-dist.mjs'),'utf8');
assert.ok(dist.includes('schemaVersion:6')&&dist.includes("ownedCopyLayout:'private/data/qb-copy-{profiles,bindings,fallback}'"));
for(const installer of ['installers/install.sh','installers/install.ps1']){
  const body=fs.readFileSync(path.join(root,installer),'utf8');
  for(const dir of ['qb-copy-profiles','qb-copy-bindings','qb-copy-fallback'])assert.ok(body.includes(dir),installer+' must validate '+dir);
}

console.log('A62.7 qB copy sharding repository contract passed: exact profiles/bindings keep provenance while 133 fallback shards use compact tuple packs and no legacy active caller.');
