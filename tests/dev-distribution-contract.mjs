import assert from 'node:assert/strict';
import fs from 'node:fs';

const install=fs.readFileSync(new URL('../installers/install.ps1',import.meta.url),'utf8');
const buildSite=fs.readFileSync(new URL('../simulator/build/build-site.mjs',import.meta.url),'utf8');
const distBuilder=fs.readFileSync(new URL('../tools/build-webui-dist.mjs',import.meta.url),'utf8');
const pagesSource=fs.readFileSync(new URL('../.github/workflows/pages-source.yml',import.meta.url),'utf8');
const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
const readmeZh=fs.readFileSync(new URL('../translations/README.zh-CN.md',import.meta.url),'utf8');

const devInstallerUrl='https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1';

assert.ok(install.includes("$DevDistBase='https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev'"),'Windows dev installer must consume the public exact-SHA materialized distribution');
assert.ok(install.includes('Assert-MaterializedWebUI'),'Windows installer must validate runtime catalog/native registry/QM assets before installation');
assert.ok(install.includes('refusing raw-source fallback'),'Windows dev installer must refuse stale materialized payloads instead of silently installing raw source');
assert.equal(install.includes('archive/$sourceSha.zip'),false,'Windows dev installer must not download the raw GitHub source archive');
assert.ok(buildSite.includes("tools/build-webui-dist.mjs"),'Virtual qB Pages build must publish the canonical dev distribution');
assert.ok(buildSite.includes("downloads','dev"),'Dev distribution must be part of the deployed Pages site');
assert.ok(distBuilder.includes("packCatalog(catalogPath,path.join(root,'private/data/qb-releases.json'))"),'Canonical distribution must materialize the runtime release catalog and translation routing assets');
assert.ok(distBuilder.includes("qb-settings-native.txt"),'Canonical distribution must require the qB native Settings QBT_TR registry');
assert.ok(distBuilder.includes("webui_.+\\.qm"),'Canonical distribution must require official qB WebUI QM assets');
assert.ok(distBuilder.includes("path.join(outDir,'install.ps1')"),'Canonical dev distribution must publish the exact dev Windows installer beside the payload');
assert.ok(distBuilder.includes("path.join(projectRoot,'installers/install.ps1')"),'Published dev Windows installer must come from the exact source tree being materialized');
assert.match(pagesSource,/push:\s*\n\s*branches:\s*\n\s*- dev\s*\n\s*- main/,'Every dev/main push must materialize a new exact-SHA distribution');
assert.doesNotMatch(pagesSource,/\n\s+paths:/,'Exact-SHA dev distribution relay must not use path filters that can leave the public payload behind dev HEAD');
assert.ok(readme.includes(devInstallerUrl),'English development instructions must bootstrap Windows dev installs from the materialized dev distribution, not the stable main installer');
assert.ok(readmeZh.includes(devInstallerUrl),'Chinese development instructions must bootstrap Windows dev installs from the materialized dev distribution, not the stable main installer');
console.log('Dev distribution contract passed: Windows dev installs and its bootstrap installer are published together at one exact SHA; raw-source fallback is forbidden and every dev/main head is materialized without path-filter gaps.');