import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyLocaleOverlay} from '../tools/qb-locale-overlay.mjs';
import {buildNativeSettingsBundle,renderNativeSettingsRegistry} from '../tools/qb-settings-native-bundle.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const catalogPath=path.join(here,'fixtures/qb-release-catalog.lkg.json');
const catalogBytes=fs.readFileSync(catalogPath);
const baseCatalog=JSON.parse(catalogBytes.toString('utf8'));
const localeOverlay=JSON.parse(fs.readFileSync(path.join(here,'../tools/data/qb-locale-lkg.json'),'utf8'));
const catalog=applyLocaleOverlay(baseCatalog,localeOverlay,{catalogSha256:crypto.createHash('sha256').update(catalogBytes).digest('hex')});
const behavior=JSON.parse(fs.readFileSync(path.join(here,'../tools/data/qb-translator-behavior-lkg.json'),'utf8'));
const bundle=buildNativeSettingsBundle(catalog,behavior);
assert.equal(bundle.profileCount,65,'native Settings routing must cover all 65 admitted stable releases');
for(const [index,profile] of bundle.profiles.entries()){
  const locales=(catalog[index].webuiLocales||[]).map(item=>typeof item==='string'?item:item.value).filter(Boolean);
  const routed=[...profile.nativeLocales,...profile.bridgeLocales];
  assert.equal(new Set(routed).size,routed.length,`${profile.qbVersion}: locale routing must not overlap`);
  assert.deepEqual([...routed].sort(),[...new Set(locales)].sort(),`${profile.qbVersion}: every exact WebUI locale must route native or bridge`);
}
for(const profile of bundle.profiles.filter(item=>item.family==='dedicated-alt-disabled')){
  assert.equal(profile.nativeLocales.length,0,`${profile.qbVersion}: Alternative WebUI translation hole must never route native`);
  assert.ok(profile.bridgeLocales.length>0,`${profile.qbVersion}: Alternative WebUI translation hole must retain exact official TS bridge`);
}
for(const profile of bundle.profiles.filter(item=>item.family!=='dedicated-alt-disabled'&&item.mappedPreferences>0)){
  assert.ok(profile.nativeLocales.length>0,`${profile.qbVersion}: mapped qB-owned Settings copy must keep at least one source-proven native locale when upstream allows Alternative WebUI translation`);
}
assert.ok(Object.keys(bundle.localeMessages).length>0,'native bundle must produce official minimal QM locale sources');
const registry=renderNativeSettingsRegistry(catalog);
assert.ok(Buffer.byteLength(registry)<5*1024*1024,'native QBT_TR registry must stay below the project 5 MiB per-file budget');
const native=bundle.profiles.reduce((sum,item)=>sum+item.nativeLocales.length,0);
const bridge=bundle.profiles.reduce((sum,item)=>sum+item.bridgeLocales.length,0);
console.log(`Native Settings stable LKG audit passed: 65 releases, ${native} native locale routes, ${bridge} exact-TS bridge routes, ${Object.keys(bundle.localeMessages).length} minimal QM locale sources, registry ${Buffer.byteLength(registry)} bytes.`);
