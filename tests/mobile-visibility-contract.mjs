import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const ui=read('webui/private/css/ui.css');
const layout=read('webui/private/css/layout.css');
const progress=read('webui/private/css/progress.css');
const transfer=read('webui/private/css/transfer.css');
const logs=read('webui/private/css/logs.css');
const responsive=read('webui/private/scripts/responsive.js');
const uiJs=read('webui/private/scripts/ui.js');

assert(!ui.includes('grid-template-rows:44px 20px!important'),'ui.css must not force the mobile torrent card back to a two-row progress layout');
assert(!ui.includes('.mobile-card-meta--rail{display:flex!important'),'ui.css must not override the canonical stacked mobile progress rail');
assert(layout.includes('.torrent-mobile-card--two-line{display:grid!important')&&layout.includes('grid-template-rows:44px minmax(0,1fr)!important'),'layout.css must own mobile card title + metadata/progress structure');
assert(progress.includes('.mobile-card-meta--rail{display:grid!important')&&progress.includes('grid-template-rows:auto auto!important'),'progress.css must stack metadata over the progress row on mobile');
assert(progress.includes('.mobile-card-progress{width:100%;max-width:none')&&progress.includes('grid-template-columns:minmax(0,1fr) max-content'),'mobile progress must use full-width bar + right-side percentage');
assert(responsive.includes("if(density==='compact')return 94")&&responsive.includes("if(density==='comfortable')return 104")&&responsive.includes('return 98'),'mobile row-height owner must reserve enough height for the third progress line');

assert(layout.includes('grid-template-columns:minmax(124px,auto) minmax(0,1fr)'),'mobile pager must keep pagination and action rail on one physical row');
assert(layout.includes('.mobile-pager-actions-slot #torrent-selection-toolbar{display:flex')&&layout.includes('gap:5px'),'mobile Start/Pause/More/Delete must have visible separation');
assert(layout.includes('font-size:clamp(11px,2.95vw,13px)'),'mobile batch actions must use readable text before narrow-screen shrinking');

assert(uiJs.includes('function installRSSSearch()')&&uiJs.includes("input.id='rss-search-input'")&&uiJs.includes("form.insertBefore(host,url)"),'RSS mobile search must be created immediately before the Feed URL presentation owner');
assert(layout.includes('grid-template-areas:"search add refresh" "url url url"'),'RSS mobile toolbar must keep Search immediately left of Add Feed while the feed URL occupies its own row');
assert(uiJs.includes('function applyRSSSearch(input)')&&uiJs.includes("root.querySelectorAll('.tool-row')"),'RSS search must filter rendered RSS rows without a new API poller');

assert(logs.includes('@media(max-width:680px)')&&logs.includes('.logs-search-toggle{display:grid;grid-column:1;grid-row:1')&&logs.includes('.logs-toolbar.is-search-open .logs-search{display:flex;grid-column:1/-1;grid-row:2'),'phone log search must collapse to an icon and expand on the next row without moving filters');

assert(responsive.includes('function ensureDrawerTelemetry()')&&responsive.includes("host.id='mobile-drawer-telemetry'"),'mobile Drawer telemetry must have one responsive presentation host');
assert(transfer.includes('#sidebar{display:grid!important;grid-template-rows:minmax(0,1fr) auto auto!important')&&transfer.includes('#sidebar>.sidebar__section:first-child{grid-row:1;min-height:0;overflow-y:auto!important')&&transfer.includes('.mobile-drawer-telemetry{display:grid!important;grid-row:2!important'),'mobile Drawer must keep only filters scrollable while fixed telemetry stays visible above versions');
assert(transfer.includes('.sidebar__meta{grid-row:3!important;order:30;align-self:end'),'qBittorrent/WebAPI metadata must remain pinned to the final mobile Drawer row');

console.log('Mobile visibility contract passed: stacked torrent progress, single-line pager/actions, RSS + Logs search, and pinned Drawer telemetry/version layout are owned by their canonical layers.');
