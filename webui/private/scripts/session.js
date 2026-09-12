(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  if(!W.QBClient)return;
  var GUARD='weigg.logoutGuard',state='idle',busy=false;
  function setState(next){state=next;global.dispatchEvent(new CustomEvent('weigg:sessionstate',{detail:{state:state}}));}
  function guardSet(){try{sessionStorage.setItem(GUARD,String(Date.now()));}catch(_e){}}
  function guardClear(){try{sessionStorage.removeItem(GUARD);}catch(_e){}}
  function guarded(){try{return !!sessionStorage.getItem(GUARD);}catch(_e){return false;}}
  function lock(){document.documentElement.dataset.sessionLocked='1';var app=document.getElementById('app');if(app){app.setAttribute('aria-hidden','true');app.inert=true;}}
  function unlock(){delete document.documentElement.dataset.sessionLocked;var app=document.getElementById('app');if(app){app.removeAttribute('aria-hidden');app.inert=false;}}
  function sharedClient(client){client=client||(W.AppState&&W.AppState.client);if(client)return client;throw new Error('qBittorrent client is not ready.');}
  async function probeSession(client){try{await sharedClient(client).request('app/preferences');return true;}catch(e){if(e&&e.status===403)return false;throw e;}}
  function clearPrivateState(){
    var app=W.AppState;if(!app)return;
    clearTimeout(app.pollTimer);clearTimeout(app.searchPoll);app.pollTimer=null;app.searchPoll=null;
    ['torrents','catalog'].forEach(function(k){if(Array.isArray(app[k]))app[k].length=0;});app.prefs=null;app.prefsDraft={};app.detailHash='';app.searchJob=null;
    if(app.selection&&app.selection.clear)app.selection.clear(true);
  }
  function explainBypass(){
    var msg=(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN')
      ?'qBittorrent 当前允许此客户端免认证访问。Session 已结束，但服务器立即创建了新 Session，因此无法保持真正登出。请关闭本机免认证或移除当前地址的认证白名单后再试。'
      :'qBittorrent currently allows this client to bypass authentication. The session ended, but the server immediately created a new session, so a durable logout is impossible. Disable local-auth bypass or remove this client from the authentication subnet whitelist.';
    if(W.toast)W.toast(msg,'error');
    var fatal=document.getElementById('fatal'),copy=document.getElementById('fatal-message');if(fatal&&copy){copy.textContent=msg;fatal.classList.remove('is-hidden');}
  }
  async function logout(client){
    if(busy)return false;busy=true;setState('logging-out');
    try{
      client=sharedClient(client);await client.request('auth/logout',{method:'POST',type:'void'});setState('verifying');
      var active=await probeSession(client);
      if(active){setState('auth-bypass');explainBypass();return false;}
      setState('logged-out');guardSet();clearPrivateState();lock();location.replace('./');return true;
    }catch(e){setState('failed');if(W.toast)W.toast((e&&e.message)||String(e),'error');return false;}
    finally{busy=false;}
  }
  async function verifyReentry(){
    if(!guarded())return true;
    lock();
    try{
      var active=await probeSession(sharedClient());
      if(active){guardClear();unlock();return true;}
      location.replace('./');return false;
    }catch(_e){
      /* AUTH-BFCACHE-FAIL-CLOSED: a guarded private shell is never restored when
       * server session state cannot be positively verified. */
      location.replace('./');return false;
    }
  }
  function onPageShow(e){if(e.persisted||guarded())verifyReentry();}
  W.SessionController={logout:logout,state:function(){return state;},guarded:guarded,clearGuard:guardClear,lock:lock,unlock:unlock,verifyReentry:verifyReentry};
  W.SessionGate={verifyReentry:verifyReentry,lock:lock,unlock:unlock,guarded:guarded};

  /* Locale handoff is transition metadata only. qBittorrent preferences.locale
   * remains the only persisted/current language truth, and W.I18n remains the
   * locale normalization/matching owner. */
  var HANDOFF_KEY='weigg.localeHandoff.v1',pendingSave=null;
  function own(obj,key){return Object.prototype.hasOwnProperty.call(obj||{},key);}
  function cleanLocale(value){return String(value==null?'':value).trim();}
  function readHandoff(){
    try{var value=JSON.parse(localStorage.getItem(HANDOFF_KEY)||'null');return value&&value.schemaVersion===1&&value.active===true?value:null;}catch(_e){return null;}
  }
  function saveHandoff(value){try{localStorage.setItem(HANDOFF_KEY,JSON.stringify(value));return true;}catch(_e){return false;}}
  function clearHandoff(){try{localStorage.removeItem(HANDOFF_KEY);}catch(_e){}}
  function i18nReady(){return !!(W.I18n&&W.I18n.localeOptions&&W.I18n.matchBrowserLocale&&W.I18n.sameQbLocale&&W.I18n.hasExactLocale);}
  function sameLocale(a,b){return !!(W.I18n&&W.I18n.sameQbLocale&&W.I18n.sameQbLocale(a,b));}
  function localeWritable(value){return !!(W.SettingsSchema&&W.SettingsSchema.isWritable&&W.SettingsSchema.isWritable('locale',value));}
  function currentLocaleOptions(){return W.I18n&&W.I18n.localeOptions?W.I18n.localeOptions():[];}
  function supportedLocale(value){return !!(W.I18n&&W.I18n.hasExactLocale&&W.I18n.hasExactLocale(value,currentLocaleOptions()));}
  function browserLanguages(){var nav=global.navigator||{},values=Array.isArray(nav.languages)?nav.languages.slice():[];if(nav.language&&values.indexOf(nav.language)<0)values.push(nav.language);return values.filter(Boolean);}
  function syncPreferences(prefs){if(!prefs||typeof prefs!=='object')return;if(W.AppState)W.AppState.preferences=prefs;if(W.SettingsState)W.SettingsState.prefs=prefs;}
  async function rollbackLocale(client,previous){
    try{await client.setPreferences({locale:previous});var verified=await client.getPreferences();syncPreferences(verified);if(verified&&W.I18n&&W.I18n.applyLocale)W.I18n.applyLocale(verified.locale);return !!(verified&&sameLocale(verified.locale,previous));}catch(_e){return false;}
  }
  async function bootstrapLocaleHandoff(client,prefs){
    client=client||sharedClient();prefs=prefs||(W.AppState&&W.AppState.preferences)||await client.getPreferences();
    if(!prefs||prefs.alternative_webui_enabled!==true){clearHandoff();return{changed:false,reason:'not-alternative-webui'};}
    if(!i18nReady())return{changed:false,reason:'locale-owner-not-ready'};
    var existing=readHandoff();
    if(existing){
      if(existing.closing===true){existing.closing=false;saveHandoff(existing);}
      if(existing.explicitOverride!==true&&cleanLocale(prefs.locale)&&existing.autoLocale&&!sameLocale(prefs.locale,existing.autoLocale)&&!sameLocale(prefs.locale,existing.previousLocale)){
        existing.explicitOverride=true;existing.autoLocale=null;saveHandoff(existing);
      }
      return{changed:false,reason:'already-initialized',record:existing};
    }
    var previous=cleanLocale(prefs.locale);if(!previous)return{changed:false,reason:'no-current-locale'};
    var target=W.I18n.matchBrowserLocale(browserLanguages(),currentLocaleOptions());
    var record={schemaVersion:1,active:true,previousLocale:previous,autoLocale:target||null,explicitOverride:false,closing:false};
    if(!saveHandoff(record))return{changed:false,reason:'handoff-storage-unavailable'};
    if(!target)return{changed:false,reason:'no-browser-match',record:record};
    if(sameLocale(target,previous))return{changed:false,reason:'already-matched',record:record};
    if(!localeWritable(target)){clearHandoff();return{changed:false,reason:'locale-not-writable'};}
    try{
      await client.setPreferences({locale:target});
      var verified=await client.getPreferences();
      if(verified&&sameLocale(verified.locale,target)){
        syncPreferences(verified);if(W.I18n&&W.I18n.applyLocale)W.I18n.applyLocale(verified.locale);
        return{changed:true,verified:true,record:record,prefs:verified};
      }
      await rollbackLocale(client,previous);clearHandoff();
      return{changed:true,verified:false,reason:'verification-mismatch'};
    }catch(error){
      var after=null;try{after=await client.getPreferences();}catch(_read){}
      if(after&&sameLocale(after.locale,target))await rollbackLocale(client,previous);
      clearHandoff();
      try{console.warn('[WeiG] browser locale handoff failed safely',error);}catch(_e){}
      return{changed:false,verified:false,reason:'write-failed',error:error};
    }
  }
  function prepareSettingsSave(draft){
    draft=draft||{};var record=readHandoff();pendingSave=null;if(!record)return{draft:draft,record:null};
    var explicitLocale=own(draft,'locale'),disabling=own(draft,'alternative_webui_enabled')&&draft.alternative_webui_enabled===false,injectedRestore=false;
    if(disabling&&!explicitLocale&&record.explicitOverride!==true&&cleanLocale(record.previousLocale)&&supportedLocale(record.previousLocale)&&localeWritable(record.previousLocale)){
      draft.locale=record.previousLocale;injectedRestore=true;
    }
    if(disabling){record.closing=true;saveHandoff(record);}
    pendingSave={explicitLocale:explicitLocale?cleanLocale(draft.locale):null,disabling:disabling,injectedRestore:injectedRestore,startedAt:Date.now()};
    return{draft:draft,record:record,explicitLocale:explicitLocale,disabling:disabling,injectedRestore:injectedRestore};
  }
  function reconcileSettingsSave(){
    if(!pendingSave)return false;
    var prefs=W.AppState&&W.AppState.preferences,record=readHandoff();
    if(!record){pendingSave=null;return true;}
    if(pendingSave.disabling&&prefs&&prefs.alternative_webui_enabled===false){clearHandoff();pendingSave=null;return true;}
    if(pendingSave.explicitLocale&&prefs&&sameLocale(prefs.locale,pendingSave.explicitLocale)){
      record.explicitOverride=true;record.autoLocale=null;record.closing=false;saveHandoff(record);pendingSave=null;return true;
    }
    if(Date.now()-pendingSave.startedAt>5000){if(record.closing===true){record.closing=false;saveHandoff(record);}pendingSave=null;return false;}
    return false;
  }
  function pollSettingsSave(){if(!pendingSave)return;if(reconcileSettingsSave())return;setTimeout(pollSettingsSave,50);}
  function onSettingsSaveCapture(event){var save=event.target&&event.target.closest&&event.target.closest('#save-settings-btn');if(!save)return;var controller=W.SettingsState;if(!controller||!controller.draft)return;prepareSettingsSave(controller.draft);if(pendingSave)setTimeout(pollSettingsSave,0);}
  async function waitForLocaleBootstrap(){
    for(var i=0;i<120;i++){
      var app=W.AppState;
      if(app&&app.client&&app.preferences&&i18nReady()&&currentLocaleOptions().length&&W.SettingsSchema){await bootstrapLocaleHandoff(app.client,app.preferences);return;}
      await new Promise(function(resolve){setTimeout(resolve,25);});
    }
  }
  document.addEventListener('click',onSettingsSaveCapture,true);
  global.addEventListener('weigg:languagechange',reconcileSettingsSave);
  global.addEventListener('pageshow',onPageShow);
  if(guarded()){lock();setTimeout(verifyReentry,0);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){waitForLocaleBootstrap().catch(function(){});},{once:true});
  else waitForLocaleBootstrap().catch(function(){});
})(window);
