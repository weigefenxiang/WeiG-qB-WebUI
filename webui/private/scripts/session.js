(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  if(!W.QBClient)return;
  var state='idle',busy=false,entryTask=null;
  function setState(next){state=next;global.dispatchEvent(new CustomEvent('weig:sessionstate',{detail:{state:state}}));}
  function contract(){return W.SessionContract||null;}
  function tr(key,vars){return W.I18n&&W.I18n.t?W.I18n.t(key,vars):String(key||'');}
  function guardSet(){var c=contract();return !!(c&&c.setLogoutGuard&&c.setLogoutGuard());}
  function guardClear(){var c=contract();if(c&&c.clearLogoutGuard)c.clearLogoutGuard();}
  function guarded(){var c=contract();return !!(c&&c.logoutGuarded&&c.logoutGuarded());}
  function navigatePublic(){var c=contract();if(!c||!c.navigatePublic)throw new Error('WeiG SessionContract navigation owner is unavailable.');return c.navigatePublic();}
  function lock(){document.documentElement.dataset.sessionLocked='1';var app=document.getElementById('app');if(app){app.setAttribute('aria-hidden','true');app.inert=true;}}
  function unlock(){delete document.documentElement.dataset.sessionLocked;var app=document.getElementById('app');if(app){app.removeAttribute('aria-hidden');app.inert=false;}}
  function sharedClient(client){client=client||(W.AppState&&W.AppState.client);if(client)return client;throw new Error('qBittorrent client is not ready.');}
  async function probeSession(client){try{await sharedClient(client).request('app/preferences');return true;}catch(e){if(e&&e.status===403)return false;throw e;}}
  async function verifyLoginHandoff(){
    var contract=W.SessionContract,handoff=contract&&contract.handoff&&contract.handoff();if(!handoff)return true;
    lock();setState('verifying-login');
    try{
      if(contract.matchesAuthenticatedEntry&&!contract.matchesAuthenticatedEntry(handoff)){
        var routeProbe=await contract.probe();contract.clearHandoff();
        contract.recordFailure(routeProbe&&routeProbe.kind==='authenticated'?'navigation-mismatch':routeProbe&&routeProbe.kind||'offline',routeProbe&&routeProbe.status||0,'post-navigation');
        setState('login-handoff-failed');contract.navigatePublicFailure();return false;
      }
      var result=await contract.probe();
      if(result&&result.kind==='authenticated'){contract.completeHandoff();setState('authenticated');unlock();return true;}
      contract.clearHandoff();contract.recordFailure(result&&result.kind||'offline',result&&result.status||0,'post-navigation');
      setState('login-handoff-failed');contract.navigatePublicFailure();return false;
    }catch(_error){
      contract.clearHandoff();contract.recordFailure('offline',0,'post-navigation');
      setState('login-handoff-failed');contract.navigatePublicFailure();return false;
    }
  }
  function ready(){if(!entryTask)entryTask=Promise.resolve().then(verifyLoginHandoff);return entryTask;}
  function clearPrivateState(){
    var app=W.AppState;if(!app)return;
    clearTimeout(app.pollTimer);clearTimeout(app.searchPoll);app.pollTimer=null;app.searchPoll=null;
    ['torrents','catalog'].forEach(function(k){if(Array.isArray(app[k]))app[k].length=0;});app.prefs=null;app.prefsDraft={};app.detailHash='';app.searchJob=null;
    if(app.selection&&app.selection.clear)app.selection.clear(true);
  }
  function explainBypass(){
    var msg=tr('session.logoutBypass');
    if(W.toast)W.toast(msg,'error');
    var fatal=document.getElementById('fatal'),copy=document.getElementById('fatal-message');if(fatal&&copy){copy.textContent=msg;fatal.classList.remove('is-hidden');}
  }
  async function logout(client){
    if(busy)return false;busy=true;setState('logging-out');
    try{
      client=sharedClient(client);await client.request('auth/logout',{method:'POST',type:'void'});setState('verifying');
      var active=await probeSession(client);
      if(active){setState('auth-bypass');explainBypass();return false;}
      setState('logged-out');guardSet();clearPrivateState();lock();navigatePublic();return true;
    }catch(e){setState('failed');if(W.toast)W.toast((e&&e.message)||String(e),'error');return false;}
    finally{busy=false;}
  }
  async function verifyReentry(){
    if(!guarded())return true;
    lock();
    try{
      var active=await probeSession(sharedClient());
      if(active){guardClear();unlock();return true;}
      navigatePublic();return false;
    }catch(_e){
      /* AUTH-BFCACHE-FAIL-CLOSED: a guarded private shell is never restored when
       * server session state cannot be positively verified. */
      navigatePublic();return false;
    }
  }
  function onPageShow(e){if(e.persisted||guarded())verifyReentry();}

  /* Browser locale is a one-time bootstrap input only. qBittorrent
   * preferences.locale is the single persisted/current language truth.
   * Once browser selection is verified in qB, native WebUI return never
   * restores a pre-WeiG locale. */
  var BOOTSTRAP_KEY=(W.StorageKeys&&W.StorageKeys.localeBootstrap)||'weig.localeBootstrap';
  function cleanLocale(value){return String(value==null?'':value).trim();}
  function readBootstrap(){
    try{var value=JSON.parse(localStorage.getItem(BOOTSTRAP_KEY)||'null');return value&&value.schemaVersion===2&&value.initialized===true?value:null;}catch(_e){return null;}
  }
  function saveBootstrap(value){try{localStorage.setItem(BOOTSTRAP_KEY,JSON.stringify(value));return true;}catch(_e){return false;}}
  function i18nReady(){return !!(W.I18n&&W.I18n.localeOptions&&W.I18n.matchBrowserLocale&&W.I18n.sameQbLocale&&W.I18n.hasExactLocale);}
  function sameLocale(a,b){return !!(W.I18n&&W.I18n.sameQbLocale&&W.I18n.sameQbLocale(a,b));}
  function localeWritable(value,prefs,state){return !!(W.SettingsSchema&&W.SettingsSchema.isWritable&&W.SettingsSchema.isWritable('locale',value,prefs||{},state||prefs||{}));}
  async function ensureLocaleWriteProof(){if(W.SettingsSchema&&W.SettingsSchema.loadCompatibility)await W.SettingsSchema.loadCompatibility();}
  function currentLocaleOptions(){return W.I18n&&W.I18n.localeOptions?W.I18n.localeOptions():[];}
  function browserLanguages(){var nav=global.navigator||{},values=Array.isArray(nav.languages)?nav.languages.slice():[];if(nav.language&&values.indexOf(nav.language)<0)values.push(nav.language);return values.filter(Boolean);}
  function syncPreferences(prefs){if(!prefs||typeof prefs!=='object')return;if(W.AppState)W.AppState.preferences=prefs;if(W.SettingsState)W.SettingsState.prefs=prefs;}
  function bootstrapRecord(reason,target,observed,initialized){return{schemaVersion:2,initialized:initialized===true,reason:String(reason||''),selectedLocale:cleanLocale(target)||null,observedLocale:cleanLocale(observed)||null,completedAt:initialized===true?Date.now():null};}
  async function bootstrapBrowserLocale(client,prefs){
    client=client||sharedClient();prefs=prefs||(W.AppState&&W.AppState.preferences)||await client.getPreferences();
    if(!prefs||prefs.alternative_webui_enabled!==true)return{changed:false,reason:'not-alternative-webui'};
    if(!i18nReady())return{changed:false,reason:'locale-owner-not-ready'};
    var sessionContract=contract(),manualIntent=sessionContract&&sessionContract.localeIntent?cleanLocale(sessionContract.localeIntent()):'',existing=readBootstrap();if(existing&&!manualIntent)return{changed:false,reason:'already-initialized',record:existing};
    var current=cleanLocale(prefs.locale);if(!current)return{changed:false,reason:'no-current-locale'};
    var target=manualIntent?W.I18n.matchBrowserLocale([manualIntent],currentLocaleOptions()):W.I18n.matchBrowserLocale(browserLanguages(),currentLocaleOptions()),manual=!!manualIntent;
    if(!target){if(manual&&sessionContract&&sessionContract.consumeLocaleIntent)sessionContract.consumeLocaleIntent();if(manual)return{changed:false,reason:'login-locale-unavailable'};var noMatch=bootstrapRecord('no-browser-match',null,current,true);if(!saveBootstrap(noMatch))return{changed:false,reason:'bootstrap-storage-unavailable'};return{changed:false,reason:'no-browser-match',record:noMatch};}
    if(sameLocale(target,current)){if(manual&&sessionContract&&sessionContract.consumeLocaleIntent)sessionContract.consumeLocaleIntent();var matched=bootstrapRecord(manual?'login-locale-already-matched':'already-matched',target,current,true);if(!saveBootstrap(matched))return{changed:false,reason:'bootstrap-storage-unavailable'};return{changed:false,reason:manual?'login-locale-already-matched':'already-matched',record:matched};}
    await ensureLocaleWriteProof();
    if(!localeWritable(target,prefs,Object.assign({},prefs,{locale:target}))){var blocked=bootstrapRecord('locale-not-writable',target,current,true);if(!saveBootstrap(blocked))return{changed:false,reason:'bootstrap-storage-unavailable'};return{changed:false,reason:'locale-not-writable',record:blocked};}
    if(!saveBootstrap(bootstrapRecord('write-pending',target,current,false)))return{changed:false,reason:'bootstrap-storage-unavailable'};
    try{
      await client.setPreferences({locale:target});
      var verified=await client.getPreferences();
      if(verified)syncPreferences(verified);
      if(verified&&sameLocale(verified.locale,target)){
        if(manual&&sessionContract&&sessionContract.consumeLocaleIntent)sessionContract.consumeLocaleIntent();
        var record=bootstrapRecord(manual?'login-locale-verified':'browser-locale-verified',target,verified.locale,true);saveBootstrap(record);
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
        if(manual&&sessionContract&&sessionContract.consumeLocaleIntent)sessionContract.consumeLocaleIntent();
        var recovered=bootstrapRecord(manual?'login-locale-verified-after-error':'browser-locale-verified-after-error',target,after.locale,true);saveBootstrap(recovered);
        return{changed:true,verified:true,reloadRequired:true,record:recovered,prefs:after,recovered:true};
      }
      saveBootstrap(bootstrapRecord('write-failed',target,after&&after.locale||current,false));
      if(after&&after.locale!=null&&W.I18n&&W.I18n.applyLocale)W.I18n.applyLocale(after.locale);
      try{console.warn('[WeiG] browser locale bootstrap failed safely',error);}catch(_e){}
      return{changed:false,verified:false,reason:'write-failed',error:error,prefs:after||null};
    }
  }
  function isNativeWebUiReturnTransition(prefs,pending){
    prefs=prefs||{};pending=pending||{};
    return prefs.alternative_webui_enabled===true&&Object.prototype.hasOwnProperty.call(pending,'alternative_webui_enabled')&&pending.alternative_webui_enabled===false;
  }
  function planNativeWebUiReturn(prefs,pending){
    prefs=prefs||{};pending=pending||{};
    if(!isNativeWebUiReturnTransition(prefs,pending))return null;
    var target=cleanLocale(Object.prototype.hasOwnProperty.call(pending,'locale')?pending.locale:prefs.locale),targetWritable=false,temporary='';
    if(i18nReady()&&target&&W.I18n.hasExactLocale(target)&&localeWritable(target,prefs,Object.assign({},prefs,pending,{locale:target}))){
      targetWritable=true;
      currentLocaleOptions().some(function(option){var value=cleanLocale(option&&option.value!==undefined?option.value:option);if(!value||sameLocale(value,target)||!W.I18n.hasExactLocale(value)||!localeWritable(value,prefs,Object.assign({},prefs,pending,{locale:value})))return false;temporary=value;return true;});
    }
    return{targetLocale:targetWritable?target:'',temporaryLocale:temporary,localeRefresh:!!temporary};
  }
  async function writeLocaleVerified(client,locale,stage){
    client=sharedClient(client);var current=W.AppState&&W.AppState.preferences||W.SettingsState&&W.SettingsState.prefs||{};if(!localeWritable(locale,current,Object.assign({},current,{locale:locale})))throw new Error('The qBittorrent locale write is no longer source-proven safe during '+stage+'.');await client.setPreferences({locale:locale});var verified=await client.getPreferences();if(!verified||!sameLocale(verified.locale,locale))throw new Error('qBittorrent locale verification failed during '+stage+'.');syncPreferences(verified);return verified;
  }
  function prepareNativeWebUiReturn(client,plan){if(!plan||!plan.localeRefresh||!plan.temporaryLocale)return Promise.resolve(null);return writeLocaleVerified(client,plan.temporaryLocale,'native WebUI preparation');}
  function completeNativeWebUiReturn(client,plan){if(!plan||!plan.targetLocale)return Promise.resolve(null);return writeLocaleVerified(client,plan.targetLocale,'native WebUI completion');}

  function waitForLocaleNavigation(){
    return new Promise(function(resolve){
      var settled=false,timer=null;
      function finish(){if(settled)return;settled=true;if(timer)clearTimeout(timer);resolve();}
      try{global.addEventListener('pagehide',finish,{once:true});}catch(_e){}
      /* A navigation should destroy this document quickly. The timeout is a
       * fail-open guard against a browser/WebView refusing reload: verified qB
       * locale remains authoritative and the app must never freeze forever. */
      timer=setTimeout(finish,1500);
    });
  }
  function installLocaleReadyBootstrap(){
    var I=W.I18n;if(!I||typeof I.ready!=='function'||I.__weigBrowserBootstrapWrapped)return false;
    var original=I.ready;
    I.ready=function(){
      var owner=this,args=arguments;
      return Promise.resolve(original.apply(owner,args)).then(async function(value){
        var app=W.AppState;
        if(!app||!app.client||!app.preferences)return value;
        var result=await bootstrapBrowserLocale(app.client,app.preferences);
        if(result&&result.prefs)app.preferences=result.prefs;
        if(result&&result.reloadRequired===true){
          var navigation=waitForLocaleNavigation();
          if(result.prefs&&result.prefs.locale!=null&&I.applyLocale)I.applyLocale(result.prefs.locale);
          else global.location.reload();
          await navigation;
        }
        return value;
      });
    };
    I.__weigBrowserBootstrapWrapped=true;
    return true;
  }

  W.SessionController={logout:logout,state:function(){return state;},guarded:guarded,clearGuard:guardClear,lock:lock,unlock:unlock,ready:ready,verifyLoginHandoff:verifyLoginHandoff,verifyReentry:verifyReentry,bootstrapBrowserLocale:bootstrapBrowserLocale,readLocaleBootstrap:readBootstrap,isNativeWebUiReturnTransition:isNativeWebUiReturnTransition,planNativeWebUiReturn:planNativeWebUiReturn,prepareNativeWebUiReturn:prepareNativeWebUiReturn,completeNativeWebUiReturn:completeNativeWebUiReturn};
  W.SessionGate={verifyReentry:verifyReentry,lock:lock,unlock:unlock,guarded:guarded};
  global.addEventListener('pageshow',onPageShow);
  if(guarded()){lock();setTimeout(verifyReentry,0);}
  if(W.SessionContract&&W.SessionContract.pendingHandoff())lock();
  installLocaleReadyBootstrap();
})(window);