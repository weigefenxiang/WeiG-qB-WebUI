import {CANONICAL,normalizeQueuePositions,reconcileManagedPaths,recordTorrentChanges,schedule} from './engine.js';
import {deterministicUnit,hash32} from './random.js';

const MiB=1024*1024;
const runtimeDiagnostics=new WeakMap();

function diagnosticsFor(world){
  let stats=runtimeDiagnostics.get(world);
  if(!stats){stats={actionStateScans:0,environmentHeavyScans:0,heavyTorrentsVisited:0};runtimeDiagnostics.set(world,stats);}
  return stats;
}

export function simulatorRuntimePolicyStats(world){
  return{...diagnosticsFor(world)};
}

function selected(world,hashes){
  const text=String(hashes||'');
  if(text==='all')return world.torrents;
  const wanted=new Set(text.split('|').filter(Boolean));
  return world.torrents.filter(t=>wanted.has(t.hash));
}

function appendLog(world,message,type=1,now=Date.now()){
  world.logs=Array.isArray(world.logs)?world.logs:[];
  const id=(world.logs.at(-1)?.id||0)+1;
  world.logs.push({id,message,type,timestamp:Math.floor(now/1000)});
  if(world.logs.length>1000)world.logs.splice(0,world.logs.length-1000);
}

function appendPeerLog(world,endpoint,reason,blocked=false,now=Date.now()){
  world.peerLogs=Array.isArray(world.peerLogs)?world.peerLogs:[];
  const [ip,portText]=String(endpoint||'0.0.0.0:0').split(':');
  const id=(world.peerLogs.at(-1)?.id||0)+1;
  world.peerLogs.push({id,ip,port:Number(portText)||0,blocked:!!blocked,reason:String(reason||''),timestamp:Math.floor(now/1000)});
  if(world.peerLogs.length>500)world.peerLogs.splice(0,world.peerLogs.length-500);
}

function resumableState(t){
  if(t.completed)return CANONICAL.SEED_QUEUED;
  return CANONICAL.DOWNLOAD_QUEUED;
}

function noteActionTransition(world,at){
  const when=Math.max(0,Number(at)||0);
  if(!when)return;
  const current=Number(world.nextActionTransitionAt);
  if(current===-1||!Number.isFinite(current)||current<=0||when<current)world.nextActionTransitionAt=when;
}

export function advanceActionStates(world,now=Date.now()){
  const next=Number(world.nextActionTransitionAt);
  if(next===-1)return[];
  if(Number.isFinite(next)&&next>now)return[];
  diagnosticsFor(world).actionStateScans++;
  const changed=[];
  let nextAt=-1;
  for(const t of world.torrents){
    if(t.checkingUntil&&t.canonicalState===CANONICAL.CHECKING){
      if(now>=t.checkingUntil){
        t.checkingUntil=0;
        t.canonicalState=t.maintenanceResumeState||resumableState(t);
        t.maintenanceResumeState='';
        changed.push(t.hash);
      }else nextAt=nextAt===-1?t.checkingUntil:Math.min(nextAt,t.checkingUntil);
    }
    if(t.movingUntil&&t.canonicalState===CANONICAL.MOVING){
      if(now>=t.movingUntil){
        t.movingUntil=0;
        t.canonicalState=t.maintenanceResumeState||resumableState(t);
        t.maintenanceResumeState='';
        changed.push(t.hash);
      }else nextAt=nextAt===-1?t.movingUntil:Math.min(nextAt,t.movingUntil);
    }
  }
  world.nextActionTransitionAt=nextAt;
  if(changed.length){
    const scheduled=schedule(world,now,0);
    recordTorrentChanges(world,[...changed,...scheduled.changed],[]);
  }
  return changed;
}

function ensureEnvironmentBaseline(world){
  const env=world.environment||{};
  const pairs=[
    ['basePeerAvailability','peerAvailability'],
    ['baseDownCapacity','downCapacity'],
    ['baseUpCapacity','upCapacity'],
    ['baseDiskWriteCapacity','diskWriteCapacity'],
    ['baseDiskReadCapacity','diskReadCapacity'],
    ['baseLatencyMs','latencyMs'],
    ['baseJitterMs','jitterMs'],
    ['basePacketLoss','packetLoss'],
    ['baseTrackerFailureRate','trackerFailureRate'],
    ['baseFreeSpace','freeSpace']
  ];
  for(const [base,current] of pairs){
    if(!Number.isFinite(env[base]))env[base]=Math.max(0,Number(env[current])||0);
  }
  world.environment=env;
  return env;
}

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function smoothstep(value){const x=clamp(value,0,1);return x*x*(3-2*x);}
function runtimeSeed(world){return String(world.networkSeed||world.seed||'virtual');}

function interpolatedNoise(seed,key,now,periodMs){
  const bucket=Math.floor(now/periodMs),phase=(now-bucket*periodMs)/periodMs;
  const a=deterministicUnit(seed,`${key}:${bucket}`),b=deterministicUnit(seed,`${key}:${bucket+1}`);
  return a+(b-a)*smoothstep(phase);
}

function configuredRateLimit(world,direction){
  const prefs=world.preferences||{};
  if(world.altSpeedMode){
    const kib=direction==='down'?Number(prefs.alt_dl_limit)||0:Number(prefs.alt_up_limit)||0;
    return Math.max(0,kib*1024);
  }
  return Math.max(0,direction==='down'?Number(world.globalDownloadLimit)||0:Number(world.globalUploadLimit)||0);
}

function limiterPacingFactor(world,now,direction){
  const seed=runtimeSeed(world);
  const microLoss=interpolatedNoise(seed,`limit-${direction}-micro`,now,1600)*.012;
  const driftLoss=interpolatedNoise(seed,`limit-${direction}-drift`,now,12000)*.004;
  const eventPeriod=45000,eventBucket=Math.floor(now/eventPeriod),eventPhase=(now-eventBucket*eventPeriod)/eventPeriod;
  const eventRoll=deterministicUnit(seed,`limit-${direction}-event:${eventBucket}`);
  let dip=0;
  if(eventRoll<.15){
    const depth=.05+deterministicUnit(seed,`limit-${direction}-event-depth:${eventBucket}`)*.05;
    dip=depth*Math.sin(Math.PI*eventPhase)**2;
  }
  return clamp(1-microLoss-driftLoss-dip,.88,1);
}

function applyConfiguredLimitPacing(world,now){
  const env=ensureEnvironmentBaseline(world);
  const physicalDown=Math.max(0,Number(env.waveDownCapacity??env.downCapacity??env.baseDownCapacity)||0);
  const physicalUp=Math.max(0,Number(env.waveUpCapacity??env.upCapacity??env.baseUpCapacity)||0);
  const downLimit=configuredRateLimit(world,'down'),upLimit=configuredRateLimit(world,'up');
  env.downCapacity=downLimit>0?Math.min(physicalDown,Math.floor(downLimit*limiterPacingFactor(world,now,'down'))):physicalDown;
  env.upCapacity=upLimit>0?Math.min(physicalUp,Math.floor(upLimit*limiterPacingFactor(world,now,'up'))):physicalUp;
}

function physicalLinkFactor(world,now,direction){
  const seed=runtimeSeed(world);
  const microLoss=interpolatedNoise(seed,`physical-${direction}-micro`,now,1800)*.012;
  const driftLoss=interpolatedNoise(seed,`physical-${direction}-drift`,now,18000)*.015;
  const eventPeriod=60000,eventBucket=Math.floor(now/eventPeriod),eventPhase=(now-eventBucket*eventPeriod)/eventPeriod;
  const eventRoll=deterministicUnit(seed,`physical-${direction}-event:${eventBucket}`);
  let dip=0;
  if(eventRoll<.18){
    const depth=.05+deterministicUnit(seed,`physical-${direction}-event-depth:${eventBucket}`)*.05;
    dip=depth*Math.sin(Math.PI*eventPhase)**2;
  }
  return clamp(1-microLoss-driftLoss-dip,.88,1);
}

function applyLightweightCapacityWave(world,now){
  const env=ensureEnvironmentBaseline(world);
  env.waveDownCapacity=Math.max(0,Math.floor(env.baseDownCapacity*physicalLinkFactor(world,now,'down')));
  env.waveUpCapacity=Math.max(0,Math.floor(env.baseUpCapacity*physicalLinkFactor(world,now,'up')));
  env.downCapacity=env.waveDownCapacity;
  env.upCapacity=env.waveUpCapacity;
  const seed=runtimeSeed(world);
  const diskWriteWave=.94+interpolatedNoise(seed,'disk-write-wave',now,8000)*.06;
  const diskReadWave=.95+interpolatedNoise(seed,'disk-read-wave',now,9000)*.05;
  env.diskWriteCapacity=Math.max(0,Math.floor(env.baseDiskWriteCapacity*diskWriteWave));
  env.diskReadCapacity=Math.max(0,Math.floor(env.baseDiskReadCapacity*diskReadWave));
  return env;
}

function heavySample(world,bucket){
  const torrents=world.torrents||[],length=torrents.length;
  if(!length)return[];
  const count=Math.min(length,Math.max(128,Math.min(512,Math.ceil(length*.05))));
  const start=hash32(`${runtimeSeed(world)}:environment-sample:${bucket}`)%length;
  const sample=new Array(count);
  for(let i=0;i<count;i++)sample[i]=torrents[(start+i)%length];
  return sample;
}

function applyEnvironmentWave(world,now){
  const env=applyLightweightCapacityWave(world,now);
  const bucket=Math.floor(now/15000);
  if(world.runtimePolicyBucket===bucket)return[];
  world.runtimePolicyBucket=bucket;
  const seed=runtimeSeed(world),stats=diagnosticsFor(world),sample=heavySample(world,bucket);
  stats.environmentHeavyScans++;
  stats.heavyTorrentsVisited+=sample.length;
  env.latencyMs=Math.max(0,Math.round(env.baseLatencyMs+deterministicUnit(seed,`latency:${bucket}`)*Math.max(2,env.baseJitterMs)));
  env.packetLoss=clamp(env.basePacketLoss*(.8+deterministicUnit(seed,`loss:${bucket}`)*.4),0,.35);
  env.trackerFailureRate=clamp(env.baseTrackerFailureRate+deterministicUnit(seed,`tracker-rate:${bucket}`)*.035,0,.95);
  env.freeSpace=Math.max(0,Math.floor(env.baseFreeSpace-Math.max(0,Number(world.stats?.alltime_dl)||0)));
  if(world.preferences?.dht!==false)world.stats.dht_nodes=180+Math.floor(deterministicUnit(seed,`dht:${bucket}`)*360);
  else world.stats.dht_nodes=0;

  const changed=[];
  let peerEvents=0,trackerEvents=0;
  for(const t of sample){
    const swarmRoll=deterministicUnit(seed,`${t.hash}:swarm:${bucket}`);
    if(swarmRoll>.992){
      const direction=deterministicUnit(seed,`${t.hash}:swarm-direction:${bucket}`)>.5?1:-1;
      if(t.completed)t.leechers=Math.max(0,(Number(t.leechers)||0)+direction);
      else t.seeders=Math.max(0,(Number(t.seeders)||0)+direction);
      changed.push(t.hash);
      if(peerEvents<4){
        const endpoint=`10.${(hash32(t.hash)>>16)&255}.${(hash32(t.hash)>>8)&255}.${hash32(t.hash)&255}:${40000+(hash32(`${t.hash}:${bucket}`)%20000)}`;
        appendPeerLog(world,endpoint,direction>0?'Virtual peer connected':'Virtual peer disconnected',false,now);
        peerEvents++;
      }
    }
    for(const tracker of t.trackers||[]){
      const roll=deterministicUnit(seed,`${t.hash}:${tracker.url}:tracker:${bucket}`);
      if(roll<env.trackerFailureRate*.08){
        if(tracker.status!==4||tracker.msg!=='Virtual tracker timeout'){
          tracker.status=4;tracker.msg='Virtual tracker timeout';trackerEvents++;changed.push(t.hash);
        }
      }else if(tracker.msg==='Virtual tracker timeout'){
        tracker.status=2;tracker.msg='';tracker.last_announce=Math.floor(now/1000);trackerEvents++;changed.push(t.hash);
      }
    }
  }
  if(trackerEvents)appendLog(world,`${trackerEvents} virtual tracker state transition(s).`,2,now);

  const lowDisk=env.freeSpace<=64*MiB;
  if(lowDisk){
    const victim=(world.torrents||[]).find(t=>!t.completed&&!t.forceStart&&![CANONICAL.ERROR,CANONICAL.DOWNLOAD_PAUSED,CANONICAL.CHECKING,CANONICAL.MOVING].includes(t.canonicalState));
    if(victim){
      victim.canonicalState=CANONICAL.ERROR;
      victim.error='Virtual disk is full';
      victim.lastStateChange=Math.floor(now/1000);
      changed.push(victim.hash);
      world.diskFullActive=true;
      appendLog(world,`Disk space exhausted: ${victim.name}`,4,now);
    }
  }else if(env.freeSpace>256*MiB&&world.diskFullActive){
    for(const t of world.torrents||[]){
      if(t.canonicalState===CANONICAL.ERROR&&t.error==='Virtual disk is full'){
        t.error='';t.canonicalState=t.completed?CANONICAL.SEED_QUEUED:CANONICAL.DOWNLOAD_QUEUED;changed.push(t.hash);
      }
    }
    world.diskFullActive=false;
  }
  return Array.from(new Set(changed));
}

export function applyRuntimePolicies(world,now=Date.now()){
  advanceActionStates(world,now);
  const changed=applyEnvironmentWave(world,now);
  const env=ensureEnvironmentBaseline(world);
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
  applyConfiguredLimitPacing(world,now);
  if(changed.length){
    const scheduled=schedule(world,now,0);
    recordTorrentChanges(world,[...changed,...scheduled.changed],[]);
  }
  return changed;
}

export function recheckTorrents(world,hashes,now=Date.now()){
  const changed=[];
  for(const t of selected(world,hashes)){
    if([CANONICAL.ERROR,CANONICAL.METADATA,CANONICAL.MOVING].includes(t.canonicalState))continue;
    t.maintenanceResumeState=t.canonicalState||resumableState(t);
    t.canonicalState=CANONICAL.CHECKING;
    t.checkingUntil=now+2500;
    noteActionTransition(world,t.checkingUntil);
    t.lastStateChange=Math.floor(now/1000);
    changed.push(t.hash);
  }
  if(changed.length){recordTorrentChanges(world,changed,[]);appendLog(world,`Rechecking ${changed.length} virtual torrent(s).`,1,now);}
  return changed.length;
}

export function reannounceTorrents(world,hashes,now=Date.now()){
  const changed=[];
  for(const t of selected(world,hashes)){
    for(const tracker of t.trackers||[]){tracker.status=2;tracker.msg='';tracker.last_announce=Math.floor(now/1000);}
    changed.push(t.hash);
  }
  if(changed.length){recordTorrentChanges(world,changed,[]);appendLog(world,`Reannounced ${changed.length} virtual torrent(s).`,1,now);}
  return changed.length;
}

export function setAutoManagement(world,hashes,value){
  const changed=[];
  for(const t of selected(world,hashes)){t.autoManagement=!!value;changed.push(t.hash);}
  const managed=reconcileManagedPaths(world,hashes);
  recordTorrentChanges(world,[...changed,...managed],[]);
  return changed.length;
}

export function toggleSequential(world,hashes){
  const changed=[];
  for(const t of selected(world,hashes)){t.sequential=!t.sequential;changed.push(t.hash);}
  recordTorrentChanges(world,changed,[]);return changed.length;
}

export function toggleFirstLast(world,hashes){
  const changed=[];
  for(const t of selected(world,hashes)){t.firstLastPriority=!t.firstLastPriority;changed.push(t.hash);}
  recordTorrentChanges(world,changed,[]);return changed.length;
}

function queueOrder(world){
  return [...world.torrents].sort((a,b)=>(Number(a.queuePosition)||Number.MAX_SAFE_INTEGER)-(Number(b.queuePosition)||Number.MAX_SAFE_INTEGER)||String(a.hash).localeCompare(String(b.hash)));
}

export function movePriority(world,hashes,where,now=Date.now()){
  const targetSet=new Set(selected(world,hashes).map(t=>t.hash));
  if(!targetSet.size)return 0;
  let ordered=queueOrder(world);
  const targets=ordered.filter(t=>targetSet.has(t.hash)),rest=ordered.filter(t=>!targetSet.has(t.hash));
  if(where==='top')ordered=[...targets,...rest];
  else if(where==='bottom')ordered=[...rest,...targets];
  else if(where==='increase'){
    for(let i=1;i<ordered.length;i++){
      if(targetSet.has(ordered[i].hash)&&!targetSet.has(ordered[i-1].hash)){
        [ordered[i-1],ordered[i]]=[ordered[i],ordered[i-1]];
      }
    }
  }else if(where==='decrease'){
    for(let i=ordered.length-2;i>=0;i--){
      if(targetSet.has(ordered[i].hash)&&!targetSet.has(ordered[i+1].hash)){
        [ordered[i],ordered[i+1]]=[ordered[i+1],ordered[i]];
      }
    }
  }
  const changed=[];
  for(let i=0;i<ordered.length;i++){
    const position=i+1,t=ordered[i];
    if(t.queuePosition!==position||t.priority!==position)changed.push(t.hash);
    t.queuePosition=position;t.priority=position;
  }
  normalizeQueuePositions(world);
  const scheduled=schedule(world,now,0);
  recordTorrentChanges(world,[...changed,...scheduled.changed],[]);
  return targetSet.size;
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
    noteActionTransition(world,t.movingUntil);
    t.lastStateChange=Math.floor(now/1000);
    changed.push(t.hash);
  }
  if(changed.length){recordTorrentChanges(world,changed,[]);appendLog(world,`Moved ${changed.length} virtual torrent(s) to ${path}.`,1,now);}
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
  if(changed)recordTorrentChanges(world,[t.hash],[]);
  return changed;
}

function parseTrackerUrls(value){
  return String(value||'').split(/[\r\n]+/).map(x=>x.trim()).filter(Boolean);
}

export function addTrackers(world,hash,urls){
  const t=world.torrents.find(x=>x.hash===String(hash||''));if(!t)return false;
  const existing=new Set((t.trackers||[]).map(x=>x.url));
  for(const url of parseTrackerUrls(urls))if(!existing.has(url)){t.trackers.push({url,status:0,tier:0,num_peers:0,num_seeds:0,num_leeches:0,num_downloaded:0,msg:'Not contacted yet'});existing.add(url);}
  recordTorrentChanges(world,[t.hash],[]);return true;
}

export function removeTrackers(world,hash,urls){
  const t=world.torrents.find(x=>x.hash===String(hash||''));if(!t)return false;
  const doomed=new Set(parseTrackerUrls(urls));
  t.trackers=(t.trackers||[]).filter(x=>!doomed.has(x.url));
  if(doomed.has(t.tracker))t.tracker=t.trackers[0]?.url||'';
  recordTorrentChanges(world,[t.hash],[]);return true;
}

export function editTracker(world,hash,oldUrl,newUrl){
  const t=world.torrents.find(x=>x.hash===String(hash||''));if(!t)return false;
  const tracker=(t.trackers||[]).find(x=>x.url===String(oldUrl||''));if(!tracker)return false;
  tracker.url=String(newUrl||'').trim();tracker.status=0;tracker.msg='Not contacted yet';
  if(t.tracker===oldUrl)t.tracker=tracker.url;
  recordTorrentChanges(world,[t.hash],[]);return true;
}

export function banPeers(world,peers){
  world.bannedPeers=Array.isArray(world.bannedPeers)?world.bannedPeers:[];
  const incoming=String(peers||'').split('|').map(x=>x.trim()).filter(Boolean);
  world.bannedPeers=Array.from(new Set([...world.bannedPeers,...incoming]));
  for(const endpoint of incoming)appendPeerLog(world,endpoint,'Banned by Virtual qB user',true);
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

export function peerLogItems(world,lastId=-1){
  return (world.peerLogs||[]).filter(item=>Number(item.id)>Number(lastId||-1));
}
