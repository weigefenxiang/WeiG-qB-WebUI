import {CANONICAL,schedule} from './engine.js';

function selected(world,hashes){
  const text=String(hashes||'');
  if(text==='all')return world.torrents;
  const wanted=new Set(text.split('|').filter(Boolean));
  return world.torrents.filter(t=>wanted.has(t.hash));
}

function record(world,hashes=[]){
  const changed=Array.from(new Set(hashes.filter(Boolean)));
  if(!changed.length)return;
  world.rid=(Number(world.rid)||0)+1;
  world.journal=Array.isArray(world.journal)?world.journal:[];
  world.journal.push({rid:world.rid,changedHashes:changed,removedHashes:[]});
  if(world.journal.length>128)world.journal.splice(0,world.journal.length-128);
}

function appendLog(world,message,type=1,now=Date.now()){
  world.logs=Array.isArray(world.logs)?world.logs:[];
  const id=(world.logs.at(-1)?.id||0)+1;
  world.logs.push({id,message,type,timestamp:Math.floor(now/1000)});
  if(world.logs.length>1000)world.logs.splice(0,world.logs.length-1000);
}

function resumableState(t){
  if(t.completed)return CANONICAL.SEED_QUEUED;
  return CANONICAL.DOWNLOAD_QUEUED;
}

export function advanceActionStates(world,now=Date.now()){
  const changed=[];
  for(const t of world.torrents){
    if(t.checkingUntil&&now>=t.checkingUntil&&t.canonicalState===CANONICAL.CHECKING){
      t.checkingUntil=0;
      t.canonicalState=t.maintenanceResumeState||resumableState(t);
      t.maintenanceResumeState='';
      changed.push(t.hash);
    }
    if(t.movingUntil&&now>=t.movingUntil&&t.canonicalState===CANONICAL.MOVING){
      t.movingUntil=0;
      t.canonicalState=t.maintenanceResumeState||resumableState(t);
      t.maintenanceResumeState='';
      changed.push(t.hash);
    }
  }
  if(changed.length){schedule(world,now,0);record(world,changed);}
  return changed;
}

export function applyRuntimePolicies(world,now=Date.now()){
  advanceActionStates(world,now);
  const env=world.environment||{};
  if(!Number.isFinite(env.basePeerAvailability))env.basePeerAvailability=Math.max(0,Math.min(1,Number(env.peerAvailability)||0));
  const prefs=world.preferences||{};
  const sourceFactor=.45+(prefs.dht!==false?.2:0)+(prefs.pex!==false?.2:0)+(prefs.lsd!==false?.15:0);
  const lossFactor=Math.max(.2,1-Math.max(0,Number(env.packetLoss)||0)*8);
  const latencyFactor=1/(1+Math.max(0,(Number(env.latencyMs)||0)-50)/500);
  env.peerAvailability=Math.max(0,Math.min(1,env.basePeerAvailability*sourceFactor*lossFactor*latencyFactor));

  if(prefs.scheduler_enabled){
    const date=new Date(now),minute=date.getHours()*60+date.getMinutes();
    const start=(Number(prefs.schedule_from_hour)||0)*60+(Number(prefs.schedule_from_min)||0);
    const end=(Number(prefs.schedule_to_hour)||0)*60+(Number(prefs.schedule_to_min)||0);
    const active=start===end?true:(start<end?minute>=start&&minute<end:minute>=start||minute<end);
    world.altSpeedMode=active;
  }
}

export function recheckTorrents(world,hashes,now=Date.now()){
  const changed=[];
  for(const t of selected(world,hashes)){
    if([CANONICAL.ERROR,CANONICAL.METADATA,CANONICAL.MOVING].includes(t.canonicalState))continue;
    t.maintenanceResumeState=t.canonicalState||resumableState(t);
    t.canonicalState=CANONICAL.CHECKING;
    t.checkingUntil=now+2500;
    t.lastStateChange=Math.floor(now/1000);
    changed.push(t.hash);
  }
  if(changed.length){record(world,changed);appendLog(world,`Rechecking ${changed.length} virtual torrent(s).`,1,now);}
  return changed.length;
}

export function reannounceTorrents(world,hashes,now=Date.now()){
  const changed=[];
  for(const t of selected(world,hashes)){
    for(const tracker of t.trackers||[]){tracker.status=2;tracker.msg='';tracker.last_announce=Math.floor(now/1000);}
    changed.push(t.hash);
  }
  if(changed.length){record(world,changed);appendLog(world,`Reannounced ${changed.length} virtual torrent(s).`,1,now);}
  return changed.length;
}

export function setAutoManagement(world,hashes,value){
  const changed=[];
  for(const t of selected(world,hashes)){t.autoManagement=!!value;changed.push(t.hash);}
  record(world,changed);return changed.length;
}

export function toggleSequential(world,hashes){
  const changed=[];
  for(const t of selected(world,hashes)){t.sequential=!t.sequential;changed.push(t.hash);}
  record(world,changed);return changed.length;
}

export function toggleFirstLast(world,hashes){
  const changed=[];
  for(const t of selected(world,hashes)){t.firstLastPriority=!t.firstLastPriority;changed.push(t.hash);}
  record(world,changed);return changed.length;
}

export function movePriority(world,hashes,where,now=Date.now()){
  const targets=selected(world,hashes),changed=[];
  if(!targets.length)return 0;
  if(where==='top'){
    let pos=Math.min(...world.torrents.map(t=>Number(t.queuePosition)||0),0)-targets.length;
    for(const t of targets){t.queuePosition=pos++;t.priority=1;changed.push(t.hash);}
  }else{
    let pos=Math.max(...world.torrents.map(t=>Number(t.queuePosition)||0),0)+1;
    for(const t of targets){t.queuePosition=pos++;t.priority=1;changed.push(t.hash);}
  }
  schedule(world,now,0);record(world,changed);return changed.length;
}

export function setLocation(world,hashes,location,now=Date.now()){
  const path=String(location||'').trim();
  if(!path)return 0;
  const changed=[];
  for(const t of selected(world,hashes)){
    t.savePath=path;
    const leaf=String(t.name||'torrent').replace(/[\\/]+/g,'_');
    t.contentPath=`${path.replace(/\/$/,'')}/${leaf}`;
    t.maintenanceResumeState=t.canonicalState||resumableState(t);
    t.canonicalState=CANONICAL.MOVING;
    t.movingUntil=now+1800;
    t.lastStateChange=Math.floor(now/1000);
    changed.push(t.hash);
  }
  if(changed.length){record(world,changed);appendLog(world,`Moved ${changed.length} virtual torrent(s) to ${path}.`,1,now);}
  return changed.length;
}

export function setFilePriority(world,hash,ids,priority){
  const t=world.torrents.find(x=>x.hash===String(hash||''));
  if(!t)return false;
  const wanted=new Set(String(ids??'').split('|').flatMap(x=>x.split(',')).map(x=>Number(x)).filter(Number.isFinite));
  const value=Math.max(0,Math.round(Number(priority)||0));
  let changed=false;
  for(const file of t.files||[]){
    if(!wanted.size||wanted.has(Number(file.index))){file.priority=value;changed=true;}
  }
  if(changed)record(world,[t.hash]);
  return changed;
}

function parseTrackerUrls(value){
  return String(value||'').split(/[\r\n]+/).map(x=>x.trim()).filter(Boolean);
}

export function addTrackers(world,hash,urls){
  const t=world.torrents.find(x=>x.hash===String(hash||''));if(!t)return false;
  const existing=new Set((t.trackers||[]).map(x=>x.url));
  for(const url of parseTrackerUrls(urls))if(!existing.has(url)){t.trackers.push({url,status:0,tier:0,num_peers:0,num_seeds:0,num_leeches:0,num_downloaded:0,msg:'Not contacted yet'});existing.add(url);}
  record(world,[t.hash]);return true;
}

export function removeTrackers(world,hash,urls){
  const t=world.torrents.find(x=>x.hash===String(hash||''));if(!t)return false;
  const doomed=new Set(parseTrackerUrls(urls));
  t.trackers=(t.trackers||[]).filter(x=>!doomed.has(x.url));
  if(doomed.has(t.tracker))t.tracker=t.trackers[0]?.url||'';
  record(world,[t.hash]);return true;
}

export function editTracker(world,hash,oldUrl,newUrl){
  const t=world.torrents.find(x=>x.hash===String(hash||''));if(!t)return false;
  const tracker=(t.trackers||[]).find(x=>x.url===String(oldUrl||''));if(!tracker)return false;
  tracker.url=String(newUrl||'').trim();tracker.status=0;tracker.msg='Not contacted yet';
  if(t.tracker===oldUrl)t.tracker=tracker.url;
  record(world,[t.hash]);return true;
}

export function banPeers(world,peers){
  world.bannedPeers=Array.isArray(world.bannedPeers)?world.bannedPeers:[];
  const incoming=String(peers||'').split('|').map(x=>x.trim()).filter(Boolean);
  world.bannedPeers=Array.from(new Set([...world.bannedPeers,...incoming]));
  if(incoming.length)appendLog(world,`Banned ${incoming.length} virtual peer(s).`);
  return incoming.length;
}

export function filterBannedPeers(world,peerMap){
  const banned=new Set(world.bannedPeers||[]),out={};
  for(const [key,value] of Object.entries(peerMap||{})){
    const endpoint=`${value?.ip||''}:${value?.port||''}`;
    if(!banned.has(key)&&!banned.has(endpoint))out[key]=value;
  }
  return out;
}
