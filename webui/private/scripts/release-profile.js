(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},catalog=null,loadTask=null,current=null,profileTasks={},profileCache={};
  function asset(path){return W.buildAssetUrl?W.buildAssetUrl(path):path;}
  function rawVersion(value){return String(value||'0').trim().replace(/^v/i,'');}
  function version(value){return rawVersion(value).split(/[+-]/)[0];}
  function parts(value){return version(value).split('.').map(function(x){var n=parseInt(x,10);return Number.isFinite(n)?n:0;});}
  function compare(a,b){var x=parts(a),y=parts(b),n=Math.max(x.length,y.length);for(var i=0;i<n;i++){var d=(x[i]||0)-(y[i]||0);if(d)return d>0?1:-1;}return 0;}
  function major(value){return parts(value)[0]||0;}
  function sameSeries(a,b){var x=parts(a),y=parts(b);return (x[0]||0)===(y[0]||0)&&(x[1]||0)===(y[1]||0);}
  function unique(values){var out=[];(values||[]).forEach(function(value){value=String(value||'');if(value&&out.indexOf(value)<0)out.push(value);});return out;}
  function canonicalFilter(name){name=String(name||'all');if(name==='paused')return'stopped';if(name==='resumed')return'running';return name;}
  function resolution(profile,qb,mode){var detected=rawVersion(qb),resolved=version(profile&&profile.qbVersion);return Object.assign({},profile,{detectedQbVersion:detected,resolvedFrom:resolved,resolutionMode:mode,inherited:mode==='INHERITED',equivalent:mode==='EQUIVALENT',fallback:false});}
  function fallback(qb,webApi){var detected=rawVersion(qb),m=major(qb),filters=m>=5?['all','downloading','seeding','completed','stopped','running','active','inactive','errored']:['all','downloading','seeding','completed','paused','resumed','active','inactive','errored'];return{qbVersion:version(qb),detectedQbVersion:detected,resolvedFrom:null,resolutionMode:'FALLBACK',inherited:false,equivalent:false,webApiVersion:version(webApi),officialWeiGSupport:false,protocolGeneration:m>=5?'qb5':'qb4',apiActions:[],apiActionParameters:{},torrentFilters:filters,torrentInfoParameters:[],torrentInfoFields:[],torrentStates:[],torrentPropertiesFields:[],torrentTrackerFields:[],torrentFileFields:[],torrentWebSeedFields:[],preferenceDescriptors:[],fallback:true};}
  function fetchJson(path,label){return fetch(asset(path),{credentials:'same-origin',cache:'no-store'}).then(function(res){if(!res.ok)throw new Error(label+' HTTP '+res.status);return res.json();});}
  function load(){if(loadTask)return loadTask;loadTask=fetchJson('data/qb-releases.json','Release profile index').then(function(value){if(!Array.isArray(value)||!value.length)throw new Error('Release profile index is empty or invalid.');catalog=value;return catalog;}).catch(function(error){catalog=null;try{console.error('[WeiG] release profile index failed',error);}catch(_e){}throw error;});return loadTask;}
  function profilePath(item){var path=String(item&&item.profilePath||'');if(path)return /^data\//.test(path)?path:'data/'+path;var sha=String(item&&item.sourceSha||'');if(/^[0-9a-f]{40}$/.test(sha))return'data/qb-release-profiles/'+sha+'.json';return'';}
  function loadProfile(item){var key=String(item&&item.sourceSha||item&&item.qbVersion||'');if(!key)return Promise.reject(new Error('Release profile index entry has no source identity.'));if(profileCache[key])return Promise.resolve(profileCache[key]);if(profileTasks[key])return profileTasks[key];var path=profilePath(item);if(!path)return Promise.reject(new Error('Release profile '+String(item&&item.qbVersion||'unknown')+' has no shard path.'));profileTasks[key]=fetchJson(path,'Release profile '+String(item.qbVersion||key)).then(function(profile){if(!profile||Array.isArray(profile)||typeof profile!=='object')throw new Error('Release profile '+String(item.qbVersion||key)+' shard is invalid.');if(version(profile.qbVersion)!==version(item.qbVersion))throw new Error('Release profile shard version mismatch for '+String(item.qbVersion||key)+'.');if(item.sourceSha&&String(profile.sourceSha||'')!==String(item.sourceSha))throw new Error('Release profile shard source SHA mismatch for '+String(item.qbVersion||key)+'.');profileCache[key]=profile;return profile;}).finally(function(){delete profileTasks[key];});return profileTasks[key];}
  function exactIndex(qb){var target=version(qb);return (catalog||[]).find(function(item){return version(item&&item.qbVersion)===target;})||null;}
  function inheritedIndex(qb,webApi){var target=version(qb),api=version(webApi),candidates=(catalog||[]).filter(function(item){return item&&item.officialWeiGSupport!==false&&sameSeries(item.qbVersion,target)&&compare(item.qbVersion,target)<=0;}).sort(function(a,b){return compare(b.qbVersion,a.qbVersion);});var base=candidates[0]||null;if(!base)return null;if(api&&api!=='0'&&base.webApiVersion&&compare(api,base.webApiVersion)<0)return null;return base;}
  async function bind(client){await load();var qb=client&&client.qbVersion||'0',api=client&&client.webApiVersion||'0',hit=exactIndex(qb),profile=null,mode='FALLBACK';if(hit){profile=await loadProfile(hit);mode=rawVersion(qb)===version(hit.qbVersion)?'EXACT':'EQUIVALENT';}else{var inheritedHit=inheritedIndex(qb,api);if(inheritedHit){profile=await loadProfile(inheritedHit);mode='INHERITED';}}current=profile?resolution(profile,qb,mode):fallback(qb,api);try{global.dispatchEvent(new CustomEvent('weigg:release-profile',{detail:{profile:current,certified:isCertified(),resolutionMode:current&&current.resolutionMode||'FALLBACK'}}));}catch(_e){}return current;}
  function filters(){return unique((current&&current.torrentFilters)||[]);}
  function torrentFilters(){return unique(filters().map(canonicalFilter));}
  function upstreamTorrentFilter(name){name=String(name||'all');var list=filters();if(list.indexOf(name)>=0)return name;if(name==='stopped'&&list.indexOf('paused')>=0)return'paused';if(name==='running'&&list.indexOf('resumed')>=0)return'resumed';return null;}
  function supportsTorrentFilter(name){return upstreamTorrentFilter(name)!==null;}
  function hasAction(action){return !!(current&&!current.fallback&&Array.isArray(current.apiActions)&&current.apiActions.indexOf(String(action))>=0);}
  function actionParameters(action){var key=String(action||''),map=current&&!current.fallback&&current.apiActionParameters;if(!map||typeof map!=='object'||!map[key])return null;var item=map[key]||{};return{parameters:unique(item.parameters||[]),required:unique(item.required||[]),optional:unique(item.optional||[])};}
  function actionDescriptor(action){var key=String(action||'');if(!hasAction(key))return null;var name=(key.split(':')[1]||'').replace(/Action$/,''),params=actionParameters(key)||{parameters:[],required:[],optional:[]};return{sourceAction:key,endpoint:name,parameters:params.parameters,required:params.required,optional:params.optional};}
  function hasInfoParameter(name){return !!(current&&!current.fallback&&Array.isArray(current.torrentInfoParameters)&&current.torrentInfoParameters.indexOf(String(name))>=0);}
  function torrentInfoFields(){return unique((current&&!current.fallback&&current.torrentInfoFields)||[]);}
  function hasTorrentInfoField(name){return torrentInfoFields().indexOf(String(name))>=0;}
  function torrentStates(){return unique((current&&!current.fallback&&current.torrentStates)||[]);}
  function detailFields(surface){var map={properties:'torrentPropertiesFields',trackers:'torrentTrackerFields',files:'torrentFileFields',webseeds:'torrentWebSeedFields'},key=map[String(surface||'')];if(!key)return[];return unique((current&&!current.fallback&&current[key])||[]);}
  function hasTorrentDetailField(surface,name){return detailFields(surface).indexOf(String(name))>=0;}
  function torrentPropertiesFields(){return detailFields('properties');}
  function torrentTrackerFields(){return detailFields('trackers');}
  function torrentFileFields(){return detailFields('files');}
  function torrentWebSeedFields(){return detailFields('webseeds');}
  function actionChoices(kind){var map={
    start:[['torrentscontroller.h:startAction','start'],['torrentscontroller.h:resumeAction','resume']],
    stop:[['torrentscontroller.h:stopAction','stop'],['torrentscontroller.h:pauseAction','pause']],
    delete:[['torrentscontroller.h:deleteAction','delete']],
    force:[['torrentscontroller.h:setForceStartAction','setForceStart']],
    recheck:[['torrentscontroller.h:recheckAction','recheck']],
    reannounce:[['torrentscontroller.h:reannounceAction','reannounce']],
    sequential:[['torrentscontroller.h:toggleSequentialDownloadAction','toggleSequentialDownload']],
    firstlast:[['torrentscontroller.h:toggleFirstLastPiecePrioAction','toggleFirstLastPiecePrio']],
    autotmm:[['torrentscontroller.h:setAutoManagementAction','setAutoManagement']],
    top:[['torrentscontroller.h:topPrioAction','topPrio']],
    bottom:[['torrentscontroller.h:bottomPrioAction','bottomPrio']],
    rename:[['torrentscontroller.h:renameAction','rename']],
    location:[['torrentscontroller.h:setLocationAction','setLocation']],
    category:[['torrentscontroller.h:setCategoryAction','setCategory']],
    tags:[['torrentscontroller.h:addTagsAction','addTags']],
    dllimit:[['torrentscontroller.h:setDownloadLimitAction','setDownloadLimit']],
    uplimit:[['torrentscontroller.h:setUploadLimitAction','setUploadLimit']],
    addTrackers:[['torrentscontroller.h:addTrackersAction','addTrackers']],
    removeTrackers:[['torrentscontroller.h:removeTrackersAction','removeTrackers']],
    editTracker:[['torrentscontroller.h:editTrackerAction','editTracker']]
  };return map[String(kind||'')]||[];}
  function resolveTorrentActionDescriptor(kind){kind=String(kind||'');if(!current)return null;var choices=actionChoices(kind);if(!current.fallback){for(var i=0;i<choices.length;i++){var desc=actionDescriptor(choices[i][0]);if(desc){desc.endpoint=choices[i][1];desc.kind=kind;return desc;}}return null;}var m=major(current.qbVersion);if(kind==='start'&&m===4)return{kind:kind,sourceAction:null,endpoint:'resume',parameters:['hashes'],required:['hashes'],optional:[],fallback:true};if(kind==='start'&&m>=5)return{kind:kind,sourceAction:null,endpoint:'start',parameters:['hashes'],required:['hashes'],optional:[],fallback:true};if(kind==='stop'&&m===4)return{kind:kind,sourceAction:null,endpoint:'pause',parameters:['hashes'],required:['hashes'],optional:[],fallback:true};if(kind==='stop'&&m>=5)return{kind:kind,sourceAction:null,endpoint:'stop',parameters:['hashes'],required:['hashes'],optional:[],fallback:true};return null;}
  function resolveTorrentAction(kind){var desc=resolveTorrentActionDescriptor(kind);return desc&&desc.endpoint||null;}
  function supportsTorrentAction(kind){return !!resolveTorrentActionDescriptor(kind);}
  function preferenceDescriptor(key){if(!current||current.fallback||!Array.isArray(current.preferenceDescriptors))return null;return current.preferenceDescriptors.find(function(item){return item&&item.key===key;})||null;}
  function isCertified(){return !!(current&&!current.fallback&&current.officialWeiGSupport!==false&&(current.resolutionMode==='EXACT'||current.resolutionMode==='EQUIVALENT'));}
  function resolutionInfo(){return current?{detectedQbVersion:current.detectedQbVersion||current.qbVersion,resolvedFrom:current.resolvedFrom||null,mode:current.resolutionMode||'FALLBACK',inherited:current.inherited===true,equivalent:current.equivalent===true,certified:isCertified()}:null;}
  W.ReleaseProfile={load:load,bind:bind,current:function(){return current;},catalog:function(){return catalog||[];},isCertified:isCertified,resolutionInfo:resolutionInfo,compareVersions:compare,canonicalTorrentFilter:canonicalFilter,torrentFilters:torrentFilters,upstreamTorrentFilter:upstreamTorrentFilter,supportsTorrentFilter:supportsTorrentFilter,hasAction:hasAction,actionParameters:actionParameters,actionDescriptor:actionDescriptor,hasInfoParameter:hasInfoParameter,torrentInfoFields:torrentInfoFields,hasTorrentInfoField:hasTorrentInfoField,torrentStates:torrentStates,detailFields:detailFields,hasTorrentDetailField:hasTorrentDetailField,torrentPropertiesFields:torrentPropertiesFields,torrentTrackerFields:torrentTrackerFields,torrentFileFields:torrentFileFields,torrentWebSeedFields:torrentWebSeedFields,resolveTorrentAction:resolveTorrentAction,resolveTorrentActionDescriptor:resolveTorrentActionDescriptor,supportsTorrentAction:supportsTorrentAction,preferenceDescriptor:preferenceDescriptor};
})(window);