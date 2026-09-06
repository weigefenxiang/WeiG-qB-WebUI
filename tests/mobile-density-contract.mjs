import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const index=read('webui/private/index.html');
const layout=read('webui/private/css/layout.css');
const spatial=read('webui/private/css/spatial.css');
const sharedUiCss=read('webui/private/css/ui.css');
const settingsCss=read('webui/private/css/settings.css');
const logsCss=read('webui/private/css/logs.css');
const progressCss=read('webui/private/css/progress.css');
const transferCss=read('webui/private/css/transfer.css');
const navigation=read('webui/private/scripts/navigation.js');
const responsive=read('webui/private/scripts/responsive.js');
const settings=read('webui/private/scripts/settings.js');
const settingsSchema=read('webui/private/scripts/settings-schema.js');
const logs=read('webui/private/scripts/logs.js');
const components=read('webui/private/scripts/components.js');
const transfer=read('webui/private/scripts/transfer.js');
const floating=read('webui/private/scripts/floating.js');
const ui=read('webui/private/scripts/ui.js');
const header=read('webui/private/scripts/header.js');
const i18n=read('webui/private/scripts/i18n.js');

// Mobile navigation follows Desktop information architecture and shares one Header Search input.
const bottom=index.match(/<nav id="mobile-bottom-nav"[\s\S]*?<\/nav>/)?.[0]||'';
const routes=[...bottom.matchAll(/data-route="([^"]*)"/g)].map(m=>m[1]);
assert(JSON.stringify(routes)===JSON.stringify(['','rss','logs','settings']),`Mobile bottom route order must be Torrents/RSS/Logs/Settings: ${JSON.stringify(routes)}`);
assert(!bottom.includes('data-route="search"'),'Mobile bottom navigation must not duplicate Header Search');
assert((index.match(/id="search-input"/g)||[]).length===1,'Canonical Header Search input must remain unique');
assert(header.includes('function searchRoute()')&&header.includes('function routeSearchInput(event)'),'Header must own route-aware Search dispatch presentation');

// Torrent detail density is responsive presentation of the existing semantic nodes.
assert(index.includes('id="detail-context-slot"')&&index.includes('class="detail-state-row"'),'Mobile detail must provide one adaptive Back/status row slot');
assert((index.match(/id="detail-state"/g)||[]).length===1&&(index.match(/id="detail-progress-bar"/g)||[]).length===1,'Detail status/progress must retain one semantic DOM owner');
assert(navigation.includes("target=mobile&&slot?slot:tabs")&&navigation.includes("label.textContent=mobile?'Back':'Back to torrents'"),'Navigation must move the same Back control between Mobile status row and Desktop tabs');
assert(!navigation.includes('cloneNode'),'Adaptive Back presentation must not duplicate the navigation control');
assert(layout.includes('#detail-view .detail-hero .eyebrow{display:none}')&&layout.includes('grid-template-columns:repeat(5,minmax(0,1fr))'),'Mobile detail must hide eyebrow and keep all five tabs on one row');
assert(layout.includes('[data-tab="webseeds"]::after{content:"HTTP"'),'Mobile Web Seeds tab must use the compact HTTP label');
assert(layout.includes("font-size:calc(19px + var(--font-scale-offset))")&&layout.includes('#detail-title.is-expanded'),'Mobile Torrent title must support compact ellipsis plus explicit expansion');
assert(responsive.includes("dataset.detailTitleAction='copy-expand'")&&responsive.includes("addEventListener('dblclick'")&&responsive.includes('navigator.clipboard')&&responsive.includes('W.toast'),'Torrent title must use canonical single-copy / double-expand interaction with Feedback');
const createsLegacyHoverMetadata=/\.dataset\.tooltip\s*=|setAttribute\(\s*['"]data-tooltip['"]|\.title\s*=|setAttribute\(\s*['"]title['"]/.test(responsive);
assert(!createsLegacyHoverMetadata,'Responsive presentation must not create native title/data-tooltip hover metadata; cleanup via removeAttribute remains allowed');

// Settings preserve their existing responsive single-owner behavior.
assert(settingsCss.includes('#settings-view>.settings-header>div:first-child{display:none}'),'Mobile Settings title/description block must be retired from presentation');
assert(settingsCss.includes('grid-template-columns:minmax(0,1fr) auto')&&!settingsCss.includes('@media(max-width:560px){.settings-header__actions{grid-template-columns:1fr}'),'Mobile Search and Save must remain on the same row at narrow widths');
assert(index.includes('id="save-settings-btn"')&&(index.match(/id="save-settings-btn"/g)||[]).length===1,'Settings must retain exactly one Save button');
assert(settings.includes("save.hidden=ctx.tab==='about'")&&settings.includes('weiggDraft')&&settings.includes('async function saveWeiG()')&&settings.includes("if(controller.tab==='weigg')return saveWeiG()"),'WeiG and qB Settings must share the canonical Save entry while keeping separate persistence targets');
assert(settings.includes('await client.setPreferences(pending)')&&settings.includes('controller.prefs=await client.getPreferences()'),'qB Save must retain write plus verification readback');
assert(i18n.includes("'settings.save':'Save'")&&i18n.includes("'settings.save':'保存'"),'Settings Save label must be compact in English and Simplified Chinese');
assert(!index.includes('settings-add-torrent')&&!settings.includes('settings-add-torrent'),'Settings must not introduce a duplicate Add Torrent surface');
assert(settingsSchema.includes("'speed'")&&settingsSchema.includes("add('speed','global','number',['dl_limit','up_limit','alt_dl_limit','alt_up_limit'])"),'Speed must remain a canonical SettingsSchema surface');
assert(settings.includes('function ensureSpeedTab()')&&settings.includes("button.dataset.settingsTab='speed'"),'Settings owner must expose Speed without a parallel runtime owner');
assert(settings.includes('syncAdaptiveRows')&&settings.includes("row.classList.add('is-stacked')")&&settingsCss.includes('.setting-row.is-stacked'),'Long mobile descriptions must stack the canonical control below the copy');
assert(settings.includes('W.Time.displayLabel(x.value)'),'Timezone labels must continue using the existing time owner');

// RSS has no page-local Search. Header actions move the existing Refresh and open a canonical Add Feed dialog.
assert(!ui.includes('rss-search-input')&&!ui.includes('installRSSSearch'),'RSS page-local Search must remain retired');
assert(ui.includes('W.RSS={setQuery:setRSSQuery')&&header.includes("if(route==='rss')")&&header.includes('W.RSS.setQuery(input.value)'),'RSS query must be owned semantically and driven by Header Search');
assert(ui.includes("rssOpenButton.id='rss-add-open-btn'")&&ui.includes("rssDialog.id='rss-add-dialog'")&&ui.includes('actions.append(rssOpenButton,refresh)'),'RSS Add Feed and Refresh must occupy the title header action rail');
assert(layout.includes('.rss-header-actions')&&layout.includes('.rss-add-dialog'),'RSS responsive geometry must live in canonical layout CSS');

// Logs remove local Search, keep one semantic row, and use the canonical Select without a second inset shell.
assert(!logs.includes('logs-search-toggle')&&!logs.includes('logs-search-input')&&!logsCss.includes('.logs-search-toggle')&&!logsCss.includes('.logs-search{'),'Logs must not render a local Search icon or input');
assert(logs.includes("W.Logs={setQuery:setQuery,query:function(){return state.query;}")&&header.includes("if(route==='logs')")&&header.includes('W.Logs.setQuery(input.value)'),'Logs query must be driven by Header Search');
assert(logs.includes("C.selectControl({id:'logs-size-mode'")&&logsCss.includes('.logs-actions .logs-size-mode{--ui-select-width:max-content'),'Logs size mode must remain one canonical Select with feature geometry only');
assert(logsCss.includes('.logs-filters>[data-log-type]')&&logsCss.includes('.logs-toolbar{display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:flex-start')&&logsCss.includes('.logs-toolbar>.logs-filters{')&&logsCss.includes('gap:0')&&logsCss.includes('overflow-x:auto'),'Mobile log levels must be a segmented list on one explicit non-wrapping horizontally scrollable toolbar row');
assert(logsCss.includes('.logs-refresh::before{content:"↻"'),'Narrow Mobile Logs must collapse Refresh to its icon without creating a second action');
assert(sharedUiCss.includes('#list-view .grid-toolbar .ui-select__trigger::before')&&!/(^|})\.grid-toolbar \.ui-select__trigger::before/.test(sharedUiCss),'Torrent-only inset Select skin must not leak into the Logs canonical Select');

// Mobile Torrent progress remains one canonical bar below metadata with the real percentage immediately to its right.
assert(components.includes("cluster.className='mobile-card-progress'")&&components.includes("number.textContent=built.visual.percent+'%'"),'Mobile Torrent card must compose progress bar and percentage together');
assert(!components.includes('progress-track--mobile-edge')&&!progressCss.includes('progress-track--mobile-edge'),'Retired duplicate bottom-edge progress presentation must not return');
assert(progressCss.includes('.mobile-card-meta--rail{display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto auto!important'),'Mobile progress must occupy its own row below Torrent metadata');
assert(progressCss.includes('.mobile-card-progress{width:100%;max-width:none;min-width:0;margin-left:0;grid-template-columns:minmax(0,1fr) max-content'),'Mobile progress percentage must remain to the right of the canonical full-width bar');

// Mobile pager/actions and More Actions retain usable, compact two-column geometry.
const pagerColumns=layout.match(/#list-view \.pager\{[^}]*grid-template-columns:minmax\((\d+)px,auto\) minmax\(0,1fr\)/);
const pagerLabel=layout.match(/#page-label\{[^}]*max-width:(\d+)px/);
assert(pagerColumns&&pagerLabel&&Number(pagerColumns[1])<=128&&Number(pagerLabel[1])<=76,'Mobile pager and selection actions must share one content-bounded row');
assert(layout.includes("#torrent-selection-toolbar .btn{flex:1 1 0;min-width:0")&&layout.includes('font-size:clamp(11px,2.95vw,13px)'),'Mobile selection actions must have distinct flexible hit regions with readable labels');
assert(layout.includes('#actions-dialog .action-grid{grid-template-columns:repeat(2,minmax(0,1fr))')&&layout.includes('font-size:clamp(12px,3.35vw,15px)'),'Mobile More Actions must be two columns with adaptive readable typography');
assert(layout.includes('@media(max-width:350px)')&&layout.includes('grid-template-columns:minmax(112px,auto) minmax(0,1fr)')&&layout.includes('font-size:8.5px'),'Only very narrow Android widths may reduce pager/action typography further');

// Mobile Drawer reuses real Desktop status nodes, uses two-column filters, readable facets, viewport-safe menus, and one 5-minute transfer default.
assert(responsive.includes("moveNode(torrents,primary)")&&responsive.includes("moveNode(storage,primary)")&&responsive.includes("moveNode(capsule,transfer)")&&responsive.includes("moveNode(connection,transfer)"),'Mobile Drawer must move, not copy, canonical Desktop status nodes');
assert(!responsive.includes('cloneNode'),'Mobile Drawer status adaptation must not clone semantic DOM owners');
assert(responsive.includes('host.append(chart,transfer,primary)'),'Drawer telemetry DOM must follow the visual/accessibility order chart -> transfer -> Torrent/storage');
assert(responsive.includes('W.Transfer.mountCompactChart')&&transfer.includes('function mountCompactChart(host)'),'Mobile Drawer must consume the canonical Transfer presentation');
assert(transfer.includes('function drawRateChart(canvas,windowSeconds')&&transfer.includes('drawRateChart(canvas,chartWindow,180,100)'),'Full and compact transfer charts must share one renderer and selected window state');
assert(transfer.includes("limitButton.onclick=openLimits")&&transfer.includes("statsButton.onclick=openStats"),'Drawer transfer controls must keep existing stats/limit dialog actions');
assert(!transfer.includes('data-mini-rate')&&transfer.includes("windowText.dataset.miniWindow='1'"),'Drawer chart must remove duplicate speed text and retain only synchronized window metadata');
assert(transfer.includes('compactChart=null,chartWindow=300')&&transfer.includes('chartWindow=Number(value)||300'),'Drawer and full Transfer dialog must share a 5-minute default window');
assert(transferCss.includes('.mobile-drawer-telemetry__row--primary')&&transferCss.includes('.mobile-drawer-telemetry__row--transfer')&&transferCss.includes('.transfer-mini-chart__canvas'),'Mobile Drawer must present canonical status rows plus chart');
assert(transferCss.includes('#sidebar{display:grid!important;grid-template-rows:minmax(0,1fr) auto!important')&&transferCss.includes('.sidebar__meta{display:none!important}'),'Mobile Drawer must retire qB/WebAPI/compat metadata from its visible layout');
assert(spatial.includes('#filter-nav{grid-template-columns:repeat(2,minmax(0,1fr))')&&spatial.includes('.facet-controls{grid-template-columns:repeat(2,minmax(0,1fr))'),'Android Drawer Torrent filters and all four facets must remain two-column');
assert(spatial.includes('font-size:clamp(13px,3.8vw,15px)')&&spatial.includes('font-size:clamp(12px,3.3vw,14px)'),'Android Drawer state and facet labels must be at least two CSS pixels larger than the retired compact typography');
assert(floating.includes("v.width<=820?.84:.68")&&floating.includes("scrollIntoView({block:'nearest'})"),'Canonical Select must use more Mobile visual viewport and keep the focused/selected option reachable');
assert(!transferCss.includes('@container mobile-drawer (max-height:650px)'),'Facet responsive ownership must stay in Spatial CSS rather than Transfer CSS');
assert(transferCss.includes('font-size:clamp(10px,3vw,13.5px)')&&transferCss.includes('.transfer-runtime-capsule__limits{width:30px;min-width:30px;flex:0 0 30px}'),'Mobile speeds must be larger while the rate-limit button keeps its reserved hit region');

console.log('Mobile density contract passed: readable two-column Drawer filters/facets, viewport-safe Select menus, 5-minute shared transfer default, segmented one-row Logs, and canonical responsive owners.');
