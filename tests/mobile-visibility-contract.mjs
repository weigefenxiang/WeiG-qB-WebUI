import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const index=read('webui/private/index.html');
const ui=read('webui/private/css/ui.css');
const spatial=read('webui/private/css/spatial.css');
const layout=read('webui/private/css/layout.css');
const progress=read('webui/private/css/progress.css');
const transfer=read('webui/private/css/transfer.css');
const logsCss=read('webui/private/css/logs.css');
const responsive=read('webui/private/scripts/responsive.js');
const uiJs=read('webui/private/scripts/ui.js');
const header=read('webui/private/scripts/header.js');
const logs=read('webui/private/scripts/logs.js');
const transferJs=read('webui/private/scripts/transfer.js');

assert(!ui.includes('grid-template-rows:44px 20px!important'),'ui.css must not force the mobile torrent card back to a two-row progress layout');
assert(!ui.includes('.mobile-card-meta--rail{display:flex!important'),'ui.css must not override the canonical stacked mobile progress rail');
assert(layout.includes('.torrent-mobile-card--two-line{display:grid!important')&&layout.includes('grid-template-rows:44px minmax(0,1fr)!important'),'layout.css must own mobile card title + metadata/progress structure');
assert(progress.includes('.mobile-card-meta--rail{display:grid!important')&&progress.includes('grid-template-rows:auto auto!important'),'progress.css must stack metadata over the progress row on mobile');
assert(progress.includes('.mobile-card-progress{width:100%;max-width:none')&&progress.includes('grid-template-columns:minmax(0,1fr) max-content'),'mobile progress must use full-width bar + right-side percentage');
assert(responsive.includes("if(density==='compact')return 94")&&responsive.includes("if(density==='comfortable')return 104")&&responsive.includes('return 98'),'mobile row-height owner must reserve enough height for the third progress line');

assert(layout.includes('grid-template-columns:minmax(124px,auto) minmax(0,1fr)'),'mobile pager must keep pagination and action rail on one physical row');
assert(layout.includes('.mobile-pager-actions-slot #torrent-selection-toolbar{display:flex')&&layout.includes('gap:5px'),'mobile Start/Pause/More/Delete must have visible separation');
assert(layout.includes('font-size:clamp(11px,2.95vw,13px)'),'mobile batch actions must use readable text before narrow-screen shrinking');
assert(layout.includes('#actions-dialog .action-grid{grid-template-columns:repeat(2,minmax(0,1fr))'),'mobile More Actions must preserve the canonical two-column action layout');
assert(layout.includes('#actions-dialog .action-grid .btn')&&layout.includes('font-size:clamp(12px,3.35vw,15px)')&&layout.includes('overflow-wrap:anywhere'),'mobile More Actions labels must stay readable and contained');

assert((index.match(/id="search-input"/g)||[]).length===1,'Header Search input must remain unique');
assert(!uiJs.includes('rss-search-input')&&!uiJs.includes('installRSSSearch'),'retired page-local RSS Search must leave runtime');
assert(uiJs.includes('W.RSS={setQuery:setRSSQuery')&&uiJs.includes('function applyRSSQuery(root)'),'RSS filtering must consume one route query without another API poller');
assert(uiJs.includes("rssDialog.id='rss-add-dialog'")&&uiJs.includes("rssOpenButton.id='rss-add-open-btn'")&&uiJs.includes('header.appendChild(actions)'),'RSS Add Feed and Refresh must move to the page header while Feed URL lives in a canonical dialog');
assert(layout.includes('.rss-header-actions')&&layout.includes('#rss-view>.workspace__header{display:grid;grid-template-columns:minmax(0,1fr) auto'),'RSS title and page actions must share the mobile header row');
assert(header.includes('function routeSearchInput(event)')&&header.includes("W.RSS.setQuery(input.value)")&&header.includes("W.Logs.setQuery(input.value)"),'Header Search must dispatch to current RSS/Logs semantic owners');

assert(!logs.includes('logs-search-toggle')&&!logs.includes('logs-search-input')&&!logsCss.includes('.logs-search-toggle')&&!logsCss.includes('.logs-search{'),'Logs page-local Search icon/input must be retired completely');
assert(logs.includes("W.Logs={setQuery:setQuery,query:function(){return state.query;}")&&logs.includes("C.selectControl({id:'logs-size-mode'"),'Logs must expose its query to Header Search and keep canonical size Select');
assert(logsCss.includes('.logs-filters>[data-log-type]')&&logsCss.includes('.logs-filters>[data-log-type]+[data-log-type]'),'Mobile log levels must render as one segmented list instead of unrelated buttons');
assert(logsCss.includes('.logs-toolbar{display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:flex-start')&&logsCss.includes('.logs-toolbar>.logs-filters{')&&logsCss.includes('gap:0')&&logsCss.includes('overflow-x:auto')&&logsCss.includes('.logs-refresh::before{content:"↻"'),'Mobile Logs controls must explicitly defeat the generic mobile grid-toolbar column cascade, keep the level list contiguous, and collapse Refresh to its icon when narrow');
assert(logsCss.includes('.logs-actions .logs-size-mode{--ui-select-width:max-content')&&!logsCss.includes('.logs-size-mode{border:'),'Logs size mode may own geometry but not duplicate canonical Select skin');
assert(ui.includes('#list-view .grid-toolbar .ui-select__trigger::before')&&!/(^|})\.grid-toolbar \.ui-select__trigger::before/.test(ui),'Mobile inset Select shell must be scoped to the Torrent toolbar so Logs keeps one canonical Select border');

assert(responsive.includes('function ensureDrawerTelemetry()')&&responsive.includes("host.id='mobile-drawer-telemetry'"),'mobile Drawer telemetry must have one responsive presentation host');
assert(responsive.includes('host.append(chart,transfer,primary)'),'mobile Drawer telemetry DOM order must be chart, transfer/connection, then Torrent/storage at the physical bottom');
assert(transfer.includes('#sidebar{display:grid!important;grid-template-rows:minmax(0,1fr) auto!important')&&transfer.includes('.mobile-drawer-telemetry{display:grid!important;grid-row:2!important'),'mobile Drawer must reserve vertical space for filters plus canonical telemetry only');
assert(transfer.includes('.sidebar__meta{display:none!important}'),'qBittorrent/WebAPI/compat metadata must not consume Mobile Drawer space');
assert(spatial.includes('#filter-nav{grid-template-columns:repeat(2,minmax(0,1fr))')&&spatial.includes('.facet-controls{grid-template-columns:repeat(2,minmax(0,1fr))'),'Android Drawer state filters and facets must both use the canonical two-column responsive grid');
assert(!transfer.includes('@container mobile-drawer (max-height:650px)'),'Facet two-column ownership must not remain duplicated in Transfer CSS');
assert(!transferJs.includes('data-mini-rate')&&!transfer.includes('transfer-mini-chart__rates'),'compact transfer chart must not repeat rates already shown by the transfer capsule');
assert(transferJs.includes('drawRateChart(canvas,chartWindow,180,100)')&&transferJs.includes("windowText.textContent=windowLabel(chartWindow)")&&transferJs.includes('renderCompactChart();'),'compact transfer chart must share the full dialog time-window state and renderer');
assert(transfer.includes('.transfer-runtime-capsule__limits{width:30px;min-width:30px;flex:0 0 30px}')&&transfer.includes('font-size:clamp(10px,3vw,13.5px)'),'mobile transfer speeds must be larger while the rate-limit affordance keeps reserved width');

console.log('Mobile visibility contract passed: two-column Drawer filters, reordered/larger telemetry, route-aware Search, two-column actions, and single-rail segmented Logs all reuse canonical owners.');
