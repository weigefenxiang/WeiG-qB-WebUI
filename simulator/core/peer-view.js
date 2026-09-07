import {createRng,deterministicUnit,pick} from './random.js';
import {torrentIndex} from './runtime-index.js';

const peerTemplates=new WeakMap();
const peerDiagnostics=new WeakMap();

function diagnosticsFor(world){
  let stats=peerDiagnostics.get(world);
  if(!stats){stats={templateBuilds:0,templateRows:0,templateHits:0};peerDiagnostics.set(world,stats);}
  return stats;
}

function templateRow(world,torrent,i){
  return{
    key:`10.0.${(i>>8)&255}.${(i%254)+1}:${50000+i}`,
    value:{
      client:pick(createRng(`${torrent.hash}:peer:${i}`),['qBittorrent 5.2.3','Transmission 4.0','libtorrent','Deluge 2.x']),
      country_code:pick(createRng(`${torrent.hash}:country:${i}`),['US','DE','NL','JP','SG','CA']),
      country:'Virtual',downloaded:0,uploaded:0,
      progress:deterministicUnit(world.seed,`${torrent.hash}:peer-progress:${i}`),connection:'µTP',flags:'D U',
      flags_desc:'Interested; Unchoked',ip:`10.0.${(i>>8)&255}.${(i%254)+1}`,port:50000+i,
      relevance:.9,files:''
    }
  };
}

function templatesFor(world,torrent,count){
  const seed=String(world.seed||''),stats=diagnosticsFor(world);
  let cached=peerTemplates.get(torrent);
  if(!cached||cached.seed!==seed){
    cached={seed,rows:[]};peerTemplates.set(torrent,cached);stats.templateBuilds++;
  }else stats.templateHits++;
  while(cached.rows.length<count){
    cached.rows.push(templateRow(world,torrent,cached.rows.length));
    stats.templateRows++;
  }
  return cached.rows;
}

function virtualHostName(ip){
  const label=String(ip||'peer').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'peer';
  return `${label}.peer.virtual.invalid`;
}

export function projectPeerHostNames(world,peers,contract=null){
  if(!contract?.hostNameField)return peers;
  const enabled=world?.preferences?.[contract.hostNamePreference]===true,out={};
  for(const [key,row] of Object.entries(peers||{})){
    if(!row||typeof row!=='object'){out[key]=row;continue;}
    if(contract.hostNameNonI2POnly&&Object.prototype.hasOwnProperty.call(row,'i2p_dest')){out[key]={...row};continue;}
    out[key]={...row,host_name:enabled?virtualHostName(row.ip):''};
  }
  return out;
}

export function generatedPeers(world,hash){
  const torrent=torrentIndex(world).byHash.get(String(hash||''));
  if(!torrent)return{};
  const count=Math.min(40,torrent.connectedPeers||Math.min(torrent.seeders+torrent.leechers,8)),out={};
  const templates=templatesFor(world,torrent,count);
  const dlSpeed=Math.floor(torrent.effectiveDownloadRate/Math.max(1,count));
  const upSpeed=Math.floor(torrent.effectiveUploadRate/Math.max(1,count));
  for(let i=0;i<count;i++){
    const template=templates[i];
    out[template.key]={...template.value,dl_speed:dlSpeed,up_speed:upSpeed};
  }
  return out;
}

export function peerViewStats(world){return{...diagnosticsFor(world)};}
