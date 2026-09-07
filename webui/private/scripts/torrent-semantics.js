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
  function isPrivate(torrent){return evidence(torrent).private===true;}function isPrivateKnown(torrent){return evidence(torrent).known===true;}function isPrivateOrPt(torrent,rules){var c=classify(torrent,rules);return c.private||c.pt;}
  function canonicalFilter(name){name=String(name||'all');if(name==='paused')return'stopped';if(name==='resumed')return'running';return name;}function stoppedState(state){return /^(?:paused|stopped)(?:DL|UP)?$/i.test(String(state||''));}
  function matchesStatus(torrent,filter,rules){var t=torrent||{},f=canonicalFilter(filter),state=String(t.state||''),progress=Number(t.progress)||0,rate=(Number(t.dlspeed)||0)+(Number(t.upspeed)||0);if(f==='all')return true;if(f==='downloading')return /^(?:downloading|stalledDL|forcedDL|metaDL|forcedMetaDL|queuedDL)$/i.test(state)&&progress<1;if(f==='seeding')return /^(?:uploading|stalledUP|forcedUP|queuedUP)$/i.test(state);if(f==='completed')return progress>=1;if(f==='stopped')return stoppedState(state);if(f==='running')return !stoppedState(state);if(f==='active')return rate>0;if(f==='inactive')return rate<=0;if(f==='stalled')return /^(?:stalledDL|stalledUP|stalled_downloading|stalled_uploading)$/i.test(state);if(f==='stalled_uploading')return /^(?:stalledUP|stalled_uploading)$/i.test(state);if(f==='stalled_downloading')return /^(?:stalledDL|stalled_downloading)$/i.test(state);if(f==='checking')return /^checking/i.test(state);if(f==='moving')return /^moving$/i.test(state);if(f==='errored')return /^(?:error|missingFiles)$/i.test(state);if(f==='private')return isPrivateOrPt(t,rules);return false;}
  var derivedOrder=['downloading','seeding','completed','stopped','running','active','inactive','stalled','stalled_uploading','stalled_downloading','checking','moving','errored'];
  var derivedRequirements={
    downloading:{fields:['state','progress'],states:['downloading','stalledDL','forcedDL','metaDL','queuedDL']},
    seeding:{fields:['state'],states:['uploading','stalledUP','forcedUP','queuedUP']},
    completed:{fields:['progress']},
    stopped:{fields:['state'],statePattern:/^(?:paused|stopped)(?:DL|UP)?$/i},
    running:{fields:['state'],statePattern:/^(?:paused|stopped)(?:DL|UP)?$/i},
    active:{fields:['dlspeed','upspeed']},
    inactive:{fields:['dlspeed','upspeed']},
    stalled:{fields:['state'],states:['stalledDL','stalledUP']},
    stalled_uploading:{fields:['state'],states:['stalledUP']},
    stalled_downloading:{fields:['state'],states:['stalledDL']},
    checking:{fields:['state'],statePattern:/^checking/i},
    moving:{fields:['state'],states:['moving']},
    errored:{fields:['state'],states:['error','missingFiles']}
  };
  function sourceProfile(){return W.ReleaseProfile&&W.ReleaseProfile.current?W.ReleaseProfile.current():null;}
  function exactSource(){var p=sourceProfile();return !!(p&&p.fallback!==true);}
  function hasFields(fields){var R=W.ReleaseProfile;if(!R||!R.hasTorrentInfoField)return false;return (fields||[]).every(function(name){return R.hasTorrentInfoField(name);});}
  function sourceStates(){var R=W.ReleaseProfile;return R&&R.torrentStates?R.torrentStates():[];}
  function stateEvidence(req){if(!req)return false;if(!req.states&&!req.statePattern)return true;var states=sourceStates();if(!states.length)return false;if(req.states&&req.states.some(function(name){return states.indexOf(name)>=0;}))return true;if(req.statePattern&&states.some(function(name){return req.statePattern.test(String(name));}))return true;return false;}
  function canDeriveFilter(filter){var f=canonicalFilter(filter),req=derivedRequirements[f];if(f==='all')return true;if(!req||!exactSource()||!hasFields(req.fields))return false;return stateEvidence(req);}
  function filterMode(filter){var f=canonicalFilter(filter),R=W.ReleaseProfile;if(f==='private')return W.CapabilityRegistry&&W.CapabilityRegistry.supports&&W.CapabilityRegistry.supports('privateFilter')?'local':'unavailable';if(R&&R.supportsTorrentFilter&&R.supportsTorrentFilter(f))return'native';if(canDeriveFilter(f))return'local';return'unavailable';}
  function localFilterRequired(filter){return filterMode(filter)==='local';}
  function statusFilters(){var R=W.ReleaseProfile,native=R&&R.torrentFilters?R.torrentFilters():['all','downloading','seeding','completed','stopped','running','active','inactive','errored'],out=(native||[]).map(canonicalFilter);derivedOrder.forEach(function(name){if(canDeriveFilter(name))out.push(name);});return Array.from(new Set(out));}
  function isSupportedFilter(filter){var f=canonicalFilter(filter);if(f==='private')return !!(W.CapabilityRegistry&&W.CapabilityRegistry.supports&&W.CapabilityRegistry.supports('privateFilter'));return filterMode(f)!=='unavailable';}
  W.TorrentSemantics={classify:classify,evidence:evidence,isPrivate:isPrivate,isPrivateKnown:isPrivateKnown,isPt:isPt,isPrivateOrPt:isPrivateOrPt,metadataUnavailable:metadataUnavailable,trackerHost:trackerHost,normalizeRules:normalizeRules,canonicalFilter:canonicalFilter,matchesStatus:matchesStatus,statusFilters:statusFilters,isSupportedFilter:isSupportedFilter,canDeriveFilter:canDeriveFilter,filterMode:filterMode,localFilterRequired:localFilterRequired};
})(window);
