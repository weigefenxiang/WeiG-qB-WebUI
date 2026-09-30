import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const index=read('webui/private/index.html');
const app=read('webui/private/scripts/app.js');
const ui=read('webui/private/scripts/ui.js');
const selection=read('webui/private/scripts/selection.js');
const layout=read('webui/private/scripts/layout.js');
const tableCss=read('webui/private/css/table.css');
const layoutCss=read('webui/private/css/layout.css');
const navigation=read('webui/private/scripts/navigation.js');

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
assert.match(app,/loadDetailTab\(app\.detailDockTab,U\.\$\('torrent-detail-dock-content'\),U\.\$\('torrent-detail-tabs'\)\)/,'Dock must call the canonical Detail renderer directly');
assert.match(app,/app\.detailTab=tab;await loadDetailHeader\(\);await loadDetailTab\(app\.detailTab\)/,'full route must keep using the same Detail renderer');
assert.match(app,/function activateTab\(tab,host\).*host\.querySelectorAll\('\.tab'\)/s,'active-tab state must be scoped to one presentation host');
assert.doesNotMatch(app,/U\.\$\$\('\.tab'\)/,'Dock and route must not share a global tab DOM mutation owner');

assert.match(app,/function openDetailDockTab\(tab\).*app\.detailDockOpen&&app\.detailDockTab===tab\)\{closeDetailDock\(\);return false;\}/s,'clicking the active Dock tab must collapse it');
assert.match(app,/function onDetailDockSelection\(e\).*hashes\.length!==1\)\{closeDetailDock\(\);return;\}.*hash!==app\.detailDockHash\)await renderDetailDock\(hash\)/s,'zero/multi selection must close the Dock while another single selection rebinds it');
assert.match(app,/global\.addEventListener\('weig:selection-change'.*onDetailDockSelection/s,'Dock must subscribe to the semantic Selection owner');
assert.match(selection,/function apply\(\).*emitSelectionState\(\)/s,'all selection mutation paths, including silent clear, must publish semantic truth');
assert.doesNotMatch(app,/MutationObserver/,'Dock must not infer selection from rendered rows');

assert.match(ui,/function renderDetailTabs\(host,options\).*W\.QbUiEvidence\.detailTab/s,'route and Dock tabs must consume one source-derived tab presentation owner');
assert.match(app,/W\.UiSystem\.renderDetailTabs\(host,\{active:app\.detailDockOpen\?app\.detailDockTab:'',disabled:!hash/s,'Dock must consume the shared tab renderer and disable it without exactly one selection');
assert.doesNotMatch(app,/textContent=['"](?:General|Overview|Trackers|Peers|HTTP Sources|Content)['"]/,'Dock must not hard-code qB-owned Detail tab copy');

assert.ok(layout.includes("W.SplitPane={create:createSplitPane}"),'Dock must consume the shared SplitPane owner');
assert.match(app,/W\.SplitPane\.create\(\{root:panel,primary:list,secondary:dock,separator:separator,minPrimary:180,minSecondary:160,defaultSecondary:280,step:20,storageKey:'weig\.torrentDetailDockHeight',maxSecondary:detailDockMaxHeight\}\)/,'Dock geometry must be bounded, persisted and delegated to SplitPane');
assert.match(layout,/pointerDown.*pointerMove.*pointerEnd.*keyDown.*reset/s,'SplitPane must own pointer, keyboard and reset lifecycle');
assert.ok(layoutCss.includes('.split-pane__separator{')&&layoutCss.includes('cursor:ns-resize'),'the full separator rail, not only the grip, must be draggable');
assert.ok(!/torrent-detail-splitter[^}]*position:absolute/.test(layoutCss+tableCss),'splitter must remain a flex sibling below the Torrent scroll surface, never an overlay');

assert.ok(tableCss.includes('.detail-runtime-content>.data-viewport{flex:1 1 0;')&&tableCss.includes('.torrent-detail-dock>.detail-runtime-content{display:flex;'),'route and Dock must share Detail DataViewport geometry');
assert.ok(!tableCss.includes('#detail-content>'),'route-only Detail child geometry must stay retired');
assert.ok(layoutCss.includes('grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)'),'desktop pager must use symmetric 1fr/auto/1fr geometry');
assert.ok(layoutCss.includes('.torrent-pager>.pager__nav{grid-column:2;justify-self:center}'),'pager navigation must remain geometrically centered regardless of left tab width');

assert.match(app,/async function openDetail\(hash\).*W\.Router\.detail\(hash,tab\)/s,'Torrent title/detail arrow must retain the full Detail route');
assert.match(navigation,/function createBack\(\).*detail-context-back/s,'full Detail route must retain its Back presentation');
assert.equal((app.match(/storageKey:'weig\.torrentDetailDockHeight'/g)||[]).length,1,'Dock height persistence must have one active key owner');

console.log('A35 inline Detail Dock contract passed: one source-driven Detail runtime, semantic Selection binding, shared persisted SplitPane geometry, route preservation and centered pager rail.');
