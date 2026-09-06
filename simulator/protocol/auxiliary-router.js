import {atLeast} from '../core/profiles.js';
import {generatedPeers} from '../core/peer-view.js';
import {indexedWebseedList} from '../core/webseed-view.js';
import {filterBannedPeers} from '../core/torrent-actions.js';
import {addVirtualTorrentBatch} from '../core/torrent-add.js';
import {parseSpeedLimitsMode,setVirtualSpeedLimitsMode} from '../core/transfer-controls.js';
import {
  addPeers,addWebSeeds,editWebSeed,exportTorrentPayload,fetchMetadata,getSSLParameters,loadClientData,
  mergeManualPeers,parseMetadata,pieceAvailability,processInfo,removeWebSeeds,saveMetadata,setComment,
  setSSLParameters,setTags,setTorrentPath,storeClientData,torrentCount,torrentLimitMap
} from '../core/torrent-auxiliary.js';
import {
  defaultSavePath,deleteApiKey,directoryContent,networkInterfaceAddresses,networkInterfaces,requestShutdown,
  rotateApiKey,sendTestEmail
} from '../core/app-services.js';
import {
  rssAddFeed,rssAddFolder,rssMarkAsRead,rssMatchingArticles,rssMoveItem,rssSetFeedRefreshInterval,rssSetFeedURL,
  searchDelete,searchDownloadTorrent,searchEnablePlugins,searchInstallPlugins,searchPlugins,searchResults,
  searchStart,searchStatus,searchStop,searchUninstallPlugins,searchUpdatePlugins
} from '../core/virtual-services.js';

function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
function text(value,status=200,type='text/plain; charset=utf-8',headers={}){return new Response(String(value??''),{status,headers:{'content-type':type,'cache-control':'no-store',...headers}});}
function empty(status=200){return new Response([204,205,304].includes(status)?null:'',{status,headers:{'cache-control':'no-store'}});}
function notFound(){return text('Not Found',404);}
function badRequest(message='Bad Request'){return text(message,400);}
function conflict(message="Torrent's metadata has not yet downloaded"){return text(message,409);}
function boolParam(value){return ['1','true','yes','on'].includes(String(value||'').toLowerCase());}
function intParam(value){const n=Number.parseInt(String(value??''),10);return Number.isFinite(n)?n:0;}
async function formObject(request){
  const out={},form=await request.formData();
  for(const [key,value] of form.entries()){
    if(!(key in out))out[key]=value;else if(Array.isArray(out[key]))out[key].push(value);else out[key]=[out[key],value];
  }
  return out;
}
async function formFiles(request){
  const form=await request.formData(),items=[];
  for(const [,value] of form.entries())if(value&&typeof value==='object'&&('size' in value))items.push(value);
  return items;
}
function qbAtLeast(world,minimum){return atLeast(world.profile?.qbVersion||'0',minimum);}
function apiAtLeast(world,minimum){return atLeast(world.profile?.webApiVersion||'0',minimum);}
function exactCatalog(world){return Array.isArray(world.profile?.apiActions);}
function bootstrapAllowed(world,path){
  if(exactCatalog(world))return true;
  if(path==='app/defaultSavePath'||path==='app/shutdown')return qbAtLeast(world,'4.1.0');
  if(['app/sendTestEmail','app/getDirectoryContent','app/networkInterfaceList','app/networkInterfaceAddressList'].includes(path))return qbAtLeast(world,'5.0.0');
  if(['app/rotateAPIKey','app/deleteAPIKey'].includes(path))return apiAtLeast(world,'2.14.1');
  if(path==='app/processInfo')return qbAtLeast(world,'5.2.0')&&apiAtLeast(world,'2.15.1');
  if(path==='transfer/setSpeedLimitsMode')return qbAtLeast(world,'5.0.0');
  if(path==='torrents/count')return qbAtLeast(world,'4.3.0');
  if(['torrents/setSavePath','torrents/setDownloadPath'].includes(path))return qbAtLeast(world,'4.4.0');
  if(path==='torrents/export')return qbAtLeast(world,'4.5.0');
  if(['torrents/pieceAvailability','torrents/addWebSeeds','torrents/editWebSeed','torrents/removeWebSeeds','torrents/setComment','torrents/setTags'].includes(path))return Number(world.profile?.major)>=5;
  if(['torrents/SSLParameters','torrents/setSSLParameters'].includes(path))return qbAtLeast(world,'5.0.0');
  if(['torrents/fetchMetadata','torrents/parseMetadata','torrents/saveMetadata'].includes(path))return qbAtLeast(world,'5.2.0')&&apiAtLeast(world,'2.11.9');
  if(path.startsWith('clientdata/'))return qbAtLeast(world,'5.2.0')&&apiAtLeast(world,'2.13.1');
  if(path.startsWith('rss/'))return apiAtLeast(world,'2.1.0');
  if(path.startsWith('search/'))return apiAtLeast(world,'2.1.1');
  return true;
}

function normalizeParsedMetadataNames(items,parsed,arrayResponse){
  if(arrayResponse){
    for(let i=0;i<parsed.length;i++){
      const name=String(items[i]?.name||'').replace(/\.torrent$/i,'');
      if(name&&parsed[i]?.info)parsed[i].info.name=name;
    }
    return parsed;
  }
  for(const [fileName,metadata] of Object.entries(parsed||{})){
    const name=String(fileName||'').replace(/\.torrent$/i,'');
    if(name&&metadata?.info)metadata.info.name=name;
  }
  return parsed;
}

function searchJobExists(world,id){return !!world.searchJobs?.[Number(id)];}
function activeSearchCount(world){return searchStatus(world,null).filter(item=>item.status==='Running').length;}
function searchResultResponse(world,id,limit,offset){
  if(!searchJobExists(world,id))return notFound();
  const probe=searchResults(world,id,500,0),total=Math.max(0,Number(probe.total)||0);
  let normalizedOffset=intParam(offset),normalizedLimit=intParam(limit);
  if(normalizedOffset>total)return conflict('Offset is out of range');
  if(normalizedOffset<0)normalizedOffset=total+normalizedOffset;
  if(normalizedOffset<0)return conflict('Offset is out of range');
  if(normalizedLimit<=0)normalizedLimit=500;
  return json(searchResults(world,id,normalizedLimit,normalizedOffset));
}

export async function handleAuxiliaryApi(world,request,path,method,url){
  if(!bootstrapAllowed(world,path))return notFound();

  if(path==='transfer/setSpeedLimitsMode'&&method==='POST'){
    const f=await formObject(request);
    if(!Object.prototype.hasOwnProperty.call(f,'mode'))return badRequest("'mode': invalid argument");
    const mode=parseSpeedLimitsMode(f.mode);
    if(mode===null)return badRequest("'mode': invalid argument");
    setVirtualSpeedLimitsMode(world,mode);return empty();
  }
  if(path==='torrents/add'&&method==='POST'){
    const f=await formObject(request),result=addVirtualTorrentBatch(world,f,Date.now());
    if(apiAtLeast(world,'2.14.0'))return json({
      success_count:result.success_count,
      failure_count:result.failure_count,
      pending_count:result.pending_count,
      added_torrent_ids:result.added_torrent_ids
    });
    return text('Ok.');
  }

  if(path==='app/defaultSavePath'&&method==='GET')return text(defaultSavePath(world));
  if(path==='app/processInfo'&&method==='GET')return json(processInfo(world));
  if(path==='app/sendTestEmail'&&method==='POST'){sendTestEmail(world);return empty();}
  if(path==='app/getDirectoryContent'&&method==='GET'){
    if(!url.searchParams.has('dirPath'))return badRequest('Missing `dirPath`');
    const result=directoryContent(world,url.searchParams.get('dirPath'),url.searchParams.get('mode')||'all',boolParam(url.searchParams.get('withMetadata')));
    return result===null?badRequest('Invalid directory query'):json(result);
  }
  if(path==='app/rotateAPIKey'&&method==='POST')return json(rotateApiKey(world));
  if(path==='app/deleteAPIKey'&&method==='POST'){deleteApiKey(world);return empty();}
  if(path==='app/networkInterfaceList'&&method==='GET')return json(networkInterfaces());
  if(path==='app/networkInterfaceAddressList'&&method==='GET'){
    if(!url.searchParams.has('iface'))return badRequest('Missing `iface`');
    return json(networkInterfaceAddresses(url.searchParams.get('iface')||''));
  }
  if(path==='app/shutdown'&&method==='POST'){requestShutdown(world);return empty();}

  if(path==='clientdata/load'&&method==='GET'){
    const raw=url.searchParams.get('keys');
    if(raw==null||raw==='')return json(loadClientData(world));
    let keys;
    try{keys=JSON.parse(raw);}catch{return badRequest('Invalid `keys` JSON');}
    if(!Array.isArray(keys)||keys.some(x=>typeof x!=='string'))return badRequest('`keys` must be an array of strings');
    return json(loadClientData(world,keys));
  }
  if(path==='clientdata/store'&&method==='POST'){
    const f=await formObject(request);
    if(!Object.prototype.hasOwnProperty.call(f,'data'))return badRequest('Missing `data`');
    let data;
    try{data=JSON.parse(String(f.data));}catch{return badRequest('Invalid `data` JSON');}
    if(!data||Array.isArray(data)||typeof data!=='object')return badRequest('`data` must be an object');
    storeClientData(world,data);return empty(204);
  }

  if(path==='sync/torrentPeers'&&method==='GET'){
    const hash=url.searchParams.get('hash')||'',merged=mergeManualPeers(world,hash,generatedPeers(world,hash));
    if(merged===null)return notFound();
    return json({rid:Number(world.peerRid)||1,full_update:true,peers:filterBannedPeers(world,merged)});
  }
  if(path==='torrents/webseeds'&&method==='GET')return json(indexedWebseedList(world,url.searchParams.get('hash')||''));

  if(path==='rss/addFolder'&&method==='POST'){
    const f=await formObject(request);return rssAddFolder(world,f.path)?empty():conflict('RSS folder already exists or path is invalid');
  }
  if(path==='rss/addFeed'&&method==='POST'){
    const f=await formObject(request);if(!String(f.url||'').trim())return badRequest('Missing RSS feed URL');
    rssAddFeed(world,f.url,f.path??'',Date.now(),f.refreshInterval??0);return empty();
  }
  if(path==='rss/setFeedURL'&&method==='POST'){
    const f=await formObject(request);return rssSetFeedURL(world,f.path,f.url)?empty():conflict("Feed doesn't exist or URL is invalid");
  }
  if(path==='rss/setFeedRefreshInterval'&&method==='POST'){
    const f=await formObject(request),value=Number(f.refreshInterval);
    if(!Number.isFinite(value)||value<0)return badRequest("Invalid 'refreshInterval' value");
    return rssSetFeedRefreshInterval(world,f.path,value)?empty():conflict("Feed doesn't exist");
  }
  if(path==='rss/moveItem'&&method==='POST'){
    const f=await formObject(request);return rssMoveItem(world,f.itemPath,f.destPath)?empty():conflict('RSS item cannot be moved');
  }
  if(path==='rss/markAsRead'&&method==='POST'){
    const f=await formObject(request);rssMarkAsRead(world,f.itemPath,Object.prototype.hasOwnProperty.call(f,'articleId')?f.articleId:null);return empty();
  }
  if(path==='rss/matchingArticles'&&method==='GET'){
    const value=rssMatchingArticles(world,url.searchParams.get('ruleName')||'');return json(value||{});
  }

  if(path==='search/plugins'&&method==='GET')return json(searchPlugins(world));
  if(path==='search/start'&&method==='POST'){
    const f=await formObject(request);
    if(!['pattern','category','plugins'].every(key=>Object.prototype.hasOwnProperty.call(f,key)))return badRequest('Missing search parameter');
    if(activeSearchCount(world)>=5)return conflict('Unable to create more than 5 concurrent searches.');
    return json(searchStart(world,f));
  }
  if(path==='search/status'&&method==='GET'){
    const id=intParam(url.searchParams.get('id'));
    if(id!==0&&!searchJobExists(world,id))return notFound();
    return json(searchStatus(world,id===0?null:id));
  }
  if(path==='search/results'&&method==='GET'){
    if(!url.searchParams.has('id'))return badRequest('Missing search id');
    return searchResultResponse(world,intParam(url.searchParams.get('id')),url.searchParams.get('limit'),url.searchParams.get('offset'));
  }
  if(path==='search/stop'&&method==='POST'){
    const f=await formObject(request);if(!Object.prototype.hasOwnProperty.call(f,'id'))return badRequest('Missing search id');
    return searchStop(world,f.id)?empty():notFound();
  }
  if(path==='search/delete'&&method==='POST'){
    const f=await formObject(request);return searchDelete(world,f.id)?empty():notFound();
  }
  if(path==='search/downloadTorrent'&&method==='POST'){
    const f=await formObject(request);if(!String(f.torrentUrl||'').trim()||!String(f.pluginName||'').trim())return badRequest('Missing search download parameter');
    return searchDownloadTorrent(world,f.torrentUrl,f.pluginName)?empty():conflict('Unable to add search result');
  }
  if(path==='search/installPlugin'&&method==='POST'){
    const f=await formObject(request);if(!String(f.sources||'').trim())return badRequest('Missing plugin source');searchInstallPlugins(world,f.sources);return empty();
  }
  if(path==='search/uninstallPlugin'&&method==='POST'){
    const f=await formObject(request);if(!String(f.names||'').trim())return badRequest('Missing plugin name');searchUninstallPlugins(world,f.names);return empty();
  }
  if(path==='search/enablePlugin'&&method==='POST'){
    const f=await formObject(request);if(!String(f.names||'').trim())return badRequest('Missing plugin name');searchEnablePlugins(world,f.names,f.enable);return empty();
  }
  if(path==='search/updatePlugins'&&method==='POST'){searchUpdatePlugins(world);return empty();}

  if(path==='torrents/count'&&method==='GET')return text(torrentCount(world));
  if(path==='torrents/pieceAvailability'&&method==='GET'){
    const value=pieceAvailability(world,url.searchParams.get('hash')||'');
    return value===null?notFound():json(value);
  }
  if(path==='torrents/uploadLimit'&&method==='GET')return json(torrentLimitMap(world,url.searchParams.get('hashes')||'','upload'));
  if(path==='torrents/downloadLimit'&&method==='GET')return json(torrentLimitMap(world,url.searchParams.get('hashes')||'','download'));

  if(path==='torrents/SSLParameters'&&method==='GET'){
    const value=getSSLParameters(world,url.searchParams.get('hash')||'');
    return value===null?notFound():json(value);
  }
  if(path==='torrents/setSSLParameters'&&method==='POST'){
    const f=await formObject(request);
    if(!['hash','ssl_certificate','ssl_private_key','ssl_dh_params'].every(key=>Object.prototype.hasOwnProperty.call(f,key)))return badRequest('Missing SSL parameter');
    return setSSLParameters(world,String(f.hash||''),f)?empty(204):notFound();
  }

  if(path==='torrents/fetchMetadata'&&method==='POST'){
    const f=await formObject(request),result=fetchMetadata(world,f.source);
    if(!result)return badRequest('Must specify torrent source');
    return json(result.metadata,result.status);
  }
  if(path==='torrents/parseMetadata'&&method==='POST'){
    const items=await formFiles(request);
    if(!items.length)return badRequest('Must specify torrent file(s)');
    const arrayResponse=apiAtLeast(world,'2.13.0');
    const parsed=parseMetadata(world,items,Date.now(),arrayResponse);
    return json(normalizeParsedMetadataNames(items,parsed,arrayResponse));
  }
  if(path==='torrents/saveMetadata'&&method==='GET'){
    const result=saveMetadata(world,url.searchParams.get('source')||'');
    if(!result)return conflict();
    return text(result.payload,200,'application/x-bittorrent',{'content-disposition':`attachment; filename="${result.name}"`});
  }

  if(path==='torrents/addPeers'&&method==='POST'){
    const f=await formObject(request);addPeers(world,f.hashes,f.peers);return empty();
  }
  if(path==='torrents/setComment'&&method==='POST'){
    const f=await formObject(request);setComment(world,f.hashes,f.comment);return empty();
  }
  if(path==='torrents/setTags'&&method==='POST'){
    const f=await formObject(request);setTags(world,f.hashes,f.tags);return empty();
  }
  if(path==='torrents/setSavePath'&&method==='POST'){
    const f=await formObject(request);setTorrentPath(world,f.id,f.path,'save');return empty();
  }
  if(path==='torrents/setDownloadPath'&&method==='POST'){
    const f=await formObject(request);setTorrentPath(world,f.id,f.path,'download');return empty();
  }
  if(path==='torrents/addWebSeeds'&&method==='POST'){
    const f=await formObject(request);return addWebSeeds(world,f.hash,f.urls)?empty():notFound();
  }
  if(path==='torrents/editWebSeed'&&method==='POST'){
    const f=await formObject(request);return editWebSeed(world,f.hash,f.origUrl,f.newUrl)?empty():notFound();
  }
  if(path==='torrents/removeWebSeeds'&&method==='POST'){
    const f=await formObject(request);return removeWebSeeds(world,f.hash,f.urls)?empty():notFound();
  }
  if(path==='torrents/export'&&method==='GET'){
    const payload=exportTorrentPayload(world,url.searchParams.get('hash')||'');
    if(payload===null)return notFound();if(payload==='')return conflict();
    return text(payload,200,'application/x-bittorrent');
  }
  return null;
}
