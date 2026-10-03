import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const selection=read('webui/private/scripts/selection.js');
const app=read('webui/private/scripts/app.js');
const components=read('webui/private/scripts/components.js');
const core=read('webui/private/scripts/core.js');
const layout=read('webui/private/css/layout.css');

assert.match(selection,/primaryHash=''/,'Selection must own an explicit primary Torrent without overloading the selected Set');
assert.match(selection,/primary:function\(\)\{return reconcilePrimary\(\);\}/,'Selection must expose canonical primary subject access');
assert.match(selection,/primaryHash:primary/,'Selection change events must publish primaryHash');
assert.match(app,/function detailDockSubjectHash\(options\).*if\(hashes\.length\)return detailDockPrimaryHash\(hashes\).*visibleDetailDockHash/s,'Detail Dock must resolve 1+ selections through primary and zero selection through the shared unobscured viewport fallback');
assert.doesNotMatch(app,/hashes\.length>1\)\{closeDetailDock\(\)/,'multi-selection must not close the Detail Dock');
assert.match(core,/W\.DataViewport\.prototype\.refreshRenderedRows=function\(\)/,'mounted recycler presentation refresh must belong to the shared DataViewport owner');
assert.ok(layout.includes('.torrent-row.is-detail-subject')&&layout.includes('.torrent-mobile-card.is-detail-subject'),'desktop and mobile Torrent presentations must expose the shared preview treatment');assert.ok(!layout.includes('.is-detail-subject .torrent-select'),'Detail-subject preview must never paint the Selection checkbox; checked presentation belongs only to Selection');assert.ok(!/\.torrent-(?:row|mobile-card)\.is-detail-subject\{[^}]*transform:/.test(layout),'Detail-subject depth must not steal the DataViewport transform positioning owner');
assert.match(app,/isPreview=function\(t\).*detailDockHash.*C\.mobileTorrentCard\(.*isPreview\(t\).*C\.torrentRow\(.*isPreview\(t\)/s,'virtualized row renderer must bind zero-selection preview identity during create, not only through DOM post-processing');
assert.match(app,/C\.updateMobileTorrentCard\(.*isPreview\(t\).*C\.updateTorrentRow\(.*isPreview\(t\)/s,'recycled Torrent row shells must recompute preview identity on every rebind');
assert.match(components,/function paintDetailSubject\(row,preview\).*is-detail-subject/s,'desktop and mobile rows must share one preview painter');
assert.match(components,/C\.paintTorrentDetailSubject=paintDetailSubject/,'Torrent row create/update must retain one shared Detail-subject painter');
assert.match(app,/function syncDetailDockSubjectPresentation\(\).*detailDockPresentationHash===preview.*app\.viewport&&app\.viewport\.refreshRenderedRows/s,'preview identity changes must refresh mounted rows through DataViewport instead of scanning DOM');
const subjectSync=app.match(/function syncDetailDockSubjectPresentation\(\)[\s\S]*?return preview;\}/)?.[0]||'';
assert.doesNotMatch(subjectSync,/U\.\$\$?\(|querySelectorAll|C\.paintTorrentDetailSubject|classList\.toggle\('is-detail-subject'|setAttribute\('aria-current'|removeAttribute\('aria-current'/,'app-level preview sync must not keep a second DOM selector/painter owner');
console.log('A36 Detail subject contract passed: Selection owns primary identity, zero-selection preview stays semantic-free, and multi-selection keeps Detail usable.');
