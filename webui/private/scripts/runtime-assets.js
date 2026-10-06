(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  if(W.RuntimeAssets)return;
  var SCHEMA=1,DB_NAME='weig-runtime-assets',STORE='assets',memory=new Map(),inflight=new Map(),dbTask=null,upstreamAssetBuilder=typeof W.buildAssetUrl==='function'?W.buildAssetUrl:null;
  function buildId(){var meta=global.document&&document.querySelector&&document.querySelector('meta[name="weig-build-sha"]'),value=meta&&meta.getAttribute('content');value=String(value||'dev').trim()||'dev';return value;}
  var BUILD=buildId();
  function namespace(options){return String(options&&options.namespace||'runtime').trim()||'runtime';}
  function identity(options){return String(options&&options.identity||'global').trim()||'global';}
  function cacheKey(path,options){return[SCHEMA,BUILD,namespace(options),identity(options),String(path||'')].join('\u0001');}
  function assetUrl(path){if(upstreamAssetBuilder)return upstreamAssetBuilder(path);var url=new URL(String(path||''),global.location.href);if(BUILD&&BUILD.indexOf('__WEIG_')!==0)url.searchParams.set('v',BUILD);return url.href;}
  function openDb(){if(dbTask)return dbTask;if(!global.indexedDB)return Promise.resolve(null);dbTask=new Promise(function(resolve){var request;try{request=global.indexedDB.open(DB_NAME,SCHEMA);}catch(_e){resolve(null);return;}request.onupgradeneeded=function(){var db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};request.onsuccess=function(){resolve(request.result);};request.onerror=function(){resolve(null);};request.onblocked=function(){resolve(null);};});return dbTask;}
  function transaction(mode,run){return openDb().then(function(db){if(!db)return null;return new Promise(function(resolve){var tx,store,req;try{tx=db.transaction(STORE,mode);store=tx.objectStore(STORE);req=run(store);}catch(_e){resolve(null);return;}if(!req){resolve(null);return;}req.onsuccess=function(){resolve(req.result===undefined?null:req.result);};req.onerror=function(){resolve(null);};});});}
  function readStored(key){return transaction('readonly',function(store){return store.get(key);});}
  function writeStored(record){return transaction('readwrite',function(store){return store.put(record);});}
  function deleteStored(key){return transaction('readwrite',function(store){return store.delete(key);});}
  function fetchText(path){return global.fetch(assetUrl(path),{credentials:'same-origin',cache:'no-store'}).then(function(res){if(!res.ok)throw new Error('Runtime asset '+path+' HTTP '+res.status);return res.text();});}
  function readText(path,options){path=String(path||'');var key=cacheKey(path,options);if(memory.has(key))return Promise.resolve(memory.get(key));if(inflight.has(key))return inflight.get(key);var task=readStored(key).then(function(record){if(record&&record.schemaVersion===SCHEMA&&record.build===BUILD&&typeof record.value==='string'){memory.set(key,record.value);return record.value;}return fetchText(path).then(function(value){memory.set(key,value);writeStored({key:key,schemaVersion:SCHEMA,build:BUILD,namespace:namespace(options),identity:identity(options),path:path,value:value,savedAt:Date.now()});return value;});}).finally(function(){inflight.delete(key);});inflight.set(key,task);return task;}
  function readJson(path,options){return readText(path,options).then(function(text){try{return JSON.parse(text);}catch(error){throw new Error('Runtime asset '+path+' JSON parse failed: '+error.message);}});}
  function invalidate(path,options){var key=cacheKey(path,options);memory.delete(key);inflight.delete(key);return deleteStored(key);}
  function clearMemory(){memory.clear();inflight.clear();}
  W.buildAssetUrl=W.buildAssetUrl||assetUrl;
  W.RuntimeAssets=Object.freeze({schemaVersion:SCHEMA,build:BUILD,url:assetUrl,key:cacheKey,readText:readText,readJson:readJson,invalidate:invalidate,clearMemory:clearMemory});
})(window);
