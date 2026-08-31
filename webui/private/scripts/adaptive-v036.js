(function(global){
  'use strict';
  var W=global.WeiG,C=W&&W.Components;
  if(!W||!C)return;
  function tr(key,fallback,vars){return W.V036I18n&&W.V036I18n.t?W.V036I18n.t(key,vars):fallback;}

  function ensureAdaptiveCssLast(){
    var link=document.querySelector('link[href*="mobile-v036.css"]');
    if(link&&link.parentNode===document.head&&link!==document.head.lastElementChild)document.head.appendChild(link);
  }

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

  /* MOBILE-LAYOUT-001 — VirtualList row metrics share the same mobile density contract as CSS. */
  var BaseVirtualList=W.VirtualList;
  function mobileRowHeight(){var density=document.documentElement.dataset.density||'standard';if(global.innerHeight<=680)return 104;if(density==='compact')return 102;if(density==='comfortable')return 126;return 114;}
  function isMobile(){return !!(global.matchMedia&&global.matchMedia('(max-width: 820px)').matches);}
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
  global.addEventListener('resize',function(){requestAnimationFrame(function(){syncTorrentRowHeight();fitVisibleMobileMeta();});},{passive:true});

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

  function syncLateLayers(){ensureAdaptiveCssLast();installStorageStatus();syncTorrentRowHeight();observeTorrentMeta();fitVisibleMobileMeta();}
  function init(){ensureAdaptiveCssLast();syncTorrentRowHeight();observeTorrentMeta();startStorage();setTimeout(function(){syncLateLayers();refreshStorage();},900);setTimeout(syncLateLayers,1800);setTimeout(syncLateLayers,2800);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  document.addEventListener('visibilitychange',function(){if(!document.hidden){syncLateLayers();refreshStorage();}});
  global.addEventListener('weigg:languagechange',function(){localizeStorage(document.getElementById('status-free-space'));});

  W.MobileAdaptive={formatFreeSpace:formatFreeSpace,mobileRowHeight:mobileRowHeight,fitMobileMeta:fitMobileMeta,refreshStorage:refreshStorage};
})(window);
