import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const app=read('webui/private/scripts/app.js');
const ui=read('webui/private/scripts/ui.js');
const components=read('webui/private/scripts/components.js');
const layout=read('webui/private/css/layout.css');

assert.match(app,/C\.pagerControl\(\{host:host,nav:nav,rail:U\.\$\('torrent-detail-tabs'\)/,'Torrent pager must pass its Detail rail into the shared Pager geometry owner');
assert.ok(components.includes('--torrent-pager-nav-left')&&components.includes('--torrent-pager-tabs-max'),'Pager owner must calculate centered/clamped navigation and the remaining Detail rail width');
assert.ok(layout.includes('left:var(--torrent-pager-nav-left,50%)'),'desktop Torrent pager must consume calculated navigation geometry instead of hard right anchoring');
assert.match(app,/detailChrome:root&&root\.id==='torrent-detail-dock-content'\?'table-only':'full'/,'Detail runtime boundary must choose presentation chrome without cloning the table owner');
assert.match(ui,/chrome:String\(options\.detailChrome\|\|'full'\)/,'shared Detail DataGrid must own an explicit presentation chrome policy');
assert.match(ui,/if\(ctx\.chrome!=='table-only'\)ensureDetailToolbar\(ctx\)/,'inline Detail must suppress the toolbar structurally while full Detail keeps it');
console.log('A36 Detail presentation contract passed: Pager centers then clamps, and inline/full Detail share one DataGrid with explicit chrome policy.');
