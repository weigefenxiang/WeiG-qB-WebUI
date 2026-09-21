import {hash32} from './random.js';

function normalizePath(value){
  const raw=String(value||'').trim().replace(/\\/g,'/').replace(/\/{2,}/g,'/');
  if(!raw)return'';
  const prefixed=raw.startsWith('/')?raw:`/${raw}`;
  return prefixed.length>1?prefixed.replace(/\/$/,''):prefixed;
}
function log(world,message,type=1,now=Date.now()){
  world.logs=Array.isArray(world.logs)?world.logs:[];
  const id=(world.logs.at(-1)?.id||0)+1;
  world.logs.push({id,message,type,timestamp:Math.floor(now/1000)});
}
function allVirtualPaths(world){
  const dirs=new Set(['/','/downloads','/downloads/incomplete']);
  const files=new Map();
  const addDir=value=>{const path=normalizePath(value);if(!path)return;let current='';for(const part of path.split('/').filter(Boolean)){current+=`/${part}`;dirs.add(current);}};
  for(const category of Object.values(world.categories||{}))addDir(category?.savePath);
  addDir(world.preferences?.save_path);addDir(world.preferences?.temp_path);
  for(const torrent of world.torrents||[]){
    addDir(torrent.savePath);addDir(torrent.downloadPath);
    const content=normalizePath(torrent.contentPath);if(content)addDir(content);
    if(content&&Array.isArray(torrent.files))for(const file of torrent.files){
      const name=String(file.name||'').replace(/\\/g,'/').replace(/^\/+/, '');if(!name)continue;
      const parts=name.split('/').filter(Boolean),leaf=parts.pop();let parent=content;
      for(const part of parts){parent=`${parent}/${part}`;addDir(parent);}
      const path=`${parent}/${leaf}`;files.set(path,{size:Math.max(0,Math.floor(Number(file.size)||0)),torrent});
    }
  }
  return{dirs,files};
}

export function defaultSavePath(world){return String(world.preferences?.save_path||'/downloads');}

export function directoryContent(world,dirPath,mode='all',withMetadata=false){
  const dir=normalizePath(dirPath);if(!dir)return null;
  const visibility=String(mode||'all').toLowerCase();if(!['all','dirs','files'].includes(visibility))return null;
  const {dirs,files}=allVirtualPaths(world);if(!dirs.has(dir))return[];
  const prefix=dir==='/'?'/':`${dir}/`,items=new Map();
  if(visibility!=='files')for(const path of dirs){
    if(path===dir||!path.startsWith(prefix))continue;const rest=path.slice(prefix.length);if(!rest||rest.includes('/'))continue;
    items.set(rest,{name:rest,type:'dir'});
  }
  if(visibility!=='dirs')for(const [path,meta] of files){
    if(!path.startsWith(prefix))continue;const rest=path.slice(prefix.length);if(!rest||rest.includes('/'))continue;
    items.set(rest,{name:rest,type:'file',size:meta.size});
  }
  const now=Math.floor(Date.now()/1000),values=[...items.values()].sort((a,b)=>a.name.localeCompare(b.name));
  if(!withMetadata)return values.map(item=>item.name);
  return values.map(item=>({name:item.name,type:item.type,...(item.type==='file'?{size:item.size}:{}),creation_date:now-86400,last_access_date:now,last_modification_date:now-300}));
}

export function sendTestEmail(world,now=Date.now()){
  world.lastTestEmailAt=Math.floor(now/1000);log(world,'Virtual test email accepted (no external email was sent).',1,now);return true;
}

export function rotateApiKey(world){
  world.apiKeySequence=(Number(world.apiKeySequence)||0)+1;
  const a=hash32(`${world.seed}:api-key:${world.apiKeySequence}:a`).toString(16).padStart(8,'0');
  const b=hash32(`${world.seed}:api-key:${world.apiKeySequence}:b`).toString(16).padStart(8,'0');
  const c=hash32(`${world.seed}:api-key:${world.apiKeySequence}:c`).toString(16).padStart(8,'0');
  const d=hash32(`${world.seed}:api-key:${world.apiKeySequence}:d`).toString(16).padStart(8,'0');
  world.webApiKey=`${a}${b}${c}${d}`;return{apiKey:world.webApiKey};
}
export function deleteApiKey(world){world.webApiKey='';return true;}

export function networkInterfaces(){
  return[{name:'Virtual Ethernet',value:'eth0'},{name:'Virtual Loopback',value:'lo'}];
}
export function networkInterfaceAddresses(iface=''){
  const map={eth0:['192.0.2.10','2001:db8::10'],lo:['127.0.0.1','::1']};
  const key=String(iface||'');return key?(map[key]||[]):[...map.eth0,...map.lo];
}

export function requestShutdown(world,now=Date.now()){
  world.shutdownRequested=true;
  world.environment=world.environment||{};world.environment.online=false;
  log(world,'Virtual qBittorrent shutdown requested; network activity is now offline until reset.',2,now);
  return true;
}
