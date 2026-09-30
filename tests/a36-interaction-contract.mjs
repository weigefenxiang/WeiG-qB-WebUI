import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const core=read('webui/private/scripts/core.js');
const floating=read('webui/private/scripts/floating.js');
const components=read('webui/private/scripts/components.js');
const responsive=read('webui/private/scripts/responsive.js');
const selection=read('webui/private/scripts/selection.js');
const app=read('webui/private/scripts/app.js');
const controls=read('webui/private/css/controls.css');

assert.match(core,/W\.Clipboard=\{writeText:async function/,'Clipboard transport must have one shared core owner');
assert.match(core,/navigator\.clipboard.*writeText/s,'shared Clipboard owner must prefer Async Clipboard');
assert.match(core,/legacyClipboardWrite.*document\.execCommand\('copy'\)/s,'shared Clipboard owner must retain a user-gesture fallback for browsers/LAN HTTP without Async Clipboard');
assert.match(selection,/W\.Clipboard\.writeText\(text\)/,'Torrent selection copy actions must delegate to the shared Clipboard owner');
assert.match(responsive,/W\.Clipboard&&W\.Clipboard\.writeText/,'mobile Detail-title copy must delegate to the shared Clipboard owner');
assert.match(app,/await W\.Clipboard\.writeText\(String\(value\)\)/,'Tracker/Peer/WebSeed/File copy actions must delegate to the shared Clipboard owner');
assert.doesNotMatch(selection,/navigator\.clipboard|document\.execCommand/,'Selection must not keep a private clipboard transport');
assert.doesNotMatch(responsive,/function copyText\(|navigator\.clipboard|document\.execCommand/,'Responsive title copy must retire its private clipboard transport');
assert.match(floating,/function bindOverflowPreview\(anchor,textProvider\).*showTextPreview/s,'overflow preview binding must live beside the bounded floating preview owner');
assert.match(components,/bindTorrentNamePreview.*C\.bindOverflowPreview/s,'Torrent list desktop/mobile names must consume the shared overflow preview binding');
assert.match(responsive,/C\.bindOverflowPreview\(node/,'full Detail title must consume the same overflow preview binding');
assert.match(controls,/\.ui-floating-preview\{[^}]*pointer-events:none[^}]*user-select:none/s,'transient hover previews must never intercept the underlying app pointer target');
assert.match(controls,/\.ui-floating-preview\[data-persistent="1"\]\{[^}]*pointer-events:auto[^}]*user-select:text/s,'only explicit persistent previews may own pointer/text selection');
console.log('A36 interaction contract passed: one Clipboard transport with legacy fallback and one bounded overflow-preview owner serve list and Detail titles.');
