import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const layout=read('webui/private/scripts/layout.js');
const app=read('webui/private/scripts/app.js');

assert.match(layout,/function bound\(value,fallback\).*typeof value==='function'.*return Math\.max\(0,splitFinite\(value,fallback\)\)/s,'SplitPane bounds must accept dynamic geometry providers in the shared owner');
assert.match(layout,/function trackSize\(\).*options\.trackSize.*root\.clientHeight/s,'SplitPane must own a dynamic available-track provider with a root-height fallback');
assert.match(layout,/function readStored\(\).*var raw=localStorage\.getItem\(storageKey\);if\(raw===null\|\|raw===''\)return defaultSecondary;var n=Number\(raw\);return Number\.isFinite\(n\)&&n>=0\?n:defaultSecondary/s,'SplitPane persistence must distinguish an absent storage key from an explicitly persisted zero height');
assert.match(layout,/function maxSecondary\(minimum\).*trackSize\(\)-minPrimary\(\)-handle/s,'SplitPane maximum secondary size must derive from track size, primary semantic minimum and separator size');
assert.match(layout,/function bounds\(\)\{var minimum=minSecondary\(\),maximum=maxSecondary\(minimum\);return\{min:minimum,max:Math\.max\(minimum,maximum\)\};\}/,'SplitPane must snapshot dynamic bounds once per layout application');
assert.match(layout,/function apply\(value,persist\)\{var limits=bounds\(\);size=clamp\(value,limits\).*aria-valuemin'.*limits\.min.*aria-valuemax'.*limits\.max/s,'SplitPane size and ARIA bounds must come from the same geometry snapshot');
assert.match(app,/function detailDockTrackHeight\(\).*panelTop=panel\.getBoundingClientRect\(\)\.top.*contentBottom=panelTop\+Math\.max\(0,Number\(panel\.clientTop\)\|\|0\)\+Math\.max\(0,Number\(panel\.clientHeight\)\|\|0\).*pagerHeight=.*getBoundingClientRect\(\)\.height.*contentBottom-pagerHeight-listTop/s,'Torrent Dock track must derive from the panel available box, independent of the current split occupancy');
assert.match(app,/minPrimary:0,minSecondary:0,defaultSecondary:280.*trackSize:detailDockTrackHeight/,'Torrent header is outside the primary list; full-track Dock geometry must allow the list body itself to collapse to zero');
assert.doesNotMatch(app,/function detailDockMinListHeight|function detailDockMaxHeight|total-fixed-180|minPrimary:180|minSecondary:160/,'old header-reserve and feature-local fixed Dock clamps must be retired');
console.log('A37 SplitPane geometry contract passed: shared dynamic bounds expose the full Torrent-header to Detail-tabs track.');
