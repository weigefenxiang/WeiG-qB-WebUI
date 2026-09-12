(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},I=W.I18n||null;
  var fallbacks={all:'All',downloading:'Downloading',seeding:'Seeding',completed:'Completed',resumed:'Resumed',paused:'Paused',running:'Running',stopped:'Stopped',active:'Active',inactive:'Inactive',stalled:'Stalled',stalled_uploading:'Stalled Uploading',stalled_downloading:'Stalled Downloading',checking:'Checking',moving:'Moving',errored:'Errored'};
  function qbText(key,fallback){return I&&I.qbText?I.qbText(key,fallback):String(fallback||key);}
  function sourceFilterName(name){var R=W.ReleaseProfile;return R&&R.upstreamTorrentFilter?R.upstreamTorrentFilter(name)||name:name;}
  function stripZeroCount(value){return String(value||'').replace(/\s*[\(（]\s*0\s*[\)）]\s*$/,'').trim();}
  function label(name){var source=sourceFilterName(name),fallback=fallbacks[source]||fallbacks[name]||name;return stripZeroCount(qbText('filter.'+source,fallback));}
  function desired(){var out=W.TorrentSemantics&&W.TorrentSemantics.statusFilters?W.TorrentSemantics.statusFilters():['all','downloading','seeding','completed','stopped','running','active','inactive','errored'];return Array.from(new Set(out));}
  function syncActive(){var active=W.LibraryController&&W.LibraryController.state?W.LibraryController.state().filter:'all';document.querySelectorAll('#filter-nav [data-filter]').forEach(function(node){node.classList.toggle('is-active',node.dataset.filter===active);});}
  function render(){var root=document.getElementById('filter-nav');if(!root)return;var active=W.LibraryController&&W.LibraryController.state?W.LibraryController.state().filter:'all';root.textContent='';desired().forEach(function(name){var button=document.createElement('button');button.className='nav-item';button.type='button';button.dataset.filter=name;button.textContent=label(name);button.classList.toggle('is-active',name===active);button.addEventListener('click',function(){if(W.LibraryController&&W.LibraryController.setFilter)W.LibraryController.setFilter(name);});root.appendChild(button);});}
  function refreshOwned(){if(I&&I.loadQbOwnedText)I.loadQbOwnedText().then(render);else render();}
  function install(){render();refreshOwned();global.addEventListener('weigg:capabilities-ready',render);global.addEventListener('weigg:release-profile',refreshOwned);global.addEventListener('weigg:languagechange',refreshOwned);global.addEventListener('weigg:library-state',syncActive);}
  W.TorrentFilterView={render:render,sync:syncActive,filters:desired};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
