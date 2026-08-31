(function(global){
  'use strict';
  var W=global.WeiG, U=W.util;
  function ApiError(message,status,path){this.name='ApiError';this.message=message;this.status=status||0;this.path=path||'';}ApiError.prototype=Object.create(Error.prototype);
  function versionParts(v){return String(v||'0').replace(/^v/i,'').split('.').map(function(x){return parseInt(x,10)||0;});}
  function atLeast(actual,required){var a=versionParts(actual),b=versionParts(required),n=Math.max(a.length,b.length);for(var i=0;i<n;i++){var av=a[i]||0,bv=b[i]||0;if(av>bv)return true;if(av<bv)return false;}return true;}
  function localeText(en,zh){return W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN'?zh:en;}
  function normalizeTorrentAddResult(result){
    if(result===null||result===undefined)return 'Ok.';
    var data=result,text='';
    if(typeof result==='string'){
      text=result.trim();
      if(!text)return 'Ok.';
      if(text==='Ok.'||text==='Fails.')return text;
      try{data=JSON.parse(text);}catch(_e){return text;}
    }
    if(data&&typeof data==='object'){
      var hasCounts=('success_count' in data)||('pending_count' in data)||('failure_count' in data);
      if(hasCounts){
        var accepted=(Number(data.success_count)||0)+(Number(data.pending_count)||0);
        if(accepted>0)return 'Ok.';
        try{return JSON.stringify(data);}catch(_e2){return localeText('qBittorrent did not accept the torrent.','qBittorrent 未接受该种子。');}
      }
      try{return JSON.stringify(data);}catch(_e3){return String(data);}
    }
    return String(result);
  }
  function normalizeLogItems(items){return (Array.isArray(items)?items:[]).map(function(item){var x=Object.assign({},item),ts=Number(x.timestamp);if(Number.isFinite(ts)&&ts>=1e12)x.timestamp=Math.floor(ts/1000);return x;});}
  function Client(){this.qbVersion='0.0.0';this.webApiVersion='0.0.0';this.major=0;this.capabilities={};}
  Client.prototype.request=async function(path,options){options=options||{};var init={method:options.method||'GET',credentials:'same-origin',headers:options.headers||{}};if(options.form){init.headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';init.body=U.form(options.form);}else if(options.json!==undefined){init.headers['Content-Type']='application/json; charset=UTF-8';init.body=JSON.stringify(options.json);}else if(options.body){init.body=options.body;}var res=await fetch('api/v2/'+path.replace(/^\//,''),init);if(res.status===403){throw new ApiError(localeText('Session expired. Please sign in again.','会话已失效，请重新登录。'),403,path);}if(!res.ok){var txt='';try{txt=await res.text();}catch(_e){}throw new ApiError(txt||('HTTP '+res.status),res.status,path);}if(options.type==='text')return res.text();if(options.type==='blob')return res.blob();if(options.type==='void')return null;var text=await res.text();if(!text)return null;try{return JSON.parse(text);}catch(e){throw new ApiError(localeText('The API returned data that could not be parsed.','API 返回了无法解析的数据。'),res.status,path);}};
  Client.prototype.detect=async function(){var results=await Promise.all([this.request('app/version',{type:'text'}),this.request('app/webapiVersion',{type:'text'}).catch(function(){return '2.0';})]);this.qbVersion=(results[0]||'0').trim();this.webApiVersion=(results[1]||'0').trim();this.major=versionParts(this.qbVersion)[0]||0;var v=this.webApiVersion;this.capabilities={legacy4:this.major===4,modern5:this.major>=5,certified:(this.major===4||this.major===5),rss:atLeast(v,'2.1.0'),search:atLeast(v,'2.1.1'),trackerEdit:atLeast(v,'2.2.0'),rssRefresh:atLeast(v,'2.2.1'),tags:atLeast(v,'2.3.0'),peerBan:atLeast(v,'2.3.0'),buildInfo:atLeast(v,'2.3.0'),renameFile:atLeast(v,'2.4.0'),stalledFilter:atLeast(v,'2.4.1'),contentPath:atLeast(v,'2.6.1'),addTags:atLeast(v,'2.6.2'),renameFolder:atLeast(v,'2.8.0'),fileIndexes:atLeast(v,'2.8.2'),tagFilter:atLeast(v,'2.8.3'),privateFlag:this.major>=5,logs:atLeast(this.qbVersion,'4.1.0'),globalSpeedLimits:true,altSpeedLimits:true,mainData:true,sessionStats:true,torrentCreator:this.major>=5&&atLeast(v,'2.11.0'),cookies:atLeast(v,'2.11.3'),trackerEditUrl:atLeast(v,'2.13.0'),structuredTorrentAdd:atLeast(v,'2.14.0'),webseeds:true,categories:true,preferences:true};if(this.qbVersion.replace(/^v/i,'')==='4.3.3')this.capabilities.renameFolder=true;return this;};
  Client.prototype.getTorrents=function(opts){opts=opts||{};var q=new URLSearchParams(),self=this;['filter','category','tag','sort','reverse','limit','offset','hashes'].forEach(function(k){if(opts[k]===undefined||opts[k]===null||opts[k]==='')return;var value=opts[k];if(k==='filter'&&value==='paused'&&self.major>=5)value='stopped';if(k==='filter'&&value==='stopped'&&self.major===4)value='paused';q.set(k,String(value));});return this.request('torrents/info?'+q.toString());};
  Client.prototype.getTransferInfo=function(){return this.request('transfer/info');};
  Client.prototype.getMainData=function(rid){return this.request('sync/maindata?rid='+(rid==null?0:encodeURIComponent(rid)));};
  Client.prototype.getAltSpeedMode=async function(){var v=await this.request('transfer/speedLimitsMode',{type:'text'});return String(v).trim()==='1';};
  Client.prototype.toggleAltSpeedMode=function(){return this.request('transfer/toggleSpeedLimitsMode',{method:'POST',type:'void'});};
  Client.prototype.getGlobalDownloadLimit=async function(){var v=await this.request('transfer/downloadLimit',{type:'text'});return Number(String(v).trim())||0;};
  Client.prototype.setGlobalDownloadLimit=function(limit){return this.request('transfer/setDownloadLimit',{method:'POST',form:{limit:Math.max(0,Math.round(Number(limit)||0))},type:'void'});};
  Client.prototype.getGlobalUploadLimit=async function(){var v=await this.request('transfer/uploadLimit',{type:'text'});return Number(String(v).trim())||0;};
  Client.prototype.setGlobalUploadLimit=function(limit){return this.request('transfer/setUploadLimit',{method:'POST',form:{limit:Math.max(0,Math.round(Number(limit)||0))},type:'void'});};
  Client.prototype.getPreferences=function(){return this.request('app/preferences');};
  Client.prototype.setPreferences=function(prefs){return this.request('app/setPreferences',{method:'POST',form:{json:JSON.stringify(prefs||{})},type:'void'});};
  Client.prototype.getBuildInfo=function(){return this.request('app/buildInfo');};
  Client.prototype.getCookies=function(){return this.request('app/cookies');};
  Client.prototype.setCookies=function(cookies){return this.request('app/setCookies',{method:'POST',json:Array.isArray(cookies)?cookies:[],type:'void'});};
  Client.prototype.torrentCreatorAdd=function(params){return this.request('torrentcreator/addTask',{method:'POST',form:params||{}});};
  Client.prototype.torrentCreatorStatus=function(taskID){return this.request('torrentcreator/status'+(taskID?'?taskID='+encodeURIComponent(taskID):''));};
  Client.prototype.torrentCreatorDelete=function(taskID){return this.request('torrentcreator/deleteTask',{method:'POST',form:{taskID:taskID},type:'void'});};
  Client.prototype.torrentCreatorFile=function(taskID){return this.request('torrentcreator/torrentFile?taskID='+encodeURIComponent(taskID),{type:'blob'});};
  Client.prototype._torrentAction=async function(hashes,legacy,modern){var preferred=this.major>=5?modern:legacy,fallback=this.major>=5?legacy:modern;try{return await this.request('torrents/'+preferred,{method:'POST',form:{hashes:hashes},type:'void'});}catch(e){if(e.status!==404&&e.status!==405)throw e;return this.request('torrents/'+fallback,{method:'POST',form:{hashes:hashes},type:'void'});}};
  Client.prototype.resume=function(hashes){return this._torrentAction(hashes,'resume','start');};
  Client.prototype.pause=function(hashes){return this._torrentAction(hashes,'pause','stop');};
  Client.prototype.delete=function(hashes,deleteFiles){return this.request('torrents/delete',{method:'POST',form:{hashes:hashes,deleteFiles:!!deleteFiles},type:'void'});};
  Client.prototype.recheck=function(hashes){return this.request('torrents/recheck',{method:'POST',form:{hashes:hashes},type:'void'});};
  Client.prototype.reannounce=function(hashes){return this.request('torrents/reannounce',{method:'POST',form:{hashes:hashes},type:'void'});};
  Client.prototype.forceStart=function(hashes,value){return this.request('torrents/setForceStart',{method:'POST',form:{hashes:hashes,value:!!value},type:'void'});};
  Client.prototype.setAutoManagement=function(hashes,enable){return this.request('torrents/setAutoManagement',{method:'POST',form:{hashes:hashes,enable:!!enable},type:'void'});};
  Client.prototype.toggleSequential=function(hashes){return this.request('torrents/toggleSequentialDownload',{method:'POST',form:{hashes:hashes},type:'void'});};
  Client.prototype.toggleFirstLast=function(hashes){return this.request('torrents/toggleFirstLastPiecePrio',{method:'POST',form:{hashes:hashes},type:'void'});};
  Client.prototype.topPriority=function(hashes){return this.request('torrents/topPrio',{method:'POST',form:{hashes:hashes},type:'void'});};
  Client.prototype.bottomPriority=function(hashes){return this.request('torrents/bottomPrio',{method:'POST',form:{hashes:hashes},type:'void'});};
  Client.prototype.setLocation=function(hashes,location){return this.request('torrents/setLocation',{method:'POST',form:{hashes:hashes,location:location},type:'void'});};
  Client.prototype.setCategory=function(hashes,category){return this.request('torrents/setCategory',{method:'POST',form:{hashes:hashes,category:category},type:'void'});};
  Client.prototype.addTags=function(hashes,tags){return this.request('torrents/addTags',{method:'POST',form:{hashes:hashes,tags:tags},type:'void'});};
  Client.prototype.removeTags=function(hashes,tags){return this.request('torrents/removeTags',{method:'POST',form:{hashes:hashes,tags:tags},type:'void'});};
  Client.prototype.renameTorrent=function(hash,name){return this.request('torrents/rename',{method:'POST',form:{hash:hash,name:name},type:'void'});};
  Client.prototype.setDownloadLimit=function(hashes,limit){return this.request('torrents/setDownloadLimit',{method:'POST',form:{hashes:hashes,limit:limit},type:'void'});};
  Client.prototype.setUploadLimit=function(hashes,limit){return this.request('torrents/setUploadLimit',{method:'POST',form:{hashes:hashes,limit:limit},type:'void'});};
  Client.prototype.add=async function(urls,files,savepath,extra){var fd=new FormData();if(urls&&urls.trim())fd.append('urls',urls.trim());if(savepath&&savepath.trim())fd.append('savepath',savepath.trim());Object.keys(extra||{}).forEach(function(k){if(extra[k]!==''&&extra[k]!=null)fd.append(k,String(extra[k]));});Array.from(files||[]).forEach(function(file){fd.append('torrents',file,file.name);});var result=await this.request('torrents/add',{method:'POST',body:fd,type:'text'});return normalizeTorrentAddResult(result);};
  Client.prototype.properties=function(hash){return this.request('torrents/properties?hash='+encodeURIComponent(hash));};
  Client.prototype.files=function(hash){return this.request('torrents/files?hash='+encodeURIComponent(hash));};
  Client.prototype.setFilePriority=function(hash,ids,priority){return this.request('torrents/filePrio',{method:'POST',form:{hash:hash,id:ids,priority:priority},type:'void'});};
  Client.prototype.trackers=function(hash){return this.request('torrents/trackers?hash='+encodeURIComponent(hash));};
  Client.prototype.addTrackers=function(hash,urls){return this.request('torrents/addTrackers',{method:'POST',form:{hash:hash,urls:urls},type:'void'});};
  Client.prototype.removeTrackers=function(hash,urls){return this.request('torrents/removeTrackers',{method:'POST',form:{hash:hash,urls:urls},type:'void'});};
  Client.prototype.editTracker=function(hash,origUrl,newUrl){var form={hash:hash,newUrl:newUrl};if(this.capabilities.trackerEditUrl===true||atLeast(this.webApiVersion,'2.13.0'))form.url=origUrl;else form.origUrl=origUrl;return this.request('torrents/editTracker',{method:'POST',form:form,type:'void'});};
  Client.prototype.webseeds=function(hash){return this.request('torrents/webseeds?hash='+encodeURIComponent(hash));};
  Client.prototype.peers=async function(hash){var data=await this.request('sync/torrentPeers?rid=0&hash='+encodeURIComponent(hash));var peers=data&&data.peers||{};return Object.keys(peers).map(function(k){var p=peers[k]||{};p.__key=k;return p;});};
  Client.prototype.banPeers=function(peers){return this.request('transfer/banPeers',{method:'POST',form:{peers:peers},type:'void'});};
  Client.prototype.categories=function(){return this.request('torrents/categories');};
  Client.prototype.tags=function(){return this.request('torrents/tags');};
  Client.prototype.createCategory=function(category,savePath){return this.request('torrents/createCategory',{method:'POST',form:{category:category,savePath:savePath||''},type:'void'});};
  Client.prototype.removeCategories=function(categories){return this.request('torrents/removeCategories',{method:'POST',form:{categories:categories},type:'void'});};
  Client.prototype.createTags=function(tags){return this.request('torrents/createTags',{method:'POST',form:{tags:tags},type:'void'});};
  Client.prototype.deleteTags=function(tags){return this.request('torrents/deleteTags',{method:'POST',form:{tags:tags},type:'void'});};
  Client.prototype.logs=async function(lastId){var q='normal=true&info=true&warning=true&critical=true&last_known_id='+(lastId==null?-1:lastId);return normalizeLogItems(await this.request('log/main?'+q));};
  Client.prototype.peerLogs=async function(lastId){return normalizeLogItems(await this.request('log/peers?last_known_id='+(lastId==null?-1:lastId)));};
  Client.prototype.rssItems=function(withData){return this.request('rss/items?withData='+(withData?'true':'false'));};
  Client.prototype.rssAddFeed=function(url,path){return this.request('rss/addFeed',{method:'POST',form:{url:url,path:path||''},type:'void'});};
  Client.prototype.rssRemoveItem=function(path){return this.request('rss/removeItem',{method:'POST',form:{path:path},type:'void'});};
  Client.prototype.rssRefreshItem=function(itemPath){return this.request('rss/refreshItem',{method:'POST',form:{itemPath:itemPath},type:'void'});};
  Client.prototype.rssRules=function(){return this.request('rss/rules');};
  Client.prototype.searchPlugins=function(){return this.request('search/plugins');};
  Client.prototype.searchStart=function(pattern,plugins,category){return this.request('search/start',{method:'POST',form:{pattern:pattern,plugins:plugins||'enabled',category:category||'all'}});};
  Client.prototype.searchStatus=function(id){return this.request('search/status'+(id!=null?'?id='+encodeURIComponent(id):''));};
  Client.prototype.searchResults=function(id,limit,offset){return this.request('search/results?id='+encodeURIComponent(id)+'&limit='+(limit||50)+'&offset='+(offset||0));};
  Client.prototype.searchStop=function(id){return this.request('search/stop',{method:'POST',form:{id:id},type:'void'});};
  Client.prototype.logout=function(){return this.request('auth/logout',{method:'POST',type:'void'});};
  W.ApiError=ApiError;W.QBClient=Client;W.versionAtLeast=atLeast;
})(window);
