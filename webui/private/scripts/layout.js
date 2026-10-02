(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},U=W.util;
  if(W.LayoutRuntime)return;
  var initialized=false,sidebarCollapsed=false,resizeFrame=0;
  var SIDEBAR_KEY=(W.StorageKeys&&W.StorageKeys.sidebar)||'weig.sidebarCollapsed';
  var TABLE_COLUMN_KEY=(W.StorageKeys&&W.StorageKeys.tableColumnsPrefix)||'weig.tableColumns:';
  function isDesktop(){return !!(global.matchMedia&&global.matchMedia('(min-width: 821px)').matches);}
  function tr(key,vars){return W.I18n&&W.I18n.t?W.I18n.t(key,vars):String(key||'');}
  function own(obj,key){return !!(obj&&Object.prototype.hasOwnProperty.call(obj,key));}
  function cloneColumn(column){var out=Object.assign({},column||{});if(Array.isArray(out.dataProperties))out.dataProperties=out.dataProperties.slice();if(out.translation&&typeof out.translation==='object')out.translation=Object.assign({},out.translation);return out;}
  function officialText(key,ref,fallback){var source=String(ref&&ref.source||fallback||key||'').trim(),context=String(ref&&ref.context||'').trim();if(source&&context&&W.I18n&&typeof W.I18n.qbSourceText==='function')return W.I18n.qbSourceText({source:source,context:context},source);if(W.I18n&&typeof W.I18n.qbText==='function')return W.I18n.qbText(String(key||''),source||String(key||''));return source||String(key||'');}
  function exactProfile(){var R=W.CapabilityRegistry,profile=R&&typeof R.releaseIdentity==='function'?R.releaseIdentity():null;return profile&&profile.certified===true&&!profile.fallback?profile:null;}
  function exactDetailUi(){var R=W.CapabilityRegistry,ui=R&&typeof R.torrentDetailUi==='function'?R.torrentDetailUi():null;return ui&&typeof ui==='object'&&!Array.isArray(ui)?ui:null;}
  function detailTranslationKey(surface,key){return'detail.'+String(surface||'')+'.'+String(key||'');}
  function detailColumns(surface){var ui=exactDetailUi(),tables=ui&&ui.tables,raw=tables&&tables[String(surface||'')];if(!Array.isArray(raw))return[];return raw.map(function(column){var out=cloneColumn(column),hasCaption=Object.prototype.hasOwnProperty.call(out,'caption'),fallback=hasCaption?String(out.caption):String(out.key||'');out.label=(hasCaption&&fallback==='')?'':officialText(detailTranslationKey(surface,out.key),out.translation,fallback);return out;});}
  function detailTab(key){var ui=exactDetailUi(),ref=ui&&ui.tabs&&ui.tabs[String(key||'')];return officialText('detail.tab.'+String(key||''),ref,ref&&ref.source||String(key||''));}
  function detailPropertyLabel(id){var ui=exactDetailUi(),ref=ui&&ui.propertyLabels&&ui.propertyLabels[String(id||'')];return officialText('detail.property.'+String(id||''),ref,ref&&ref.source||String(id||''));}
  function detailGroupLabel(id){var ui=exactDetailUi(),ref=ui&&ui.propertyGroups&&ui.propertyGroups[String(id||'')];return officialText('detail.group.'+String(id||''),ref,ref&&ref.source||String(id||''));}
  function finite(value){var n=Number(value);return Number.isFinite(n)?n:null;}
  function generalDuration(value){var n=finite(value);if(n===null||n<0)return'—';var seconds=Math.floor(n),days=Math.floor(seconds/86400);seconds%=86400;var hours=Math.floor(seconds/3600);seconds%=3600;var minutes=Math.floor(seconds/60);seconds%=60;if(days)return tr('detail.duration.daysHours',{days:days,hours:hours});if(hours)return tr('detail.duration.hoursMinutes',{hours:hours,minutes:minutes});if(minutes)return tr('detail.duration.minutesSeconds',{minutes:minutes,seconds:seconds});return tr('detail.duration.seconds',{seconds:seconds});}
  function generalSourceValue(source,context){return officialText('detail.value.'+String(source||'').toLowerCase(),{source:String(source||''),context:String(context||'')},String(source||''));}
  function generalPresentationText(field,slot,rule){if(!rule)return null;if(rule.kind==='literal')return String(rule.value==null?'':rule.value);if(rule.kind==='translation'&&rule.translation){var ref=rule.translation,fallback=String(ref.source||'');return officialText('detail.property.'+String(field&&field.id||'')+'.presentation.'+String(slot||''),ref,fallback);}return null;}
  function generalPresentationValue(field,key,value){var spec=field&&field.valuePresentation;if(!spec||spec.kind!=='source-field')return null;if(value===''&&spec.empty){var empty=generalPresentationText(field,'empty',spec.empty);if(empty!==null)return{handled:true,text:empty};}var n=finite(value);if(spec.negative&&n!==null&&n<0){var negative=generalPresentationText(field,'negative',spec.negative);if(negative!==null)return{handled:true,text:negative};}if(spec.format==='date'&&n!==null)return{handled:true,text:new Date(n*1000).toLocaleString()};return{handled:false,text:''};}
  function generalDate(key,value){var n=finite(value);if(n===null)return'—';if(n===-1){if(key==='completion_date')return'';if(key==='last_seen')return generalSourceValue('Never','PropertiesWidget');return generalSourceValue('Unknown','HttpServer');}return new Date(n*1000).toLocaleString();}
  function generalYesNo(value){return value?tr('common.yes'):tr('common.no');}
  function generalScalar(key,value){
    key=String(key||'').toLowerCase();
    if(value===undefined||value===null)return generalSourceValue('N/A','PropertiesWidget');
    if(value==='')return/^infohash_v[12]$/.test(key)?generalSourceValue('N/A','PropertiesWidget'):'';
    if(typeof value==='boolean')return generalYesNo(value);
    if(Array.isArray(value))return value.length?value.join(', '):'—';
    var n=finite(value);
    if(key==='progress'&&n!==null)return(U&&U.percent?U.percent(n):Math.round(n*1000)/10)+'%';
    if(key==='availability'&&n!==null)return n>=0?n.toFixed(3):'—';
    if(key==='share_ratio'||key==='popularity')return U&&U.formatRatio?U.formatRatio(value):String(value);
    if(/(?:^|_)(?:dl|up)_?limit$/.test(key)&&n!==null){if(n<0)return'∞';return U&&U.formatSpeed?U.formatSpeed(n):String(n);}
    if(/(?:^|_)connections?_limit$/.test(key)&&n!==null)return n<0?'∞':String(n);
    if(/(?:^|_)(?:dl|up)_?speed(?:_avg)?$/.test(key)&&n!==null)return U&&U.formatSpeed?U.formatSpeed(n):String(n);
    if(/(?:total_size|total_downloaded|total_downloaded_session|total_uploaded|total_uploaded_session|total_wasted|piece_size)$/.test(key)&&n!==null)return U&&U.formatBytes?U.formatBytes(n,{fixedDecimals:2}):String(n);
    if(/^(?:time_elapsed|seeding_time)$/.test(key))return generalDuration(value);if(/^(?:eta|reannounce)$/.test(key))return U&&U.formatEta?U.formatEta(value):String(value);
    if(/^(?:addition_date|completion_date|creation_date|last_seen)$/.test(key))return generalDate(key,value);
    if(typeof value==='number'&&!Number.isFinite(value))return'—';
    return String(value);
  }
  function generalSecondaryLabel(key){
    key=String(key||'').toLowerCase();
    if(key==='seeding_time')return tr('detail.secondary.seeding');
    if(/_session$/.test(key))return tr('detail.secondary.session');
    if(/_avg$/.test(key))return tr('detail.secondary.average');
    if(/(?:^|_)limit$/.test(key))return tr('detail.secondary.max');
    if(/_total$/.test(key))return tr('detail.secondary.total');
    return'';
  }
  function sourceGeneralFieldValue(field,data,hash){
    if(field&&field.valueSource==='torrentHash')return String(hash||'—');
    var keys=Array.isArray(field&&field.dataProperties)?field.dataProperties.map(String):[];
    if(!keys.length)return null;
    if(field.id==='private'&&keys.indexOf('has_metadata')>=0&&keys.indexOf('private')>=0){if(!own(data,'has_metadata')||!own(data,'private'))return'—';if(!data.has_metadata)return tr('common.na');return generalYesNo(!!data.private);}
    var presentation=field&&field.valuePresentation;
    if(presentation&&presentation.kind==='source-field'&&presentation.format==='pieces'&&keys.indexOf('pieces_num')>=0){if(!own(data,'pieces_num'))return generalSourceValue('N/A','PropertiesWidget');var sourcePieces=data.pieces_num,sourcePieceSize=keys.indexOf('piece_size')>=0&&own(data,'piece_size')?data.piece_size:null,sourcePiecesHave=keys.indexOf('pieces_have')>=0&&own(data,'pieces_have')?data.pieces_have:null;if(sourcePieces==null)return generalSourceValue('N/A','PropertiesWidget');var pieceRule=generalPresentationValue(field,'pieces_num',sourcePieces);if(pieceRule&&pieceRule.handled)return pieceRule.text;var sourceText=String(sourcePieces)+(sourcePieceSize==null?'':' × '+(U&&U.formatBytes?U.formatBytes(sourcePieceSize,{fixedDecimals:2}):String(sourcePieceSize)));if(sourcePiecesHave!=null)sourceText+=' ('+tr('detail.piecesHave',{count:sourcePiecesHave})+')';return sourceText;}
    if(field.id==='pieces'&&keys.indexOf('pieces_num')>=0){if(!own(data,'pieces_num'))return'N/A';var pieces=data.pieces_num,pieceSize=keys.indexOf('piece_size')>=0&&own(data,'piece_size')?data.piece_size:null,piecesHave=keys.indexOf('pieces_have')>=0&&own(data,'pieces_have')?data.pieces_have:null;if(pieces==null)return generalSourceValue('N/A','PropertiesWidget');if(Number(pieces)<0)return generalSourceValue('Unknown','HttpServer');var text=String(pieces)+(pieceSize==null?'':' × '+(U&&U.formatBytes?U.formatBytes(pieceSize,{fixedDecimals:2}):String(pieceSize)));if(piecesHave!=null)text+=' ('+tr('detail.piecesHave',{count:piecesHave})+')';return text;}
    var values=[];keys.forEach(function(key){var projected=own(data,key)?generalPresentationValue(field,key,data[key]):null,text=own(data,key)?(projected&&projected.handled?projected.text:generalScalar(key,data[key])):'N/A';if(text!=='—'||values.length===0)values.push({key:key,text:text});});
    if(!values.length)return'—';
    var primary=values[0].text,secondary=values.slice(1).map(function(item){var prefix=generalSecondaryLabel(item.key);return prefix?prefix+' '+item.text:item.text;}).filter(Boolean);
    return primary+(secondary.length?' ('+secondary.join(', ')+')':'');
  }
  function renderGeneral(root,data,hash){
    var ui=exactDetailUi(),layout=ui&&ui.propertyLayout;if(!root||!data||typeof data!=='object'||Array.isArray(data)||!Array.isArray(layout)||!layout.length)return false;
    var prepared=[];
    for(var i=0;i<layout.length;i++){
      var group=layout[i],fields=Array.isArray(group&&group.fields)?group.fields:[],rows=[];
      for(var j=0;j<fields.length;j++){
        var field=fields[j],id=String(field&&field.id||''),props=Array.isArray(field&&field.dataProperties)?field.dataProperties.map(String):[];
        if(id==='progress'||id==='availability'||props.indexOf('progress')>=0||props.indexOf('availability')>=0)continue;
        var value=sourceGeneralFieldValue(field,data,hash);
        if(!id||value===null)return false;
        var href=(id==='comment'||props.indexOf('comment')>=0)&&/^https?:\/\/[^\s]+$/i.test(String(value||''))?String(value):'';
        rows.push({id:id,value:value,href:href});
      }
      if(rows.length)prepared.push({group:group,rows:rows});
    }
    if(!prepared.length)return false;
    var structure=prepared.map(function(item){return String(item.group&&item.group.key||'')+':'+item.rows.map(function(row){return row.id;}).join(',');}).join('|'),profile=exactProfile(),host=root.firstElementChild,reuse=!!(host&&host.classList&&host.classList.contains('general-detail')&&host.dataset.qbSourceDriven==='true'&&host.dataset.structure===structure);
    function updateValue(kv,row){var name=kv.children[0],value=kv.children[1],wantLink=!!row.href,correct=value&&((wantLink&&value.tagName==='A')||(!wantLink&&value.tagName==='STRONG'));if(!correct){var next=wantLink?document.createElement('a'):document.createElement('strong');if(value)kv.replaceChild(next,value);else kv.appendChild(next);value=next;}name.textContent=detailPropertyLabel(row.id);value.textContent=row.value==null?'—':String(row.value);value.dataset.generalValue='true';if(wantLink){value.className='general-detail__link';value.href=row.href;value.target='_blank';value.rel='noopener noreferrer';}else value.className='';}
    if(!reuse){host=document.createElement('div');host.className='general-detail';host.dataset.qbSourceDriven='true';host.dataset.structure=structure;prepared.forEach(function(item){var group=item.group,key=String(group&&group.key||''),section=document.createElement('section');section.className='general-detail__section'+(key==='root'?' general-detail__section--root':'');section.dataset.generalGroup=key;if(key!=='root'){var title=document.createElement('h3');title.className='general-detail__title';section.appendChild(title);}var grid=document.createElement('div');grid.className='general-detail__grid';item.rows.forEach(function(row){var kv=document.createElement('div');kv.className='kv';kv.dataset.generalField=row.id;kv.append(document.createElement('span'),document.createElement('strong'));grid.appendChild(kv);});section.appendChild(grid);host.appendChild(section);});root.replaceChildren(host);}
    if(profile)host.dataset.qbVersion=String(profile.qbVersion||profile.detectedQbVersion||'');else delete host.dataset.qbVersion;
    prepared.forEach(function(item,groupIndex){var section=host.children[groupIndex],key=String(item.group&&item.group.key||''),title=key==='root'?null:section.querySelector('.general-detail__title'),grid=section.querySelector('.general-detail__grid');if(title)title.textContent=detailGroupLabel(key);item.rows.forEach(function(row,rowIndex){updateValue(grid.children[rowIndex],row);});});return true;
  }
  W.QbUiEvidence={profile:exactProfile,detailUi:exactDetailUi,detailColumns:detailColumns,detailTab:detailTab,detailPropertyLabel:detailPropertyLabel,detailGroupLabel:detailGroupLabel,renderGeneral:renderGeneral,text:officialText};

  function safeParse(value){try{var parsed=JSON.parse(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch(_e){return{};}}
  function tableState(tableId){try{return safeParse(localStorage.getItem(TABLE_COLUMN_KEY+String(tableId||''))||'{}');}catch(_e){return{};}}
  function writeTableState(tableId,state){state=state&&typeof state==='object'&&!Array.isArray(state)?state:{};try{var key=TABLE_COLUMN_KEY+String(tableId||''),keys=Object.keys(state);if(!keys.length||(keys.length===1&&keys[0]==='schemaVersion'))localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(state));}catch(_e){}return state;}
  function sourceColumn(column,defaultWidth){var out=cloneColumn(column),width=Number(out.defaultWidth);if(!Number.isFinite(width)||width<=0)width=Number(out.width);if(!Number.isFinite(width)||width<=0)width=defaultWidth;out.key=String(out.key||'');out.defaultWidth=Math.max(Number(out.min)||24,width||defaultWidth);out.defaultVisible=out.defaultVisible!==false;return out;}
  function normalizeSource(columns,options){var width=Math.max(24,Number(options&&options.defaultWidth)||140),seen=new Set(),out=[];(columns||[]).forEach(function(column){var item=sourceColumn(column,width);if(!item.key||seen.has(item.key))return;seen.add(item.key);out.push(item);});return out;}
  function insertMissingOfficialKeys(order,official){var out=(order||[]).filter(function(key,index,list){return official.indexOf(key)>=0&&list.indexOf(key)===index;});official.forEach(function(key,index){if(out.indexOf(key)>=0)return;var inserted=false;for(var p=index-1;p>=0;p--){var before=out.indexOf(official[p]);if(before>=0){out.splice(before+1,0,key);inserted=true;break;}}if(inserted)return;for(var n=index+1;n<official.length;n++){var after=out.indexOf(official[n]);if(after>=0){out.splice(after,0,key);inserted=true;break;}}if(!inserted)out.push(key);});return out;}
  function resolveColumns(tableId,columns,options){var source=normalizeSource(columns,options),state=tableState(tableId),official=source.map(function(column){return column.key;}),order=insertMissingOfficialKeys(Array.isArray(state.order)?state.order:[],official),byKey={};source.forEach(function(column){byKey[column.key]=column;});return order.map(function(key){var column=cloneColumn(byKey[key]),savedWidth=state.widths&&Number(state.widths[key]),visible=state.visibility&&own(state.visibility,key)?!!state.visibility[key]:column.defaultVisible;column.width=Number.isFinite(savedWidth)&&savedWidth>0?Math.max(Number(column.min)||24,savedWidth):column.defaultWidth;column.visible=visible;return column;});}
  function sameOrder(a,b){return a.length===b.length&&a.every(function(value,index){return value===b[index];});}
  function validSort(source,state){var sort=state&&state.sort,key=String(sort&&sort.key||'');if(!key||key==='checked'||!source.some(function(column){return column.key===key;}))return{key:'',reverse:false};return{key:key,reverse:sort.reverse===true};}
  function readSort(tableId,sourceColumns,options){var source=normalizeSource(sourceColumns,options),state=tableState(tableId),sort=validSort(source,state);if(state.sort&&sort.key===''){delete state.sort;writeTableState(tableId,state);}return sort;}
  function commitColumns(tableId,sourceColumns,resolved,options){var source=normalizeSource(sourceColumns,options),official=source.map(function(column){return column.key;}),byKey={};source.forEach(function(column){byKey[column.key]=column;});var rows=(resolved||[]).filter(function(column){return column&&byKey[column.key];}),order=rows.map(function(column){return column.key;}),priorSort=validSort(source,tableState(tableId)),state={schemaVersion:1},visibility={},widths={};if(priorSort.key)state.sort=priorSort;if(!sameOrder(order,official))state.order=order;rows.forEach(function(column){var base=byKey[column.key];if(!!column.visible!==!!base.defaultVisible)visibility[column.key]=!!column.visible;var width=Number(column.width),defaultWidth=Number(base.defaultWidth);if(Number.isFinite(width)&&Math.abs(width-defaultWidth)>.5)widths[column.key]=Math.max(Number(base.min)||24,width);});if(Object.keys(visibility).length)state.visibility=visibility;if(Object.keys(widths).length)state.widths=widths;return writeTableState(tableId,state);}
  function commitSort(tableId,sourceColumns,key,reverse,options){var source=normalizeSource(sourceColumns,options),state=tableState(tableId);state.schemaVersion=1;key=String(key||'');if(key&&key!=='checked'&&source.some(function(column){return column.key===key;}))state.sort={key:key,reverse:reverse===true};else delete state.sort;return writeTableState(tableId,state);}
  function resetColumns(tableId){try{localStorage.removeItem(TABLE_COLUMN_KEY+String(tableId||''));}catch(_e){}}
  W.SharedColumns={resolve:resolveColumns,commit:commitColumns,readSort:readSort,commitSort:commitSort,reset:resetColumns,read:tableState,storagePrefix:TABLE_COLUMN_KEY};

  function splitFinite(value,fallback){var n=Number(value);return Number.isFinite(n)?n:fallback;}
  function createSplitPane(options){
    options=options||{};
    var root=options.root,primary=options.primary,secondary=options.secondary,separator=options.separator;
    if(!root||!primary||!secondary||!separator)return null;
    function bound(value,fallback){if(typeof value==='function')try{value=value();}catch(_e){value=fallback;}return Math.max(0,splitFinite(value,fallback));}
    function minPrimary(){return bound(options.minPrimary,160);}
    function minSecondary(){return bound(options.minSecondary,160);}
    function trackSize(){var n=typeof options.trackSize==='function'?Number(options.trackSize()):Number.NaN;return Number.isFinite(n)&&n>=0?n:Math.max(0,Number(root.clientHeight)||0);}
    var defaultSecondary=Math.max(minSecondary(),splitFinite(options.defaultSecondary,280)),step=Math.max(1,splitFinite(options.step,16)),storageKey=String(options.storageKey||''),open=false,dragging=false,startY=0,startSize=defaultSecondary,size=defaultSecondary,geometryFrame=0,rootResizeObserver=null;
    function readStored(){if(!storageKey)return defaultSecondary;try{var raw=localStorage.getItem(storageKey);if(raw===null||raw==='')return defaultSecondary;var n=Number(raw);return Number.isFinite(n)&&n>=0?n:defaultSecondary;}catch(_e){return defaultSecondary;}}
    function writeStored(){if(!storageKey)return;try{localStorage.setItem(storageKey,String(Math.round(size)));}catch(_e){}}
    function maxSecondary(minimum){if(minimum===undefined)minimum=minSecondary();var n=typeof options.maxSecondary==='function'?Number(options.maxSecondary()):Number.NaN;if(!Number.isFinite(n)){var handle=Math.max(0,separator.getBoundingClientRect?separator.getBoundingClientRect().height:0);n=trackSize()-minPrimary()-handle;}return Math.max(minimum,n);}
    function bounds(){var minimum=minSecondary(),maximum=maxSecondary(minimum);return{min:minimum,max:Math.max(minimum,maximum)};}
    function clamp(value,limits){limits=limits||bounds();return Math.min(limits.max,Math.max(limits.min,splitFinite(value,defaultSecondary)));}
    function apply(value,persist){var limits=bounds();size=clamp(value,limits);secondary.style.flex='0 0 '+Math.round(size)+'px';secondary.style.height=Math.round(size)+'px';separator.setAttribute('aria-valuenow',String(Math.round(size)));separator.setAttribute('aria-valuemin',String(Math.round(limits.min)));separator.setAttribute('aria-valuemax',String(Math.round(limits.max)));if(persist)writeStored();return size;}
    function cancelGeometryFrame(){if(!geometryFrame)return;if(global.cancelAnimationFrame)global.cancelAnimationFrame(geometryFrame);else if(global.clearTimeout)global.clearTimeout(geometryFrame);geometryFrame=0;}
    function scheduleRefresh(){if(!open||geometryFrame)return;var run=function(){geometryFrame=0;if(open)apply(size,false);};geometryFrame=global.requestAnimationFrame?global.requestAnimationFrame(run):global.setTimeout(run,0);}
    function setOpen(value){open=!!value;secondary.hidden=!open;separator.hidden=!open;root.classList.toggle('is-split-open',open);if(open)scheduleRefresh();else cancelGeometryFrame();return open;}
    function pointerDown(e){if(!open||e.button!==0)return;e.preventDefault();dragging=true;startY=e.clientY;startSize=size;separator.classList.add('is-dragging');if(separator.setPointerCapture)try{separator.setPointerCapture(e.pointerId);}catch(_e){}}
    function pointerMove(e){if(!dragging)return;e.preventDefault();apply(startSize-(e.clientY-startY),false);}
    function pointerEnd(e){if(!dragging)return;dragging=false;separator.classList.remove('is-dragging');if(separator.releasePointerCapture)try{separator.releasePointerCapture(e.pointerId);}catch(_e){}writeStored();}
    function keyDown(e){if(!open)return;var next=null;if(e.key==='ArrowUp')next=size+step;else if(e.key==='ArrowDown')next=size-step;else if(e.key==='Home')next=defaultSecondary;if(next===null)return;e.preventDefault();apply(next,true);}
    function reset(){if(!open)return;apply(defaultSecondary,true);}
    function refresh(){if(open)apply(size,false);}
    function destroy(){separator.removeEventListener('pointerdown',pointerDown);separator.removeEventListener('pointermove',pointerMove);separator.removeEventListener('pointerup',pointerEnd);separator.removeEventListener('pointercancel',pointerEnd);separator.removeEventListener('keydown',keyDown);separator.removeEventListener('dblclick',reset);global.removeEventListener('resize',scheduleRefresh);if(rootResizeObserver)rootResizeObserver.disconnect();rootResizeObserver=null;cancelGeometryFrame();}
    size=readStored();separator.setAttribute('role','separator');separator.setAttribute('aria-orientation','horizontal');separator.tabIndex=0;separator.addEventListener('pointerdown',pointerDown);separator.addEventListener('pointermove',pointerMove);separator.addEventListener('pointerup',pointerEnd);separator.addEventListener('pointercancel',pointerEnd);separator.addEventListener('keydown',keyDown);separator.addEventListener('dblclick',reset);global.addEventListener('resize',scheduleRefresh,{passive:true});if(typeof global.ResizeObserver==='function'){rootResizeObserver=new global.ResizeObserver(function(){scheduleRefresh();});rootResizeObserver.observe(root);}setOpen(false);
    return{open:setOpen,isOpen:function(){return open;},size:function(){return size;},setSize:function(value,persist){return apply(value,persist!==false);},reset:reset,refresh:refresh,destroy:destroy};
  }
  W.SplitPane={create:createSplitPane};


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
    if(!document.getElementById('weig-sidebar-layout-css')){var link=document.createElement('link');link.id='weig-sidebar-layout-css';link.rel='stylesheet';link.href='css/sidebar.css'+suffix;document.head.appendChild(link);}
  }
  function readSidebarPreference(){try{return localStorage.getItem(SIDEBAR_KEY)==='1';}catch(_e){return false;}}
  function writeSidebarPreference(value){try{localStorage.setItem(SIDEBAR_KEY,value?'1':'0');}catch(_e){}}
  function ensureSidebarToggle(){
    var app=document.getElementById('app');if(!app)return null;var button=document.getElementById('sidebar-toggle');if(button)return button;
    button=document.createElement('button');button.id='sidebar-toggle';button.type='button';button.setAttribute('aria-controls','sidebar');button.addEventListener('click',function(){setSidebarCollapsed(!sidebarCollapsed,true);});app.appendChild(button);return button;
  }
  function ensureSidebarTransferPanel(){
    var sidebar=document.getElementById('sidebar');if(!sidebar)return null;var panel=document.getElementById('desktop-sidebar-transfer-panel');if(panel)return panel;
    panel=document.createElement('section');panel.id='desktop-sidebar-transfer-panel';panel.className='sidebar-transfer-panel';
    var chartHost=document.createElement('div');chartHost.id='desktop-sidebar-transfer-chart';chartHost.className='sidebar-transfer-panel__chart';
    var rates=document.createElement('div');rates.className='sidebar-transfer-rates';rates.innerHTML='<span class="sidebar-transfer-rate sidebar-transfer-rate--down"><strong data-sidebar-rate="down">0 B/s</strong></span><span class="sidebar-transfer-rate sidebar-transfer-rate--up"><strong data-sidebar-rate="up">0 B/s</strong></span>';
    var downMetric=rates.querySelector('.sidebar-transfer-rate--down'),upMetric=rates.querySelector('.sidebar-transfer-rate--up');if(W.Transfer&&W.Transfer.decorateRateMetric){W.Transfer.decorateRateMetric(downMetric,'download',tr('transfer.download'));W.Transfer.decorateRateMetric(upMetric,'upload',tr('transfer.upload'));}panel.append(chartHost,rates);sidebar.appendChild(panel);return panel;
  }
  function formatRate(value){var n=Math.max(0,Number(value)||0);return U&&U.formatSpeed?U.formatSpeed(n):(Math.round(n)+' B/s');}
  function paintSidebarRates(){
    var panel=document.getElementById('desktop-sidebar-transfer-panel');if(!panel)return;var info=W.TransferRuntime&&W.TransferRuntime.last?W.TransferRuntime.last()||{}:{};
    var down=panel.querySelector('[data-sidebar-rate="down"]'),up=panel.querySelector('[data-sidebar-rate="up"]'),downLabel=panel.querySelector('[data-transfer-label="download"]'),upLabel=panel.querySelector('[data-transfer-label="upload"]');
    if(down)down.textContent=formatRate(info.dl_info_speed);if(up)up.textContent=formatRate(info.up_info_speed);if(downLabel)downLabel.textContent=tr('transfer.download');if(upLabel)upLabel.textContent=tr('transfer.upload');
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
    button.textContent=expanded?'‹':'›';button.setAttribute('aria-expanded',expanded?'true':'false');button.setAttribute('aria-label',expanded?tr('sidebar.collapse'):tr('sidebar.expand'));
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
  global.addEventListener('weig:route-state',scheduleSidebarSync);
  global.addEventListener('weig:transfer',paintSidebarRates);
  global.addEventListener('weig:languagechange',function(){updateToggle();paintSidebarRates();if(isDesktop())mountDesktopTransfer();});
})(window);