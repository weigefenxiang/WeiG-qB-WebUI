(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},store=W.StorageRuntime&&W.StorageRuntime.local;
  if(W.InstanceHealth)return;
  var KEY=W.StorageKeys&&W.StorageKeys.instanceProbeInterval||'weig.instances.probeMinutes';
  var lastRun=0,inFlight=null,started=false,results=new Map(),tick=null;
  function parseMinutes(raw){if(raw===null||raw===undefined||String(raw).trim()==='')return null;var n=Number(raw);return Number.isInteger(n)&&(n===0||n>=5&&n<=1440)?n:null;}
  function minutes(){var value=store&&store.get(KEY,'30'),parsed=parseMinutes(value);return parsed===null?30:parsed;}
  function setMinutes(value){
    var n=parseMinutes(value);if(n===null)throw new Error('Check interval must be 5–1440 minutes or disabled.');
    if(!store||!store.set(KEY,String(n)))throw new Error('Browser settings storage is unavailable.');
    global.dispatchEvent(new CustomEvent('weig:instance-interval',{detail:{minutes:n}}));return n;
  }
  function emit(){global.dispatchEvent(new CustomEvent('weig:instance-health'));}
  function same(a,b){try{return new URL(a).href===new URL(b).href;}catch(_e){return false;}}
  function current(){return W.InstanceRegistry&&W.InstanceRegistry.currentUrl?W.InstanceRegistry.currentUrl():global.location.origin+'/';}
  function get(url){
    var row=results.get(String(url||''));if(!row)return null;
    var ttl=Math.max(5,minutes()||30)*2*60000;
    return Date.now()-row.checkedAt<=ttl?Object.assign({},row):null;
  }
  async function remoteGet(url,endpoint){
    var api=new URL('api/v2/'+endpoint,url),controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},5000);
    try{return await fetch(api.href,{method:'GET',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store',signal:controller.signal});}
    finally{clearTimeout(timeout);}
  }
  function numericCount(text){var s=String(text||'').trim(),n=Number(s);return /^\d+$/.test(s)&&Number.isSafeInteger(n)&&n>=0?n:null;}
  async function inspect(url){
    var checkedAt=Date.now(),row={status:'unverified',count:null,checkedAt:checkedAt};
    if(same(url,current())){
      var client=W.AppState&&W.AppState.client;
      if(client&&client.qbVersion&&client.qbVersion!=='0'){
        row.status='online';
        try{if(typeof client.torrentCount==='function')row.count=numericCount(await client.torrentCount());}catch(_error){}
      }
      return row;
    }
    try{
      // A different Origin cannot inherit qB's SID. Never request with credentials/include.
      var version=await remoteGet(url,'app/version');
      if(version.status===401||version.status===403){row.status='denied';return row;}
      if(!version.ok){row.status='unverified';return row;}
      var text=String(await version.text()).trim();
      if(!text||text.length>100){row.status='unverified';return row;}
      row.status='online';
      try{var count=await remoteGet(url,'torrents/count');if(count.ok)row.count=numericCount(await count.text());}catch(_error){}
    }catch(_error){
      // CORS, Private Network Access, mixed content, unavailable host and timeout are
      // indistinguishable in many browsers; do not claim 'offline'.
      row.status='unverified';
    }
    return row;
  }
  async function checkNow(){
    if(inFlight)return inFlight;
    var registry=W.InstanceRegistry,items=[];
    try{items=registry&&registry.list(true)||[];}catch(_error){emit();return false;}
    var url=current();
    if(!items.some(function(x){return x.url===url}))items.unshift({url:url,name:'Current qBittorrent'});
    lastRun=Date.now();
    var cursor=0;
    inFlight=(async function(){
      await Promise.all(Array.from({length:Math.min(2,items.length)},async function(){
        while(cursor<items.length){
          var item=items[cursor++],value=await inspect(item.url);
          results.set(item.url,value);emit();
        }
      }));
      return true;
    })();
    try{return await inFlight;}finally{inFlight=null;}
  }
  function due(){return minutes()>0&&(!lastRun||Date.now()-lastRun>=minutes()*60000);}
  function tickIfDue(){if(document.visibilityState!=='hidden'&&due())checkNow().catch(function(){emit();});}
  function start(){
    if(started)return;started=true;
    tick=setInterval(tickIfDue,60000);
    global.addEventListener('visibilitychange',tickIfDue);
    var session=W.SessionController;
    if(session&&session.ready)session.ready().then(function(ok){if(ok)tickIfDue();}).catch(function(){});
    else tickIfDue();
  }
  W.InstanceHealth=Object.freeze({minutes:minutes,setMinutes:setMinutes,get:get,checkNow:checkNow,start:start});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
