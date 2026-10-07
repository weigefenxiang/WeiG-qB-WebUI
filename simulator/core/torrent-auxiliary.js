import {recordTorrentChanges} from './engine.js';
import {deterministicUnit,hash32} from './random.js';
import {torrentIndex,torrentsByHashes} from './runtime-index.js';
import {indexedWebseedList as webseedList} from './webseed-view.js';

const MiB=1024*1024;
const PIECE_SIZE=4*MiB;

function selected(world,hashes){
  const text=String(hashes||'');
  if(text==='all')return world.torrents||[];
  return torrentsByHashes(world,text).torrents;
}
function torrent(world,hash){return torrentIndex(world).byHash.get(String(hash||''))||null;}
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
function hex40(seed){
  let out='';
  for(let i=0;i<5;i++)out+=hash32(`${seed}:${i}`).toString(16).padStart(8,'0');
  return out.slice(0,40);
}
function metadataStore(world){
  world.metadataSources=world.metadataSources&&typeof world.metadataSources==='object'?world.metadataSources:{};
  return world.metadataSources;
}
function clientStore(world){
  world.clientData=world.clientData&&typeof world.clientData==='object'?world.clientData:{};
  return world.clientData;
}
function sourceName(source){
  const text=String(source||'').trim();
  try{
    const url=new URL(text);
    const dn=url.searchParams.get('dn');
    if(dn)return dn.slice(0,180);
    const leaf=decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1)||'').replace(/\.torrent$/i,'');
    if(leaf)return leaf.slice(0,180);
  }catch{}
  const magnetName=text.match(/[?&]dn=([^&]+)/i);
  if(magnetName){try{return decodeURIComponent(magnetName[1].replace(/\+/g,' ')).slice(0,180);}catch{}}
  return (text.replace(/^.*[\\/]/,'').replace(/\.torrent$/i,'')||'Virtual metadata').slice(0,180);
}
function metadataDescriptor(world,source,now=Date.now(),sizeHint=0){
  const name=sourceName(source),unit=deterministicUnit(world.seed,`metadata:${source}`),size=Math.max(32*MiB,Math.round(Number(sizeHint)||((600+unit*7600)*MiB)));
  const first=Math.max(1,Math.floor(size*.62)),second=Math.max(1,Math.floor(size*.28)),third=Math.max(1,size-first-second);
  return{
    infohash_v1:hex40(`${world.seed}:${source}:v1`),
    infohash_v2:'',
    comment:'WeiG Virtual qB metadata preview',
    creation_date:Math.floor(now/1000)-86400,
    trackers:[['https://tracker.example/announce']],
    webseeds:[],
    info:{
      name,
      length:size,
      piece_length:PIECE_SIZE,
      files:[
        {path:`${name}/content.bin`,length:first},
        {path:`${name}/README.txt`,length:second},
        {path:`${name}/metadata.json`,length:third}
      ]
    }
  };
}
function partialMetadata(metadata){
  return{
    infohash_v1:metadata.infohash_v1,
    infohash_v2:metadata.infohash_v2,
    info:{name:metadata.info?.name}
  };
}
function cacheMetadata(world,source,metadata,now=Date.now(),ready=true){
  const store=metadataStore(world),key=String(source||'').trim();
  store[key]={source:key,createdAt:now,readyAt:ready?now:(now+750),polls:ready?2:0,ready:!!ready,metadata};
  return store[key];
}
function bencodeMetadata(metadata){
  const name=String(metadata?.info?.name||'virtual').replace(/[^\x20-\x7e]/g,'_').slice(0,180)||'virtual';
  const length=Math.max(1,Math.floor(Number(metadata?.info?.length)||MiB));
  return `d4:infod6:lengthi${length}e4:name${name.length}:${name}12:piece lengthi${PIECE_SIZE}e6:pieces20:00000000000000000000ee`;
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

export function getSSLParameters(world,hash){
  const t=torrent(world,hash);if(!t)return null;
  const ssl=t.sslParameters&&typeof t.sslParameters==='object'?t.sslParameters:{};
  return{
    ssl_certificate:String(ssl.certificate||''),
    ssl_private_key:String(ssl.privateKey||''),
    ssl_dh_params:String(ssl.dhParams||'')
  };
}

export function setSSLParameters(world,hash,values={}){
  const t=torrent(world,hash);if(!t)return false;
  t.sslParameters={
    certificate:String(values.ssl_certificate??''),
    privateKey:String(values.ssl_private_key??''),
    dhParams:String(values.ssl_dh_params??'')
  };
  recordTorrentChanges(world,[t.hash],[]);
  return true;
}

export function fetchMetadata(world,source,now=Date.now()){
  const key=String(source||'').trim();if(!key)return null;
  const store=metadataStore(world);
  let entry=store[key];
  if(!entry)entry=cacheMetadata(world,key,metadataDescriptor(world,key,now),now,false);
  entry.polls=Math.max(0,Number(entry.polls)||0)+1;
  if(!entry.ready&&(entry.polls>=2||now>=Number(entry.readyAt||0)))entry.ready=true;
  return{status:entry.ready?200:202,metadata:entry.ready?entry.metadata:partialMetadata(entry.metadata)};
}

export function parseMetadata(world,items=[],now=Date.now(),arrayResponse=true){
  const list=Array.isArray(items)?items:[],metadata=[];
  for(let i=0;i<list.length;i++){
    const item=list[i],name=String(item?.name||`virtual-${i+1}.torrent`),size=Math.max(0,Number(item?.size)||0);
    const source=`file:${name}:${size}:${i}`,value=metadataDescriptor(world,source,now,size>0?Math.max(size*4096,32*MiB):0);
    cacheMetadata(world,source,value,now,true);
    metadata.push({name,source,metadata:value});
  }
  if(arrayResponse)return metadata.map(x=>x.metadata);
  return Object.fromEntries(metadata.map(x=>[x.name,x.metadata]));
}

export function saveMetadata(world,source){
  const entry=metadataStore(world)[String(source||'').trim()];
  if(!entry||!entry.ready)return null;
  return{payload:bencodeMetadata(entry.metadata),name:`${String(entry.metadata?.info?.name||'virtual').replace(/[^\w.-]+/g,'_')}.torrent`};
}

export function metadataForAdd(world,source){
  const entry=metadataStore(world)[String(source||'').trim()];
  return entry?.ready?entry.metadata:null;
}

export function processInfo(world){
  if(!Number.isFinite(Number(world.launchTime)))world.launchTime=Math.floor(Number(world.lastTick||Date.now())/1000);
  return{launch_time:Math.floor(Number(world.launchTime))};
}

export function loadClientData(world,keys=null){
  const store=clientStore(world);
  if(!Array.isArray(keys))return{...store};
  const out={};
  for(const key of keys)if(Object.prototype.hasOwnProperty.call(store,key))out[key]=store[key];
  return out;
}

export function storeClientData(world,data={}){
  const store=clientStore(world);
  for(const [key,value] of Object.entries(data&&typeof data==='object'?data:{})){
    if(value===null)delete store[key];
    else store[key]=value;
  }
  return true;
}

export function exportTorrentPayload(world,hash){
  const t=torrent(world,hash);if(!t)return null;if(t.has_metadata===false)return'';
  const name=String(t.name||'virtual').replace(/[^\x20-\x7e]/g,'_').slice(0,180)||'virtual';
  const tracker=String(t.tracker||'https://tracker.example/announce');
  const length=Math.max(1,Math.floor(Number(t.size)||MiB));
  return `d8:announce${tracker.length}:${tracker}4:infod6:lengthi${length}e4:name${name.length}:${name}12:piece lengthi${PIECE_SIZE}e6:pieces20:00000000000000000000ee`;
}
