import assert from 'node:assert/strict';
import fs from 'node:fs';

const install=fs.readFileSync(new URL('../installers/install.ps1',import.meta.url),'utf8');
const buildSite=fs.readFileSync(new URL('../simulator/build/build-site.mjs',import.meta.url),'utf8');
const distBuilder=fs.readFileSync(new URL('../tools/build-webui-dist.mjs',import.meta.url),'utf8');
const pagesSource=fs.readFileSync(new URL('../.github/workflows/pages-source.yml',import.meta.url),'utf8');

assert.ok(install.includes("$DevDistBase='https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev'"),'Windows dev installer must consume the public exact-SHA materialized distribution');
assert.ok(install.includes('Assert-MaterializedWebUI'),'Windows installer must validate runtime catalog/native registry/QM assets before installation');
assert.ok(install.includes('refusing raw-source fallback'),'Windows dev installer must refuse stale materialized payloads instead of silently installing raw source');
assert.equal(install.includes('archive/$sourceSha.zip'),false,'Windows dev installer must not download the raw GitHub source archive');
assert.ok(buildSite.includes("tools/build-webui-dist.mjs"),'Virtual qB Pages build must publish the canonical dev distribution');
assert.ok(buildSite.includes("downloads','dev"),'Dev distribution must be part of the deployed Pages site');
assert.ok(distBuilder.includes("packCatalog(catalogPath,path.join(root,'private/data/qb-releases.json'))"),'Canonical distribution must materialize the runtime release catalog and translation routing assets');
assert.ok(distBuilder.includes("qb-settings-native.txt"),'Canonical distribution must require the qB native Settings QBT_TR registry');
assert.ok(distBuilder.includes("webui_.+\\.qm"),'Canonical distribution must require official qB WebUI QM assets');
for(const trigger of ["'installers/**'","'tools/build-webui-dist.mjs'","'tools/qb-webui-catalog.mjs'","'tools/qb-settings-native-bundle.mjs'"]){
  assert.ok(pagesSource.includes(trigger),`Pages source trigger must rebuild dev distribution when ${trigger} changes`);
}
console.log('Dev distribution contract passed: Windows dev installs exact-SHA materialized WebUI assets, raw-source fallback is forbidden, and Pages rebuilds for every distribution owner.');
