(function(global){
  'use strict';
  var W=global.WeiG,U=W.util,I=W.I18n;
  if(!W||!U||!I)return;
  function routeName(){var r=W.Router.route();return r.name||'home';}
  function syncRouteText(){syncCapabilities();}
  function syncCapabilities(){['search','rss','logs'].forEach(function(cap){var nodes=U.$$('[data-capability="'+cap+'"]');if(!nodes.length)return;var hidden=nodes.some(function(n){return n.hidden;});nodes.forEach(function(n){n.hidden=hidden;});});}
  function refreshTranslations(root){I.apply(root||document);if(W.SpatialRuntime&&W.SpatialRuntime.syncFacets)W.SpatialRuntime.syncFacets();}
  function refreshDynamic(){refreshTranslations(document.body);}
  function init(){I.apply(document);syncRouteText();refreshTranslations(document.body);global.addEventListener('hashchange',function(){syncRouteText();refreshDynamic();});global.addEventListener('weig:route-state',function(){syncRouteText();refreshDynamic();});global.addEventListener('weig:settings-render',refreshDynamic);global.addEventListener('weig:languagechange',function(){syncRouteText();refreshDynamic();});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
