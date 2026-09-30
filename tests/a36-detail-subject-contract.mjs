import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const selection=read('webui/private/scripts/selection.js');
const app=read('webui/private/scripts/app.js');
const components=read('webui/private/scripts/components.js');
const layout=read('webui/private/css/layout.css');

assert.match(selection,/primaryHash=''/,'Selection must own an explicit primary Torrent without overloading the selected Set');
assert.match(selection,/primary:function\(\)\{return reconcilePrimary\(\);\}/,'Selection must expose canonical primary subject access');
assert.match(selection,/primaryHash:primary/,'Selection change events must publish primaryHash');
assert.match(app,/function detailDockSubjectHash\(options\).*if\(hashes\.length\)return detailDockPrimaryHash\(hashes\).*visibleDetailDockHash/s,'Detail Dock must resolve 1+ selections through primary and zero selection through first-visible fallback');
assert.doesNotMatch(app,/hashes\.length>1\)\{closeDetailDock\(\)/,'multi-selection must not close the Detail Dock');
assert.match(app,/function syncDetailDockSubjectPresentation\(\).*is-detail-subject/s,'zero-selection preview must be presentation-only');
assert.ok(layout.includes('.torrent-row.is-detail-subject')&&layout.includes('.torrent-mobile-card.is-detail-subject'),'desktop and mobile Torrent presentations must expose the shared preview treatment');
assert.match(app,/isPreview=function\(t\).*detailDockHash.*C\.mobileTorrentCard\(.*isPreview\(t\).*C\.torrentRow\(.*isPreview\(t\)/s,'virtualized row renderer must bind zero-selection preview identity during create, not only through DOM post-processing');
assert.match(app,/C\.updateMobileTorrentCard\(.*isPreview\(t\).*C\.updateTorrentRow\(.*isPreview\(t\)/s,'recycled Torrent row shells must recompute preview identity on every rebind');
assert.match(components,/function paintDetailSubject\(row,preview\).*is-detail-subject/s,'desktop and mobile rows must share one preview painter');
console.log('A36 Detail subject contract passed: Selection owns primary identity, zero-selection preview stays semantic-free, and multi-selection keeps Detail usable.');
