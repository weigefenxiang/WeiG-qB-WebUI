(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},catalog=null,loadTask=null,current=null;
  function asset(path){return W.buildAssetUrl?W.buildAssetUrl(path):path;}
  function version(value){return String(value||'0').replace(/^v/i,'').split(/[+-]/)[0];}
  function parts(value){return version(value).split('.').map(function(x){var n=parseInt(x,10);return Number.isFinite(n)?n:0;});}
  function compare(a,b){var x=parts(a),y=parts(b),n=Math.max(x.length,y.length);for(var i=0;i<n;i++){var d=(x[i]||0)-(y[i]||0);if(d)return d>0?1:-1;}return 0;}
  function major(value){return parts(value)[0]||0;}
  function unique(values){var out=[];(values||[]).forEach(function(value){value=String(value||'');if(value&&out.indexOf(value)<0)out.push(value);});return out;}
  function canonicalFilter(name){name=String(name||'all');if(name==='paused')return'stopped';if(name==='resumed')return'running';return name;}
  function fallback(qb,webApi){var m=major(qb),filters=m>=5?['all','downloading','seeding','completed','stopped','running','active','inactive','errored']:['all','downloading','seeding','completed','paused','resumed','active','inactive','errored'];return{qbVersion:version(qb),webApiVersion:version(webApi),officialWeiGSupport:false,protocolGeneration:m>=5?'qb5':'qb4',apiActions:[],torrentFilters:filters,torrentInfoParameters:[],preferenceDescriptors:[],fallback:true};}
  function load(){if(loadTask)return loadTask;loadTask=fetch(asset('data/qb-releases.json'),{credentials:'same-origin',cache:'no-store'}).then(function(res){if(!res.ok)throw new Error('Release profile catalog HTTP '+res.status);return res.json();}).then(function(value){catalog=Array.isArray(value)?value:[];return catalog;}).catch(function(){catalog=[];return catalog;});return loadTask;}
  function exact(qb){var target=version(qb);return (catalog||[]).find(function(item){return version(item&&item.qbVersion)===target;})||null;}
  async function bind(client){await load();var qb=client&&client.qbVersion||'0',api=client&&client.webApiVersion||'0';current=exact(qb)||fallback(qb,api);try{global.dispatchEvent(new CustomEvent('weigg:release-profile',{detail:{profile:current,certified:isCertified()}}));}catch(_e){}return current;}
  function filters(){return unique((current&&current.torrentFilters)||[]);}
  function torrentFilters(){return unique(filters().map(canonicalFilter));}
  function upstreamTorrentFilter(name){name=String(name||'all');var list=filters();if(list.indexOf(name)>=0)return name;if(name==='stopped'&&list.indexOf('paused')>=0)return'paused';if(name==='running'&&list.indexOf('resumed')>=0)return'resumed';return null;}
  function supportsTorrentFilter(name){return upstreamTorrentFilter(name)!==null;}
  function hasAction(action){return !!(current&&!current.fallback&&Array.isArray(current.apiActions)&&current.apiActions.indexOf(String(action))>=0);}
  function hasInfoParameter(name){return !!(current&&!current.fallback&&Array.isArray(current.torrentInfoParameters)&&current.torrentInfoParameters.indexOf(String(name))>=0);}
  function resolveTorrentAction(kind){kind=String(kind||'');if(!current)return null;if(!current.fallback){var choices=kind==='start'?[['torrentscontroller.h:startAction','start'],['torrentscontroller.h:resumeAction','resume']]:kind==='stop'?[['torrentscontroller.h:stopAction','stop'],['torrentscontroller.h:pauseAction','pause']]:[];for(var i=0;i<choices.length;i++)if(hasAction(choices[i][0]))return choices[i][1];return null;}var m=major(current.qbVersion);if(kind==='start')return m>=5?'start':m===4?'resume':null;if(kind==='stop')return m>=5?'stop':m===4?'pause':null;return null;}
  function preferenceDescriptor(key){if(!current||current.fallback||!Array.isArray(current.preferenceDescriptors))return null;return current.preferenceDescriptors.find(function(item){return item&&item.key===key;})||null;}
  function isCertified(){return !!(current&&!current.fallback&&current.officialWeiGSupport!==false);}
  W.ReleaseProfile={load:load,bind:bind,current:function(){return current;},catalog:function(){return catalog||[];},isCertified:isCertified,compareVersions:compare,canonicalTorrentFilter:canonicalFilter,torrentFilters:torrentFilters,upstreamTorrentFilter:upstreamTorrentFilter,supportsTorrentFilter:supportsTorrentFilter,hasAction:hasAction,hasInfoParameter:hasInfoParameter,resolveTorrentAction:resolveTorrentAction,preferenceDescriptor:preferenceDescriptor};
})(window);
