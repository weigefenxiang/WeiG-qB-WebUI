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

  /* Browser locale is a one-time bootstrap input only. qBittorrent
   * preferences.locale is the single persisted/current language truth.
   * Once browser selection is verified in qB, native WebUI return never
   * restores a pre-WeiG locale. */
  var LEGACY_HANDOFF_KEY='weigg.localeHandoff.v1',BOOTSTRAP_KEY='weigg.localeBootstrap.v2';
  function cleanLocale(value){return String(value==null?'':value).trim();}
  function clearLegacyHandoff(){try{localStorage.removeItem(LEGACY_HANDOFF_KEY);}catch(_e){}}
  function readBootstrap(){
    try{var value=JSON.parse(localStorage.getItem(BOOTSTRAP_KEY)||'null');return value&&value.schemaVersion===2&&value.initialized===true?value:null;}catch(_e){return null;}
  }
  function saveBootstrap(value){try{localStorage.setItem(BOOTSTRAP_KEY,JSON.stringify(value));return true;}catch(_e){return false;}}
  function i18nReady(){return !!(W.I18n&&W.I18n.localeOptions&&W.I18n.matchBrowserLocale&&W.I18n.sameQbLocale&&W.I18n.hasExactLocale);}
  function sameLocale(a,b){return !!(W.I18n&&W.I18n.sameQbLocale&&W.I18n.sameQbLocale(a,b));}
  function localeWritable(value){return !!(W.SettingsSchema&&W.SettingsSchema.isWritable&&W.SettingsSchema.isWritable('locale',value));}
  function currentLocaleOptions(){return W.I18n&&W.I18n.localeOptions?W.I18n.localeOptions():[];}
  function browserLanguages(){var nav=global.navigator||{},values=Array.isArray(nav.languages)?nav.languages.slice():[];if(nav.language&&values.indexOf(nav.language)<0)values.push(nav.language);return values.filter(Boolean);}
  function syncPreferences(prefs){if(!prefs||typeof prefs!=='object')return;if(W.AppState)W.AppState.preferences=prefs;if(W.SettingsState)W.SettingsState.prefs=prefs;}
  function bootstrapRecord(reason,target,observed,initialized){return{schemaVersion:2,initialized:initialized===true,reason:String(reason||''),selectedLocale:cleanLocale(target)||null,observedLocale:cleanLocale(observed)||null,completedAt:initialized===true?Date.now():null};}
  async function bootstrapBrowserLocale(client,prefs){
    clearLegacyHandoff();
    client=client||sharedClient();prefs=prefs||(W.AppState&&W.AppState.preferences)||await client.getPreferences();
    if(!prefs||prefs.alternative_webui_enabled!==true)return{changed:false,reason:'not-alternative-webui'};
    if(!i18nReady())return{changed:false,reason:'locale-owner-not-ready'};
    var existing=readBootstrap();if(existing)return{changed:false,reason:'already-initialized',record:existing};
    var current=cleanLocale(prefs.locale);if(!current)return{changed:false,reason:'no-current-locale'};
    var target=W.I18n.matchBrowserLocale(browserLanguages(),currentLocaleOptions());
    if(!target){var noMatch=bootstrapRecord('no-browser-match',null,current,true);if(!saveBootstrap(noMatch))return{changed:false,reason:'bootstrap-storage-unavailable'};return{changed:false,reason:'no-browser-match',record:noMatch};}
    if(sameLocale(target,current)){var matched=bootstrapRecord('already-matched',target,current,true);if(!saveBootstrap(matched))return{changed:false,reason:'bootstrap-storage-unavailable'};return{changed:false,reason:'already-matched',record:matched};}
    if(!localeWritable(target)){var blocked=bootstrapRecord('locale-not-writable',target,current,true);if(!saveBootstrap(blocked))return{changed:false,reason:'bootstrap-storage-unavailable'};return{changed:false,reason:'locale-not-writable',record:blocked};}
    if(!saveBootstrap(bootstrapRecord('write-pending',target,current,false)))return{changed:false,reason:'bootstrap-storage-unavailable'};
    try{
      await client.setPreferences({locale:target});
      var verified=await client.getPreferences();
      if(verified)syncPreferences(verified);
      if(verified&&sameLocale(verified.locale,target)){
        var record=bootstrapRecord('browser-locale-verified',target,verified.locale,true);saveBootstrap(record);
        return{changed:true,verified:true,reloadRequired:true,record:record,prefs:verified};
      }
      var observed=verified&&cleanLocale(verified.locale)||current;
      saveBootstrap(bootstrapRecord('verification-mismatch',target,observed,false));
      if(verified&&W.I18n&&W.I18n.applyLocale&&verified.locale!=null)W.I18n.applyLocale(verified.locale);
      return{changed:true,verified:false,reason:'verification-mismatch',prefs:verified||null};
    }catch(error){
      var after=null;try{after=await client.getPreferences();}catch(_read){}
      if(after)syncPreferences(after);
      if(after&&sameLocale(after.locale,target)){
        var recovered=bootstrapRecord('browser-locale-verified-after-error',target,after.locale,true);saveBootstrap(recovered);
        return{changed:true,verified:true,reloadRequired:true,record:recovered,prefs:after,recovered:true};
      }
      saveBootstrap(bootstrapRecord('write-failed',target,after&&after.locale||current,false));
      if(after&&after.locale!=null&&W.I18n&&W.I18n.applyLocale)W.I18n.applyLocale(after.locale);
      try{console.warn('[WeiG] browser locale bootstrap failed safely',error);}catch(_e){}
      return{changed:false,verified:false,reason:'write-failed',error:error,prefs:after||null};
    }
  }
  function installLocaleReadyBootstrap(){
    var I=W.I18n;if(!I||typeof I.ready!=='function'||I.__weiggBrowserBootstrapWrapped)return false;
    var original=I.ready;
    I.ready=function(){
      var owner=this,args=arguments;
      return Promise.resolve(original.apply(owner,args)).then(async function(value){
        var app=W.AppState;
        if(!app||!app.client||!app.preferences)return value;
        var result=await bootstrapBrowserLocale(app.client,app.preferences);
        if(result&&result.prefs)app.preferences=result.prefs;
        if(result&&result.reloadRequired===true){
          global.location.reload();
          /* Navigation is now the continuation. Keep app.init() behind this
           * gate so it cannot expose a stale-language ready shell before the
           * reload destroys this document. */
          return new Promise(function(){});
        }
        return value;
      });
    };
    I.__weiggBrowserBootstrapWrapped=true;
    return true;
  }

  W.SessionController={logout:logout,state:function(){return state;},guarded:guarded,clearGuard:guardClear,lock:lock,unlock:unlock,verifyReentry:verifyReentry,bootstrapBrowserLocale:bootstrapBrowserLocale,readLocaleBootstrap:readBootstrap};
  W.SessionGate={verifyReentry:verifyReentry,lock:lock,unlock:unlock,guarded:guarded};
  global.addEventListener('pageshow',onPageShow);
  if(guarded()){lock();setTimeout(verifyReentry,0);}
  clearLegacyHandoff();
  installLocaleReadyBootstrap();
})(window);
