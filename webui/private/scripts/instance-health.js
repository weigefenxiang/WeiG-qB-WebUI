(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},store=W.StorageRuntime&&W.StorageRuntime.local;
  if(W.InstanceHealth)return;
  // A76-47: one owner for same-origin live status and bounded historical reports.
  // Foreign reports are untrusted URL-fragment data, NEVER evidence of current online.
  var KEY='weig.instances.reports.v1',AGE=24*60*60000,LIMIT=16;
  var live=null,started=false,reports=new Map(),peers=new Map(),PEER_TTL=90000;
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
  // Peer evidence is memory-only. Only an authenticated page that passed
  // InstancePeerBridge's nonce+Origin+Window checks may publish it.
  function clearPeer(url){
    if(peers.delete(url)){emit();return true;}
    return false;
  }
  function expirePeers(){
    var now=Date.now(),changed=false;
    peers.forEach(function(row,url){if(now-row.checkedAt>PEER_TTL){peers.delete(url);changed=true;}});
    if(changed)emit();
    return changed;
  }
  function acceptPeer(url,row){
    var now=Date.now(),allowed=knownUrls();
    if(!allowed.has(url)||url===current()||!row||row.status!=='online'
      ||!Number.isSafeInteger(row.checkedAt)||Math.abs(now-row.checkedAt)>60000
      ||!Number.isSafeInteger(row.count)||row.count<0)return false;
    var previous=peers.get(url);
    if(previous&&previous.checkedAt>row.checkedAt)return false;
    // TTL is measured locally at receipt, never from the remote machine's clock.
    peers.set(url,{status:'online',count:row.count,checkedAt:now});
    if(merge({url:url,count:row.count,at:now},allowed))saveReports();
    emit();return true;
  }
  // A live peer report must verify its own qB on the wire, not just replay
  // an initialized page's old catalog or cached detected-version string.
  async function samplePeer(){
    var a=W.AppState,client=a&&a.client,now=Date.now();
    if(!client||typeof client.request!=='function')return{status:'unverified',count:null,checkedAt:now};
    try{
      var version=await client.request('app/version',{type:'text'});
      if(!verifiedVersion(version))throw new Error('No verified current qB');
      // The share contract needs a fresh wire count, not an old catalog fallback.
      if(typeof client.torrentCount!=='function')throw new Error('No verified count endpoint');
      var count=numericCount(await client.torrentCount());
      if(count===null)throw new Error('Invalid current torrent count');
      live={status:'online',count:count,checkedAt:Date.now()};
      if(count!==null&&merge({url:current(),count:count,at:live.checkedAt}))saveReports();
      emit();return{status:'online',count:count,checkedAt:live.checkedAt};
    }catch(_e){
      live=null;emit();
      return{status:'unverified',count:null,checkedAt:Date.now()};
    }
  }
  function get(url){
    var key=String(url||''),now=Date.now(),report=reports.get(key);
    if(key===current()&&live&&now-live.checkedAt<=5*60000){
      var count=trustedCurrentCount();
      return{status:live.status,count:count===null?live.count:count,checkedAt:live.checkedAt};
    }
    var peer=peers.get(key);
    if(peer&&peer.status==='online'&&now-peer.checkedAt<=PEER_TTL)
      return{status:'online',count:peer.count,checkedAt:peer.checkedAt,source:'peer'};
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
      if(row&&row.count!==null&&row.count!==previous)saveReports();
      emit();
    });
    if(W.AppState&&W.AppState.initialized)checkNow().catch(function(){emit();});
  }
  W.InstanceHealth=Object.freeze({get:get,checkNow:checkNow,exportReports:exportReports,importReports:importReports,start:start,
    samplePeer:samplePeer,acceptPeer:acceptPeer,clearPeer:clearPeer,expirePeers:expirePeers});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
