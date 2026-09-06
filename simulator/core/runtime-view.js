import {capabilityAvailable,recordTorrentChanges,schedule,torrentView} from './engine.js';
import {clearRuntimeIndexes,primeTransferAggregate,runtimeIndexStats,torrentIndex,torrentsByHashes,transferAggregate} from './runtime-index.js';
import {snapshotIntervalForWorld} from './low-power-policy.js';
import {expandTorrentInfoRows} from './torrent-info-options.js';
import {filterTorrentCandidates,sliceTorrentWindow} from './torrent-query.js';
import {atLeast} from './profiles.js';

const runtimeSnapshots=new WeakMap();

function apiAtLeast(world,minimum){return atLeast(world.profile?.webApiVersion||'0',minimum);}
function rateControlKey(world){
  return[
    world.altSpeedMode?1:0,
    Number(world.globalDownloadLimit)||0,
    Number(world.globalUploadLimit)||0,
    Number(world.preferences?.alt_dl_limit)||0,
    Number(world.preferences?.alt_up_limit)||0
  ].join('|');
}

function diagnostics(world){
  let stats=runtimeSnapshots.get(world);
  if(!stats){
    stats={bucket:-1,advanceRuns:0,controlReschedules:0,controlKey:null,projectedRows:0,sortedRows:0,indexBuilds:0,indexHits:0,hashSelections:0,aggregateRuns:0,aggregateHits:0};
    runtimeSnapshots.set(world,stats);
  }
  return stats;
}

export function runtimeSnapshotStats(world){
  const stats=diagnostics(world);
  return{
    advanceRuns:stats.advanceRuns,controlReschedules:stats.controlReschedules,projectedRows:stats.projectedRows,sortedRows:stats.sortedRows,bucket:stats.bucket,
    snapshotIntervalMs:snapshotIntervalForWorld(world),
    indexBuilds:stats.indexBuilds,indexHits:stats.indexHits,hashSelections:stats.hashSelections,
    aggregateRuns:stats.aggregateRuns,aggregateHits:stats.aggregateHits,
    index:runtimeIndexStats(world)
  };
}

export function clearRuntimeSnapshot(world){runtimeSnapshots.delete(world);clearRuntimeIndexes(world);}

function rememberScheduleAggregate(world,result){
  primeTransferAggregate(world,result?.totalDl,result?.totalUl);
}

export function advanceRuntimeSnapshot(world,now=Date.now()){
  const stats=diagnostics(world);
  const lastTick=Number(world.lastTick)||0;
  const currentControlKey=rateControlKey(world);
  const controlsChanged=stats.controlKey!==null&&stats.controlKey!==currentControlKey;
  stats.controlKey=currentControlKey;
  const interval=snapshotIntervalForWorld(world);
  const bucket=Math.floor(Math.max(lastTick,Number(now)||0)/interval)*interval;
  if(bucket<=lastTick||stats.bucket===bucket){
    if(!controlsChanged&&stats.bucket!==-1)return false;
    const result=schedule(world,Math.max(lastTick,Number(now)||lastTick),0);
    recordTorrentChanges(world,[...result.changed],[]);
    rememberScheduleAggregate(world,result);
    stats.bucket=bucket;
    stats.controlReschedules++;
    return true;
  }
  const elapsed=Math.max(0,Math.min(3600,(bucket-lastTick)/1000));
  if(elapsed<=0){stats.bucket=bucket;return false;}
  const result=schedule(world,bucket,elapsed);
  world.lastTick=bucket;
  recordTorrentChanges(world,[...result.changed],[]);
  rememberScheduleAggregate(world,result);
  stats.bucket=bucket;
  stats.advanceRuns++;
  return true;
}

function transferSnapshotRaw(world){
  const stats=diagnostics(world),aggregate=transferAggregate(world);
  if(aggregate.rebuilt)stats.aggregateRuns++;else stats.aggregateHits++;
  return{
    dl_info_speed:Math.floor(aggregate.downloadRate),up_info_speed:Math.floor(aggregate.uploadRate),
    dl_info_data:Math.floor(world.stats.alltime_dl),up_info_data:Math.floor(world.stats.alltime_ul),
    dl_rate_limit:world.globalDownloadLimit,up_rate_limit:world.globalUploadLimit,
    dht_nodes:world.preferences.dht?world.stats.dht_nodes:0,
    connection_status:world.environment.online?'connected':'disconnected',
    total_peer_connections:world.stats.total_peer_connections
  };
}

export function transferSnapshot(world,now=Date.now()){
  advanceRuntimeSnapshot(world,now);
  return transferSnapshotRaw(world);
}

function serverStateSnapshotRaw(world){
  const transfer=transferSnapshotRaw(world);
  const state={
    ...transfer,
    alltime_dl:Math.floor(world.stats.alltime_dl),
    alltime_ul:Math.floor(world.stats.alltime_ul),
    free_space_on_disk:Math.floor(world.environment.freeSpace),
    use_alt_speed_limits:world.altSpeedMode,
    queueing:!!world.preferences.queueing_enabled
  };
  if(!apiAtLeast(world,'2.15.0'))state.use_subcategories=true;
  return state;
}

function serializableClone(value){return JSON.parse(JSON.stringify(value));}

function indexedWorld(world){
  const stats=diagnostics(world),index=torrentIndex(world);
  if(index.rebuilt)stats.indexBuilds++;else stats.indexHits++;
  return index;
}

export function mainDataSnapshot(world,clientRid=0,now=Date.now()){
  advanceRuntimeSnapshot(world,now);
  const rid=Number(clientRid)||0;
  const common={rid:world.rid,server_state:serverStateSnapshotRaw(world)};
  if(rid<=0||!world.journal.length||rid<world.journal[0].rid-1){
    return{
      ...common,full_update:true,
      torrents:Object.fromEntries((world.torrents||[]).map(t=>[t.hash,torrentView(t,world.profile)])),
      categories:serializableClone(world.categories),
      ...(capabilityAvailable(world,'tags')?{tags:[...(world.tags||[])]}:{})
    };
  }
  if(rid>=world.rid)return{...common,full_update:false};
  const changes=world.journal.filter(x=>x.rid>rid);
  const changed=new Set(changes.flatMap(x=>x.changedHashes||[]));
  const removed=new Set(changes.flatMap(x=>x.removedHashes||[]));
  const categoryNames=new Set(changes.flatMap(x=>x.categoryNames||[]));
  const tagNames=new Set(changes.flatMap(x=>x.tagNames||[]));
  const byHash=indexedWorld(world).byHash;
  const torrents={};
  for(const hash of changed){const t=byHash.get(hash);if(t)torrents[hash]=torrentView(t,world.profile);}
  const categories={},categoriesRemoved=[];
  for(const name of categoryNames){
    if(world.categories?.[name])categories[name]=serializableClone(world.categories[name]);
    else categoriesRemoved.push(name);
  }
  const currentTags=new Set(world.tags||[]),tags=[],tagsRemoved=[];
  for(const name of tagNames){if(currentTags.has(name))tags.push(name);else tagsRemoved.push(name);}
  return{
    ...common,full_update:false,
    ...(Object.keys(torrents).length?{torrents}:{}),
    ...(removed.size?{torrents_removed:[...removed]}:{}),
    ...(Object.keys(categories).length?{categories}:{}),
    ...(categoriesRemoved.length?{categories_removed:categoriesRemoved}:{}),
    ...(capabilityAvailable(world,'tags')&&tags.length?{tags}:{}),
    ...(capabilityAvailable(world,'tags')&&tagsRemoved.length?{tags_removed:tagsRemoved}:{})
  };
}

export function listTorrentsSnapshot(world,query={},now=Date.now()){
  advanceRuntimeSnapshot(world,now);
  const profile=world.profile,stats=diagnostics(world);
  let candidates;
  if(query.hashes){
    const selected=torrentsByHashes(world,query.hashes);
    if(selected.rebuilt)stats.indexBuilds++;else stats.indexHits++;
    stats.hashSelections++;
    candidates=selected.torrents;
  }
  else candidates=world.torrents||[];
  const list=filterTorrentCandidates(world,candidates,query);
  const sort=query.sort;
  if(sort){
    const direction=String(query.reverse)==='true'?-1:1;
    const rows=list.map(t=>({torrent:t,view:torrentView(t,profile)}));
    stats.projectedRows+=rows.length;stats.sortedRows+=rows.length;
    rows.sort((a,b)=>{
      const av=a.view[sort]??a.torrent[sort]??0,bv=b.view[sort]??b.torrent[sort]??0;
      return av<bv?-direction:av>bv?direction:0;
    });
    return expandTorrentInfoRows(world,sliceTorrentWindow(rows,query,profile).map(item=>item.view),query,now);
  }
  const sliced=sliceTorrentWindow(list,query,profile);
  stats.projectedRows+=sliced.length;
  return expandTorrentInfoRows(world,sliced.map(t=>torrentView(t,profile)),query,now);
}
