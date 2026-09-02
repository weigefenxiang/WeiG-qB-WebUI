(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},U=W.util||{};
  var privacyCache=new Map(),pending=new Map();

  function boolValue(value){if(value===true||value===1||value==='1')return true;if(value===false||value===0||value==='0')return false;return null;}
  function metadataUnavailable(torrent){var t=torrent||{},has=boolValue(t.has_metadata);if(has===false)return true;return /metaDL|forcedMetaDL/i.test(String(t.state||''));}
  function directPrivate(torrent){var t=torrent||{},keys=['private','is_private','isPrivate'];if(metadataUnavailable(t))return null;for(var i=0;i<keys.length;i++)if(Object.prototype.hasOwnProperty.call(t,keys[i])){var value=boolValue(t[keys[i]]);if(value!==null)return value;}return null;}
  function normalizeRules(rules){return (Array.isArray(rules)?rules:[]).map(function(rule){return String(rule||'').trim().toLowerCase().replace(/^\.+|\.+$/g,'');}).filter(Boolean);}
  function trackerHost(raw){var normalized=U.normalizeTracker?U.normalizeTracker(raw):String(raw||'').trim();if(!normalized)return '';try{return new URL(normalized).hostname.toLowerCase().replace(/^\.+|\.+$/g,'');}catch(_e){return '';}}
  function isPt(torrent,rules){var host=trackerHost((torrent||{}).tracker),list=normalizeRules(rules);if(!host||!list.length)return false;return list.some(function(rule){return host===rule||host.endsWith('.'+rule);});}
  function hashOf(torrent){return String((torrent||{}).hash||(torrent||{}).id||'').trim();}
  function pseudoKind(url){var value=String(url||'');if(/\[\s*DHT\s*\]/i.test(value))return'dht';if(/\[\s*PeX\s*\]/i.test(value))return'pex';if(/\[\s*LSD\s*\]/i.test(value))return'lsd';return'';}
  function legacyTrackerEvidence(trackers){var sticky={};(Array.isArray(trackers)?trackers:[]).forEach(function(row){var kind=pseudoKind(row&&row.url);if(kind)sticky[kind]=row||{};});var kinds=['dht','pex','lsd'];if(!kinds.every(function(kind){return !!sticky[kind];}))return{known:false,private:false,source:'legacy-trackers-incomplete'};var messages=kinds.map(function(kind){return String(sticky[kind].msg||'').trim();});if(messages.every(Boolean)&&new Set(messages).size===1)return{known:true,private:true,source:'legacy-trackers'};if(messages.every(function(message){return !message;}))return{known:true,private:false,source:'legacy-trackers'};return{known:false,private:false,source:'legacy-trackers-ambiguous'};}
  function cachedEvidence(torrent){var hash=hashOf(torrent);return hash&&privacyCache.has(hash)?privacyCache.get(hash):null;}
  function evidence(torrent){if(metadataUnavailable(torrent))return{known:false,private:false,source:'metadata-pending'};var direct=directPrivate(torrent);if(direct!==null)return{known:true,private:direct,source:'metadata'};return cachedEvidence(torrent)||{known:false,private:false,source:'unknown'};}
  function classify(torrent,rules){var e=evidence(torrent),pt=isPt(torrent,rules),kind=e.private?(pt?'PRIVATE_PT':'PRIVATE'):(pt?'PT':(e.known?'PUBLIC':'UNKNOWN'));return{kind:kind,private:e.private,privateKnown:e.known,pt:pt,source:e.source};}
  function isPrivate(torrent){return evidence(torrent).private===true;}
  function isPrivateKnown(torrent){return evidence(torrent).known===true;}
  function isPrivateOrPt(torrent,rules){var c=classify(torrent,rules);return c.private||c.pt;}

  async function resolveOne(client,torrent){var direct=directPrivate(torrent),hash=hashOf(torrent);if(metadataUnavailable(torrent))return{known:false,private:false,source:'metadata-pending'};if(direct!==null){var metadata={known:true,private:direct,source:'metadata'};if(hash)privacyCache.set(hash,metadata);return metadata;}if(!hash||!client||typeof client.trackers!=='function')return evidence(torrent);if(privacyCache.has(hash))return privacyCache.get(hash);if(pending.has(hash))return pending.get(hash);var task=Promise.resolve().then(function(){return client.trackers(hash);}).then(function(rows){var result=legacyTrackerEvidence(rows);if(result.known)privacyCache.set(hash,result);return result;}).catch(function(){return{known:false,private:false,source:'legacy-trackers-error'};}).finally(function(){pending.delete(hash);});pending.set(hash,task);return task;}
  async function resolveMany(client,torrents,options){options=options||{};var concurrency=Math.max(1,Math.min(8,Number(options.concurrency)||4)),items=(Array.isArray(torrents)?torrents:[]).filter(function(t){return !metadataUnavailable(t)&&directPrivate(t)===null&&!cachedEvidence(t)&&hashOf(t);}),cursor=0;async function worker(){while(cursor<items.length){var item=items[cursor++];await resolveOne(client,item);}}var workers=[];for(var i=0;i<Math.min(concurrency,items.length);i++)workers.push(worker());await Promise.all(workers);return (Array.isArray(torrents)?torrents:[]).map(function(t){return classify(t,options.rules);});}
  function clear(hash){if(hash){privacyCache.delete(String(hash));pending.delete(String(hash));}else{privacyCache.clear();pending.clear();}}

  W.TorrentSemantics={classify:classify,evidence:evidence,isPrivate:isPrivate,isPrivateKnown:isPrivateKnown,isPt:isPt,isPrivateOrPt:isPrivateOrPt,resolve:resolveOne,resolveMany:resolveMany,legacyTrackerEvidence:legacyTrackerEvidence,metadataUnavailable:metadataUnavailable,trackerHost:trackerHost,normalizeRules:normalizeRules,clear:clear};
})(window);
