import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const index=read('webui/private/index.html');
const app=read('webui/private/scripts/app.js');
const components=read('webui/private/scripts/components.js');
const spatial=read('webui/private/scripts/spatial.js');
const capabilities=read('webui/private/scripts/capabilities.js');
const capabilityData=JSON.parse(read('webui/private/data/capabilities.json'));
const responsive=read('webui/private/scripts/responsive.js');
const polish=read('webui/private/scripts/polish.js');
const selection=read('webui/private/scripts/selection.js');
const floating=read('webui/private/scripts/floating.js');
const ui=read('webui/private/scripts/ui.js');
const layout=read('webui/private/scripts/layout.js');
const header=read('webui/private/scripts/header.js');
const torrentSemantics=read('webui/private/scripts/torrent-semantics.js');
const progressCss=read('webui/private/css/progress.css');
const layoutCss=read('webui/private/css/layout.css');
const spatialCss=read('webui/private/css/spatial.css');
const polishCss=read('webui/private/css/polish.css');
const uiCss=read('webui/private/css/ui.css');
const headerCss=read('webui/private/css/header.css');
const docs=read('docs/008.Torrent工作区与状态所有权.md');

// Workspace information architecture: one Sidebar facet owner, no summary/command/facet duplicates or retired focus mode.
for(const token of ['filter-shelf','tracker-nav','savepath-nav','category-nav','tag-nav','page-title','library-count-copy','last-refresh','qb-product-mark','mobile-command-slot','mobile-facet-slot','mobile-summary','torrent-focus-slot']){
  assert(!index.includes(token),`Retired Torrent workspace DOM survived: ${token}`);
}
for(const id of ['dl-speed','up-speed','connection-status','network-meta','torrent-count','page-range']){
  assert(!index.includes(`id="${id}"`),`Retired summary leaf survived: ${id}`);
}
for(const token of ['facet-controls','sidebar-facet-slot','torrent-selection-toolbar','torrent-action-slot','mobile-pager-actions-slot','status-connection','data-header-add-short']){
  assert(index.includes(token),`Canonical Torrent workspace node missing: ${token}`);
}
assert((index.match(/id="facet-controls"/g)||[]).length===1,'Facet controls must have one DOM owner');
assert(index.includes('id="sidebar-facet-slot"')&&index.indexOf('id="filter-nav"')<index.indexOf('id="sidebar-facet-slot"'),'Facets must remain below Torrent state filters in Sidebar/Drawer');
assert((index.match(/id="torrent-selection-toolbar"/g)||[]).length===1,'Selection toolbar must have one DOM owner');
assert((index.match(/id="search-input"/g)||[]).length===1,'Torrent Search must have one canonical input');
assert((index.match(/connection-indicator__dot/g)||[]).length===1,'ConnectionIndicator must have one explicit marker');
assert((index.match(/id="(?:resume-btn|pause-btn|more-actions-btn|delete-btn)"/g)||[]).length===4,'Torrent Selection toolbar must expose exactly Start/Pause/More/Delete');
assert(!/[⤢⤡]/.test(index),'Retired Torrent expand/focus glyph survived in canonical HTML');

// Private/PT semantics remain semantic and canonical.
const semanticSandbox={URL};
semanticSandbox.window={WeiG:{util:{normalizeTracker(raw){const value=String(raw||'').trim();if(!value)return'';try{const u=new URL(value);return `${u.protocol}//${u.hostname}${u.port?':'+u.port:''}${u.pathname||'/'}`;}catch{return value.split('?')[0].split('#')[0];}}}}};
vm.runInNewContext(torrentSemantics,semanticSandbox,{filename:'torrent-semantics.js'});
const TorrentSemantics=semanticSandbox.window.WeiG.TorrentSemantics;
assert(TorrentSemantics&&typeof TorrentSemantics.isPrivateOrPt==='function','TorrentSemantics must expose isPrivateOrPt');
assert(TorrentSemantics.isPrivate({private:true})&&TorrentSemantics.isPrivate({private:1})&&TorrentSemantics.isPrivate({private:'1'}),'Private truthy forms must resolve as private');
assert(!TorrentSemantics.isPrivate({private:0}),'private=0 must not resolve as private');
assert(TorrentSemantics.isPt({tracker:'https://tracker.pt.example/announce'},['pt.example']),'PT subdomain must match configured domain');
assert(!TorrentSemantics.isPt({tracker:'https://notpt.example/announce'},['pt.example']),'Unrelated tracker must not match PT rule');
assert(TorrentSemantics.isPrivateOrPt({private:1,tracker:'https://public.example/announce'},[]),'Private flag must match union semantics');
assert(TorrentSemantics.isPrivateOrPt({private:0,tracker:'https://tracker.pt.example/announce'},['pt.example']),'PT tracker must match union semantics');

// Capability policy is local Registry data, never an adaptive request owner.
assert(capabilityData.schemaVersion===1&&capabilityData.features.privateFilter&&capabilityData.features.tags&&capabilityData.features.stalledFilter,'Capability JSON must own Private/Tags/Stalled policy');
assert(capabilityData.features.privateFilter.rule.qb.gte==='5.0.0','Private/PT qB5 boundary must remain declarative');
assert(capabilityData.features.tags.rule.webApi.gte==='2.3.0','Tags WebAPI boundary must remain declarative');
assert(capabilityData.features.stalledFilter.rule.webApi.gte==='2.4.1','Stalled WebAPI support boundary must remain declarative');
assert(capabilityData.webApiMilestones.some(x=>x.qb==='4.2.2'&&x.webApi==='2.4.1'),'Official qB 4.2.2 -> WebAPI 2.4.1 milestone must remain explicit');
assert(capabilityData.features.stalledFilter.presentation.requirements.qb==='4.2.5'&&capabilityData.features.stalledFilter.presentation.requirements.knownQb==='4.2.5','Stalled qB-facing presentation must use the conservative 4.2.5+ milestone without replacing support truth');
for(const token of ['matchRange','matchRule','badgeFor','requirementFacts','ruleLines','CapabilityRegistry'])assert(capabilities.includes(token),`CapabilityRegistry missing ${token}`);
assert(!capabilities.includes('new W.QBClient')&&!capabilities.includes('setInterval('),'CapabilityRegistry must not create a second client/poller');
assert(spatial.includes('C.selectControl(')&&spatial.includes("capability:'tags'"),'SpatialRuntime must compose canonical Facet Selects');
assert(!spatial.includes('mountForViewport')&&!spatial.includes('mobile-facet-slot'),'Facet presentation must not relocate by viewport');
assert(!spatial.includes('new W.QBClient')&&!spatial.includes('setInterval('),'SpatialRuntime must remain presentation-only');
assert(!spatialCss.includes('mobile-facet-slot'),'Retired mobile Facet shelf CSS survived');
assert(polishCss.includes('display:inline-flex!important')&&polishCss.includes('justify-content:flex-start!important')&&polishCss.includes('width:max-content!important')&&polishCss.includes('gap:7px!important'),'Capability badge/Tag Select must use one adjacent inline geometry instead of consuming the full row');

// LibraryController is the semantic source for count/sort/filter state.
assert(app.includes('W.LibraryController=LibraryController')&&app.includes('total:totalMatching')&&app.includes('setSort:setSort'),'LibraryController must expose total and sort semantics');
assert(selection.includes('W.LibraryController.total()')&&!selection.includes("getElementById('torrent-count')"),'Selection matching count must consume semantic total, not DOM text');
assert(ui.includes('W.LibraryController.setSort')&&!ui.includes('mobile-sort-bridge')&&!ui.includes('ensureSortCell')&&!ui.includes('restoreTempColumn'),'Mobile Sort must call canonical sort state directly');
assert(!ui.includes('localStorage.getItem(\'weigg.mobileSort\')'),'Mobile Sort must not keep a second sort state');

// Components own Torrent renderer/progress. Runtime replacement/patching is prohibited.
for(const token of ['C.torrentRow=function','C.mobileTorrentCard=function','C.progressVisual=progressVisual','C.progressTrack=function'])assert(components.includes(token),`Components missing canonical renderer/progress owner ${token}`);
assert(components.includes("progress.classList.add('progress-track--mobile-edge')"),'Mobile card must reuse canonical progress rail');
assert(components.includes("top.append(selectionHit(t,selected),titleLine,more)")||components.includes('top.append(selectionHit(t,selected),titleLine,more);'),'Mobile first line must be selection + title + More only');
assert(components.includes("percent>=100")&&components.includes("state:'complete'"),'Completed Torrent progress must normalize to the completed family before inactive state colors diverge');
assert(!ui.includes('C.torrentRow=function')&&!ui.includes('C.mobileTorrentCard=function')&&!ui.includes('__weiggTwoLineMobile')&&!ui.includes('__weiggRegistryRow'),'UiSystem must not replace canonical Torrent renderers');
assert(!responsive.includes('W.VirtualList=function')&&!responsive.includes('C.state=function'),'Responsive runtime must not replace VirtualList or semantic state projection');
assert(!layout.includes('W.DataGrid.template=function')&&!layout.includes('W.DataGrid.addResizeHandles=function'),'LayoutRuntime must not monkey-patch canonical DataGrid');
assert(progressCss.includes('.progress-track--mobile-edge')&&progressCss.includes('@media(prefers-reduced-motion:reduce)')&&progressCss.includes('html[data-motion="reduced"]'),'Canonical Torrent progress must provide Mobile rail and both Reduced Motion authorities');
assert(progressCss.includes('--progress-flow-duration:2.6s')&&progressCss.includes('inset 0 -2px'),'Progress skin must retain slow motion plus cylindrical lower shading');
assert(uiCss.includes('grid-template-columns:minmax(0,1fr)!important')&&uiCss.includes('grid-column:1!important')&&uiCss.includes('grid-row:2!important')&&uiCss.includes('.mobile-metric-more'),'Configured Mobile metrics and +N overflow summary must be geometrically locked to the second row');

// Adaptive placement moves existing controls only; telemetry summary/focus leaves are retired.
assert(responsive.includes("document.getElementById('mobile-pager-actions-slot')")&&responsive.includes('mountSelectionToolbar'),'Mobile pager must host the same canonical Selection toolbar');
assert(!responsive.includes('mobile-command-bar')&&!responsive.includes('mobile-filter-control')&&!responsive.includes('mobile-facet-slot'),'Retired Mobile command/filter/facet presentation survived');
for(const token of ['focusRegistry','setDataViewportFocus','registerDataViewport','installTorrentFocus','data-viewport-focus','is-data-focus'])assert(!responsive.includes(token),`Retired Torrent focus runtime survived: ${token}`);
for(const token of ['data-viewport-focus','is-data-focus','torrent-focus-slot'])assert(!layoutCss.includes(token),`Retired Torrent focus CSS survived: ${token}`);
assert(responsive.includes('W.TransferRuntime.snapshot()')&&!responsive.includes('network-meta'),'Connection help must consume TransferRuntime semantic snapshot after summary retirement');
assert(!app.includes("paintText('dl-speed'")&&!app.includes("paintText('up-speed'")&&!app.includes("getElementById('network-meta')"),'App must not paint retired summary leaves');
assert(!layoutCss.includes('mobile-summary')&&!layoutCss.includes('mobile-command-bar')&&!layoutCss.includes('mobile-facet-slot'),'Retired Mobile summary/command/facet layout CSS survived');
assert(layoutCss.includes('grid-template-columns:auto minmax(0,1fr)')&&layoutCss.includes('max-width:78px'),'Mobile pager must be content-sized so action rail receives the remaining width');

// Header owns Mobile Search/menu and utility presentation; app owns the one search semantic state.
assert(header.includes('mobile-search-btn')&&header.includes('setSearchOpen')&&header.includes("classList.toggle('search-open'"),'Header must own Mobile Search reveal presentation');
assert(header.includes('function setDrawer(')&&header.includes('function toggleDrawer(')&&header.includes('installDrawerToggle')&&header.includes("aria-expanded"),'HeaderUtilities must own one real Drawer toggle and expanded state');
assert(header.includes("scrim.addEventListener('click'")&&header.includes('setDrawer(false)'),'Drawer scrim must close through the same HeaderUtilities state setter');
assert(!app.includes("U.$('menu-btn').onclick")&&!app.includes("U.$('drawer-scrim').onclick")&&!app.includes('function openDrawer('),'App must not override the HeaderUtilities Drawer owner');
assert(app.includes('W.HeaderUtilities&&W.HeaderUtilities.setDrawer'),'App route/filter close caller must delegate to the HeaderUtilities Drawer owner');
assert(!app.includes('installMobileSearchButton'),'App must not own a second Mobile Search trigger');
assert(header.includes("valueNode.remove()")&&header.includes("chevron.remove()")&&header.includes('header-theme-trigger'),'Theme Header trigger must retain canonical Select behavior while removing visible value/chevron placeholder leaves');
assert(headerCss.includes('.topbar.search-open .topbar__search')&&headerCss.includes('top:calc(100% + 6px)')&&headerCss.includes('overflow:visible!important'),'Mobile Search must anchor below Topbar without clipping header actions');
assert(headerCss.includes('.header-theme-control .ui-select__trigger,.header-utility-action')&&headerCss.includes('place-items:center!important')&&headerCss.includes('box-sizing:border-box!important'),'Theme and utility controls must share one square visible geometry');
assert(headerCss.includes('.header-theme-trigger>*:not(.ui-select__prefix)'),'Theme utility must not expose hidden placeholder-width children');
assert(headerCss.includes('flex-wrap:nowrap')&&headerCss.includes('margin-left:auto'),'Desktop header end rail baseline must remain protected');

// Shared Select remains canonical.
assert(floating.includes("typeof opts.onOpen==='function'")&&floating.includes('opts.onOpen(value,w)===false'),'Canonical Select must expose reusable open guard');
assert(floating.includes('function internalMenuScroll(')&&floating.includes('if(internalMenuScroll(e))return;place(active)'),'Select internal scroll must stay separate from anchor placement');

// Durable connection marker remains one semantic signal and Reduced Motion compliant.
assert(layoutCss.includes('grid-template-areas:"torrent storage transfer connection message"'),'Desktop Statusbar geometry must remain canonical');
assert(layoutCss.includes('.connection-indicator[data-connection="connected"] .connection-indicator__dot')&&layoutCss.includes('box-shadow:none'),'Connection must render one canonical marker');
assert(!polish.includes("weigg:status-state"),'PolishRuntime must not become a Connection owner');

for(const rule of [
  'FACET-OWNER','PRESENTATION-STATE','TELEMETRY-PAINT','STATUS-NOISE','STATUS-DEDUP','STATUS-PLACEMENT','ADAPTIVE-STATUS','LIVE-INDICATOR','STATUS-SIGNAL','RENDERED-SIGNAL','MOTION-STATUS','STATUS-EXPLAIN','HEADER-SEARCH','HEADER-END-ANCHOR','CAPABILITY-OWNER','CAPABILITY-RANGE','OWNER-RETIRE','TORRENT-PROGRESS-OWNER','TORRENT-PROGRESS-TRUTH','TORRENT-PROGRESS-STATE','TORRENT-PROGRESS-MOTION','MOBILE-LIBRARY-IA','MOBILE-CONTROL-DENSITY','MOBILE-ACTION-PLACEMENT','MOBILE-CARD-COMPOSITION','SORT-OWNER','TORRENT-RENDERER-OWNER','TORRENT-FOCUS-RETIRE','MOBILE-PAGER-DENSITY'
])assert(docs.includes(rule),`Torrent workspace docs missing hard rule ${rule}`);

console.log('Torrent workspace ownership contract passed: exactly four actions, one Drawer owner, identical Header utilities, unified three-row full-semver capabilities, adjacent facets, true second-row Mobile metrics, compact pager, canonical renderers/progress, retired focus mode, and protected Connection owners.');
