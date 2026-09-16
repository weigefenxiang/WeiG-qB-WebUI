import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {compileQbPreferencesCompact,expandQbPreferencesCompact} from '../tools/qb-preferences-compact.mjs';
import {assertCatalogIdentity,catalogIdentity} from '../tools/qb-catalog-identity.mjs';
import {buildQbPreferencesCensus} from '../tools/qb-preferences-census-source.mjs';

const sourcePath=path.resolve(process.argv[2]||'qb-preferences-source-catalog.json');
const catalogPath=path.resolve(process.argv[3]||'qb-releases.json');
const qbRoot=path.resolve(process.argv[4]||process.env.QB_UPSTREAM_DIR||'upstream-qb');
assert.ok(fs.existsSync(sourcePath),`missing Preferences source catalog: ${sourcePath}`);
assert.ok(fs.existsSync(catalogPath),`missing exact qB release catalog: ${catalogPath}`);
assert.ok(fs.existsSync(qbRoot),`missing exact qB upstream checkout for independent Preferences census: ${qbRoot}`);
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8')),catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8')),expectedIdentity=catalogIdentity(catalog);
assert.equal(source.schemaVersion,1);
assert.equal(source.source,'qb-upstream-preferences-native-surface');
assert.ok(Array.isArray(source.profiles)&&source.profiles.length>0);
assert.equal(source.profiles.length,catalog.length,'Preferences source admission must cover every admitted stable qB release');

const census=buildQbPreferencesCensus(catalog,source,qbRoot);
assert.equal(census.schemaVersion,1,'Preferences independent census schema drift');
assert.equal(census.source,'qb-upstream-preferences-independent-census','Preferences independent census source identity drift');
assertCatalogIdentity(census.catalogIdentity,expectedIdentity,'Preferences independent census Frozen catalog identity');
assert.equal(census.profiles.length,source.profiles.length,'Preferences census/source release-set size drift');
fs.writeFileSync(path.resolve(process.env.QB_PREFERENCES_CENSUS_OUTPUT||'qb-preferences-census.json'),JSON.stringify(census,null,2)+'\n','utf8');
function censusProblem(result){
  if(result?.complete)return'';
  const parts=[];
  if(result?.unaccounted?.length)parts.push(`unaccounted=${result.unaccounted.join(',')}`);
  if(result?.overlap?.length)parts.push(`mapped/excluded overlap=${result.overlap.join(',')}`);
  if(result?.escaped?.length)parts.push(`escaped=${result.escaped.join(',')}`);
  for(const kind of ['inventory','mapped','excluded'])if(result?.duplicates?.[kind]?.length)parts.push(`duplicate ${kind}=${result.duplicates[kind].join(',')}`);
  return parts.join('; ')||'unknown accounting failure';
}
const censusFailures=[];
for(let i=0;i<census.profiles.length;i++){
  const profile=census.profiles[i],semantic=source.profiles[i];
  assert.equal(profile.qbVersion,semantic.qbVersion,`${semantic.qbVersion}: independent census release order drift`);
  assert.equal(profile.sourceSha,semantic.sourceSha,`${semantic.qbVersion}: independent census source SHA drift`);
  for(const domain of ['tabs','preferences','bindings']){
    const result=profile.census?.[domain];
    if(!result?.complete)censusFailures.push(`${profile.qbVersion} ${domain}: ${censusProblem(result)}`);
  }
}
assert.equal(censusFailures.length,0,`Preferences independent source census is incomplete across the Frozen release set:\n${censusFailures.join('\n')}`);

let previousRatio=null,minimumRatio=1,scaleProjectionCount=0,switchProjectionCount=0,unprovenProjectionCount=0;
for(let i=0;i<catalog.length;i++){
  const base=catalog[i],profile=source.profiles[i];
  assert.equal(profile.qbVersion,base.qbVersion,`${base.qbVersion}: release order drift`);
  assert.equal(profile.sourceSha,base.sourceSha,`${base.qbVersion}: source SHA drift`);
  assert.match(String(profile.sourceSha||''),/^[0-9a-f]{40}$/i,`${base.qbVersion}: exact source SHA missing`);
  const manifest=profile.manifest||{};
  assert.ok(Array.isArray(manifest.tabs)&&manifest.tabs.length>0,`${base.qbVersion}: native Settings tabs unresolved`);
  assert.ok(manifest.preferences&&typeof manifest.preferences==='object',`${base.qbVersion}: native preference map unresolved`);
  assert.ok(Number(manifest.mappedPreferences)>0,`${base.qbVersion}: no source-mapped native preferences`);
  assert.equal(Number(manifest.totalPreferences),Array.isArray(base.preferenceDescriptors)?base.preferenceDescriptors.length:0,`${base.qbVersion}: preference surface size drift`);
  const total=Number(manifest.totalPreferences)||0,mapped=Number(manifest.mappedPreferences)||0,ratio=total?mapped/total:0;
  assert.ok(ratio>=0.60,`${base.qbVersion}: native Preferences source mapping collapsed to ${mapped}/${total} (${(ratio*100).toFixed(1)}%); source syntax must be admitted before runtime use`);
  if(previousRatio!==null)assert.ok(previousRatio-ratio<=0.20,`${base.qbVersion}: native Preferences mapping dropped ${(100*(previousRatio-ratio)).toFixed(1)} percentage points from the previous stable release`);
  previousRatio=ratio;minimumRatio=Math.min(minimumRatio,ratio);
  const allowed=new Set((base.preferenceDescriptors||[]).map(item=>String(item?.key||'')));
  for(const tab of manifest.tabs){
    assert.equal(typeof tab.id,'string');assert.ok(tab.id);assert.ok(Number.isInteger(tab.order));
    let previous=-1;
    for(const key of tab.preferences||[]){const item=manifest.preferences[key];assert.ok(item,`${base.qbVersion}: tab ${tab.id} references missing ${key}`);assert.ok(allowed.has(key),`${base.qbVersion}: native manifest escaped app/preferences: ${key}`);assert.equal(item.tab,tab.id);assert.ok(item.order>previous,`${base.qbVersion}: ${tab.id} preference order is not source monotonic`);previous=item.order;assert.ok(item.title?.source&&item.title?.context,`${base.qbVersion}: ${key} lacks source/context title identity`);assert.ok(item.control?.id&&item.control?.semantic,`${base.qbVersion}: ${key} lacks native control semantics`);assert.ok(item.descriptor&&Object.prototype.hasOwnProperty.call(item.descriptor,'writable'),`${base.qbVersion}: ${key} lacks API read/write provenance`);assert.ok(item.projection&&typeof item.projection==='object'&&typeof item.projection.safeWrite==='boolean',`${base.qbVersion}: ${key} lacks source value-projection accounting`);if(item.projection.kind==='scale')scaleProjectionCount+=1;else if(item.projection.kind==='switch-map')switchProjectionCount+=1;else if(item.projection.kind==='unproven')unprovenProjectionCount+=1;if(item.control.semantic==='select')for(const option of item.control.options||[])assert.ok(option.label&&(option.label.source||Object.prototype.hasOwnProperty.call(option.label,'literal')),`${base.qbVersion}: ${key} select option lacks source identity`);}
  }
}
assert.ok(scaleProjectionCount>0,'Frozen Preferences source must prove at least one native raw/UI numeric scale instead of relying on manual runtime metadata');
assert.ok(switchProjectionCount>0,'Frozen Preferences source must retain at least one historical switch-map composite projection');
const latestManifest=source.profiles.at(-1).manifest;
assert.deepEqual(latestManifest.preferences.dl_limit?.projection,{kind:'scale',scale:1024,safeWrite:true},'latest native download limit must source-prove bytes/s ↔ KiB/s projection');
assert.deepEqual(latestManifest.preferences.torrent_file_size_limit?.projection,{kind:'scale',scale:1048576,safeWrite:true},'latest native torrent size limit must source-prove bytes ↔ MiB projection');
assert.equal(source.profiles[0].manifest.preferences.proxy_type?.projection?.kind,'switch-map','oldest admitted proxy type must retain its source composite read map');
assert.equal(source.profiles[0].manifest.preferences.proxy_type?.projection?.safeWrite,false,'historical proxy composite write must remain fail-closed until an inverse is source-proven');
const compact=compileQbPreferencesCompact(source,catalog),packed=JSON.stringify(compact),bytes=Buffer.byteLength(packed);
assert.equal(compact.schemaVersion,2,'compact Preferences IR must use the keyed source-native schema');
assertCatalogIdentity(compact.catalogIdentity,expectedIdentity,'Preferences compact Frozen catalog identity');
assert.equal(compact.releases.length,catalog.length,'compact Preferences release identity must remain exact');
assert.ok(compact.tabs.length>0&&compact.tabs.length<=catalog.length,'compact Preferences tab change-point count is invalid');
assert.equal(compact.format.preference.at(-1),'projection','compact Preferences format must expose value projection as a first-class source fact');
assert.ok(bytes<512*1024,`compact Preferences runtime IR is ${bytes} bytes; whole-manifest duplication or another size regression reappeared`);
assert.equal(compact.releases.at(-1)[0],catalog.at(-1).qbVersion);
assert.equal(compact.releases.at(-1)[1],catalog.at(-1).sourceSha);
for(const profile of source.profiles){
  const expanded=expandQbPreferencesCompact(compact,profile.qbVersion),manifest=profile.manifest;
  assert.deepEqual(expanded.tabs.map(tab=>tab.id),manifest.tabs.map(tab=>tab.id),`${profile.qbVersion}: compact native tab order is not lossless`);
  assert.equal(Object.keys(expanded.preferences).length,Object.keys(manifest.preferences).length,`${profile.qbVersion}: compact mapped Preference count is not lossless`);
  for(const [key,item] of Object.entries(manifest.preferences)){
    const actual=expanded.preferences[key];assert.ok(actual,`${profile.qbVersion}: compact IR lost ${key}`);
    assert.equal(actual.tab,item.tab,`${profile.qbVersion}: ${key} tab drift`);assert.equal(actual.sectionId,item.sectionId,`${profile.qbVersion}: ${key} section drift`);assert.equal(actual.order,item.order,`${profile.qbVersion}: ${key} order drift`);assert.equal(actual.control.id,item.control.id,`${profile.qbVersion}: ${key} control id drift`);assert.equal(actual.control.semantic,item.control.semantic,`${profile.qbVersion}: ${key} control semantic drift`);assert.deepEqual(actual.control.attributes,item.control.attributes||{},`${profile.qbVersion}: ${key} control attributes drift`);assert.equal(actual.title?.source,item.title?.source,`${profile.qbVersion}: ${key} source title drift`);assert.equal(actual.title?.context,item.title?.context,`${profile.qbVersion}: ${key} source title context drift`);assert.deepEqual(actual.descriptor,item.descriptor,`${profile.qbVersion}: ${key} API descriptor drift`);assert.deepEqual(actual.projection,item.projection,`${profile.qbVersion}: ${key} source value projection drift`);
  }
}
console.log(`Full stable qB Preferences source contract passed: ${catalog.length} exact releases, independent census complete, Frozen catalog ${expectedIdentity.releaseSetSha256.slice(0,12)}, ${(minimumRatio*100).toFixed(1)}% minimum native mapping, ${scaleProjectionCount} scale / ${switchProjectionCount} switch / ${unprovenProjectionCount} unproven value projections, ${bytes} byte keyed compact IR, and lossless tab/section/control/API/value provenance.`);
