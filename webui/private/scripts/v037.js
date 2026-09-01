(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  if(W.V037||W.__v037Loading)return;
  W.__v037Loading=true;
  var VERSION='0.3.7',cssObserver=null,ordering=false,legacySelectObserver=null,filterNavObserver=null,filterNavNode=null,railFitObserver=null,railFitList=null;
  function url(path){return W.buildAssetUrl?W.buildAssetUrl(path):path;}
  function stylesheet(path,tag){if(document.querySelector('link[data-weigg-layer="'+tag+'"]'))return;var l=document.createElement('link');l.rel='stylesheet';l.dataset.weiggLayer=tag;l.href=url(path);document.head.appendChild(l);}
  function ensureCssOrder(){if(ordering)return;var legacy=document.querySelector('link[href*="mobile-v036.css"]'),v=document.querySelector('link[data-weigg-layer="v037"]'),ui=document.querySelector('link[data-weigg-layer="ui-system-037"]');if(!v||!ui)return;var nodes=Array.from(document.head.children),li=legacy?nodes.indexOf(legacy):-1,vi=nodes.indexOf(v),uii=nodes.indexOf(ui);if((legacy&&li<vi&&vi<uii)||(!legacy&&vi<uii))return;ordering=true;if(legacy&&legacy.parentNode===document.head)legacy.insertAdjacentElement('afterend',v);else document.head.appendChild(v);v.insertAdjacentElement('afterend',ui);ordering=false;}
  function ownCssOrder(){ensureCssOrder();if(cssObserver)return;cssObserver=new MutationObserver(function(){requestAnimationFrame(ensureCssOrder);});cssObserver.observe(document.head,{childList:true});}
  function mobileFilterOptions(){var nav=document.getElementById('filter-nav');if(!nav)return[];return Array.from(nav.querySelectorAll('[data-filter]')).map(function(btn){return{value:btn.dataset.filter||'all',label:String(btn.textContent||'').replace(/\s·\s\d+$/,'').trim()||'All'};});}
  function mobileFilterValue(){var active=document.querySelector('#filter-nav [data-filter].is-active');return active?active.dataset.filter||'all':'all';}
  function filterOptionsSignature(options){return JSON.stringify((options||[]).map(function(item){return[item.value,item.label];}));}
  function ownFilterNav(){
    var nav=document.getElementById('filter-nav');if(nav===filterNavNode)return;
    if(filterNavObserver)filterNavObserver.disconnect();filterNavNode=nav||null;if(!nav)return;
    filterNavObserver=new MutationObserver(function(){requestAnimationFrame(dedupeLegacyMobileFilter);});
    filterNavObserver.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  function dedupeLegacyMobileFilter(){
    ownFilterNav();
    var host=document.querySelector('#mobile-command-bar .mobile-filter-control');if(!host)return;
    var C=W.Components,native=host.querySelector(':scope > select');if(native)native.dataset.uiSelectUpgraded='1';
    Array.from(host.querySelectorAll(':scope > .ui-select--native')).forEach(function(node){node.remove();});
    var options=mobileFilterOptions(),value=mobileFilterValue(),signature=filterOptionsSignature(options),explicit=host.querySelector(':scope > .ui-select:not(.ui-select--native)');
    if(C&&C.__floatingSelectV036&&typeof C.selectControl==='function'&&(!explicit||!explicit.__uiMenu)){
      if(explicit)explicit.remove();
      explicit=C.selectControl({options:options,value:value,ariaLabel:(native&&native.getAttribute('aria-label'))||'Torrent filter',onChange:function(next){var target=document.querySelector('#filter-nav [data-filter="'+next+'"]');if(target)target.click();}});
      explicit.dataset.v037FilterOptions=signature;host.appendChild(explicit);return;
    }
    if(!explicit)return;
    if(typeof explicit.setOptions==='function'&&explicit.dataset.v037FilterOptions!==signature){explicit.setOptions(options);explicit.dataset.v037FilterOptions=signature;}
    if(typeof explicit.setValue==='function'&&typeof explicit.getValue==='function'&&explicit.getValue()!==value)explicit.setValue(value);
  }
  function relevantLegacyMutation(record){
    function relevant(node){if(!node||node.nodeType!==1)return false;if(node.matches&&node.matches('#mobile-command-bar,#filter-nav,.mobile-filter-control'))return true;return !!(node.querySelector&&node.querySelector('#mobile-command-bar,#filter-nav,.mobile-filter-control'));}
    if(relevant(record.target))return true;
    return Array.from(record.addedNodes||[]).some(relevant)||Array.from(record.removedNodes||[]).some(relevant);
  }
  function ownLegacyMobileFilter(){dedupeLegacyMobileFilter();if(legacySelectObserver||!document.documentElement)return;legacySelectObserver=new MutationObserver(function(records){if(records.some(relevantLegacyMutation))requestAnimationFrame(dedupeLegacyMobileFilter);});legacySelectObserver.observe(document.documentElement,{childList:true,subtree:true});}
  function fitRailNode(node){
    var fit=W.V037UiSystem&&W.V037UiSystem.fitMobileRail;if(typeof fit!=='function'||!node||node.nodeType!==1)return;
    if(node.matches&&node.matches('.torrent-mobile-card--two-line'))fit(node);
    if(node.querySelectorAll)Array.from(node.querySelectorAll('.torrent-mobile-card--two-line')).forEach(fit);
  }
  function scheduleRailFit(node){fitRailNode(node);requestAnimationFrame(function(){fitRailNode(node);});}
  function ownMobileRailFit(){
    var list=document.getElementById('torrent-list');if(list===railFitList)return;
    if(railFitObserver)railFitObserver.disconnect();railFitList=list||null;if(!list)return;
    railFitObserver=new MutationObserver(function(records){records.forEach(function(record){Array.from(record.addedNodes||[]).forEach(scheduleRailFit);});});
    railFitObserver.observe(list,{childList:true,subtree:true});
    Array.from(list.querySelectorAll('.torrent-mobile-card--two-line')).forEach(scheduleRailFit);
  }
  function css(){stylesheet('css/v037.css','v037');stylesheet('css/ui-system-v037.css','ui-system-037');ownCssOrder();}
  function load(path,tag){return new Promise(function(resolve,reject){if(tag&&document.querySelector('script[data-weigg-layer="'+tag+'"]')){resolve();return;}var s=document.createElement('script');s.async=false;if(tag)s.dataset.weiggLayer=tag;s.src=url(path);s.onload=resolve;s.onerror=function(){reject(new Error('Unable to load '+path));};document.head.appendChild(s);});}
  function start(){
    css();document.documentElement.dataset.v037='1';ownLegacyMobileFilter();
    load('scripts/i18n-v037.js','i18n-037')
      .then(function(){return load('scripts/settings-v037.js','settings-037');})
      .then(function(){return load('scripts/selection-v037.js','selection-037');})
      .then(function(){return load('scripts/layout-v037.js','layout-037');})
      .then(function(){return load('scripts/ui-system-v037.js','ui-system-037');})
      .then(function(){
        var init=function(){ensureCssOrder();dedupeLegacyMobileFilter();if(W.V037Settings)W.V037Settings.init();if(W.V037Selection)W.V037Selection.init();if(W.V037Layout)W.V037Layout.init();if(W.V037UiSystem)W.V037UiSystem.init();ownMobileRailFit();dedupeLegacyMobileFilter();W.V037={version:VERSION,settings:W.V037Settings,selection:W.V037Selection,layout:W.V037Layout,ui:W.V037UiSystem};global.dispatchEvent(new CustomEvent('weigg:v037ready'));};
        if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
      }).catch(function(error){W.__v037Loading=false;console.error('[WeiG v0.3.7]',error);});
  }
  start();
})(window);