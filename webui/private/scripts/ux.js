(function(global){
  'use strict';
  var W=global.WeiG,U=W.util,I=W.I18n,T=W.t;
  if(!W||!U||!I)return;
  var routeSearch={home:'search.torrents',torrent:'search.torrents',settings:'search.settings',search:'search.engine',rss:'search.rss',logs:'search.logs'};
  function routeName(){var r=W.Router.route();return r.name||'home';}
  function syncRouteText(){var name=routeName(),input=U.$('search-input');if(input){input.dataset.i18nPlaceholder=routeSearch[name]||'search.torrents';input.placeholder=T(input.dataset.i18nPlaceholder);if(name!=='home'&&name!=='torrent')input.value='';}if(name==='settings')syncSettingsSearch();syncCapabilities();}
  function syncCapabilities(){['search','rss','logs'].forEach(function(cap){var nodes=U.$$('[data-capability="'+cap+'"]');if(!nodes.length)return;var hidden=nodes.some(function(n){return n.hidden;});nodes.forEach(function(n){n.hidden=hidden;});});}
  function syncSettingsSearch(){var input=U.$('settings-search-input');if(!input||input.__weigBound)return;input.__weigBound=true;input.addEventListener('input',function(){filterSettings(input.value);});}
  function filterSettings(query){var q=String(query||'').trim().toLocaleLowerCase();U.$$('#settings-content .setting-row').forEach(function(row){var value=(row.dataset.settingSearch||row.textContent||'').toLocaleLowerCase();row.hidden=!!q&&value.indexOf(q)<0;});}
  function handleContextQuery(q){var name=routeName();if(name==='settings'){var s=U.$('settings-search-input');if(s){s.value=q;filterSettings(q);}}else if(name==='logs'||name==='rss'){var view=U.$(name+'-view');U.$$('.tool-row',view).forEach(function(row){row.hidden=!!q&&row.textContent.toLocaleLowerCase().indexOf(q.toLocaleLowerCase())<0;});}else if(name==='search'){var e=U.$('engine-query');if(e)e.value=q;}}
  function contextualSearch(){var input=U.$('search-input');if(!input||input.__weigContext)return;input.__weigContext=true;input.addEventListener('input',function(e){var name=routeName();if(name==='home'||name==='torrent')return;handleContextQuery(input.value);e.stopImmediatePropagation();},true);}
  function refreshTranslations(root){I.apply(root||document);if(routeName()==='settings')filterSettings(U.$('settings-search-input')?U.$('settings-search-input').value:'');if(W.SpatialRuntime&&W.SpatialRuntime.syncFacets)W.SpatialRuntime.syncFacets();}
  function refreshDynamic(){refreshTranslations(document.body);}
  function init(){I.apply(document);contextualSearch();syncSettingsSearch();syncRouteText();refreshTranslations(document.body);global.addEventListener('hashchange',function(){syncRouteText();refreshDynamic();});global.addEventListener('weig:route-state',function(){syncRouteText();refreshDynamic();});global.addEventListener('weig:settings-render',function(){syncSettingsSearch();refreshDynamic();});global.addEventListener('weig:languagechange',function(){syncRouteText();refreshDynamic();});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
