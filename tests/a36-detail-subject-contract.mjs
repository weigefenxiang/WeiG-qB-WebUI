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
assert.match(app,/function currentPageDetailHash\(\).*app\.detailHash.*app\.torrents.*function detailDockSubjectHash\(\).*if\(hashes\.length\)return detailDockPrimaryHash\(hashes\).*session=currentPageDetailHash\(\).*if\(session\)return session;return visibleDetailDockHash/s,'Detail Dock must resolve 1+ selections through primary, preserve a valid zero-selection shared Detail subject, and only then fall back to the unobscured viewport item');
assert.match(app,/function activateFullDetailSubject\(hash\).*setDetailSubject\(hash\).*app\.detailDockHash=hash.*count===1.*selectOnly\(hash\)/s,'explicit Full Detail activation must commit the target as canonical subject and transfer an existing single selection without creating a second selection owner');
assert.match(app,/setView\('home'\);if\(app\.detailDockOpen\)\{var returnHash=currentPageDetailHash\(\)\|\|String\(app\.detailDockHash\|\|''\)/,'returning from Full Detail must remount the current canonical subject before falling back to stale Dock presentation state');
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

assert.doesNotMatch(app,/captureVisible/,'retired zero-selection forced recapture flag must stay absent once shared Detail session owns preview continuity');
