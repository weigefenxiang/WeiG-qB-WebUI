(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  if(W.V037||W.__v037Loading)return;
  W.__v037Loading=true;
  var VERSION='0.3.7';
  function url(path){return W.buildAssetUrl?W.buildAssetUrl(path):path;}
  function stylesheet(path,tag){if(document.querySelector('link[data-weigg-layer="'+tag+'"]'))return;var l=document.createElement('link');l.rel='stylesheet';l.dataset.weiggLayer=tag;l.href=url(path);document.head.appendChild(l);}
  function css(){stylesheet('css/v037.css','v037');stylesheet('css/ui-system-v037.css','ui-system-037');}
  function load(path,tag){return new Promise(function(resolve,reject){if(tag&&document.querySelector('script[data-weigg-layer="'+tag+'"]')){resolve();return;}var s=document.createElement('script');s.async=false;if(tag)s.dataset.weiggLayer=tag;s.src=url(path);s.onload=resolve;s.onerror=function(){reject(new Error('Unable to load '+path));};document.head.appendChild(s);});}
  function start(){
    css();document.documentElement.dataset.v037='1';
    load('scripts/i18n-v037.js','i18n-037')
      .then(function(){return load('scripts/settings-v037.js','settings-037');})
      .then(function(){return load('scripts/selection-v037.js','selection-037');})
      .then(function(){return load('scripts/layout-v037.js','layout-037');})
      .then(function(){return load('scripts/ui-system-v037.js','ui-system-037');})
      .then(function(){
        var init=function(){if(W.V037Settings)W.V037Settings.init();if(W.V037Selection)W.V037Selection.init();if(W.V037Layout)W.V037Layout.init();if(W.V037UiSystem)W.V037UiSystem.init();W.V037={version:VERSION,settings:W.V037Settings,selection:W.V037Selection,layout:W.V037Layout,ui:W.V037UiSystem};global.dispatchEvent(new CustomEvent('weigg:v037ready'));};
        if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
      }).catch(function(error){W.__v037Loading=false;console.error('[WeiG v0.3.7]',error);});
  }
  start();
})(window);
