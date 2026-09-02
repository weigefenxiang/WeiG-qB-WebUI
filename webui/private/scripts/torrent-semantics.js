(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},U=W.util||{};

  function isTrue(value){return value===true||value===1||value==='1';}
  function normalizeRules(rules){return (Array.isArray(rules)?rules:[]).map(function(rule){return String(rule||'').trim().toLowerCase().replace(/^\.+|\.+$/g,'');}).filter(Boolean);}
  function trackerHost(raw){
    var normalized=U.normalizeTracker?U.normalizeTracker(raw):String(raw||'').trim();
    if(!normalized)return '';
    try{return new URL(normalized).hostname.toLowerCase().replace(/^\.+|\.+$/g,'');}catch(_e){return '';}
  }
  function isPrivate(torrent){
    var t=torrent||{};
    return isTrue(t.private)||isTrue(t.isPrivate)||isTrue(t.is_private);
  }
  function isPt(torrent,rules){
    var host=trackerHost((torrent||{}).tracker),list=normalizeRules(rules);
    if(!host||!list.length)return false;
    return list.some(function(rule){return host===rule||host.endsWith('.'+rule);});
  }
  function isPrivateOrPt(torrent,rules){return isPrivate(torrent)||isPt(torrent,rules);}

  W.TorrentSemantics={
    isPrivate:isPrivate,
    isPt:isPt,
    isPrivateOrPt:isPrivateOrPt,
    trackerHost:trackerHost,
    normalizeRules:normalizeRules
  };
})(window);
