(function(global){
  'use strict';
  var W=global.WeiG,U=W&&W.util,C=W&&W.Components;
  if(!W||!U||!W.QBClient||!W.VirtualList||!C)return;

  var state={client:null,items:[],lastId:-1,types:new Set([1,2,4,8]),query:'',follow:true,virtual:null,timer:null,loading:false,active:false,root:null,sizeMode:localStorage.getItem('weigg.logs.sizeMode')||'auto',observer:null,rendering:false,programmaticScroll:false};
  var MAX_ITEMS=5000;
  function tr(key,vars,fallback){var I=W.RuntimeI18n;return I&&I.t?I.t(key,vars):(fallback||key);}
  function onLogsRoute(){return W.Router&&W.Router.route&&W.Router.route().name==='logs';}
  function typeLabel(type){return type===1?tr('v036.logs.normal',null,'Normal'):type===2?tr('v036.logs.info',null,'Info'):type===4?tr('v036.logs.warning',null,'Warning'):type===8?tr('v036.logs.critical',null,'Critical'):tr('v036.logs.unknown',null,'Unknown');}
  function typeTone(type){return type===8?'danger':type===4?'warning':type===2?'info':'normal';}
  function itemId(x){return Number(x&&x.id);}
  function timestampMs(x){var v=Number(x&&x.timestamp);if(!Number.isFinite(v)||v<=0)return 0;return v>=1e12?v:v*1000;}
  function formatTime(x){var ms=timestampMs(x);if(!ms)return '';return W.Time&&W.Time.format?W.Time.format(ms):new Date(ms).toLocaleString();}
  function filtered(){var q=state.query.trim().toLocaleLowerCase();return state.items.filter(function(x){return state.types.has(Number(x.type))&&(!q||String(x.message||'').toLocaleLowerCase().indexOf(q)>=0);});}
  function stopPoll(){clearTimeout(state.timer);state.timer=null;}
  function schedulePoll(){stopPoll();if(!state.active||!onLogsRoute())return;var cfg=W.Config&&W.Config.load?W.Config.load():{};var delay=document.hidden?10000:Math.max(1500,Number(cfg.refresh)||2500);state.timer=setTimeout(fetchIncremental,delay);}

  function makeButton(label,cls){var b=document.createElement('button');b.type='button';b.className=cls||'btn btn--ghost';b.textContent=label;return b;}
  function applySizeMode(){var view=U.$('logs-view');if(!view)return;['auto','compact','max'].forEach(function(m){view.classList.toggle('logs-size-'+m,state.sizeMode===m);});localStorage.setItem('weigg.logs.sizeMode',state.sizeMode);var sel=U.$('logs-size-mode');if(sel&&sel.setValue)sel.setValue(state.sizeMode);}
  function syncFollowControl(){var wrap=state.root&&state.root.querySelector('[data-logs-follow]');if(wrap&&wrap.input)wrap.input.checked=state.follow;}

  function buildShell(root){
    state.rendering=true;
    root.textContent='';
    root.dataset.weiggLogsReady='1';
    var shell=document.createElement('div');shell.className='logs-shell';shell.dataset.weiggLogShell='1';
    var toolbar=document.createElement('div');toolbar.className='logs-toolbar grid-toolbar';
    var search=document.createElement('label');search.className='search-box logs-search';search.innerHTML='<span aria-hidden="true">⌕</span>';
    var input=document.createElement('input');input.id='logs-local-search';input.type='search';input.autocomplete='off';input.placeholder=W.t?W.t('search.logs'):'Search logs…';input.value=state.query;search.appendChild(input);
    var filters=document.createElement('div');filters.className='logs-filters';
    [1,2,4,8].forEach(function(type){var b=C.filterChip(typeLabel(type),state.types.has(type));b.dataset.logType=String(type);filters.appendChild(b);});
    var actions=document.createElement('div');actions.className='logs-actions';
    var follow=C.checkControl(tr('v036.logs.follow',null,'Follow latest'),state.follow,function(checked){state.follow=checked;if(state.follow)scrollLatest();});follow.dataset.logsFollow='1';
    var size=C.selectControl({id:'logs-size-mode',value:state.sizeMode,options:[{value:'compact',label:tr('v036.logs.compact',null,'Compact')},{value:'auto',label:tr('v036.logs.auto',null,'Auto')},{value:'max',label:tr('v036.logs.max',null,'Max')}],ariaLabel:tr('v036.logs.auto',null,'Auto'),onChange:function(value){state.sizeMode=value;applySizeMode();setTimeout(function(){if(state.virtual&&state.virtual.render)state.virtual.render();},40);}});size.classList.add('logs-size-mode');
    var refresh=makeButton('↻ '+tr('v036.logs.refresh',null,'Refresh'),'btn btn--ghost logs-refresh');
    actions.append(follow,size,refresh);
    toolbar.append(search,filters,actions);

    var panel=document.createElement('section');panel.className='logs-panel surface surface--panel';
    var head=document.createElement('div');head.className='logs-head';head.innerHTML='<span>'+tr('v036.logs.log',null,'Log')+'</span><span>'+tr('v036.logs.time',null,'Time')+'</span><span>'+tr('v036.logs.level',null,'Level')+'</span>';
    var list=document.createElement('div');list.className='logs-list';list.setAttribute('role','list');
    var empty=document.createElement('div');empty.className='logs-empty is-hidden';empty.textContent=tr('v036.logs.empty',null,'No logs match the current filters.');
    var status=document.createElement('div');status.className='logs-status text-description';
    panel.append(head,list,empty,status);shell.append(toolbar,panel);root.appendChild(shell);state.root=root;

    input.addEventListener('input',function(){state.query=input.value;syncTopSearch();renderRows(true,0);});
    filters.addEventListener('click',function(e){var b=e.target.closest('[data-log-type]');if(!b)return;var type=Number(b.dataset.logType);if(state.types.has(type)){if(state.types.size>1)state.types.delete(type);}else state.types.add(type);b.classList.toggle('is-active',state.types.has(type));b.setAttribute('aria-pressed',state.types.has(type)?'true':'false');renderRows(true,0);});
    list.addEventListener('scroll',function(){if(state.programmaticScroll||!state.follow)return;if(list.scrollTop>40){state.follow=false;syncFollowControl();}},{passive:true});
    refresh.addEventListener('click',function(){fetchInitial(true);});
    applySizeMode();
    state.rendering=false;
  }

  function renderRows(reset,added){
    var root=U.$('logs-content');if(!root)return;
    if(!root.querySelector('[data-weigg-log-shell]'))buildShell(root);
    var list=root.querySelector('.logs-list'),empty=root.querySelector('.logs-empty'),status=root.querySelector('.logs-status');if(!list)return;
    var items=filtered(),previousTop=list.scrollTop;
    if(!state.virtual||state.virtual.el!==list){
      state.virtual=new W.VirtualList(list,{rowHeight:54,overscan:8,renderRow:function(x){
        var row=document.createElement('div');row.className='logs-row';row.dataset.tone=typeTone(Number(x.type));row.setAttribute('role','listitem');row.dataset.logId=String(itemId(x));
        var msg=document.createElement('span');msg.className='logs-message';msg.textContent=x.message||'';
        var ts=document.createElement('time');ts.className='logs-time';ts.dateTime=timestampMs(x)?new Date(timestampMs(x)).toISOString():'';ts.textContent=formatTime(x);
        var level=document.createElement('span');level.className='logs-level status-pill';level.dataset.tone=typeTone(Number(x.type));level.textContent=typeLabel(Number(x.type));
        row.append(msg,ts,level);return row;
      }});
    }
    state.virtual.setItems(items);
    if(reset&&state.virtual.resetScroll)state.virtual.resetScroll();
    else if(!state.follow&&added>0&&previousTop>0){var keep=previousTop+added*54;list.__weiggVirtualScrollTop=keep;list.scrollTop=keep;state.virtual.render();}
    empty.classList.toggle('is-hidden',items.length!==0);
    status.textContent=tr('v036.logs.showing',{shown:items.length,total:state.items.length},'Showing '+items.length+' / '+state.items.length+' · newest first');
    if(state.follow)scrollLatest();
  }

  function scrollLatest(){var list=state.root&&state.root.querySelector('.logs-list');if(!list)return;state.programmaticScroll=true;requestAnimationFrame(function(){list.__weiggVirtualScrollTop=0;list.scrollTop=0;if(state.virtual&&state.virtual.render)state.virtual.render();requestAnimationFrame(function(){state.programmaticScroll=false;});});}
  function merge(items,replace){items=Array.isArray(items)?items:[];if(replace)state.items=[];var known=new Set(state.items.map(function(x){return itemId(x);})),added=0;items.forEach(function(x){var id=itemId(x);if(Number.isFinite(id)&&known.has(id))return;state.items.push(x);added++;if(Number.isFinite(id))known.add(id);});state.items.sort(function(a,b){var ai=itemId(a),bi=itemId(b);if(Number.isFinite(ai)&&Number.isFinite(bi))return bi-ai;return timestampMs(b)-timestampMs(a);});if(state.items.length>MAX_ITEMS)state.items=state.items.slice(0,MAX_ITEMS);var ids=state.items.map(itemId).filter(Number.isFinite);state.lastId=ids.length?Math.max.apply(Math,ids):-1;return added;}

  async function ensureClient(){if(state.client)return state.client;state.client=new W.QBClient();await state.client.detect();return state.client;}
  async function fetchInitial(force){if(state.loading)return;state.loading=true;try{var client=await ensureClient();if(!client.capabilities.logs){showUnsupported();return;}var items=await client.logs(-1);merge(items,true);renderRows(false,0);if(state.follow)scrollLatest();}catch(e){showError(e);}finally{state.loading=false;schedulePoll();}}
  async function fetchIncremental(){if(state.loading||!state.active||!onLogsRoute()){schedulePoll();return;}state.loading=true;try{var client=await ensureClient();var items=await client.logs(state.lastId);if(Array.isArray(items)&&items.length){var added=merge(items,false);renderRows(false,added);}}catch(_e){}finally{state.loading=false;schedulePoll();}}
  function showUnsupported(){var root=U.$('logs-content');if(!root)return;state.rendering=true;root.innerHTML='<div class="logs-message-state">'+tr('v036.logs.unsupported',null,'This qBittorrent instance does not expose the log API.')+'</div>';state.rendering=false;}
  function showError(e){var root=U.$('logs-content');if(!root)return;state.rendering=true;root.innerHTML='<div class="logs-message-state">'+tr('v036.logs.failed',{error:String(e&&e.message||e)},'Failed to read logs: '+String(e&&e.message||e))+'</div>';state.rendering=false;}
  function syncTopSearch(){var input=U.$('search-input');if(input&&onLogsRoute()&&input.value!==state.query)input.value=state.query;}
  function setQuery(q){state.query=String(q||'');var input=U.$('logs-local-search');if(input&&input.value!==state.query)input.value=state.query;renderRows(true,0);}

  function activate(){if(!onLogsRoute()){state.active=false;stopPoll();return;}state.active=true;var root=U.$('logs-content');if(!root)return;if(!root.querySelector('[data-weigg-log-shell]'))buildShell(root);fetchInitial(false);}
  function observeRoot(){var root=U.$('logs-content');if(!root||state.observer)return;state.observer=new MutationObserver(function(){if(state.rendering||!state.active||!onLogsRoute())return;if(!root.querySelector('[data-weigg-log-shell]'))setTimeout(activate,0);});state.observer.observe(root,{childList:true,subtree:false});}
  function rebuildShell(){if(!onLogsRoute())return;var root=U.$('logs-content');if(!root)return;state.virtual=null;buildShell(root);renderRows(false,0);}
  function init(){observeRoot();document.addEventListener('input',function(e){if(e.target&&e.target.id==='search-input'&&onLogsRoute())setQuery(e.target.value);},true);setTimeout(activate,120);global.addEventListener('hashchange',function(){setTimeout(activate,80);});document.addEventListener('visibilitychange',function(){if(state.active)schedulePoll();});global.addEventListener('weigg:languagechange',rebuildShell);global.addEventListener('weigg:timezonechange',function(){if(state.active)renderRows(false,0);});global.addEventListener('weigg:timeformatrefresh',function(){if(state.active)renderRows(false,0);});}
  W.Logs={setQuery:setQuery,refresh:function(){return fetchInitial(true);},activate:activate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
