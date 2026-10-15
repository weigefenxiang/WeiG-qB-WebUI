import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extractQbSettingsRuntimeVisibility} from '../tools/qb-settings-runtime-visibility-source.mjs';
import {readSettingsRuntime} from '../tools/qb-compact-runtime.mjs';

const source=fs.readFileSync(new URL('../webui/private/scripts/settings-schema.js',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../webui/private/data/settings-runtime-visibility.json',import.meta.url),'utf8'));
const capabilities=JSON.parse(fs.readFileSync(new URL('../webui/private/data/capabilities.json',import.meta.url),'utf8'));
const compact=readSettingsRuntime().settingsData;
assert.equal(manifest.schemaVersion,1);
assert.equal(manifest.catalogIdentity.releaseSetSha256,capabilities.catalogIdentity.releaseSetSha256);
assert.equal(manifest.catalogIdentity.sourceCatalogSha256,capabilities.catalogIdentity.sourceCatalogSha256);
const byVersion=new Map(capabilities.releases.map(r=>[r.qbVersion,r.sourceSha]));
for(const release of manifest.releases){
  assert.equal(release.sourceSha,byVersion.get(release.qbVersion),'runtime predicates must keep exact official source SHA');
  assert.deepEqual(release.rules.map(r=>r.controlId),['diskCache','diskCacheExpiryInterval','coalesceReadsAndWrites']);
}
assert.equal(manifest.releases.length,16,'all admitted 5.x source visibility profiles must be accounted for');
const fixture='<tr id="rowDiskCache"><td><input id="diskCache"></td></tr>'
  +'const buildInfo=cache.buildInfo.get();const libtorrentVersion=parseVersion(buildInfo.libtorrent);'
  +'if (libtorrentVersion.major >= 2) { document.getElementById("rowDiskCache").style.display = "none"; }';
assert.deepEqual(extractQbSettingsRuntimeVisibility(fixture),[{
  controlId:'diskCache',rowId:'rowDiskCache',when:{kind:'libtorrent-major-at-least',value:2},effect:'hidden'
}],'source extractor must identify a runtime rule from DOM ownership and native buildInfo conditional');
assert.throws(()=>extractQbSettingsRuntimeVisibility(fixture.replace('id="diskCache"','id="diskCache"><input id="other"')),/Ambiguous hidden-row control/);
let calls=0;
const W={CapabilityRegistry:{ensure:async ()=>compact,supportsWriteAction:()=>true},RuntimeAssets:{readJson:async()=>{calls++;return manifest;}}};
const browser={WeiG:W};browser.window=browser;
vm.runInNewContext(source,{window:browser,console});
const S=W.SettingsSchema;await S.loadCompatibility();
const release=manifest.releases[manifest.releases.length-1];
S.bindRelease({...release,certified:true,fallback:false});
await S.loadRuntimeVisibility();
await S.loadRuntimeVisibility();
assert.equal(calls,1,'runtime source manifest must lazy-load once on Settings demand');
S.setRuntimeBuildInfo({libtorrent:'2.0.10.0'});
for(const id of ['diskCache','diskCacheExpiryInterval','coalesceReadsAndWrites'])
  assert.equal(S.sourceControlVisible({id}),false,'libtorrent 2.x must hide '+id);
for(const key of ['disk_cache','disk_cache_ttl','enable_coalesce_read_write'])
  assert.equal(S.sourcePreferenceVisible(key),false,'a source-hidden setting must be excluded from writes '+key);
assert.equal(S.sourceControlVisible({id:'diskIOType'}),true,'unrelated upstream controls must retain normal source presentation');
S.setRuntimeBuildInfo({libtorrent:'1.2.20.0'});
for(const id of ['diskCache','diskCacheExpiryInterval','coalesceReadsAndWrites'])
  assert.equal(S.sourceControlVisible({id}),true,'libtorrent 1.x must retain '+id);
S.setRuntimeBuildInfo(null);
assert.equal(S.sourceControlVisible({id:'diskCache'}),false,'unverified libtorrent facts must fail closed');
S.setRuntimeBuildInfo({libtorrent:'garbled'});
assert.equal(S.sourceControlVisible({id:'diskCache'}),false);
console.log('Settings exact-source runtime visibility contract PASS');
