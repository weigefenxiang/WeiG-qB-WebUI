import {atLeast} from '../core/profiles.js';
import {
  addPeers,addWebSeeds,editWebSeed,exportTorrentPayload,pieceAvailability,removeWebSeeds,setComment,
  setTags,setTorrentPath,torrentCount,torrentLimitMap
} from '../core/torrent-auxiliary.js';

function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
function text(value,status=200,type='text/plain; charset=utf-8'){return new Response(String(value??''),{status,headers:{'content-type':type,'cache-control':'no-store'}});}
function empty(status=200){return new Response('',{status,headers:{'cache-control':'no-store'}});}
function notFound(){return text('Not Found',404);}
function conflict(){return text("Torrent's metadata has not yet downloaded",409);}
async function formObject(request){
  const out={},form=await request.formData();
  for(const [key,value] of form.entries()){
    if(!(key in out))out[key]=value;else if(Array.isArray(out[key]))out[key].push(value);else out[key]=[out[key],value];
  }
  return out;
}
function qbAtLeast(world,minimum){return atLeast(world.profile?.qbVersion||'0',minimum);}
function exactCatalog(world){return Array.isArray(world.profile?.apiActions);}
function bootstrapAllowed(world,path){
  if(exactCatalog(world))return true;
  if(path==='torrents/count')return qbAtLeast(world,'4.3.0');
  if(['torrents/setSavePath','torrents/setDownloadPath','torrents/export'].includes(path))return qbAtLeast(world,'4.6.0');
  if(['torrents/pieceAvailability','torrents/addWebSeeds','torrents/editWebSeed','torrents/removeWebSeeds','torrents/setComment','torrents/setTags'].includes(path))return Number(world.profile?.major)>=5;
  return true;
}

export async function handleAuxiliaryApi(world,request,path,method,url){
  if(!bootstrapAllowed(world,path))return notFound();

  if(path==='torrents/count'&&method==='GET')return text(torrentCount(world));
  if(path==='torrents/pieceAvailability'&&method==='GET'){
    const value=pieceAvailability(world,url.searchParams.get('hash')||'');
    return value===null?notFound():json(value);
  }
  if(path==='torrents/uploadLimit'&&method==='GET')return json(torrentLimitMap(world,url.searchParams.get('hashes')||'','upload'));
  if(path==='torrents/downloadLimit'&&method==='GET')return json(torrentLimitMap(world,url.searchParams.get('hashes')||'','download'));

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
