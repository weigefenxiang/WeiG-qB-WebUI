import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const index=read('webui/private/index.html');
const app=read('webui/private/scripts/app.js');
const core=read('webui/private/scripts/core.js');
const ui=read('webui/private/scripts/ui.js');
const components=read('webui/private/scripts/components.js');
const selection=read('webui/private/scripts/selection.js');
const layout=read('webui/private/scripts/layout.js');
const tableCss=read('webui/private/css/table.css');
const layoutCss=read('webui/private/css/layout.css');
const navigation=read('webui/private/scripts/navigation.js');
const storage=read('webui/public/storage-migration.js');

for(const id of ['torrent-detail-tabs','torrent-detail-splitter','torrent-detail-dock','torrent-detail-dock-content']){
  assert.equal((index.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} must have exactly one mount owner`);
}
const dockMarkup=index.slice(index.indexOf('id="torrent-detail-splitter"'),index.indexOf('<div class="pager torrent-pager">'));
assert.ok(dockMarkup.includes('split-pane__separator')&&dockMarkup.includes('split-pane__grip'),'Dock splitter must use the shared SplitPane primitive');
assert.ok(dockMarkup.includes('detail-runtime-content'),'inline Dock must mount the shared Detail runtime surface');
assert.ok(!/detail-context-back|data-detail-back|back-btn/.test(dockMarkup),'inline Dock must never create or hide a route Back control');

assert.ok(index.includes('<div id="detail-content" class="detail-content detail-runtime-content surface surface--panel surface--scroll"></div>'),'full Detail route must consume the same runtime geometry class');
assert.ok(index.includes('<div class="pager torrent-pager"><div id="torrent-detail-tabs"'),'Detail tabs must live in the Torrent pager rail, not in a copied detail page');
assert.ok(index.includes('<div class="pager__tail"><div id="mobile-pager-actions-slot"'),'pager must retain a third balance/action rail');

assert.equal((app.match(/W\.DetailRuntime=/g)||[]).length,1,'Detail runtime must have one active owner');
assert.match(app,/async function loadDetailTab\(tab,root,tabHost\).*renderOverview\(root\).*renderDetailTable\(root,surface\)/s,'General and tabular Detail surfaces must converge on one mountable renderer');
assert.match(app,/function setDetailSubject\(hash\).*detailProperties=null.*detailPropertiesHash=''/s,'route and Dock subject changes must share one hash/cache rebind owner');
assert.match(app,/loadDetailTab\(app\.detailDockTab,U\.\$\('torrent-detail-dock-content'\),U\.\$\('torrent-detail-tabs'\)\)/,'Dock must call the canonical Detail renderer directly');assert.match(app,/renderDetailTable\(root,surface\).*detailSurface:surface/s,'inline Dock tables must pass canonical surface into the shared Detail DataGrid owner');assert.match(ui,/prepareDetailDataViewport\(container,options\).*detailSurface\(options\.detailSurface\).*container\.closest\('\.detail-runtime-content'\)/s,'route and Dock must share one presentation-neutral Detail DataGrid mount contract');assert.doesNotMatch(ui,/detailSurface\(app\.detailTab\)|container\.closest\('#detail-content'\)/,'A35 must retire the route-only Detail table owner assumptions');
assert.match(app,/app\.detailTab=tab;await loadDetailHeader\(\);await loadDetailTab\(app\.detailTab\)/,'full route must keep using the same Detail renderer');
assert.match(app,/function activateTab\(tab,host\).*host\.querySelectorAll\('\.tab'\)/s,'active-tab state must be scoped to one presentation host');
assert.doesNotMatch(app,/U\.\$\$\('\.tab'\)/,'Dock and route must not share a global tab DOM mutation owner');

assert.match(app,/function openDetailDockTab\(tab\).*app\.detailDockOpen&&app\.detailDockTab===tab\)\{closeDetailDock\(\);return false;\}/s,'clicking the active Dock tab must collapse it');
assert.match(core,/W\.DataViewport\.prototype\.firstUnobscuredItem=function\(\)/,'virtualized Torrent viewport must own exact first-unobscured item semantics instead of DOM scanning');assert.match(app,/function visibleDetailDockHash\(\).*app\.viewport\.firstUnobscuredItem/s,'zero-selection Detail subject must consume the shared DataViewport unobscured owner');assert.match(app,/function detailDockPrimaryHash\(hashes\).*app\.selection\.primary/s,'explicit Selection must expose one canonical primary Detail subject');assert.match(app,/function detailDockSubjectHash\(options\).*if\(hashes\.length\)return detailDockPrimaryHash\(hashes\).*captureVisible.*visibleDetailDockHash/s,'Detail subject policy must use the Selection primary for one-or-more selections and visible fallback only for zero selection');const finalizeStart=app.indexOf('function finalizeListUi'),finalizeEnd=app.indexOf('function renderList',finalizeStart),finalizeBody=finalizeStart>=0&&finalizeEnd>finalizeStart?app.slice(finalizeStart,finalizeEnd):'';assert.ok(finalizeBody,'finalizeListUi contract body must be discoverable');assert.doesNotMatch(finalizeBody,/visibleDetailDockHash|renderDetailDock/,'background list refresh must never retarget a zero-selection Detail subject merely because the user scrolled');assert.match(app,/function onDetailDockSelection\(e\).*if\(hashes\.length\).*primaryHash.*renderDetailDock/s,'one-or-more selected Torrents must keep the Dock open and rebind to the semantic primary subject');
assert.match(app,/global\.addEventListener\('weig:selection-change'.*onDetailDockSelection/s,'Dock must subscribe to the semantic Selection owner');
assert.match(selection,/function apply\(\).*emitSelectionState\(\)/s,'all selection mutation paths, including silent clear, must publish semantic truth');
assert.doesNotMatch(app,/MutationObserver/,'Dock must not infer selection from rendered rows');

assert.match(ui,/function renderDetailTabs\(host,options\).*W\.QbUiEvidence\.detailTab/s,'route and Dock tabs must consume one source-derived tab presentation owner');
const dockTabSyncStart=app.indexOf('function syncDetailDockTabs'),dockTabSyncEnd=app.indexOf('function closeDetailDock',dockTabSyncStart),dockTabSync=dockTabSyncStart>=0&&dockTabSyncEnd>dockTabSyncStart?app.slice(dockTabSyncStart,dockTabSyncEnd):'';assert.ok(dockTabSync,'Dock tab sync body must be discoverable');assert.doesNotMatch(dockTabSync,/detailDockSubjectHash|visibleDetailDockHash|firstVisibleItem|firstUnobscuredItem/,'passive Dock tab presentation sync must not read viewport geometry or recapture the zero-selection subject');assert.match(dockTabSync,/app\.viewport&&app\.viewport\.items&&app\.viewport\.items\.length/,'zero-selection tab availability must use cheap viewport inventory presence only');assert.match(dockTabSync,/dataset\.weigDetailDockTabs===signature/,'unchanged Dock tab presentation state must not rebuild the shared tab DOM');assert.match(dockTabSync,/disabled:!hasSubject/,'Dock tabs must disable only when no usable subject exists');
assert.doesNotMatch(app,/textContent=['"](?:General|Overview|Trackers|Peers|HTTP Sources|Content)['"]/,'Dock must not hard-code qB-owned Detail tab copy');

assert.ok(layout.includes("W.SplitPane={create:createSplitPane}"),'Dock must consume the shared SplitPane owner');
assert.ok(storage.includes("torrentDetailDockHeight:'weig.torrentDetailDockHeight'"),'Dock height must be registered in the canonical StorageKeys owner');assert.match(app,/W\.SplitPane\.create\(\{root:panel,primary:list,secondary:dock,separator:separator,minPrimary:detailDockMinListHeight,minSecondary:0,defaultSecondary:280,step:20,storageKey:\(W\.StorageKeys&&W\.StorageKeys\.torrentDetailDockHeight\)\|\|'weig\.torrentDetailDockHeight',trackSize:detailDockTrackHeight\}\)/,'Dock geometry must be persisted while consuming shared dynamic SplitPane bounds');assert.doesNotMatch(app,/detailDockMaxHeight|total-fixed-180|minPrimary:180|minSecondary:160/,'superseded feature-local fixed Dock clamps must stay retired');
assert.match(app,/function detailDockInteracting\(\).*app\.detailViewport\.isInteracting/s,'Dock background refresh must yield to the active shared Detail DataViewport scroll owner');
assert.match(app,/async function refreshDetailDock\(\).*if\(!app\.detailDockOpen\|\|detailDockInteracting\(\)\)return false;.*if\(surface==='files'\)\{await refreshDetailFiles\(\);return true;\}.*app\.detailViewport&&app\.detailViewport\.setItems/s,'one active Dock surface must refresh through existing Detail owners without rebuilding a second polling runtime');
assert.match(app,/function schedulePoll\(\).*if\(r\.name==='home'&&app\.detailDockOpen\)await refreshDetailDock\(\);await loadTransfer\(\);schedulePoll\(\);/s,'inline Detail refresh must be scheduled by the existing app poll owner');
assert.doesNotMatch(app,/setInterval\(/,'A35 must not introduce a second Detail polling timer owner');
assert.match(layout,/pointerDown.*pointerMove.*pointerEnd.*keyDown.*reset/s,'SplitPane must own pointer, keyboard and reset lifecycle');
assert.ok(layoutCss.includes('.split-pane__separator{')&&layoutCss.includes('cursor:ns-resize'),'the full separator rail, not only the grip, must be draggable');
assert.ok(!/torrent-detail-splitter[^}]*position:absolute/.test(layoutCss+tableCss),'splitter must remain a flex sibling below the Torrent scroll surface, never an overlay');

assert.ok(tableCss.includes('.detail-runtime-content>.data-viewport{flex:1 1 0;')&&tableCss.includes('.torrent-detail-dock>.detail-runtime-content{display:flex;'),'route and Dock must share Detail DataViewport geometry');
assert.ok(!tableCss.includes('#detail-content>'),'route-only Detail child geometry must stay retired');
assert.ok(layoutCss.includes('container-type:inline-size;container-name:torrent-pager'),'Torrent pager must own responsive geometry through its actual container width');assert.ok(components.includes('--torrent-pager-nav-left')&&components.includes('--torrent-pager-tabs-max'),'shared Pager owner must publish collision-aware centered geometry variables');assert.ok(layoutCss.includes('left:var(--torrent-pager-nav-left,50%)'),'desktop pager navigation must consume the shared centered/clamped geometry owner');assert.ok(layoutCss.includes('flex-wrap:nowrap')&&layoutCss.includes('overflow-x:auto'),'Detail tabs must never wrap; after pager compaction the tab rail becomes horizontally scrollable');assert.ok(layoutCss.includes('@container torrent-pager (max-width:800px)')&&layoutCss.includes('.pager-index-copy--compact{display:inline}'),'pager must compact by its own container width, not by global mobile state');assert.match(app,/function renderPageLabel\(host,total\).*pager-index-copy--full.*pager-index-copy--compact/s,'pager copy owner must render full and compact variants once');assert.doesNotMatch(app.slice(app.indexOf('function renderPageLabel'),app.indexOf('function installPagerControl')),/U\.isMobile\(\)/,'pager copy must not use screen/mobile classification as its density owner');

assert.match(app,/async function openDetail\(hash\).*W\.Router\.detail\(hash,tab\)/s,'Torrent title/detail arrow must retain the full Detail route');
assert.match(navigation,/function createBack\(\).*detail-context-back/s,'full Detail route must retain its Back presentation');
assert.equal((storage.match(/torrentDetailDockHeight:'weig\.torrentDetailDockHeight'/g)||[]).length,1,'Dock height persistence must have one canonical StorageKeys entry');

console.log('A35 inline Detail Dock contract passed: one source-driven Detail runtime, semantic Selection binding, shared persisted SplitPane geometry, route preservation and centered pager rail.');
