(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},I=W.I18n||null;
  var fallbacks={all:'All',downloading:'Downloading',seeding:'Seeding',completed:'Completed',resumed:'Resumed',paused:'Paused',running:'Running',stopped:'Stopped',active:'Active',inactive:'Inactive',stalled:'Stalled',stalled_uploading:'Stalled Uploading',stalled_downloading:'Stalled Downloading',checking:'Checking',moving:'Moving',errored:'Errored',private:'Private / PT'};
  var owned={identity:'',values:{},task:null};
  function asset(path){return W.buildAssetUrl?W.buildAssetUrl(path):path;}
  function profile(){return W.ReleaseProfile&&W.ReleaseProfile.current?W.ReleaseProfile.current():null;}
  function locale(){return I&&I.getQbLocale?String(I.getQbLocale()||'en'):'en';}
  function sameLocale(a,b){return I&&I.normalize?I.normalize(a)===I.normalize(b):String(a)===String(b);}
  function localeIn(list){var current=locale();return Array.isArray(list)&&list.some(function(value){return String(value)===current||sameLocale(value,current);});}
  function decodeField(value){try{return decodeURIComponent(String(value||''));}catch(_e){return String(value||'');}}
  function parseNativeUi(text,expectedSha){
    var source=String(text||''),refs={},values={},match;
    var refRe=/@@WEIGG_TEXT\t([0-9a-f]{24})\r?\n([\s\S]*?)\r?\n@@WEIGG_END/g;
    while((match=refRe.exec(source))){var value=String(match[2]||'').trim();if(value&&value.indexOf('QBT_TR(')<0)refs[match[1]]=value;}
    var uiRe=/^@@WEIGG_UI\t([0-9a-f]{40})\t([^\t]*)\t([0-9a-f]{24})\s*$/gm;
    while((match=uiRe.exec(source))){if(match[1]!==expectedSha)continue;var textValue=refs[match[3]];if(textValue)values[decodeField(match[2])]=textValue;}
    return values;
  }
  function translationSet(data){
    if(!data)return null;var current=locale(),hash=data.translations&&data.translations[current];
    if(!hash&&I&&I.normalize){var target=I.normalize(current),key=Object.keys(data.translations||{}).find(function(value){return I.normalize(value)===target;});if(key)hash=data.translations[key];}
    return hash&&data.sets&&data.sets[hash]||null;
  }
  function translateRef(ref,data){
    if(!ref||!ref.source)return'';var set=translationSet(data),messages=set&&Array.isArray(set.messages)?set.messages:[],hit=messages.find(function(item){return item.context===ref.context&&item.source===ref.source;}),value=hit&&hit.translation;if(Array.isArray(value))value=value[0];return String(value||ref.source);
  }
  function bridgeUi(data){var values={};Object.keys(data&&data.ui||{}).forEach(function(key){values[key]=translateRef(data.ui[key],data);});return values;}
  function loadOwnedText(){
    var current=profile();if(!I||!current||current.fallback)return Promise.resolve(owned.values);
    var sha=String(current.sourceSha||''),identity=sha+'|'+locale();if(owned.identity===identity&&!owned.task)return Promise.resolve(owned.values);if(owned.task)return owned.task;
    owned.identity=identity;owned.values={};
    var native=localeIn(current.settingsNativeLocales),bridge=localeIn(current.settingsTranslationLocales);
    if(!native&&!bridge)return Promise.resolve(owned.values);
    owned.task=(I.ready?I.ready():Promise.resolve()).then(function(){
      if(owned.identity!==identity)return owned.values;
      if(native)return fetch(asset('data/qb-settings-native.txt'),{credentials:'same-origin',cache:'no-store'}).then(function(res){if(!res.ok)throw new Error('qB native UI copy HTTP '+res.status);return res.text();}).then(function(text){if(owned.identity===identity)owned.values=parseNativeUi(text,sha);});
      if(bridge&&I.loadSettingsData)return I.loadSettingsData().then(function(data){if(owned.identity===identity&&data)owned.values=bridgeUi(data);});
    }).catch(function(){if(owned.identity===identity)owned.values={};}).finally(function(){if(owned.identity===identity){owned.task=null;try{global.dispatchEvent(new CustomEvent('weigg:qb-owned-text-ready',{detail:{sourceSha:sha,locale:locale()}}));}catch(_e){}}});
    return owned.task.then(function(){return owned.values;});
  }
  function qbText(key,fallback){return String(owned.values[key]||fallback||key);}
  if(I){I.qbText=qbText;I.loadQbOwnedText=loadOwnedText;}

  function sourceFilterName(name){if(name==='private')return'private';var R=W.ReleaseProfile;return R&&R.upstreamTorrentFilter?R.upstreamTorrentFilter(name)||name:name;}
  function stripZeroCount(value){return String(value||'').replace(/\s*[\(（]\s*0\s*[\)）]\s*$/,'').trim();}
  function label(name){var source=sourceFilterName(name),fallback=fallbacks[source]||fallbacks[name]||name;if(name==='private')return'Private / PT';return stripZeroCount(qbText('filter.'+source,fallback));}
  function desired(){var out=W.TorrentSemantics&&W.TorrentSemantics.statusFilters?W.TorrentSemantics.statusFilters():['all','downloading','seeding','completed','stopped','running','active','inactive','errored'];if(W.CapabilityRegistry&&W.CapabilityRegistry.supports&&W.CapabilityRegistry.supports('privateFilter'))out=out.concat(['private']);return Array.from(new Set(out));}
  function syncActive(){var active=W.LibraryController&&W.LibraryController.state?W.LibraryController.state().filter:'all';document.querySelectorAll('#filter-nav [data-filter]').forEach(function(node){node.classList.toggle('is-active',node.dataset.filter===active);});}
  function render(){var root=document.getElementById('filter-nav');if(!root)return;var active=W.LibraryController&&W.LibraryController.state?W.LibraryController.state().filter:'all';root.textContent='';desired().forEach(function(name){var button=document.createElement('button');button.className='nav-item';button.type='button';button.dataset.filter=name;button.textContent=label(name);button.classList.toggle('is-active',name===active);button.addEventListener('click',function(){if(W.LibraryController&&W.LibraryController.setFilter)W.LibraryController.setFilter(name);});root.appendChild(button);});}
  function relabelSettingsTabs(){document.querySelectorAll('#settings-tabs [data-settings-tab]').forEach(function(button){var tab=button.dataset.settingsTab;if(['downloads','connection','speed','bittorrent','webui','advanced'].indexOf(tab)<0)return;button.textContent=qbText('settings.tab.'+tab,button.textContent);});}
  function relabelTransferModes(){var dialog=document.getElementById('transfer-limit-dialog');if(!dialog)return;var normal=dialog.querySelector('[data-transfer-mode="normal"]'),alt=dialog.querySelector('[data-transfer-mode="alt"]');if(normal)normal.textContent=qbText('transfer.rate.global','Global Rate Limits');if(alt)alt.textContent=qbText('transfer.rate.alternative','Alternative Rate Limits');}
  function refreshOwned(){owned.identity='';owned.values={};owned.task=null;loadOwnedText().then(function(){render();relabelSettingsTabs();relabelTransferModes();});}
  function install(){render();relabelSettingsTabs();loadOwnedText().then(function(){render();relabelSettingsTabs();relabelTransferModes();});global.addEventListener('weigg:capabilities-ready',render);global.addEventListener('weigg:release-profile',refreshOwned);global.addEventListener('weigg:languagechange',refreshOwned);global.addEventListener('weigg:qb-owned-text-ready',function(){render();relabelSettingsTabs();relabelTransferModes();});global.addEventListener('weigg:settings-render',relabelSettingsTabs);global.addEventListener('weigg:library-state',syncActive);document.addEventListener('click',function(){setTimeout(relabelTransferModes,0);});}
  W.TorrentFilterView={render:render,sync:syncActive,filters:desired};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
