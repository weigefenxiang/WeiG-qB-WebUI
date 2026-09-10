(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},U=W.util;
  if(W.LayoutRuntime)return;
  var initialized=false,sidebarCollapsed=false,resizeFrame=0;
  var SIDEBAR_KEY='weigg.sidebarCollapsed';
  function isDesktop(){return !!(global.matchMedia&&global.matchMedia('(min-width: 821px)').matches);}
  function zh(){return !!(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN');}
  function label(en,cn){return zh()?cn:en;}
  function normalizeDialog(dialog){
    if(!dialog||dialog.dataset.adaptiveDialog==='1')return;
    dialog.dataset.adaptiveDialog='1';
    var root=dialog.querySelector(':scope > form')||dialog,
        head=root.querySelector(':scope > .dialog__head'),
        actions=root.querySelector(':scope > .dialog__actions'),
        body=root.querySelector(':scope > .dialog__body');
    if(body)return;
    body=document.createElement('div');
    body.className='dialog__body';
    Array.from(root.childNodes).filter(function(node){return node!==head&&node!==actions;}).forEach(function(node){body.appendChild(node);});
    if(head)head.insertAdjacentElement('afterend',body);else root.insertBefore(body,actions||root.firstChild);
  }
  function normalizeDialogs(){Array.from(document.querySelectorAll('dialog.dialog')).forEach(normalizeDialog);}
  function ensureSidebarStyles(){
    if(document.getElementById('weigg-sidebar-layout-css'))return;
    var link=document.createElement('link'),script=Array.from(document.scripts).find(function(node){return /(?:^|\/)layout\.js(?:\?|$)/.test(node.src||'');}),suffix='';
    if(script){try{var parsed=new URL(script.src,global.location&&global.location.href||undefined),version=parsed.searchParams.get('v');if(version)suffix='?v='+encodeURIComponent(version);}catch(_e){}}
    link.id='weigg-sidebar-layout-css';link.rel='stylesheet';link.href='css/sidebar.css'+suffix;document.head.appendChild(link);
  }
  function readSidebarPreference(){try{return localStorage.getItem(SIDEBAR_KEY)==='1';}catch(_e){return false;}}
  function writeSidebarPreference(value){try{localStorage.setItem(SIDEBAR_KEY,value?'1':'0');}catch(_e){}}
  function ensureSidebarToggle(){
    var app=document.getElementById('app');if(!app)return null;var button=document.getElementById('sidebar-toggle');if(button)return button;
    button=document.createElement('button');button.id='sidebar-toggle';button.type='button';button.setAttribute('aria-controls','sidebar');button.addEventListener('click',function(){setSidebarCollapsed(!sidebarCollapsed,true);});app.appendChild(button);return button;
  }
  function ensureSidebarTransferPanel(){
    var section=document.querySelector('#sidebar>.sidebar__section:first-child');if(!section)return null;var panel=document.getElementById('desktop-sidebar-transfer-panel');if(panel)return panel;
    panel=document.createElement('section');panel.id='desktop-sidebar-transfer-panel';panel.className='sidebar-transfer-panel';
    var chartHost=document.createElement('div');chartHost.id='desktop-sidebar-transfer-chart';chartHost.className='sidebar-transfer-panel__chart';
    var rates=document.createElement('div');rates.className='sidebar-transfer-rates';rates.innerHTML='<span class="sidebar-transfer-rate sidebar-transfer-rate--down"><span data-sidebar-rate-label="down"></span><strong data-sidebar-rate="down">0 B/s</strong></span><span class="sidebar-transfer-rate sidebar-transfer-rate--up"><span data-sidebar-rate-label="up"></span><strong data-sidebar-rate="up">0 B/s</strong></span>';
    panel.append(chartHost,rates);section.appendChild(panel);return panel;
  }
  function formatRate(value){var n=Math.max(0,Number(value)||0);return U&&U.formatSpeed?U.formatSpeed(n):(Math.round(n)+' B/s');}
  function paintSidebarRates(){
    var panel=document.getElementById('desktop-sidebar-transfer-panel');if(!panel)return;var info=W.TransferRuntime&&W.TransferRuntime.last?W.TransferRuntime.last()||{}:{};
    var down=panel.querySelector('[data-sidebar-rate="down"]'),up=panel.querySelector('[data-sidebar-rate="up"]'),downLabel=panel.querySelector('[data-sidebar-rate-label="down"]'),upLabel=panel.querySelector('[data-sidebar-rate-label="up"]');
    if(down)down.textContent=formatRate(info.dl_info_speed);if(up)up.textContent=formatRate(info.up_info_speed);if(downLabel)downLabel.textContent=label('Download','下载');if(upLabel)upLabel.textContent=label('Upload','上传');
  }
  function mountDesktopTransfer(){
    var panel=ensureSidebarTransferPanel();if(!panel)return;var chartHost=panel.querySelector('#desktop-sidebar-transfer-chart'),mobileHost=document.getElementById('mobile-drawer-transfer-chart');
    if(!isDesktop()){if(chartHost)chartHost.textContent='';return;}
    if(mobileHost)mobileHost.textContent='';
    if(W.Transfer&&W.Transfer.mountCompactChart&&chartHost)W.Transfer.mountCompactChart(chartHost);
    paintSidebarRates();
  }
  function updateToggle(){
    var button=ensureSidebarToggle();if(!button)return;var expanded=!sidebarCollapsed;
    button.textContent=expanded?'‹':'›';button.setAttribute('aria-expanded',expanded?'true':'false');button.setAttribute('aria-label',expanded?label('Collapse Torrent sidebar','收起种子侧栏'):label('Expand Torrent sidebar','展开种子侧栏'));button.title=button.getAttribute('aria-label');
  }
  function projectSidebarState(){
    var app=document.getElementById('app');if(!app)return;if(isDesktop())app.dataset.sidebarCollapsed=sidebarCollapsed?'1':'0';else app.removeAttribute('data-sidebar-collapsed');updateToggle();
  }
  function requestLayoutRefresh(){
    if(resizeFrame)cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(function(){resizeFrame=0;try{global.dispatchEvent(new Event('resize'));}catch(_e){}});
  }
  function setSidebarCollapsed(value,persist){
    sidebarCollapsed=!!value;if(persist!==false)writeSidebarPreference(sidebarCollapsed);projectSidebarState();requestLayoutRefresh();return sidebarCollapsed;
  }
  function syncSidebar(){
    ensureSidebarStyles();ensureSidebarToggle();projectSidebarState();
    if(isDesktop())mountDesktopTransfer();else{var chartHost=document.getElementById('desktop-sidebar-transfer-chart');if(chartHost)chartHost.textContent='';}
    paintSidebarRates();
  }
  function scheduleSidebarSync(){if(resizeFrame)return;resizeFrame=requestAnimationFrame(function(){resizeFrame=0;syncSidebar();});}
  function init(){if(initialized)return;initialized=true;sidebarCollapsed=readSidebarPreference();ensureSidebarStyles();normalizeDialogs();syncSidebar();}
  W.LayoutRuntime={init:init,normalizeDialogs:normalizeDialogs,syncSidebar:syncSidebar,setSidebarCollapsed:setSidebarCollapsed,sidebarCollapsed:function(){return sidebarCollapsed;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  global.addEventListener('resize',scheduleSidebarSync,{passive:true});
  global.addEventListener('weigg:route-state',scheduleSidebarSync);
  global.addEventListener('weigg:transfer',paintSidebarRates);
  global.addEventListener('weigg:languagechange',function(){updateToggle();paintSidebarRates();if(isDesktop())mountDesktopTransfer();});
})(window);
