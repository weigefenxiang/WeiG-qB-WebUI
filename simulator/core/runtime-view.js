import {capabilityAvailable,encodeState,recordTorrentChanges,schedule,torrentView} from './engine.js';
import {clearRuntimeIndexes,runtimeIndexStats,torrentIndex,torrentsByHashes,transferAggregate} from './runtime-index.js';

const SNAPSHOT_INTERVAL_MS=1000;
const runtimeSnapshots=new WeakMap();

function diagnostics(world){
  let stats=runtimeSnapshots.get(world);
  if(!stats){
    stats={bucket:-1,advanceRuns:0,projectedRows:0,sortedRows:0,indexBuilds:0,indexHits:0,hashSelections:0,aggregateRuns:0,aggregateHits:0};
    runtimeSnapshots.set(world,stats);
  }
  return stats;
}

export function runtimeSnapshotStats(world){
  const stats=diagnostics(world);
  return{
    advanceRuns:stats.advanceRuns,projectedRows:stats.projectedRows,sortedRows:stats.sortedRows,bucket:stats.bucket,
    indexBuilds:stats.indexBuilds,indexHits:stats.indexHits,hashSelections:stats.hashSelections,
    aggregateRuns:stats.aggregateRuns,aggregateHits:stats.aggregateHits,
    index:runtimeIndexStats(world)
  };
}

export function clearRuntimeSnapshot(world){runtimeSnapshots.delete(world);clearRuntimeIndexes(world);}

export function advanceRuntimeSnapshot(world,now=Date.now()){
  const stats=diagnostics(world);
  const lastTick=Number(world.lastTick)||0;
  const bucket=Math.floor(Math.max(lastTick,Number(now)||0)/SNAPSHOT_INTERVAL_MS)*SNAPSHOT_INTERVAL_MS;
  if(bucket<=lastTick||stats.bucket===bucket)return false;
  const elapsed=Math.max(0,Math.min(3600,(bucket-lastTick)/1000));
  if(elapsed<=0){stats.bucket=bucket;return false;}
  const result=schedule(world,bucket,elapsed);
  world.lastTick=bucket;
  recordTorrentChanges(world,[...result.changed],[]);
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
  return{
    ...transfer,
    alltime_dl:Math.floor(world.stats.alltime_dl),
    alltime_ul:Math.floor(world.stats.alltime_ul),
    free_space_on_disk:Math.floor(world.environment.freeSpace),
    use_alt_speed_limits:world.altSpeedMode,
    queueing:!!world.preferences.queueing_enabled
  };
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

function matchesFilter(t,filter,profile){
  const state=encodeState(t,profile);
  switch(String(filter||'all')){
    case'all':return true;
    case'downloading':return ['downloading','stalledDL','forcedDL','metaDL'].includes(state);
    case'seeding':return ['uploading','stalledUP','forcedUP'].includes(state);
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

export function listTorrentsSnapshot(world,query={},now=Date.now()){
  advanceRuntimeSnapshot(world,now);
  const profile=world.profile,stats=diagnostics(world);
  let list;
  if(query.hashes){
    const selected=torrentsByHashes(world,query.hashes);
    if(selected.rebuilt)stats.indexBuilds++;else stats.indexHits++;
    stats.hashSelections++;
    list=selected.torrents;
  }
  else list=world.torrents||[];
  list=list.filter(t=>matchesFilter(t,query.filter,profile));
  if(query.category&&query.category!=='all')list=list.filter(t=>t.category===query.category);
  if(query.tag&&query.tag!=='all')list=list.filter(t=>t.tags.includes(query.tag));
  const sort=query.sort;
  const offset=Math.max(0,Number(query.offset)||0),limit=Number(query.limit);
  if(sort){
    const direction=String(query.reverse)==='true'?-1:1;
    const rows=list.map(t=>({torrent:t,view:torrentView(t,profile)}));
    stats.projectedRows+=rows.length;stats.sortedRows+=rows.length;
    rows.sort((a,b)=>{
      const av=a.view[sort]??a.torrent[sort]??0,bv=b.view[sort]??b.torrent[sort]??0;
      return av<bv?-direction:av>bv?direction:0;
    });
    const sliced=Number.isFinite(limit)&&limit>0?rows.slice(offset,offset+limit):(offset?rows.slice(offset):rows);
    return sliced.map(item=>item.view);
  }
  const sliced=Number.isFinite(limit)&&limit>0?list.slice(offset,offset+limit):(offset?list.slice(offset):list);
  stats.projectedRows+=sliced.length;
  return sliced.map(t=>torrentView(t,profile));
}
