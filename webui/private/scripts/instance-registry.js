(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  if(W.InstanceRegistry)return;
  var KEY='weig.instances.v1',LIMIT=16,store=W.StorageRuntime&&W.StorageRuntime.local;

  function currentUrl(){
    var url=new URL(global.location.href);
    url.search='';url.hash='';
    url.pathname=url.pathname.replace(/(?:public|private)\/(?:index\.html)?$/,'');
    if(!url.pathname.endsWith('/'))url.pathname+='/';
    return url;
  }
  function canonicalUrl(value){
    var source=String(value||'').trim(),url;
    if(!source||source.length>2048)throw new Error('Instance URL is missing or too long.');
    try{url=new URL(source);}catch(_error){throw new Error('Use a complete http(s) instance URL.');}
    if(url.protocol!=='https:'&&url.protocol!=='http:')throw new Error('Only HTTP(S) instances are supported.');
    if(url.username||url.password||url.search||url.hash)throw new Error('Instance URLs must not contain credentials, query strings or fragments.');
    if(/\/api\/v2(?:\/|$)/i.test(url.pathname))throw new Error('Use the WebUI root, not an API endpoint.');
    url.pathname=url.pathname.replace(/(?:public|private)\/(?:index\.html)?$/,'');
    if(!url.pathname.endsWith('/'))url.pathname+='/';
    var current=currentUrl();
    if(current.protocol==='https:'&&url.protocol!=='https:')throw new Error('Refusing a downgrade from HTTPS to HTTP.');
    if(url.hostname===current.hostname&&url.origin!==current.origin)throw new Error('Instances on different ports of one hostname may share qB cookies; use distinct hostnames.');
    if(url.origin===current.origin&&url.pathname!==current.pathname)throw new Error('Same-origin instances with different paths require a verified session-isolating gateway.');
    return url.href;
  }
  function load(){
    var parsed;
    try{parsed=JSON.parse(store&&store.get(KEY,null)||'null');}catch(_error){return[];}
    if(!parsed||parsed.schemaVersion!==1||!Array.isArray(parsed.items))return[];
    var seen=new Set();
    return parsed.items.slice(0,LIMIT).filter(function(x){
      if(!x||typeof x.name!=='string'||typeof x.url!=='string')return false;
      try{var url=canonicalUrl(x.url);if(seen.has(url))return false;seen.add(url);return true;}catch(_error){return false;}
    }).map(function(x){return{name:x.name.slice(0,48),url:canonicalUrl(x.url)};});
  }
  function write(items){
    if(!store||!store.set(KEY,JSON.stringify({schemaVersion:1,items:items})))throw new Error('Browser instance storage is unavailable.');
  }
  function add(name,url){
    name=String(name||'').trim().slice(0,48);
    if(!name)throw new Error('Instance name is required.');
    url=canonicalUrl(url);
    var items=load(),idx=items.findIndex(function(x){return x.url===url;});
    if(idx>=0)items[idx]={name:name,url:url};
    else{if(items.length>=LIMIT)throw new Error('Instance list is full.');items.push({name:name,url:url});}
    write(items);
    return{name:name,url:url};
  }
  function remove(url){
    var canonical=canonicalUrl(url),items=load(),next=items.filter(function(x){return x.url!==canonical;});
    if(next.length!==items.length)write(next);
    return next.length!==items.length;
  }
  function switchTo(url){
    var canonical=canonicalUrl(url),record=load().find(function(x){return x.url===canonical;});
    if(!record)throw new Error('Choose a registered instance.');
    if(canonical!==currentUrl().href)global.location.assign(canonical);
    return true;
  }
  W.InstanceRegistry=Object.freeze({
    schemaVersion:1,currentUrl:function(){return currentUrl().href;},
    list:load,add:add,remove:remove,switchTo:switchTo
  });
})(window);
