import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const selection=read('webui/private/scripts/selection.js');
const app=read('webui/private/scripts/app.js');
const layout=read('webui/private/css/layout.css');

assert.match(selection,/primaryHash=''/,'Selection must own an explicit primary Torrent without overloading the selected Set');
assert.match(selection,/primary:function\(\)\{return reconcilePrimary\(\);\}/,'Selection must expose canonical primary subject access');
assert.match(selection,/primaryHash:primary/,'Selection change events must publish primaryHash');
assert.match(app,/function detailDockSubjectHash\(options\).*if\(hashes\.length\)return detailDockPrimaryHash\(hashes\).*visibleDetailDockHash/s,'Detail Dock must resolve 1+ selections through primary and zero selection through first-visible fallback');
assert.doesNotMatch(app,/hashes\.length>1\)\{closeDetailDock\(\)/,'multi-selection must not close the Detail Dock');
assert.match(app,/function syncDetailDockSubjectPresentation\(\).*is-detail-subject/s,'zero-selection preview must be presentation-only');
assert.ok(layout.includes('.torrent-row.is-detail-subject')&&layout.includes('.torrent-mobile-card.is-detail-subject'),'desktop and mobile Torrent presentations must expose the shared preview treatment');
console.log('A36 Detail subject contract passed: Selection owns primary identity, zero-selection preview stays semantic-free, and multi-selection keeps Detail usable.');
