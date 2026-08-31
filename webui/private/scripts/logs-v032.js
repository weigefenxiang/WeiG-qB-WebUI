(function(global){
  'use strict';
  var W=global.WeiG,U=W&&W.util;
  if(!W||!U||!W.QBClient||!W.VirtualList)return;

  var state={client:null,items:[],lastId:-1,types:new Set([1,2,4,8]),query:'',follow:true,virtual:null,timer:null,loading:false,active:false,root:null,sizeMode:localStorage.getItem('weigg.logs.sizeMode')||'auto',observer:null,rendering:false};
  var MAX_ITEMS=5000;

  function locale(){return W.I18n&&W.I18n.getLocale?W.I18n.getLocale():'en';}
  function zh(){return /^zh/i.test(locale());}
  function text(en,cn){return zh()?cn:en;}
  function onLogsRoute(){return W.Router&&W.Router.route&&W.Router.route().name==='logs';}
  function typeLabel(type){return type===1?text('Normal','普通'):type===2?text('Info','信息'):type===4?text('Warning','警告'):type===8?text('Critical','严重'):text('Unknown','未知');}
  function typeTone(type){return type===8?'danger':type===4?'warning':type===2?'info':'normal';}
  function itemId(x){return Number(x&&x.id);}
  function timestampMs(x){var v=Number(x&&x.timestamp);if(!Number.isFinite(v)||v<=0)return 0;return v>=1e12?v:v*1000;}
  function formatTime(x){var ms=timestampMs(x);return ms?new Date(ms).toLocaleString():'';}
  function filtered(){var q=state.query.trim().toLocaleLowerCase();return state.items.filter(function(x){return state.types.has(Number(x.type))&&(!q||String(x.message||'').toLocaleLowerCase().indexOf(q)>=0);});}
  function stopPoll(){clearTimeout(state.timer);state.timer=null;}
  function schedulePoll(){stopPoll();if(!state.active||!onLogsRoute())return;var cfg=W.Config&&W.Config.load?W.Config.load():{};var delay=document.hidden?10000:Math.max(1500,Number(cfg.refresh)||2500);state.timer=setTimeout(fetchIncremental,delay);}

  function makeButton(label,cls){var b=document.createElement('button');b.type='button';b.className=cls||'btn btn--ghost';b.textContent=label;return b;}
  function applySizeMode(){var view=U.$('logs-view');if(!view)return;['auto','compact','max'].forEach(function(m){view.classList.toggle('logs-size-'+m,state.sizeMode===m);});localStorage.setItem('weigg.logs.sizeMode',state.sizeMode);var sel=U.$('logs-size-mode');if(sel)sel.value=state.sizeMode;}

  function buildShell(root){
    state.rendering=true;
    root.textContent='';
    root.dataset.weiggLogsV032='1';
    var shell=document.createElement('div');shell.className='logs-v032-shell';shell.dataset.weiggLogShell='1';
    var toolbar=document.createElement('div');toolbar.className='logs-v032-toolbar grid-toolbar';
    var search=document.createElement('label');search.className='search-box logs-v032-search';search.innerHTML='<span aria-hidden="true">⌕</span>';
    var input=document.createElement('input');input.id='logs-local-search';input.type='search';input.autocomplete='off';input.placeholder=text('Search logs…','搜索日志…');input.value=state.query;search.appendChild(input);
    var filters=document.createElement('div');filters.className='logs-v032-filters';
    [1,2,4,8].forEach(function(type){var b=makeButton(typeLabel(type),'log-filter-chip');b.dataset.logType=String(type);b.classList.toggle('is-active',state.types.has(type));filters.appendChild(b);});
    var actions=document.createElement('div');actions.className='logs-v032-actions';
    var follow=document.createElement('label');follow.className='logs-follow-control';var check=document.createElement('input');check.type='checkbox';check.checked=state.follow;var followText=document.createElement('span');followText.textContent=text('Follow latest','跟随最新');follow.append(check,followText);
    var size=document.createElement('select');size.id='logs-size-mode';size.className='logs-size-mode';[['compact',text('Compact','缩小')],['auto',text('Auto','自动')],['max',text('Max','最大')]].forEach(function(x){var o=document.createElement('option');o.value=x[0];o.textContent=x[1];size.appendChild(o);});size.value=state.sizeMode;
    var refresh=makeButton('↻ '+text('Refresh','刷新'),'btn btn--ghost logs-refresh');
    actions.append(follow,size,refresh);
    toolbar.append(search,filters,actions);

    var panel=document.createElement('section');panel.className='logs-v032-panel surface surface--panel';
    var head=document.createElement('div');head.className='logs-v032-head';head.innerHTML='<span>'+text('Log','日志')+'</span><span>'+text('Time','时间')+'</span><span>'+text('Level','级别')+'</span>';
    var list=document.createElement('div');list.className='logs-v032-list';list.setAttribute('role','list');
    var empty=document.createElement('div');empty.className='logs-v032-empty is-hidden';empty.textContent=text('No logs match the current filters.','没有符合当前条件的日志。');
    var status=document.createElement('div');status.className='logs-v032-status text-description';
    panel.append(head,list,empty,status);shell.append(toolbar,panel);root.appendChild(shell);state.root=root;

    input.addEventListener('input',function(){state.query=input.value;syncTopSearch();renderRows(true);});
    filters.addEventListener('click',function(e){var b=e.target.closest('[data-log-type]');if(!b)return;var type=Number(b.dataset.logType);if(state.types.has(type)){if(state.types.size>1)state.types.delete(type);}else state.types.add(type);b.classList.toggle('is-active',state.types.has(type));renderRows(true);});
    check.addEventListener('change',function(){state.follow=check.checked;if(state.follow)scrollLatest();});
    size.addEventListener('change',function(){state.sizeMode=size.value;applySizeMode();setTimeout(function(){if(state.virtual&&state.virtual.render)state.virtual.render();},40);});
    refresh.addEventListener('click',function(){fetchInitial(true);});
    applySizeMode();
    state.rendering=false;
  }

  function renderRows(reset){
    var root=U.$('logs-content');if(!root)return;
    if(!root.querySelector('[data-weigg-log-shell]'))buildShell(root);
    var list=root.querySelector('.logs-v032-list'),empty=root.querySelector('.logs-v032-empty'),status=root.querySelector('.logs-v032-status');if(!list)return;
    var items=filtered();
    if(!state.virtual||state.virtual.el!==list){
      state.virtual=new W.VirtualList(list,{rowHeight:54,overscan:8,renderRow:function(x){
        var row=document.createElement('div');row.className='logs-v032-row';row.dataset.tone=typeTone(Number(x.type));row.setAttribute('role','listitem');
        var msg=document.createElement('span');msg.className='logs-v032-message';msg.textContent=x.message||'';
        var ts=document.createElement('time');ts.className='logs-v032-time';ts.dateTime=timestampMs(x)?new Date(timestampMs(x)).toISOString():'';ts.textContent=formatTime(x);
        var level=document.createElement('span');level.className='logs-v032-level';level.dataset.tone=typeTone(Number(x.type));level.textContent=typeLabel(Number(x.type));
        row.append(msg,ts,level);return row;
      }});
    }
    state.virtual.setItems(items);
    if(reset&&state.virtual.resetScroll)state.virtual.resetScroll();
    empty.classList.toggle('is-hidden',items.length!==0);
    status.textContent=text('Showing ','显示 ')+items.length+' / '+state.items.length+' · '+text('incremental log stream','增量日志流');
    if(state.follow&&!reset)scrollLatest();
  }

  function scrollLatest(){var list=state.root&&state.root.querySelector('.logs-v032-list');if(!list)return;requestAnimationFrame(function(){list.scrollTop=list.scrollHeight;});}
  function merge(items,replace){items=Array.isArray(items)?items:[];if(replace)state.items=[];var known=new Set(state.items.map(function(x){return itemId(x);}));items.forEach(function(x){var id=itemId(x);if(Number.isFinite(id)&&known.has(id))return;state.items.push(x);if(Number.isFinite(id))known.add(id);});state.items.sort(function(a,b){var ai=itemId(a),bi=itemId(b);if(Number.isFinite(ai)&&Number.isFinite(bi))return ai-bi;return timestampMs(a)-timestampMs(b);});if(state.items.length>MAX_ITEMS)state.items=state.items.slice(-MAX_ITEMS);var ids=state.items.map(itemId).filter(Number.isFinite);state.lastId=ids.length?Math.max.apply(Math,ids):-1;}

  async function ensureClient(){if(state.client)return state.client;state.client=new W.QBClient();await state.client.detect();return state.client;}
  async function fetchInitial(force){if(state.loading)return;state.loading=true;try{var client=await ensureClient();if(!client.capabilities.logs){showUnsupported();return;}var items=await client.logs(-1);merge(items,true);renderRows(false);if(state.follow)scrollLatest();}catch(e){showError(e);}finally{state.loading=false;schedulePoll();}}
  async function fetchIncremental(){if(state.loading||!state.active||!onLogsRoute()){schedulePoll();return;}state.loading=true;try{var client=await ensureClient();var items=await client.logs(state.lastId);if(Array.isArray(items)&&items.length){merge(items,false);renderRows(false);}}catch(_e){}finally{state.loading=false;schedulePoll();}}
  function showUnsupported(){var root=U.$('logs-content');if(!root)return;state.rendering=true;root.innerHTML='<div class="logs-v032-message-state">'+text('This qBittorrent instance does not expose the log API.','当前 qBittorrent 实例不提供日志 API。')+'</div>';state.rendering=false;}
  function showError(e){var root=U.$('logs-content');if(!root)return;state.rendering=true;root.innerHTML='<div class="logs-v032-message-state">'+text('Failed to read logs: ','日志读取失败：')+String(e&&e.message||e)+'</div>';state.rendering=false;}
  function syncTopSearch(){var input=U.$('search-input');if(input&&onLogsRoute()&&input.value!==state.query)input.value=state.query;}
  function setQuery(q){state.query=String(q||'');var input=U.$('logs-local-search');if(input&&input.value!==state.query)input.value=state.query;renderRows(true);}
  global.WeiGLogsV032={setQuery:setQuery,refresh:function(){return fetchInitial(true);}};

  function activate(){if(!onLogsRoute()){state.active=false;stopPoll();return;}state.active=true;var root=U.$('logs-content');if(!root)return;if(!root.querySelector('[data-weigg-log-shell]'))buildShell(root);fetchInitial(false);}
  function observeRoot(){var root=U.$('logs-content');if(!root||state.observer)return;state.observer=new MutationObserver(function(){if(state.rendering||!state.active||!onLogsRoute())return;if(!root.querySelector('[data-weigg-log-shell]'))setTimeout(activate,0);});state.observer.observe(root,{childList:true,subtree:false});}
  function init(){observeRoot();document.addEventListener('input',function(e){if(e.target&&e.target.id==='search-input'&&onLogsRoute())setQuery(e.target.value);},true);setTimeout(activate,120);global.addEventListener('hashchange',function(){setTimeout(activate,80);});document.addEventListener('visibilitychange',function(){if(state.active)schedulePoll();});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
