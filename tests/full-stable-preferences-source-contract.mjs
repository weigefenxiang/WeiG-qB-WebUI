import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {compileQbPreferencesCompact} from '../tools/qb-preferences-compact.mjs';

const sourcePath=path.resolve(process.argv[2]||'qb-preferences-source-catalog.json');
const catalogPath=path.resolve(process.argv[3]||'qb-releases.json');
assert.ok(fs.existsSync(sourcePath),`missing Preferences source catalog: ${sourcePath}`);
assert.ok(fs.existsSync(catalogPath),`missing exact qB release catalog: ${catalogPath}`);
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8')),catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
assert.equal(source.schemaVersion,1);
assert.equal(source.source,'qb-upstream-preferences-native-surface');
assert.ok(Array.isArray(source.profiles)&&source.profiles.length>0);
assert.equal(source.profiles.length,catalog.length,'Preferences source admission must cover every admitted stable qB release');
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
  const allowed=new Set((base.preferenceDescriptors||[]).map(item=>String(item?.key||'')));
  for(const tab of manifest.tabs){
    assert.equal(typeof tab.id,'string');assert.ok(tab.id);assert.ok(Number.isInteger(tab.order));
    let previous=-1;
    for(const key of tab.preferences||[]){const item=manifest.preferences[key];assert.ok(item,`${base.qbVersion}: tab ${tab.id} references missing ${key}`);assert.ok(allowed.has(key),`${base.qbVersion}: native manifest escaped app/preferences: ${key}`);assert.equal(item.tab,tab.id);assert.ok(item.order>previous,`${base.qbVersion}: ${tab.id} preference order is not source monotonic`);previous=item.order;assert.ok(item.title?.source&&item.title?.context,`${base.qbVersion}: ${key} lacks source/context title identity`);assert.ok(item.control?.id&&item.control?.semantic,`${base.qbVersion}: ${key} lacks native control semantics`);assert.ok(item.descriptor&&Object.prototype.hasOwnProperty.call(item.descriptor,'writable'),`${base.qbVersion}: ${key} lacks API read/write provenance`);if(item.control.semantic==='select')for(const option of item.control.options||[])assert.ok(option.label&&(option.label.source||Object.prototype.hasOwnProperty.call(option.label,'literal')),`${base.qbVersion}: ${key} select option lacks source identity`);}
  }
}
const compact=compileQbPreferencesCompact(source);
assert.equal(compact.releases.length,catalog.length,'compact Preferences release identity must remain exact');
assert.ok(compact.nativeUi.length>0&&compact.nativeUi.length<=catalog.length,'compact Preferences change-point count is invalid');
assert.equal(compact.releases.at(-1).qbVersion,catalog.at(-1).qbVersion);
assert.equal(compact.releases.at(-1).sourceSha,catalog.at(-1).sourceSha);
console.log(`Full stable qB Preferences source contract passed: ${catalog.length} exact releases, ${compact.nativeUi.length} compact UI change points, source-native tab/section/control ordering and API provenance verified.`);
