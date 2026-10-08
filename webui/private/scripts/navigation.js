(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},SESSION_STORE=W.StorageRuntime&&W.StorageRuntime.session;
  var KEY=(W.StorageKeys&&W.StorageKeys.torrentListContext)||'weig.torrentListContext',ROUTE_MODULES={settings:['scripts/settings.js'],rss:['scripts/rss.js'],logs:['scripts/logs.js']},routeModules={};
  function route(){return W.Router&&W.Router.route?W.Router.route():{name:'home'};}
  function isMobile(){return !!(global.matchMedia&&global.matchMedia('(max-width: 820px)').matches);}
  function read(){try{return JSON.parse((SESSION_STORE?SESSION_STORE.get(KEY,null):null)||'null');}catch(_e){return null;}}
  function write(v){if(SESSION_STORE)SESSION_STORE.set(KEY,JSON.stringify(v));}
  function capture(){var list=document.getElementById('torrent-list');write({hash:location.hash||'#/',scrollTop:list?list.scrollTop:0,savedAt:Date.now(),restore:false});}
  function restore(){var c=read();if(!c||!c.restore||route().name!=='home')return;var list=document.getElementById('torrent-list'),tries=0,target=Math.max(0,Number(c.scrollTop)||0);function apply(){list=document.getElementById('torrent-list');if(!list||route().name!=='home')return;if(list.scrollHeight<=list.clientHeight&&tries++<12)return setTimeout(apply,40);list.__weigDataViewportScrollTop=target;list.scrollTop=target;if(list.__weigDataViewportScrollHandler)list.__weigDataViewportScrollHandler();if(Math.abs(list.scrollTop-target)>4&&tries++<12)return setTimeout(apply,40);c.restore=false;write(c);}requestAnimationFrame(function(){requestAnimationFrame(apply);});}
  function back(){if(route().name!=='torrent')return false;var c=read();if(c){c.restore=true;write(c);}if(W.Router)W.Router.home();return true;}
  function createBack(){var b=document.createElement('button');b.type='button';b.className='btn btn--ghost detail-context-back';b.dataset.detailBack='1';b.innerHTML='<b aria-hidden="true">←</b><span></span>';b.addEventListener('click',back);return b;}
  function routeModuleReady(name){return name==='settings'?!!W.SettingsRenderer:name==='rss'?!!W.RSSWorkspace:name==='logs'?!!W.Logs:false;}function loadRouteModule(name){name=String(name||'');var paths=ROUTE_MODULES[name]||[];if(!paths.length||routeModuleReady(name))return Promise.resolve(paths.slice());if(routeModules[name])return routeModules[name];var loader=W.RuntimeAssets&&W.RuntimeAssets.loadScript;if(typeof loader!=='function')return Promise.reject(new Error('Route module loader unavailable for '+name));var task=paths.reduce(function(chain,path){return chain.then(function(){return loader(path,{namespace:'route-module',identity:name});});},Promise.resolve()).then(function(){if(!routeModuleReady(name))throw new Error('Route module '+name+' loaded without registering its owner');return paths.slice();}).catch(function(error){delete routeModules[name];throw error;});routeModules[name]=task;return task;}
  var warmStarted=false,warmIndex=0,warmQueued=false;
  function warmRouteModules(){
    warmStarted=true;
    if(warmQueued||document.hidden||route().name!=='home')return;
    var names=Object.keys(ROUTE_MODULES),loader=W.RuntimeAssets;
    if(!loader||typeof loader.prefetchScript!=='function'||warmIndex>=names.length)return;
    var connection=global.navigator&&global.navigator.connection;
    if(connection&&(connection.saveData===true||/2g/.test(String(connection.effectiveType||''))))return;
    warmQueued=true;
    var run=function(){
      warmQueued=false;if(document.hidden||route().name!=='home')return;
      var name=names[warmIndex++],paths=ROUTE_MODULES[name]||[];
      paths.forEach(function(path){loader.prefetchScript(path,{namespace:'route-module',identity:name});});
      if(warmIndex<names.length)global.setTimeout(warmRouteModules,500);
    };
    if(typeof global.requestIdleCallback==='function')global.requestIdleCallback(run,{timeout:2500});
    else global.setTimeout(run,800);
  }
  function sync(){var tabs=document.querySelector('#detail-view .detail-tabs'),slot=document.getElementById('detail-context-slot'),r=route(),b=document.querySelector('[data-detail-back]');if(r.name!=='torrent'){if(b)b.remove();restore();return;}if(!tabs)return;if(!b)b=createBack();var mobile=isMobile(),target=mobile&&slot?slot:tabs;if(target&&b.parentElement!==target){if(target===tabs)tabs.insertBefore(b,tabs.firstChild);else target.appendChild(b);}b.classList.toggle('detail-context-back--mobile',mobile);var label=b.querySelector('span');if(label){var I=W.I18n;label.textContent=I&&I.t?I.t(mobile?'detail.backShort':'detail.back'):(mobile?'Back':'Back to torrents');}}
  function editable(){var e=document.activeElement;return !!(e&&(/^(INPUT|TEXTAREA)$/.test(e.tagName)||e.isContentEditable));}
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('.torrent-title,.row-more,.mobile-card-title'))capture();},true);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&route().name==='torrent'&&!editable()&&!document.querySelector('dialog[open]')){e.preventDefault();back();}},true);
  global.addEventListener('hashchange',function(){setTimeout(sync,20);});
  global.addEventListener('resize',function(){requestAnimationFrame(sync);},{passive:true});
  global.addEventListener('hashchange',function(){if(warmStarted)warmRouteModules();});
  document.addEventListener('visibilitychange',function(){if(warmStarted)warmRouteModules();});
  function init(){sync();setTimeout(sync,400);}
  W.Navigation={goHome:function(){if(W.Router)W.Router.home();else location.hash='#/';},backFromDetail:back,restoreListContext:restore,syncDetailBack:sync,loadRouteModule:loadRouteModule,warmRouteModules:warmRouteModules,routeModulePaths:function(name){return(ROUTE_MODULES[String(name||'')]||[]).slice();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
