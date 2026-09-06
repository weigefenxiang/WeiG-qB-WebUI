(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  var labels={all:['All','全部'],downloading:['Downloading','下载中'],seeding:['Seeding','做种中'],completed:['Completed','已完成'],stopped:['Stopped','已停止'],running:['Running','运行中'],active:['Active','活动'],inactive:['Inactive','非活动'],stalled:['Stalled','停滞'],stalled_uploading:['Stalled uploading','上传停滞'],stalled_downloading:['Stalled downloading','下载停滞'],checking:['Checking','校验中'],moving:['Moving','移动中'],errored:['Error','错误'],private:['Private / PT','Private / PT']};
  function zh(){return !!(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN');}
  function label(name){var pair=labels[name]||[name,name];return zh()?pair[1]:pair[0];}
  function desired(){var out=W.TorrentSemantics&&W.TorrentSemantics.statusFilters?W.TorrentSemantics.statusFilters():['all','downloading','seeding','completed','stopped','running','active','inactive','errored'];if(W.CapabilityRegistry&&W.CapabilityRegistry.supports&&W.CapabilityRegistry.supports('privateFilter'))out=out.concat(['private']);return Array.from(new Set(out));}
  function syncActive(){var active=W.LibraryController&&W.LibraryController.state?W.LibraryController.state().filter:'all';document.querySelectorAll('#filter-nav [data-filter]').forEach(function(node){node.classList.toggle('is-active',node.dataset.filter===active);});}
  function render(){var root=document.getElementById('filter-nav');if(!root)return;var active=W.LibraryController&&W.LibraryController.state?W.LibraryController.state().filter:'all';root.textContent='';desired().forEach(function(name){var button=document.createElement('button');button.className='nav-item';button.type='button';button.dataset.filter=name;button.textContent=label(name);button.classList.toggle('is-active',name===active);button.addEventListener('click',function(){if(W.LibraryController&&W.LibraryController.setFilter)W.LibraryController.setFilter(name);});root.appendChild(button);});}
  function install(){render();global.addEventListener('weigg:capabilities-ready',render);global.addEventListener('weigg:release-profile',render);global.addEventListener('weigg:languagechange',render);global.addEventListener('weigg:library-state',syncActive);}
  W.TorrentFilterView={render:render,sync:syncActive,filters:desired};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
