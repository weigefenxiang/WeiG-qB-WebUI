import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const index=read('webui/private/index.html');
const app=read('webui/private/scripts/app.js');
const spatial=read('webui/private/scripts/spatial.js');
const responsive=read('webui/private/scripts/responsive.js');
const selection=read('webui/private/scripts/selection.js');
const floating=read('webui/private/scripts/floating.js');
const ux=read('webui/private/scripts/ux.js');
const header=read('webui/private/scripts/header.js');
const layoutCss=read('webui/private/css/layout.css');
const spatialCss=read('webui/private/css/spatial.css');
const headerCss=read('webui/private/css/header.css');
const docs=read('docs/008.Torrent工作区与状态所有权.md');

for(const token of ['filter-shelf','tracker-nav','savepath-nav','category-nav','tag-nav','page-title','library-count-copy','status-connection','last-refresh'])assert(!index.includes(token),`Retired Torrent DOM survived: ${token}`);
for(const token of ['facet-controls','sidebar-facet-slot','mobile-facet-slot','mobile-command-slot','torrent-selection-toolbar','torrent-action-slot','torrent-focus-slot','qb-product-mark','data-header-add-short'])assert(index.includes(token),`Canonical Torrent workspace slot missing: ${token}`);
assert(index.indexOf('id="add-btn"')<index.indexOf('id="qb-product-mark"')&&index.indexOf('id="qb-product-mark"')<index.indexOf('id="refresh-btn"'),'Header product marker must sit immediately after Add and before Refresh');
assert(index.indexOf('id="resume-btn"')<index.indexOf('id="pause-btn"')&&index.indexOf('id="pause-btn"')<index.indexOf('id="more-actions-btn"')&&index.indexOf('id="more-actions-btn"')<index.indexOf('id="delete-btn"')&&index.indexOf('id="delete-btn"')<index.indexOf('id="torrent-focus-slot"'),'Desktop Torrent action order must be Start/Pause/More/Delete/Expand');

assert(spatial.includes('C.selectControl(')&&spatial.includes('W.CapabilityDialog=')&&spatial.includes("kind:'tag'")&&spatial.includes('onOpen:function()'),'SpatialRuntime must compose canonical Select + shared capability dialog');
for(const token of ['facet-trigger','facet-popover','facet-search','filter-shelf','connection-dock','tracker-nav','savepath-nav','category-nav','tag-nav'])assert(!spatial.includes(token),`SpatialRuntime retained retired presentation owner ${token}`);
for(const token of ['filter-shelf','facet-trigger','facet-popover','facet-search','connection-dock'])assert(!spatialCss.includes(token),`Spatial CSS retained retired presentation owner ${token}`);
assert(!spatialCss.includes('.ui-select__native'),'Spatial CSS must not restyle canonical native Select skin');
assert(floating.includes("typeof opts.onOpen==='function'")&&floating.includes('opts.onOpen(value,w)===false'),'Canonical Select must expose reusable open guard for capability-gated controls');

assert(app.includes('W.LibraryController=LibraryController')&&app.includes('facetOptions:facetOptions'),'Torrent facet state must expose semantic LibraryController facade');
for(const token of ['last-refresh','status-connection',"setStatus('已刷新')",'page-title','tracker-nav','savepath-nav','category-nav','tag-nav'])assert(!app.includes(token),`App retained retired presentation dependency ${token}`);
assert(app.includes("global.addEventListener('weigg:maindata'")&&app.includes('paintNetworkMeta'),'DHT/Peers must paint from maindata lifecycle');
const loadTransfer=app.slice(app.indexOf('async function loadTransfer'),app.indexOf('async function buildCatalog'));
assert(!loadTransfer.includes('network-meta')&&!loadTransfer.includes('networkSnapshot'),'loadTransfer must not be a DHT/Peers writer');
assert(app.includes("if(node&&node.textContent!==next)node.textContent=next"),'Network metadata paint must be idempotent');
assert(app.includes('WebAPI 2.3.0')&&app.includes("showCapability('tags')"),'Unsupported Tags must use honest WebAPI capability boundary');
assert(app.includes("statusMessages={torrent:'',transfer:''}"),'Footer transient errors must be source-scoped so one success cannot erase another active failure');

assert(responsive.includes('W.LibraryController')&&!responsive.includes('library-count-copy'),'Mobile command state must consume semantic LibraryController, not presentation copy');
for(const token of ['filter-shelf','facetDefs','syncFacetSummaries'])assert(!responsive.includes(token),`Responsive retained retired facet presentation dependency ${token}`);
assert(responsive.includes("document.getElementById('torrent-action-slot')")&&responsive.includes("toolbar:'#torrent-focus-slot'"),'Responsive toolbar/focus must use explicit canonical slots');
assert(selection.includes('W.LibraryController&&W.LibraryController.state')&&!/#[a-z]+-nav/.test(selection.slice(selection.indexOf('function currentQuery'),selection.indexOf('function matchesQuery'))),'Selection-wide query must consume semantic state, not retired facet DOM');
for(const token of ['page-title','library-count-copy','status-connection','tracker-nav','savepath-nav','category-nav','tag-nav'])assert(!ux.includes(token),`UX retained retired presentation dependency ${token}`);
assert(header.includes("W.InterfaceText.t('addShort')")&&headerCss.includes('flex-wrap:nowrap')&&headerCss.includes('.topbar__search{flex:1 1'),'Header must own short Add copy and one-line flexible Search geometry');

assert(layoutCss.includes('grid-template-areas:"torrent storage transfer message"'),'Statusbar must expose torrent/storage/transfer/message geometry only');
assert(!/#status-connection|\.connection-dock/.test(layoutCss.replace(/\/\*[\s\S]*?\*\//g,'')),'Executable layout CSS must not retain connection footer owner');
assert(!layoutCss.includes('#filter-shelf'),'Layout CSS must not retain retired filter shelf');
for(const rule of ['FACET-OWNER-001','PRESENTATION-STATE-001','TELEMETRY-PAINT-001','STATUS-NOISE-001','STATUS-DEDUP-001','OWNER-RETIRE-001'])assert(docs.includes(rule),`Torrent workspace docs missing hard rule ${rule}`);
for(const phrase of ['new UI wrapper','shared component','multiple fixed surfaces'])assert(docs.toLowerCase().includes(phrase.toLowerCase()),`Systemic failure summary missing: ${phrase}`);
console.log('Torrent workspace ownership contract passed: canonical facets, semantic mobile state, single-writer telemetry, silent statusbar and one-line header.');
