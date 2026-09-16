(function(global){
  'use strict';
  var W=global.WeiG,U=W&&W.util,C=W&&W.Components;
  if(!W||!U||!C||W.SpatialRuntime)return;

  function zh(){return !!(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN');}
  function label(en,cn){return zh()?cn:en;}
  function qbText(key,fallback){return W.I18n&&W.I18n.qbText?W.I18n.qbText(key,fallback):fallback;}
  function capabilitiesReady(){return W.CapabilityRegistry?Promise.resolve(W.CapabilityRegistry):Promise.reject(new Error('Capability registry is not loaded'));}

  var defs=[
    {kind:'category',capability:'categoryFacet',copy:'sidebar.categories',title:function(){return qbText('sidebar.categories',label('Categories','分类'));},className:'facet-select--category',aria:function(){return label('Category filter','分类筛选');},set:function(v){return W.LibraryController&&W.LibraryController.setCategory(v);}},
    {kind:'tag',capability:'tagFacet',copy:'sidebar.tags',title:function(){return qbText('sidebar.tags',label('Tags','标签'));},className:'facet-select--tag',aria:function(){return label('Tag filter','标签筛选');},set:function(v){return W.LibraryController&&W.LibraryController.setTag(v);}},
    {kind:'tracker',copy:'sidebar.trackers',title:function(){return qbText('sidebar.trackers',label('Trackers','TRACKER'));},className:'facet-select--tracker',aria:function(){return label('Tracker filter','Tracker 筛选');},set:function(v){return W.LibraryController&&W.LibraryController.setTracker(v);}},
    {kind:'savePath',title:function(){return W.t?W.t('sidebar.savePath'):label('Save path','路径');},className:'facet-select--path',aria:function(){return label('Save path filter','保存路径筛选');},set:function(v){return W.LibraryController&&W.LibraryController.setSavePath(v);}}
  ];
  var controls={},titles={},host=null;
  function fallbackOptions(kind){var key=kind==='tracker'?'tracker.all':kind==='savePath'?'path.all':kind==='category'?'category.all':'tag.all',fallback=kind==='tracker'?label('All Trackers','全部 Tracker'):kind==='savePath'?label('All Paths','全部路径'):kind==='category'?label('All Categories','全部分类'):label('All Tags','全部标签'),text=W.t?W.t(key):'';return[{value:'',label:text&&text!==key?text:fallback}];}
  function currentValue(kind){var state=W.LibraryController&&W.LibraryController.state?W.LibraryController.state():null;if(!state)return'';return kind==='savePath'?state.savePath:String(state[kind]||'');}
  function blocked(def){if(!def.capability)return false;var registry=W.CapabilityRegistry;if(!registry)return false;if(registry.supports(def.capability))return false;registry.open(def.capability);return true;}
  function createControl(def){var wrap=document.createElement('div');wrap.className='facet-control '+def.className;wrap.dataset.facet=def.kind;if(def.capability)wrap.dataset.capability=def.capability;var title=document.createElement('div');title.className='eyebrow facet-control__title';title.textContent=def.title();wrap.appendChild(title);titles[def.kind]=title;var control=C.selectControl({options:fallbackOptions(def.kind),value:'',searchable:true,searchThreshold:14,ariaLabel:def.aria(),className:'facet-select',nativeTitle:def.capability?false:true,onOpen:function(){return blocked(def)?false:true;},onChange:function(value){if(blocked(def))return;def.set(value);requestAnimationFrame(syncFacets);}});wrap.appendChild(control);controls[def.kind]=control;return wrap;}
  function installFacetControls(){host=document.getElementById('facet-controls');if(!host)return null;if(!host.dataset.facetsReady){host.dataset.facetsReady='1';host.textContent='';defs.forEach(function(def){host.appendChild(createControl(def));});}syncFacets();return host;}
  function syncNativeTitle(){var title=document.querySelector('#sidebar>.sidebar__section:first-child>.eyebrow');if(title){title.removeAttribute('data-i18n');title.textContent=qbText('sidebar.status',W.t?W.t('torrent.status'):label('Status','状态'));}}
  function syncFacets(){if(!host)installFacetControls();if(!host||!W.LibraryController)return;syncNativeTitle();defs.forEach(function(def){var control=controls[def.kind];if(!control)return;if(titles[def.kind])titles[def.kind].textContent=def.title();var options=W.LibraryController.facetOptions?W.LibraryController.facetOptions(def.kind):fallbackOptions(def.kind);control.setOptions(options&&options.length?options:fallbackOptions(def.kind));control.setValue(currentValue(def.kind));var trigger=control.querySelector&&control.querySelector('.ui-select__trigger');if(trigger)trigger.setAttribute('aria-label',def.aria());var wrap=control.closest&&control.closest('[data-facet]');if(wrap&&def.capability&&W.CapabilityRegistry)W.CapabilityRegistry.decorate(wrap,def.capability);});}
  function sync(){syncFacets();if(W.CapabilityRegistry)W.CapabilityRegistry.sync();}
  function init(){installFacetControls();capabilitiesReady().then(function(registry){return registry.load().then(function(){registry.sync();return registry;});}).catch(function(error){console.error('[WeiG capabilities]',error);});}
  W.SpatialRuntime={init:init,installFacetControls:installFacetControls,syncFacets:syncFacets,capabilitiesReady:capabilitiesReady};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  global.addEventListener('weigg:library-state',function(){requestAnimationFrame(syncFacets);});
  global.addEventListener('weigg:languagechange',function(){requestAnimationFrame(sync);});
})(window);
