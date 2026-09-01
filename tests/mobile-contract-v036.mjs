import fs from 'node:fs';
import vm from 'node:vm';

function assert(condition,message){if(!condition)throw new Error(message);}
const index=fs.readFileSync('webui/private/index.html','utf8');
const css=fs.readFileSync('webui/private/css/mobile-v036.css','utf8');
const js=fs.readFileSync('webui/private/scripts/adaptive-v036.js','utf8');
const semantics=fs.readFileSync('webui/private/scripts/semantics-v036.js','utf8');
const i18n=fs.readFileSync('webui/private/scripts/i18n-v036.js','utf8');

assert(index.includes('css/mobile-v036.css?v=__WEIGG_GIT_SHA__'),'mobile adaptive CSS must be Git-SHA addressed');
assert(index.includes('scripts/i18n-v036.js?v=__WEIGG_GIT_SHA__'),'v0.3.6 translations must be Git-SHA addressed');
assert(index.includes('scripts/semantics-v036.js?v=__WEIGG_GIT_SHA__'),'Torrent semantics must be Git-SHA addressed');
assert(index.includes('scripts/adaptive-v036.js?v=__WEIGG_GIT_SHA__'),'mobile adaptive runtime must be Git-SHA addressed');
assert(index.indexOf('scripts/i18n-v036.js')<index.indexOf('scripts/adaptive-v036.js'),'v0.3.6 translations must load before adaptive runtime');
assert(index.indexOf('scripts/semantics-v036.js')<index.indexOf('scripts/app.js'),'Torrent semantics must load before app runtime');
assert(index.indexOf('scripts/adaptive-v036.js')<index.indexOf('scripts/app.js'),'adaptive runtime must load before app.js so VirtualList metrics are authoritative');

assert(css.includes('#torrent-list{flex:1 1 0;height:auto!important;min-height:0!important'),'Torrent list must consume the remaining mobile flex track with a zero basis instead of subtracting magic pixels');
assert(!/100(?:s?vh|dvh)\s*-\s*\d+px/.test(css),'mobile adaptive layer must not reintroduce viewport-minus-magic-pixel heights');
assert(css.includes('.view.is-active{display:flex;flex:1 1 0'),'active mobile routes must consume the remaining shell track');
assert(css.includes('[data-primary-scroll="1"]{min-height:0'),'mobile routes must declare primary scroll owners');
assert(css.includes('#settings-content[data-primary-scroll="1"]')&&css.includes('overflow-y:auto!important'),'Settings content must own its vertical mobile scroll');
assert(css.includes('#detail-content[data-primary-scroll="1"]'),'Torrent Detail must use the shared scroll-owner contract');
assert(css.includes('#search-view [data-primary-scroll="1"]')&&css.includes('#rss-view [data-primary-scroll="1"]')&&css.includes('#logs-view [data-primary-scroll="1"]'),'tool routes must share the primary-scroll contract');

assert(css.includes('.mobile-command-bar{display:flex'),'mobile command bar must be a canonical one-line flex surface');
assert(css.includes('--mobile-command-size')&&css.includes('--mobile-command-count-size'),'mobile command typography must use semantic tokens');
assert(css.includes('.mobile-command-bar.is-tight')&&css.includes('.mobile-command-bar.is-ultra-tight'),'narrow phones must compact command spacing before wrapping');
assert(css.includes('white-space:nowrap'),'mobile command/metric contracts must prevent premature wrapping');
assert(css.includes('--mobile-stat-label-size')&&css.includes('--mobile-stat-value-size')&&css.includes('--mobile-stat-meta-size'),'mobile stats must use a semantic typography hierarchy');
assert(css.includes('.data-viewport-focus')&&css.includes('#list-view.is-data-focus'),'large data surfaces must support the reusable focus/restore viewport contract');

assert(css.includes('.mobile-card-meta{display:flex!important'),'mobile torrent secondary metrics must use the one-line flex contract');
assert(css.includes('font-size:var(--mobile-meta-font'),'mobile torrent metrics must allow runtime width fitting before wrapping');
assert(css.includes('.mobile-card-meta.is-ultra-tight'),'extreme narrow-phone fitting must remain a canonical one-line state');
assert(css.includes('.status-pill[data-tone=stalled-up]')&&css.includes('.status-pill[data-tone=download]')&&css.includes('.status-pill[data-tone=seed]')&&css.includes('.status-pill[data-tone=stopped]'),'semantic torrent states must have distinct canonical tones');

for(const token of ['pageContracts','primaryScrollOwners','mobile-command-bar','fitCommandBar','syncFacetSummaries','registerDataViewport','setDataViewportFocus','data-primary-scroll'])assert(js.includes(token),`Mobile Adaptive System runtime missing: ${token}`);
for(const token of ['v036.facet.tracker','v036.facet.path','v036.facet.category','v036.facet.tag','v036.mobile.count'])assert(i18n.includes(token),`Mobile Adaptive System translation missing: ${token}`);
assert(semantics.includes('isPrivateOrPt'),'canonical Private/PT union semantics missing');
assert(js.includes('compactMetricText'),'mobile metric fitting must compact redundant spaces/decimal zeroes before shrinking text');
assert(js.includes('free_space_on_disk'),'storage dock must consume qBittorrent sync/maindata free_space_on_disk');
assert(js.includes('getMainData(storageRid)'),'free-space telemetry must use incremental sync rid after the initial full snapshot');
assert(js.includes('30000'),'free-space polling must stay low-frequency rather than following the Torrent refresh loop');
assert(js.includes('else if(lastFree!=null)paintStorage(lastFree)'),'unchanged partial sync responses must retain the last known free-space value');

function BaseVirtualList(){}
BaseVirtualList.prototype.setRowHeight=function(){};
const sandbox={
  console,
  URL,
  setInterval:()=>1,
  clearInterval:()=>{},
  setTimeout:()=>1,
  clearTimeout:()=>{},
  requestAnimationFrame:fn=>fn(),
  CustomEvent:function(){},
  document:{
    documentElement:{dataset:{density:'standard'}},
    head:{lastElementChild:null,appendChild(){}},
    readyState:'loading',
    addEventListener(){},
    querySelector(){return null;},
    querySelectorAll(){return [];},
    getElementById(){return null;}
  }
};
sandbox.window={
  WeiG:{
    Components:{state:()=>['State','muted']},
    VirtualList:BaseVirtualList,
    QBClient:function(){},
  },
  innerHeight:844,
  matchMedia:()=>({matches:true}),
  addEventListener(){},
  requestAnimationFrame:sandbox.requestAnimationFrame,
  setTimeout:sandbox.setTimeout,
  clearTimeout:sandbox.clearTimeout,
  setInterval:sandbox.setInterval,
  clearInterval:sandbox.clearInterval
};
vm.runInNewContext(js,sandbox,{filename:'adaptive-v036.js'});
const api=sandbox.window.WeiG.MobileAdaptive;
assert(api&&typeof api.formatFreeSpace==='function','MobileAdaptive formatter must be exported for deterministic tests');
assert(typeof api.installPageContracts==='function'&&typeof api.registerDataViewport==='function','MobileAdaptive must expose reusable page/data viewport contracts');
const TiB=1024**4,GiB=1024**3,MiB=1024**2;
assert(api.formatFreeSpace(1.234*TiB)==='1.23 TiB','single-digit IEC values should keep useful hundredths');
assert(api.formatFreeSpace(12.34*GiB)==='12.3 GiB','two-digit IEC values should keep one decimal');
assert(api.formatFreeSpace(987.6*MiB)==='988 MiB','three-digit IEC values should prefer whole units');
assert(api.formatFreeSpace(9.876*GiB)==='9.88 GiB','sub-10 GiB values should retain useful precision');
assert(api.formatFreeSpace(84.23*MiB)==='84.2 MiB','two-digit MiB values should keep one decimal');
assert(api.formatFreeSpace(0)==='0 B','zero free bytes must remain explicit rather than fabricated as unavailable');
assert(sandbox.window.WeiG.Components.state('stalledUP')[1]==='stalled-up','stalled seeding must have its own semantic tone');
assert(sandbox.window.WeiG.Components.state('downloading')[1]==='download','downloading must have download tone');
assert(sandbox.window.WeiG.Components.state('uploading')[1]==='seed','seeding must have seed tone');
assert(sandbox.window.WeiG.Components.state('stoppedUP')[1]==='stopped','stopped torrents must have stopped tone');

console.log('v0.3.6 Mobile Adaptive System 2.0, semantic status and human-readable storage contracts passed.');
