import {recordTorrentChanges} from './engine.js';
import {deterministicUnit} from './random.js';
import {webseedList} from './virtual-services.js';

const MiB=1024*1024;
const PIECE_SIZE=4*MiB;

function selected(world,hashes){
  const text=String(hashes||'');
  if(text==='all')return world.torrents||[];
  const wanted=new Set(text.split('|').filter(Boolean));
  return (world.torrents||[]).filter(t=>wanted.has(t.hash));
}
function torrent(world,hash){return (world.torrents||[]).find(t=>t.hash===String(hash||''))||null;}
function pieceCount(t){return Math.max(1,Math.ceil(Math.max(1,Number(t.size)||1)/PIECE_SIZE));}
function splitPipe(value){return String(value||'').split('|').map(x=>x.trim()).filter(Boolean);}
function splitTags(value){return Array.from(new Set(String(value||'').split(',').map(x=>x.trim()).filter(Boolean)));}
function validPeer(value){
  const text=String(value||'').trim();
  const bracket=text.match(/^\[([^\]]+)\]:(\d{1,5})$/);
  if(bracket){const port=Number(bracket[2]);return port>0&&port<=65535?{ip:bracket[1],port,key:text}:null;}
  const idx=text.lastIndexOf(':');if(idx<=0)return null;
  const ip=text.slice(0,idx).trim(),port=Number(text.slice(idx+1));
  return ip&&Number.isInteger(port)&&port>0&&port<=65535?{ip,port,key:text}:null;
}
function safePath(value){
  const path=String(value??'').trim().replace(/\\/g,'/').replace(/\/{2,}/g,'/');
  if(!path||path.includes('\0'))return'';
  return path.length>1?path.replace(/\/$/,''):path;
}

export function torrentCount(world){return (world.torrents||[]).length;}

export function pieceAvailability(world,hash){
  const t=torrent(world,hash);if(!t)return null;if(t.has_metadata===false)return[];
  const count=pieceCount(t),peers=Math.max(0,Number(t.connectedPeers)||0),out=new Array(count);
  for(let i=0;i<count;i++){
    const unit=deterministicUnit(world.seed,`${t.hash}:piece-availability:${i}`);
    out[i]=Math.max(0,Math.min(peers,Math.floor(unit*(peers+1))));
  }
  return out;
}

export function torrentLimitMap(world,hashes,kind){
  const ids=String(hashes||'').split('|').filter(Boolean),out={};
  for(const id of ids){
    const t=torrent(world,id),raw=t?(kind==='upload'?t.uploadLimit:t.downloadLimit):-1;
    out[id]=t?(Number(raw)>0?Math.round(Number(raw)):-1):-1;
  }
  return out;
}

export function setComment(world,hashes,comment){
  const changed=[];const next=String(comment||'').trim();
  for(const t of selected(world,hashes)){
    if(String(t.comment||'')===next)continue;t.comment=next;changed.push(t.hash);
  }
  recordTorrentChanges(world,changed,[]);return changed.length;
}

export function setTags(world,hashes,tags){
  const next=splitTags(tags),changed=[];
  for(const t of selected(world,hashes)){
    if(JSON.stringify(t.tags||[])===JSON.stringify(next))continue;t.tags=[...next];changed.push(t.hash);
  }
  world.tags=Array.from(new Set([...(world.tags||[]),...next])).sort();
  recordTorrentChanges(world,changed,[],{tags:next});return changed.length;
}

export function setTorrentPath(world,ids,path,kind){
  const next=safePath(path);if(!next)return 0;const changed=[];
  for(const t of selected(world,ids)){
    if(kind==='download'){
      if(t.downloadPath===next)continue;t.downloadPath=next;
    }else{
      if(t.savePath===next)continue;t.savePath=next;
      const leaf=String(t.name||'torrent').replace(/[\\/]+/g,'_');
      t.contentPath=next==='/'?`/${leaf}`:`${next}/${leaf}`;
    }
    changed.push(t.hash);
  }
  recordTorrentChanges(world,changed,[]);return changed.length;
}

export function addWebSeeds(world,hash,urls){
  const t=torrent(world,hash);if(!t)return false;
  if(!Array.isArray(t.webseeds))webseedList(world,hash);
  t.webseeds=Array.isArray(t.webseeds)?t.webseeds:[];
  const existing=new Set(t.webseeds.map(x=>String(x.url)));
  let changed=false;
  for(const url of splitPipe(urls))if(!existing.has(url)){t.webseeds.push({url});existing.add(url);changed=true;}
  if(changed)recordTorrentChanges(world,[t.hash],[]);return true;
}

export function editWebSeed(world,hash,origUrl,newUrl){
  const t=torrent(world,hash);if(!t)return false;
  if(!Array.isArray(t.webseeds))webseedList(world,hash);
  const from=String(origUrl||''),to=String(newUrl||'').trim();if(!to)return false;
  const item=(t.webseeds||[]).find(x=>String(x.url)===from);if(!item)return false;
  item.url=to;recordTorrentChanges(world,[t.hash],[]);return true;
}

export function removeWebSeeds(world,hash,urls){
  const t=torrent(world,hash);if(!t)return false;
  if(!Array.isArray(t.webseeds))webseedList(world,hash);
  const doomed=new Set(splitPipe(urls)),before=(t.webseeds||[]).length;
  t.webseeds=(t.webseeds||[]).filter(x=>!doomed.has(String(x.url)));
  if(t.webseeds.length!==before)recordTorrentChanges(world,[t.hash],[]);return true;
}

export function addPeers(world,hashes,peerText){
  const peers=splitPipe(peerText).map(validPeer).filter(Boolean);if(!peers.length)return 0;
  let touched=0;
  for(const t of selected(world,hashes)){
    t.manualPeers=t.manualPeers&&typeof t.manualPeers==='object'?t.manualPeers:{};
    let added=0;
    for(const peer of peers){
      if(t.manualPeers[peer.key])continue;
      t.manualPeers[peer.key]={
        ip:peer.ip,port:peer.port,client:'Manual virtual peer',country:'Virtual',country_code:'',
        connection:'TCP',flags:'D U',flags_desc:'Manual peer',progress:0,relevance:1,
        dl_speed:0,up_speed:0,downloaded:0,uploaded:0,files:''
      };added++;
    }
    if(added){t.leechers=Math.max(0,Number(t.leechers)||0)+added;t.connectedPeers=Math.max(0,Number(t.connectedPeers)||0)+added;recordTorrentChanges(world,[t.hash],[]);touched++;}
  }
  if(touched)world.peerRid=(Number(world.peerRid)||1)+1;
  return touched;
}

export function mergeManualPeers(world,hash,base={}){
  const t=torrent(world,hash);if(!t)return null;
  return{...(base||{}),...(t.manualPeers||{})};
}

export function exportTorrentPayload(world,hash){
  const t=torrent(world,hash);if(!t)return null;if(t.has_metadata===false)return'';
  const name=String(t.name||'virtual').replace(/[^\x20-\x7e]/g,'_').slice(0,180)||'virtual';
  const tracker=String(t.tracker||'https://tracker.example/announce');
  const length=Math.max(1,Math.floor(Number(t.size)||MiB));
  return `d8:announce${tracker.length}:${tracker}4:infod6:lengthi${length}e4:name${name.length}:${name}12:piece lengthi${PIECE_SIZE}e6:pieces20:00000000000000000000ee`;
}
