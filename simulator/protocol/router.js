import {
  addTags,addVirtualTorrent,authenticate,capabilityAvailable,deleteTorrents,logs,logout,mainData,
  peers,properties,removeTags,renameTorrent,setCategory,setForceStart,setPaused,setPreferences,
  setTorrentLimit,transferInfo,listTorrents
} from '../core/engine.js';
import {
  addTrackers,applyRuntimePolicies,banPeers,editTracker,filterBannedPeers,movePriority,peerLogItems,
  reannounceTorrents,recheckTorrents,removeTrackers,setAutoManagement,setFilePriority,setLocation,
  toggleFirstLast,toggleSequential
} from '../core/torrent-actions.js';
import {atLeast} from '../core/profiles.js';
import {
  creatorAddTask,creatorDeleteTask,creatorStatus,creatorTorrentFile,rssAddFeed,rssItems,rssRefreshItem,
  rssRemoveItem,rssRemoveRule,rssRenameRule,rssRules,rssSetRule,searchResults,searchStart,searchStatus,
  searchStop,webseedList
} from '../core/virtual-services.js';

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

function preferencesForProfile(world){
  const keys=Array.isArray(world.profile.preferenceKeys)?new Set(world.profile.preferenceKeys):null;
  if(!keys)return{...world.preferences};
  return Object.fromEntries(Object.entries(world.preferences).filter(([key])=>keys.has(key)));
}

function ensureCapability(world,name){return capabilityAvailable(world,name);}
function apiAtLeast(world,minimum){return atLeast(world.profile.webApiVersion,minimum);}
function hasRss(world){return apiAtLeast(world,'2.1.0');}
function hasSearch(world){return apiAtLeast(world,'2.1.1');}
function hasTorrentCreator(world){return world.profile.major>=5&&apiAtLeast(world,'2.11.0');}

function trackerList(world,hash){
  const t=world.torrents.find(x=>x.hash===hash);
  return t?.trackers||[];
}

function fileList(world,hash){
  const t=world.torrents.find(x=>x.hash===hash);
  return t?.files||[];
}

function categoryObject(world){
  return Object.fromEntries(Object.entries(world.categories).map(([key,value])=>[key,{name:value.name,savePath:value.savePath}]));
}

export async function handleApi(world,request,url=new URL(request.url)){
  const marker='/api/v2/';
  const index=url.pathname.indexOf(marker);
  if(index<0)return notFound();
  const path=url.pathname.slice(index+marker.length).replace(/^\/+/, '');
  const method=request.method.toUpperCase();
  applyRuntimePolicies(world,Date.now());

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

  if(path==='app/version'&&method==='GET')return text(`v${world.profile.qbVersion}`);
  if(path==='app/webapiVersion'&&method==='GET')return text(world.profile.webApiVersion);
  if(path==='app/buildInfo'&&method==='GET'){
    if(!apiAtLeast(world,'2.3.0'))return notFound();
    return json({
      bitness:64,boost:'virtual',libtorrent:'virtual',openssl:'virtual',qt:'virtual',
      zlib:'virtual',product:'WeiG Virtual qB Lab',source_tag:world.profile.tag,source_sha:world.profile.sourceSha||null
    });
  }
  if(path==='app/preferences'&&method==='GET')return json(preferencesForProfile(world));
  if(path==='app/setPreferences'&&method==='POST'){
    const form=await formObject(request);
    let patch={};
    try{patch=JSON.parse(String(form.json||'{}'));}catch{return text('Invalid JSON',400);}
    if(Array.isArray(world.profile.preferenceKeys)){
      const allowed=new Set(world.profile.preferenceKeys);
      patch=Object.fromEntries(Object.entries(patch).filter(([key])=>allowed.has(key)));
    }
    setPreferences(world,patch);
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

  if(path==='transfer/info'&&method==='GET')return json(transferInfo(world));
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

  if(path==='sync/maindata'&&method==='GET')return json(mainData(world,url.searchParams.get('rid')||0));
  if(path==='sync/torrentPeers'&&method==='GET'){
    const hash=url.searchParams.get('hash')||'';
    return json({rid:Number(world.peerRid)||1,full_update:true,peers:filterBannedPeers(world,peers(world,hash))});
  }

  if(path==='torrents/info'&&method==='GET')return json(listTorrents(world,Object.fromEntries(url.searchParams.entries())));
  if(path==='torrents/properties'&&method==='GET'){
    const value=properties(world,url.searchParams.get('hash')||'');
    return value?json(value):notFound();
  }
  if(path==='torrents/files'&&method==='GET')return json(fileList(world,url.searchParams.get('hash')||''));
  if(path==='torrents/trackers'&&method==='GET')return json(trackerList(world,url.searchParams.get('hash')||''));
  if(path==='torrents/webseeds'&&method==='GET')return json(webseedList(world,url.searchParams.get('hash')||''));

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
  if(path==='torrents/topPrio'&&method==='POST'){
    const f=await formObject(request);movePriority(world,f.hashes,'top');return empty();
  }
  if(path==='torrents/bottomPrio'&&method==='POST'){
    const f=await formObject(request);movePriority(world,f.hashes,'bottom');return empty();
  }
  if(path==='torrents/setLocation'&&method==='POST'){
    const f=await formObject(request);setLocation(world,f.hashes,f.location);return empty();
  }
  if(path==='torrents/filePrio'&&method==='POST'){
    const f=await formObject(request);return setFilePriority(world,f.hash,f.id,f.priority)?empty():notFound();
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
    const f=await formObject(request);return removeTrackers(world,f.hash,f.urls)?empty():notFound();
  }
  if(path==='torrents/editTracker'&&method==='POST'){
    if(!apiAtLeast(world,'2.2.0'))return notFound();
    const f=await formObject(request),oldUrl=f.url??f.origUrl;
    return editTracker(world,f.hash,oldUrl,f.newUrl)?empty():notFound();
  }
  if(path==='torrents/add'&&method==='POST'){
    const f=await formObject(request);
    const urlText=Array.isArray(f.urls)?String(f.urls[0]):String(f.urls||'');
    const fileValue=Array.isArray(f.torrents)?f.torrents[0]:f.torrents;
    const name=fileValue?.name||urlText||'Added Virtual Torrent';
    addVirtualTorrent(world,{name,url:urlText,savepath:f.savepath,category:f.category,tags:f.tags});
    if(apiAtLeast(world,'2.14.0'))return json({success_count:1,pending_count:0,failure_count:0});
    return text('Ok.');
  }

  if(path==='torrents/categories'&&method==='GET')return json(categoryObject(world));
  if(path==='torrents/createCategory'&&method==='POST'){
    const f=await formObject(request),name=String(f.category||'').trim();
    if(name)world.categories[name]={name,savePath:String(f.savePath||'')};return empty();
  }
  if(path==='torrents/removeCategories'&&method==='POST'){
    const f=await formObject(request);
    for(const name of String(f.categories||'').split('\n').flatMap(x=>x.split('|')).map(x=>x.trim()).filter(Boolean))delete world.categories[name];
    return empty();
  }
  if(path==='torrents/tags'&&method==='GET'){
    if(!ensureCapability(world,'tags'))return notFound();return json(world.tags);
  }
  if(path==='torrents/createTags'&&method==='POST'){
    if(!ensureCapability(world,'tags'))return notFound();
    const f=await formObject(request);world.tags=Array.from(new Set([...world.tags,...String(f.tags||'').split(',').map(x=>x.trim()).filter(Boolean)])).sort();return empty();
  }
  if(path==='torrents/deleteTags'&&method==='POST'){
    if(!ensureCapability(world,'tags'))return notFound();
    const f=await formObject(request),doomed=new Set(String(f.tags||'').split(',').map(x=>x.trim()).filter(Boolean));
    world.tags=world.tags.filter(x=>!doomed.has(x));for(const t of world.torrents)t.tags=t.tags.filter(x=>!doomed.has(x));return empty();
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
