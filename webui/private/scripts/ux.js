(function(global){
  'use strict';
  var W=global.WeiG,U=W.util,I=W.I18n;
  if(!W||!U||!I)return;
  function routeName(){var r=W.Router.route();return r.name||'home';}
  function syncRouteText(){var name=routeName();if(name==='settings')syncSettingsSearch();syncCapabilities();}
  function syncCapabilities(){['search','rss','logs'].forEach(function(cap){var nodes=U.$$('[data-capability="'+cap+'"]');if(!nodes.length)return;var hidden=nodes.some(function(n){return n.hidden;});nodes.forEach(function(n){n.hidden=hidden;});});}
  function syncSettingsSearch(){var input=U.$('settings-search-input');if(!input||input.__weigBound)return;input.__weigBound=true;input.addEventListener('input',function(){filterSettings(input.value);});}
  function filterSettings(query){var q=String(query||'').trim().toLocaleLowerCase();U.$$('#settings-content .setting-row').forEach(function(row){var value=(row.dataset.settingSearch||row.textContent||'').toLocaleLowerCase();row.hidden=!!q&&value.indexOf(q)<0;});}
  function refreshTranslations(root){I.apply(root||document);if(routeName()==='settings')filterSettings(U.$('settings-search-input')?U.$('settings-search-input').value:'');if(W.SpatialRuntime&&W.SpatialRuntime.syncFacets)W.SpatialRuntime.syncFacets();}
  function refreshDynamic(){refreshTranslations(document.body);}
  function init(){I.apply(document);syncSettingsSearch();syncRouteText();refreshTranslations(document.body);global.addEventListener('hashchange',function(){syncRouteText();refreshDynamic();});global.addEventListener('weig:route-state',function(){syncRouteText();refreshDynamic();});global.addEventListener('weig:settings-render',function(){syncSettingsSearch();refreshDynamic();});global.addEventListener('weig:languagechange',function(){syncRouteText();refreshDynamic();});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
