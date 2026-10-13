(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},store=W.StorageRuntime&&W.StorageRuntime.local;
  if(W.InstanceHealth)return;
  var KEY=W.StorageKeys&&W.StorageKeys.instanceProbeInterval||'weig.instances.probeMinutes';
  var HISTORY_KEY=W.StorageKeys&&W.StorageKeys.instanceHealthHistory||'weig.instances.lastVerified.v1',HISTORY_AGE=24*60*60000;
  var lastRun=0,inFlight=null,sharedTask=null,lastSharedRead=0,started=false,results=new Map(),tick=null;
  // This is a timestamp of a verified WebAPI response, not a persistent online state.
  function readHistory(){
    try{
      var raw=store&&store.get(HISTORY_KEY,null);
      if(!raw||raw.length>4096)return new Map();
      var body=JSON.parse(raw);
      if(!body||body.schemaVersion!==1||!Array.isArray(body.items)||body.items.length>16)return new Map();
      var rows=new Map(),now=Date.now();
      body.items.forEach(function(item){
        if(!item||typeof item.url!=='string'||typeof item.at!=='number'||!Number.isFinite(item.at))return;
        if(item.at>now||now-item.at>HISTORY_AGE||!/^https?:\/\//.test(item.url))return;
        rows.set(item.url,item.at);
      });
      return rows;
    }catch(_error){return new Map();}
  }
  var history=readHistory();
  function remember(url,row){
    if(!row||row.status!=='online')return;
    var now=Date.now();
    history.set(String(url),now);
    var valid=Array.from(history.entries()).filter(function(x){return now>=x[1]&&now-x[1]<=HISTORY_AGE;}).slice(-16);
    history=new Map(valid);
    try{if(store)store.set(HISTORY_KEY,JSON.stringify({schemaVersion:1,items:valid.map(function(x){return{url:x[0],at:x[1]};})}));}catch(_e){}
  }
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
  function trustedCurrentCount(){
    // The App's completed unfiltered catalog is already a verified full-torrent
    // snapshot. Reuse it rather than issuing an extra unsupported qB count API.
    var app=W.AppState;
    if(!app)return null;
    if(app.catalogReady===true&&Array.isArray(app.catalog))return Number.isSafeInteger(app.catalog.length)?app.catalog.length:null;
    var unfiltered=String(app.filter||'all')==='all'&&!app.tracker&&!app.savePath&&!app.category&&!app.tag&&!app.search;
    if(unfiltered&&app.knownTotalFresh===true&&Number.isSafeInteger(app.knownTotal)&&app.knownTotal>=0)return app.knownTotal;
    return null;
  }
  function get(url){
    var key=String(url||''),row=results.get(key),lastVerifiedAt=history.get(key)||null;
    var ttl=Math.max(5,minutes()||30)*2*60000;
    if(row&&(row.source==='shared'?Date.now()<row.expiresAt:Date.now()-row.checkedAt<=ttl)){
      var copy=Object.assign({},row,{lastVerifiedAt:lastVerifiedAt});
      if(copy.status==='online'&&same(key,current())){
        var total=trustedCurrentCount();
        if(total!==null)copy.count=total;
      }
      return copy;
    }
    return lastVerifiedAt?{status:'unverified',count:null,checkedAt:0,lastVerifiedAt:lastVerifiedAt}:null;
  }
  function numericCount(text){var s=String(text==null?'':text).trim(),n=Number(s);return /^\d+$/.test(s)&&Number.isSafeInteger(n)&&n>=0?n:null;}
  function verifiedVersion(value){return /^v?(?:[1-9]\d*)(?:\.\d+){1,3}(?:[-+._][A-Za-z0-9.-]+)?$/i.test(String(value||'').trim());}
  async function inspectCurrent(){
    var checkedAt=Date.now(),row={status:'unverified',count:null,checkedAt:checkedAt};
    var client=W.AppState&&W.AppState.client;
    if(client&&verifiedVersion(client.qbVersion)){
      row.status='online';
      try{if(typeof client.torrentCount==='function')row.count=numericCount(await client.torrentCount());}catch(_error){}
    }
    return row;
  }
  // Same-origin authenticated static snapshot. The host owns all remote WebAPI
  // requests. The browser never sends credentials to another qB origin.
  async function refreshShared(){
    if(sharedTask)return sharedTask;
    lastSharedRead=Date.now();
    sharedTask=(async function(){
      var abort=new AbortController(),timeout=setTimeout(function(){abort.abort();},5000);
      try{
        var response=await fetch(new URL('weig-instance-status.json',current()).href,{
          method:'GET',mode:'same-origin',credentials:'same-origin',redirect:'error',
          cache:'no-store',signal:abort.signal
        });
        if(!response.ok)return false;
        var text=await response.text();
        if(text.length>16384)return false;
        var data=JSON.parse(text),now=Date.now();
        if(!data||data.schemaVersion!==1||!Array.isArray(data.instances)||data.instances.length>16
          ||!Number.isFinite(data.generatedAt)||!Number.isSafeInteger(data.maxAgeMs)
          ||data.maxAgeMs<30000||data.maxAgeMs>300000||data.generatedAt>now+60000
          ||now>=data.generatedAt+data.maxAgeMs)return false;
        var registry=W.InstanceRegistry,known=new Set(registry&&registry.list(true).map(function(x){return x.url;})||[]);
        var pending=[],seen=new Set();
        for(var item of data.instances){
          if(!item||typeof item.url!=='string'||seen.has(item.url)||item.status!=='online'&&item.status!=='unverified'
            ||!Number.isFinite(item.checkedAt)||item.checkedAt>now+60000||item.checkedAt<data.generatedAt-60000
            ||item.checkedAt>data.generatedAt+60000)return false;
          seen.add(item.url);
          if(item.count!==null&&(!Number.isSafeInteger(item.count)||item.count<0))return false;
          if(item.status!=='online'&&item.count!==null)return false;
          if(!known.has(item.url)||same(item.url,current()))continue;
          pending.push({url:item.url,row:{status:item.status,count:item.count,checkedAt:item.checkedAt,
            source:'shared',expiresAt:data.generatedAt+data.maxAgeMs}});
        }
        pending.forEach(function(entry){results.set(entry.url,entry.row);remember(entry.url,entry.row);});
        emit();
        return true;
      }catch(_error){return false;}
      finally{clearTimeout(timeout);emit();}
    })();
    try{return await sharedTask;}finally{sharedTask=null;}
  }
  async function checkNow(){
    if(inFlight)return inFlight;
    lastRun=Date.now();
    inFlight=(async function(){
      await Promise.all([
        inspectCurrent().then(function(row){var url=current();results.set(url,row);remember(url,row);emit();}),
        refreshShared()
      ]);
      return true;
    })();
    try{return await inFlight;}finally{inFlight=null;}
  }
  function due(){return minutes()>0&&(!lastRun||Date.now()-lastRun>=minutes()*60000);}
  function tickIfDue(){
    if(document.visibilityState==='hidden'||minutes()===0)return;
    if(due())checkNow().catch(function(){emit();});
    else if(Date.now()-lastSharedRead>=30000)refreshShared().catch(function(){emit();});
  }
  function start(){
    if(started)return;started=true;
    tick=setInterval(tickIfDue,30000);
    global.addEventListener('visibilitychange',tickIfDue);
    // Session readiness predates app.detect(); reconcile when WebAPI identity is real.
    global.addEventListener('weig:app-ready',function(){
      // App authentication becomes authoritative after early deferred loading.
      var url=current();
      inspectCurrent().then(function(row){results.set(url,row);remember(url,row);emit();}).catch(function(){emit();});
    });
    var session=W.SessionController;
    if(session&&session.ready)session.ready().then(function(ok){if(ok)tickIfDue();}).catch(function(){});
    else tickIfDue();
  }
  W.InstanceHealth=Object.freeze({minutes:minutes,setMinutes:setMinutes,get:get,checkNow:checkNow,start:start});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
