(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},K=W.StorageKeys||{},store=W.StorageRuntime&&W.StorageRuntime.session;
  if(W.InstanceHandoff)return;
  var PREFIX='#!weig-instances=',KEY=K.instanceHandoff||'weig.instances.pending',LIMIT=8192,AGE=10*60*1000;
  var PEER_PREFIX='#!weig-peer=',PEER_KEY='weig.instances.peerInvite.v1';
  // Only public instance names and canonical URLs are transported: never credentials/SID/tokens.
  function publicAddress(raw){
    if(typeof raw!=='string'||!raw||raw.length>2048)return false;
    try{var u=new URL(raw);
      return (u.protocol==='http:'||u.protocol==='https:')&&!u.username&&!u.password&&!u.search&&!u.hash&&!!u.hostname&&!/\/api\/v2(?:\/|$)/i.test(u.pathname);
    }catch(_error){return false;}
  }
  function validate(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||value.schemaVersion!==1
      ||!Array.isArray(value.items)||value.items.length>16||typeof value.source!=='string'
      ||Object.keys(value).some(function(k){return !['schemaVersion','source','items','reports'].includes(k);}))
      throw new Error('Unsupported instance handoff.');
    if(!publicAddress(value.source))throw new Error('Invalid source.');
    value.items.forEach(function(item){
      if(!item||typeof item!=='object'||Array.isArray(item)
         ||Object.keys(item).some(function(k){return k!=='name'&&k!=='url';})
         ||typeof item.name!=='string'||!item.name.trim()||item.name.length>48
         ||typeof item.url!=='string'||!publicAddress(item.url))
        throw new Error('Invalid instance.');
    });
    if(value.reports!==undefined){
      if(!Array.isArray(value.reports)||value.reports.length>16)throw new Error('Invalid report collection.');
      var seen=new Set(),addresses=new Set(value.items.map(function(x){return x.url;})),now=Date.now();
      value.reports.forEach(function(row){
        if(!row||typeof row!=='object'||Array.isArray(row)
          ||Object.keys(row).sort().join(',')!=='at,count,url'
          ||typeof row.url!=='string'||!publicAddress(row.url)||!addresses.has(row.url)
          ||seen.has(row.url)||!Number.isSafeInteger(row.count)||row.count<0
          ||!Number.isSafeInteger(row.at)||row.at>now+60000||row.at<now-24*60*60000)
          throw new Error('Invalid historical report.');
        seen.add(row.url);
      });
    }
    return value;
  }
  function encode(raw){
    var bytes=new TextEncoder().encode(raw),binary='';
    for(var i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function decode(raw){
    if(!/^[A-Za-z0-9_-]+$/.test(raw))throw new Error('Invalid handoff encoding.');
    var binary=atob(raw.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-raw.length%4)%4)),bytes=new Uint8Array(binary.length);
    for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    var json=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    if(json.length>LIMIT)throw new Error('Instance handoff is too large.');
    return validate(JSON.parse(json));
  }
  function urlFor(destination,items,source,reports){
    var url=new URL(destination),value=validate({schemaVersion:1,source:source,items:items,reports:reports||[]});
    var raw=JSON.stringify(value);
    if(raw.length>LIMIT)throw new Error('Instance list is too large to transfer. Export it manually.');
    var fragment=PREFIX.slice(1)+encode(raw);
    if(fragment.length>LIMIT*2)throw new Error('Instance handoff exceeds the URL limit.');
    url.hash=fragment;
    return url.href;
  }
  // Pre-auth public page captures the URL fragment before qB's login handoff changes paths.
  // It is an untrusted, nonsecret proposal, not an authorized registry write.
  function capture(){
    var hash=String(global.location&&global.location.hash||'');
    if(!hash.startsWith(PREFIX))return false;
    var ok=false;
    try{
      if(hash.length>LIMIT*2)throw new Error('Too long');
      var value=decode(hash.slice(PREFIX.length));
      if(store&&store.set(KEY,JSON.stringify({createdAt:Date.now(),proposal:value})))ok=true;
    }catch(_error){}
    try{var clean=new URL(global.location.href);clean.hash='';if(global.history&&global.history.replaceState)global.history.replaceState(global.history.state,'',clean.href);}catch(_error){}
    return ok;
  }
  // The existing pre-auth Handoff owner also preserves a one-time peer
  // invitation across login redirects. It contains only source URL and nonce.
  function validPeer(data){
    return data&&typeof data==='object'&&!Array.isArray(data)&&data.v===1
      &&Object.keys(data).sort().join(',')==='nonce,source,v'
      &&publicAddress(data.source)&&new URL(data.source).href===data.source
      &&typeof data.nonce==='string'&&/^[a-f0-9]{48}$/.test(data.nonce);
  }
  function capturePeer(){
    var hash=String(global.location&&global.location.hash||'');
    if(!hash.startsWith(PEER_PREFIX))return false;
    var ok=false;
    try{
      if(hash.length>1024)throw new Error('Oversized peer invite');
      var data=JSON.parse(decodeURIComponent(hash.slice(PEER_PREFIX.length)));
      if(!validPeer(data))throw new Error('Invalid peer invite');
      if(store&&store.set(PEER_KEY,JSON.stringify({createdAt:Date.now(),value:data})))ok=true;
    }catch(_e){}
    try{var clean=new URL(global.location.href);clean.hash='';
      if(global.history&&global.history.replaceState)global.history.replaceState(global.history.state,'',clean.href);
    }catch(_e){}
    return ok;
  }
  function peekPeer(){
    try{
      var row=JSON.parse(store&&store.get(PEER_KEY,null)||'null'),now=Date.now();
      return row&&Number.isSafeInteger(row.createdAt)&&row.createdAt<=now+60000
        &&now-row.createdAt<=AGE&&validPeer(row.value)?row.value:null;
    }catch(_e){return null;}
  }
  function consumePeer(){if(store)store.remove(PEER_KEY);}
  function peek(){
    try{
      var row=JSON.parse(store&&store.get(KEY,null)||'null');
      if(!row||!Number.isFinite(row.createdAt)||Date.now()-row.createdAt>AGE||row.createdAt>Date.now()+60000)return null;
      return validate(row.proposal);
    }catch(_error){return null;}
  }
  function consume(){if(store)store.remove(KEY);}
  W.InstanceHandoff=Object.freeze({urlFor:urlFor,capture:capture,peek:peek,consume:consume,
    capturePeer:capturePeer,peekPeer:peekPeer,consumePeer:consumePeer});
  capture();capturePeer();
})(window);
