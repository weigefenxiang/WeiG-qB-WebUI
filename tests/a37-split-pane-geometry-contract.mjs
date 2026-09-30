import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const layout=read('webui/private/scripts/layout.js');
const app=read('webui/private/scripts/app.js');

assert.match(layout,/function bound\(value,fallback\).*typeof value==='function'.*return Math\.max\(0,splitFinite\(value,fallback\)\)/s,'SplitPane bounds must accept dynamic geometry providers in the shared owner');
assert.match(layout,/function trackSize\(\).*options\.trackSize.*root\.clientHeight/s,'SplitPane must own a dynamic available-track provider with a root-height fallback');
assert.match(layout,/function maxSecondary\(\).*trackSize\(\)-minPrimary\(\)-handle/s,'SplitPane maximum secondary size must derive from track size, primary semantic minimum and separator size');
assert.match(layout,/aria-valuemin'.*minSecondary\(\).*aria-valuemax'.*maxSecondary\(\)/s,'SplitPane accessibility bounds must reflect current dynamic geometry');
assert.match(app,/function detailDockMinListHeight\(\).*torrent-table-head.*offsetHeight/s,'Torrent Dock primary minimum must be the actual canonical sticky header height');
assert.match(app,/function detailDockTrackHeight\(\).*getBoundingClientRect\(\)\.top.*pager\.getBoundingClientRect\(\)\.top/s,'Torrent Dock track must span the real list-top to pager-top geometry');
assert.match(app,/minPrimary:detailDockMinListHeight,minSecondary:0,defaultSecondary:280.*trackSize:detailDockTrackHeight/,'Torrent Dock must consume shared full-track SplitPane geometry');
assert.doesNotMatch(app,/function detailDockMaxHeight|total-fixed-180|minPrimary:180|minSecondary:160/,'old feature-local fixed Dock clamp must be retired');
console.log('A37 SplitPane geometry contract passed: shared dynamic bounds expose the full Torrent-header to Detail-tabs track.');
