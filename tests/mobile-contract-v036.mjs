import fs from 'node:fs';
import vm from 'node:vm';

function assert(condition,message){if(!condition)throw new Error(message);}
const index=fs.readFileSync('webui/private/index.html','utf8');
const css=fs.readFileSync('webui/private/css/mobile-v036.css','utf8');
const js=fs.readFileSync('webui/private/scripts/adaptive-v036.js','utf8');

assert(index.includes('css/mobile-v036.css?v=__WEIGG_GIT_SHA__'),'mobile adaptive CSS must be Git-SHA addressed');
assert(index.includes('scripts/adaptive-v036.js?v=__WEIGG_GIT_SHA__'),'mobile adaptive runtime must be Git-SHA addressed');
assert(index.indexOf('scripts/adaptive-v036.js')<index.indexOf('scripts/app.js'),'adaptive runtime must load before app.js so VirtualList metrics are authoritative');
assert(css.includes('#torrent-list{flex:1 1 auto;height:auto!important;min-height:0!important'),'Torrent list must consume the remaining mobile viewport instead of subtracting magic pixels');
assert(css.includes('.mobile-card-meta{display:flex!important'),'mobile torrent secondary metrics must use the one-line flex contract');
assert(css.includes('white-space:nowrap'),'mobile torrent metrics must not wrap by default');
assert(css.includes('font-size:clamp('),'mobile torrent metrics must shrink responsively before wrapping');
assert(css.includes('#search-view>.tool-page')&&css.includes('#rss-view>.tool-page'),'Search and RSS must share the single-viewport tool-page contract');
assert(css.includes('.status-pill[data-tone=stalled-up]')&&css.includes('.status-pill[data-tone=download]')&&css.includes('.status-pill[data-tone=seed]')&&css.includes('.status-pill[data-tone=stopped]'),'semantic torrent states must have distinct canonical tones');
assert(js.includes('free_space_on_disk'),'storage dock must consume qBittorrent sync/maindata free_space_on_disk');
assert(js.includes('15000'),'free-space polling must be low-frequency rather than tied to the torrent refresh loop');

function BaseVirtualList(){}
BaseVirtualList.prototype.setRowHeight=function(){};
const sandbox={
  console,
  setInterval:()=>1,
  clearInterval:()=>{},
  setTimeout:()=>1,
  requestAnimationFrame:fn=>fn(),
  CustomEvent:function(){},
  document:{
    documentElement:{dataset:{density:'standard'}},
    head:{lastElementChild:null,appendChild(){}},
    readyState:'loading',
    addEventListener(){},
    querySelector(){return null;},
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
  setInterval:sandbox.setInterval,
  clearInterval:sandbox.clearInterval
};
vm.runInNewContext(js,sandbox,{filename:'adaptive-v036.js'});
const api=sandbox.window.WeiG.MobileAdaptive;
assert(api&&typeof api.formatFreeSpace==='function','MobileAdaptive formatter must be exported for deterministic tests');
const TiB=1024**4,GiB=1024**3,MiB=1024**2;
assert(api.formatFreeSpace(1.234*TiB)==='1.23 TiB','1.234 TiB must display with 3 significant digits');
assert(api.formatFreeSpace(12.34*GiB)==='12.3 GiB','12.34 GiB must display with 3 significant digits');
assert(api.formatFreeSpace(987.6*MiB)==='988 MiB','987.6 MiB must display with 3 significant digits');
assert(api.formatFreeSpace(0)==='0 B','zero bytes must remain explicit');
assert(sandbox.window.WeiG.Components.state('stalledUP')[1]==='stalled-up','stalled seeding must have its own semantic tone');
assert(sandbox.window.WeiG.Components.state('downloading')[1]==='download','downloading must have download tone');
assert(sandbox.window.WeiG.Components.state('uploading')[1]==='seed','seeding must have seed tone');
assert(sandbox.window.WeiG.Components.state('stoppedUP')[1]==='stopped','stopped torrents must have stopped tone');

console.log('v0.3.6 mobile adaptive, semantic status and 3-significant-digit storage contract passed.');
