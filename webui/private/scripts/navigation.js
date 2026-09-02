(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  var KEY='weigg.torrentListContext';
  function route(){return W.Router&&W.Router.route?W.Router.route():{name:'home'};}
  function read(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null');}catch(_e){return null;}}
  function write(v){try{sessionStorage.setItem(KEY,JSON.stringify(v));}catch(_e){}}
  function capture(){var list=document.getElementById('torrent-list');write({hash:location.hash||'#/',scrollTop:list?list.scrollTop:0,savedAt:Date.now(),restore:false});}
  function restore(){var c=read();if(!c||!c.restore||route().name!=='home')return;var list=document.getElementById('torrent-list'),tries=0,target=Math.max(0,Number(c.scrollTop)||0);function apply(){list=document.getElementById('torrent-list');if(!list||route().name!=='home')return;if(list.scrollHeight<=list.clientHeight&&tries++<12)return setTimeout(apply,40);list.__weiggVirtualScrollTop=target;list.scrollTop=target;if(list.__weiggVirtualScrollHandler)list.__weiggVirtualScrollHandler();if(Math.abs(list.scrollTop-target)>4&&tries++<12)return setTimeout(apply,40);c.restore=false;write(c);}requestAnimationFrame(function(){requestAnimationFrame(apply);});}
  function back(){if(route().name!=='torrent')return false;var c=read();if(c){c.restore=true;write(c);}if(c&&c.hash&&c.savedAt&&Date.now()-c.savedAt<86400000){history.back();setTimeout(function(){if(route().name==='torrent'&&W.Router)W.Router.home();},180);}else if(W.Router)W.Router.home();return true;}
  function sync(){var tabs=document.querySelector('#detail-view .detail-tabs'),r=route();if(!tabs)return;var b=tabs.querySelector('[data-detail-back]');if(r.name!=='torrent'){if(b)b.remove();restore();return;}if(!b){b=document.createElement('button');b.type='button';b.className='btn btn--ghost detail-context-back';b.dataset.detailBack='1';b.innerHTML='<b aria-hidden="true">←</b><span>Back to torrents</span>';b.addEventListener('click',back);tabs.insertBefore(b,tabs.firstChild);}}
  function editable(){var e=document.activeElement;return !!(e&&(/^(INPUT|TEXTAREA)$/.test(e.tagName)||e.isContentEditable));}
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('.torrent-title,.row-more,.mobile-card-title'))capture();},true);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&route().name==='torrent'&&!editable()&&!document.querySelector('dialog[open]')){e.preventDefault();back();}},true);
  global.addEventListener('hashchange',function(){setTimeout(sync,20);});
  function init(){sync();setTimeout(sync,400);}
  W.Navigation={goHome:function(){if(W.Router)W.Router.home();else location.hash='#/';},backFromDetail:back,restoreListContext:restore};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
