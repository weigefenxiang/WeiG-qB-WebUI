(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},I=W.I18n||null;
  var fallbacks={all:'All',downloading:'Downloading',seeding:'Seeding',completed:'Completed',resumed:'Resumed',paused:'Paused',running:'Running',stopped:'Stopped',active:'Active',inactive:'Inactive',stalled:'Stalled',stalled_uploading:'Stalled Uploading',stalled_downloading:'Stalled Downloading',checking:'Checking',moving:'Moving',errored:'Errored'};
  function qbText(key,fallback){return I&&I.qbText?I.qbText(key,fallback):String(fallback||key);}
  function qbSourceText(ref,fallback){return I&&I.qbSourceText?I.qbSourceText(ref,fallback||ref&&ref.source||''):String(fallback||ref&&ref.source||'');}
  function stripRuntimeCount(value){return String(value||'').replace(/\s*[\(（]\s*(?:0|%1)\s*[\)）]\s*$/,'').trim();}
  function label(item){item=item||{};var source=String(item.sourceName||item.name||''),fallback=fallbacks[source]||fallbacks[item.name]||source,copy=item.translation?qbSourceText(item.translation,fallback):qbText('filter.'+source,fallback);return stripRuntimeCount(copy);}
  function desired(){var out=W.TorrentSemantics&&W.TorrentSemantics.statusFilterDescriptors?W.TorrentSemantics.statusFilterDescriptors():[{name:'all',sourceName:'all'},{name:'downloading',sourceName:'downloading'},{name:'seeding',sourceName:'seeding'},{name:'completed',sourceName:'completed'},{name:'stopped',sourceName:'stopped'},{name:'running',sourceName:'running'},{name:'active',sourceName:'active'},{name:'inactive',sourceName:'inactive'},{name:'errored',sourceName:'errored'}];return out.slice();}
  function syncActive(){var active=W.LibraryController&&W.LibraryController.state?W.LibraryController.state().filter:'all';document.querySelectorAll('#filter-nav [data-filter]').forEach(function(node){node.classList.toggle('is-active',node.dataset.filter===active);});}
  function render(){var root=document.getElementById('filter-nav');if(!root)return;var active=W.LibraryController&&W.LibraryController.state?W.LibraryController.state().filter:'all';root.textContent='';desired().forEach(function(item){var name=String(item.name||'');if(!name)return;var button=document.createElement('button');button.className='nav-item';button.type='button';button.dataset.filter=name;button.textContent=label(item);button.classList.toggle('is-active',name===active);button.addEventListener('click',function(){if(W.LibraryController&&W.LibraryController.setFilter)W.LibraryController.setFilter(name);});root.appendChild(button);});}
  function refreshOwned(){if(I&&I.loadQbOwnedText)I.loadQbOwnedText().then(render);else render();}
  function install(){render();refreshOwned();global.addEventListener('weig:capabilities-ready',function(){render();refreshOwned();});global.addEventListener('weig:languagechange',refreshOwned);global.addEventListener('weig:qbcopychange',render);global.addEventListener('weig:library-state',syncActive);}
  W.TorrentFilterView={render:render,sync:syncActive,filters:function(){return desired().map(function(item){return item.name;});}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
