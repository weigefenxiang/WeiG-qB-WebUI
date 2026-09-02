(function(global){
  'use strict';
  var W=global.WeiG,U=W&&W.util,C=W&&W.Components;
  if(!W||!U||!C||W.SpatialRuntime)return;

  function zh(){return !!(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN');}
  function label(en,cn){return zh()?cn:en;}
  function isMobile(){return !!(global.matchMedia&&global.matchMedia('(max-width: 820px)').matches);}

  var capabilityDialog=null;
  function ensureCapabilityDialog(){
    if(capabilityDialog&&capabilityDialog.isConnected)return capabilityDialog;
    var d=document.createElement('dialog');
    d.id='capability-dialog';
    d.className='dialog surface surface--modal capability-dialog';
    d.innerHTML='<div class="dialog__head"><div><div class="eyebrow">QBITTORRENT</div><h2 class="capability-dialog__title"></h2></div><button type="button" class="icon-btn capability-dialog__close">×</button></div><div class="dialog__body capability-dialog__body"><p class="capability-dialog__requirement"></p><p class="text-description capability-dialog__current"></p><p class="text-description capability-dialog__advice"></p><p class="text-description capability-dialog__backup"></p></div><div class="dialog__actions"><button type="button" class="btn btn--primary capability-dialog__done"></button></div>';
    d.querySelector('.capability-dialog__close').onclick=d.querySelector('.capability-dialog__done').onclick=function(){d.close();};
    document.body.appendChild(d);capabilityDialog=d;return d;
  }
  function openCapability(opts){
    opts=opts||{};var d=ensureCapabilityDialog();
    d.querySelector('.capability-dialog__title').textContent=opts.title||label('Feature unavailable','功能不可用');
    d.querySelector('.capability-dialog__requirement').textContent=opts.requirement||label('This feature is not supported by the current qBittorrent instance.','当前 qBittorrent 实例不支持此功能。');
    d.querySelector('.capability-dialog__current').textContent=label('Current version: ','当前版本：')+(opts.currentVersion||'—');
    d.querySelector('.capability-dialog__advice').textContent=opts.advice||label('If you need this feature, consider upgrading to a compatible qBittorrent version.','如需使用此功能，建议升级到支持该功能的 qBittorrent 版本。');
    d.querySelector('.capability-dialog__backup').textContent=opts.backup||label('Before upgrading, back up your qBittorrent configuration, torrent tasks, and important data.','升级前请备份 qBittorrent 配置、Torrent 任务及重要数据。');
    d.querySelector('.capability-dialog__done').textContent=label('OK','知道了');
    if(!d.open)d.showModal();return d;
  }
  W.CapabilityDialog={open:openCapability,close:function(){if(capabilityDialog&&capabilityDialog.open)capabilityDialog.close();}};

  var defs=[
    {kind:'tracker',className:'facet-select--tracker',aria:function(){return label('Tracker filter','Tracker 筛选');},set:function(v){return W.LibraryController&&W.LibraryController.setTracker(v);}},
    {kind:'savePath',className:'facet-select--path',aria:function(){return label('Save path filter','保存路径筛选');},set:function(v){return W.LibraryController&&W.LibraryController.setSavePath(v);}},
    {kind:'category',className:'facet-select--category',aria:function(){return label('Category filter','分类筛选');},set:function(v){return W.LibraryController&&W.LibraryController.setCategory(v);}},
    {kind:'tag',className:'facet-select--tag',aria:function(){return label('Tag filter','标签筛选');},set:function(v){return W.LibraryController&&W.LibraryController.setTag(v);}}
  ];
  var controls={},host=null;
  function fallbackOptions(kind){var key=kind==='tracker'?'tracker.all':kind==='savePath'?'path.all':kind==='category'?'category.all':'tag.all',fallback=kind==='tracker'?label('All Trackers','全部 Tracker'):kind==='savePath'?label('All Paths','全部路径'):kind==='category'?label('All Categories','全部分类'):label('All Tags','全部标签'),text=W.t?W.t(key):'';return[{value:'',label:text&&text!==key?text:fallback}];}
  function currentValue(kind){var state=W.LibraryController&&W.LibraryController.state?W.LibraryController.state():null;if(!state)return'';return kind==='savePath'?state.savePath:String(state[kind]||'');}
  function blocked(def){if(def.kind!=='tag')return false;var app=W.AppState;if(app&&app.client&&app.client.capabilities&&app.client.capabilities.tags)return false;if(W.LibraryController&&W.LibraryController.showCapability)W.LibraryController.showCapability('tags');return true;}
  function createControl(def){
    var wrap=document.createElement('div');wrap.className='facet-control '+def.className;wrap.dataset.facet=def.kind;
    var control=C.selectControl({options:fallbackOptions(def.kind),value:'',searchable:true,searchThreshold:14,ariaLabel:def.aria(),className:'facet-select',onOpen:function(){return blocked(def)?false:true;},onChange:function(value){if(blocked(def))return;def.set(value);requestAnimationFrame(syncFacets);}});
    wrap.appendChild(control);controls[def.kind]=control;return wrap;
  }
  function installFacetControls(){host=document.getElementById('facet-controls');if(!host)return null;if(!host.dataset.facetsReady){host.dataset.facetsReady='1';host.textContent='';defs.forEach(function(def){host.appendChild(createControl(def));});}mountForViewport();syncFacets();return host;}
  function mountForViewport(){if(!host)host=document.getElementById('facet-controls');if(!host)return;var target=document.getElementById(isMobile()?'mobile-facet-slot':'sidebar-facet-slot');if(target&&host.parentElement!==target)target.appendChild(host);}
  function syncFacets(){if(!host)installFacetControls();if(!host||!W.LibraryController)return;defs.forEach(function(def){var control=controls[def.kind];if(!control)return;var options=W.LibraryController.facetOptions?W.LibraryController.facetOptions(def.kind):fallbackOptions(def.kind);control.setOptions(options&&options.length?options:fallbackOptions(def.kind));control.setValue(currentValue(def.kind));var trigger=control.querySelector&&control.querySelector('.ui-select__trigger');if(trigger)trigger.setAttribute('aria-label',def.aria());});}
  function sync(){mountForViewport();syncFacets();}
  function init(){installFacetControls();}
  W.SpatialRuntime={init:init,installFacetControls:installFacetControls,mountForViewport:mountForViewport,syncFacets:syncFacets};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  global.addEventListener('weigg:library-state',function(){requestAnimationFrame(syncFacets);});
  global.addEventListener('weigg:languagechange',function(){requestAnimationFrame(sync);});
  global.addEventListener('resize',function(){requestAnimationFrame(sync);},{passive:true});
})(window);
