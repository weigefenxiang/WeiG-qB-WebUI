import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveDetailRuntime} from '../tools/qb-detail-runtime-rebind.mjs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('webui/private/scripts/app.js');
const runtime=JSON.parse(read('webui/private/data/detail-compat.json'));

const version=read('VERSION').trim();
assert.match(version,/^\\d+\\.\\d+\\.\\d+$/,'canonical VERSION must remain semantic version text');
assert.equal(read('webui/VERSION').trim(),version,'webui/VERSION must follow canonical VERSION');
assert.equal(JSON.parse(read('webui/private/product-identity.json')).version,version,'generated product identity must follow canonical VERSION');
assert.equal(app.includes('derivedFileMenu'),false,'A26 must not restore a feature-local native Content context-menu owner');
assert.equal(app.includes('requiresNonSeed'),false,'Content priority availability must not guess from is_seed');
assert.ok(app.includes("sourceOptions.filter(function(option){return option&&option.disabled!==true;})"),'writable priority Select choices must exclude source display-only states');
assert.ok(app.includes("priorityLabels[String(option.value)]=detailOptionLabel('filePriority',option)"),'display-only priority states must remain renderable');
assert.ok(app.includes("next.translation=priorityColumn.translation"),'Priority parent must use the source-derived Download Priority caption');
assert.ok(app.includes('out=projectSourceFileMenu(out);out=out.concat(fileMenuExtensions())'),'qB-native Content actions must precede WeiG extension actions');

const q419=resolveDetailRuntime(runtime,'4.1.9');
assert.equal(Array.isArray(q419?.contextMenus?.files),false,'qB 4.1.x must not receive a native Content menu that upstream did not expose');
const q420=resolveDetailRuntime(runtime,'4.2.0');
assert.deepEqual(q420.contextMenus.files.map(item=>item.id),['FilePrio'],'qB 4.2.0 native Content menu must follow exact source order/capability');
const q421=resolveDetailRuntime(runtime,'4.2.1');
assert.deepEqual(q421.contextMenus.files.map(item=>item.id),['Rename','FilePrio'],'qB 4.2.1+ native Content menu must gain Rename from source');
const filePriority=q421.contextMenus.files.find(item=>item.semantic==='file-priority');
assert(filePriority,'source-native FilePrio semantic descriptor missing');
assert.equal(filePriority.children.some(item=>item.translation?.source==='Mixed'),false,'Mixed is display-only and must never become a writable context action');
assert.deepEqual(filePriority.children.map(item=>item.translation?.source),['Do not download','Normal','High','Maximum']);

const q500=resolveDetailRuntime(runtime,'5.0.0');
assert.equal(Array.isArray(q500?.contextMenus?.webseeds),false,'qB 5.0 must not receive future HTTP Source actions');
const q510=resolveDetailRuntime(runtime,'5.1.0');
assert.deepEqual(q510.contextMenus.webseeds.map(item=>item.id),['AddWebSeeds','RemoveWebSeed','CopyWebseedUrl','EditWebSeed'],'qB 5.1+ HTTP Source actions must come from native source order');

console.log('A26 Detail action surface contract passed: native Content/HTTP menus are version-source-projected, Mixed is display-only, Download Priority copy is source-derived, and WeiG extensions stay after native actions.');
