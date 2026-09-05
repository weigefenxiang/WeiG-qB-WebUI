import {peers} from '../core/engine.js';
import {atLeast} from '../core/profiles.js';
import {filterBannedPeers} from '../core/torrent-actions.js';
import {
  addPeers,addWebSeeds,editWebSeed,exportTorrentPayload,fetchMetadata,getSSLParameters,loadClientData,
  mergeManualPeers,parseMetadata,pieceAvailability,processInfo,removeWebSeeds,saveMetadata,setComment,
  setSSLParameters,setTags,setTorrentPath,storeClientData,torrentCount,torrentLimitMap
} from '../core/torrent-auxiliary.js';

function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
function text(value,status=200,type='text/plain; charset=utf-8',headers={}){return new Response(String(value??''),{status,headers:{'content-type':type,'cache-control':'no-store',...headers}});}
function empty(status=200){return new Response([204,205,304].includes(status)?null:'',{status,headers:{'cache-control':'no-store'}});}
function notFound(){return text('Not Found',404);}
function badRequest(message='Bad Request'){return text(message,400);}
function conflict(){return text("Torrent's metadata has not yet downloaded",409);}
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
  if(path==='torrents/count')return qbAtLeast(world,'4.3.0');
  if(['torrents/setSavePath','torrents/setDownloadPath','torrents/export'].includes(path))return qbAtLeast(world,'4.6.0');
  if(['torrents/pieceAvailability','torrents/addWebSeeds','torrents/editWebSeed','torrents/removeWebSeeds','torrents/setComment','torrents/setTags'].includes(path))return Number(world.profile?.major)>=5;
  if(['torrents/SSLParameters','torrents/setSSLParameters'].includes(path))return qbAtLeast(world,'5.0.0');
  if(['torrents/fetchMetadata','torrents/parseMetadata','torrents/saveMetadata'].includes(path))return qbAtLeast(world,'5.2.0')&&apiAtLeast(world,'2.11.9');
  if(path.startsWith('clientdata/'))return qbAtLeast(world,'5.2.0')&&apiAtLeast(world,'2.13.1');
  if(path==='app/processInfo')return qbAtLeast(world,'5.2.0')&&apiAtLeast(world,'2.15.1');
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

export async function handleAuxiliaryApi(world,request,path,method,url){
  if(!bootstrapAllowed(world,path))return notFound();

  if(path==='app/processInfo'&&method==='GET')return json(processInfo(world));

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
    const hash=url.searchParams.get('hash')||'',merged=mergeManualPeers(world,hash,peers(world,hash));
    if(merged===null)return notFound();
    return json({rid:Number(world.peerRid)||1,full_update:true,peers:filterBannedPeers(world,merged)});
  }

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
