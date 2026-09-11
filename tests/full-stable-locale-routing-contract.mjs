import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {applyLocaleOverlay} from '../tools/qb-locale-overlay.mjs';
import {buildNativeSettingsBundle} from '../tools/qb-settings-native-bundle.mjs';
import {runtimeCatalogData} from '../tools/qb-webui-catalog.mjs';

const catalogPath=new URL('./fixtures/qb-release-catalog.lkg.json',import.meta.url);
const overlayPath=new URL('../tools/data/qb-locale-lkg.json',import.meta.url);
const behaviorPath=new URL('../tools/data/qb-translator-behavior-lkg.json',import.meta.url);
const baseBytes=fs.readFileSync(catalogPath);
const base=JSON.parse(baseBytes.toString('utf8'));
const overlay=JSON.parse(fs.readFileSync(overlayPath,'utf8'));
const behavior=JSON.parse(fs.readFileSync(behaviorPath,'utf8'));
const catalogSha256=crypto.createHash('sha256').update(baseBytes).digest('hex');
const catalog=applyLocaleOverlay(base,overlay,{catalogSha256});
const bundle=buildNativeSettingsBundle(catalog,behavior);
const runtime=runtimeCatalogData(catalog,bundle);

assert.equal(catalog.length,65,'Frozen stable locale matrix must cover all 65 admitted stable releases');
assert.equal(bundle.profiles.length,catalog.length,'Every admitted stable must have translator routing evidence');
assert.equal(runtime.length,catalog.length,'Every admitted stable must enter the runtime catalog');

let nativeRoutes=0,bridgeRoutes=0,disabledFamilyProfiles=0;
for(let index=0;index<catalog.length;index++){
  const source=catalog[index],route=bundle.profiles[index],packed=runtime[index];
  assert.equal(route.qbVersion,source.qbVersion,`${source.qbVersion}: translator profile order drift`);
  assert.equal(route.sourceSha,source.sourceSha,`${source.qbVersion}: translator source SHA drift`);
  const expected=[...new Set((source.webuiLocales||[]).map(item=>String(typeof item==='string'?item:item?.value||'')).filter(Boolean))].sort();
  assert.ok(expected.length>0,`${source.qbVersion}: stable profile has no locale surface`);
  const native=[...new Set(route.nativeLocales||[])].sort();
  const bridge=[...new Set(route.bridgeLocales||[])].sort();
  const overlap=native.filter(locale=>bridge.includes(locale));
  assert.deepEqual(overlap,[],`${source.qbVersion}: locale cannot be both native and bridge routed`);
  assert.deepEqual([...new Set([...native,...bridge])].sort(),expected,`${source.qbVersion}: every official WebUI locale must resolve to native QBT_TR or exact official-TS bridge`);
  assert.deepEqual([...(packed.settingsNativeLocales||[])].sort(),native,`${source.qbVersion}: packed native locale routing drift`);
  assert.deepEqual([...(packed.settingsTranslationLocales||[])].sort(),bridge,`${source.qbVersion}: packed bridge locale routing drift`);
  if(bridge.length){
    assert.equal(packed.settingsTranslationPath,`qb-settings/${source.sourceSha}.json`,`${source.qbVersion}: bridge route must retain exact source-SHA shard`);
  }else{
    assert.equal(Object.hasOwn(packed,'settingsTranslationPath'),false,`${source.qbVersion}: fully native profile must not ship a browser translation shard pointer`);
  }
  if(route.family==='dedicated-alt-disabled'){
    disabledFamilyProfiles++;
    assert.equal(native.length,0,`${source.qbVersion}: Alternative WebUI translation-disabled family must not be falsely marked native`);
    assert.deepEqual(bridge,expected,`${source.qbVersion}: Alternative WebUI translation-disabled family must bridge every locale`);
  }
  nativeRoutes+=native.length;
  bridgeRoutes+=bridge.length;
}

assert.equal(disabledFamilyProfiles,11,'Known qB 4.5.0-4.6.4 Alternative WebUI translation gap must remain exactly source-derived');
assert.ok(nativeRoutes>0&&bridgeRoutes>0,'Stable matrix must exercise both native and compatibility translation routes');
console.log(`Full stable locale routing contract passed: ${catalog.length} stable releases, ${nativeRoutes} native locale routes, ${bridgeRoutes} exact bridge routes, ${disabledFamilyProfiles} source-proven Alt-WebUI translation-gap releases.`);
