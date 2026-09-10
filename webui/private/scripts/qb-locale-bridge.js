(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},task=null,options=[];
  function S(){return W.SettingsSchema||null;}
  function R(){return W.ReleaseProfile||null;}
  function normalizeCode(value){return String(value||'').trim();}
  function normalizeTag(value){return normalizeCode(value).replace('@latin','-Latn').replace(/_/g,'-');}
  function nativeLabel(value){var tag=normalizeTag(value);if(!tag)return'';try{var locale=new Intl.Locale(tag),display=new Intl.DisplayNames([locale.toString()],{type:'language'}),label=display.of(locale.toString());if(label)return label;}catch(_e){}return normalizeCode(value);}
  function normalizeOptions(values){var seen={},out=[];(values||[]).forEach(function(item){var value=normalizeCode(item&&typeof item==='object'?item.value:item);if(!value||seen[value])return;seen[value]=true;var label=item&&typeof item==='object'?String(item.label||'').trim():'';out.push({value:value,label:label||nativeLabel(value)});});return out;}
  function parseProbe(html){html=String(html||'');if(!html||html.indexOf('${LANGUAGE_OPTIONS}')>=0)return[];try{var doc=new DOMParser().parseFromString(html,'text/html'),select=doc.getElementById('weigg-qb-locale-options');if(!select)return[];return normalizeOptions(Array.from(select.options||[]).map(function(option){return{value:option.value,label:option.textContent||option.label||option.value};}));}catch(_e){return[];}}
  function profileOptions(){var r=R(),profile=r&&r.current&&r.current();return normalizeOptions(profile&&profile.webuiLocales);}
  async function probeOptions(){try{var response=await fetch('views/preferences.html?weigg_locale_probe=1',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return[];return parseProbe(await response.text());}catch(_e){return[];}}
  function install(next){options=normalizeOptions(next);var schema=S();if(schema&&schema.meta){schema.meta.locale=Object.assign({},schema.meta.locale||{},{enum:options.slice()});}try{global.dispatchEvent(new CustomEvent('weigg:qb-locale-options',{detail:{options:options.slice()}}));}catch(_e){}var state=W.SettingsState,renderer=W.SettingsRenderer,router=W.Router;if(state&&renderer&&renderer.open&&router&&router.route&&router.route().name==='settings')Promise.resolve(renderer.open(state.tab)).catch(function(){});return options;}
  async function refresh(){if(task)return task;task=(async function(){var live=await probeOptions(),exact=live.length?live:profileOptions();if(!exact.length){var state=W.SettingsState,current=state&&state.prefs&&normalizeCode(state.prefs.locale);if(current)exact=[{value:current,label:nativeLabel(current)}];}return install(exact);})().finally(function(){task=null;});return task;}
  function weiggKind(value){var tag=normalizeTag(value).toLowerCase();if(tag==='zh'||tag.indexOf('zh-hans')===0||tag==='zh-cn'||tag==='zh-sg')return'zh-CN';if(tag.indexOf('zh-hant')===0||tag==='zh-tw'||tag==='zh-hk'||tag==='zh-mo')return'zh-TW';if(tag.indexOf('ja')===0)return'ja';if(tag.indexOf('ko')===0)return'ko';if(tag.indexOf('en')===0)return'en';return'';}
  function qBForWeiG(setting){var kind=setting==='auto'&&W.I18n&&W.I18n.getLocale?W.I18n.getLocale():String(setting||'');var ranked={
    'en':['en','en_US','en_GB','en_AU'],
    'zh-CN':['zh_CN','zh','zh-Hans','zh_CN.UTF-8'],
    'zh-TW':['zh_TW','zh_HK','zh-Hant'],
    'ja':['ja','ja_JP'],
    'ko':['ko','ko_KR']
  }[kind]||[];
  for(var i=0;i<ranked.length;i++){var exact=options.find(function(item){return item.value===ranked[i];});if(exact)return exact.value;}
  var compatible=options.find(function(item){return weiggKind(item.value)===kind;});return compatible?compatible.value:'';}
  async function syncWeiGLanguage(event){await refresh();var schema=S(),state=W.SettingsState,client=W.AppState&&W.AppState.client,setting=event&&event.detail&&event.detail.setting||W.I18n&&W.I18n.getSetting&&W.I18n.getSetting()||'auto',target=qBForWeiG(setting);if(!target||!schema||!schema.isWritable||!schema.isWritable('locale',target)||!client||!client.setPreferences)return;var current=state&&state.prefs&&normalizeCode(state.prefs.locale);if(current===target)return;try{await client.setPreferences({locale:target});var reread=client.getPreferences?await client.getPreferences():null;if(state&&reread&&typeof reread==='object')state.prefs=reread;else if(state&&state.prefs)state.prefs.locale=target;}catch(error){if(W.toast)W.toast((W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN'?'WeiG 语言已保存，但 qBittorrent Locale 同步失败：':'WeiG language was saved, but qBittorrent Locale sync failed: ')+(error&&error.message||error),'warning',{title:W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN'?'Locale 同步失败':'Locale sync failed'});}}
  global.addEventListener('weigg:release-profile',refresh);
  global.addEventListener('weigg:capabilities-ready',refresh);
  global.addEventListener('weigg:languagechange',function(event){syncWeiGLanguage(event);});
  W.QBLocaleBridge={refresh:refresh,options:function(){return options.slice();},parseProbe:parseProbe,normalizeOptions:normalizeOptions,weiggKind:weiggKind,qBForWeiG:qBForWeiG};
  if(R()&&R().current&&R().current())refresh();
})(window);
