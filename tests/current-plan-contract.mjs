import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {materializeQbPeerFlags,QB_PEER_FLAGS_SOURCE} from '../tools/qb-release-catalog-peer-flags.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const schema=read('webui/private/scripts/settings-schema.js');
const settings=read('webui/private/scripts/settings.js');
const layout=read('webui/private/scripts/layout.js');
const ui=read('webui/private/scripts/ui.js');
const tableCss=read('webui/private/css/table.css');
const ownedUi=read('tools/qb-owned-ui-source.mjs');
const catalogPacker=read('tools/qb-webui-catalog.mjs');

assert.match(schema,/SURFACES=\['behavior','downloads','connection','speed','bittorrent','rss','webui','advanced'\]/,'Settings must expose the native qB top-level surface order.');
assert.match(schema,/add\('behavior','localization','auto',\['locale'\]\)/,'Locale must live under native Behavior.');
assert.match(schema,/add\('behavior','logging','auto',\['performance_warning','file_log_enabled'/,'Behavior must own performance/file logging preferences.');
assert.match(schema,/add\('rss','rss','auto',\['rss_auto_downloading_enabled'/,'RSS preferences must live under native RSS.');
assert.match(settings,/QB_TAB_ORDER=\['behavior','downloads','connection','speed','bittorrent','rss','webui','advanced'\]/,'Settings navigation must project the native qB tab order.');
assert.match(settings,/function ensureQbTabs\(\)/,'Settings must reconcile all native qB tabs, not only Speed.');
assert.match(settings,/function ensureSpeedTab\(\)\{return ensureQbTabs\(\);\}/,'Legacy internal Speed helper must delegate to the canonical tab reconciler.');
assert.doesNotMatch(layout,/keys\.some\(function\(key\)\{return!R\.hasTorrentDetailField\('properties',key\);\}\)/,'General must not reject a source-generated property layout through a second release-field gate.');
assert.match(layout,/keys\.forEach\(function\(key\)\{var text=own\(data,key\)\?generalScalar\(key,data\[key\]\):'—'/,'General must render optional source-bound response fields as unavailable instead of failing the whole layout.');
assert.match(ui,/icon\.className='flag '\+iso\+' peer-country-flag'/,'Peer country cells must render a graphical flag host.');
assert.match(ui,/fallback\.className='peer-country-code'/,'Peer country cells must retain a deterministic ISO-code fallback when local qB artwork is unavailable.');
assert.match(ui,/root\.insertBefore\(note,toolbar\)/,'Detail explanatory copy must stay outside and before the shared toolbar.');
assert.match(tableCss,/@import url\('\.\/qb-peer-flags\.css'\)/,'Detail tables must consume the locally materialized qB peer flag stylesheet.');
assert.match(tableCss,/\.shared-table__columns-button\{margin-left:0\}/,'Column settings must not be pushed to the far right.');
assert.match(tableCss,/#detail-content\{[^}]*overflow:hidden/,'Detail content must not compete with the shared table viewport for scrolling.');
assert.match(tableCss,/#detail-content>\.general-detail\{[^}]*overflow:auto/,'General must own its vertical scroll instead of being clipped by detail-content.');
assert.match(tableCss,/\.peer-country-flag\{display:none;width:16px;height:11px/,'Local table CSS must own flag dimensions and loading fallback behavior.');
assert.match(ownedUi,/'settings\.tab\.behavior':'PrefBehaviorLink'/,'Source extraction must include native Behavior tab copy.');
assert.match(ownedUi,/'settings\.tab\.rss':'PrefRSSLink'/,'Source extraction must include native RSS tab copy.');
assert.match(catalogPacker,/materializeQbPeerFlags\(privateRoot/,'The canonical runtime catalog materializer must also own qB peer flag provisioning.');
assert.equal(QB_PEER_FLAGS_SOURCE.tag,'release-5.2.3','Peer flag artwork must stay pinned to the latest admitted stable qB source.');
assert.equal(QB_PEER_FLAGS_SOURCE.commit,'0b63c3d17373f6132ea211c9dcd4241284ccdfaf','Peer flag artwork source must be immutable by exact qB commit.');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-peer-flags-contract-'));
try{
  const privateRoot=path.join(temp,'webui/private'),sourceRoot=path.join(temp,'upstream');
  fs.mkdirSync(path.join(privateRoot,'scripts'),{recursive:true});fs.mkdirSync(path.join(privateRoot,'css'),{recursive:true});
  fs.writeFileSync(path.join(privateRoot,'scripts/ui.js'),"var peer='peer-country-flag';\n");
  fs.writeFileSync(path.join(privateRoot,'index.html'),'<!doctype html><html data-theme="dark"><head></head><body></body></html>\n');
  const renderer=path.join(sourceRoot,QB_PEER_FLAGS_SOURCE.renderer),flags=path.join(sourceRoot,QB_PEER_FLAGS_SOURCE.flags);fs.mkdirSync(path.dirname(renderer),{recursive:true});fs.mkdirSync(flags,{recursive:true});
  fs.writeFileSync(renderer,'span.style.backgroundImage = `url(\'images/flags/${country_code || "xx"}.svg\')`;\n');
  const names=new Set(['cn.svg','de.svg','jp.svg','sg.svg','us.svg']);
  for(let a=97;a<=122&&names.size<205;a++)for(let b=97;b<=122&&names.size<205;b++)names.add(String.fromCharCode(a,b)+'.svg');
  for(const name of names)fs.writeFileSync(path.join(flags,name),`<svg xmlns="http://www.w3.org/2000/svg"><title>${name}</title></svg>\n`);
  const result=materializeQbPeerFlags(privateRoot,{sourceRoot});
  assert.equal(result.materialized,true,'Fixture WebUI with Peers runtime must materialize local qB flags.');
  assert.ok(result.flagCount>=200,'Materializer must carry a complete ISO flag surface, not a hand-picked country list.');
  assert.match(fs.readFileSync(path.join(privateRoot,'index.html'),'utf8'),/data-country-flags="failed"/,'Materialized WebUI must fail closed before legacy external flag loading can run.');
  const flagCss=fs.readFileSync(path.join(privateRoot,'css/qb-peer-flags.css'),'utf8');
  assert.match(flagCss,/\.peer-country-flag\.flag\.us\{[^}]*images\/flags\/us\.svg/,'Generated flag CSS must bind the official local US SVG.');
  assert.ok(fs.existsSync(path.join(privateRoot,'images/flags/cn.svg')),'Materialized WebUI must contain copied qB-owned SVG artwork.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

console.log('Current plan contract passed: native Settings topology, General source-layout admission/scroll ownership, shared Detail layout, and source-pinned local qB Peer flags are locked.');
