const torrentIndexes=new WeakMap();
const transferAggregates=new WeakMap();

function torrentsFor(world){return Array.isArray(world?.torrents)?world.torrents:[];}

export function torrentIndex(world){
  const torrents=torrentsFor(world);
  const cached=torrentIndexes.get(world);
  if(cached&&cached.source===torrents&&cached.length===torrents.length){
    cached.hits++;
    return{...cached,rebuilt:false};
  }
  const byHash=new Map(),position=new Map();
  for(let i=0;i<torrents.length;i++){
    const torrent=torrents[i];
    if(!torrent||torrent.hash==null)continue;
    const hash=String(torrent.hash);
    byHash.set(hash,torrent);
    position.set(hash,i);
  }
  const entry={source:torrents,length:torrents.length,byHash,position,hits:0};
  torrentIndexes.set(world,entry);
  return{...entry,rebuilt:true};
}

export function torrentsByHashes(world,hashes){
  const raw=Array.isArray(hashes)?hashes:String(hashes||'').split('|');
  const wanted=[...new Set(raw.map(String).filter(Boolean))];
  if(!wanted.length)return{torrents:[],rebuilt:false,indexHit:false};
  const index=torrentIndex(world);
  const selected=[];
  for(const hash of wanted){
    const torrent=index.byHash.get(hash);
    if(torrent)selected.push(torrent);
  }
  selected.sort((a,b)=>(index.position.get(String(a.hash))??Number.MAX_SAFE_INTEGER)-(index.position.get(String(b.hash))??Number.MAX_SAFE_INTEGER));
  return{torrents:selected,rebuilt:index.rebuilt,indexHit:!index.rebuilt};
}

function aggregateSignature(world){
  return[
    Number(world?.lastTick)||0,
    Number(world?.rid)||0,
    Number(world?.globalDownloadLimit)||0,
    Number(world?.globalUploadLimit)||0,
    world?.preferences?.dht===false?0:1,
    world?.environment?.online===false?0:1,
    Number(world?.stats?.alltime_dl)||0,
    Number(world?.stats?.alltime_ul)||0,
    Number(world?.stats?.total_peer_connections)||0
  ].join('|');
}

export function transferAggregate(world){
  const signature=aggregateSignature(world);
  const cached=transferAggregates.get(world);
  if(cached&&cached.signature===signature){
    cached.hits++;
    return{downloadRate:cached.downloadRate,uploadRate:cached.uploadRate,rebuilt:false,hits:cached.hits};
  }
  let downloadRate=0,uploadRate=0;
  for(const torrent of torrentsFor(world)){
    downloadRate+=Number(torrent?.effectiveDownloadRate)||0;
    uploadRate+=Number(torrent?.effectiveUploadRate)||0;
  }
  const entry={signature,downloadRate,uploadRate,hits:0};
  transferAggregates.set(world,entry);
  return{downloadRate,uploadRate,rebuilt:true,hits:0};
}

export function runtimeIndexStats(world){
  const index=torrentIndexes.get(world),aggregate=transferAggregates.get(world);
  return{
    indexedRows:index?.length||0,
    indexHits:index?.hits||0,
    aggregateCached:!!aggregate,
    aggregateHits:aggregate?.hits||0
  };
}

export function clearRuntimeIndexes(world){
  torrentIndexes.delete(world);
  transferAggregates.delete(world);
}
