(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},U=W.util||{};

  function boolValue(value){if(value===true||value===1||value==='1')return true;if(value===false||value===0||value==='0')return false;return null;}
  function metadataUnavailable(torrent){var t=torrent||{},has=boolValue(t.has_metadata);if(has===false)return true;return /metaDL|forcedMetaDL/i.test(String(t.state||''));}
  function directPrivate(torrent){var t=torrent||{},keys=['private','is_private','isPrivate'];if(metadataUnavailable(t))return null;for(var i=0;i<keys.length;i++)if(Object.prototype.hasOwnProperty.call(t,keys[i])){var value=boolValue(t[keys[i]]);if(value!==null)return value;}return null;}
  function normalizeRules(rules){return (Array.isArray(rules)?rules:[]).map(function(rule){return String(rule||'').trim().toLowerCase().replace(/^\.+|\.+$/g,'');}).filter(Boolean);}
  function trackerHost(raw){var normalized=U.normalizeTracker?U.normalizeTracker(raw):String(raw||'').trim();if(!normalized)return '';try{return new URL(normalized).hostname.toLowerCase().replace(/^\.+|\.+$/g,'');}catch(_e){return '';}}
  function isPt(torrent,rules){var host=trackerHost((torrent||{}).tracker),list=normalizeRules(rules);if(!host||!list.length)return false;return list.some(function(rule){return host===rule||host.endsWith('.'+rule);});}
  function evidence(torrent){if(metadataUnavailable(torrent))return{known:false,private:false,source:'metadata-pending'};var direct=directPrivate(torrent);if(direct!==null)return{known:true,private:direct,source:'metadata'};return{known:false,private:false,source:'unsupported'};}
  function classify(torrent,rules){var e=evidence(torrent),pt=isPt(torrent,rules),kind=e.private?(pt?'PRIVATE_PT':'PRIVATE'):(pt?'PT':(e.known?'PUBLIC':'UNKNOWN'));return{kind:kind,private:e.private,privateKnown:e.known,pt:pt,source:e.source};}
  function isPrivate(torrent){return evidence(torrent).private===true;}
  function isPrivateKnown(torrent){return evidence(torrent).known===true;}
  function isPrivateOrPt(torrent,rules){var c=classify(torrent,rules);return c.private||c.pt;}

  W.TorrentSemantics={classify:classify,evidence:evidence,isPrivate:isPrivate,isPrivateKnown:isPrivateKnown,isPt:isPt,isPrivateOrPt:isPrivateOrPt,metadataUnavailable:metadataUnavailable,trackerHost:trackerHost,normalizeRules:normalizeRules};
})(window);
