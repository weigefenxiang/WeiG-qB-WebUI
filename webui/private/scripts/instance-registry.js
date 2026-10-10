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
  function assertIsolated(items,url){
    var target=new URL(url);
    (items||[]).forEach(function(item){
      if(!item||item.url===url)return;
      var other=new URL(item.url);
      if(target.hostname===other.hostname&&target.origin!==other.origin)throw new Error('Instances on different ports of one hostname may share qB cookies; use distinct hostnames.');
      if(target.origin===other.origin&&target.pathname!==other.pathname)throw new Error('Same-origin instances with different paths require a verified session-isolating gateway.');
    });
  }
  function load(){
    var parsed;
    try{parsed=JSON.parse(store&&store.get(KEY,null)||'null');}catch(_error){return[];}
    if(!parsed||parsed.schemaVersion!==1||!Array.isArray(parsed.items))return[];
    var seen=new Set(),next=[];
    parsed.items.slice(0,LIMIT).forEach(function(x){
      if(!x||typeof x.name!=='string'||typeof x.url!=='string')return;
      var name=x.name.trim().slice(0,48);
      if(!name)return;
      try{
        var url=canonicalUrl(x.url);
        if(seen.has(url))return;
        assertIsolated(next,url);
        seen.add(url);next.push({name:name,url:url});
      }catch(_error){}
    });
    return next;
  }
  function write(items){
    if(!store||!store.set(KEY,JSON.stringify({schemaVersion:1,items:items})))throw new Error('Browser instance storage is unavailable.');
  }
  function add(name,url){
    name=String(name||'').trim().slice(0,48);
    if(!name)throw new Error('Instance name is required.');
    url=canonicalUrl(url);
    var items=load();assertIsolated(items,url);var idx=items.findIndex(function(x){return x.url===url;});
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
  function exportList(){return JSON.stringify({schemaVersion:1,items:load()});}
  function importList(text){
    if(typeof text!=='string'||text.length>32768)throw new Error('Instance list exceeds the safe import limit.');
    var input;
    try{input=JSON.parse(text);}catch(_error){throw new Error('Instance list must be valid JSON.');}
    if(!input||Array.isArray(input)||typeof input!=='object'||input.schemaVersion!==1||!Array.isArray(input.items)||input.items.length>LIMIT||Object.keys(input).some(function(key){return key!=='schemaVersion'&&key!=='items';}))throw new Error('Unsupported instance list schema.');
    var next=load(),seen=new Set(),added=0,updated=0;
    input.items.forEach(function(row){
      if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(function(key){return key!=='name'&&key!=='url';})||typeof row.name!=='string'||typeof row.url!=='string')throw new Error('Instance list contains unsupported fields.');
      var name=row.name.trim();
      if(!name||name.length>48)throw new Error('Instance name is missing or too long.');
      var url=canonicalUrl(row.url);
      if(seen.has(url))throw new Error('Instance list contains duplicate addresses.');
      seen.add(url);
      assertIsolated(next,url);
      var index=next.findIndex(function(item){return item.url===url;});
      if(index>=0){next[index]={name:name,url:url};updated++;}
      else{if(next.length>=LIMIT)throw new Error('Instance list exceeds the maximum saved entries.');next.push({name:name,url:url});added++;}
    });
    if(!input.items.length)return{added:0,updated:0,total:next.length};
    write(next);
    return{added:added,updated:updated,total:next.length};
  }
  function switchTo(url){
    var canonical=canonicalUrl(url),record=load().find(function(x){return x.url===canonical;});
    if(!record)throw new Error('Choose a registered instance.');
    if(canonical!==currentUrl().href)global.location.assign(canonical);
    return true;
  }
  W.InstanceRegistry=Object.freeze({
    schemaVersion:1,currentUrl:function(){return currentUrl().href;},
    list:load,add:add,remove:remove,exportList:exportList,importList:importList,switchTo:switchTo
  });
})(window);
