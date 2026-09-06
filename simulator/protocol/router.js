import {
  addTags,addVirtualTorrent,authenticate,capabilityAvailable,createCategory,createTags,deleteTags,
  deleteTorrents,logs,logout,removeCategories,removeTags,renameTorrent,
  setCategory,setForceStart,setPaused,setTorrentLimit
} from '../core/engine.js';
import {
  addTrackers,applyRuntimePolicies,banPeers,editTracker,movePriority,peerLogItems,
  reannounceTorrents,recheckTorrents,removeTrackers,setAutoManagement,setFilePriority,setLocation,
  toggleFirstLast,toggleSequential
} from '../core/torrent-actions.js';
import {
  applyShareLimitPolicies,enrichMainData,filesForTorrent,pieceHashes,pieceStates,renameFile,renameFolder,
  setShareLimits,setSuperSeeding,shareLimitProjection
} from '../core/torrent-content.js';
import {hasTorrentMetadata,propertiesForTorrent,torrentExists,trackersForTorrent} from '../core/torrent-metadata.js';
import {atLeast} from '../core/profiles.js';
import {torrentIndex} from '../core/runtime-index.js';
import {
  clearRuntimeSnapshot,listTorrentsSnapshot,mainDataSnapshot,runtimeSnapshotStats,transferSnapshot
} from '../core/runtime-view.js';
import {sliceTorrentWindow} from '../core/torrent-query.js';
import {
  creatorAddTask,creatorDeleteTask,creatorStatus,creatorTorrentFile,rssAddFeed,rssItems,rssRefreshItem,
  rssRemoveItem,rssRemoveRule,rssRenameRule,rssRules,rssSetRule,searchResults,searchStart,searchStatus,
  searchStop
} from '../core/virtual-services.js';
import {createPreferenceRuntime} from '../preferences/runtime.js';
import {handleAuxiliaryApi} from './auxiliary-router.js';
import {upstreamRouteAvailable} from './upstream-gates.js';

const RUNTIME_POLICY_INTERVAL_MS=500;
const SHARE_POLICY_INTERVAL_MS=1000;
const TORRENT_INFO_CACHE_TTL_MS=1500;
const maintenanceClocks=new WeakMap();
const torrentInfoCaches=new WeakMap();

function json(value,status=200,headers={}){
  return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
}
function text(value,status=200,headers={}){
  return new Response(String(value??''),{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store',...headers}});
}
function empty(status=200,headers={}){
  return new Response('',{status,headers:{'cache-control':'no-store',...headers}});
}
function notFound(){return text('Not Found',404);}
function notImplemented(path){return text(`Simulator endpoint not implemented: ${path}`,501);}
function metadataConflict(){return text("Torrent's metadata has not yet downloaded",409);}

async function formObject(request){
  const out={};
  const form=await request.formData();
  for(const [key,value] of form.entries()){
    if(!(key in out))out[key]=value;
    else if(Array.isArray(out[key]))out[key].push(value);
    else out[key]=[out[key],value];
  }
  return out;
}

function ensureCapability(world,name){return capabilityAvailable(world,name);}
function apiAtLeast(world,minimum){return atLeast(world.profile.webApiVersion,minimum);}
function hasRss(world){return apiAtLeast(world,'2.1.0');}
function hasSearch(world){return apiAtLeast(world,'2.1.1');}
function hasTorrentCreator(world){return world.profile.major>=5&&apiAtLeast(world,'2.11.0');}
function hasRenameFolder(world){return apiAtLeast(world,'2.8.0')||String(world.profile.qbVersion).replace(/^v/i,'')==='4.3.3';}
function owns(object,key){return Object.prototype.hasOwnProperty.call(object,key);}
function trackerUrlValid(value){
  const raw=String(value??'').trim();
  if(!raw)return false;
  try{return !!new URL(raw).protocol;}catch{return false;}
}
function trackerEditResponse(world,form){
  const modern=apiAtLeast(world,'2.13.0');
  if(modern){
    if(!owns(form,'hash')||!owns(form,'url'))return text('Bad Request',400);
  }else if(!owns(form,'hash')||!owns(form,'origUrl')||!owns(form,'newUrl'))return text('Bad Request',400);

  const hash=String(form.hash??''),torrent=torrentIndex(world).byHash.get(hash);
  if(!torrent)return notFound();

  if(modern){
    const hasNewUrl=owns(form,'newUrl'),hasTier=owns(form,'tier');
    if(!hasNewUrl&&!hasTier)return text('Must specify at least one of [newUrl, tier]',400);
    const oldUrl=String(form.url??'');
    let tier=null;
    if(hasTier){
      const rawTier=String(form.tier??'').trim();
      if(!/^\d+$/.test(rawTier))return text('tier must be an integer',400);
      tier=Number(rawTier);
      if(tier<0||tier>255)return text('tier must be between 0 and 255',400);
    }
    const tracker=(torrent.trackers||[]).find(item=>item.url===oldUrl);
    if(!tracker)return text('Tracker not found',409);
    const newUrl=hasNewUrl?String(form.newUrl??''):oldUrl;
    const urlChanged=hasNewUrl&&newUrl!==oldUrl;
    if(urlChanged){
      if(!trackerUrlValid(newUrl))return text('New tracker URL is invalid',400);
      if((torrent.trackers||[]).some(item=>item!==tracker&&item.url===newUrl))return text('New tracker URL already exists',409);
    }
    const tierChanged=hasTier&&Number(tracker.tier)!==tier;
    if(!urlChanged&&!tierChanged)return empty();
    const targetUrl=urlChanged?newUrl:oldUrl;
    if(!editTracker(world,hash,oldUrl,targetUrl))return text('Tracker not found',409);
    const updated=(torrent.trackers||[]).find(item=>item.url===targetUrl);
    if(updated&&hasTier)updated.tier=tier;
    return empty();
  }

  const oldUrl=String(form.origUrl??''),newUrl=String(form.newUrl??'');
  if(oldUrl===newUrl)return empty();
  if(!trackerUrlValid(newUrl))return text('New tracker URL is invalid',400);
  const tracker=(torrent.trackers||[]).find(item=>item.url===oldUrl);
  if(!tracker)return text('Tracker not found',409);
  if((torrent.trackers||[]).some(item=>item!==tracker&&item.url===newUrl))return text('New tracker URL already exists',409);
  return editTracker(world,hash,oldUrl,newUrl)?empty():text('Tracker not found',409);
}

function categoryObject(world){
  return Object.fromEntries(Object.entries(world.categories).map(([key,value])=>[key,{name:value.name,savePath:value.savePath}]));
}

function applyMaintenance(world,now,method){
  const force=method!=='GET';
  const clock=maintenanceClocks.get(world)||{runtimeAt:0,shareAt:0};
  if(force||now-clock.runtimeAt>=RUNTIME_POLICY_INTERVAL_MS){
    applyRuntimePolicies(world,now);
    clock.runtimeAt=now;
  }
  if(force||now-clock.shareAt>=SHARE_POLICY_INTERVAL_MS){
    applyShareLimitPolicies(world,now);
    clock.shareAt=now;
  }
  maintenanceClocks.set(world,clock);
}

function torrentInfoKey(params){
  return [...params.entries()]
    .filter(([key])=>key!=='offset'&&key!=='limit'&&key!=='now')
    .sort(([a,av],[b,bv])=>a.localeCompare(b)||String(av).localeCompare(String(bv)))
    .map(([key,value])=>`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function sliceTorrentRows(world,rows,params){
  return sliceTorrentWindow(rows,Object.fromEntries(params.entries()),world.profile);
}

function enrichTorrentRowsIndexed(world,rows){
  const byHash=torrentIndex(world).byHash;
  for(const row of rows){
    const torrent=byHash.get(row.hash);
    if(torrent)Object.assign(row,shareLimitProjection(world,torrent));
  }
  return rows;
}

function torrentInfoRows(world,url,now){
  const params=new URLSearchParams(url.search);
  const key=torrentInfoKey(params);
  const cached=torrentInfoCaches.get(world);
  if(cached&&cached.key===key&&cached.rid===Number(world.rid||0)&&now-cached.createdAt<TORRENT_INFO_CACHE_TTL_MS){
    cached.hits++;
    return sliceTorrentRows(world,cached.rows,params);
  }
  const query=Object.fromEntries(params.entries());
  delete query.offset;
  delete query.limit;
  const rows=enrichTorrentRowsIndexed(world,listTorrentsSnapshot(world,query,now));
  if(query.sort&&rows.length&&!Object.prototype.hasOwnProperty.call(rows[0],query.sort)){
    const error=new Error("'sort' parameter is invalid");
    error.code='INVALID_TORRENT_SORT';
    throw error;
  }
  torrentInfoCaches.set(world,{key,rid:Number(world.rid||0),createdAt:now,rows,hits:0});
  return sliceTorrentRows(world,rows,params);
}

export function simulatorApiCacheStats(world){
  const cached=torrentInfoCaches.get(world),snapshot=runtimeSnapshotStats(world);
  if(!cached)return{cached:false,rows:0,hits:0,snapshot};
  return{cached:true,rows:cached.rows.length,hits:cached.hits,ageMs:Math.max(0,Date.now()-cached.createdAt),rid:cached.rid,key:cached.key,snapshot};
}

export function clearSimulatorApiCaches(world){
  maintenanceClocks.delete(world);
  torrentInfoCaches.delete(world);
  clearRuntimeSnapshot(world);
}

export async function handleApi(world,request,url=new URL(request.url)){
  const marker='/api/v2/';
  const index=url.pathname.indexOf(marker);
  if(index<0)return notFound();
  const path=url.pathname.slice(index+marker.length).replace(/^\/+/, '');
  const method=request.method.toUpperCase();
  if(!upstreamRouteAvailable(world.profile,path))return notFound();
  const now=Date.now();
  if(method!=='GET')torrentInfoCaches.delete(world);
  applyMaintenance(world,now,method);

  if(path==='auth/login'&&method==='POST'){
    const form=await formObject(request);
    authenticate(world,String(form.username??''),String(form.password??''));
    return text('Ok.');
  }
  if(path==='auth/logout'&&method==='POST'){
    logout(world);
    return empty();
  }

  if(!world.authenticated)return empty(403);

  const auxiliary=await handleAuxiliaryApi(world,request,path,method,url);
  if(auxiliary)return auxiliary;

  if(path==='app/version'&&method==='GET')return text(`v${world.profile.qbVersion}`);
  if(path==='app/webapiVersion'&&method==='GET')return text(world.profile.webApiVersion);
  if(path==='app/buildInfo'&&method==='GET'){
    if(!apiAtLeast(world,'2.3.0'))return notFound();
    return json({
      bitness:64,boost:'virtual',libtorrent:'virtual',openssl:'virtual',qt:'virtual',
      zlib:'virtual',product:'WeiG Virtual qB Lab',source_tag:world.profile.tag,source_sha:world.profile.sourceSha||null
    });
  }
  if(path==='app/preferences'&&method==='GET')return json(createPreferenceRuntime(world).read());
  if(path==='app/setPreferences'&&method==='POST'){
    const form=await formObject(request);
    let patch={};
    try{patch=JSON.parse(String(form.json||'{}'));}catch{return text('Invalid JSON',400);}
    createPreferenceRuntime(world).write(patch,now);
    return empty();
  }
  if(path==='app/cookies'&&method==='GET'){
    if(!ensureCapability(world,'cookies'))return notFound();
    return json(world.cookies||[]);
  }
  if(path==='app/setCookies'&&method==='POST'){
    if(!ensureCapability(world,'cookies'))return notFound();
    try{world.cookies=await request.json();}catch{world.cookies=[];}
    return empty();
  }

  if(path==='transfer/info'&&method==='GET')return json(transferSnapshot(world,now));
  if(path==='transfer/speedLimitsMode'&&method==='GET')return text(world.altSpeedMode?'1':'0');
  if(path==='transfer/toggleSpeedLimitsMode'&&method==='POST'){
    world.altSpeedMode=!world.altSpeedMode;return empty();
  }
  if(path==='transfer/downloadLimit'&&method==='GET')return text(world.globalDownloadLimit);
  if(path==='transfer/uploadLimit'&&method==='GET')return text(world.globalUploadLimit);
  if(path==='transfer/setDownloadLimit'&&method==='POST'){
    const f=await formObject(request);world.globalDownloadLimit=Math.max(0,Math.round(Number(f.limit)||0));return empty();
  }
  if(path==='transfer/setUploadLimit'&&method==='POST'){
    const f=await formObject(request);world.globalUploadLimit=Math.max(0,Math.round(Number(f.limit)||0));return empty();
  }
  if(path==='transfer/banPeers'&&method==='POST'){
    if(!apiAtLeast(world,'2.3.0'))return notFound();
    const f=await formObject(request);banPeers(world,f.peers);return empty();
  }

  if(path==='sync/maindata'&&method==='GET')return json(enrichMainData(world,mainDataSnapshot(world,url.searchParams.get('rid')||0,now)));

  if(path==='torrents/info'&&method==='GET'){
    try{return json(torrentInfoRows(world,url,now));}
    catch(error){if(error?.code==='INVALID_TORRENT_SORT')return text(error.message,400);throw error;}
  }
  if(path==='torrents/properties'&&method==='GET'){
    const value=propertiesForTorrent(world,url.searchParams.get('hash')||'',now);
    return value?json(value):notFound();
  }
  if(path==='torrents/files'&&method==='GET'){
    const hash=url.searchParams.get('hash')||'';
    const metadata=hasTorrentMetadata(world,hash);if(metadata===null)return notFound();if(!metadata)return json([]);
    const value=filesForTorrent(world,hash,url.searchParams.get('indexes'));
    return value===null?notFound():json(value);
  }
  if(path==='torrents/pieceStates'&&method==='GET'){
    const hash=url.searchParams.get('hash')||'';
    const metadata=hasTorrentMetadata(world,hash);if(metadata===null)return notFound();if(!metadata)return json([]);
    const value=pieceStates(world,hash);return value===null?notFound():json(value);
  }
  if(path==='torrents/pieceHashes'&&method==='GET'){
    const hash=url.searchParams.get('hash')||'';
    const metadata=hasTorrentMetadata(world,hash);if(metadata===null)return notFound();if(!metadata)return json([]);
    const value=pieceHashes(world,hash);return value===null?notFound():json(value);
  }
  if(path==='torrents/trackers'&&method==='GET'){
    const value=trackersForTorrent(world,url.searchParams.get('hash')||'',now);return value===null?notFound():json(value);
  }

  const qb5=world.profile.major>=5;
  if(path==='torrents/start'&&method==='POST'){
    if(!qb5)return notFound();const f=await formObject(request);setPaused(world,f.hashes,false);return empty();
  }
  if(path==='torrents/stop'&&method==='POST'){
    if(!qb5)return notFound();const f=await formObject(request);setPaused(world,f.hashes,true);return empty();
  }
  if(path==='torrents/resume'&&method==='POST'){
    if(qb5)return notFound();const f=await formObject(request);setPaused(world,f.hashes,false);return empty();
  }
  if(path==='torrents/pause'&&method==='POST'){
    if(qb5)return notFound();const f=await formObject(request);setPaused(world,f.hashes,true);return empty();
  }
  if(path==='torrents/delete'&&method==='POST'){
    const f=await formObject(request);deleteTorrents(world,f.hashes);return empty();
  }
  if(path==='torrents/recheck'&&method==='POST'){
    const f=await formObject(request);recheckTorrents(world,f.hashes);return empty();
  }
  if(path==='torrents/reannounce'&&method==='POST'){
    if(!apiAtLeast(world,'2.0.2'))return notFound();
    const f=await formObject(request);reannounceTorrents(world,f.hashes);return empty();
  }
  if(path==='torrents/setForceStart'&&method==='POST'){
    const f=await formObject(request);setForceStart(world,f.hashes,String(f.value)==='true');return empty();
  }
  if(path==='torrents/setAutoManagement'&&method==='POST'){
    const f=await formObject(request);setAutoManagement(world,f.hashes,String(f.enable)==='true');return empty();
  }
  if(path==='torrents/toggleSequentialDownload'&&method==='POST'){
    const f=await formObject(request);toggleSequential(world,f.hashes);return empty();
  }
  if(path==='torrents/toggleFirstLastPiecePrio'&&method==='POST'){
    const f=await formObject(request);toggleFirstLast(world,f.hashes);return empty();
  }
  if(path==='torrents/setSuperSeeding'&&method==='POST'){
    const f=await formObject(request);setSuperSeeding(world,f.hashes,String(f.value)==='true');return empty();
  }
  if(path==='torrents/setShareLimits'&&method==='POST'){
    const f=await formObject(request);setShareLimits(world,f.hashes,f);return empty();
  }
  if(path==='torrents/topPrio'&&method==='POST'){
    const f=await formObject(request);movePriority(world,f.hashes,'top');return empty();
  }
  if(path==='torrents/increasePrio'&&method==='POST'){
    const f=await formObject(request);movePriority(world,f.hashes,'increase');return empty();
  }
  if(path==='torrents/decreasePrio'&&method==='POST'){
    const f=await formObject(request);movePriority(world,f.hashes,'decrease');return empty();
  }
  if(path==='torrents/bottomPrio'&&method==='POST'){
    const f=await formObject(request);movePriority(world,f.hashes,'bottom');return empty();
  }
  if(path==='torrents/setLocation'&&method==='POST'){
    const f=await formObject(request);setLocation(world,f.hashes,f.location);return empty();
  }
  if(path==='torrents/filePrio'&&method==='POST'){
    const f=await formObject(request),hash=String(f.hash||'');
    if(!torrentExists(world,hash))return notFound();if(hasTorrentMetadata(world,hash)===false)return metadataConflict();
    return setFilePriority(world,hash,f.id,f.priority)?empty():notFound();
  }
  if(path==='torrents/renameFile'&&method==='POST'){
    if(!ensureCapability(world,'renameFile'))return notFound();
    const f=await formObject(request),hash=String(f.hash||'');
    if(!torrentExists(world,hash))return notFound();if(hasTorrentMetadata(world,hash)===false)return metadataConflict();
    return renameFile(world,hash,f.oldPath,f.newPath)?empty():notFound();
  }
  if(path==='torrents/renameFolder'&&method==='POST'){
    if(!hasRenameFolder(world))return notFound();
    const f=await formObject(request),hash=String(f.hash||'');
    if(!torrentExists(world,hash))return notFound();if(hasTorrentMetadata(world,hash)===false)return metadataConflict();
    return renameFolder(world,hash,f.oldPath,f.newPath)?empty():notFound();
  }
  if(path==='torrents/setDownloadLimit'&&method==='POST'){
    const f=await formObject(request);setTorrentLimit(world,f.hashes,'download',f.limit);return empty();
  }
  if(path==='torrents/setUploadLimit'&&method==='POST'){
    const f=await formObject(request);setTorrentLimit(world,f.hashes,'upload',f.limit);return empty();
  }
  if(path==='torrents/setCategory'&&method==='POST'){
    const f=await formObject(request);setCategory(world,f.hashes,f.category);return empty();
  }
  if(path==='torrents/addTags'&&method==='POST'){
    if(!ensureCapability(world,'addTags'))return notFound();
    const f=await formObject(request);addTags(world,f.hashes,f.tags);return empty();
  }
  if(path==='torrents/removeTags'&&method==='POST'){
    if(!ensureCapability(world,'tags'))return notFound();
    const f=await formObject(request);removeTags(world,f.hashes,f.tags);return empty();
  }
  if(path==='torrents/rename'&&method==='POST'){
    const f=await formObject(request);return renameTorrent(world,String(f.hash||''),String(f.name||''))?empty():notFound();
  }
  if(path==='torrents/addTrackers'&&method==='POST'){
    const f=await formObject(request);return addTrackers(world,f.hash,f.urls)?empty():notFound();
  }
  if(path==='torrents/removeTrackers'&&method==='POST'){
    if(!apiAtLeast(world,'2.2.0'))return notFound();
    const f=await formObject(request);return removeTrackers(world,f.hash,f.urls)?empty():notFound();
  }
  if(path==='torrents/editTracker'&&method==='POST'){
    if(!apiAtLeast(world,'2.2.0'))return notFound();
    const f=await formObject(request);return trackerEditResponse(world,f);
  }
  if(path==='torrents/add'&&method==='POST'){
    const f=await formObject(request);
    const urlText=Array.isArray(f.urls)?String(f.urls[0]):String(f.urls||'');
    const fileValue=Array.isArray(f.torrents)?f.torrents[0]:f.torrents;
    const name=fileValue?.name||urlText||'Added Virtual Torrent';
    addVirtualTorrent(world,{name,url:urlText,savepath:f.savepath,category:f.category,tags:f.tags,autoTMM:f.autoTMM});
    if(apiAtLeast(world,'2.14.0'))return json({success_count:1,pending_count:0,failure_count:0});
    return text('Ok.');
  }

  if(path==='torrents/categories'&&method==='GET'){
    if(!apiAtLeast(world,'2.1.1'))return notFound();
    return json(categoryObject(world));
  }
  if(path==='torrents/createCategory'&&method==='POST'){
    const f=await formObject(request),name=String(f.category||'').trim();
    return createCategory(world,name,f.savePath)?empty():text('Invalid category',400);
  }
  if(path==='torrents/editCategory'&&method==='POST'){
    if(!apiAtLeast(world,'2.1.0'))return notFound();
    const f=await formObject(request),name=String(f.category||'').trim();
    if(!name||!world.categories?.[name])return notFound();
    createCategory(world,name,f.savePath);return empty();
  }
  if(path==='torrents/removeCategories'&&method==='POST'){
    const f=await formObject(request);removeCategories(world,f.categories);return empty();
  }
  if(path==='torrents/tags'&&method==='GET'){
    if(!ensureCapability(world,'tags'))return notFound();return json(world.tags);
  }
  if(path==='torrents/createTags'&&method==='POST'){
    if(!ensureCapability(world,'tags'))return notFound();
    const f=await formObject(request);createTags(world,f.tags);return empty();
  }
  if(path==='torrents/deleteTags'&&method==='POST'){
    if(!ensureCapability(world,'tags'))return notFound();
    const f=await formObject(request);deleteTags(world,f.tags);return empty();
  }

  if(path==='log/main'&&method==='GET'){
    if(!ensureCapability(world,'logs'))return notFound();
    return json(logs(world,url.searchParams.get('last_known_id')??-1));
  }
  if(path==='log/peers'&&method==='GET'){
    if(!ensureCapability(world,'logs'))return notFound();
    return json(peerLogItems(world,url.searchParams.get('last_known_id')??-1));
  }

  if(path.startsWith('rss/')){
    if(!hasRss(world))return notFound();
    if(path==='rss/items'&&method==='GET')return json(rssItems(world,url.searchParams.get('withData')!=='false'));
    if(path==='rss/rules'&&method==='GET')return json(rssRules(world));
    if(path==='rss/addFeed'&&method==='POST'){
      const f=await formObject(request);rssAddFeed(world,f.url,f.path);return empty();
    }
    if(path==='rss/removeItem'&&method==='POST'){
      const f=await formObject(request);return rssRemoveItem(world,f.path)?empty():notFound();
    }
    if(path==='rss/refreshItem'&&method==='POST'){
      if(!apiAtLeast(world,'2.2.1'))return notFound();
      const f=await formObject(request);return rssRefreshItem(world,f.itemPath)?empty():notFound();
    }
    if(path==='rss/setRule'&&method==='POST'){
      const f=await formObject(request);let rule={};try{rule=JSON.parse(String(f.ruleDef||'{}'));}catch{return text('Invalid RSS rule JSON',400);}
      return rssSetRule(world,f.ruleName,rule)?empty():text('Invalid RSS rule',400);
    }
    if(path==='rss/removeRule'&&method==='POST'){
      const f=await formObject(request);return rssRemoveRule(world,f.ruleName)?empty():notFound();
    }
    if(path==='rss/renameRule'&&method==='POST'){
      const f=await formObject(request);return rssRenameRule(world,f.ruleName,f.newRuleName)?empty():notFound();
    }
  }

  if(path.startsWith('search/')){
    if(!hasSearch(world))return notFound();
    if(path==='search/plugins'&&method==='GET')return json([{name:'Virtual Search',fullName:'WeiG Virtual Search',url:'https://example.invalid',enabled:true,supportedCategories:{all:'All'}}]);
    if(path==='search/start'&&method==='POST'){const f=await formObject(request);return json(searchStart(world,f));}
    if(path==='search/status'&&method==='GET')return json(searchStatus(world,url.searchParams.has('id')?url.searchParams.get('id'):null));
    if(path==='search/results'&&method==='GET')return json(searchResults(world,url.searchParams.get('id'),url.searchParams.get('limit'),url.searchParams.get('offset')));
    if(path==='search/stop'&&method==='POST'){const f=await formObject(request);return searchStop(world,f.id)?empty():notFound();}
  }

  if(path.startsWith('torrentcreator/')){
    if(!hasTorrentCreator(world))return notFound();
    if(path==='torrentcreator/addTask'&&method==='POST'){const f=await formObject(request);return json(creatorAddTask(world,f));}
    if(path==='torrentcreator/status'&&method==='GET')return json(creatorStatus(world,url.searchParams.get('taskID')||''));
    if(path==='torrentcreator/deleteTask'&&method==='POST'){const f=await formObject(request);return creatorDeleteTask(world,String(f.taskID||''))?empty():notFound();}
    if(path==='torrentcreator/torrentFile'&&method==='GET'){
      const payload=creatorTorrentFile(world,url.searchParams.get('taskID')||'');
      if(payload==null)return text('Torrent creator task is not finished.',409);
      return new Response(new Blob([payload],{type:'application/x-bittorrent'}),{status:200,headers:{'cache-control':'no-store'}});
    }
  }

  return notImplemented(path);
}