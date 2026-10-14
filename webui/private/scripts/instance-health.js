(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},store=W.StorageRuntime&&W.StorageRuntime.local;
  if(W.InstanceHealth)return;
  // A76-47: one owner for same-origin live status and bounded historical reports.
  // Foreign reports are untrusted URL-fragment data, NEVER evidence of current online.
  var KEY='weig.instances.reports.v1',AGE=24*60*60000,LIMIT=16;
  var live=null,started=false,reports=new Map();
  function current(){return W.InstanceRegistry&&W.InstanceRegistry.currentUrl?W.InstanceRegistry.currentUrl():global.location.origin+'/';}
  function emit(){global.dispatchEvent(new CustomEvent('weig:instance-health'));}
  function validAddress(url){
    try{var u=new URL(url);return u.href===url&&(u.protocol==='https:'||u.protocol==='http:')&&!u.username&&!u.password&&!u.search&&!u.hash&&!/\/api\/v2(?:\/|$)/i.test(u.pathname);}
    catch(_e){return false;}
  }
  function validReport(x,now){
    return x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')==='at,count,url'
      &&typeof x.url==='string'&&validAddress(x.url)
      &&Number.isSafeInteger(x.count)&&x.count>=0
      &&Number.isSafeInteger(x.at)&&x.at<=now+60000&&now-x.at>=0&&now-x.at<=AGE;
  }
  function readReports(){
    try{
      var raw=store&&store.get(KEY,null);if(!raw||raw.length>4096)return;
      var obj=JSON.parse(raw);if(!obj||obj.schemaVersion!==1||!Array.isArray(obj.items)||obj.items.length>LIMIT)return;
      var now=Date.now();
      obj.items.forEach(function(x){if(validReport(x,now))reports.set(x.url,{url:x.url,count:x.count,at:x.at});});
    }catch(_e){}
  }
  readReports();
  function saveReports(){
    var now=Date.now(),items=Array.from(reports.values()).filter(function(x){return validReport(x,now);})
      .sort(function(a,b){return b.at-a.at;}).slice(0,LIMIT);
    reports=new Map(items.map(function(x){return[x.url,x];}));
    try{if(store)store.set(KEY,JSON.stringify({schemaVersion:1,items:items}));}catch(_e){}
  }
  function merge(row,known){
    var now=Date.now();
    if(!validReport(row,now)||known&&(!known.has(row.url)||row.url===current()))return false;
    var old=reports.get(row.url);
    if(old&&old.at>=row.at)return false;
    reports.set(row.url,{url:row.url,count:row.count,at:row.at});
    return true;
  }
  function knownUrls(){
    var R=W.InstanceRegistry,saved=R&&R.list?R.list(true):[];
    return new Set([current()].concat(saved.map(function(x){return x.url;})));
  }
  function importReports(items){
    if(!Array.isArray(items)||items.length>LIMIT)return 0;
    var known=knownUrls(),changed=0;
    items.forEach(function(row){if(merge(row,known))changed++;});
    if(changed){saveReports();emit();}
    return changed;
  }
  function verifiedVersion(v){return /^v?[1-9]\d*(?:\.\d+){1,3}(?:[-+._][A-Za-z0-9.-]+)?$/i.test(String(v||'').trim());}
  function numericCount(value){
    var s=String(value==null?'':value).trim(),n=Number(s);
    return /^\d+$/.test(s)&&Number.isSafeInteger(n)&&n>=0?n:null;
  }
  function trustedCurrentCount(){
    var a=W.AppState;if(!a)return null;
    if(a.catalogReady===true&&Array.isArray(a.catalog))return a.catalog.length;
    var all=String(a.filter||'all')==='all'&&!a.tracker&&!a.savePath&&!a.category&&!a.tag&&!a.search;
    return all&&a.knownTotalFresh===true&&Number.isSafeInteger(a.knownTotal)&&a.knownTotal>=0?a.knownTotal:null;
  }
  function snapshotCurrent(){
    var a=W.AppState,client=a&&a.client;
    if(!client||!verifiedVersion(client.qbVersion))return null;
    var now=Date.now(),count=trustedCurrentCount();
    if(count===null&&live&&live.status==='online'&&now-live.checkedAt<5*60000)count=live.count;
    if(count!==null&&(!Number.isSafeInteger(count)||count<0))count=null;
    live={status:'online',count:count,checkedAt:now};
    if(count!==null)merge({url:current(),count:count,at:now});
    return live;
  }
  async function checkNow(){
    var row=snapshotCurrent();
    if(row&&row.count===null){
      try{
        var client=W.AppState.client;
        if(typeof client.torrentCount==='function'){
          var value=numericCount(await client.torrentCount());
          if(value!==null){row.count=value;merge({url:current(),count:value,at:Date.now()});}
        }
      }catch(_e){}
    }
    if(row&&row.count!==null)saveReports();
    emit();
    return !!row;
  }
  function get(url){
    var key=String(url||''),now=Date.now(),report=reports.get(key);
    if(key===current()&&live&&now-live.checkedAt<=5*60000){
      var count=trustedCurrentCount();
      return{status:live.status,count:count===null?live.count:count,checkedAt:live.checkedAt};
    }
    if(report&&validReport(report,now))
      return{status:'unverified',count:null,reportedCount:report.count,reportedAt:report.at};
    return{status:'unverified',count:null};
  }
  function exportReports(){
    snapshotCurrent();
    saveReports();
    return Array.from(reports.values()).sort(function(a,b){return b.at-a.at;}).slice(0,LIMIT)
      .map(function(x){return{url:x.url,count:x.count,at:x.at};});
  }
  function start(){
    if(started)return;started=true;
    global.addEventListener('weig:app-ready',function(){checkNow().catch(function(){emit();});});
    global.addEventListener('weig:library-state',function(){
      var previous=live&&live.count;
      var row=snapshotCurrent();
      if(row&&row.count!==null&&(row.count!==previous||!previous)){saveReports();}
      emit();
    });
    if(W.AppState&&W.AppState.initialized)checkNow().catch(function(){emit();});
  }
  W.InstanceHealth=Object.freeze({get:get,checkNow:checkNow,exportReports:exportReports,importReports:importReports,start:start});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
