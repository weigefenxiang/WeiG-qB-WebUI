(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},K=W.StorageKeys||{};
  var HANDOFF=K.loginHandshake||'weig.loginHandshake',FAILURE=K.loginFailure||'weig.loginFailure',LOGOUT_GUARD=K.logoutGuard||'weig.logoutGuard',PROBE='api/v2/app/preferences',HANDOFF_PARAM=K.handoffParam||'__weig_handoff',AUTH_FAILURE_PARAM=K.authFailureParam||'__weig_auth_failure',MAX_HANDOFF_AGE=120000;
  function loginKind(status,text){status=Number(status)||0;text=String(text||'').trim();if(status===204||(status>=200&&status<300&&text==='Ok.'))return'accepted';if(status===401||(status>=200&&status<300&&text==='Fails.'))return'credentials-rejected';if(status===403)return'login-blocked';if(status===0)return'offline';if(status<200||status>=300)return'login-rejected';return'unexpected-login-response';}
  function probeKind(status){status=Number(status)||0;if(status>=200&&status<300)return'authenticated';if(status===403)return'session-missing';if(status===401)return'request-rejected';if(status===0)return'offline';return'unexpected-probe-response';}
  async function probe(){try{var response=await fetch(PROBE,{credentials:'same-origin',cache:'no-store'});return{ok:response.ok,status:response.status,kind:probeKind(response.status)};}catch(error){return{ok:false,status:0,kind:'offline',error:error};}}
  function write(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));return true;}catch(_e){return false;}}
  function read(key,remove){try{var raw=sessionStorage.getItem(key);if(!raw)return null;var value=JSON.parse(raw);if(remove)sessionStorage.removeItem(key);return value&&typeof value==='object'?value:null;}catch(_e){return null;}}
  function baseUrl(){try{var script=document.currentScript&&document.currentScript.src;var url=new URL(script||global.location.href,global.location.href);url.hash='';url.search='';url.pathname=url.pathname.replace(/[^/]*$/,'');return url;}catch(_e){return new URL('./',global.location.href);}}
  var BASE=baseUrl();
  function nonce(){try{if(global.crypto&&typeof global.crypto.randomUUID==='function')return global.crypto.randomUUID();}catch(_e){}try{if(global.crypto&&typeof global.crypto.getRandomValues==='function'){var bytes=new Uint32Array(4);global.crypto.getRandomValues(bytes);return Array.prototype.map.call(bytes,function(v){return v.toString(16);}).join('-');}}catch(_e){}return String(Date.now())+'-'+Math.random().toString(36).slice(2);}
  function cleanHandoff(value){if(!value||value.schemaVersion!==2||value.preNavigationProbe!=='PASS'||!value.nonce||!value.targetPath)return null;var age=Date.now()-(Number(value.createdAt)||0);return(age>=-5000&&age<=MAX_HANDOFF_AGE)?value:null;}
  function handoff(){var value=cleanHandoff(read(HANDOFF,false));if(value)return value;clearHandoff();return null;}
  function pendingHandoff(){return !!handoff();}
  function clearHandoff(){try{sessionStorage.removeItem(HANDOFF);}catch(_e){}}
  function authenticatedEntryUrl(record){var url=new URL('index.html',BASE);if(record&&record.nonce)url.searchParams.set(HANDOFF_PARAM,record.nonce);return url;}
  function publicEntryUrl(){return new URL('login.html',BASE);}
  function setLogoutGuard(){try{sessionStorage.setItem(LOGOUT_GUARD,String(Date.now()));return true;}catch(_e){return false;}}
  function clearLogoutGuard(){try{sessionStorage.removeItem(LOGOUT_GUARD);}catch(_e){}}
  function logoutGuarded(){try{return !!sessionStorage.getItem(LOGOUT_GUARD);}catch(_e){return false;}}
  function completePublicEntry(){clearLogoutGuard();return true;}
  function navigatePublic(){global.location.replace(publicEntryUrl().href);return true;}
  function beginAuthenticatedHandoff(){var target=authenticatedEntryUrl(),record={schemaVersion:2,preNavigationProbe:'PASS',nonce:nonce(),sourcePath:String(global.location.pathname||''),targetPath:target.pathname,createdAt:Date.now()};target=authenticatedEntryUrl(record);if(!write(HANDOFF,record))return false;clearLogoutGuard();global.location.replace(target.href);return true;}
  function matchesAuthenticatedEntry(record){record=cleanHandoff(record||handoff());if(!record)return false;try{var current=new URL(global.location.href);if(current.pathname!==record.targetPath)return false;var token=current.searchParams.get(HANDOFF_PARAM);return !token||token===record.nonce;}catch(_e){return false;}}
  function completeHandoff(){var record=handoff();clearHandoff();if(!record)return null;try{var current=new URL(global.location.href),token=current.searchParams.get(HANDOFF_PARAM);if(token===record.nonce){current.searchParams.delete(HANDOFF_PARAM);global.history.replaceState(global.history.state,'',current.href);}}catch(_e){}return record;}
  function navigatePublicFailure(){var url=publicEntryUrl();url.searchParams.set(AUTH_FAILURE_PARAM,'1');global.location.replace(url.href);}
  function recordFailure(kind,status,stage){return write(FAILURE,{schemaVersion:1,kind:String(kind||'unknown'),status:Number(status)||0,stage:String(stage||''),createdAt:Date.now()});}
  function consumeFailure(){return read(FAILURE,true);}
  W.SessionContract={probeEndpoint:PROBE,loginKind:loginKind,probeKind:probeKind,probe:probe,handoff:handoff,pendingHandoff:pendingHandoff,clearHandoff:clearHandoff,authenticatedEntryUrl:authenticatedEntryUrl,publicEntryUrl:publicEntryUrl,setLogoutGuard:setLogoutGuard,clearLogoutGuard:clearLogoutGuard,logoutGuarded:logoutGuarded,completePublicEntry:completePublicEntry,navigatePublic:navigatePublic,beginAuthenticatedHandoff:beginAuthenticatedHandoff,matchesAuthenticatedEntry:matchesAuthenticatedEntry,completeHandoff:completeHandoff,navigatePublicFailure:navigatePublicFailure,recordFailure:recordFailure,consumeFailure:consumeFailure};
})(window);
