import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),runtimeBase=path.join(root,'webui/private');
function assert(ok,msg){if(!ok)throw new Error(msg);}
function text(p){return fs.readFileSync(path.join(root,p),'utf8');}
function walk(abs,rel=''){return fs.readdirSync(abs,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(abs,e.name),path.join(rel,e.name)):[path.join(rel,e.name).replaceAll('\\','/')]);}
const runtimeFiles=walk(runtimeBase),versioned=runtimeFiles.filter(p=>/(?:^|\/)(?:v\d{3}|[^/]+-v\d{3})(?:\.[^/]+)$/.test(p));
assert(versioned.length===0,`Versioned runtime assets remain: ${versioned.join(', ')}`);
const required=['css/app.css','css/spatial.css','css/transfer.css','css/progress.css','css/controls.css','css/layout.css','css/ui.css','css/polish.css','css/logs.css','css/brand.css','css/session.css','css/settings.css','scripts/core.js','scripts/qb-client.js','scripts/components.js','scripts/floating.js','scripts/torrent-semantics.js','scripts/settings.js','scripts/session.js','scripts/spatial.js','scripts/transfer.js','scripts/responsive.js','scripts/selection.js','scripts/layout.js','scripts/ui.js','scripts/polish.js','scripts/app.js','scripts/ux.js','scripts/header.js','scripts/logs.js'];
required.forEach(p=>assert(fs.existsSync(path.join(runtimeBase,p)),`Missing semantic runtime asset ${p}`));
const index=text('webui/private/index.html');
assert(!/(?:src|href)=["'][^"']*(?:\/v\d{3}|-v\d{3}\.)/i.test(index),'Private index references a versioned runtime asset');
for(const layer of ['ui','polish','brand'])assert(index.includes(`data-weigg-layer="${layer}"`),`Private index missing semantic ${layer} layer metadata`);
const scriptFiles=runtimeFiles.filter(p=>p.startsWith('scripts/')&&p.endsWith('.js')),forbiddenOwners=['V030I18n','V034I18n','V036I18n','V037Text','AdvancedSettingsV036','V037Selection','SelectionModelV037','V037Layout','V037Polish','V037UiSystem','TorrentFieldRegistryV037','WeiGLogsV032'];
for(const file of scriptFiles){const source=text('webui/private/'+file);assert(!source.includes('MutationObserver'),`${file} contains observer-driven runtime repair/ownership`);assert(!/(?:scripts|css)\/[A-Za-z0-9._-]*-v\d{3}\.(?:js|css)/.test(source),`${file} contains a hidden versioned runtime loader`);for(const token of forbiddenOwners)assert(!source.includes(token),`${file} still references version-labelled owner ${token}`);}

const design=text('DESIGN.md'),compatDocs=text('docs/002.兼容与实现状态.md'),archDocs=text('docs/003.项目架构.md'),uiDocs=text('docs/004.UI与缓存契约.md'),implementationDocs=text('docs/005.统一交互与设置系统.md'),workspaceDocs=text('docs/008.Torrent工作区与状态所有权.md');
assert(design.includes('Semantic Ownership 3.7'),'DESIGN authority must identify Semantic Ownership 3.7');
for(const token of ['COMPAT-DEGRADE-001','PERF-COMPAT-001','PROGRESSIVE-DATA-001','TIMESERIES-001','INTERACTION-TEST-001','CONTROL-SKIN-001','DIALOG-SCROLL-001','NATIVE-THEME-001','OWNER-RETIRE-001','CURRENT-ONLY-001','FILE-NAMING-001','TEST-CURRENT-001'])assert(design.includes(token),`DESIGN hard rule missing ${token}`);
for(const token of ['FACET-OWNER-001','PRESENTATION-STATE-001','TELEMETRY-PAINT-001','STATUS-NOISE-001','STATUS-DEDUP-001','STATUS-PLACEMENT-001','ADAPTIVE-STATUS-001','LIVE-INDICATOR-001','MOTION-STATUS-001','HEADER-UTILITY-001','OWNER-RETIRE-001'])assert(workspaceDocs.includes(token),`Torrent workspace hard rule missing ${token}`);
assert(compatDocs.includes('0 legacy Private tracker scan')&&compatDocs.includes('capability notice `5+`'),'Compatibility docs must preserve qB4 Private capability degradation');
assert(compatDocs.includes('5.2.3')&&/synthetic|哨兵|sentinel/i.test(compatDocs),'Compatibility docs must preserve release-fixture/forward-sentinel policy');
assert(compatDocs.includes('qBittorrent 5.0.0+')&&compatDocs.includes('WebAPI 2.3.0+'),'Compatibility docs must preserve current qB/WebAPI capability versions');
for(const token of ['ROUTE-OWNER-001','RATE-UNIT-001','LAYOUT-OWNER-001','EXACT-HEAD-001','CONTROL-SKIN-001','DIALOG-SCROLL-001','NATIVE-THEME-001','OWNER-RETIRE-001'])assert(archDocs.includes(token),`Architecture docs missing ${token}`);
for(const token of ['SELECT-TOPLAYER-001','INTERACTION-TEST-001','PROGRESSIVE-DATA-001','CONTROL-SKIN-001','DIALOG-SCROLL-001','NATIVE-THEME-001','OWNER-RETIRE-001'])assert(uiDocs.includes(token),`UI/cache contract missing ${token}`);
for(const token of ['EXACT-HEAD-001','qB4 Private click','12 h','ALT Apply','CONTROL-SKIN-001','DIALOG-SCROLL-001','NATIVE-THEME-001','OWNER-RETIRE-001'])assert(implementationDocs.includes(token),`Current implementation notes missing ${token}`);
assert(implementationDocs.includes('live.sh')&&implementationDocs.includes('live-api.sh'),'Current implementation notes must use stable LIVE script names');

const components=text('webui/private/scripts/components.js'),floating=text('webui/private/scripts/floating.js');
assert(components.includes('selectionHit')&&components.includes('privacyBadge'),'Canonical torrent presentation primitives missing');
for(const token of ['upgradeNativeSelect','upgradeNativeSelects','ui-select-upgraded'])assert(!components.includes(token),`Components still contains automatic select upgrade ${token}`);
assert(floating.includes('C.selectControl=function')&&floating.includes('opts.native===true')&&floating.includes('ui-select--native')&&floating.includes('ui-select--intrinsic'),'Canonical Select must own explicit native and floating presentation modes');
assert(floating.includes("typeof opts.onOpen==='function'")&&floating.includes('opts.onOpen(value,w)===false'),'Canonical Select must own capability-gated open behavior');

const settings=text('webui/private/scripts/settings.js'),settingsCss=text('webui/private/css/settings.css');
assert(settings.includes("className='setting-row'")&&settings.includes("className='settings-grid'")&&settings.includes('weigg:settings-render'),'Canonical Settings renderer/lifecycle missing');
assert(settings.includes('C.selectControl(opts)')&&!settings.includes("createElement('select')"),'Settings must explicitly use canonical Select');
assert(!settings.includes("global.addEventListener('hashchange'")&&!settings.includes('showSettingsView')&&!settings.includes('W.Router.route'),'Settings must not intercept or present application routes');
assert(settingsCss.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'Settings two-column contract missing');

const app=text('webui/private/scripts/app.js'),ux=text('webui/private/scripts/ux.js'),spatial=text('webui/private/scripts/spatial.js'),responsive=text('webui/private/scripts/responsive.js'),selection=text('webui/private/scripts/selection.js');
assert(app.includes('W.AppState=app')&&app.includes('selection:W.Selection'),'App must expose state and consume canonical Selection');
assert(app.includes('W.LibraryController=LibraryController')&&app.includes('facetOptions:facetOptions'),'App must expose canonical Torrent facet state');
assert(app.includes('W.SettingsRenderer.open')&&app.includes('W.Logs.activate'),'App must delegate Settings and Logs to canonical owners');
assert(!/selected\s*:\s*new Set\s*\(/.test(app),'App recreated Selection state');
assert(app.includes("btn.classList.toggle('is-active'")&&app.includes("shell.classList.toggle('is-tool-route'"),'App must be the single Route Frame presentation owner');
assert(!ux.includes('bindRoutes')&&!ux.includes("classList.toggle('is-active'"),'UX must not own route navigation state');
assert(!spatial.includes('syncRouteFrame')&&!spatial.includes("classList.toggle('is-tool-route'"),'Spatial runtime must not own route shell state');
assert(app.includes("if(filter==='private'&&!app.client.capabilities.privateFlag)")&&app.includes("showCapability('private')"),'qB4 Private/PT must degrade to a shared capability notice');
for(const token of ['ensurePrivacy(','resolveMany(','TorrentSemantics.resolve','legacyTrackerEvidence','tracker-nav','savepath-nav','category-nav','tag-nav','library-count-copy','last-refresh','status-connection','connectionLabel('])assert(!app.includes(token),`App still contains retired owner/caller ${token}`);
assert(!app.includes("U.$('refresh-btn')"),'App still contains retired topbar Refresh caller');
assert(app.includes('pageSize+1')&&app.includes('pager-index-spinner')&&!app.includes("pages=total==null?'?'"),'Progressive pagination must avoid ? and use bounded look-ahead');
assert(app.includes('function totalMatching(){return app.catalogReady?app.catalog.filter(filterMatch).length:null;}'),'Catalog total count must filter without sorting the full catalog');
assert(app.includes('total:totalMatching()')&&!app.includes('total:app.catalogReady?matchingCatalog().length:null'),'Library lifecycle count must not sort the full catalog');
assert(app.includes("showCapability('tags')")&&app.includes('WebAPI 2.3.0'),'Tags must degrade through the truthful WebAPI capability boundary');
assert(app.includes("global.addEventListener('weigg:maindata'")&&app.includes('paintNetworkMeta'),'DHT/Peers presentation must consume the maindata lifecycle');
const transferSlice=app.slice(app.indexOf('async function loadTransfer'),app.indexOf('async function buildCatalog'));
assert(!transferSlice.includes('network-meta')&&!transferSlice.includes('networkSnapshot')&&!transferSlice.includes('connection-status'),'getTransferInfo stream must emit semantic connection state, not own Network/Connection presentation');
assert(transferSlice.includes('emitStatusState(status)')&&transferSlice.includes("emitStatusState('error')"),'Existing transfer poll must be the only connection semantic source');
assert(app.includes("if(node&&node.textContent!==next)node.textContent=next"),'Telemetry paint must avoid unchanged DOM writes');
for(const token of ['filter-shelf','facet-trigger','facet-popover','facet-search','connection-dock'])assert(!spatial.includes(token),`Spatial runtime retains retired presentation ${token}`);
assert(spatial.includes('C.selectControl(')&&spatial.includes('W.CapabilityDialog=')&&spatial.includes("kind:'tag'"),'SpatialRuntime must compose canonical facets and shared capability dialog');
for(const token of ['new W.QBClient','getMainData(','setInterval('])assert(!responsive.includes(token),`Responsive runtime owns business/API lifecycle ${token}`);
assert(responsive.includes('W.LibraryController')&&!responsive.includes('library-count-copy'),'Responsive must consume semantic LibraryController state');
assert(responsive.includes("global.addEventListener('weigg:status-state'")&&responsive.includes('function paintConnection('),'MobileAdaptive must own adaptive ConnectionIndicator presentation without polling');
assert(responsive.includes('mobileRowHeight')&&responsive.includes('instance.setRowHeight(next)'),'Responsive must remain sole adaptive row-height owner');
assert(selection.includes('W.Selection=Selection')&&selection.includes('ActionRegistry'),'Canonical Selection/ActionRegistry missing');
assert(selection.includes('W.LibraryController&&W.LibraryController.state'),'Selection all-matching query must consume semantic library state');
for(const token of ['resolveMany(','TorrentSemantics.resolve','legacyTrackerEvidence','#tracker-nav','#savepath-nav','#category-nav','#tag-nav'])assert(!selection.includes(token),`Selection retains retired compatibility/presentation caller ${token}`);

const semantics=text('webui/private/scripts/torrent-semantics.js');
assert(semantics.includes('PRIVATE_PT')&&semantics.includes('metadata-pending')&&semantics.includes("source:'unsupported'"),'TorrentSemantics direct/unknown capability model missing');
for(const token of ['legacyTrackerEvidence','resolveMany','privacyCache','pending=new Map','client.trackers'])assert(!semantics.includes(token),`Legacy collection Private emulation survived: ${token}`);
const qb=text('webui/private/scripts/qb-client.js');
assert(qb.includes('privateFlag:this.major>=5'),'Private capability floor must remain qB5+');
assert(qb.includes("tags:atLeast(v,'2.3.0')"),'Tags capability floor must remain WebAPI 2.3.0');
assert(qb.includes('getAltSpeedLimits')&&qb.includes('*1024')&&qb.includes('setAltSpeedLimits')&&qb.includes('/1024'),'QBClient must normalize ALT KiB/s preferences to canonical B/s');

const layout=text('webui/private/scripts/layout.js'),layoutCss=text('webui/private/css/layout.css'),appCss=text('webui/private/css/app.css'),spatialCss=text('webui/private/css/spatial.css'),sharedUiCss=text('webui/private/css/ui.css');
assert(layout.includes('W.LayoutRuntime=')&&layout.includes('weigg:library-state'),'LayoutRuntime semantic lifecycle missing');
assert(layoutCss.includes('grid-template-areas:"torrent storage transfer connection message"')&&layoutCss.includes('grid-area:transfer')&&layoutCss.includes('grid-area:connection'),'Statusbar must expose torrent/storage/transfer/connection/transient-message geometry');
assert(layoutCss.includes('#list-view>.stats-grid{display:none!important}')&&layoutCss.includes('#list-view>.stats-grid{display:grid'),'Desktop summary must retire while Mobile Summary stays available');
assert(layoutCss.includes('.connection-indicator[data-connection="connected"]')&&layoutCss.includes('@media(prefers-reduced-motion:reduce)'),'ConnectionIndicator must use semantic theme tokens and honor Reduced Motion');
assert(layoutCss.includes('#list-view.is-active{display:flex')&&layoutCss.includes('#torrent-list{flex:1 1 0'),'Desktop Torrent viewport must flex-fill the workspace');
assert(layoutCss.includes('.pager-index-spinner')&&layoutCss.includes('[data-capability-min]'),'Progressive pager/capability presentation missing');
assert(!layoutCss.includes('#filter-shelf')&&!layoutCss.includes('.connection-dock'),'Retired shelf/connection dock geometry survived in layout.css');
assert(!appCss.includes('height:min(62vh,660px)')&&!appCss.includes('height:calc(100svh - 360px)')&&!appCss.includes('height:calc(100svh - 390px)'),'Old fixed Torrent viewport geometry still owns height in app.css');
assert(!appCss.includes('dialog{')&&!appCss.includes('dialog::backdrop'),'app.css must not own the shared Dialog primitive');
assert(!spatialCss.includes('.app-shell.is-tool-route'),'Spatial stylesheet must not own route shell geometry');
assert(layoutCss.includes('.app-shell.is-tool-route'),'Layout stylesheet must own route shell geometry');
for(const token of ['filter-shelf','facet-trigger','facet-popover','facet-search','connection-dock','.ui-select__native'])assert(!spatialCss.includes(token),`Spatial stylesheet retains retired/shared primitive owner ${token}`);
assert(sharedUiCss.includes('min-inline-size:44px')&&sharedUiCss.includes('min-block-size:44px'),'Mobile touch target geometry missing');
assert(sharedUiCss.includes('.ui-select__native{')&&sharedUiCss.includes('color-scheme:var(--ui-native-scheme)')&&sharedUiCss.includes('.ui-select__native option,.ui-select__native optgroup'),'Shared UI must own native Select theme skin and option theme');
assert(sharedUiCss.includes('html[data-theme=light]{--ui-native-scheme:light}')&&sharedUiCss.includes('--ui-native-scheme:dark'),'Native Select must resolve explicit light/dark color schemes');
assert(sharedUiCss.includes('dialog.dialog{')&&sharedUiCss.includes('overflow:hidden')&&sharedUiCss.includes('dialog.dialog>.dialog__body'),'Shared UI must own Dialog shell/scroll policy');

const transfer=text('webui/private/scripts/transfer.js'),transferCss=text('webui/private/css/transfer.css'),ui=text('webui/private/scripts/ui.js');
assert(transfer.includes('W.Transfer=')&&transfer.includes('W.TransferRuntime=')&&transfer.includes('transfer-stats-dialog'),'Canonical Transfer owner missing');
assert(transfer.includes('minuteBuckets')&&transfer.includes('BUCKET_MAX=720')&&transfer.includes("value:'43200'")&&transfer.includes("label:'12 h'"),'Bounded 12-hour Transfer history contract missing');
assert(transfer.includes('RAW_MAX=900')&&(transfer.match(/setInterval\(/g)||[]).length===1,'Transfer must keep bounded raw history and one metadata interval');
assert(transfer.includes('native:true')&&transfer.includes("value:'Auto'")&&transfer.includes("value:'GiB/s'")&&transfer.includes("input.step='any'"),'Transfer modal unit/window dropdown and precision contract missing');
assert(transfer.includes('getAltSpeedLimits()')&&transfer.includes('setAltSpeedLimits(')&&!transfer.includes('prefs.alt_dl_limit'),'Transfer UI must consume normalized ALT rate APIs only');
assert(transfer.includes('await loadLimits();if(!dialog.open)dialog.showModal()'),'Rate dialog must load authoritative limits before becoming interactive');
assert(!transferCss.includes('.ui-select__native'),'Transfer stylesheet must not duplicate canonical native Select skin');
assert(transferCss.includes('--ui-select-h:34px')&&transferCss.includes('--dialog-width:500px'),'Transfer may provide only Select/Dialog geometry through shared custom properties');
assert(!transferCss.includes('overflow-y:auto')&&!transferCss.includes('overflow-x:hidden'),'Transfer stylesheet must not reclaim generic Dialog scroll ownership');
assert(!ui.includes('C.selectControl=function')&&!ui.includes('setRowHeight('),'UiSystem must not redefine Select or adaptive row height');

const logs=text('webui/private/scripts/logs.js'),polish=text('webui/private/scripts/polish.js'),polishCss=text('webui/private/css/polish.css');
assert(logs.includes('W.Logs=')&&logs.includes('weigg:route-state'),'Logs owner/lifecycle missing');
assert(polish.includes('W.PolishRuntime=')&&!polishCss.includes('.statusbar{display:grid'),'Polish must not own shell geometry');
const progress=text('webui/private/css/progress.css');assert(progress.includes('@media(prefers-reduced-motion:reduce)')&&progress.includes('html[data-motion="reduced"]'),'Progress motion must honor reduced motion');
const session=text('webui/private/scripts/session.js');assert(session.includes('auth/logout')&&session.includes('probeSession')&&session.includes('pageshow')&&session.includes('weigg.logoutGuard'),'Session logout/BFCache contract missing');
console.log(`Semantic runtime contract passed: ${runtimeFiles.length} runtime files; current-only repository naming, qB capability facts and single-owner Route/Settings/Selection/Transfer/Privacy/Layout/Select/Dialog/Facet/Connection contracts aligned.`);
