import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const layout=read('webui/private/scripts/layout.js');
const core=read('webui/private/scripts/core.js');
const app=read('webui/private/scripts/app.js');

assert.match(layout,/function bound\(value,fallback\).*typeof value==='function'.*return Math\.max\(0,splitFinite\(value,fallback\)\)/s,'SplitPane bounds must accept dynamic geometry providers in the shared owner');
assert.match(layout,/function trackSize\(\).*options\.trackSize.*root\.clientHeight/s,'SplitPane must own a dynamic available-track provider with a root-height fallback');
assert.match(layout,/function readStored\(\).*var raw=localStorage\.getItem\(storageKey\);if\(raw===null\|\|raw===''\)return defaultSecondary;var n=Number\(raw\);return Number\.isFinite\(n\)&&n>=0\?n:defaultSecondary/s,'SplitPane persistence must distinguish an absent storage key from an explicitly persisted zero height');
assert.match(layout,/function maxSecondary\(minimum\).*trackSize\(\)-minPrimary\(\)-handle/s,'SplitPane maximum secondary size must derive from track size, primary semantic minimum and separator size');
assert.match(layout,/function bounds\(\)\{var minimum=minSecondary\(\),maximum=maxSecondary\(minimum\);return\{min:minimum,max:Math\.max\(minimum,maximum\)\};\}/,'SplitPane must snapshot dynamic bounds once per layout application');
assert.match(layout,/function apply\(value,persist\)\{var limits=bounds\(\);size=clamp\(value,limits\).*aria-valuemin'.*limits\.min.*aria-valuemax'.*limits\.max/s,'SplitPane size and ARIA bounds must come from the same geometry snapshot');
assert.match(layout,/function scheduleRefresh\(\).*geometryFrame.*requestAnimationFrame.*apply\(size,false\)/s,'SplitPane window-resize work must be coalesced until the browser layout frame instead of synchronously reading stale geometry');
assert.match(layout,/global\.addEventListener\('resize',scheduleRefresh.*ResizeObserver.*observe\(root\)/s,'SplitPane must re-clamp from the actual root box after responsive/flex geometry changes');
assert.match(layout,/function destroy\(\).*removeEventListener\('resize',scheduleRefresh\).*rootResizeObserver\.disconnect\(\).*cancelGeometryFrame\(\)/s,'SplitPane geometry observers and scheduled frames must have one bounded lifecycle owner');
assert.match(core,/if\(this\.staticHead\)\{this\.staticHead\.classList\.add\('data-viewport__head'\);this\.el\.appendChild\(this\.staticHead\);\}/,'DataViewport must own runtime mounting of the static Torrent header inside the primary viewport');
assert.match(core,/W\.DataViewport\.prototype\.headerHeight=function\(\)\{return this\._headerHeight\(true\);\}/,'DataViewport must expose its canonical live static-header geometry to layout consumers');
assert.match(app,/function detailDockMinListHeight\(\).*app\.viewport.*headerHeight/s,'Torrent Dock primary minimum must consume the same DataViewport static-header geometry owner used by unobscured visibility');
assert.match(app,/function detailDockTrackHeight\(\).*stageTop=stage\.getBoundingClientRect\(\)\.top.*panelTop=panel\.getBoundingClientRect\(\)\.top.*contentBottom=panelTop\+Math\.max\(0,Number\(panel\.clientTop\)\|\|0\)\+Math\.max\(0,Number\(panel\.clientHeight\)\|\|0\).*pagerHeight=.*getBoundingClientRect\(\)\.height.*contentBottom-pagerHeight-stageTop/s,'Torrent Dock track must derive from the stable content-stage top to the persistent pager, independent of split occupancy');
assert.match(app,/primary:stage,secondary:dock,separator:separator,minPrimary:detailDockMinListHeight,minSecondary:0,defaultSecondary:280.*trackSize:detailDockTrackHeight/,'Torrent Dock must use the stable content stage as SplitPane primary while retaining DataViewport header minimum');
assert.doesNotMatch(app,/function detailDockMaxHeight|total-fixed-180|minPrimary:180|minSecondary:160/,'old feature-local fixed Dock clamps must stay retired');
console.log('A37 SplitPane geometry contract passed: shared dynamic bounds expose the full Torrent-header to Detail-tabs track.');
