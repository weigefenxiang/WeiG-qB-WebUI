import assert from 'node:assert/strict';
import fs from 'node:fs';

const [catalogPath,registryPath]=process.argv.slice(2);
if(!catalogPath||!registryPath)throw new Error('Usage: node tests/qb-runtime-copy-materialization-contract.mjs <source-catalog-or-settings-lkg.json> <qb-settings-native.txt>');
const source=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const catalog=Array.isArray(source)?source:(Array.isArray(source?.profiles)?source.profiles:null);
if(!catalog||!catalog.length)throw new Error('Runtime copy materialization contract requires a non-empty exact-source profile set.');
const registry=fs.readFileSync(registryPath,'utf8');
const decode=value=>{try{return decodeURIComponent(String(value||''));}catch{return String(value||'');}};
const refs=new Map();
for(const match of registry.matchAll(/^@@REF\t([0-9a-f]{24})\t([^\t\r\n]*)\t([^\t\r\n]*)$/gm))refs.set(match[1],{context:decode(match[2]),source:decode(match[3])});
const profiles=new Map();
for(const match of registry.matchAll(/^@@PROFILE\t([0-9a-f]{40})\t([^\t\r\n]*)\t[^\t\r\n]*\t(b[0-9a-f]{20})\t/gm))profiles.set(match[1],{version:decode(match[2]),binding:match[3]});
const uiByBinding=new Map();
for(const match of registry.matchAll(/^@@UI\t(b[0-9a-f]{20})\t([^\t\r\n]*)\t([0-9a-f]{24})$/gm)){const rows=uiByBinding.get(match[1])||new Map();rows.set(decode(match[2]),match[3]);uiByBinding.set(match[1],rows);}

function validRef(ref){return !!(ref&&String(ref.source||'').trim()&&String(ref.context||'').trim());}
function refValue(ref){return{source:String(ref.source),context:String(ref.context)};}
function remember(map,key,ref,version){
  if(!key||!validRef(ref))return;
  const next=refValue(ref),prior=map.get(key);
  if(prior)assert.deepEqual(next,prior,version+' source UI key '+key+' has conflicting source/context owners');
  else map.set(key,next);
}
function focusedSourceUi(profile,version){
  const expected=new Map();
  for(const item of profile?.torrentVisibleFilters||[])remember(expected,'filter.'+String(item?.name||''),item?.translation,version);
  for(const [kind,rows] of Object.entries(profile?.facetSpecialRows||{}))for(const [id,ref] of Object.entries(rows||{}))remember(expected,'facet.'+kind+'.'+id,ref,version);
  for(const [surface,columns] of Object.entries(profile?.torrentDetailUi?.tables||{}))for(const column of columns||[]){
    const base='detail.'+surface+'.'+String(column?.key||'');
    remember(expected,base,column?.translation,version);
    remember(expected,base+'.sentinel.negative',column?.notApplicableWhenNegative?.translation,version);
    const presentation=column?.valuePresentation;
    if(presentation?.kind==='translated-enum'){
      for(const [value,ref] of Object.entries(presentation.values||{}))remember(expected,base+'.value.'+value,ref,version);
      for(let i=0;i<(presentation.overrides||[]).length;i++)remember(expected,base+'.override.'+i,presentation.overrides[i]?.translation,version);
    }
  }
  const statistics=profile?.statisticsUi;
  remember(expected,'statistics.title',statistics?.title,version);
  for(const group of statistics?.groups||[]){
    remember(expected,'statistics.group.'+String(group?.key||''),group?.translation,version);
    for(const field of group?.fields||[])remember(expected,'statistics.field.'+String(field?.id||''),field?.translation,version);
  }
  return expected;
}
function sourceOwnedUi(profile,version){
  const raw=profile?.qbOwnedUi&&typeof profile.qbOwnedUi==='object'?profile.qbOwnedUi:(profile?.ui&&typeof profile.ui==='object'?profile.ui:null);
  if(!raw)return null;
  const expected=new Map();
  for(const [key,ref] of Object.entries(raw))remember(expected,key,ref,version);
  return expected;
}
function assertUiRef(version,ui,key,expected){
  const id=ui.get(key);
  assert.ok(id,version+' generated copy registry is missing '+key);
  assert.deepEqual(refs.get(id),expected,version+' generated copy ref disagrees with exact source/context for '+key);
}

let priorityProfiles=0,priorityBindings=0,routeBindings=0,routeExpected=0,exactOwnedUiProfiles=0,focusedProfiles=0,focusedBindings=0;
for(const profile of catalog){
  const sha=String(profile?.sourceSha||''),version=String(profile?.qbVersion||''),runtime=profiles.get(sha);
  assert.match(sha,/^[0-9a-f]{40}$/,version+' source profile lacks exact source SHA');
  assert.ok(runtime,version+' generated copy registry is missing exact profile '+sha);
  assert.equal(runtime.version,version,sha+' generated copy registry version mismatch');
  const ui=uiByBinding.get(runtime.binding)||new Map();

  const owned=sourceOwnedUi(profile,version);
  if(owned){
    exactOwnedUiProfiles++;
    for(const [key,expected] of owned)assertUiRef(version,ui,key,expected);
    assert.deepEqual([...ui.keys()].sort(),[...owned.keys()].sort(),version+' generated copy registry retained stale or invented qB-owned UI keys');
  }else{
    const focused=focusedSourceUi(profile,version);
    if(focused.size){
      focusedProfiles++;focusedBindings+=focused.size;
      for(const [key,expected] of focused)assertUiRef(version,ui,key,expected);
      const families=key=>key.startsWith('filter.')||key.startsWith('facet.category.')||key.startsWith('facet.tag.')||key.startsWith('detail.trackers.')||key.startsWith('statistics.');
      const stale=[...ui.keys()].filter(key=>families(key)&&!focused.has(key));
      assert.deepEqual(stale,[],version+' generated copy registry retained stale native-presentation keys: '+stale.join(', '));
    }
  }

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
  const routeSource=profile?.qbOwnedUi||profile?.ui||{};
  for(const [key,expected] of Object.entries(routeSource)){
    if(!key.startsWith('route.'))continue;
    routeExpected++;
    const id=ui.get(key);
    assert.ok(id,version+' generated copy registry is missing '+key);
    assert.deepEqual(refs.get(id),expected,version+' generated route ref disagrees with exact qB source/context for '+key);
    routeBindings++;
  }
}
assert.ok(priorityProfiles>0&&priorityBindings>0,'generated runtime copy coherence must cover source-derived Priority profiles');
if(routeExpected)assert.equal(routeBindings,routeExpected,'generated runtime copy coherence must cover every source-derived qB route ref');
assert.ok(exactOwnedUiProfiles>0||focusedProfiles>0,'generated runtime copy coherence requires exact owned-UI evidence or focused native-presentation source facts');
if(!exactOwnedUiProfiles)assert.ok(focusedBindings>0,'focused native-presentation copy coherence must cover source-derived bindings');
console.log('qB runtime copy materialization contract passed: exact-profile registry bindings match current source-owned UI, Detail Priority, native presentation and route refs with no stale same-family keys.');
