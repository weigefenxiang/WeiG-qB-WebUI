import fs from 'node:fs';
function read(p){return fs.readFileSync(p,'utf8');}
function assert(ok,msg){if(!ok)throw new Error(msg);}
const js=read('webui/private/scripts/ui-system-v037.js');
const css=read('webui/private/css/ui-system-v037.css');
const polishJs=read('webui/private/scripts/ui-polish-v037.js');
const polishCss=read('webui/private/css/ui-polish-v037.css');
const loader=read('webui/private/scripts/v037.js');
const adaptive=read('webui/private/scripts/adaptive-v036.js');
const core=read('webui/private/scripts/core.js');

for(const token of ['TorrentFieldRegistryV037','tags','num_seeds','num_leechs','save_path','added_on','completion_on','priority'])assert(js.includes(token),`shared torrent field registry missing ${token}`);
assert(js.includes('torrent-mobile-card--two-line')&&js.includes('mobile-card-meta--rail'),'mobile torrent renderer must own exactly two visual tracks');
assert(js.includes("return d==='compact'?66:d==='comfortable'?80:72"),'mobile torrent row height must remain dense and readable');
assert(js.includes('mobileFields()')&&js.includes('saveMobileFields'),'mobile visible fields must be persistent model state');
assert(js.includes("document.getElementById('columns-btn')")&&js.includes("grid-head-cell[data-key=\"")&&js.includes('applySort'),'mobile sorting must bridge the existing DataGrid/app sort path instead of creating a second torrent app');
assert(js.includes('setGlobalDownloadLimit')&&js.includes('setGlobalUploadLimit')&&js.includes('alt_dl_limit')&&js.includes('toggleAltSpeedMode'),'Transfer Capsule must control normal and ALT upload/download limits');
assert(js.includes('removeBottomTimezone')&&js.includes('[data-status-timezone]'),'desktop status timezone must be removed in favor of Settings');
assert(js.includes("addEventListener('dblclick'")&&js.includes("dialog.querySelector('.btn--danger')"),'dialog backdrop double-click policy must protect destructive confirms');
assert(js.includes('Original author: Christophe Dumez'),'About must distinguish qBittorrent upstream attribution');
assert(js.includes('is-user-spin')&&js.includes('is-user-flip')&&js.includes('AmbientMark'),'brand interaction must extend the reusable AmbientMark module');

assert(css.includes('.ui-select__chevron{display:none!important}'),'Select must not depend on a permanent chevron');
assert(css.includes('width:max-content!important')&&css.includes('.ui-select__trigger'),'Select trigger must use intrinsic content width');
assert(css.includes('[data-v036-timezone] .timezone-select .ui-select__value::before')&&css.includes('content:"✓"'),'Settings timezone must keep the selected marker inline with the current zone');
assert(css.includes('.ui-select__option[aria-selected="true"]::before'),'selected Select options must expose one inline canonical marker');
assert(css.includes('.settings-row--canonical')&&css.includes('min-height:58px!important'),'Settings must use compact canonical rows instead of large leaf cards');
assert(!css.includes('min-height:96px!important'),'new UI system must not reintroduce oversized Settings cards');
assert(css.includes('.about-surface')&&css.includes('.about-attribution'),'About must render as one coherent surface with upstream attribution');
assert(css.includes('.mobile-view-controls')&&css.includes('flex-wrap:nowrap!important'),'mobile page-size/column/sort controls must stay on one line');
assert(css.includes('.transfer-capsule[data-mode="alt"]'),'ALT transfer mode must have a visibly distinct capsule treatment');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'all decorative motion must honor Reduced Motion');

for(const token of ['STATUS-DOCK-002','CONNECTION-002','TOOLTIP-002','RATE-INPUT-001','TRANSFER-002','SETTINGS-FORM-RAIL-001','ABOUT-002','ACTION-SHEET-002'])assert(polishJs.includes(token),`canonical polish module missing ${token}`);
assert(polishJs.includes("old.replaceWith(cap)")&&polishJs.includes("cap.addEventListener('click',loadTransferEditor)"),'Transfer polish must replace the legacy nested speed controls with one owned capsule');
assert(polishJs.includes("Alternative rate limits','备用速度限制")&&polishJs.includes("Alternative download rate limit','备用下载速度限制")&&polishJs.includes("Alternative upload rate limit','备用上传速度限制"),'Transfer editor must use explicit alternative-rate wording');
assert(polishJs.includes('transferClient.setPreferences({alt_dl_limit:state.down,alt_up_limit:state.up})'),'alternative download/upload rates must be saved together');
assert(polishJs.includes('installScrubber')&&polishJs.includes('pointermove'),'RateInput must expose reusable drag-to-adjust behavior');
assert(polishJs.includes('compactAbout')&&polishJs.includes('about-facts-grid'),'About must compact facts into one responsive grid');
assert(polishJs.includes('decorateActionSheet')&&polishJs.includes('data.actionTone')===false,'action sheet contract must not depend on an accidental property spelling');
assert(polishJs.includes('button.dataset.actionTone=actionTone'),'action sheet buttons must receive semantic tone metadata');
assert(polishJs.includes('normalizeStatusMessage')&&polishJs.includes('已刷新'),'routine successful refresh copy must be silent');
assert(polishJs.includes('connection-indicator')&&polishJs.includes('pulseConnection'),'connection status must use the shared animated indicator');
assert(polishJs.includes('TooltipController')===false,'polish may expose tooltip behavior without inventing a second global component namespace');

assert(polishCss.includes('--settings-rail-w:820px')&&polishCss.includes('--settings-rail-gap:32px'),'Settings Form Rail geometry must stay centralized in tokens');
assert(polishCss.includes('grid-template-columns:minmax(240px,var(--settings-label-w)) minmax(260px,var(--settings-control-w))'),'desktop Settings labels and controls must form two centered left-aligned columns');
assert(polishCss.includes('SETTINGS-VIEWPORT-001')&&polishCss.includes('#settings-view #settings-content')&&polishCss.includes('overflow-y:auto!important'),'every Settings tab must share one bounded scrolling content viewport');
assert(polishCss.includes('STATUS-DOCK-003')&&polishCss.includes('grid-template-columns:minmax(0,1fr) auto auto auto minmax(0,1fr)'),'desktop Storage/Transfer/Connection status must be centered as one symmetric runtime cluster');
assert(polishCss.includes('.about-facts-grid')&&polishCss.includes('repeat(2,minmax(0,1fr))'),'desktop About facts must use a compact two-column grid');
assert(polishCss.includes('>.settings-row__copy{display:contents!important}')&&polishCss.includes('grid-column:1!important')&&polishCss.includes('grid-column:2!important'),'About fact labels and values must stay on the same row');
assert(polishCss.includes('.about-surface>.settings-row--canonical:not(.about-row):not(.about-fact)'),'About must hide preference controls such as the language selector');
assert(polishCss.includes('--transfer-editor-w:720px')&&polishCss.includes('padding:22px 24px 16px!important')&&polishCss.includes('padding:0 24px 20px!important'),'Transfer editor must use the generous canonical desktop width and breathing room');
assert(polishCss.includes('.transfer-capsule--unified')&&polishCss.includes('.transfer-rate-editor[data-mode="alt"]'),'Transfer capsule and complete ALT editor must share semantic state styling');
assert(polishCss.includes('.rate-scrubber')&&polishCss.includes('cursor:ew-resize'),'RateInput scrubber must clearly expose drag semantics');
assert(polishCss.includes('.action-sheet-polish .btn[data-action-tone="verify"]:hover')&&polishCss.includes('.btn[data-action-tone="rate"]:hover'),'Torrent actions must use semantic hover tones');
assert(polishCss.includes('.connection-indicator.is-refresh-pulse::after'),'connection indicator must expose a refresh pulse');
assert(polishCss.includes('@media(prefers-reduced-motion:reduce)'),'polish motion must honor Reduced Motion');

assert(loader.includes("css/ui-system-v037.css")&&loader.includes("scripts/ui-system-v037.js"),'v0.3.7 loader must load the shared UI system');
assert(loader.includes("css/ui-polish-v037.css")&&loader.includes("scripts/ui-polish-v037.js")&&loader.includes('W.V037Polish.init()'),'v0.3.7 loader must load and initialize the canonical polish layer after the shared UI system');
assert(adaptive.includes('owner=v037||ui')&&adaptive.includes('head.insertBefore(link,owner)'),'legacy mobile CSS must yield final responsive authority to v0.3.7 layers');
assert(adaptive.includes("filterControl.querySelector('.ui-select')")&&adaptive.includes("typeof select.setOptions!=='function'"),'mobile filter synchronization must target the actual Select instance');
assert(core.includes("mobileFields:['status','progress','dl','up','eta','size']"),'legacy mobile field config must remain readable for migration');
console.log('v0.3.7 shared responsive UI system static contract passed.');