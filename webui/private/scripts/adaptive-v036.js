(function(global){
  'use strict';
  var W=global.WeiG,C=W&&W.Components;
  if(!W||!C)return;

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
  global.addEventListener('resize',function(){requestAnimationFrame(syncTorrentRowHeight);},{passive:true});

  /* STORAGE-001 — free space on qBittorrent's default save filesystem. */
  var storageClient=null,storageTimer=null,lastFree=null;
  function roundSignificant(value,digits){
    if(!Number.isFinite(value)||value===0)return '0';
    var decimals=Math.max(0,digits-1-Math.floor(Math.log10(Math.abs(value))));
    return value.toFixed(decimals);
  }
  function formatFreeSpace(bytes){
    var n=Number(bytes);if(!Number.isFinite(n)||n<0)return '—';
    var units=[['TiB',1099511627776],['GiB',1073741824],['MiB',1048576],['KiB',1024],['B',1]];
    for(var i=0;i<units.length;i++){if(n>=units[i][1]||units[i][1]===1)return roundSignificant(n/units[i][1],3)+' '+units[i][0];}
    return '0 B';
  }
  function storageTone(bytes){var n=Number(bytes)||0;if(n>0&&n<5*1073741824)return 'danger';if(n>0&&n<20*1073741824)return 'warning';return 'normal';}
  function installStorageStatus(){
    var bar=document.querySelector('.statusbar');if(!bar)return null;
    var node=document.getElementById('status-free-space');
    if(!node){
      node=document.createElement('span');node.id='status-free-space';node.className='status-storage';node.title='Free space on qBittorrent default save path';
      var icon=document.createElement('span');icon.className='status-storage__icon';icon.textContent='◫';icon.setAttribute('aria-hidden','true');
      var label=document.createElement('span');label.className='status-storage__label';label.textContent='Free';
      var value=document.createElement('strong');value.textContent='—';
      node.append(icon,label,value);
    }
    var end=Array.from(bar.children).find(function(child){return child.classList&&child.classList.contains('statusbar__end');})||null;
    if(node.parentElement!==bar||(end&&node.nextSibling!==end))bar.insertBefore(node,end);
    return node;
  }
  function paintStorage(bytes){
    var node=installStorageStatus();if(!node)return;lastFree=Number(bytes);node.hidden=false;var strong=node.querySelector('strong');if(strong)strong.textContent=formatFreeSpace(lastFree);node.dataset.tone=storageTone(lastFree);node.title='qBittorrent default save filesystem free space: '+formatFreeSpace(lastFree);
  }
  async function refreshStorage(){
    try{
      storageClient=storageClient||new W.QBClient();
      var data=await storageClient.getMainData(0),state=data&&data.server_state||{},free=state.free_space_on_disk;
      if(free!==undefined&&free!==null&&Number.isFinite(Number(free)))paintStorage(free);else{var node=installStorageStatus();if(node)node.hidden=true;}
    }catch(_e){var node=installStorageStatus();if(node&&lastFree==null)node.hidden=true;}
  }
  function startStorage(){clearInterval(storageTimer);installStorageStatus();refreshStorage();storageTimer=setInterval(function(){if(!document.hidden)refreshStorage();},15000);}

  function syncLateLayers(){ensureAdaptiveCssLast();installStorageStatus();syncTorrentRowHeight();}
  function init(){ensureAdaptiveCssLast();syncTorrentRowHeight();startStorage();setTimeout(function(){syncLateLayers();refreshStorage();},900);setTimeout(syncLateLayers,1800);setTimeout(syncLateLayers,2800);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  document.addEventListener('visibilitychange',function(){if(!document.hidden){syncLateLayers();refreshStorage();}});

  W.MobileAdaptive={formatFreeSpace:formatFreeSpace,mobileRowHeight:mobileRowHeight,refreshStorage:refreshStorage};
})(window);
