(function(global){
  'use strict';
  var W=global.WeiG,U=W&&W.util;
  if(!W||!U||!W.QBClient)return;

  var samples=[],MAX_SAMPLES=900,lastTransfer=null,transferClient=null,rangeAnchor=null;
  function tr(key){return W.V030I18n&&W.V030I18n.t?W.V030I18n.t(key):key;}
  function fmtLimit(v){v=Number(v)||0;return v>0?U.formatSpeed(v):tr('v030.limit.unlimited');}
  function getClient(){if(transferClient)return Promise.resolve(transferClient);transferClient=new W.QBClient();return transferClient.detect().then(function(){return transferClient;});}

  /* SCROLL-001: automatic polling preserves position; deliberate context changes reset it. */
  function resetMainScroll(){var list=U.$('torrent-list');if(!list)return;list.__weiggVirtualScrollTop=0;list.scrollTop=0;}
  function installScrollResetBoundaries(){
    document.addEventListener('click',function(e){
      if(e.target.closest('#filter-nav [data-filter],#tracker-nav [data-tracker],#savepath-nav [data-savepath],#category-nav [data-category],#tag-nav [data-tag],#prev-btn,#next-btn'))resetMainScroll();
    },true);
    var page=U.$('page-size');if(page)page.addEventListener('change',resetMainScroll,true);
    var search=U.$('search-input');if(search)search.addEventListener('input',resetMainScroll,true);
  }

  /* EMPTY-001: every confirmed zero-result Torrent state collapses the blank DataGrid. */
  function syncEmptyState(){
    var empty=U.$('list-empty'),panel=document.querySelector('.torrent-panel');if(!empty||!panel)return;
    var visible=!empty.classList.contains('is-hidden');panel.classList.toggle('is-empty',visible);panel.setAttribute('data-empty',visible?'true':'false');
  }
  function installEmptyObserver(){var empty=U.$('list-empty');if(!empty)return;new MutationObserver(syncEmptyState).observe(empty,{attributes:true,attributeFilter:['class']});syncEmptyState();}

  function buttonFromStatus(span,kind){
    if(!span||span.tagName==='BUTTON')return span;
    var b=document.createElement('button');b.type='button';b.className='transfer-dock__control';b.dataset.limitKind=kind;
    b.setAttribute('aria-label',tr(kind==='download'?'v030.speed.downloadAria':'v030.speed.uploadAria'));
    b.innerHTML=span.innerHTML;span.replaceWith(b);return b;
  }

  function installDock(){
    var bar=document.querySelector('.statusbar');if(!bar||bar.classList.contains('statusbar--v030'))return;
    bar.classList.add('statusbar--v030');
    var dl=buttonFromStatus(bar.querySelector('.status-speed--dl'),'download');
    var up=buttonFromStatus(bar.querySelector('.status-speed--up'),'upload');
    var cluster=document.createElement('div');cluster.className='transfer-dock';
    while(bar.firstChild)cluster.appendChild(bar.firstChild);

    var alt=document.createElement('button');alt.id='alt-speed-btn';alt.type='button';alt.className='transfer-dock__control';alt.textContent='ALT';alt.title=tr('v030.alt');
    if(up&&up.parentNode===cluster){if(up.nextSibling)cluster.insertBefore(alt,up.nextSibling);else cluster.appendChild(alt);}else cluster.appendChild(alt);

    var graph=document.createElement('button');graph.id='transfer-graph-btn';graph.type='button';graph.className='transfer-dock__control';graph.textContent='⌁ '+tr('v030.transfer');
    cluster.appendChild(graph);bar.appendChild(cluster);

    if(dl)dl.addEventListener('click',function(){openSpeedDialog('download');});
    if(up)up.addEventListener('click',function(){openSpeedDialog('upload');});
    alt.addEventListener('click',toggleAltSpeed);graph.addEventListener('click',openTransferDialog);refreshAltSpeed();
  }

  function ensureSpeedDialog(){
    var d=U.$('global-speed-dialog');if(d)return d;
    d=document.createElement('dialog');d.id='global-speed-dialog';d.className='dialog transfer-dialog surface surface--modal';
    d.innerHTML='<div class="dialog__head"><div><div class="eyebrow" id="speed-dialog-eyebrow">TRANSFER LIMIT</div><h2 id="speed-dialog-title">Global speed limit</h2></div><button class="icon-btn" id="speed-dialog-close" type="button">×</button></div><div class="transfer-dialog__body"><div class="transfer-dialog__current"><span id="speed-current-label">Current</span><strong id="speed-current">—</strong></div><div class="speed-presets"><button class="btn btn--ghost" data-bps="0" type="button">Unlimited</button><button class="btn btn--ghost" data-bps="1048576" type="button">1 MiB/s</button><button class="btn btn--ghost" data-bps="5242880" type="button">5 MiB/s</button><button class="btn btn--ghost" data-bps="10485760" type="button">10 MiB/s</button><button class="btn btn--ghost" data-bps="52428800" type="button">50 MiB/s</button><button class="btn btn--ghost" data-custom="1" type="button">Custom</button></div><div class="speed-custom"><label><span id="speed-custom-label">Custom MiB/s</span><input id="speed-custom-value" class="field-input" type="number" min="0" step="0.1" inputmode="decimal"></label><button id="speed-apply" class="btn btn--primary" type="button">Apply</button></div></div>';
    document.body.appendChild(d);
    U.$('speed-dialog-close').onclick=function(){d.close();};
    U.$$('.speed-presets [data-bps]',d).forEach(function(b){b.onclick=function(){U.$('speed-custom-value').value=(Number(b.dataset.bps)||0)/1048576;applySpeedDialog(Number(b.dataset.bps)||0);};});
    var custom=d.querySelector('[data-custom]');if(custom)custom.onclick=function(){U.$('speed-custom-value').focus();};
    U.$('speed-apply').onclick=function(){applySpeedDialog(Math.max(0,Number(U.$('speed-custom-value').value)||0)*1048576);};
    return d;
  }
  function localizeSpeedDialog(kind){
    U.$('speed-dialog-title').textContent=tr(kind==='download'?'v030.limit.download':'v030.limit.upload');
    U.$('speed-current-label').textContent=tr('v030.limit.current');U.$('speed-custom-label').textContent=tr('v030.limit.custom');U.$('speed-apply').textContent=tr('v030.limit.apply');
    var buttons=U.$$('.speed-presets button');if(buttons[0])buttons[0].textContent=tr('v030.limit.unlimited');if(buttons[5])buttons[5].textContent=tr('v030.limit.customButton');
  }
  async function openSpeedDialog(kind){
    var d=ensureSpeedDialog();d.dataset.kind=kind;localizeSpeedDialog(kind);d.showModal();U.$('speed-current').textContent=tr('v030.loading');
    try{var c=await getClient(),value=kind==='download'?await c.getGlobalDownloadLimit():await c.getGlobalUploadLimit();U.$('speed-current').textContent=fmtLimit(value);U.$('speed-custom-value').value=value?String(Math.round((value/1048576)*100)/100):'0';}catch(e){U.$('speed-current').textContent=e.message||'Error';}
  }
  async function applySpeedDialog(bps){
    var d=U.$('global-speed-dialog');if(!d)return;var kind=d.dataset.kind;
    try{var c=await getClient();if(kind==='download')await c.setGlobalDownloadLimit(Math.round(bps));else await c.setGlobalUploadLimit(Math.round(bps));U.$('speed-current').textContent=fmtLimit(bps);W.toast(tr('v030.limit.updated'));setTimeout(function(){d.close();},220);}catch(e){W.toast((e&&e.message)||tr('v030.limit.failed'),'danger');}
  }

  async function refreshAltSpeed(){var b=U.$('alt-speed-btn');if(!b)return;try{var c=await getClient(),on=await c.getAltSpeedMode();b.classList.toggle('is-active',!!on);b.setAttribute('aria-pressed',on?'true':'false');b.title=tr(on?'v030.alt.enabled':'v030.alt.disabled');}catch(_e){}}
  async function toggleAltSpeed(){try{var c=await getClient();await c.toggleAltSpeedMode();await refreshAltSpeed();W.toast(tr('v030.alt.toggled'));}catch(e){W.toast(e.message||tr('v030.alt.failed'),'danger');}}

  function ensureTransferDialog(){
    var d=U.$('transfer-dialog');if(d)return d;
    d=document.createElement('dialog');d.id='transfer-dialog';d.className='dialog transfer-dialog surface surface--modal';
    d.innerHTML='<div class="dialog__head"><div><div class="eyebrow">TRANSFER</div><h2 id="transfer-dialog-title">Transfer & session</h2></div><button class="icon-btn" id="transfer-dialog-close" type="button">×</button></div><div class="transfer-dialog__body"><div class="transfer-stats"><div class="transfer-stat"><small id="session-down-label">Session downloaded</small><strong id="session-down">—</strong></div><div class="transfer-stat"><small id="session-up-label">Session uploaded</small><strong id="session-up">—</strong></div><div class="transfer-stat"><small id="global-down-label">Download limit</small><strong id="global-down-limit">—</strong></div><div class="transfer-stat"><small id="global-up-label">Upload limit</small><strong id="global-up-limit">—</strong></div><div class="transfer-stat"><small>DHT / Peers</small><strong id="session-peers">—</strong></div><div class="transfer-stat"><small id="free-space-label">Free space</small><strong id="session-free-space">—</strong></div></div><div class="transfer-chart-shell"><div class="transfer-chart-toolbar"><strong id="transfer-chart-title">Transfer speed</strong><select id="transfer-window"><option value="60">1 min</option><option value="300" selected>5 min</option><option value="900">15 min</option></select></div><canvas id="transfer-chart"></canvas><div class="transfer-chart-legend"><span id="legend-download">Download</span><span id="legend-upload">Upload</span></div></div></div>';
    document.body.appendChild(d);U.$('transfer-dialog-close').onclick=function(){d.close();};U.$('transfer-window').onchange=drawChart;return d;
  }
  function localizeTransferDialog(){
    U.$('transfer-dialog-title').textContent=tr('v030.transfer.title');U.$('session-down-label').textContent=tr('v030.transfer.sessionDown');U.$('session-up-label').textContent=tr('v030.transfer.sessionUp');U.$('global-down-label').textContent=tr('v030.transfer.downLimit');U.$('global-up-label').textContent=tr('v030.transfer.upLimit');U.$('free-space-label').textContent=tr('v030.transfer.freeSpace');U.$('transfer-chart-title').textContent=tr('v030.transfer.speed');U.$('legend-download').textContent=tr('v030.transfer.download');U.$('legend-upload').textContent=tr('v030.transfer.upload');
  }
  async function openTransferDialog(){
    var d=ensureTransferDialog();localizeTransferDialog();updateTransferStats(lastTransfer);d.showModal();drawChart();
    try{var c=await getClient(),data=await c.getMainData(0),state=data&&data.server_state||{};U.$('session-free-space').textContent=state.free_space_on_disk!=null?U.formatBytes(state.free_space_on_disk):'—';}catch(_e){U.$('session-free-space').textContent='—';}
  }

  function updateTransferStats(info){if(!info)return;var down=U.$('session-down');if(!down)return;down.textContent=U.formatBytes(info.dl_info_data||0);U.$('session-up').textContent=U.formatBytes(info.up_info_data||0);U.$('global-down-limit').textContent=fmtLimit(info.dl_rate_limit||0);U.$('global-up-limit').textContent=fmtLimit(info.up_rate_limit||0);U.$('session-peers').textContent=(info.dht_nodes==null?'—':info.dht_nodes)+' / '+(info.total_peer_connections==null?'—':info.total_peer_connections);}
  function addSample(info){lastTransfer=info||lastTransfer;if(!info)return;var now=Date.now(),last=samples[samples.length-1];if(last&&now-last.t<700)return;samples.push({t:now,dl:Number(info.dl_info_speed)||0,up:Number(info.up_info_speed)||0});if(samples.length>MAX_SAMPLES)samples.splice(0,samples.length-MAX_SAMPLES);updateTransferStats(info);if(U.$('transfer-dialog')&&U.$('transfer-dialog').open)drawChart();}
  function drawChart(){
    var canvas=U.$('transfer-chart');if(!canvas)return;var seconds=Number(U.$('transfer-window')&&U.$('transfer-window').value)||300,cut=Date.now()-seconds*1000,data=samples.filter(function(x){return x.t>=cut;});
    var rect=canvas.getBoundingClientRect(),ratio=Math.max(1,Math.min(2,global.devicePixelRatio||1)),w=Math.max(320,Math.round(rect.width||640)),h=Math.max(180,Math.round(rect.height||260));if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}var ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
    var css=getComputedStyle(document.documentElement),grid='rgba(150,170,210,.10)',dl=(css.getPropertyValue('--accent-primary')||'#7297ff').trim(),up=(css.getPropertyValue('--accent-cyan')||'#38d6ff').trim(),max=1;data.forEach(function(p){max=Math.max(max,p.dl,p.up);});var nice=Math.pow(1024,Math.max(0,Math.floor(Math.log(max)/Math.log(1024))));max=Math.ceil(max/nice)*nice;var pad=18;
    ctx.lineWidth=1;ctx.strokeStyle=grid;for(var i=0;i<=4;i++){var y=pad+(h-pad*2)*i/4;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke();}
    function line(key,color){if(data.length<2)return;ctx.beginPath();data.forEach(function(p,i){var x=pad+(w-pad*2)*(i/(data.length-1)),y=h-pad-(h-pad*2)*(p[key]/max);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.strokeStyle=color;ctx.lineWidth=2;ctx.shadowColor=color;ctx.shadowBlur=7;ctx.stroke();ctx.shadowBlur=0;}
    line('dl',dl);line('up',up);
  }

  function wrapTransferEvents(){var p=W.QBClient.prototype;if(p.__weiggV030TransferWrapped)return;p.__weiggV030TransferWrapped=true;var original=p.getTransferInfo;p.getTransferInfo=function(){return original.apply(this,arguments).then(function(info){global.dispatchEvent(new CustomEvent('weigg:transfer',{detail:info}));return info;});};global.addEventListener('weigg:transfer',function(e){addSample(e.detail);});}

  /* Existing Ctrl+A selects the current page. Ctrl/Cmd/Shift below operates on rendered rows only. */
  function installRenderedMultiSelect(){document.addEventListener('click',function(e){var row=e.target.closest('.torrent-row,.torrent-mobile-card');if(!row||(!e.ctrlKey&&!e.metaKey&&!e.shiftKey))return;var ck=row.querySelector('.torrent-select');if(!ck)return;e.preventDefault();e.stopPropagation();var rows=U.$$('.torrent-row,.torrent-mobile-card',U.$('torrent-list'));if(e.shiftKey&&rangeAnchor&&rows.indexOf(rangeAnchor)>=0){var a=rows.indexOf(rangeAnchor),b=rows.indexOf(row),lo=Math.min(a,b),hi=Math.max(a,b);rows.slice(lo,hi+1).forEach(function(r){var c=r.querySelector('.torrent-select');if(c&&!c.checked){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));}});}else{ck.checked=!ck.checked;ck.dispatchEvent(new Event('change',{bubbles:true}));rangeAnchor=row;rows.forEach(function(r){r.classList.toggle('v030-range-anchor',r===rangeAnchor);});}},true);}

  function syncLocale(){var alt=U.$('alt-speed-btn'),graph=U.$('transfer-graph-btn');if(alt)alt.title=tr('v030.alt');if(graph)graph.textContent='⌁ '+tr('v030.transfer');var dl=document.querySelector('[data-limit-kind="download"]'),up=document.querySelector('[data-limit-kind="upload"]');if(dl)dl.setAttribute('aria-label',tr('v030.speed.downloadAria'));if(up)up.setAttribute('aria-label',tr('v030.speed.uploadAria'));if(U.$('global-speed-dialog'))localizeSpeedDialog(U.$('global-speed-dialog').dataset.kind||'download');if(U.$('transfer-dialog'))localizeTransferDialog();refreshAltSpeed();}
  function init(){if(document.documentElement.dataset.v030==='1')return;document.documentElement.dataset.v030='1';wrapTransferEvents();installScrollResetBoundaries();installEmptyObserver();installDock();installRenderedMultiSelect();global.addEventListener('weigg:languagechange',syncLocale);setTimeout(function(){installDock();syncEmptyState();syncLocale();},800);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
