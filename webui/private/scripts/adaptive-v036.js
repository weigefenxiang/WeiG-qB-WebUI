(function(global){
  'use strict';
  var W=global.WeiG,C=W&&W.Components;
  if(!W||!C)return;
  function tr(key,fallback,vars){return W.V036I18n&&W.V036I18n.t?W.V036I18n.t(key,vars):fallback;}
  function baseT(key,fallback){var value=W.t?W.t(key):key;return value&&value!==key?value:fallback;}

  function ensureAdaptiveCssLast(){
    var link=document.querySelector('link[href*="mobile-v036.css"]');
    if(link&&link.parentNode===document.head&&link!==document.head.lastElementChild)document.head.appendChild(link);
  }

  /* SETTING-UNIT-002 — load the verified display-conversion layer after v036's base metadata wrapper. */
  var advancedLoadTimer=null;
  function ensureAdvancedRuntime(){
    if(W.AdvancedSettingsV036||document.querySelector('script[data-weigg-layer="advanced-036"]'))return;
    if(document.documentElement.dataset.v036!=='1'){
      clearTimeout(advancedLoadTimer);advancedLoadTimer=setTimeout(ensureAdvancedRuntime,35);return;
    }
    var script=document.createElement('script');script.async=false;script.dataset.weiggLayer='advanced-036';script.src=W.buildAssetUrl?W.buildAssetUrl('scripts/advanced-v036.js'):'scripts/advanced-v036.js';
    script.onload=function(){var active=document.querySelector('#settings-tabs [data-settings-tab="advanced"].is-active');if(active)active.click();};
    document.head.appendChild(script);
  }
  ensureAdvancedRuntime();

  /* STATUS-SEMANTIC-001 — keep one StatusPill primitive, only refine semantic tones. */
  var baseState=C.state;
  var toneByState={
    downloading:'download',metaDL:'download',forcedDL:'download',
    uploading:'seed',forcedUP:'seed',
    stalledDL:'stalled-down',stalledUP:'stalled-up',
    pausedDL:'stopped',pausedUP:'stopped',stoppedDL:'stopped',stoppedUP:'stopped',
    queuedDL:'queued',queuedUP:'queued',
    checkingDL:'checking',checkingUP:'checking',checkingResumeData:'checking',allocating:'checking',moving:'checking'
  };
  C.state=function(code){var result=baseState(code),tone=toneByState[String(code||'')];return tone?[result[0],tone]:result;};

  /* MOBILE-LAYOUT-001 / SCROLL-001 — one shell, one primary scroll owner per route. */
  function isMobile(){return !!(global.matchMedia&&global.matchMedia('(max-width: 820px)').matches);}
  var pageContracts=[
    ['list-view','torrent-list','data'],
    ['detail-view','detail-content','scroll'],
    ['settings-view','settings-content','scroll'],
    ['search-view','search-results','tool'],
    ['rss-view','rss-content','tool'],
    ['logs-view','logs-content','tool']
  ];
  function installPageContracts(){
    pageContracts.forEach(function(spec){
      var view=document.getElementById(spec[0]),owner=document.getElementById(spec[1]);if(!view||!owner)return;
      view.dataset.pageLayout=spec[2];owner.dataset.primaryScroll='1';
    });
  }
  function primaryScrollOwners(view){return view?Array.from(view.querySelectorAll('[data-primary-scroll="1"]')):[];}

  /* MOBILE-LAYOUT-001 — VirtualList row metrics share the same mobile density contract as CSS. */
  var BaseVirtualList=W.VirtualList;
  function mobileRowHeight(){var density=document.documentElement.dataset.density||'standard';if(global.innerHeight<=680)return 104;if(density==='compact')return 102;if(density==='comfortable')return 126;return 114;}
  W.VirtualList=function(container,options){
    var opts=Object.assign({},options||{});
    if(container&&container.id==='torrent-list'&&isMobile())opts.rowHeight=mobileRowHeight();
    var instance=new BaseVirtualList(container,opts);
    if(container&&container.id==='torrent-list')container.__weiggTorrentVirtual=instance;
    return instance;
  };
  W.VirtualList.prototype=BaseVirtualList.prototype;
  Object.setPrototypeOf(W.VirtualList,BaseVirtualList);
  function syncTorrentRowHeight(){var list=document.getElementById('torrent-list'),instance=list&&list.__weiggTorrentVirtual;if(!instance)return;var next=isMobile()?mobileRowHeight():(document.documentElement.dataset.density==='compact'?48:document.documentElement.dataset.density==='comfortable'?64:56);if(instance.rowHeight!==next)instance.setRowHeight(next);}

  /* MOBILE-CARD-002 — secondary metrics stay on one line; compact text, then gap/font, never wrap first. */
  function compactMetricText(value){
    var s=String(value==null?'':value);
    s=s.replace(/^([↓↑])\s+/, '$1');
    s=s.replace(/(\d+\.\d*?[1-9])0+(?=\s*(?:[KMGTPE]?i?B|B)(?:\/s)?\b)/g,'$1');
    s=s.replace(/(\d+)\.0+(?=\s*(?:[KMGTPE]?i?B|B)(?:\/s)?\b)/g,'$1');
    s=s.replace(/(\d+(?:\.\d+)?)\s+(?=(?:[KMGTPE]?i?B|B)(?:\/s)?\b)/g,'$1');
    s=s.replace(/(\d+[dhms])\s+(?=\d)/g,'$1');
    return s;
  }
  function compactMetaCells(cells){
    cells.forEach(function(cell){
      if(cell.dataset.mobileMetricFull===undefined)cell.dataset.mobileMetricFull=cell.textContent||'';
      var compact=compactMetricText(cell.dataset.mobileMetricFull);if(cell.textContent!==compact)cell.textContent=compact;
      if(!cell.title)cell.title=cell.dataset.mobileMetricFull;
    });
  }
  function fitMobileMeta(meta){
    if(!meta||!isMobile()||meta.clientWidth<=0)return;
    var cells=Array.from(meta.querySelectorAll('.cell'));if(!cells.length)return;
    compactMetaCells(cells);
    meta.style.removeProperty('--mobile-meta-font');meta.style.removeProperty('--mobile-meta-gap');meta.classList.remove('is-ultra-tight');
    var style=getComputedStyle(cells[0]),base=parseFloat(style.fontSize)||10,metaStyle=getComputedStyle(meta),gap=parseFloat(metaStyle.columnGap||metaStyle.gap)||3,available=meta.clientWidth;
    if(meta.scrollWidth<=available+1)return;
    var font=base,nextGap=Math.max(1,Math.min(gap,3));meta.style.setProperty('--mobile-meta-gap',nextGap+'px');
    while(meta.scrollWidth>available+1&&font>7){font=Math.max(7,font-.5);meta.style.setProperty('--mobile-meta-font',font+'px');}
    if(meta.scrollWidth>available+1){meta.classList.add('is-ultra-tight');meta.style.setProperty('--mobile-meta-gap','1px');}
    if(meta.scrollWidth>available+1&&font>6.5){font=6.5;meta.style.setProperty('--mobile-meta-font',font+'px');}
  }
  function fitVisibleMobileMeta(root){Array.from((root||document).querySelectorAll('.mobile-card-meta')).forEach(fitMobileMeta);}
  function observeTorrentMeta(){
    var list=document.getElementById('torrent-list');if(!list||list.__weiggMetaFitObserved)return;list.__weiggMetaFitObserved=true;
    var pending=false;new MutationObserver(function(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;fitVisibleMobileMeta(list);});}).observe(list,{childList:true,subtree:true,characterData:true});
    if(global.ResizeObserver){new ResizeObserver(function(){requestAnimationFrame(function(){fitVisibleMobileMeta(list);});}).observe(list);}
    fitVisibleMobileMeta(list);
  }

  /* COMMAND-001 — one compact, non-wrapping command bar for phone-scale page actions. */
  var commandBar=null,commandSelect=null,commandCustom=null,commandCount=null,toolbarAnchor=null;
  var filterFallback={all:'All',downloading:'Downloading',seeding:'Seeding',completed:'Completed',paused:'Paused',active:'Active',stalled:'Stalled',errored:'Error',private:'Private / PT'};
  function filterLabel(filter){var key=filter==='errored'?'filter.error':'filter.'+filter;return baseT(key,filterFallback[filter]||filter);}
  function commandOptions(){return Array.from(document.querySelectorAll('#filter-nav [data-filter]')).filter(function(button){return !button.hidden;}).map(function(button){return {value:button.dataset.filter,label:filterLabel(button.dataset.filter)};});}
  function ensureCommandSelectUpgrade(){
    if(!commandSelect)return null;var next=commandSelect.nextElementSibling;if(next&&next.classList&&next.classList.contains('ui-select'))commandCustom=next;
    if(!commandCustom&&C.__floatingSelectV036&&C.upgradeNativeSelect)commandCustom=C.upgradeNativeSelect(commandSelect);
    return commandCustom;
  }
  function syncCommandFilter(){
    if(!commandSelect)return;ensureCommandSelectUpgrade();var active=document.querySelector('#filter-nav [data-filter].is-active'),value=active?active.dataset.filter:'all';commandSelect.value=value;if(commandCustom)commandCustom.setValue(value);
  }
  function syncCommandCount(){
    if(!commandCount)return;var source=document.getElementById('torrent-count'),count=source&&String(source.textContent||'').trim()||'…';commandCount.textContent=tr('v036.mobile.count',count+' Torrents',{count:count});
  }
  function syncCommandLocale(){
    if(!commandSelect)return;var options=commandOptions();Array.from(commandSelect.options).forEach(function(option){var next=options.find(function(x){return x.value===option.value;});if(next)option.textContent=next.label;});ensureCommandSelectUpgrade();if(commandCustom)commandCustom.setOptions(options);syncCommandFilter();syncCommandCount();
  }
  function mountCommandBar(){
    if(!commandBar)return;ensureCommandSelectUpgrade();var toolbar=document.querySelector('#list-view>.workspace__header .toolbar, #mobile-command-bar .toolbar');if(!toolbar)return;
    if(isMobile()){if(toolbar.parentElement!==commandBar)commandBar.appendChild(toolbar);}else if(toolbarAnchor&&toolbarAnchor.parentNode){toolbarAnchor.parentNode.insertBefore(toolbar,toolbarAnchor.nextSibling);}
    fitCommandBar();
  }
  function fitCommandBar(){
    if(!commandBar||!isMobile()||commandBar.clientWidth<=0)return;commandBar.classList.remove('is-tight','is-ultra-tight');
    if(commandBar.scrollWidth>commandBar.clientWidth+1)commandBar.classList.add('is-tight');
    if(commandBar.scrollWidth>commandBar.clientWidth+1)commandBar.classList.add('is-ultra-tight');
  }
  function installCompactCommandBar(){
    if(commandBar){mountCommandBar();return;}
    var header=document.querySelector('#list-view>.workspace__header'),toolbar=header&&header.querySelector('.toolbar'),nav=document.getElementById('filter-nav');if(!header||!toolbar||!nav)return;
    commandBar=document.createElement('div');commandBar.id='mobile-command-bar';commandBar.className='mobile-command-bar';commandBar.dataset.compactCommand='1';
    var control=document.createElement('span');control.className='mobile-filter-control';
    commandSelect=document.createElement('select');commandSelect.id='mobile-filter-select';commandSelect.setAttribute('aria-label',baseT('sidebar.torrents','Torrent filter'));
    commandOptions().forEach(function(item){var option=document.createElement('option');option.value=item.value;option.textContent=item.label;commandSelect.appendChild(option);});
    commandSelect.addEventListener('change',function(){var button=Array.from(nav.querySelectorAll('[data-filter]')).find(function(item){return item.dataset.filter===commandSelect.value;});if(button)button.click();});
    control.appendChild(commandSelect);commandCount=document.createElement('span');commandCount.className='mobile-command-count';
    commandBar.append(control,commandCount);header.appendChild(commandBar);
    toolbarAnchor=document.createComment('weigg-mobile-toolbar-anchor');toolbar.parentNode.insertBefore(toolbarAnchor,toolbar);
    var countSource=document.getElementById('torrent-count');if(countSource)new MutationObserver(function(){syncCommandCount();requestAnimationFrame(fitCommandBar);}).observe(countSource,{childList:true,characterData:true,subtree:true});
    new MutationObserver(function(){syncCommandFilter();requestAnimationFrame(fitCommandBar);}).observe(nav,{subtree:true,attributes:true,attributeFilter:['class','hidden']});
    syncCommandLocale();mountCommandBar();
  }

  /* FACET-001 — collapsed mobile facets show the semantic name for the all-state. */
  var facetDefs={
    'tracker-section':{nav:'tracker-nav',attr:'tracker',key:'v036.facet.tracker',fallback:'Tracker'},
    'savepath-section':{nav:'savepath-nav',attr:'savepath',key:'v036.facet.path',fallback:'Path'},
    'category-section':{nav:'category-nav',attr:'category',key:'v036.facet.category',fallback:'Category'},
    'tag-section':{nav:'tag-nav',attr:'tag',key:'v036.facet.tag',fallback:'Tag'}
  };
  function activeFacetText(def){
    var nav=document.getElementById(def.nav),active=nav&&nav.querySelector('.nav-item.is-active');if(!active)return tr(def.key,def.fallback);
    var value=active.dataset[def.attr];if(isMobile()&&(value===undefined||value===''))return tr(def.key,def.fallback);
    return String(active.textContent||'').replace(/\s·\s\d+$/,'').trim()||tr(def.key,def.fallback);
  }
  function syncFacetSummaries(){
    Object.keys(facetDefs).forEach(function(id){var wrap=document.querySelector('.facet-filter[data-facet="'+id+'"]'),value=wrap&&wrap.querySelector('.facet-trigger__value');if(value)value.textContent=activeFacetText(facetDefs[id]);});
  }
  function observeFacetShelf(){
    var shelf=document.getElementById('filter-shelf');if(!shelf||shelf.__weiggFacetObserved)return;shelf.__weiggFacetObserved=true;
    var pending=false;new MutationObserver(function(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;syncFacetSummaries();});}).observe(shelf,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});syncFacetSummaries();
  }

  /* VIEWPORT-001 — generic data viewport focus/restore, preserving conceptual scroll state. */
  var focusRegistry=[];
  function setDataViewportFocus(entry,on){
    if(!entry||!entry.owner||!entry.viewport)return;if(on===entry.active)return;
    if(on)entry.scrollTop=entry.viewport.scrollTop;entry.active=!!on;entry.owner.classList.toggle('is-data-focus',entry.active);entry.owner.dataset.dataFocus=entry.active?'1':'0';
    if(entry.button){entry.button.textContent=entry.active?'⤡':'⤢';entry.button.setAttribute('aria-pressed',entry.active?'true':'false');var label=entry.active?tr('v036.mobile.focus.collapse','Restore layout'):tr('v036.mobile.focus.expand','Expand list');entry.button.title=label;entry.button.setAttribute('aria-label',label);}
    requestAnimationFrame(function(){entry.viewport.scrollTop=entry.scrollTop||0;entry.viewport.__weiggVirtualScrollTop=entry.viewport.scrollTop;if(entry.viewport.__weiggTorrentVirtual)entry.viewport.__weiggTorrentVirtual.render();fitVisibleMobileMeta(entry.viewport);});
  }
  function registerDataViewport(options){
    options=options||{};var owner=typeof options.owner==='string'?document.querySelector(options.owner):options.owner,viewport=typeof options.viewport==='string'?document.querySelector(options.viewport):options.viewport,toolbar=typeof options.toolbar==='string'?document.querySelector(options.toolbar):options.toolbar;if(!owner||!viewport||!toolbar)return null;
    var existing=focusRegistry.find(function(item){return item.owner===owner&&item.viewport===viewport;});if(existing)return existing;
    var button=document.createElement('button');button.type='button';button.className='btn btn--ghost data-viewport-focus';button.dataset.dataViewportFocus='1';button.textContent='⤢';button.setAttribute('aria-pressed','false');var entry={owner:owner,viewport:viewport,toolbar:toolbar,button:button,active:null,scrollTop:0};button.addEventListener('click',function(){setDataViewportFocus(entry,!entry.active);});toolbar.appendChild(button);focusRegistry.push(entry);setDataViewportFocus(entry,false);return entry;
  }
  function installTorrentFocus(){registerDataViewport({owner:'#list-view',viewport:'#torrent-list',toolbar:'#list-view .grid-toolbar'});}

  /* STORAGE-001 — qB default-save filesystem free space, human-readable IEC units. */
  var storageClient=null,storageTimer=null,storageRid=0,lastFree=null;
  function trimFixed(value,decimals){return Number(value).toFixed(decimals).replace(/\.0+$/,'').replace(/(\.\d*?[1-9])0+$/,'$1');}
  function formatFreeSpace(bytes){
    var n=Number(bytes);if(!Number.isFinite(n)||n<0)return '—';if(n<1024)return Math.round(n)+' B';
    var units=[['TiB',1099511627776],['GiB',1073741824],['MiB',1048576],['KiB',1024]];
    for(var i=0;i<units.length;i++)if(n>=units[i][1]){var value=n/units[i][1],decimals=value<10?2:(value<100?1:0);return trimFixed(value,decimals)+' '+units[i][0];}
    return Math.round(n)+' B';
  }
  function localizeStorage(node){
    if(!node)return;var label=node.querySelector('.status-storage__label'),value=node.querySelector('strong'),shown=value?value.textContent:'—';if(label)label.textContent=tr('v036.storage.free','Free');
    var bytes=(lastFree!=null&&Number.isFinite(Number(lastFree)))?Math.round(Number(lastFree)).toLocaleString():'—';
    node.title=tr('v036.storage.tooltip','Free space on the filesystem containing qBittorrent’s default save path: {value} ({bytes} bytes)',{value:shown,bytes:bytes});
  }
  function installStorageStatus(){
    var bar=document.querySelector('.statusbar');if(!bar)return null;
    var node=document.getElementById('status-free-space');
    if(!node){
      node=document.createElement('span');node.id='status-free-space';node.className='status-storage';node.dataset.tone='neutral';
      var icon=document.createElement('span');icon.className='status-storage__icon';icon.textContent='◫';icon.setAttribute('aria-hidden','true');
      var label=document.createElement('span');label.className='status-storage__label';
      var value=document.createElement('strong');value.textContent='—';
      node.append(icon,label,value);
    }
    var end=Array.from(bar.children).find(function(child){return child.classList&&child.classList.contains('statusbar__end');})||null;
    if(node.parentElement!==bar||(end&&node.nextSibling!==end))bar.insertBefore(node,end);localizeStorage(node);return node;
  }
  function paintStorage(bytes){
    var node=installStorageStatus();if(!node)return;lastFree=Number(bytes);node.hidden=false;var strong=node.querySelector('strong');if(strong)strong.textContent=formatFreeSpace(lastFree);localizeStorage(node);
  }
  async function refreshStorage(){
    try{
      storageClient=storageClient||new W.QBClient();
      var data=await storageClient.getMainData(storageRid),nextRid=Number(data&&data.rid);if(Number.isFinite(nextRid)&&nextRid>=0)storageRid=nextRid;
      var state=data&&data.server_state||{},free=state.free_space_on_disk;
      if(free!==undefined&&free!==null&&Number.isFinite(Number(free)))paintStorage(free);
      else if(lastFree!=null)paintStorage(lastFree);
      else{var node=installStorageStatus();if(node)node.hidden=true;}
    }catch(_e){storageRid=0;var node=installStorageStatus();if(node&&lastFree==null)node.hidden=true;}
  }
  function startStorage(){clearInterval(storageTimer);installStorageStatus();refreshStorage();storageTimer=setInterval(function(){if(!document.hidden)refreshStorage();},30000);}

  function syncResponsiveSystem(){installPageContracts();installCompactCommandBar();mountCommandBar();observeFacetShelf();syncFacetSummaries();installTorrentFocus();syncTorrentRowHeight();observeTorrentMeta();fitVisibleMobileMeta();fitCommandBar();}
  function syncLateLayers(){ensureAdaptiveCssLast();ensureAdvancedRuntime();installStorageStatus();syncResponsiveSystem();}
  function init(){ensureAdaptiveCssLast();ensureAdvancedRuntime();syncResponsiveSystem();startStorage();setTimeout(function(){syncLateLayers();refreshStorage();},900);setTimeout(syncLateLayers,1800);setTimeout(syncLateLayers,2800);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  document.addEventListener('visibilitychange',function(){if(!document.hidden){syncLateLayers();refreshStorage();}});
  global.addEventListener('resize',function(){requestAnimationFrame(function(){syncResponsiveSystem();});},{passive:true});
  global.addEventListener('weigg:languagechange',function(){localizeStorage(document.getElementById('status-free-space'));syncCommandLocale();syncFacetSummaries();focusRegistry.forEach(function(entry){if(entry.button){var label=entry.active?tr('v036.mobile.focus.collapse','Restore layout'):tr('v036.mobile.focus.expand','Expand list');entry.button.title=label;entry.button.setAttribute('aria-label',label);}});});

  W.MobileAdaptive={
    formatFreeSpace:formatFreeSpace,
    mobileRowHeight:mobileRowHeight,
    fitMobileMeta:fitMobileMeta,
    refreshStorage:refreshStorage,
    installPageContracts:installPageContracts,
    primaryScrollOwners:primaryScrollOwners,
    fitCommandBar:fitCommandBar,
    syncFacetSummaries:syncFacetSummaries,
    registerDataViewport:registerDataViewport,
    setDataViewportFocus:setDataViewportFocus
  };
})(window);
