import {createRng,deterministicUnit,pick} from './random.js';
import {torrentIndex} from './runtime-index.js';

const peerTemplates=new WeakMap();
const peerDiagnostics=new WeakMap();

function diagnosticsFor(world){
  let stats=peerDiagnostics.get(world);
  if(!stats){stats={templateBuilds:0,templateRows:0,templateHits:0};peerDiagnostics.set(world,stats);}
  return stats;
}

function templatesFor(world,torrent){
  const seed=String(world.seed||'');
  const cached=peerTemplates.get(torrent),stats=diagnosticsFor(world);
  if(cached&&cached.seed===seed){stats.templateHits++;return cached.rows;}
  const rows=Array.from({length:40},(_,i)=>({
    key:`10.0.${(i>>8)&255}.${(i%254)+1}:${50000+i}`,
    value:{
      client:pick(createRng(`${torrent.hash}:peer:${i}`),['qBittorrent 5.2.3','Transmission 4.0','libtorrent','Deluge 2.x']),
      country_code:pick(createRng(`${torrent.hash}:country:${i}`),['US','DE','NL','JP','SG','CA']),
      country:'Virtual',downloaded:0,uploaded:0,
      progress:deterministicUnit(world.seed,`${torrent.hash}:peer-progress:${i}`),connection:'µTP',flags:'D U',
      flags_desc:'Interested; Unchoked',ip:`10.0.${(i>>8)&255}.${(i%254)+1}`,port:50000+i,
      relevance:.9,files:''
    }
  }));
  peerTemplates.set(torrent,{seed,rows});
  stats.templateBuilds++;
  stats.templateRows+=rows.length;
  return rows;
}

export function generatedPeers(world,hash){
  const torrent=torrentIndex(world).byHash.get(String(hash||''));
  if(!torrent)return{};
  const count=Math.min(40,torrent.connectedPeers||Math.min(torrent.seeders+torrent.leechers,8)),out={};
  const templates=templatesFor(world,torrent);
  const dlSpeed=Math.floor(torrent.effectiveDownloadRate/Math.max(1,count));
  const upSpeed=Math.floor(torrent.effectiveUploadRate/Math.max(1,count));
  for(let i=0;i<count;i++){
    const template=templates[i];
    out[template.key]={...template.value,dl_speed:dlSpeed,up_speed:upSpeed};
  }
  return out;
}

export function peerViewStats(world){return{...diagnosticsFor(world)};}
