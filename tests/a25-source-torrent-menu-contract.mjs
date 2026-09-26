import assert from 'node:assert/strict';
import {extractTorrentContextMenu} from '../tools/qb-detail-control-parsers.mjs';
const html=`
<ul id="torrentsTableMenu" class="contextMenu">
<li><a href="#start">QBT_TR(Start)QBT_TR[CONTEXT=TransferListWidget]</a></li>
<li><a href="#Category">QBT_TR(Category)QBT_TR[CONTEXT=TransferListWidget]</a><ul id="contextCategoryList"></ul></li>
<li><a href="#futureRefresh">QBT_TR(Future Refresh)QBT_TR[CONTEXT=TransferListWidget]</a></li>
</ul>`;
const js=`
const menu=new ContextMenu({actions:{
 start: () => { startFN(); },
 futureRefresh: () => { futureRefreshFN(); }
}});
let startFN=()=>{};let futureRefreshFN=()=>{};
startFN=()=>{fetch("api/v2/torrents/start",{method:"POST",body:new URLSearchParams({hashes:"x"})});};
futureRefreshFN=()=>{fetch("api/v2/torrents/futureRefresh",{method:"POST",body:new URLSearchParams({hashes:"x"})});};`;
const actions=['torrentscontroller.h:startAction','torrentscontroller.h:futureRefreshAction'];
const menu=extractTorrentContextMenu({menuSource:html,clientSource:js,apiActions:actions,apiActionParameters:{'torrentscontroller.h:startAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:futureRefreshAction':{parameters:['hashes'],required:['hashes'],optional:[]}}},'synthetic Torrent menu');
assert.deepEqual(menu.map(x=>x.id),['start','Category','futureRefresh']);
assert.equal(menu[0].sourceAction,'torrentscontroller.h:startAction');
assert.equal(menu[2].endpoint,'torrents/futureRefresh');
assert.equal(menu[2].sourceAction,'torrentscontroller.h:futureRefreshAction');
assert.deepEqual(menu[2].required,['hashes']);assert.deepEqual(menu[2].parameters,['hashes']);
const release=await import('../tools/qb-release-torrent-surface.mjs');
const compact=await import('../tools/qb-compact-runtime.mjs');
assert.equal(typeof release.extractQbReleaseTorrentSurface,'function');
assert.ok(compact.TORRENT_FACTS.includes('torrentContextMenu'));
const capabilities=String(await (await import('node:fs/promises')).readFile(new URL('../webui/private/scripts/capabilities.js',import.meta.url)));
const selection=String(await (await import('node:fs/promises')).readFile(new URL('../webui/private/scripts/selection.js',import.meta.url)));
assert.ok(capabilities.includes('function torrentContextMenu()')&&capabilities.includes('torrentContextMenu:torrentContextMenu'));
assert.ok(selection.includes('function appendSourceMenuActions(root,qb,context)'));
assert.ok(selection.includes("kind='source:'+String(item.id||item.endpoint)"));
assert.ok(selection.includes("required[0]==='hashes'||required[0]==='hash'"));
assert.ok(selection.includes("parameters.some(function(name){return name!==target;})"),'unknown source actions with extra parameters must fail closed instead of guessing');
console.log('A25 source Torrent menu contract passed: nested upstream menu items and proven POST endpoints feed future safe auto-actions; ambiguous parameterized actions fail closed.');
