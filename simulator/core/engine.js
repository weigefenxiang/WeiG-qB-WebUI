import {createRng,int,pick,range,deterministicUnit,hash32} from './random.js';
import {normalizeProfile,atLeast} from './profiles.js';

export const CANONICAL={
  DOWNLOAD_ACTIVE:'DOWNLOAD_ACTIVE',
  DOWNLOAD_STALLED:'DOWNLOAD_STALLED',
  DOWNLOAD_PAUSED:'DOWNLOAD_PAUSED',
  DOWNLOAD_QUEUED:'DOWNLOAD_QUEUED',
  SEED_ACTIVE:'SEED_ACTIVE',
  SEED_STALLED:'SEED_STALLED',
  SEED_PAUSED:'SEED_PAUSED',
  SEED_QUEUED:'SEED_QUEUED',
  CHECKING:'CHECKING',
  METADATA:'METADATA',
  MOVING:'MOVING',
  ERROR:'ERROR'
};

const MiB=1024*1024;
const GiB=1024*MiB;

export const DEFAULT_PREFERENCES={
  save_path:'/downloads',
  temp_path:'/downloads/incomplete',
  temp_path_enabled:true,
  preallocate_all:false,
  create_subfolder_enabled:true,
  start_paused_enabled:false,
  auto_tmm_enabled:false,
  torrent_content_layout:'Original',
  listen_port:6881,
  upnp:false,
  random_port:false,
  max_connec:500,
  max_connec_per_torrent:100,
  max_uploads:20,
  max_uploads_per_torrent:4,
  proxy_type:0,
  proxy_ip:'',
  proxy_port:8080,
  proxy_username:'',
  dl_limit:0,
  up_limit:0,
  alt_dl_limit:10240,
  alt_up_limit:2048,
  scheduler_enabled:false,
  schedule_from_hour:8,
  schedule_to_hour:20,
  limit_utp_rate:true,
  limit_tcp_overhead:false,
  dht:true,
  pex:true,
  lsd:true,
  encryption:0,
  queueing_enabled:true,
  max_active_downloads:8,
  max_active_uploads:24,
  max_active_torrents:30,
  max_ratio:2,
  max_ratio_enabled:false,
  max_seeding_time:1440,
  max_seeding_time_enabled:false,
  web_ui_domain_list:'*',
  web_ui_address:'*',
  web_ui_port:8080,
  web_ui_upnp:false,
  web_ui_username:'demo',
  web_ui_csrf_protection_enabled:true,
  web_ui_clickjacking_protection_enabled:true,
  web_ui_host_header_validation_enabled:true,
  web_ui_localhost_auth_enabled:false,
  web_ui_max_auth_fail_count:5,
  web_ui_ban_duration:3600,
  alternative_webui_enabled:true,
  alternative_webui_path:'/config/weigg-qb-webui',
  socket_receive_buffer_size:0,
  torrent_file_size_limit:104857600,
  upload_choking_algorithm:1
};

export const DEFAULT_ENVIRONMENT={
  profile:'seedbox',
  downCapacity:320*MiB,
  upCapacity:96*MiB,
  diskWriteCapacity:180*MiB,
  diskReadCapacity:260*MiB,
  freeSpace:4*1024*GiB,
  latencyMs:28,
  jitterMs:12,
  packetLoss:0.001,
  trackerFailureRate:0.015,
  peerAvailability:0.92,
  online:true
};

const CATEGORIES=['Linux','Movies','TV','Music','Archive','Games','Books','Software','Private'];
const TAGS=['fast','archive','pt','public','favorite','seedbox','large','small'];
const TRACKERS=[
  'https://tracker.example/announce',
  'https://tracker2.example/announce',
  'https://pt.example/announce',
  'udp://tracker.example:6969/announce'
];

function makeHash(seed,index){
  const a=hash32(`${seed}:${index}:a`).toString(16).padStart(8,'0');
  const b=hash32(`${seed}:${index}:b`).toString(16).padStart(8,'0');
  const c=hash32(`${seed}:${index}:c`).toString(16).padStart(8,'0');
  const d=hash32(`${seed}:${index}:d`).toString(16).padStart(8,'0');
  const e=hash32(`${seed}:${index}:e`).toString(16).padStart(8,'0');
  return (a+b+c+d+e).slice(0,40);
}

function initialState(bucket){
  if(bucket<18)return CANONICAL.DOWNLOAD_ACTIVE;
  if(bucket<30)return CANONICAL.DOWNLOAD_STALLED;
  if(bucket<37)return CANONICAL.DOWNLOAD_QUEUED;
  if(bucket<42)return CANONICAL.DOWNLOAD_PAUSED;
  if(bucket<62)return CANONICAL.SEED_ACTIVE;
  if(bucket<77)return CANONICAL.SEED_STALLED;
  if(bucket<85)return CANONICAL.SEED_QUEUED;
  if(bucket<90)return CANONICAL.SEED_PAUSED;
  if(bucket<93)return CANONICAL.CHECKING;
  if(bucket<95)return CANONICAL.METADATA;
  if(bucket<97)return CANONICAL.ERROR;
  if(bucket<98)return CANONICAL.MOVING;
  return CANONICAL.SEED_ACTIVE;
}

function isCompleteState(state){
  return [CANONICAL.SEED_ACTIVE,CANONICAL.SEED_STALLED,CANONICAL.SEED_PAUSED,CANONICAL.SEED_QUEUED].includes(state);
}

function makeTorrent(seed,index,now){
  const rng=createRng(`${seed}:${index}`);
  const state=initialState(index%100);
  const complete=isCompleteState(state);
  const size=Math.round(range(rng,350*MiB,140*GiB));
  const progress=complete?1:range(rng,0.015,0.985);
  const downloaded=Math.round(size*progress);
  const uploaded=complete?Math.round(size*range(rng,0,3.4)):Math.round(downloaded*range(rng,0,0.35));
  const baseSeeders=state===CANONICAL.DOWNLOAD_STALLED?0:int(rng,0,180);
  const baseLeechers=state===CANONICAL.SEED_STALLED?0:int(rng,0,120);
  const category=pick(rng,CATEGORIES);
  const tags=[pick(rng,TAGS)];
  if(rng()>.72)tags.push(pick(rng,TAGS));
  const privateFlag=category==='Private'||tags.includes('pt');
  return {
    hash:makeHash(seed,index),
    name:`Virtual Torrent ${String(index+1).padStart(4,'0')} · ${pick(rng,['Ubuntu','Fedora','Archive','Dataset','Media','Backup','Source','Demo'])}`,
    size,
    downloaded,
    uploaded,
    completed:complete,
    canonicalState:state,
    resumeState:state,
    naturalDownloadRate:Math.round(range(rng,0.4*MiB,58*MiB)),
    naturalUploadRate:Math.round(range(rng,0.1*MiB,14*MiB)),
    downloadLimit:0,
    uploadLimit:0,
    effectiveDownloadRate:0,
    effectiveUploadRate:0,
    queuePosition:index+1,
    forceStart:false,
    autoManagement:false,
    sequential:false,
    firstLastPriority:false,
    priority:1,
    category,
    tags:Array.from(new Set(tags)),
    tracker:privateFlag?'https://pt.example/announce':pick(rng,TRACKERS),
    private:privateFlag,
    has_metadata:state!==CANONICAL.METADATA,
    savePath:`/downloads/${category.toLowerCase()}`,
    contentPath:`/downloads/${category.toLowerCase()}/Virtual Torrent ${index+1}`,
    addedOn:Math.floor(now/1000)-int(rng,30,365*86400),
    completionOn:complete?Math.floor(now/1000)-int(rng,0,60*86400):-1,
    activeTime:int(rng,0,30*86400),
    seedTime:complete?int(rng,0,20*86400):0,
    seeders:baseSeeders,
    leechers:baseLeechers,
    connectedPeers:0,
    uploadSlots:0,
    lastStateChange:Math.floor(now/1000),
    error:state===CANONICAL.ERROR?'Virtual disk I/O error':'',
    files:[
      {index:0,name:'content.bin',size,progress,priority:1,is_seed:complete,piece_range:[0,Math.max(0,Math.ceil(size/(4*MiB))-1)]}
    ],
    trackers:[
      {url:privateFlag?'https://pt.example/announce':pick(rng,TRACKERS),status:2,tier:0,num_peers:baseLeechers,num_seeds:baseSeeders,num_leeches:baseLeechers,num_downloaded:int(rng,0,5000),msg:''}
    ]
  };
}

function serializableClone(value){
  return JSON.parse(JSON.stringify(value));
}

export function createWorld(options={}){
  const profile=normalizeProfile(options.profile||{});
  const count=Math.max(1,Math.min(20000,Number(options.count)||5000));
  const seed=String(options.seed||'20260905');
  const now=Number(options.now)||Date.now();
  const torrents=[];
  for(let i=0;i<count;i++)torrents.push(makeTorrent(seed,i,now));
  const world={
    schemaVersion:1,
    simulatorVersion:'0.1.0',
    profile,
    seed,
    scenario:String(options.scenario||'mixed'),
    authenticated:false,
    virtualSid:null,
    preferences:{...DEFAULT_PREFERENCES,...(options.preferences||{})},
    environment:{...DEFAULT_ENVIRONMENT,...(options.environment||{})},
    altSpeedMode:false,
    globalDownloadLimit:0,
    globalUploadLimit:0,
    torrents,
    categories:Object.fromEntries(CATEGORIES.map(name=>[name,{name,savePath:`/downloads/${name.toLowerCase()}`}])) ,
    tags:Array.from(new Set(torrents.flatMap(t=>t.tags))).sort(),
    logs:[],
    rid:1,
    journal:[],
    removedHashes:[],
    lastTick:now,
    stats:{alltime_dl:0,alltime_ul:0,total_peer_connections:0,dht_nodes:286}
  };
  schedule(world,now,0);
  appendLog(world,'Virtual qBittorrent session initialized.',1,now);
  return world;
}

function appendLog(world,message,type=1,now=Date.now()){
  const id=(world.logs.at(-1)?.id||0)+1;
  world.logs.push({id,message,type,timestamp:Math.floor(now/1000)});
  if(world.logs.length>1000)world.logs.splice(0,world.logs.length-1000);
}

function allowedActive(world,torrent,direction){
  if(!world.preferences.queueing_enabled||torrent.forceStart)return true;
  if(direction==='download')return true;
  return true;
}

function cap(value,limit){
  return limit>0?Math.min(value,limit):value;
}

function applyBudget(items,budget,key){
  const total=items.reduce((sum,x)=>sum+x.demand,0);
  const factor=total>0?Math.min(1,budget/total):0;
  for(const item of items)item.torrent[key]=Math.max(0,Math.floor(item.demand*factor));
}

function naturalJitter(world,torrent,now,direction){
  const bucket=Math.floor(now/5000);
  const unit=deterministicUnit(world.seed,`${torrent.hash}:${direction}:${bucket}`);
  return 0.88+unit*0.24;
}

function queueCandidates(world){
  const downloads=[],uploads=[];
  for(const t of world.torrents){
    if([CANONICAL.ERROR,CANONICAL.CHECKING,CANONICAL.METADATA,CANONICAL.MOVING,CANONICAL.DOWNLOAD_PAUSED,CANONICAL.SEED_PAUSED].includes(t.canonicalState))continue;
    if(t.completed)uploads.push(t);else downloads.push(t);
  }
  const sort=(a,b)=>(b.forceStart-a.forceStart)||(a.queuePosition-b.queuePosition)||a.hash.localeCompare(b.hash);
  downloads.sort(sort);uploads.sort(sort);
  return{downloads,uploads};
}

export function schedule(world,now=Date.now(),elapsedSeconds=0){
  const prefs=world.preferences,env=world.environment;
  const {downloads,uploads}=queueCandidates(world);
  const activeDownloads=new Set(),activeUploads=new Set();
  let totalSlots=prefs.queueing_enabled?Math.max(0,Number(prefs.max_active_torrents)||0):Infinity;
  let dlSlots=prefs.queueing_enabled?Math.max(0,Number(prefs.max_active_downloads)||0):Infinity;
  let ulSlots=prefs.queueing_enabled?Math.max(0,Number(prefs.max_active_uploads)||0):Infinity;

  for(const t of downloads){
    if(t.forceStart){activeDownloads.add(t.hash);continue;}
    if(!allowedActive(world,t,'download'))continue;
    if(dlSlots>0&&totalSlots>0){activeDownloads.add(t.hash);dlSlots--;totalSlots--;}
  }
  for(const t of uploads){
    if(t.forceStart){activeUploads.add(t.hash);continue;}
    if(!allowedActive(world,t,'upload'))continue;
    if(ulSlots>0&&totalSlots>0){activeUploads.add(t.hash);ulSlots--;totalSlots--;}
  }

  let remainingConnections=Math.max(0,Number(prefs.max_connec)||0)||Infinity;
  let remainingUploadSlots=Math.max(0,Number(prefs.max_uploads)||0)||Infinity;
  const dlItems=[],ulItems=[],changed=new Set();

  for(const t of world.torrents){
    const before=t.canonicalState;
    t.effectiveDownloadRate=0;
    t.effectiveUploadRate=0;
    t.connectedPeers=0;
    t.uploadSlots=0;

    if(!env.online){
      if(activeDownloads.has(t.hash)&&!t.completed)t.canonicalState=CANONICAL.DOWNLOAD_STALLED;
      else if(activeUploads.has(t.hash)&&t.completed)t.canonicalState=CANONICAL.SEED_STALLED;
    }else if(!t.completed&&![CANONICAL.DOWNLOAD_PAUSED,CANONICAL.ERROR,CANONICAL.CHECKING,CANONICAL.METADATA,CANONICAL.MOVING].includes(t.canonicalState)){
      if(!activeDownloads.has(t.hash))t.canonicalState=CANONICAL.DOWNLOAD_QUEUED;
      else{
        const possiblePeers=Math.max(0,Math.round((t.seeders+t.leechers)*env.peerAvailability));
        const perTorrent=Math.max(0,Number(prefs.max_connec_per_torrent)||0)||possiblePeers;
        const connections=Math.min(possiblePeers,perTorrent,remainingConnections);
        t.connectedPeers=Number.isFinite(connections)?connections:possiblePeers;
        if(Number.isFinite(remainingConnections))remainingConnections=Math.max(0,remainingConnections-t.connectedPeers);
        if(t.seeders<=0||t.connectedPeers<=0)t.canonicalState=CANONICAL.DOWNLOAD_STALLED;
        else{
          t.canonicalState=CANONICAL.DOWNLOAD_ACTIVE;
          const peerFactor=Math.min(1,Math.max(.08,t.connectedPeers/10));
          let demand=t.naturalDownloadRate*naturalJitter(world,t,now,'dl')*peerFactor;
          demand=cap(demand,Number(t.downloadLimit)||0);
          dlItems.push({torrent:t,demand});
        }
      }
    }else if(t.completed&&![CANONICAL.SEED_PAUSED,CANONICAL.ERROR,CANONICAL.CHECKING,CANONICAL.MOVING].includes(t.canonicalState)){
      if(!activeUploads.has(t.hash))t.canonicalState=CANONICAL.SEED_QUEUED;
      else{
        const possiblePeers=Math.max(0,Math.round(t.leechers*env.peerAvailability));
        const perTorrent=Math.max(0,Number(prefs.max_connec_per_torrent)||0)||possiblePeers;
        const connections=Math.min(possiblePeers,perTorrent,remainingConnections);
        t.connectedPeers=Number.isFinite(connections)?connections:possiblePeers;
        if(Number.isFinite(remainingConnections))remainingConnections=Math.max(0,remainingConnections-t.connectedPeers);
        const perTorrentSlots=Math.max(0,Number(prefs.max_uploads_per_torrent)||0)||possiblePeers;
        t.uploadSlots=Math.min(possiblePeers,perTorrentSlots,remainingUploadSlots);
        if(Number.isFinite(remainingUploadSlots))remainingUploadSlots=Math.max(0,remainingUploadSlots-t.uploadSlots);
        if(t.leechers<=0||t.connectedPeers<=0||t.uploadSlots<=0)t.canonicalState=CANONICAL.SEED_STALLED;
        else{
          t.canonicalState=CANONICAL.SEED_ACTIVE;
          const peerFactor=Math.min(1,Math.max(.08,t.uploadSlots/4));
          let demand=t.naturalUploadRate*naturalJitter(world,t,now,'ul')*peerFactor;
          demand=cap(demand,Number(t.uploadLimit)||0);
          ulItems.push({torrent:t,demand});
        }
      }
    }
    if(before!==t.canonicalState){t.lastStateChange=Math.floor(now/1000);changed.add(t.hash);}
  }

  let dlBudget=Math.min(env.downCapacity,env.diskWriteCapacity);
  let ulBudget=Math.min(env.upCapacity,env.diskReadCapacity);
  if(world.altSpeedMode){
    const altDl=(Number(prefs.alt_dl_limit)||0)*1024;
    const altUl=(Number(prefs.alt_up_limit)||0)*1024;
    if(altDl>0)dlBudget=Math.min(dlBudget,altDl);
    if(altUl>0)ulBudget=Math.min(ulBudget,altUl);
  }else{
    if(world.globalDownloadLimit>0)dlBudget=Math.min(dlBudget,world.globalDownloadLimit);
    if(world.globalUploadLimit>0)ulBudget=Math.min(ulBudget,world.globalUploadLimit);
  }
  applyBudget(dlItems,dlBudget,'effectiveDownloadRate');
  applyBudget(ulItems,ulBudget,'effectiveUploadRate');

  let totalDl=0,totalUl=0,totalConnections=0;
  if(elapsedSeconds>0){
    for(const t of world.torrents){
      const oldDownloaded=t.downloaded,oldUploaded=t.uploaded;
      if(t.effectiveDownloadRate>0&&!t.completed){
        const amount=Math.min(t.size-t.downloaded,t.effectiveDownloadRate*elapsedSeconds);
        t.downloaded+=amount;world.stats.alltime_dl+=amount;
        if(t.downloaded>=t.size-1){
          t.downloaded=t.size;t.completed=true;t.completionOn=Math.floor(now/1000);t.canonicalState=CANONICAL.SEED_ACTIVE;
          appendLog(world,`Torrent completed: ${t.name}`,1,now);
        }
      }
      if(t.effectiveUploadRate>0&&t.completed){
        const amount=t.effectiveUploadRate*elapsedSeconds;
        t.uploaded+=amount;world.stats.alltime_ul+=amount;t.seedTime+=elapsedSeconds;
      }
      if(t.effectiveDownloadRate>0||t.effectiveUploadRate>0)t.activeTime+=elapsedSeconds;
      const ratio=t.downloaded>0?t.uploaded/t.downloaded:0;
      if(t.completed&&prefs.max_ratio_enabled&&Number(prefs.max_ratio)>0&&ratio>=Number(prefs.max_ratio)){
        t.canonicalState=CANONICAL.SEED_PAUSED;t.effectiveUploadRate=0;
        appendLog(world,`Share ratio limit reached: ${t.name}`,1,now);
      }
      if(t.completed&&prefs.max_seeding_time_enabled&&Number(prefs.max_seeding_time)>0&&t.seedTime>=Number(prefs.max_seeding_time)*60){
        t.canonicalState=CANONICAL.SEED_PAUSED;t.effectiveUploadRate=0;
        appendLog(world,`Seeding time limit reached: ${t.name}`,1,now);
      }
      if(oldDownloaded!==t.downloaded||oldUploaded!==t.uploaded)changed.add(t.hash);
      if(t.files?.[0])t.files[0].progress=t.size?Math.min(1,t.downloaded/t.size):0;
    }
  }
  for(const t of world.torrents){
    totalDl+=t.effectiveDownloadRate;
    totalUl+=t.effectiveUploadRate;
    totalConnections+=t.connectedPeers;
  }
  world.stats.total_peer_connections=totalConnections;
  return{changed,totalDl,totalUl,dlBudget,ulBudget};
}

function recordJournal(world,hashes=[],removed=[]){
  const unique=Array.from(new Set(hashes));
  const rem=Array.from(new Set(removed));
  if(!unique.length&&!rem.length)return;
  world.rid++;
  world.journal.push({rid:world.rid,changedHashes:unique,removedHashes:rem});
  if(world.journal.length>128)world.journal.splice(0,world.journal.length-128);
}

export function advanceWorld(world,now=Date.now()){
  const elapsed=Math.max(0,Math.min(3600,(now-world.lastTick)/1000));
  if(elapsed<=0)return{changed:new Set(),totalDl:0,totalUl:0};
  const result=schedule(world,now,elapsed);
  world.lastTick=now;
  recordJournal(world,[...result.changed],[]);
  return result;
}

export function encodeState(t,profileInput){
  const profile=normalizeProfile(profileInput);
  switch(t.canonicalState){
    case CANONICAL.DOWNLOAD_ACTIVE:return'downloading';
    case CANONICAL.DOWNLOAD_STALLED:return'stalledDL';
    case CANONICAL.DOWNLOAD_QUEUED:return'queuedDL';
    case CANONICAL.DOWNLOAD_PAUSED:return profile.major>=5?'stoppedDL':'pausedDL';
    case CANONICAL.SEED_ACTIVE:return'uploading';
    case CANONICAL.SEED_STALLED:return'stalledUP';
    case CANONICAL.SEED_QUEUED:return'queuedUP';
    case CANONICAL.SEED_PAUSED:return profile.major>=5?'stoppedUP':'pausedUP';
    case CANONICAL.CHECKING:return t.completed?'checkingUP':'checkingDL';
    case CANONICAL.METADATA:return'metaDL';
    case CANONICAL.MOVING:return'moving';
    case CANONICAL.ERROR:return'error';
    default:return'unknown';
  }
}

export function torrentView(t,profileInput){
  const profile=normalizeProfile(profileInput);
  const progress=t.size?Math.min(1,t.downloaded/t.size):0;
  const left=Math.max(0,t.size-t.downloaded);
  const eta=t.effectiveDownloadRate>0?Math.ceil(left/t.effectiveDownloadRate):8640000;
  const view={
    hash:t.hash,name:t.name,size:t.size,progress,
    dlspeed:Math.floor(t.effectiveDownloadRate),upspeed:Math.floor(t.effectiveUploadRate),
    downloaded:Math.floor(t.downloaded),uploaded:Math.floor(t.uploaded),amount_left:Math.floor(left),
    eta,state:encodeState(t,profile),ratio:t.downloaded>0?t.uploaded/t.downloaded:0,
    tracker:t.tracker,category:t.category,tags:t.tags.join(', '),added_on:t.addedOn,
    completion_on:t.completionOn,save_path:t.savePath,content_path:t.contentPath,
    num_seeds:t.seeders,num_leechs:t.leechers,num_complete:t.seeders,num_incomplete:t.leechers,
    seen_complete:t.completionOn,force_start:t.forceStart,seq_dl:t.sequential,
    f_l_piece_prio:t.firstLastPriority,priority:t.priority
  };
  if(profile.major>=5)view.private=!!t.private;
  return view;
}

function matchesFilter(t,filter,profile){
  const state=encodeState(t,profile);
  switch(String(filter||'all')){
    case'all':return true;
    case'downloading':return state==='downloading';
    case'seeding':return state==='uploading'||state==='stalledUP';
    case'completed':return t.completed;
    case'paused':case'stopped':return /paused|stopped/.test(state);
    case'active':return t.effectiveDownloadRate>0||t.effectiveUploadRate>0;
    case'inactive':return t.effectiveDownloadRate<=0&&t.effectiveUploadRate<=0;
    case'stalled':return state==='stalledDL'||state==='stalledUP';
    case'stalled_uploading':return state==='stalledUP';
    case'stalled_downloading':return state==='stalledDL';
    case'errored':return state==='error'||state==='missingFiles';
    default:return true;
  }
}

export function listTorrents(world,query={}){
  advanceWorld(world,Number(query.now)||Date.now());
  const profile=world.profile;
  let list=world.torrents.filter(t=>matchesFilter(t,query.filter,profile));
  if(query.category&&query.category!=='all')list=list.filter(t=>t.category===query.category);
  if(query.tag&&query.tag!=='all')list=list.filter(t=>t.tags.includes(query.tag));
  if(query.hashes){
    const wanted=new Set(String(query.hashes).split('|'));
    list=list.filter(t=>wanted.has(t.hash));
  }
  const sort=query.sort;
  if(sort){
    const direction=String(query.reverse)==='true'?-1:1;
    list=[...list].sort((a,b)=>{
      const av=torrentView(a,profile)[sort]??a[sort]??0,bv=torrentView(b,profile)[sort]??b[sort]??0;
      return av<bv?-direction:av>bv?direction:0;
    });
  }
  const offset=Math.max(0,Number(query.offset)||0);
  const limit=Number(query.limit);
  if(Number.isFinite(limit)&&limit>0)list=list.slice(offset,offset+limit);else if(offset)list=list.slice(offset);
  return list.map(t=>torrentView(t,profile));
}

export function transferInfo(world,now=Date.now()){
  advanceWorld(world,now);
  let dl=0,ul=0;
  for(const t of world.torrents){dl+=t.effectiveDownloadRate;ul+=t.effectiveUploadRate;}
  return{
    dl_info_speed:Math.floor(dl),up_info_speed:Math.floor(ul),
    dl_info_data:Math.floor(world.stats.alltime_dl),up_info_data:Math.floor(world.stats.alltime_ul),
    dl_rate_limit:world.globalDownloadLimit,up_rate_limit:world.globalUploadLimit,
    dht_nodes:world.preferences.dht?world.stats.dht_nodes:0,
    connection_status:world.environment.online?'connected':'disconnected',
    total_peer_connections:world.stats.total_peer_connections
  };
}

export function serverState(world,now=Date.now()){
  const transfer=transferInfo(world,now);
  return{
    ...transfer,
    alltime_dl:Math.floor(world.stats.alltime_dl),
    alltime_ul:Math.floor(world.stats.alltime_ul),
    free_space_on_disk:Math.floor(world.environment.freeSpace),
    use_alt_speed_limits:world.altSpeedMode,
    queueing:!!world.preferences.queueing_enabled
  };
}

export function mainData(world,clientRid=0,now=Date.now()){
  advanceWorld(world,now);
  const rid=Number(clientRid)||0;
  const common={rid:world.rid,server_state:serverState(world,now)};
  if(rid<=0||!world.journal.length||rid<world.journal[0].rid-1){
    return{
      ...common,full_update:true,
      torrents:Object.fromEntries(world.torrents.map(t=>[t.hash,torrentView(t,world.profile)])),
      categories:serializableClone(world.categories),tags:[...world.tags]
    };
  }
  if(rid>=world.rid)return{...common,full_update:false};
  const changes=world.journal.filter(x=>x.rid>rid);
  const changed=new Set(changes.flatMap(x=>x.changedHashes)),removed=new Set(changes.flatMap(x=>x.removedHashes));
  const torrents={};
  for(const hash of changed){
    const t=world.torrents.find(x=>x.hash===hash);
    if(t)torrents[hash]=torrentView(t,world.profile);
  }
  return{
    ...common,full_update:false,
    ...(Object.keys(torrents).length?{torrents}:{}),
    ...(removed.size?{torrents_removed:[...removed]}:{})
  };
}

function selected(world,hashes){
  const text=String(hashes||'');
  if(text==='all')return world.torrents;
  const wanted=new Set(text.split('|').filter(Boolean));
  return world.torrents.filter(t=>wanted.has(t.hash));
}

export function setPaused(world,hashes,paused,now=Date.now()){
  const changed=[];
  for(const t of selected(world,hashes)){
    if(paused){
      t.canonicalState=t.completed?CANONICAL.SEED_PAUSED:CANONICAL.DOWNLOAD_PAUSED;
    }else if([CANONICAL.SEED_PAUSED,CANONICAL.DOWNLOAD_PAUSED].includes(t.canonicalState)){
      t.canonicalState=t.completed?CANONICAL.SEED_QUEUED:CANONICAL.DOWNLOAD_QUEUED;
    }
    t.lastStateChange=Math.floor(now/1000);changed.push(t.hash);
  }
  schedule(world,now,0);recordJournal(world,changed,[]);
  return changed.length;
}

export function setForceStart(world,hashes,value,now=Date.now()){
  const changed=[];
  for(const t of selected(world,hashes)){t.forceStart=!!value;changed.push(t.hash);}
  schedule(world,now,0);recordJournal(world,changed,[]);
}

export function setTorrentLimit(world,hashes,kind,limit,now=Date.now()){
  const field=kind==='upload'?'uploadLimit':'downloadLimit',changed=[];
  for(const t of selected(world,hashes)){t[field]=Math.max(0,Math.round(Number(limit)||0));changed.push(t.hash);}
  schedule(world,now,0);recordJournal(world,changed,[]);
}

export function renameTorrent(world,hash,name){
  const t=world.torrents.find(x=>x.hash===hash);if(!t)return false;
  t.name=String(name||t.name);recordJournal(world,[t.hash],[]);return true;
}

export function setCategory(world,hashes,category){
  const changed=[];
  for(const t of selected(world,hashes)){t.category=String(category||'');changed.push(t.hash);}
  recordJournal(world,changed,[]);
}

export function addTags(world,hashes,tags){
  const values=String(tags||'').split(',').map(x=>x.trim()).filter(Boolean),changed=[];
  for(const t of selected(world,hashes)){t.tags=Array.from(new Set([...t.tags,...values]));changed.push(t.hash);}
  world.tags=Array.from(new Set([...world.tags,...values])).sort();recordJournal(world,changed,[]);
}

export function removeTags(world,hashes,tags){
  const values=new Set(String(tags||'').split(',').map(x=>x.trim()).filter(Boolean)),changed=[];
  for(const t of selected(world,hashes)){t.tags=t.tags.filter(x=>!values.has(x));changed.push(t.hash);}
  recordJournal(world,changed,[]);
}

export function deleteTorrents(world,hashes,now=Date.now()){
  const doomed=new Set(selected(world,hashes).map(t=>t.hash));
  world.torrents=world.torrents.filter(t=>!doomed.has(t.hash));
  if(doomed.size)appendLog(world,`Deleted ${doomed.size} virtual torrent(s).`,1,now);
  recordJournal(world,[],[...doomed]);
  return doomed.size;
}

export function addVirtualTorrent(world,options={},now=Date.now()){
  const index=world.torrents.length+int(createRng(`${world.seed}:${now}`),1,1000000);
  const t=makeTorrent(`${world.seed}:add:${now}`,index,now);
  t.hash=makeHash(`${world.seed}:add:${now}`,index);
  t.name=String(options.name||options.url||'Added Virtual Torrent').slice(0,180);
  t.size=Math.max(1,Number(options.size)||int(createRng(t.hash),700,45000)*MiB);
  t.downloaded=0;t.uploaded=0;t.completed=false;t.canonicalState=world.preferences.start_paused_enabled?CANONICAL.DOWNLOAD_PAUSED:CANONICAL.DOWNLOAD_QUEUED;
  t.queuePosition=world.torrents.length+1;
  if(options.savepath)t.savePath=String(options.savepath);
  if(options.category)t.category=String(options.category);
  if(options.tags)t.tags=String(options.tags).split(',').map(x=>x.trim()).filter(Boolean);
  world.torrents.push(t);world.tags=Array.from(new Set([...world.tags,...t.tags])).sort();
  schedule(world,now,0);recordJournal(world,[t.hash],[]);
  appendLog(world,`Torrent added: ${t.name}`,1,now);
  return t;
}

export function setPreferences(world,patch,now=Date.now()){
  const allowed=patch&&typeof patch==='object'?patch:{};
  Object.assign(world.preferences,allowed);
  if(Object.prototype.hasOwnProperty.call(allowed,'dl_limit'))world.globalDownloadLimit=Math.max(0,Math.round(Number(allowed.dl_limit)||0));
  if(Object.prototype.hasOwnProperty.call(allowed,'up_limit'))world.globalUploadLimit=Math.max(0,Math.round(Number(allowed.up_limit)||0));
  schedule(world,now,0);
  appendLog(world,'Preferences updated.',1,now);
}

export function authenticate(world,username,password,now=Date.now()){
  world.authenticated=true;
  world.virtualSid=`VIRTUAL-${hash32(`${username}:${password}:${now}`).toString(16)}`;
  appendLog(world,'Virtual WebUI login accepted.',1,now);
  return world.virtualSid;
}

export function logout(world,now=Date.now()){
  world.authenticated=false;world.virtualSid=null;
  appendLog(world,'Virtual WebUI session logged out.',1,now);
}

export function properties(world,hash){
  const t=world.torrents.find(x=>x.hash===hash);if(!t)return null;
  return{
    save_path:t.savePath,creation_date:t.addedOn,piece_size:4*MiB,comment:'WeiG Virtual qB Lab',
    total_wasted:0,total_uploaded:Math.floor(t.uploaded),total_uploaded_session:Math.floor(t.uploaded),
    total_downloaded:Math.floor(t.downloaded),total_downloaded_session:Math.floor(t.downloaded),
    up_limit:t.uploadLimit,dl_limit:t.downloadLimit,time_elapsed:t.activeTime,seeding_time:t.seedTime,
    nb_connections:t.connectedPeers,share_ratio:t.downloaded>0?t.uploaded/t.downloaded:0,
    addition_date:t.addedOn,completion_date:t.completionOn,created_by:'WeiG Virtual qB Lab',
    dl_speed_avg:Math.floor(t.effectiveDownloadRate),dl_speed:Math.floor(t.effectiveDownloadRate),
    eta:t.effectiveDownloadRate>0?Math.ceil((t.size-t.downloaded)/t.effectiveDownloadRate):8640000,
    last_seen:Math.floor(Date.now()/1000),peers:t.leechers,peers_total:t.leechers,
    pieces_have:Math.floor((t.downloaded/t.size)*Math.ceil(t.size/(4*MiB))),
    pieces_num:Math.ceil(t.size/(4*MiB)),reannounce:900,seeds:t.seeders,seeds_total:t.seeders,
    total_size:t.size,up_speed_avg:Math.floor(t.effectiveUploadRate),up_speed:Math.floor(t.effectiveUploadRate)
  };
}

export function peers(world,hash,now=Date.now()){
  const t=world.torrents.find(x=>x.hash===hash);if(!t)return{};
  const count=Math.min(40,t.connectedPeers||Math.min(t.seeders+t.leechers,8)),out={};
  for(let i=0;i<count;i++){
    const key=`10.0.${(i>>8)&255}.${(i%254)+1}:${50000+i}`;
    out[key]={
      client:pick(createRng(`${t.hash}:peer:${i}`),['qBittorrent 5.2.3','Transmission 4.0','libtorrent','Deluge 2.x']),
      country_code:pick(createRng(`${t.hash}:country:${i}`),['US','DE','NL','JP','SG','CA']),
      country:'Virtual',dl_speed:Math.floor(t.effectiveDownloadRate/Math.max(1,count)),
      up_speed:Math.floor(t.effectiveUploadRate/Math.max(1,count)),downloaded:0,uploaded:0,
      progress:deterministicUnit(world.seed,`${t.hash}:peer-progress:${i}`),connection:'µTP',flags:'D U',
      flags_desc:'Interested; Unchoked',ip:`10.0.${(i>>8)&255}.${(i%254)+1}`,port:50000+i,
      relevance:.9,files:''
    };
  }
  return out;
}

export function logs(world,lastId=-1){
  return world.logs.filter(x=>x.id>Number(lastId||-1));
}

export function capabilityAvailable(world,name){
  const api=world.profile.webApiVersion,qb=world.profile.qbVersion;
  const table={
    tags:atLeast(api,'2.3.0'),renameFile:atLeast(api,'2.4.0'),stalledFilter:atLeast(api,'2.4.1'),
    addTags:atLeast(api,'2.6.2'),fileIndexes:atLeast(api,'2.8.2'),tagFilter:atLeast(api,'2.8.3'),
    cookies:atLeast(api,'2.11.3'),structuredTorrentAdd:atLeast(api,'2.14.0'),privateFlag:world.profile.major>=5,
    logs:atLeast(qb,'4.1.0')
  };
  return table[name]!==false;
}
