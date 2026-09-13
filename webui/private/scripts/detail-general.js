(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},U=W.util,C=W.Components;
  if(W.GeneralDetailRuntime)return;
  var installed=false,lastSnapshot=null,renderToken=0;

  function localized(en,cn){return W.I18n&&W.I18n.pick?W.I18n.pick(en,cn):en;}
  function uiEvidence(){var E=W.QbUiEvidence,ui=E&&E.detailUi&&E.detailUi();return ui&&Array.isArray(ui.propertyLayout)&&ui.propertyLayout.length?ui:null;}
  function currentRoute(hash){var app=W.AppState,r=W.Router&&W.Router.route?W.Router.route():null;return !!(app&&r&&r.name==='torrent'&&app.detailTab==='overview'&&String(app.detailHash||'')===String(hash||''));}
  function finite(value){var n=Number(value);return Number.isFinite(n)?n:null;}
  function duration(value){var n=finite(value);if(n===null||n<0)return'—';return U&&U.formatEta?U.formatEta(n):String(n);}
  function dateValue(value){var n=finite(value);return n!==null&&n>0?new Date(n*1000).toLocaleString():'—';}
  function yesNo(value){return value?localized('Yes','是'):localized('No','否');}
  function formatScalar(key,value){
    key=String(key||'').toLowerCase();
    if(value===undefined||value===null||value==='')return'—';
    if(typeof value==='boolean')return yesNo(value);
    if(Array.isArray(value))return value.length?value.join(', '):'—';
    var n=finite(value);
    if(key==='progress'&&n!==null)return (U&&U.percent?U.percent(n):Math.round(n*1000)/10)+'%';
    if(key==='availability'&&n!==null)return n>=0?n.toFixed(3):'—';
    if(key==='share_ratio'||key==='popularity')return U&&U.formatRatio?U.formatRatio(value):String(value);
    if(/(?:^|_)(?:dl|up)_?limit$/.test(key)&&n!==null){if(n<0)return'∞';return U&&U.formatSpeed?U.formatSpeed(n):String(n);}
    if(/(?:^|_)(?:dl|up)_?speed(?:_avg)?$/.test(key)&&n!==null)return U&&U.formatSpeed?U.formatSpeed(n):String(n);
    if(/(?:total_size|total_downloaded|total_downloaded_session|total_uploaded|total_uploaded_session|total_wasted|piece_size)$/.test(key)&&n!==null)return U&&U.formatBytes?U.formatBytes(n):String(n);
    if(/^(?:time_elapsed|seeding_time|eta|reannounce)$/.test(key))return duration(value);
    if(/^(?:addition_date|completion_date|creation_date|last_seen)$/.test(key))return dateValue(value);
    if(typeof value==='number'&&!Number.isFinite(value))return'—';
    return String(value);
  }
  function propertiesValue(field,data){
    var keys=Array.isArray(field&&field.dataProperties)?field.dataProperties:[];
    if(field&&field.id&&keys.indexOf(field.id)>=0)keys=[field.id].concat(keys.filter(function(key){return key!==field.id;}));
    if(field&&field.id==='private'&&keys.indexOf('has_metadata')>=0&&keys.indexOf('private')>=0){if(!data.has_metadata)return localized('N/A','不适用');return yesNo(!!data.private);}
    var values=[];keys.forEach(function(key){if(Object.prototype.hasOwnProperty.call(data||{},key)){var text=formatScalar(key,data[key]);if(text!=='—'||values.length===0)values.push(text);}});
    return values.length?values.join(' · '):'—';
  }
  function fieldValue(field,data,hash){if(field&&field.valueSource==='torrentHash')return String(hash||'—');return propertiesValue(field||{},data||{});}
  function fieldLabel(id){var E=W.QbUiEvidence,value=E&&E.detailPropertyLabel&&E.detailPropertyLabel(id);return value&&value!==id?value:String(id||'');}
  function groupLabel(group){var E=W.QbUiEvidence,key=String(group&&group.key||'');if(key==='root')return'';var value=E&&E.detailGroupLabel&&E.detailGroupLabel(key);if(value&&value!==key)return value;var ref=group&&group.translation;return String(ref&&ref.source||key);}
  function render(snapshot){
    if(!snapshot||!currentRoute(snapshot.hash))return false;
    var ui=uiEvidence(),root=document.getElementById('detail-content');if(!ui||!root)return false;
    var host=document.createElement('div');host.className='general-detail';host.dataset.qbSourceDriven='true';var profile=W.QbUiEvidence&&W.QbUiEvidence.profile&&W.QbUiEvidence.profile();if(profile)host.dataset.qbVersion=String(profile.qbVersion||profile.detectedQbVersion||'');
    ui.propertyLayout.forEach(function(group){var fields=Array.isArray(group&&group.fields)?group.fields:[];if(!fields.length)return;var section=document.createElement('section');section.className='general-detail__section'+(group.key==='root'?' general-detail__section--root':'');var title=groupLabel(group);if(title){var heading=document.createElement('h3');heading.className='general-detail__title';heading.textContent=title;section.appendChild(heading);}var grid=document.createElement('div');grid.className='general-detail__grid';fields.forEach(function(field){var id=String(field&&field.id||'');if(!id)return;grid.appendChild(C.kv(fieldLabel(id),fieldValue(field,snapshot.data,snapshot.hash)));});section.appendChild(grid);host.appendChild(section);});
    if(!host.children.length)return false;root.textContent='';root.appendChild(host);return true;
  }
  function schedule(snapshot){
    var token=++renderToken,attempts=0;
    function tryRender(){if(token!==renderToken||!currentRoute(snapshot.hash))return;var root=document.getElementById('detail-content');if(!root)return;if(root.querySelector('.kv-grid')||root.querySelector('.general-detail')){render(snapshot);return;}if(root.querySelector('.loading-state')&&attempts++<240){global.requestAnimationFrame(tryRender);return;}if(attempts++<240){global.requestAnimationFrame(tryRender);}}
    global.requestAnimationFrame(tryRender);
  }
  function capture(hash,data){if(!data||typeof data!=='object'||Array.isArray(data)||!uiEvidence())return;lastSnapshot={hash:String(hash||''),data:data};schedule(lastSnapshot);}
  function install(){
    if(installed)return true;var app=W.AppState,client=app&&app.client;if(!client||typeof client.properties!=='function')return false;
    var original=client.properties;if(original.__weiggGeneralEvidenceWrapper){installed=true;return true;}
    function wrapped(hash){return Promise.resolve(original.apply(this,arguments)).then(function(data){capture(hash,data);return data;});}
    wrapped.__weiggGeneralEvidenceWrapper=true;wrapped.__weiggOriginal=original;client.properties=wrapped;installed=true;return true;
  }
  function retryInstall(){if(install())return;global.setTimeout(retryInstall,0);}
  function rerenderLanguage(){if(lastSnapshot&&currentRoute(lastSnapshot.hash))render(lastSnapshot);}

  W.GeneralDetailRuntime={install:install,render:render,capture:capture,last:function(){return lastSnapshot;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',retryInstall,{once:true});else retryInstall();
  global.addEventListener('weigg:languagechange',rerenderLanguage);
  global.addEventListener('hashchange',function(){renderToken++;});
})(window);
