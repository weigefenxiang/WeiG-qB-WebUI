(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},SESSION_STORE=W.StorageRuntime&&W.StorageRuntime.session;
  var KEY=(W.StorageKeys&&W.StorageKeys.torrentListContext)||'weig.torrentListContext',ROUTE_MODULES={settings:['scripts/update-check.js','scripts/bug-report.js','scripts/settings.js'],rss:['scripts/rss.js'],logs:['scripts/logs.js']},routeModules={};
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
  function routePrefetchBusy(){var app=W.AppState,viewport=app&&app.viewport,library=app&&app.libraryData;if(viewport&&typeof viewport.isInteracting==='function'&&viewport.isInteracting())return true;var state=library&&typeof library.stats==='function'?library.stats():null;return !!(state&&(state.pageTraffic>0||state.totalDemand>0||state.prefetchDemand>0||state.catalogBusy===true));}
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
      if(routePrefetchBusy()){global.setTimeout(warmRouteModules,350);return;}
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
  // Route owner also owns the native horizontal text viewport in the fixed bottom dock.
  // Dragging a label must not accidentally activate its route; icons/buttons stay fixed.
  function installBottomNavTextScroll(){
    var dock=document.getElementById('mobile-bottom-nav');
    if(!dock||dock.dataset.textScrollReady==='1')return;
    dock.dataset.textScrollReady='1';
    var gesture=null;
    function labelFor(target){return target&&target.closest?target.closest('.mobile-bottom-nav__item small'):null;}
    function refreshLabels(){
      Array.from(dock.querySelectorAll('.mobile-bottom-nav__item')).forEach(function(button){
        var label=button.querySelector('small');
        if(label)button.setAttribute('aria-label',String(label.textContent||'').trim());
      });
    }
    dock.addEventListener('pointerdown',function(e){
      var label=labelFor(e.target);
      gesture=label&&e.isPrimary!==false?{label:label,id:e.pointerId,x:e.clientX,initialScroll:label.scrollLeft,moved:false}:null;
    },true);
    dock.addEventListener('pointermove',function(e){
      if(gesture&&e.pointerId===gesture.id&&(Math.abs(e.clientX-gesture.x)>7||Math.abs(gesture.label.scrollLeft-gesture.initialScroll)>2))gesture.moved=true;
    },true);
    dock.addEventListener('click',function(e){
      if(gesture&&gesture.moved&&gesture.label.closest('.mobile-bottom-nav__item')===e.target.closest('.mobile-bottom-nav__item')){
        e.preventDefault();e.stopImmediatePropagation();
      }
      gesture=null;
    },true);
    dock.addEventListener('pointercancel',function(){gesture=null;},true);
    dock.addEventListener('keydown',function(e){
      if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
      var button=e.target.closest&&e.target.closest('.mobile-bottom-nav__item'),label=button&&button.querySelector('small');
      if(!label||label.scrollWidth<=label.clientWidth+1)return;
      e.preventDefault();
      label.scrollBy({left:e.key==='ArrowRight'?Math.max(24,label.clientWidth*.6):-Math.max(24,label.clientWidth*.6),behavior:'auto'});
    });
    global.addEventListener('weig:languagechange',function(){refreshLabels();dock.querySelectorAll('.mobile-bottom-nav__item small').forEach(function(label){label.scrollLeft=0;});});
    refreshLabels();
  }
  var instancesTask=null;
  function loadInstances(){
    if(W.InstancesUI)return Promise.resolve(W.InstancesUI);
    if(instancesTask)return instancesTask;
    var asset=W.RuntimeAssets&&W.RuntimeAssets.loadScript;
    if(typeof asset!=='function')return Promise.reject(new Error('Shared module loader unavailable.'));
    var modules=['scripts/instance-registry.js','scripts/instance-health.js','scripts/instances-ui.js'];
    instancesTask=modules.reduce(function(p,path){return p.then(function(){
      return asset(path,{namespace:'sidebar-feature',identity:'instances'});
    });},Promise.resolve()).then(function(){
      if(!W.InstancesUI)throw new Error('Instance UI owner did not initialize.');
      return W.InstancesUI;
    }).catch(function(error){instancesTask=null;throw error;});
    return instancesTask;
  }
  function afterFirstPaint(){
    var start=function(){loadInstances().catch(function(error){
      var box=document.getElementById('sidebar-instances');
      if(box)box.textContent=W.I18n&&W.I18n.t?W.I18n.t('instances.loadFailed'):'Instances unavailable';
      console.error('[WeiG instance modules]',error);
    });};
    if(global.requestAnimationFrame)global.requestAnimationFrame(function(){global.requestAnimationFrame(start);});
    else setTimeout(start,0);
  }
  function init(){installBottomNavTextScroll();sync();setTimeout(sync,400);afterFirstPaint();}
  W.Navigation={goHome:function(){if(W.Router)W.Router.home();else location.hash='#/';},backFromDetail:back,restoreListContext:restore,syncDetailBack:sync,loadRouteModule:loadRouteModule,warmRouteModules:warmRouteModules,loadInstances:loadInstances,routeModulePaths:function(name){return(ROUTE_MODULES[String(name||'')]||[]).slice();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
