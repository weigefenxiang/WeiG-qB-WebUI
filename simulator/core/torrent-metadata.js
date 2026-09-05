import {deterministicUnit} from './random.js';
import {atLeast} from './profiles.js';

const MiB=1024*1024;
const PIECE_SIZE=4*MiB;

function torrent(world,hash){return (world.torrents||[]).find(t=>t.hash===String(hash||''))||null;}
function apiAtLeast(world,minimum){return atLeast(world.profile?.webApiVersion||'0',minimum);}
function progressOf(t){return t.size>0?Math.max(0,Math.min(1,Number(t.downloaded||0)/Number(t.size))):0;}
function pieceCount(t){return Math.max(1,Math.ceil(Math.max(1,Number(t.size)||1)/PIECE_SIZE));}
function limitValue(value){const n=Number(value)||0;return n>0?Math.round(n):-1;}
function validTime(value){const n=Number(value);return Number.isFinite(n)&&n>0?Math.floor(n):-1;}

export function propertiesForTorrent(world,hash,now=Date.now()){
  const t=torrent(world,hash);if(!t)return null;
  const progress=progressOf(t),pieces=pieceCount(t),active=Math.max(0,Math.floor(Number(t.activeTime)||0));
  const seeding=Math.max(0,Math.floor(Number(t.seedTime)||0)),dlDuration=Math.max(1,active-seeding),ulDuration=Math.max(1,active);
  const downloadRate=Math.max(0,Math.floor(Number(t.effectiveDownloadRate)||0));
  const uploadRate=Math.max(0,Math.floor(Number(t.effectiveUploadRate)||0));
  const connected=Math.max(0,Math.floor(Number(t.connectedPeers)||0));
  const connLimit=Number(world.preferences?.max_connec_per_torrent)||0;
  const hasMetadata=t.has_metadata!==false;
  const completion=hasMetadata?validTime(t.completionOn):-1;
  const creation=hasMetadata?Math.max(0,Math.floor(Number(t.addedOn)||0)-86400):-1;
  const lastSeen=hasMetadata?(completion>0?completion:Math.floor(now/1000)):-1;
  const base={
    time_elapsed:active,
    seeding_time:seeding,
    eta:downloadRate>0?Math.ceil(Math.max(0,Number(t.size||0)-Number(t.downloaded||0))/downloadRate):8640000,
    nb_connections:connected,
    nb_connections_limit:connLimit>0?Math.floor(connLimit):-1,
    total_downloaded:Math.floor(Number(t.downloaded)||0),
    total_downloaded_session:Math.floor(Number(t.downloaded)||0),
    total_uploaded:Math.floor(Number(t.uploaded)||0),
    total_uploaded_session:Math.floor(Number(t.uploaded)||0),
    dl_speed:downloadRate,
    dl_speed_avg:Math.floor((Number(t.downloaded)||0)/dlDuration),
    up_speed:uploadRate,
    up_speed_avg:Math.floor((Number(t.uploaded)||0)/ulDuration),
    dl_limit:limitValue(t.downloadLimit),
    up_limit:limitValue(t.uploadLimit),
    total_wasted:Math.max(0,Math.floor(Number(t.wasted)||0)),
    seeds:Math.max(0,Math.floor(Number(t.seeders)||0)),
    seeds_total:Math.max(0,Math.floor(Number(t.seeders)||0)),
    peers:Math.max(0,Math.floor(Number(t.leechers)||0)),
    peers_total:Math.max(0,Math.floor(Number(t.leechers)||0)),
    share_ratio:Number(t.downloaded)>0?Number(t.uploaded||0)/Number(t.downloaded):0,
    reannounce:900,
    total_size:Math.floor(Number(t.size)||0),
    pieces_num:hasMetadata?pieces:0,
    piece_size:hasMetadata?PIECE_SIZE:0,
    pieces_have:hasMetadata?Math.min(pieces,Math.floor(progress*pieces)):0,
    created_by:hasMetadata?'WeiG Virtual qB Lab':'',
    last_seen:lastSeen,
    addition_date:Math.floor(Number(t.addedOn)||0),
    completion_date:completion,
    creation_date:creation,
    save_path:String(t.savePath||''),
    comment:String(t.comment??'WeiG Virtual qB Lab')
  };

  if(world.profile?.major>=5){
    const privateFlag=hasMetadata?!!t.private:null;
    Object.assign(base,{
      infohash_v1:String(t.hash||''),
      infohash_v2:'',
      hash:String(t.hash||''),
      name:String(t.name||''),
      popularity:Number((deterministicUnit(world.seed,`${t.hash}:popularity`)*8).toFixed(3)),
      is_private:hasMetadata?!!t.private:false,
      private:privateFlag,
      download_path:String(t.downloadPath||''),
      has_metadata:hasMetadata,
      progress
    });
  }else if(apiAtLeast(world,'2.6.0')){
    base.download_path=String(t.downloadPath||'');
    base.is_private=hasMetadata?!!t.private:false;
  }
  return base;
}

function legacyTrackerStatus(status){
  switch(Number(status)){
    case 1:return'Updating...';
    case 2:return'Working';
    case 4:return'Not working';
    default:return'Not contacted yet';
  }
}

function stickyTracker(world,t,label,enabled){
  const isPrivate=t.has_metadata!==false&&!!t.private;
  return{
    url:`** [${label}] **`,
    tier:world.profile?.major>=5?-1:'',
    msg:isPrivate?'This torrent is private':'',
    status:enabled&&!isPrivate?2:0,
    num_peers:0,
    num_downloaded:0,
    num_seeds:0,
    num_leeches:0
  };
}

function modernTracker(world,t,tracker,index,now){
  const status=Number(tracker.status)||0;
  const out={
    url:String(tracker.url||''),
    status,
    tier:Number.isFinite(Number(tracker.tier))?Number(tracker.tier):index,
    msg:String(tracker.msg||''),
    num_peers:Math.max(0,Math.floor(Number(tracker.num_peers)||0)),
    num_seeds:Math.max(0,Math.floor(Number(tracker.num_seeds)||0)),
    num_leeches:Math.max(0,Math.floor(Number(tracker.num_leeches)||0)),
    num_downloaded:Math.max(0,Math.floor(Number(tracker.num_downloaded)||0))
  };
  if(world.profile?.major>=5){
    const next=Math.floor(now/1000)+600+Math.floor(deterministicUnit(world.seed,`${t.hash}:${out.url}:announce`)*900);
    const minimum=Math.floor(now/1000)+120;
    Object.assign(out,{
      updating:status===1,
      next_announce:next,
      min_announce:minimum,
      endpoints:[{
        name:'virtual',updating:status===1,status,msg:out.msg,bt_version:1,
        num_peers:out.num_peers,num_seeds:out.num_seeds,num_leeches:out.num_leeches,
        num_downloaded:out.num_downloaded,next_announce:next,min_announce:minimum
      }]
    });
  }
  return out;
}

export function trackersForTorrent(world,hash,now=Date.now()){
  const t=torrent(world,hash);if(!t)return null;
  const trackers=Array.isArray(t.trackers)?t.trackers:[];
  if(!apiAtLeast(world,'2.2.0')){
    return trackers.map(tracker=>({
      url:String(tracker.url||''),
      status:legacyTrackerStatus(tracker.status),
      num_peers:Math.max(0,Math.floor(Number(tracker.num_peers)||0)),
      msg:String(tracker.msg||'')
    }));
  }
  const sticky=[
    stickyTracker(world,t,'DHT',world.preferences?.dht!==false),
    stickyTracker(world,t,'PeX',world.preferences?.pex!==false),
    stickyTracker(world,t,'LSD',world.preferences?.lsd!==false)
  ];
  return [...sticky,...trackers.map((tracker,index)=>modernTracker(world,t,tracker,index,now))];
}

export function hasTorrentMetadata(world,hash){
  const t=torrent(world,hash);if(!t)return null;
  return t.has_metadata!==false;
}

export function torrentExists(world,hash){return!!torrent(world,hash);}
