import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const layout=read('webui/private/scripts/layout.js');
const css=read('webui/private/css/sidebar.css');
const filterView=read('webui/private/scripts/torrent-filter-view.js');
const spatial=read('webui/private/scripts/spatial.js');
const transfer=read('webui/private/scripts/transfer.js');

assert(layout.includes("SIDEBAR_KEY='weigg.sidebarCollapsed'"),'Desktop sidebar collapse preference must have one explicit UI-state owner');
assert(layout.includes('setSidebarCollapsed')&&layout.includes("dataset.sidebarCollapsed"),'LayoutRuntime must project one collapse state into layout');
assert(layout.includes("W.Transfer.mountCompactChart")&&layout.includes('W.TransferRuntime.last'),'Desktop sidebar must reuse canonical transfer chart/history and current rates');
assert(layout.includes("addEventListener('weigg:transfer',paintSidebarRates)"),'Sidebar rate text must follow the canonical transfer event');
assert(!layout.includes('setInterval(')&&!layout.includes('fetch('),'Desktop sidebar presentation must add no polling or HTTP requests');
assert(layout.includes("link.href='css/sidebar.css'+suffix")&&layout.includes("searchParams.get('v')"),'Sidebar stylesheet must inherit the exact loaded asset cache identity');

assert((css.match(/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/g)||[]).length>=3,'Desktop sidebar filters, facets and rate row must use two-column presentation');
assert(css.includes('.app-shell[data-sidebar-collapsed="1"]:not(.is-tool-route){grid-template-columns:0 minmax(0,1fr);column-gap:0}'),'Collapsed sidebar must release its grid width to the main workspace');
assert(css.includes('.sidebar-transfer-rate--down{color:var(--accent-primary)}')&&css.includes('.sidebar-transfer-rate--up{color:var(--accent-cyan)}'),'Sidebar rate values must use the canonical download/upload colors');
assert(!css.includes('#status-connection')&&!css.includes('#status-torrents'),'Desktop Torrent sidebar must not duplicate connection/Torrent status telemetry');
assert(css.includes('@media(prefers-reduced-motion:reduce)')&&css.includes('html[data-motion="reduced"]'),'Sidebar motion must honor System and WeiG Reduced Motion');

assert(filterView.includes('W.TorrentSemantics.statusFilters'),'Two-column desktop filters must remain a presentation of canonical TorrentSemantics');
for(const kind of ["kind:'tracker'","kind:'savePath'","kind:'category'","kind:'tag'"])assert(spatial.includes(kind),`Desktop facets must reuse canonical SpatialRuntime control: ${kind}`);
assert(transfer.includes('mountCompactChart:mountCompactChart')&&transfer.includes('drawRateChart:drawRateChart'),'Sidebar chart must consume the existing Transfer owner instead of creating another chart runtime');

console.log('Desktop sidebar layout contract passed: two-column canonical filters/facets, collapsible full-width workspace, shared realtime transfer chart/rates, and no duplicate telemetry owner.');
