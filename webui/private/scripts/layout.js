(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},U=W.util;
  if(W.LayoutRuntime)return;
  var initialized=false,sidebarCollapsed=false,resizeFrame=0;
  var SIDEBAR_KEY='weigg.sidebarCollapsed';
  var TABLE_COLUMN_KEY='weigg.tableColumns.v1:';
  function isDesktop(){return !!(global.matchMedia&&global.matchMedia('(min-width: 821px)').matches);}
  function zh(){return !!(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN');}
  function label(en,cn){return zh()?cn:en;}
  function own(obj,key){return !!(obj&&Object.prototype.hasOwnProperty.call(obj,key));}
  function cloneColumn(column){var out=Object.assign({},column||{});if(Array.isArray(out.dataProperties))out.dataProperties=out.dataProperties.slice();if(out.translation&&typeof out.translation==='object')out.translation=Object.assign({},out.translation);return out;}
  function officialText(key,ref,fallback){var source=String(ref&&ref.source||fallback||key||'').trim();if(W.I18n&&typeof W.I18n.qbText==='function')return W.I18n.qbText(String(key||''),source||String(key||''));return source||String(key||'');}
  function exactProfile(){var R=W.ReleaseProfile;if(!R||typeof R.current!=='function'||typeof R.isCertified!=='function'||!R.isCertified())return null;var profile=R.current();return profile&&!profile.fallback?profile:null;}
  function exactDetailUi(){var profile=exactProfile(),ui=profile&&profile.torrentDetailUi;return ui&&typeof ui==='object'&&!Array.isArray(ui)?ui:null;}
  function detailTranslationKey(surface,key){return'detail.'+String(surface||'')+'.'+String(key||'');}
  function detailColumns(surface){var ui=exactDetailUi(),tables=ui&&ui.tables,raw=tables&&tables[String(surface||'')];if(!Array.isArray(raw))return[];return raw.map(function(column){var out=cloneColumn(column),fallback=String(out.caption||out.key||'');out.label=officialText(detailTranslationKey(surface,out.key),out.translation,fallback);return out;});}
  function detailTab(key){var ui=exactDetailUi(),ref=ui&&ui.tabs&&ui.tabs[String(key||'')];return officialText('detail.tab.'+String(key||''),ref,ref&&ref.source||String(key||''));}
  function detailPropertyLabel(id){var ui=exactDetailUi(),ref=ui&&ui.propertyLabels&&ui.propertyLabels[String(id||'')];return officialText('detail.property.'+String(id||''),ref,ref&&ref.source||String(id||''));}
  function detailGroupLabel(id){var ui=exactDetailUi(),ref=ui&&ui.propertyGroups&&ui.propertyGroups[String(id||'')];return officialText('detail.group.'+String(id||''),ref,ref&&ref.source||String(id||''));}
  W.QbUiEvidence={profile:exactProfile,detailUi:exactDetailUi,detailColumns:detailColumns,detailTab:detailTab,detailPropertyLabel:detailPropertyLabel,detailGroupLabel:detailGroupLabel,text:officialText};

  function safeParse(value){try{var parsed=JSON.parse(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch(_e){return{};}}
  function tableState(tableId){try{return safeParse(localStorage.getItem(TABLE_COLUMN_KEY+String(tableId||''))||'{}');}catch(_e){return{};}}
  function sourceColumn(column,defaultWidth){var out=cloneColumn(column),width=Number(out.defaultWidth);if(!Number.isFinite(width)||width<=0)width=Number(out.width);if(!Number.isFinite(width)||width<=0)width=defaultWidth;out.key=String(out.key||'');out.defaultWidth=Math.max(Number(out.min)||24,width||defaultWidth);out.defaultVisible=out.defaultVisible!==false;return out;}
  function normalizeSource(columns,options){var width=Math.max(24,Number(options&&options.defaultWidth)||140),seen=new Set(),out=[];(columns||[]).forEach(function(column){var item=sourceColumn(column,width);if(!item.key||seen.has(item.key))return;seen.add(item.key);out.push(item);});return out;}
  function insertMissingOfficialKeys(order,official){var out=(order||[]).filter(function(key,index,list){return official.indexOf(key)>=0&&list.indexOf(key)===index;});official.forEach(function(key,index){if(out.indexOf(key)>=0)return;var inserted=false;for(var p=index-1;p>=0;p--){var before=out.indexOf(official[p]);if(before>=0){out.splice(before+1,0,key);inserted=true;break;}}if(inserted)return;for(var n=index+1;n<official.length;n++){var after=out.indexOf(official[n]);if(after>=0){out.splice(after,0,key);inserted=true;break;}}if(!inserted)out.push(key);});return out;}
  function resolveColumns(tableId,columns,options){var source=normalizeSource(columns,options),state=tableState(tableId),official=source.map(function(column){return column.key;}),order=insertMissingOfficialKeys(Array.isArray(state.order)?state.order:[],official),byKey={};source.forEach(function(column){byKey[column.key]=column;});return order.map(function(key){var column=cloneColumn(byKey[key]),savedWidth=state.widths&&Number(state.widths[key]),visible=state.visibility&&own(state.visibility,key)?!!state.visibility[key]:column.defaultVisible;column.width=Number.isFinite(savedWidth)&&savedWidth>0?Math.max(Number(column.min)||24,savedWidth):column.defaultWidth;column.visible=visible;return column;});}
  function sameOrder(a,b){return a.length===b.length&&a.every(function(value,index){return value===b[index];});}
  function commitColumns(tableId,sourceColumns,resolved,options){var source=normalizeSource(sourceColumns,options),official=source.map(function(column){return column.key;}),byKey={};source.forEach(function(column){byKey[column.key]=column;});var rows=(resolved||[]).filter(function(column){return column&&byKey[column.key];}),order=rows.map(function(column){return column.key;}),state={version:1},visibility={},widths={};if(!sameOrder(order,official))state.order=order;rows.forEach(function(column){var base=byKey[column.key];if(!!column.visible!==!!base.defaultVisible)visibility[column.key]=!!column.visible;var width=Number(column.width),defaultWidth=Number(base.defaultWidth);if(Number.isFinite(width)&&Math.abs(width-defaultWidth)>.5)widths[column.key]=Math.max(Number(base.min)||24,width);});if(Object.keys(visibility).length)state.visibility=visibility;if(Object.keys(widths).length)state.widths=widths;try{var key=TABLE_COLUMN_KEY+String(tableId||'');if(Object.keys(state).length===1)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(state));}catch(_e){}return state;}
  function resetColumns(tableId){try{localStorage.removeItem(TABLE_COLUMN_KEY+String(tableId||''));}catch(_e){}}
  W.SharedColumns={resolve:resolveColumns,commit:commitColumns,reset:resetColumns,read:tableState,storagePrefix:TABLE_COLUMN_KEY};

  function relabelTorrentColumns(columns,profile){var F=W.TorrentFieldRegistry;if(!F||typeof F.sourceColumns!=='function')return columns;var source=F.sourceColumns(profile)||[],byKey={};source.forEach(function(column){byKey[column.key]=column;});return (columns||[]).map(function(column){var out=Object.assign({},column),native=byKey[out.key];if(native){var fallback=String(native.translation&&native.translation.source||native.caption||out.label||out.key||'');out.label=officialText('column.'+out.key,native.translation,fallback);}return out;});}
  function installTorrentColumnLabels(){var F=W.TorrentFieldRegistry;if(!F||F.__weiggOfficialColumnLabels)return;F.__weiggOfficialColumnLabels=true;['effectiveDesktopColumns','availableColumnDefinitions','nativeLayout'].forEach(function(name){if(typeof F[name]!=='function')return;var original=F[name];F[name]=function(){var result=original.apply(F,arguments),profile=arguments.length>1?arguments[1]:(W.ReleaseProfile&&W.ReleaseProfile.current?W.ReleaseProfile.current():null);return relabelTorrentColumns(result,profile);};});}
  installTorrentColumnLabels();

  function normalizeDialog(dialog){
    if(!dialog||dialog.dataset.adaptiveDialog==='1')return;
    dialog.dataset.adaptiveDialog='1';
    var root=dialog.querySelector(':scope > form')||dialog,
        head=root.querySelector(':scope > .dialog__head'),
        actions=root.querySelector(':scope > .dialog__actions'),
        body=root.querySelector(':scope > .dialog__body');
    if(body)return;
    body=document.createElement('div');
    body.className='dialog__body';
    Array.from(root.childNodes).filter(function(node){return node!==head&&node!==actions;}).forEach(function(node){body.appendChild(node);});
    if(head)head.insertAdjacentElement('afterend',body);else root.insertBefore(body,actions||root.firstChild);
  }
  function normalizeDialogs(){Array.from(document.querySelectorAll('dialog.dialog')).forEach(normalizeDialog);}
  function layoutAssetSuffix(){
    var script=Array.from(document.scripts).find(function(node){return /(?:^|\/)layout\.js(?:\?|$)/.test(node.src||'');}),suffix='';
    if(script){try{var parsed=new URL(script.src,global.location&&global.location.href||undefined),version=parsed.searchParams.get('v');if(version)suffix='?v='+encodeURIComponent(version);}catch(_e){}}
    return suffix;
  }
  function ensureSidebarStyles(){
    var suffix=layoutAssetSuffix();
    if(!document.getElementById('weigg-sidebar-layout-css')){var link=document.createElement('link');link.id='weigg-sidebar-layout-css';link.rel='stylesheet';link.href='css/sidebar.css'+suffix;document.head.appendChild(link);}
    if(!document.getElementById('weigg-table-layout-css')){var table=document.createElement('link');table.id='weigg-table-layout-css';table.rel='stylesheet';table.href='css/table.css'+suffix;document.head.appendChild(table);}
  }
  function readSidebarPreference(){try{return localStorage.getItem(SIDEBAR_KEY)==='1';}catch(_e){return false;}}
  function writeSidebarPreference(value){try{localStorage.setItem(SIDEBAR_KEY,value?'1':'0');}catch(_e){}}
  function ensureSidebarToggle(){
    var app=document.getElementById('app');if(!app)return null;var button=document.getElementById('sidebar-toggle');if(button)return button;
    button=document.createElement('button');button.id='sidebar-toggle';button.type='button';button.setAttribute('aria-controls','sidebar');button.addEventListener('click',function(){setSidebarCollapsed(!sidebarCollapsed,true);});app.appendChild(button);return button;
  }
  function ensureSidebarTransferPanel(){
    var section=document.querySelector('#sidebar>.sidebar__section:first-child');if(!section)return null;var panel=document.getElementById('desktop-sidebar-transfer-panel');if(panel)return panel;
    panel=document.createElement('section');panel.id='desktop-sidebar-transfer-panel';panel.className='sidebar-transfer-panel';
    var chartHost=document.createElement('div');chartHost.id='desktop-sidebar-transfer-chart';chartHost.className='sidebar-transfer-panel__chart';
    var rates=document.createElement('div');rates.className='sidebar-transfer-rates';rates.innerHTML='<span class="sidebar-transfer-rate sidebar-transfer-rate--down"><span data-sidebar-rate-label="down"></span><strong data-sidebar-rate="down">0 B/s</strong></span><span class="sidebar-transfer-rate sidebar-transfer-rate--up"><span data-sidebar-rate-label="up"></span><strong data-sidebar-rate="up">0 B/s</strong></span>';
    panel.append(chartHost,rates);section.appendChild(panel);return panel;
  }
  function formatRate(value){var n=Math.max(0,Number(value)||0);return U&&U.formatSpeed?U.formatSpeed(n):(Math.round(n)+' B/s');}
  function paintSidebarRates(){
    var panel=document.getElementById('desktop-sidebar-transfer-panel');if(!panel)return;var info=W.TransferRuntime&&W.TransferRuntime.last?W.TransferRuntime.last()||{}:{};
    var down=panel.querySelector('[data-sidebar-rate="down"]'),up=panel.querySelector('[data-sidebar-rate="up"]'),downLabel=panel.querySelector('[data-sidebar-rate-label="down"]'),upLabel=panel.querySelector('[data-sidebar-rate-label="up"]');
    if(down)down.textContent=formatRate(info.dl_info_speed);if(up)up.textContent=formatRate(info.up_info_speed);if(downLabel)downLabel.textContent=label('Download','下载');if(upLabel)upLabel.textContent=label('Upload','上传');
  }
  function mountDesktopTransfer(){
    var panel=ensureSidebarTransferPanel();if(!panel)return;var chartHost=panel.querySelector('#desktop-sidebar-transfer-chart'),mobileHost=document.getElementById('mobile-drawer-transfer-chart');
    if(!isDesktop()){if(chartHost)chartHost.textContent='';return;}
    if(mobileHost)mobileHost.textContent='';
    if(W.Transfer&&W.Transfer.mountCompactChart&&chartHost)W.Transfer.mountCompactChart(chartHost);
    paintSidebarRates();
  }
  function updateToggle(){
    var button=ensureSidebarToggle();if(!button)return;var expanded=!sidebarCollapsed;
    button.textContent=expanded?'‹':'›';button.setAttribute('aria-expanded',expanded?'true':'false');button.setAttribute('aria-label',expanded?label('Collapse Torrent sidebar','收起种子侧栏'):label('Expand Torrent sidebar','展开种子侧栏'));button.title=button.getAttribute('aria-label');
  }
  function projectSidebarState(){
    var app=document.getElementById('app');if(!app)return;if(isDesktop())app.dataset.sidebarCollapsed=sidebarCollapsed?'1':'0';else app.removeAttribute('data-sidebar-collapsed');updateToggle();
  }
  function requestLayoutRefresh(){
    if(resizeFrame)cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(function(){resizeFrame=0;try{global.dispatchEvent(new Event('resize'));}catch(_e){}});
  }
  function setSidebarCollapsed(value,persist){
    sidebarCollapsed=!!value;if(persist!==false)writeSidebarPreference(sidebarCollapsed);projectSidebarState();requestLayoutRefresh();return sidebarCollapsed;
  }
  function syncSidebar(){
    ensureSidebarStyles();ensureSidebarToggle();projectSidebarState();
    if(isDesktop())mountDesktopTransfer();else{var chartHost=document.getElementById('desktop-sidebar-transfer-chart');if(chartHost)chartHost.textContent='';}
    paintSidebarRates();
  }
  function scheduleSidebarSync(){if(resizeFrame)return;resizeFrame=requestAnimationFrame(function(){resizeFrame=0;syncSidebar();});}
  function init(){if(initialized)return;initialized=true;sidebarCollapsed=readSidebarPreference();ensureSidebarStyles();normalizeDialogs();syncSidebar();}
  W.LayoutRuntime={init:init,normalizeDialogs:normalizeDialogs,syncSidebar:syncSidebar,setSidebarCollapsed:setSidebarCollapsed,sidebarCollapsed:function(){return sidebarCollapsed;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  global.addEventListener('resize',scheduleSidebarSync,{passive:true});
  global.addEventListener('weigg:route-state',scheduleSidebarSync);
  global.addEventListener('weigg:transfer',paintSidebarRates);
  global.addEventListener('weigg:languagechange',function(){updateToggle();paintSidebarRates();if(isDesktop())mountDesktopTransfer();});
})(window);
