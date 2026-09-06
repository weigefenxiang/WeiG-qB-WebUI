import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const index=read('webui/private/index.html');
const layout=read('webui/private/css/layout.css');
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
const i18n=read('webui/private/scripts/i18n.js');

// Mobile navigation follows Desktop information architecture without duplicating the canonical Header Search.
const bottom=index.match(/<nav id="mobile-bottom-nav"[\s\S]*?<\/nav>/)?.[0]||'';
const routes=[...bottom.matchAll(/data-route="([^"]*)"/g)].map(m=>m[1]);
assert(JSON.stringify(routes)===JSON.stringify(['','rss','logs','settings']),`Mobile bottom route order must be Torrents/RSS/Logs/Settings: ${JSON.stringify(routes)}`);
assert(!bottom.includes('data-route="search"'),'Mobile bottom navigation must not duplicate Header Search');
assert((index.match(/id="search-input"/g)||[]).length===1,'Canonical Torrent Search input must remain unique');

// Torrent detail density is responsive presentation of the existing semantic nodes.
assert(index.includes('id="detail-context-slot"')&&index.includes('class="detail-state-row"'),'Mobile detail must provide one adaptive Back/status row slot');
assert((index.match(/id="detail-state"/g)||[]).length===1&&(index.match(/id="detail-progress-bar"/g)||[]).length===1,'Detail status/progress must retain one semantic DOM owner');
assert(navigation.includes("target=mobile&&slot?slot:tabs")&&navigation.includes("label.textContent=mobile?'Back':'Back to torrents'"),'Navigation must move the same Back control between Mobile status row and Desktop tabs');
assert(!navigation.includes('cloneNode'),'Adaptive Back presentation must not duplicate the navigation control');
assert(layout.includes('#detail-view .detail-hero .eyebrow{display:none}')&&layout.includes('grid-template-columns:repeat(5,minmax(0,1fr))'),'Mobile detail must hide eyebrow and keep all five tabs on one row');
assert(layout.includes('[data-tab="webseeds"]::after{content:"HTTP"'),'Mobile Web Seeds tab must use the compact HTTP label');
assert(layout.includes("font-size:calc(19px + var(--font-scale-offset))")&&layout.includes('#detail-title.is-expanded'),'Mobile Torrent title must be 2px smaller than prior narrow title and support explicit expansion');
assert(responsive.includes("dataset.detailTitleAction='copy-expand'")&&responsive.includes("addEventListener('dblclick'")&&responsive.includes('navigator.clipboard')&&responsive.includes('W.toast'),'Torrent title must use canonical single-copy / double-expand interaction with Feedback');
const createsLegacyHoverMetadata=/\.dataset\.tooltip\s*=|setAttribute\(\s*['"]data-tooltip['"]|\.title\s*=|setAttribute\(\s*['"]title['"]/.test(responsive);
assert(!createsLegacyHoverMetadata,'Responsive presentation must not create native title/data-tooltip hover metadata; cleanup via removeAttribute remains allowed');

// Settings remove redundant chrome/copy, restore Speed semantics, and adapt long descriptions without a second control system.
assert(settingsCss.includes('#settings-view>.settings-header>div:first-child{display:none}'),'Mobile Settings title/description block must be retired from presentation');
assert(settingsCss.includes('grid-template-columns:minmax(0,1fr) auto')&&!settingsCss.includes('@media(max-width:560px){.settings-header__actions{grid-template-columns:1fr}'),'Mobile Search and Save must remain on the same row at narrow widths');
assert(index.includes('id="save-settings-btn"')&&(index.match(/id="save-settings-btn"/g)||[]).length===1,'Settings must retain exactly one Save button');
assert(settings.includes("save.hidden=ctx.tab==='about'")&&settings.includes('weiggDraft')&&settings.includes('async function saveWeiG()')&&settings.includes("if(controller.tab==='weigg')return saveWeiG()"),'WeiG and qB Settings must share the canonical Save entry while keeping separate persistence targets');
assert(settings.includes('await client.setPreferences(pending)')&&settings.includes('controller.prefs=await client.getPreferences()'),'qB Save must retain write plus verification readback');
assert(i18n.includes("'settings.save':'Save'")&&i18n.includes("'settings.save':'保存'"),'Settings Save label must be compact in English and Simplified Chinese');
assert(!index.includes('settings-add-torrent')&&!settings.includes('settings-add-torrent'),'Settings must not introduce a duplicate Add Torrent surface');
assert(!settings.includes('Only Preferences returned by this qBittorrent instance are shown.')&&!settings.includes('只显示当前 qBittorrent 实际返回的 Preferences。'),'Repeated qB Preference subtitle must be removed completely');
assert(settingsSchema.includes("'speed'")&&settingsSchema.includes("add('speed','global','number',['dl_limit','up_limit','alt_dl_limit','alt_up_limit'])"),'Speed must be a canonical SettingsSchema surface');
assert(settings.includes('function ensureSpeedTab()')&&settings.includes("button.dataset.settingsTab='speed'"),'Settings owner must expose Speed without a parallel runtime owner');
assert(settings.includes('syncAdaptiveRows')&&settings.includes("row.classList.add('is-stacked')")&&settingsCss.includes('.setting-row.is-stacked'),'Long mobile descriptions must stack the canonical control below the copy');
assert(settingsCss.includes('.setting-row.is-stacked .setting-control-slot>.ui-select')&&settingsCss.includes('--ui-select-width:100%'),'Stacked mobile Select must use the available row width');
assert(settings.includes('W.Time.displayLabel(x.value)'),'Timezone labels must continue using the existing time owner instead of rewritten presentation copy');

// RSS keeps the canonical feed URL/search entry immediately before Add Feed, with Refresh after it.
const rssForm=index.match(/<section id="rss-view"[\s\S]*?<div id="rss-content"/)?.[0]||'';
assert(rssForm.indexOf('id="rss-url"')>=0&&rssForm.indexOf('id="rss-add-btn"')>rssForm.indexOf('id="rss-url"')&&rssForm.indexOf('id="rss-refresh-btn"')>rssForm.indexOf('id="rss-add-btn"'),'Mobile RSS controls must remain URL/search entry, Add Feed, Refresh in that order');

// Logs reuse one filter/follow state while making the mobile toolbar compact and searchable on demand.
assert(logs.includes("follow.dataset.shortLabel")&&logs.includes("'最新'")&&logs.includes("'Latest'"),'Mobile Follow latest must expose compact localized copy');
assert(logs.includes("toolbar.classList.toggle('is-search-open')")&&logs.includes("searchToggle.textContent=open?'×':'⌕'"),'Narrow Logs Search must expand from one icon without duplicating query state');
assert(logsCss.includes('.logs-search{grid-column:1;height:38px;min-height:38px')&&logsCss.includes('@media(max-width:680px)'),'Mobile Logs Search must use canonical one-line height and collapse to the icon across common Android phone widths');
assert(logsCss.includes('.logs-toolbar.is-search-open .logs-search{display:flex;grid-column:1/-1;grid-row:2}')&&logsCss.includes('.logs-toolbar.is-search-open .logs-filters{grid-column:2;grid-row:1}'),'Expanded narrow Logs Search must open below without moving the filter controls');
assert(logsCss.includes('.logs-follow::after{content:attr(data-short-label)'),'Mobile follow copy must use the compact visible label');

// Mobile Torrent progress is one canonical bar below metadata with the real percentage immediately to its right.
assert(components.includes("cluster.className='mobile-card-progress'")&&components.includes("number.textContent=built.visual.percent+'%'"),'Mobile Torrent card must compose progress bar and percentage together');
assert(!components.includes('progress-track--mobile-edge')&&!progressCss.includes('progress-track--mobile-edge'),'Retired duplicate bottom-edge progress presentation must not return');
assert(progressCss.includes('.mobile-card-meta--rail{display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto auto!important'),'Mobile progress must occupy its own row below Torrent metadata');
assert(progressCss.includes('.mobile-card-progress{width:100%;max-width:none;min-width:0;margin-left:0;grid-template-columns:minmax(0,1fr) max-content'),'Mobile progress percentage must remain to the right of the canonical full-width bar');

// Mobile pager and actions remain one row, growing labels first and shrinking typography only on very narrow screens.
const pagerColumns=layout.match(/#list-view \.pager\{[^}]*grid-template-columns:minmax\((\d+)px,auto\) minmax\(0,1fr\)/);
const pagerLabel=layout.match(/#page-label\{[^}]*max-width:(\d+)px/);
assert(pagerColumns&&pagerLabel&&Number(pagerColumns[1])<=128&&Number(pagerLabel[1])<=76,'Mobile pager and selection actions must share one content-bounded row that reserves room for all four actions');
assert(layout.includes("#torrent-selection-toolbar .btn{flex:1 1 0;min-width:0")&&layout.includes('font-size:clamp(11px,2.95vw,13px)'),'Mobile selection actions must have distinct flexible hit regions with readable labels');
assert(layout.includes('@media(max-width:350px)')&&layout.includes('grid-template-columns:minmax(112px,auto) minmax(0,1fr)')&&layout.includes('font-size:8.5px'),'Only very narrow Android widths may reduce pager/action typography further');

// Mobile Drawer reuses the real Desktop status nodes and locks the lower telemetry/version zones outside the filter scroll owner.
assert(responsive.includes("moveNode(torrents,primary)")&&responsive.includes("moveNode(storage,primary)")&&responsive.includes("moveNode(capsule,transfer)")&&responsive.includes("moveNode(connection,transfer)"),'Mobile Drawer must move, not copy, canonical Desktop status nodes');
assert(!responsive.includes('cloneNode'),'Mobile Drawer status adaptation must not clone semantic DOM owners');
assert(responsive.includes('W.Transfer.mountCompactChart')&&transfer.includes('function mountCompactChart(host)'),'Mobile Drawer must consume the canonical Transfer presentation');
assert(transfer.includes('function drawRateChart(canvas,windowSeconds')&&transfer.includes('drawRateChart(canvas,300,180,100)'),'Full and compact transfer charts must share one renderer and bounded 5-minute data');
assert(transfer.includes("limitButton.onclick=openLimits")&&transfer.includes("statsButton.onclick=openStats"),'Drawer transfer controls must keep existing stats/limit dialog actions');
assert(transferCss.includes('.mobile-drawer-telemetry__row--primary')&&transferCss.includes('.mobile-drawer-telemetry__row--transfer')&&transferCss.includes('.transfer-mini-chart__canvas'),'Mobile Drawer must present the requested two status rows plus compact chart');
assert(transferCss.includes('#sidebar{display:grid!important;grid-template-rows:minmax(0,1fr) auto auto!important')&&transferCss.includes('#sidebar>.sidebar__section:first-child{grid-row:1;min-height:0;overflow-y:auto!important')&&transferCss.includes('.mobile-drawer-telemetry{display:grid!important;grid-row:2!important')&&transferCss.includes('.sidebar__meta{grid-row:3!important;order:30;align-self:end'),'Mobile Drawer must have one scrolling filter zone, fixed telemetry row, and bottom-pinned qB/WebAPI metadata');

console.log('Mobile density contract passed: compact detail hierarchy, adaptive Settings, stable Logs filters, bottom progress, one-row pager actions, and fixed lower Drawer telemetry with version metadata pinned last.');
