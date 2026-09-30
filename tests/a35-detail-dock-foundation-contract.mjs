import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const selection=read('webui/private/scripts/selection.js');
const layout=read('webui/private/scripts/layout.js');
const ui=read('webui/private/scripts/ui.js');
const layoutCss=read('webui/private/css/layout.css');

assert.equal((selection.match(/weig:selection-change/g)||[]).length,1,'Torrent selection must publish one semantic change event owner');
assert.ok(selection.includes("detail:{count:hashes.length,hashes:hashes.slice()}"),'selection event must expose immutable count/hash snapshot');
assert.match(selection,/function apply\(\).*syncToolbar\(\);emitSelectionState\(\);/s,'semantic selection truth must publish from apply(), including silent clear paths used by filters/search');
assert.ok(!selection.includes('MutationObserver'),'selection consumers must not infer business state through DOM observation');

assert.ok(layout.includes('function createSplitPane(options)'),'shared layout runtime must own one SplitPane primitive');
assert.ok(layout.includes("W.SplitPane={create:createSplitPane}"),'SplitPane must be exported through the shared layout owner');
for(const token of ["pointerdown',pointerDown","pointermove',pointerMove","keydown',keyDown","dblclick',reset","aria-orientation','horizontal'","localStorage.setItem(storageKey"]){
  assert.ok(layout.includes(token),`SplitPane contract missing ${token}`);
}
assert.ok(layout.includes("startSize-(e.clientY-startY)"),'dragging upward must increase secondary/detail height');
assert.ok(layout.includes('Math.max(minSecondary')&&layout.includes('maxSecondary()'),'SplitPane must clamp geometry instead of allowing either pane to disappear');

assert.equal((ui.match(/function renderDetailTabs\(/g)||[]).length,1,'Detail tab button creation must have one shared renderer');
assert.ok(ui.includes('syncDetailTabLabels')&&ui.includes('renderDetailTabs(host,{active:active,onSelect:function(key)'),'full Detail route must consume the shared tab renderer');
assert.ok(ui.includes('renderDetailTabs:renderDetailTabs'),'shared Detail tab renderer must be exported for the inline dock');

assert.ok(layoutCss.includes('.split-pane__separator{')&&layoutCss.includes('cursor:ns-resize'),'shared SplitPane must expose a full-width resize hit surface');
assert.ok(layoutCss.includes('.split-pane__grip{'),'the center grip is presentation only, not the sole hit target');

console.log('A35 foundation contract passed: semantic Selection events, one shared Detail-tab renderer and one persisted bounded horizontal SplitPane owner are ready for the inline Torrent Detail Dock.');
