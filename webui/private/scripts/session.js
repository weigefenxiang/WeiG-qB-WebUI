(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  if(!W.QBClient)return;
  var GUARD='weigg.logoutGuard',state='idle',busy=false;
  var Client=W.QBClient;
  if(!Client.prototype.logout)Client.prototype.logout=function(){return this.request('auth/logout',{method:'POST',type:'void'});};
  if(!Client.prototype.probeSession)Client.prototype.probeSession=async function(){try{await this.request('app/preferences');return true;}catch(e){if(e&&e.status===403)return false;throw e;}};
  function setState(next){state=next;global.dispatchEvent(new CustomEvent('weigg:sessionstate',{detail:{state:state}}));}
  function guardSet(){try{sessionStorage.setItem(GUARD,String(Date.now()));}catch(_e){}}
  function guardClear(){try{sessionStorage.removeItem(GUARD);}catch(_e){}}
  function guarded(){try{return !!sessionStorage.getItem(GUARD);}catch(_e){return false;}}
  function lock(){document.documentElement.dataset.sessionLocked='1';var app=document.getElementById('app');if(app){app.setAttribute('aria-hidden','true');app.inert=true;}}
  function unlock(){delete document.documentElement.dataset.sessionLocked;var app=document.getElementById('app');if(app){app.removeAttribute('aria-hidden');app.inert=false;}}
  function clearPrivateState(){
    var app=W.AppState;if(!app)return;
    clearTimeout(app.pollTimer);clearTimeout(app.searchPoll);app.pollTimer=null;app.searchPoll=null;
    ['torrents','catalog'].forEach(function(k){if(Array.isArray(app[k]))app[k].length=0;});app.prefs=null;app.prefsDraft={};app.detailHash='';app.searchJob=null;
    if(app.selected&&app.selected.clear)app.selected.clear();
  }
  function explainBypass(){
    var msg=(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN')
      ?'qBittorrent 当前允许此客户端免认证访问。Session 已结束，但服务器立即创建了新 Session，因此无法保持真正登出。请关闭本机免认证或移除当前地址的认证白名单后再试。'
      :'qBittorrent currently allows this client to bypass authentication. The session ended, but the server immediately created a new session, so a durable logout is impossible. Disable local-auth bypass or remove this client from the authentication subnet whitelist.';
    if(W.toast)W.toast(msg,'danger');
    var fatal=document.getElementById('fatal'),copy=document.getElementById('fatal-message');if(fatal&&copy){copy.textContent=msg;fatal.classList.remove('is-hidden');}
  }
  async function logout(client){
    if(busy)return false;busy=true;setState('logging-out');client=client||new W.QBClient();
    try{
      await client.logout();setState('verifying');
      var active=await client.probeSession();
      if(active){setState('auth-bypass');explainBypass();return false;}
      setState('logged-out');guardSet();clearPrivateState();lock();location.replace('./');return true;
    }catch(e){setState('failed');if(W.toast)W.toast((e&&e.message)||String(e),'danger');return false;}
    finally{busy=false;}
  }
  async function verifyReentry(){
    if(!guarded())return true;
    lock();
    var c=new W.QBClient();
    try{
      var active=await c.probeSession();
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
  global.addEventListener('pageshow',onPageShow);
  if(guarded()){lock();setTimeout(verifyReentry,0);}
})(window);
