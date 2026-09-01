import fs from 'node:fs';
function read(p){return fs.readFileSync(p,'utf8');}
function assert(ok,msg){if(!ok)throw new Error(msg);}
const js=read('webui/private/scripts/ui-system-v037.js');
const css=read('webui/private/css/ui-system-v037.css');
const loader=read('webui/private/scripts/v037.js');
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
assert(css.includes('.settings-row--canonical')&&css.includes('min-height:58px!important'),'Settings must use compact canonical rows instead of large leaf cards');
assert(!css.includes('min-height:96px!important'),'new UI system must not reintroduce oversized Settings cards');
assert(css.includes('.about-surface')&&css.includes('.about-attribution'),'About must render as one coherent surface with upstream attribution');
assert(css.includes('.mobile-view-controls')&&css.includes('flex-wrap:nowrap!important'),'mobile page-size/column/sort controls must stay on one line');
assert(css.includes('.transfer-capsule[data-mode="alt"]'),'ALT transfer mode must have a visibly distinct capsule treatment');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'all decorative motion must honor Reduced Motion');

assert(loader.includes("css/ui-system-v037.css")&&loader.includes("scripts/ui-system-v037.js"),'v0.3.7 loader must load the shared UI system');
assert(core.includes("mobileFields:['status','progress','dl','up','eta','size']"),'legacy mobile field config must remain readable for migration');
console.log('v0.3.7 shared responsive UI system static contract passed.');
