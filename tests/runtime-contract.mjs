import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),runtimeBase=path.join(root,'webui/private');
function assert(ok,msg){if(!ok)throw new Error(msg);}
function text(p){return fs.readFileSync(path.join(root,p),'utf8');}
function walk(abs,rel=''){return fs.readdirSync(abs,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(abs,e.name),path.join(rel,e.name)):[path.join(rel,e.name).replaceAll('\\','/')]);}
const runtimeFiles=walk(runtimeBase),versioned=runtimeFiles.filter(p=>/(?:^|\/)(?:v\d{3}|[^/]+-v\d{3})(?:\.[^/]+)$/.test(p));
assert(versioned.length===0,`Versioned runtime assets remain: ${versioned.join(', ')}`);
const required=['css/app.css','css/spatial.css','css/transfer.css','css/progress.css','css/controls.css','css/layout.css','css/ui.css','css/polish.css','css/header.css','css/settings.css','css/feedback.css','scripts/core.js','scripts/feedback.js','scripts/qb-client.js','scripts/capabilities.js','scripts/components.js','scripts/floating.js','scripts/torrent-semantics.js','scripts/settings.js','scripts/session.js','scripts/spatial.js','scripts/transfer.js','scripts/responsive.js','scripts/selection.js','scripts/layout.js','scripts/ui.js','scripts/polish.js','scripts/app.js','scripts/ux.js','scripts/header.js','scripts/logs.js','data/capabilities.json'];
required.forEach(p=>assert(fs.existsSync(path.join(runtimeBase,p)),`Missing semantic runtime asset ${p}`));
const index=text('webui/private/index.html');
assert(!/(?:src|href)=["'][^"']*(?:\/v\d{3}|-v\d{3}\.)/i.test(index),'Private index references a versioned runtime asset');
for(const layer of ['ui','polish','brand'])assert(index.includes(`data-weigg-layer="${layer}"`),`Private index missing semantic ${layer} layer metadata`);
assert(index.includes('scripts/capabilities.js?v=__WEIGG_GIT_SHA__'),'Private index must load canonical CapabilityRegistry');
assert(index.includes('scripts/feedback.js?v=__WEIGG_GIT_SHA__')&&index.includes('css/feedback.css?v=__WEIGG_GIT_SHA__'),'Private index must load canonical Feedback runtime and skin');
assert(index.indexOf('scripts/qb-client.js')<index.indexOf('scripts/capabilities.js')&&index.indexOf('scripts/capabilities.js')<index.indexOf('scripts/app.js'),'CapabilityRegistry must load after QBClient and before app');
assert(index.indexOf('scripts/core.js')<index.indexOf('scripts/feedback.js')&&index.indexOf('scripts/feedback.js')<index.indexOf('scripts/app.js'),'Feedback must load after core and before business callers');
const scriptFiles=runtimeFiles.filter(p=>p.startsWith('scripts/')&&p.endsWith('.js'));
let qbClientCreators=[];
for(const file of scriptFiles){const source=text('webui/private/'+file);assert(!source.includes('MutationObserver'),`${file} contains observer-driven runtime repair/ownership`);assert(!/(?:scripts|css)\/[A-Za-z0-9._-]*-v\d{3}\.(?:js|css)/.test(source),`${file} contains hidden versioned runtime loader`);const count=(source.match(/new W\.QBClient\s*\(/g)||[]).length;if(count)qbClientCreators.push([file,count]);}
assert(qbClientCreators.length===1&&qbClientCreators[0][0]==='scripts/app.js'&&qbClientCreators[0][1]===1,`Exactly app.js may create the detected QBClient: ${JSON.stringify(qbClientCreators)}`);

const design=text('DESIGN.md'),compatDocs=text('docs/002.兼容与实现状态.md'),archDocs=text('docs/003.项目架构.md'),uiDocs=text('docs/004.UI与缓存契约.md'),implementationDocs=text('docs/005.统一交互与设置系统.md'),workspaceDocs=text('docs/008.Torrent工作区与状态所有权.md');
assert(design.includes('Current Semantic Ownership'),'DESIGN authority must identify current semantic ownership without a versioned ownership label');
for(const token of ['COMPAT-DEGRADE-001','PERF-COMPAT-001','PROGRESSIVE-DATA-001','TIMESERIES-001','INTERACTION-TEST-001','CONTROL-SKIN-001','DIALOG-SCROLL-001','NATIVE-THEME-001','OWNER-RETIRE-001','CURRENT-ONLY-001','FILE-NAMING-001','TEST-CURRENT-001','CAPABILITY-OWNER-001','CAPABILITY-RANGE-001','CAPABILITY-COST-001','RENDERED-SIGNAL-001','HEADER-END-ANCHOR-001','STATUS-EXPLAIN-001','FEEDBACK-OWNER','FEEDBACK-TRUTH','FEEDBACK-STACK','FEEDBACK-EXIT','FEEDBACK-ADAPTIVE','FEEDBACK-NOISE','FEEDBACK-THEME','FEEDBACK-A11Y','FEEDBACK-RETIRE'])assert(design.includes(token),`DESIGN hard rule missing ${token}`);
for(const token of ['ROUTE-OWNER-001','RATE-UNIT-001','LAYOUT-OWNER-001','EXACT-HEAD-001','CONTROL-SKIN-001','DIALOG-SCROLL-001','NATIVE-THEME-001','OWNER-RETIRE-001','CAPABILITY-OWNER-001','FEEDBACK-OWNER','FEEDBACK-TRUTH','FEEDBACK-RETIRE'])assert(archDocs.includes(token),`Architecture docs missing ${token}`);
for(const token of ['SELECT-TOPLAYER-001','SELECT-SCROLL-001','INTERACTION-TEST-001','PROGRESSIVE-DATA-001','CONTROL-SKIN-001','DIALOG-SCROLL-001','NATIVE-THEME-001','HEADER-SEARCH-001','HEADER-END-ANCHOR-001','RENDERED-SIGNAL-001','FEEDBACK-OWNER','FEEDBACK-STACK','FEEDBACK-EXIT','FEEDBACK-ADAPTIVE','FEEDBACK-THEME','FEEDBACK-A11Y'])assert(uiDocs.includes(token),`UI/cache contract missing ${token}`);
for(const token of ['EXACT-HEAD-001','qB4 Private click','12 h','ALT Apply','CONTROL-SKIN-001','DIALOG-SCROLL-001','NATIVE-THEME-001','CAPABILITY-RANGE-001','STATUS-EXPLAIN-001','FEEDBACK-OWNER','FEEDBACK-TRUTH','FEEDBACK-RETIRE'])assert(implementationDocs.includes(token),`Current implementation notes missing ${token}`);
assert(implementationDocs.includes('live.sh')&&implementationDocs.includes('live-api.sh'),'Current implementation notes must use stable LIVE script names');
for(const token of ['qBittorrent 5.0.0+','WebAPI 2.3.0+','0 legacy Private tracker scan'])assert(compatDocs.includes(token),`Compatibility docs missing current upstream fact ${token}`);
assert(compatDocs.includes('5.2.3')&&/synthetic|哨兵|sentinel/i.test(compatDocs),'Compatibility docs must preserve release-fixture/forward-sentinel policy');
for(const token of ['FACET-OWNER-001','PRESENTATION-STATE-001','TELEMETRY-PAINT-001','STATUS-NOISE-001','STATUS-DEDUP-001','STATUS-PLACEMENT-001','ADAPTIVE-STATUS-001','LIVE-INDICATOR-001','STATUS-SIGNAL-001','MOTION-STATUS-001','HEADER-UTILITY-001','HEADER-SEARCH-001','SELECT-SCROLL-001','RENDERED-SIGNAL-001','HEADER-END-ANCHOR-001','STATUS-EXPLAIN-001','CAPABILITY-OWNER-001','CAPABILITY-RANGE-001','CAPABILITY-BADGE-001','CAPABILITY-DIALOG-001','CAPABILITY-COST-001','CAPABILITY-VISIBLE-001','CAPABILITY-EXCEPTION-001','OWNER-RETIRE-001'])assert(workspaceDocs.includes(token),`Workspace docs missing hard rule ${token}`);

const components=text('webui/private/scripts/components.js'),floating=text('webui/private/scripts/floating.js');
assert(components.includes('selectionHit')&&components.includes('privacyBadge'),'Canonical torrent presentation primitives missing');
for(const token of ['upgradeNativeSelect','upgradeNativeSelects','ui-select-upgraded'])assert(!components.includes(token),`Components still contains automatic Select upgrade ${token}`);
assert(floating.includes('C.selectControl=function')&&floating.includes('opts.native===true')&&floating.includes('ui-select--native')&&floating.includes('ui-select--intrinsic'),'Canonical Select must own native/floating modes');
assert(floating.includes('function internalMenuScroll(')&&floating.includes('if(internalMenuScroll(e))return;place(active)'),'Floating Select must ignore its own options scroll for anchor placement');
const settings=text('webui/private/scripts/settings.js'),settingsCss=text('webui/private/css/settings.css');
assert(settings.includes("className='setting-row'")&&settings.includes('weigg:settings-render'),'Canonical Settings lifecycle missing');
assert(settings.includes('C.selectControl(opts)')&&!settings.includes("createElement('select')"),'Settings must use canonical Select');
assert(!settings.includes("global.addEventListener('hashchange'")&&!settings.includes('W.Router.route'),'Settings must not own routes');
assert(settingsCss.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'Settings two-column contract missing');

const capabilityData=JSON.parse(text('webui/private/data/capabilities.json')),capabilities=text('webui/private/scripts/capabilities.js');
assert(capabilityData.schemaVersion===1&&capabilityData.features.privateFilter.rule.qb.gte==='5.0.0','Capability data must own Private/PT qB5 range');
assert(capabilityData.features.tags.rule.webApi.gte==='2.3.0','Capability data must own Tags WebAPI range');
for(const token of ['function compare(','function matchRange(','function matchRule(','function badgeFor(','W.CapabilityRegistry=api'])assert(capabilities.includes(token),`CapabilityRegistry missing ${token}`);
for(const token of ['range.eq','range.gt','range.gte','range.lt','range.lte'])assert(capabilities.includes(token),`CapabilityRegistry range operator missing ${token}`);
assert(capabilities.includes('rule.all')&&capabilities.includes('rule.any')&&capabilities.includes('rule.not'),'CapabilityRegistry compound/exception rules missing');
assert(capabilities.includes('webApiMilestones')&&capabilities.includes('milestoneForWebApi'),'Registry must translate raw WebAPI boundaries into known qB-facing badges');
assert(!capabilities.includes('new W.QBClient')&&!capabilities.includes('api/v2/')&&!capabilities.includes('setInterval('),'CapabilityRegistry must not own API or polling');

const app=text('webui/private/scripts/app.js'),spatial=text('webui/private/scripts/spatial.js'),responsive=text('webui/private/scripts/responsive.js'),polish=text('webui/private/scripts/polish.js'),selection=text('webui/private/scripts/selection.js'),logs=text('webui/private/scripts/logs.js'),ui=text('webui/private/scripts/ui.js');
assert(app.includes('W.AppState=app')&&app.includes('selection:W.Selection')&&app.includes('W.LibraryController=LibraryController'),'App state/Selection/Library owners missing');
assert(app.includes('W.CapabilityRegistry')&&app.includes("capabilitySupported('privateFilter'")&&app.includes("capabilitySupported('tags'"),'App must delegate user-facing capability decisions');
assert(!app.includes('data-capability-min')&&!app.includes('This feature requires qBittorrent 5.0.0'),'App must not duplicate capability badge/dialog copy');
assert(app.includes("global.addEventListener('weigg:maindata'")&&app.includes('paintNetworkMeta'),'DHT/Peers must consume maindata lifecycle');
assert(app.includes('pageSize+1')&&app.includes('pager-index-spinner'),'Progressive pagination must use bounded look-ahead and loading state');
assert(app.includes('function totalMatching(){return app.catalogReady?app.catalog.filter(filterMatch).length:null;}'),'Catalog total count must filter without sorting full catalog');
const transferSlice=app.slice(app.indexOf('async function loadTransfer'),app.indexOf('async function buildCatalog'));
assert(transferSlice.includes('W.TransferRuntime.ingest(info)'),'Existing app transfer cycle must explicitly feed TransferRuntime');
assert(transferSlice.includes('emitStatusState(status)')&&transferSlice.includes("emitStatusState('error')")&&!transferSlice.includes('connection-status'),'Existing transfer poll must publish semantic connection state only');
assert(spatial.includes('C.selectControl(')&&spatial.includes("capability:'tags'")&&spatial.includes('capabilitiesReady'),'SpatialRuntime must compose facets and use the capability service');
assert(!spatial.includes('createElement(\'script\')')&&!spatial.includes('scripts/capabilities.js')&&!spatial.includes('ensureCapabilityDialog')&&!spatial.includes('W.CapabilityDialog={'),'SpatialRuntime must not own a fallback loader or capability Dialog');
for(const token of ['new W.QBClient','getMainData(','setInterval('])assert(!responsive.includes(token),`Responsive runtime owns business/API lifecycle ${token}`);
assert(responsive.includes("global.addEventListener('weigg:status-state'")&&responsive.includes('function paintConnection('),'MobileAdaptive must own Connection presentation');
assert(responsive.includes('function connectionReason(')&&responsive.includes('function openConnectionDialog(')&&responsive.includes('connectionSteps('),'Connection explanation/troubleshooting must belong to the Connection presenter');
assert(!responsive.includes('getTransferInfo(')&&!responsive.includes('getMainData('),'Connection explanation must reuse existing state without requests');
assert(!polish.includes('syncConnectionIndicator')&&!polish.includes('pulseConnection')&&!polish.includes("weigg:status-state"),'PolishRuntime must not be a second Connection owner');
assert(selection.includes('W.Selection=Selection')&&selection.includes('ActionRegistry')&&selection.includes('W.LibraryController&&W.LibraryController.state'),'Canonical Selection/ActionRegistry must consume semantic library state');
assert(!selection.includes('new W.QBClient')&&selection.includes('W.AppState')&&selection.includes('W.CapabilityRegistry.decorate'),'Selection must reuse app client and Registry-decorate capability actions');
assert(!selection.includes('refresh-btn'),'Selection must not retain retired manual Refresh fallback');
assert(!logs.includes('new W.QBClient')&&logs.includes('W.AppState')&&logs.includes("W.CapabilityRegistry.supports('logs')"),'Logs must reuse app client and capability policy');
assert(!ui.includes('refresh-btn')&&ui.includes('app.virtual.render'),'UiSystem must re-render canonical virtual list without retired Refresh caller');

const semantics=text('webui/private/scripts/torrent-semantics.js'),qb=text('webui/private/scripts/qb-client.js');
assert(semantics.includes('PRIVATE_PT')&&semantics.includes('metadata-pending')&&semantics.includes("source:'unsupported'"),'TorrentSemantics direct/unknown capability model missing');
for(const token of ['legacyTrackerEvidence','resolveMany','privacyCache','client.trackers'])assert(!semantics.includes(token),`Legacy Private emulation survived: ${token}`);
assert(qb.includes('privateFlag:this.major>=5'),'QBClient low-level Private endpoint fact must remain qB5+');
assert(qb.includes("tags:atLeast(v,'2.3.0')"),'QBClient low-level Tags endpoint fact must remain WebAPI 2.3.0');
assert(qb.includes('getAltSpeedLimits')&&qb.includes('*1024')&&qb.includes('setAltSpeedLimits')&&qb.includes('/1024'),'QBClient must normalize ALT KiB/s preferences to canonical B/s');

const layoutCss=text('webui/private/css/layout.css'),polishCss=text('webui/private/css/polish.css'),headerCss=text('webui/private/css/header.css'),sharedUiCss=text('webui/private/css/ui.css');
assert(layoutCss.includes('grid-template-areas:"torrent storage transfer connection message"'),'Statusbar semantic geometry missing');
assert(layoutCss.includes('.connection-indicator__dot{')&&layoutCss.includes('box-shadow:none')&&layoutCss.includes('connection-online-pulse'),'Canonical single animated Connection dot missing');
assert(!layoutCss.includes('[data-capability-min]'),'Retired capability-min CSS caller survived');
assert(!polishCss.includes('.connection-indicator::before')&&!polishCss.includes('.connection-indicator::after')&&!polishCss.includes('connectionPulse'),'Polish CSS still creates duplicate Connection signal');
assert(polishCss.includes('.capability-badge')&&polishCss.includes('.capability-dialog')&&polishCss.includes('.connection-dialog'),'Canonical capability/connection explanation skins missing');
assert(headerCss.includes('.topbar__actions{')&&headerCss.includes('margin-left:auto')&&headerCss.includes('.topbar__search{flex:0 1 320px'),'Header end anchor/bounded Search contract missing');
assert(sharedUiCss.includes('dialog.dialog{')&&sharedUiCss.includes('overflow:hidden'),'Shared Dialog primitive owner missing');
assert(sharedUiCss.includes('--ui-native-scheme:dark')&&/html\[data-theme=light\]\{[^}]*--ui-native-scheme:light(?:;|})/.test(sharedUiCss),'Native Select must resolve explicit Light/Dark schemes');
const transfer=text('webui/private/scripts/transfer.js');
assert(transfer.includes('W.Transfer=')&&transfer.includes('W.TransferRuntime=')&&transfer.includes('transfer-stats-dialog'),'Canonical Transfer owner missing');
assert(transfer.includes('BUCKET_MAX=720')&&transfer.includes("label:'12 h'")&&transfer.includes('RAW_MAX=900'),'Bounded 12-hour Transfer history contract missing');
assert((transfer.match(/setInterval\(/g)||[]).length===1,'Transfer must keep one metadata interval');
assert(transfer.includes('ingest:ingest')&&!transfer.includes('prototype.getTransferInfo')&&!transfer.includes('__weiggTransferRuntime'),'Transfer must use explicit ingest, not QBClient monkey patch');
assert(!transfer.includes('new W.QBClient')&&transfer.includes('W.AppState'),'Transfer must reuse the canonical detected app client');
assert(transfer.includes('native:true')&&transfer.includes("value:'Auto'")&&transfer.includes("value:'GiB/s'")&&transfer.includes("input.step='any'"),'Transfer modal unit/window precision contract missing');
assert(transfer.includes('getAltSpeedLimits()')&&transfer.includes('setAltSpeedLimits('),'Transfer UI must consume normalized ALT rate APIs');
console.log('Runtime contract passed: current-only assets, one detected qB client, stable current authority, range-driven capabilities, canonical feedback, explicit transfer ingest, one Connection owner/signal, end-anchored header, bounded transfer and docs authority.');
